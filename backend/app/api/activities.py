from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.activity_contracts import ActivityCreate, ActivityResponse, ActivityUpdate
from app.api.assignment_access import mutate_assigned_activity, validate_activity_write
from app.api.deps import get_current_teacher
from app.core.supabase import supabase_client

router = APIRouter()


class ActivityBulkArchiveRequest(BaseModel):
    ids: list[str]
    archived: bool


class ActivityBulkArchiveResponse(BaseModel):
    updated: list[str]
    skipped: list[str]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ActivityResponse)
def create_activity(
    activity_in: ActivityCreate,
    teacher: dict = Depends(get_current_teacher),
):
    teacher_id = teacher["sub"]
    payload = activity_in.model_dump(mode="json")
    validate_activity_write(teacher_id, payload)
    return mutate_assigned_activity(
        "create_assigned_activity",
        {
            "actor_id": teacher_id,
            "payload": payload,
        },
    )


@router.patch("/{activity_id}", response_model=ActivityResponse)
def update_activity(
    activity_id: str,
    activity_in: ActivityUpdate,
    teacher: dict = Depends(get_current_teacher),
):
    teacher_id = teacher["sub"]
    existing = (
        supabase_client.table("activity")
        .select("*")
        .eq("id", activity_id)
        .eq("created_by", teacher_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            404,
            detail={
                "code": "NOT_FOUND",
                "message": "Activity not found.",
                "details": {},
            },
        )
    payload = activity_in.model_dump(mode="json", exclude_unset=True)
    validate_activity_write(teacher_id, payload, existing.data[0])
    return mutate_assigned_activity(
        "update_assigned_activity",
        {
            "actor_id": teacher_id,
            "target_activity_id": activity_id,
            "payload": payload,
        },
    )


@router.patch("/{activity_id}/archive")
def toggle_archive_activity(
    activity_id: str,
    teacher: dict = Depends(get_current_teacher),
):
    teacher_id = teacher.get("sub")

    # Verify ownership
    existing_res = (
        supabase_client.table("activity")
        .select("id, is_archived")
        .eq("id", activity_id)
        .eq("created_by", teacher_id)
        .execute()
    )
    if not existing_res.data:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NOT_FOUND",
                "message": "Activity not found or you do not have permission to archive it",
                "details": {},
            },
        )

    current = existing_res.data[0]
    new_archived = not current["is_archived"]

    res = (
        supabase_client.table("activity")
        .update({"is_archived": new_archived})
        .eq("id", activity_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to toggle archive state",
                "details": {},
            },
        )

    return {"id": activity_id, "is_archived": new_archived}


@router.post("/bulk-archive")
def bulk_archive_activities(
    body: ActivityBulkArchiveRequest,
    teacher: dict = Depends(get_current_teacher),
):
    teacher_id = teacher.get("sub")

    if not body.ids:
        return ActivityBulkArchiveResponse(updated=[], skipped=[])

    # Fetch all activities the teacher owns from the provided IDs
    existing_res = (
        supabase_client.table("activity")
        .select("id")
        .in_("id", body.ids)
        .eq("created_by", teacher_id)
        .execute()
    )

    owned_ids = [row["id"] for row in (existing_res.data or [])]
    skipped_ids = [aid for aid in body.ids if aid not in owned_ids]

    if not owned_ids:
        return ActivityBulkArchiveResponse(updated=[], skipped=skipped_ids)

    res = (
        supabase_client.table("activity")
        .update({"is_archived": body.archived})
        .in_("id", owned_ids)
        .execute()
    )
    if res.data is None:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to bulk archive activities",
                "details": {},
            },
        )

    return ActivityBulkArchiveResponse(updated=owned_ids, skipped=skipped_ids)


@router.delete("/{activity_id}")
def delete_activity(
    activity_id: str,
    teacher: dict = Depends(get_current_teacher),
):
    teacher_id = teacher.get("sub")

    # 1. Verify ownership
    existing_res = (
        supabase_client.table("activity")
        .select("*")
        .eq("id", activity_id)
        .eq("created_by", teacher_id)
        .execute()
    )
    if not existing_res.data:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NOT_FOUND",
                "message": "Activity not found or you do not have permission to delete it",
                "details": {},
            },
        )

    # 2. Check if submissions exist for this activity
    sub_res = (
        supabase_client.table("submission").select("id").eq("activity_id", activity_id).execute()
    )
    if sub_res.data and len(sub_res.data) > 0:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "ACTIVITY_HAS_SUBMISSIONS",
                "message": "Cannot delete activity because it has existing student submissions.",
                "details": {"submission_count": len(sub_res.data)},
            },
        )

    # 3. Delete activity
    del_res = supabase_client.table("activity").delete().eq("id", activity_id).execute()
    if not del_res.data:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to delete activity",
                "details": {},
            },
        )

    return {
        "id": activity_id,
        "deleted": True,
    }
