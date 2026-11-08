"""Assignment authorization shared by activity writes and submission uploads."""

from datetime import datetime

from fastapi import HTTPException
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client
from app.gradebook.errors import GRADE_ERRORS


def invalid_targets() -> HTTPException:
    return HTTPException(
        422,
        detail={
            "code": "INVALID_ASSIGNMENT_TARGET",
            "message": "Choose at least one section or student from your roster.",
            "details": {},
        },
    )


def validate_activity_write(actor_id: str, payload: dict, existing: dict | None = None) -> None:
    if "assignments" in payload:
        targets = payload["assignments"]
        if not targets:
            raise invalid_targets()
        section_ids = {t["section_id"] for t in targets if t.get("section_id")}
        student_ids = {t["student_id"] for t in targets if t.get("student_id")}
        if section_ids:
            rows = (
                supabase_client.table("section")
                .select("id")
                .eq("teacher_id", actor_id)
                .in_("id", sorted(section_ids))
                .execute()
                .data
                or []
            )
            if {row["id"] for row in rows} != section_ids:
                raise invalid_targets()
        if student_ids:
            rows = (
                supabase_client.table("teacher_student")
                .select("student_id")
                .eq("teacher_id", actor_id)
                .in_("student_id", sorted(student_ids))
                .execute()
                .data
                or []
            )
            if {row["student_id"] for row in rows} != student_ids:
                raise invalid_targets()
    resulting = {**(existing or {}), **payload}
    if resulting.get("close_after_due") and not resulting.get("due_at"):
        raise HTTPException(
            422,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Set a due date before closing submissions.",
                "details": {},
            },
        )


def mutate_assigned_activity(name: str, params: dict) -> dict:
    try:
        result = supabase_client.rpc(name, params).execute()
    except APIError as exc:
        if exc.code in GRADE_ERRORS:
            status, code, message = GRADE_ERRORS[exc.code]
            raise HTTPException(
                status, detail={"code": code, "message": message, "details": {}}
            ) from exc
        if exc.code == "22023":
            raise invalid_targets() from exc
        if exc.code == "P0002":
            raise HTTPException(
                404,
                detail={
                    "code": "NOT_FOUND",
                    "message": "Activity not found.",
                    "details": {},
                },
            ) from exc
        raise HTTPException(
            500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Could not save the activity.",
                "details": {},
            },
        ) from exc
    if not result.data:
        raise HTTPException(
            500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Could not save the activity.",
                "details": {},
            },
        )
    return result.data


def is_assigned(activity_id: str, student_id: str) -> bool:
    result = supabase_client.rpc(
        "is_assigned",
        {
            "target_activity_id": activity_id,
            "target_student_id": student_id,
        },
    ).execute()
    return result.data is True


def assert_upload_allowed(activity: dict, student_id: str, caller_role: str, now: datetime) -> None:
    # Caller must establish existing ownership/family/mode authorization first.
    if not is_assigned(activity["id"], student_id):
        raise HTTPException(
            404,
            detail={
                "code": "ACTIVITY_NOT_ASSIGNED",
                "message": "Activity is not assigned to this student.",
                "details": {},
            },
        )
    work = (
        supabase_client.table("student_work")
        .select("due_at_override")
        .eq("activity_id", activity["id"])
        .eq("student_id", student_id)
        .limit(1)
        .execute()
        .data
    )
    effective_due = (work[0].get("due_at_override") if work else None) or activity.get("due_at")
    due_at = datetime.fromisoformat(effective_due) if effective_due else None
    if caller_role == "parent" and activity.get("close_after_due") and due_at and now > due_at:
        raise HTTPException(
            409,
            detail={
                "code": "SUBMISSIONS_CLOSED",
                "message": "Submissions are closed for this activity.",
                "details": {},
            },
        )
