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
                "details": {
                    "max_bytes": _MAX_FILE_SIZE,
                    "actual_bytes": len(file_bytes),
                },
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