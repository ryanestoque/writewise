# Submission Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable teachers to upload photos of student handwriting for a given activity, with server-side image hardening (magic-byte validation, decompression-bomb cap, EXIF stripping), and display uploaded submissions as a card grid on the activity detail page.

**Architecture:** Backend receives multipart file upload, runs three security checks (SECURITY §4), writes hardened JPEG to Supabase Storage private bucket, creates a `submission` row with `status = 'processing'`. Frontend overhauls the existing `QuickUploadDialog` scaffold into a functional multi-step flow (select student/activity → capture photo → preview + confirm → upload), and replaces the activity detail page's placeholder with a real submissions card grid. No CV/ML pipeline yet — submissions stay in `processing` status.

**Tech Stack:** FastAPI (multipart/form-data), Pillow (image processing), Supabase Storage (service-role writes), Next.js, TanStack Query, shadcn/ui

**Spec:** [`docs/superpowers/specs/2026-08-19-submission-upload-design.md`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/superpowers/specs/2026-08-19-submission-upload-design.md)

## Global Constraints

- Python 3.13, `uv` for package management
- Node 24, `npm` for package management
- `strict: true` TypeScript — never relax it
- Lint: `uv run ruff check .` (backend), `npx eslint .` (frontend), `npx tsc --noEmit` (types)
- Error responses use `{ error: { code, message, details } }` envelope — frontend branches on `error.code`, never `error.message`
- EXIF stripping is **unconditional** on every path that writes an image to Storage (AGENTS.md §6 rule 3)
- Magic-byte check and pixel-dimension cap run **before** Pillow/OpenCV touches the file (AGENTS.md §6 rule 5)
- Rejected submissions persist as `submission` rows with `status = 'rejected'` + reason (AGENTS.md §6 rule 9) — not applicable to this plan (no quality gate yet), but the schema supports it
- No `Content-Type` header on `FormData` fetch calls — let the browser set `multipart/form-data` with the boundary
- Follow existing patterns: `activities.py` for endpoint style, `use-activities.ts` for hook style, `test_activities.py` for test style

---

## File Structure

| File | Responsibility |
|------|---------------|
| `backend/app/core/image_hardening.py` | **NEW** — Magic-byte validation, decompression-bomb cap, EXIF strip. Pure function: bytes in → clean JPEG bytes out. |
| `backend/tests/core/test_image_hardening.py` | **NEW** — Unit tests for all three security checks |
| `backend/app/api/submissions.py` | **NEW** — `POST ""` endpoint: auth, ownership checks, hardening call, Storage write, DB insert |
| `backend/tests/api/test_submissions.py` | **NEW** — Integration tests for submission upload endpoint |
| `backend/app/main.py` | **MODIFY** — Register submissions router |
| `backend/pyproject.toml` | **MODIFY** — Add `Pillow` dependency |
| `frontend/lib/hooks/use-submissions.ts` | **NEW** — `useSubmissions`, `useUploadSubmission`, `useSubmissionImageUrl` hooks |
| `frontend/components/quick-upload-dialog.tsx` | **OVERHAUL** — Multi-step upload flow replacing scaffold |
| `frontend/components/teacher-modals-provider.tsx` | **MODIFY** — Add pre-fill props to `openUpload` |
| `frontend/app/(teacher)/activities/[id]/page.tsx` | **MODIFY** — Wire real submissions card grid + upload button |

---

### Task 1: Image Hardening Utility

**Files:**
- Create: `backend/app/core/image_hardening.py`
- Create: `backend/tests/core/__init__.py`
- Create: `backend/tests/core/test_image_hardening.py`
- Modify: `backend/pyproject.toml` (add Pillow dependency)

**Interfaces:**
- Consumes: nothing (standalone utility)
- Produces: `validate_and_harden_image(file_bytes: bytes) -> bytes` — takes raw uploaded bytes, returns clean JPEG bytes. Raises `fastapi.HTTPException` with status 400 and `error.code` of `UNSUPPORTED_FILE_TYPE` or `FILE_TOO_LARGE` on failure. Used by Task 2's endpoint.

- [ ] **Step 1: Add Pillow dependency**

Add `pillow` to the backend dependencies:

```toml
# In backend/pyproject.toml, add to the dependencies list:
    "pillow>=11.0.0",
```

Run:
```bash
cd backend
uv sync
```

- [ ] **Step 2: Write failing tests for magic-byte validation**

Create `backend/tests/core/__init__.py` (empty file) and `backend/tests/core/test_image_hardening.py`:

```python
import struct

import pytest
from fastapi import HTTPException

from app.core.image_hardening import validate_and_harden_image


def _make_minimal_jpeg() -> bytes:
    """Create a minimal valid JPEG file (1x1 white pixel)."""
    from PIL import Image
    import io
    buf = io.BytesIO()
    img = Image.new("RGB", (1, 1), (255, 255, 255))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_minimal_png() -> bytes:
    """Create a minimal valid PNG file (1x1 white pixel)."""
    from PIL import Image
    import io
    buf = io.BytesIO()
    img = Image.new("RGB", (1, 1), (255, 255, 255))
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestMagicByteValidation:
    def test_valid_jpeg_passes(self):
        jpeg_bytes = _make_minimal_jpeg()
        result = validate_and_harden_image(jpeg_bytes)
        assert isinstance(result, bytes)
        assert len(result) > 0
        # Output should start with JPEG magic bytes
        assert result[:2] == b"\xff\xd8"

    def test_valid_png_passes_and_converts_to_jpeg(self):
        png_bytes = _make_minimal_png()
        result = validate_and_harden_image(png_bytes)
        assert isinstance(result, bytes)
        # Output should be JPEG (converted from PNG)
        assert result[:2] == b"\xff\xd8"

    def test_text_file_with_jpg_extension_rejected(self):
        fake_file = b"This is not an image file at all"
        with pytest.raises(HTTPException) as exc_info:
            validate_and_harden_image(fake_file)
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail["code"] == "UNSUPPORTED_FILE_TYPE"

    def test_empty_file_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_and_harden_image(b"")
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail["code"] == "UNSUPPORTED_FILE_TYPE"

    def test_truncated_header_rejected(self):
        # Just the first byte of a JPEG header
        with pytest.raises(HTTPException) as exc_info:
            validate_and_harden_image(b"\xff")
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail["code"] == "UNSUPPORTED_FILE_TYPE"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/core/test_image_hardening.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.core.image_hardening'`

- [ ] **Step 4: Implement magic-byte validation**

Create `backend/app/core/image_hardening.py`:

```python
from fastapi import HTTPException, status

# JPEG: FF D8 FF
_JPEG_MAGIC = b"\xff\xd8\xff"
# PNG: 89 50 4E 47 0D 0A 1A 0A
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _check_magic_bytes(file_bytes: bytes) -> str:
    """
    Verify file signature matches JPEG or PNG.
    Returns the detected format ('JPEG' or 'PNG').
    Raises HTTPException with UNSUPPORTED_FILE_TYPE if neither.
    """
    if len(file_bytes) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSUPPORTED_FILE_TYPE",
                "message": "File is not a supported image type. Please upload a JPEG or PNG.",
                "details": {},
            },
        )

    if file_bytes[:3] == _JPEG_MAGIC:
        return "JPEG"
    if file_bytes[:8] == _PNG_MAGIC:
        return "PNG"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "code": "UNSUPPORTED_FILE_TYPE",
            "message": "File is not a supported image type. Please upload a JPEG or PNG.",
            "details": {},
        },
    )
```

This is partial — the full `validate_and_harden_image` function comes in step 7.

- [ ] **Step 5: Write failing tests for EXIF stripping**

Add to `test_image_hardening.py`:

```python
class TestExifStripping:
    def test_exif_gps_stripped_from_jpeg(self):
        """EXIF with GPS data must be completely removed."""
        from PIL import Image
        import io
        import piexif

        # Build a JPEG with GPS EXIF data
        img = Image.new("RGB", (10, 10), (128, 128, 128))
        # Create EXIF with GPS coordinates (simulating a phone photo)
        exif_dict = {
            "GPS": {
                piexif.GPSIFD.GPSLatitude: ((14, 1), (35, 1), (0, 1)),
                piexif.GPSIFD.GPSLatitudeRef: "N",
                piexif.GPSIFD.GPSLongitude: ((121, 1), (0, 1), (0, 1)),
                piexif.GPSIFD.GPSLongitudeRef: "E",
            }
        }
        exif_bytes = piexif.dump(exif_dict)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif_bytes)
        input_bytes = buf.getvalue()

        result = validate_and_harden_image(input_bytes)

        # Verify output has no EXIF
        result_img = Image.open(io.BytesIO(result))
        exif_data = result_img.info.get("exif", b"")
        assert exif_data == b"" or len(exif_data) == 0

    def test_jpeg_without_exif_still_works(self):
        """A JPEG with no EXIF should pass through cleanly."""
        jpeg_bytes = _make_minimal_jpeg()
        result = validate_and_harden_image(jpeg_bytes)
        assert isinstance(result, bytes)
        assert result[:2] == b"\xff\xd8"
```

> **Note:** This test uses `piexif` to create test fixtures only. Add `piexif` to dev dependencies: in `pyproject.toml` under `[dependency-groups] dev`, add `"piexif>=1.1.3"`. Run `uv sync` after.

- [ ] **Step 6: Run tests to verify EXIF tests fail**

Run: `cd backend && uv run pytest tests/core/test_image_hardening.py::TestExifStripping -v`
Expected: FAIL (function exists from step 4 but doesn't strip EXIF yet)

- [ ] **Step 7: Implement full `validate_and_harden_image`**

Complete `backend/app/core/image_hardening.py` — add the decompression-bomb check and EXIF strip, then wire everything into the public function:

```python
import io

from fastapi import HTTPException, status
from PIL import Image

# JPEG: FF D8 FF
_JPEG_MAGIC = b"\xff\xd8\xff"
# PNG: 89 50 4E 47 0D 0A 1A 0A
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"

# Pillow's default — ~178 megapixels. Protects against decompression bombs
# where a small file decodes into an enormous in-memory bitmap (SECURITY §4.2).
_MAX_PIXELS = 178_956_970


def _check_magic_bytes(file_bytes: bytes) -> str:
    """
    Verify file signature matches JPEG or PNG.
    Returns the detected format ('JPEG' or 'PNG').
    Raises HTTPException with UNSUPPORTED_FILE_TYPE if neither.
    """
    if len(file_bytes) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSUPPORTED_FILE_TYPE",
                "message": "File is not a supported image type. Please upload a JPEG or PNG.",
                "details": {},
            },
        )

    if file_bytes[:3] == _JPEG_MAGIC:
        return "JPEG"
    if file_bytes[:8] == _PNG_MAGIC:
        return "PNG"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "code": "UNSUPPORTED_FILE_TYPE",
            "message": "File is not a supported image type. Please upload a JPEG or PNG.",
            "details": {},
        },
    )


def validate_and_harden_image(file_bytes: bytes) -> bytes:
    """
    Run all three security checks (SECURITY §4) and return hardened JPEG bytes.

    1. Magic-byte file-signature validation (before Pillow touches the file)
    2. Decompression-bomb pixel-dimension cap (at decode time)
    3. Unconditional EXIF metadata stripping (GPS, timestamps, device info)

    PNG inputs are converted to JPEG. Output is always clean JPEG bytes
    with no EXIF data, ready for Storage upload.

    Raises:
        HTTPException(400, UNSUPPORTED_FILE_TYPE) — not JPEG/PNG
        HTTPException(400, FILE_TOO_LARGE) — pixel dimensions exceed cap
    """
    # Check 1: Magic bytes — runs BEFORE Pillow touches the file (AGENTS.md §6 rule 5)
    _check_magic_bytes(file_bytes)

    # Check 2: Decompression-bomb cap — set before Image.open()
    Image.MAX_IMAGE_PIXELS = _MAX_PIXELS
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.load()  # Force full decode to trigger DecompressionBombError
    except Image.DecompressionBombError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": "Image dimensions are too large to process safely.",
                "details": {},
            },
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSUPPORTED_FILE_TYPE",
                "message": "File could not be decoded as an image. Please upload a valid JPEG or PNG.",
                "details": {},
            },
        )

    # Check 3: Unconditional EXIF strip — re-save as JPEG with no metadata.
    # Convert RGBA (PNG with transparency) to RGB for JPEG compatibility.
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    output = io.BytesIO()
    img.save(output, format="JPEG", quality=95, exif=b"")
    return output.getvalue()
```

- [ ] **Step 8: Run all image hardening tests**

Run: `cd backend && uv run pytest tests/core/test_image_hardening.py -v`
Expected: ALL PASS

- [ ] **Step 9: Lint check**

Run: `cd backend && uv run ruff check .`
Expected: Clean

- [ ] **Step 10: Commit**

```bash
cd backend
git add app/core/image_hardening.py tests/core/__init__.py tests/core/test_image_hardening.py pyproject.toml uv.lock
git commit -m "feat: add image hardening utility (magic-byte, decompression-bomb, EXIF strip)"
```

---

### Task 2: POST /api/submissions Endpoint

**Files:**
- Create: `backend/app/api/submissions.py`
- Create: `backend/tests/api/test_submissions.py`
- Modify: `backend/app/main.py` (register router)

**Interfaces:**
- Consumes: `validate_and_harden_image(file_bytes: bytes) -> bytes` from Task 1
- Consumes: `get_current_teacher` from `app.api.deps`
- Consumes: `supabase_client` from `app.core.supabase`
- Produces: `POST /api/submissions` — accepts `multipart/form-data` with fields `image` (file), `activity_id` (str), `student_id` (str). Returns `201 Created` with `{ submission_id, status, image_path, student_id, activity_id, created_at }`. Used by Task 3's `useUploadSubmission` hook.

- [ ] **Step 1: Write failing tests for the submission endpoint**

Create `backend/tests/api/test_submissions.py`:

```python
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
        from PIL import Image as PILImage

        buf = io.BytesIO()
        PILImage.new("RGB", (50, 50), (100, 100, 100)).save(buf, format="PNG")
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/api/test_submissions.py -v`
Expected: FAIL with `ModuleNotFoundError` or routing errors

- [ ] **Step 3: Implement the submissions endpoint**

Create `backend/app/api/submissions.py`:

```python
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.deps import get_current_teacher
from app.core.image_hardening import validate_and_harden_image
from app.core.supabase import supabase_client

router = APIRouter()

_MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_submission(
    image: UploadFile = File(...),
    activity_id: str = Form(...),
    student_id: str = Form(...),
    teacher: dict = Depends(get_current_teacher),
):
    teacher_id = teacher.get("sub")

    # --- Validation ---

    # 1. Validate UUIDs
    try:
        uuid.UUID(activity_id)
        uuid.UUID(student_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "activity_id and student_id must be valid UUIDs.",
                "details": {},
            },
        )

    # 2. Read file and check size
    file_bytes = await image.read()
    if len(file_bytes) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": "Image file must be 15 MB or smaller.",
                "details": {"max_bytes": _MAX_FILE_SIZE, "actual_bytes": len(file_bytes)},
            },
        )

    # 3. Verify activity exists and belongs to this teacher
    activity_res = (
        supabase_client.table("activity")
        .select("id")
        .eq("id", activity_id)
        .eq("created_by", teacher_id)
        .execute()
    )
    if not activity_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": "Activity not found.",
                "details": {},
            },
        )

    # 4. Verify student is on this teacher's roster
    roster_res = (
        supabase_client.table("teacher_student")
        .select("student_id")
        .eq("teacher_id", teacher_id)
        .eq("student_id", student_id)
        .execute()
    )
    if not roster_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": "Student not found on your roster.",
                "details": {},
            },
        )

    # 5. Image hardening: magic-byte check, decompression-bomb cap, EXIF strip
    hardened_bytes = validate_and_harden_image(file_bytes)

    # --- Upload & Persist ---

    # 6. Pre-generate submission UUID (need it for Storage path before DB insert)
    submission_id = str(uuid.uuid4())

    # 7. Construct image path per DATABASE §7/§11 convention
    image_path = f"{student_id}/{submission_id}.jpg"

    # 8. Upload to Supabase Storage (service-role key, bypasses RLS)
    storage_res = supabase_client.storage.from_("submission-images").upload(
        path=image_path,
        file=hardened_bytes,
        file_options={"content-type": "image/jpeg"},
    )
    # The supabase-py storage client raises on failure, but check defensively
    if hasattr(storage_res, "error") and storage_res.error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to upload image to storage.",
                "details": {},
            },
        )

    # 9. Insert submission row
    db_res = (
        supabase_client.table("submission")
        .insert(
            {
                "id": submission_id,
                "activity_id": activity_id,
                "student_id": student_id,
                "image_path": image_path,
                "status": "processing",
                "uploader_id": teacher_id,
                "uploader_role": "teacher",
            }
        )
        .execute()
    )

    if not db_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to create submission record.",
                "details": {},
            },
        )

    submission = db_res.data[0]

    # 10. Return response
    return {
        "submission_id": submission["id"],
        "status": submission["status"],
        "image_path": submission["image_path"],
        "student_id": submission["student_id"],
        "activity_id": submission["activity_id"],
        "created_at": submission["created_at"],
    }
```

- [ ] **Step 4: Register the router in `main.py`**

In `backend/app/main.py`, add the import and router registration:

```python
# Add import at top, after existing imports:
from app.api.submissions import router as submissions_router

# Add at bottom, after existing router registrations:
app.include_router(submissions_router, prefix="/api/submissions", tags=["submissions"])
```

- [ ] **Step 5: Run submission endpoint tests**

Run: `cd backend && uv run pytest tests/api/test_submissions.py -v`
Expected: ALL PASS

- [ ] **Step 6: Run full backend test suite**

Run: `cd backend && uv run pytest -v`
Expected: ALL PASS (existing tests unaffected)

- [ ] **Step 7: Lint check**

Run: `cd backend && uv run ruff check .`
Expected: Clean

- [ ] **Step 8: Commit**

```bash
cd backend
git add app/api/submissions.py tests/api/test_submissions.py app/main.py
git commit -m "feat: add POST /api/submissions endpoint with image hardening and Storage upload"
```

---

### Task 3: Frontend Data Hooks

**Files:**
- Create: `frontend/lib/hooks/use-submissions.ts`

**Interfaces:**
- Consumes: `POST /api/submissions` from Task 2 (via Next.js rewrite proxy to FastAPI)
- Consumes: Supabase client from `@/lib/supabase/client`
- Produces:
  - `useSubmissions(activityId: string)` — returns `UseQueryResult<Submission[]>`. Used by Task 5's activity detail page.
  - `useUploadSubmission()` — returns `UseMutationResult`. Accepts `{ image: File, activityId: string, studentId: string }`. Used by Task 4's upload dialog.
  - `useSubmissionImageUrl(imagePath: string | null)` — returns `UseQueryResult<string | null>`. Returns a signed URL for the submission image. Used by Task 5's submission cards.
  - `Submission` type export. Used by Tasks 4 and 5.

- [ ] **Step 1: Create the submissions hooks file**

Create `frontend/lib/hooks/use-submissions.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "../supabase/client";

export interface Submission {
  id: string;
  activity_id: string;
  student_id: string;
  image_path: string;
  status: "processing" | "completed" | "rejected";
  uploader_id: string;
  uploader_role: "teacher" | "parent";
  rejection_code: string | null;
  created_at: string;
  updated_at: string;
  student: {
    full_name: string;
  };
}

export function useSubmissions(activityId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["submissions", activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submission")
        .select(
          `id, activity_id, student_id, image_path, status, uploader_id,
           uploader_role, rejection_code, created_at, updated_at,
           student:student_id(full_name)`
        )
        .eq("activity_id", activityId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data as unknown as Submission[];
    },
    enabled: !!activityId,
  });
}

export function useUploadSubmission() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      image,
      activityId,
      studentId,
    }: {
      image: File;
      activityId: string;
      studentId: string;
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No active session");
      }

      const formData = new FormData();
      formData.append("image", image);
      formData.append("activity_id", activityId);
      formData.append("student_id", studentId);

      // No Content-Type header — let the browser set multipart/form-data
      // with the correct boundary automatically.
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Backend returned error:", data.error);
        throw data.error;
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate all submission lists so any visible list refreshes
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });
}

export function useSubmissionImageUrl(imagePath: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["submission-image", imagePath],
    queryFn: async () => {
      if (!imagePath) return null;

      const { data, error } = await supabase.storage
        .from("submission-images")
        .createSignedUrl(imagePath, 3600); // 1-hour signed URL

      if (error) {
        throw new Error(error.message);
      }

      return data.signedUrl;
    },
    enabled: !!imagePath,
    // Cache for 30 minutes — well within the 1-hour signing window
    staleTime: 30 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 3: Lint check**

Run: `cd frontend && npx eslint lib/hooks/use-submissions.ts`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
cd frontend
git add lib/hooks/use-submissions.ts
git commit -m "feat: add useSubmissions, useUploadSubmission, and useSubmissionImageUrl hooks"
```

---

### Task 4: Overhaul Upload Dialog

**Files:**
- Modify: `frontend/components/quick-upload-dialog.tsx` (overhaul)
- Modify: `frontend/components/teacher-modals-provider.tsx` (add pre-fill props)

**Interfaces:**
- Consumes: `useUploadSubmission()` from Task 3
- Consumes: `useActivities()` from `@/lib/hooks/use-activities`
- Consumes: `useStudents()` from `@/lib/hooks/use-students`
- Produces: `QuickUploadDialog` component with props `{ open, onOpenChange, prefilledActivityId?, prefilledStudentId? }`. Used by Task 5's activity detail page via `openUpload({ activityId })`.
- Produces: Updated `TeacherModalsContextValue.openUpload(opts?: { activityId?: string; studentId?: string })`. Used by Task 5's upload button.

- [ ] **Step 1: Update `TeacherModalsProvider` to support pre-fill props**

In `frontend/components/teacher-modals-provider.tsx`, make these changes:

1. Add pre-fill state and update the context type:

```typescript
// Replace the interface with:
interface TeacherModalsContextValue {
  uploadOpen: boolean;
  setUploadOpen: (open: boolean) => void;
  openUpload: (opts?: { activityId?: string; studentId?: string }) => void;
  uploadPrefill: { activityId?: string; studentId?: string };

  rubricOpen: boolean;
  setRubricOpen: (open: boolean) => void;
  openRubric: () => void;

  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  openShortcuts: () => void;

  signOutOpen: boolean;
  setSignOutOpen: (open: boolean) => void;
  openSignOut: () => void;
}
```

2. Add pre-fill state in the provider component:

```typescript
// After the existing useState declarations, add:
const [uploadPrefill, setUploadPrefill] = useState<{
  activityId?: string;
  studentId?: string;
}>({});

// Replace the openUpload callback:
const openUpload = useCallback(
  (opts?: { activityId?: string; studentId?: string }) => {
    setUploadPrefill(opts ?? {});
    setUploadOpen(true);
  },
  []
);
```

3. Add `uploadPrefill` to the context value and pass pre-fill props to the dialog:

```typescript
// In the context provider value, add:
uploadPrefill,

// Update the QuickUploadDialog render:
<QuickUploadDialog
  open={uploadOpen}
  onOpenChange={(val) => {
    setUploadOpen(val);
    if (!val) setUploadPrefill({});
  }}
  prefilledActivityId={uploadPrefill.activityId}
  prefilledStudentId={uploadPrefill.studentId}
/>
```

- [ ] **Step 2: Overhaul `QuickUploadDialog` with multi-step flow**

Replace the entire contents of `frontend/components/quick-upload-dialog.tsx` with the multi-step upload flow. The new component has 4 steps:

1. **Select student & activity** — combobox selectors, pre-fillable
2. **Capture photo** — existing file input / drag-and-drop (preserved from scaffold)
3. **Preview + confirm** — existing preview + student/activity confirmation text
4. **Uploading** — spinner, success/error handling

The implementation should:
- Keep the existing quality guidelines callout from the scaffold (step 2)
- Keep the existing drag-and-drop and file preview logic (steps 2–3)
- Use `useActivities()` and `useStudents()` for the selectors
- Use `useUploadSubmission()` for the actual upload
- Accept `prefilledActivityId` and `prefilledStudentId` props
- When `prefilledActivityId` is set, show the activity as read-only and skip to student selection
- Disable the Submit button immediately on tap (API_SPEC §5 double-submit mitigation)
- On success: show toast via `sonner`, close dialog, query invalidation handles list refresh
- On error: show inline error banner in the dialog, branching on `error.code` (AGENTS.md §6 rule), with "Try Again" button
- Narrow `accept` attribute to `image/jpeg,image/png` only (remove WebP per API_SPEC §3.3)
- Add `capture="environment"` to the file input for mobile rear camera (DESIGN §7.1)
- Reset all state (step, file, selections) when dialog closes

> **Implementation note:** This is a full file rewrite. The existing scaffold's file-handling logic (drag-and-drop, preview URL management, client-side validation) should be preserved and integrated into the multi-step flow — don't rewrite it from scratch. The student/activity selectors should use shadcn `Popover` + `Command` (combobox pattern) matching the existing roster dialogs' selector style.

- [ ] **Step 3: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Lint check**

Run: `cd frontend && npx eslint components/quick-upload-dialog.tsx components/teacher-modals-provider.tsx`
Expected: Clean

- [ ] **Step 5: Manual QA — sidebar quick upload**

1. Run the dev server: `cd frontend && npm run dev`
2. Press ⌘K (or Ctrl+K) to open the upload dialog
3. Verify step 1 shows activity and student selectors (both empty, both required)
4. Select an activity and a student → "Next" becomes enabled
5. Click "Next" → step 2 shows the photo capture zone
6. Select a photo → step 3 shows preview with confirmation text ("Student: ... · Activity: ...")
7. Click "Submit" → step 4 shows uploading spinner
8. Verify toast appears on success and dialog closes
9. Verify "Retake" returns to step 2

- [ ] **Step 6: Commit**

```bash
cd frontend
git add components/quick-upload-dialog.tsx components/teacher-modals-provider.tsx
git commit -m "feat: overhaul QuickUploadDialog into multi-step upload flow with student/activity selection"
```

---

### Task 5: Submissions Card Grid on Activity Detail Page

**Files:**
- Modify: `frontend/app/(teacher)/activities/[id]/page.tsx`

**Interfaces:**
- Consumes: `useSubmissions(activityId)` from Task 3
- Consumes: `useSubmissionImageUrl(imagePath)` from Task 3
- Consumes: `Submission` type from Task 3
- Consumes: `openUpload({ activityId })` from Task 4's updated `TeacherModalsProvider`
- Produces: rendered submissions card grid on the activity detail page (terminal — no downstream consumers)

- [ ] **Step 1: Add imports and data fetching**

In `frontend/app/(teacher)/activities/[id]/page.tsx`, add these imports:

```typescript
import { type Submission, useSubmissions, useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
```

After the existing `useActivity(id)` call, add:

```typescript
const {
  data: submissions,
  isLoading: submissionsLoading,
  error: submissionsError,
  refetch: refetchSubmissions,
} = useSubmissions(id);
const { openUpload } = useTeacherModals();
```

- [ ] **Step 2: Create the `SubmissionCard` component**

Add a local component above the page's default export (same file — it's page-specific, not reusable yet):

```typescript
function SubmissionCard({ submission }: { submission: Submission }) {
  const { data: imageUrl } = useSubmissionImageUrl(submission.image_path);

  const statusConfig = {
    processing: {
      label: "Processing",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    },
    completed: {
      label: "Completed",
      className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
    },
    rejected: {
      label: "Rejected",
      className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-900",
    },
  } as const;

  const config = statusConfig[submission.status];

  return (
    <div className="bg-surface dark:bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
      {/* Photo Thumbnail */}
      <div className="aspect-4/3 bg-muted relative overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Handwriting by ${submission.student?.full_name ?? "student"}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full flex items-center justify-center text-muted-foreground">
            <FileText className="size-8" />
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium text-foreground truncate">
          {submission.student?.full_name ?? "Unknown Student"}
        </p>
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold px-2 py-0.5 ${config.className}`}
          >
            {config.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {getRelativeTime(submission.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
```

Add the required imports at the top of the file:

```typescript
import { type Submission, useSubmissions, useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
```

- [ ] **Step 3: Replace the placeholder submissions section**

Replace the entire `{/* Submissions Section — Placeholder */}` block (the `<div>` containing the empty state with the disabled Upload button) with:

```tsx
{/* Submissions Section */}
<div>
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <h2 className="text-lg font-heading font-semibold text-foreground tracking-tight">
        Submissions
      </h2>
      {submissions && submissions.length > 0 && (
        <Badge
          variant="outline"
          className="text-[10px] font-semibold px-2 py-0.5 bg-muted/50 text-muted-foreground border-border"
        >
          {submissions.length}
        </Badge>
      )}
    </div>
    <Button
      size="sm"
      className="h-9 font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl gap-1.5"
      onClick={() => openUpload({ activityId: id })}
    >
      <Upload className="w-4 h-4" />
      Upload Submission
    </Button>
  </div>

  {submissionsLoading ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface dark:bg-card border border-border rounded-xl shadow-2xs overflow-hidden"
        >
          <Skeleton className="aspect-4/3 w-full rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  ) : submissionsError ? (
    <div
      role="alert"
      className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span className="text-sm font-medium">
          Failed to load submissions: {submissionsError.message}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => refetchSubmissions()}
        className="border-destructive/30 hover:bg-destructive/10 text-destructive"
      >
        <RotateCcw className="w-4 h-4 mr-1.5" />
        Retry
      </Button>
    </div>
  ) : submissions && submissions.length > 0 ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {submissions.map((submission) => (
        <SubmissionCard key={submission.id} submission={submission} />
      ))}
    </div>
  ) : (
    <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
      <Empty className="py-12 border-0">
        <EmptyMedia
          variant="icon"
          className="bg-muted text-muted-foreground"
        >
          <Inbox className="w-6 h-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="text-lg sm:text-xl">
            No submissions yet
          </EmptyTitle>
          <EmptyDescription className="text-xs sm:text-sm max-w-sm mx-auto">
            Upload a student&apos;s handwriting for this activity to begin
            assessment.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex items-center justify-center w-full sm:w-auto px-4 sm:px-0">
          <Button
            className="h-10 sm:h-9 w-full sm:w-auto font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl"
            onClick={() => openUpload({ activityId: id })}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Submission
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )}
</div>
```

- [ ] **Step 4: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Lint check**

Run: `cd frontend && npx eslint app/\(teacher\)/activities/\[id\]/page.tsx`
Expected: Clean

- [ ] **Step 6: Manual QA — full flow**

1. Navigate to an activity detail page
2. Verify "Upload Submission" button appears in the submissions section header
3. Click "Upload Submission" → upload dialog opens with the activity pre-selected
4. Select a student → pick a photo → preview + confirm → submit
5. Verify toast appears, dialog closes, and the submission card appears in the grid
6. Verify the card shows: photo thumbnail, student name, "Processing" badge, relative date
7. Verify empty state still shows correctly for activities with no submissions
8. Test responsive layout: 1 col on mobile, 2 cols on tablet, 3 cols on desktop
9. Test error state: stop the backend, try uploading → error banner appears in dialog

- [ ] **Step 7: Commit**

```bash
cd frontend
git add app/\(teacher\)/activities/\[id\]/page.tsx
git commit -m "feat: wire submissions card grid and upload button on activity detail page"
```
