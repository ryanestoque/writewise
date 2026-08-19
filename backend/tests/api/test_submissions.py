import io
import uuid

import pytest
from PIL import Image

from app.core.supabase import supabase_client
from tests.conftest import TEST_TEACHER_ID


def _make_test_jpeg(width: int = 100, height: int = 100) -> bytes:
    """Create a valid JPEG image for testing."""
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), (200, 200, 200))
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def test_activity():
    """Create a temporary activity owned by the test teacher."""
    res = (
        supabase_client.table("activity")
        .insert(
            {
                "target_text": "test submission upload",
                "is_take_home": False,
                "created_by": TEST_TEACHER_ID,
            }
        )
        .execute()
    )
    activity = res.data[0]
    yield activity
    supabase_client.table("activity").delete().eq("id", activity["id"]).execute()


@pytest.fixture
def test_student():
    """Create a temporary student on the test teacher's roster."""
    student_res = (
        supabase_client.table("student")
        .insert({"full_name": "Test Upload Student", "section": "Test Section"})
        .execute()
    )
    student = student_res.data[0]

    supabase_client.table("teacher_student").insert(
        {"teacher_id": TEST_TEACHER_ID, "student_id": student["id"]}
    ).execute()

    yield student

    # Cleanup: delete link first (FK), then student
    supabase_client.table("teacher_student").delete().match(
        {"teacher_id": TEST_TEACHER_ID, "student_id": student["id"]}
    ).execute()
    supabase_client.table("student").delete().eq("id", student["id"]).execute()


@pytest.fixture
def cleanup_submissions():
    """Track and clean up submissions + Storage files after test."""
    submissions = []
    yield submissions
    for sub in submissions:
        # Delete submission row first
        supabase_client.table("submission").delete().eq("id", sub["id"]).execute()
        # Delete Storage file
        try:
            supabase_client.storage.from_("submission-images").remove(
                [sub["image_path"]]
            )
        except Exception:
            pass  # File may not exist if upload failed


class TestCreateSubmission:
    def test_successful_upload(
        self, client, test_activity, test_student, cleanup_submissions
    ):
        jpeg_bytes = _make_test_jpeg()
        response = client.post(
            "/api/submissions",
            data={
                "activity_id": test_activity["id"],
                "student_id": test_student["id"],
            },
            files={"image": ("test.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
        )
        assert response.status_code == 201
        data = response.json()
        assert "submission_id" in data
        assert data["status"] == "processing"
        assert data["student_id"] == test_student["id"]
        assert data["activity_id"] == test_activity["id"]
        assert "image_path" in data
        assert "created_at" in data

        cleanup_submissions.append(
            {"id": data["submission_id"], "image_path": data["image_path"]}
        )

        # Verify DB row
        db_res = (
            supabase_client.table("submission")
            .select("*")
            .eq("id", data["submission_id"])
            .execute()
        )
        assert len(db_res.data) == 1
        assert db_res.data[0]["status"] == "processing"
        assert db_res.data[0]["uploader_role"] == "teacher"

    def test_non_image_file_rejected(self, client, test_activity, test_student):
        fake_file = b"This is plain text, not an image"
        response = client.post(
            "/api/submissions",
            data={
                "activity_id": test_activity["id"],
                "student_id": test_student["id"],
            },
            files={"image": ("fake.jpg", io.BytesIO(fake_file), "image/jpeg")},
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"

    def test_file_too_large_rejected(self, client, test_activity, test_student):
        # Create a file slightly over 15 MB
        large_bytes = b"\xff\xd8\xff" + b"\x00" * (15 * 1024 * 1024 + 1)
        response = client.post(
            "/api/submissions",
            data={
                "activity_id": test_activity["id"],
                "student_id": test_student["id"],
            },
            files={"image": ("big.jpg", io.BytesIO(large_bytes), "image/jpeg")},
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "FILE_TOO_LARGE"

    def test_invalid_activity_id_rejected(self, client, test_student):
        jpeg_bytes = _make_test_jpeg()
        fake_activity_id = str(uuid.uuid4())
        response = client.post(
            "/api/submissions",
            data={
                "activity_id": fake_activity_id,
                "student_id": test_student["id"],
            },
            files={"image": ("test.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
        )
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"

    def test_student_not_on_roster_rejected(self, client, test_activity):
        jpeg_bytes = _make_test_jpeg()
        fake_student_id = str(uuid.uuid4())
        response = client.post(
            "/api/submissions",
            data={
                "activity_id": test_activity["id"],
                "student_id": fake_student_id,
            },
            files={"image": ("test.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
        )
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"

    def test_png_upload_converts_to_jpeg(
        self, client, test_activity, test_student, cleanup_submissions
    ):
        """PNG uploads should be accepted and stored as JPEG."""
        buf = io.BytesIO()
        Image.new("RGB", (50, 50), (100, 100, 100)).save(buf, format="PNG")
        png_bytes = buf.getvalue()

        response = client.post(
            "/api/submissions",
            data={
                "activity_id": test_activity["id"],
                "student_id": test_student["id"],
            },
            files={"image": ("test.png", io.BytesIO(png_bytes), "image/png")},
        )
        assert response.status_code == 201
        data = response.json()
        # Path should end with .jpg regardless of input format
        assert data["image_path"].endswith(".jpg")

        cleanup_submissions.append(
            {"id": data["submission_id"], "image_path": data["image_path"]}
        )