import logging
import uuid
from enum import Enum

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.api.deps import get_current_teacher
from app.core.config import settings
from app.core.image_hardening import validate_and_harden_image
from app.core.supabase import supabase_client
from app.cv.pipeline import run_cv_pipeline
from app.cv.quality_gate import QualityGateRejection
from app.cv.segmentation import PostSegmentationRejection

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB


class ScoreBandEnum(str, Enum):
    NEEDS_IMPROVEMENT = "needs_improvement"
    DEVELOPING = "developing"
    SATISFACTORY = "satisfactory"
    EXCELLENT = "excellent"


class ManualScoreRequest(BaseModel):
    letter_formation_band: ScoreBandEnum
    size_consistency_band: ScoreBandEnum
    spacing_band: ScoreBandEnum
    slant_band: ScoreBandEnum
    baseline_alignment_band: ScoreBandEnum


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

    # 3. Verify activity exists and belongs to this teacher; fetch target_text
    #    for the post-segmentation gate's expected word count.
    activity_res = (
        supabase_client.table("activity")
        .select("id, target_text")
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
    target_text: str = activity_res.data[0]["target_text"]
    expected_word_count = len(target_text.split())

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

    # 6. Run the full CV pipeline (ARCHITECTURE §8):
    #    quality gate → preprocessing → deskew → segmentation →
    #    post-segmentation gate → feature extraction.
    #    Both QualityGateRejection and PostSegmentationRejection are caught
    #    and persisted as rejected submissions, then surfaced as 422.
    rejection = None
    pipeline_result = None
    try:
        pipeline_result = run_cv_pipeline(hardened_bytes, expected_word_count)
    except QualityGateRejection as exc:
        rejection = {
            "code": exc.code,
            "message": exc.message,
            "details": {
                "measured_value": exc.measured_value,
                "threshold": exc.threshold,
            },
        }
    except PostSegmentationRejection as exc:
        rejection = {
            "code": exc.code,
            "message": exc.message,
            "details": {
                "detected_words": exc.detected_words,
                "expected_words": exc.expected_words,
            },
        }

    # --- Upload & Persist ---

    # 7. Pre-generate submission UUID (need it for Storage path before DB insert)
    submission_id = str(uuid.uuid4())

    # 8. Construct image path per DATABASE §7/§11 convention
    image_path = f"{student_id}/{submission_id}.jpg"

    # 9. Upload to Supabase Storage (service-role key, bypasses RLS)
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

    # 10. Insert submission row
    db_res = (
        supabase_client.table("submission")
        .insert(
            {
                "id": submission_id,
                "activity_id": activity_id,
                "student_id": student_id,
                "image_path": image_path,
                "status": "rejected" if rejection else "processing",
                "rejection_code": rejection["code"] if rejection else None,
                "rejection_details": rejection["message"] if rejection else None,
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

    # 11. Rejected: return 422 with the standard error envelope (API_SPEC §3.3)
    if rejection:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": rejection["code"],
                "message": rejection["message"],
                "details": {
                    "submission_id": submission_id,
                    **rejection["details"],
                },
            },
        )

    # --- Pipeline succeeded: persist measurement & complete submission ---

    measurement_data = pipeline_result.measurement
    aggregate = measurement_data.aggregate
    raw_output = measurement_data.to_dict()

    # 12. Insert measurement row (DATABASE §8)
    measurement_row = {
        "submission_id": submission_id,
        # Raw CV aggregates — 5 pairs from the CV pipeline.
        # letter_formation_mean/std stay NULL (CNN output, not built yet).
        "slant_mean": aggregate.slant.mean,
        "slant_std": aggregate.slant.std,
        "word_spacing_mean": aggregate.word_spacing.mean,
        "word_spacing_std": aggregate.word_spacing.std,
        "letter_spacing_mean": aggregate.letter_spacing.mean,
        "letter_spacing_std": aggregate.letter_spacing.std,
        "baseline_deviation_mean": aggregate.baseline_deviation.mean,
        "baseline_deviation_std": aggregate.baseline_deviation.std,
        "size_consistency_mean": aggregate.size_consistency.mean,
        "size_consistency_std": aggregate.size_consistency.std,
        # Score columns stay NULL in Phase 1 (DATABASE §8 note).
        # Full pipeline output for diagnostic overlay / downstream use.
        "raw_output": raw_output,
    }

    measurement_res = supabase_client.table("measurement").insert(measurement_row).execute()
    if not measurement_res.data:
        logger.error("Failed to insert measurement for submission_id=%s", submission_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to save measurement data.",
                "details": {},
            },
        )

    # 13. Update submission status to 'completed' (ARCHITECTURE §8 step 8)
    supabase_client.table("submission").update({"status": "completed"}).eq(
        "id", submission_id
    ).execute()

    # 14. Return API_SPEC §3.3 success response shape
    return {
        "submission_id": submission_id,
        "status": "completed",
        "measurement": {
            "aggregate": {
                "slant": {"mean": aggregate.slant.mean, "std": aggregate.slant.std},
                "word_spacing": {
                    "mean": aggregate.word_spacing.mean,
                    "std": aggregate.word_spacing.std,
                },
                "letter_spacing": {
                    "mean": aggregate.letter_spacing.mean,
                    "std": aggregate.letter_spacing.std,
                },
                "baseline_deviation": {
                    "mean": aggregate.baseline_deviation.mean,
                    "std": aggregate.baseline_deviation.std,
                },
                "size_consistency": {
                    "mean": aggregate.size_consistency.mean,
                    "std": aggregate.size_consistency.std,
                },
                "letter_formation": {"mean": None, "std": None},
            },
            "scores": {
                "letter_formation_score": None,
                "size_consistency_score": None,
                "spacing_score": None,
                "slant_score": None,
                "baseline_alignment_score": None,
                "composite_score": None,
            },
            "raw_output": raw_output,
            "overlay": None,
        },
    }


@router.patch("/{submission_id}/manual-score")
async def submit_manual_score(
    submission_id: str,
    body: ManualScoreRequest,
    teacher: dict = Depends(get_current_teacher),
):
    """Enters the teacher's independent rubric grade (Phase 1 calibration input).

    API_SPEC §3.3:
    - Teacher only, owning the student on this submission.
    - 403 MANUAL_SCORING_DISABLED when SCORING_ENGINE=calibrated.
    - 409 MANUAL_SCORE_ALREADY_EXISTS if called twice on the same submission.
    """
    teacher_id = teacher.get("sub")

    # 1. Check SCORING_ENGINE mode
    if settings.SCORING_ENGINE != "manual":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "MANUAL_SCORING_DISABLED",
                "message": "Manual scoring is only available in Phase 1 (SCORING_ENGINE=manual).",
                "details": {},
            },
        )

    # 2. Validate UUID
    try:
        uuid.UUID(submission_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "submission_id must be a valid UUID.",
                "details": {},
            },
        )

    # 3. Verify submission exists
    sub_res = (
        supabase_client.table("submission")
        .select("id, student_id, status")
        .eq("id", submission_id)
        .execute()
    )
    if not sub_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": "Submission not found.",
                "details": {},
            },
        )
    submission = sub_res.data[0]

    # 4. Verify student is on this teacher's roster
    roster_res = (
        supabase_client.table("teacher_student")
        .select("student_id")
        .eq("teacher_id", teacher_id)
        .eq("student_id", submission["student_id"])
        .execute()
    )
    if not roster_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": "Submission not found on your roster.",
                "details": {},
            },
        )

    # 5. Check submission status is completed
    if submission["status"] != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_SUBMISSION_STATUS",
                "message": "Cannot score an uncompleted submission.",
                "details": {"status": submission["status"]},
            },
        )

    # 6. Check if manual_score already exists (prevent duplicates)
    existing = (
        supabase_client.table("manual_score")
        .select("id")
        .eq("submission_id", submission_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "MANUAL_SCORE_ALREADY_EXISTS",
                "message": "A manual score has already been submitted for this worksheet.",
                "details": {"submission_id": submission_id},
            },
        )

    # 7. Insert manual_score record
    insert_payload = {
        "submission_id": submission_id,
        "letter_formation_band": body.letter_formation_band.value,
        "size_consistency_band": body.size_consistency_band.value,
        "spacing_band": body.spacing_band.value,
        "slant_band": body.slant_band.value,
        "baseline_alignment_band": body.baseline_alignment_band.value,
        "graded_by": teacher_id,
    }

    try:
        insert_res = supabase_client.table("manual_score").insert(insert_payload).execute()
    except Exception as exc:
        err_msg = str(exc)
        if "duplicate" in err_msg.lower() or "unique" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "MANUAL_SCORE_ALREADY_EXISTS",
                    "message": "A manual score has already been submitted for this worksheet.",
                    "details": {"submission_id": submission_id},
                },
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to save manual rubric score.",
                "details": {"error": err_msg},
            },
        )

    if not insert_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to save manual rubric score.",
                "details": {},
            },
        )

    row = insert_res.data[0]

    # 8. Return response matching API_SPEC §3.3
    return {
        "submission_id": submission_id,
        "manual_score": {
            "letter_formation_band": row["letter_formation_band"],
            "letter_formation_score": float(row["letter_formation_score"])
            if row.get("letter_formation_score") is not None
            else None,
            "size_consistency_band": row["size_consistency_band"],
            "size_consistency_score": float(row["size_consistency_score"])
            if row.get("size_consistency_score") is not None
            else None,
            "spacing_band": row["spacing_band"],
            "spacing_score": float(row["spacing_score"])
            if row.get("spacing_score") is not None
            else None,
            "slant_band": row["slant_band"],
            "slant_score": float(row["slant_score"])
            if row.get("slant_score") is not None
            else None,
            "baseline_alignment_band": row["baseline_alignment_band"],
            "baseline_alignment_score": float(row["baseline_alignment_score"])
            if row.get("baseline_alignment_score") is not None
            else None,
        },
        "graded_by": row["graded_by"],
        "created_at": row["created_at"],
    }
