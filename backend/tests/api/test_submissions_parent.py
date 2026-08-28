import io

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.supabase import supabase_client
from app.main import app
from tests.conftest import TEST_TEACHER_ID
from tests.synthetic import make_segmented_worksheet

# Fetch an existing parent ID from DB or use fallback
res_parent = supabase_client.table("parent").select("id").limit(1).execute()
TEST_PARENT_ID = (
    res_parent.data[0]["id"]
    if res_parent.data
    else "b6b6f61b-6445-4ed3-b278-27218ba0255b"
)


@pytest.fixture
def parent_client():
    """Client authenticated as a parent user."""
    def override_user():
        return {"sub": TEST_PARENT_ID, "role": "parent", "email": "parent@test.com"}

    app.dependency_overrides[get_current_user] = override_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def take_home_activity():
    """Create a temporary take-home activity owned by the test teacher."""
    res = (
        supabase_client.table("activity")
        .insert(
            {
                "target_text": "one two three four five six",
                "is_take_home": True,
                "created_by": TEST_TEACHER_ID,
            }
        )
        .execute()
    )
    activity = res.data[0]
    yield activity
    supabase_client.table("activity").delete().eq("id", activity["id"]).execute()


@pytest.fixture
def in_class_activity():
    """Create a temporary non-take-home activity owned by the test teacher."""
    res = (
        supabase_client.table("activity")
        .insert(
            {
                "target_text": "one two three four five six",
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
def linked_student():
    """Create a student linked to both TEST_TEACHER_ID and TEST_PARENT_ID."""
    student_res = (
        supabase_client.table("student")
        .insert({"full_name": "Test Parent Child", "section": "Grade 3 - Parent"})
        .execute()
    )
    student = student_res.data[0]

    # Link to teacher
    supabase_client.table("teacher_student").insert(
        {"teacher_id": TEST_TEACHER_ID, "student_id": student["id"]}
    ).execute()

    # Link to parent
    supabase_client.table("student_parent").insert(
        {"parent_id": TEST_PARENT_ID, "student_id": student["id"]}
    ).execute()

    yield student

    # Cleanup
    supabase_client.table("student_parent").delete().match(
        {"parent_id": TEST_PARENT_ID, "student_id": student["id"]}
    ).execute()
    supabase_client.table("teacher_student").delete().match(
        {"teacher_id": TEST_TEACHER_ID, "student_id": student["id"]}
    ).execute()
    supabase_client.table("student").delete().eq("id", student["id"]).execute()


@pytest.fixture
def unlinked_student():
    """Create a student linked only to teacher, NOT to TEST_PARENT_ID."""
    student_res = (
        supabase_client.table("student")
        .insert({"full_name": "Unlinked Child", "section": "Grade 3 - Other"})
        .execute()
    )
    student = student_res.data[0]

    supabase_client.table("teacher_student").insert(
        {"teacher_id": TEST_TEACHER_ID, "student_id": student["id"]}
    ).execute()

    yield student

    supabase_client.table("teacher_student").delete().match(
        {"teacher_id": TEST_TEACHER_ID, "student_id": student["id"]}
    ).execute()
    supabase_client.table("student").delete().eq("id", student["id"]).execute()


@pytest.fixture
def cleanup_submissions():
    """Track and clean up submissions, measurement rows, manual_score rows, and Storage files."""
    submissions = []
    yield submissions
    for sub in submissions:
        supabase_client.table("manual_score").delete().eq("submission_id", sub["id"]).execute()
        supabase_client.table("measurement").delete().eq("submission_id", sub["id"]).execute()
        supabase_client.table("submission").delete().eq("id", sub["id"]).execute()
        try:
            supabase_client.storage.from_("submission-images").remove([sub["image_path"]])
        except Exception:
            pass


class TestParentSubmissionAuthorization:
    """Verify parent authorization checks in create_submission endpoint."""

    def test_parent_rejected_when_not_linked_to_student(
        self, parent_client, take_home_activity, unlinked_student
    ):
        """Parent not linked to the student receives 404."""
        jpeg_bytes = make_segmented_worksheet()
        response = parent_client.post(
            "/api/submissions",
            data={
                "activity_id": take_home_activity["id"],
                "student_id": unlinked_student["id"],
            },
            files={"image": ("test.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
        )
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"

    def test_parent_rejected_when_activity_not_take_home(
        self, parent_client, in_class_activity, linked_student
    ):
        """Parent submitting against non-take-home activity receives 404."""
        jpeg_bytes = make_segmented_worksheet()
        response = parent_client.post(
            "/api/submissions",
            data={
                "activity_id": in_class_activity["id"],
                "student_id": linked_student["id"],
            },
            files={"image": ("test.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
        )
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"

    def test_parent_can_submit_for_valid_take_home_activity(
        self, parent_client, take_home_activity, linked_student, cleanup_submissions
    ):
        """Parent with valid child link and take-home activity uploads successfully."""
        jpeg_bytes = make_segmented_worksheet()
        response = parent_client.post(
            "/api/submissions",
            data={
                "activity_id": take_home_activity["id"],
                "student_id": linked_student["id"],
            },
            files={"image": ("test.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
        )
        assert response.status_code == 201
        data = response.json()
        assert "submission_id" in data
        assert data["status"] == "completed"

        # Verify submission record in DB has uploader_role = 'parent'
        # and uploader_id = TEST_PARENT_ID
        sub_row = (
            supabase_client.table("submission")
            .select("*")
            .eq("id", data["submission_id"])
            .single()
            .execute()
        )
        assert sub_row.data["uploader_role"] == "parent"
        assert sub_row.data["uploader_id"] == TEST_PARENT_ID

        cleanup_submissions.append(
            {"id": data["submission_id"], "image_path": sub_row.data["image_path"]}
        )
