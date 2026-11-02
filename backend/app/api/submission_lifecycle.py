"""Teacher lifecycle writes; Postgres rechecks authorization and commits atomically."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from app.api.deps import get_current_teacher
from app.api.submission_contracts import (
    ReleaseActivityResponse,
    ReleaseSubmissionResponse,
    ReturnSubmissionRequest,
    ReturnSubmissionResponse,
    StudentWorkResponse,
    StudentWorkUpdate,
)
from app.core.supabase import supabase_client

router = APIRouter()

_ERRORS = {
    "WW404": (404, "NOT_FOUND", "Work not found."),
    "WW409": (409, "SUBMISSION_NOT_RETURNABLE", "This attempt cannot be returned."),
    "WW410": (409, "SUBMISSION_NOT_RELEASABLE", "Only the active graded attempt can be released."),
    "WW422": (
        422,
        "INVALID_WORK_SELECTION",
        "Choose a completed attempt for this student and activity.",
    ),
}


def _error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status, detail={"code": code, "message": message, "details": {}})


def _not_found() -> HTTPException:
    return _error(404, "NOT_FOUND", "Work not found.")


def _owned_activity(actor_id: str, activity_id: str) -> dict:
    rows = (
        supabase_client.table("activity")
        .select("id,created_by")
        .eq("id", activity_id)
        .eq("created_by", actor_id)
        .execute()
        .data
    )
    if not rows or rows[0]["created_by"] != actor_id:
        raise _not_found()
    return rows[0]


def _owned_work(actor_id: str, activity_id: str, student_id: str, historical=False) -> None:
    _owned_activity(actor_id, activity_id)
    rows = (
        supabase_client.table("teacher_student")
        .select("student_id")
        .eq("teacher_id", actor_id)
        .eq("student_id", student_id)
        .execute()
        .data
    )
    if not rows:
        raise _not_found()
    if not historical:
        assigned = (
            supabase_client.rpc(
                "is_assigned",
                {
                    "target_activity_id": activity_id,
                    "target_student_id": student_id,
                },
            )
            .execute()
            .data
        )
        if not assigned:
            history = (
                supabase_client.table("submission")
                .select("id")
                .eq("activity_id", activity_id)
                .eq("student_id", student_id)
                .limit(1)
                .execute()
                .data
            )
            if not history:
                raise _not_found()


def _owned_submission(actor_id: str, submission_id: str) -> dict:
    rows = (
        supabase_client.table("submission")
        .select("id,activity_id,student_id")
        .eq("id", submission_id)
        .execute()
        .data
    )
    if not rows:
        raise _not_found()
    row = rows[0]
    _owned_work(actor_id, row["activity_id"], row["student_id"], historical=True)
    return row


def lifecycle_rpc(name: str, parameters: dict) -> dict:
    try:
        data = supabase_client.rpc(name, parameters).execute().data
    except APIError as exc:
        status, code, message = _ERRORS.get(
            exc.code,
            (
                500,
                "INTERNAL_ERROR",
                "Could not save the work. Please try again.",
            ),
        )
        raise _error(status, code, message) from exc
    if not isinstance(data, dict):
        raise _error(500, "INTERNAL_ERROR", "Could not save the work. Please try again.")
    return data


def _mutate(actor_id: str, row: dict, operation: str, payload: dict) -> dict:
    return lifecycle_rpc(
        "mutate_student_work",
        {
            "actor_id": actor_id,
            "target_activity_id": row["activity_id"],
            "target_student_id": row["student_id"],
            "operation": operation,
            "payload": payload,
        },
    )


@router.post("/submissions/{submission_id}/return", response_model=ReturnSubmissionResponse)
def return_submission(
    submission_id: UUID,
    body: ReturnSubmissionRequest,
    teacher: dict = Depends(get_current_teacher),
):
    actor = teacher["sub"]
    row = _owned_submission(actor, str(submission_id))
    payload = body.model_dump(mode="json", exclude_unset=True)
    return _mutate(actor, row, "return", {**payload, "submission_id": str(submission_id)})


@router.post("/submissions/{submission_id}/release", response_model=ReleaseSubmissionResponse)
def release_submission(submission_id: UUID, teacher: dict = Depends(get_current_teacher)):
    actor = teacher["sub"]
    row = _owned_submission(actor, str(submission_id))
    return _mutate(actor, row, "release", {"submission_id": str(submission_id)})


@router.post("/activities/{activity_id}/release", response_model=ReleaseActivityResponse)
def release_activity(activity_id: UUID, teacher: dict = Depends(get_current_teacher)):
    actor = teacher["sub"]
    _owned_activity(actor, str(activity_id))
    return lifecycle_rpc(
        "release_activity_results",
        {
            "actor_id": actor,
            "target_activity_id": str(activity_id),
        },
    )


@router.put(
    "/activities/{activity_id}/students/{student_id}/work", response_model=StudentWorkResponse
)
def update_student_work(
    activity_id: UUID,
    student_id: UUID,
    body: StudentWorkUpdate,
    teacher: dict = Depends(get_current_teacher),
):
    actor = teacher["sub"]
    _owned_work(actor, str(activity_id), str(student_id))
    return _mutate(
        actor,
        {
            "activity_id": str(activity_id),
            "student_id": str(student_id),
        },
        "update",
        body.model_dump(mode="json", exclude_unset=True),
    )
