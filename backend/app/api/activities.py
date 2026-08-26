from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, field_validator

from app.api.deps import get_current_teacher
from app.core.supabase import supabase_client

router = APIRouter()


class ActivityCreate(BaseModel):
    target_text: str
    is_take_home: bool = False

    @field_validator("target_text")
    @classmethod
    def target_text_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Target text must not be blank")
        return v


class ActivityUpdate(BaseModel):
    target_text: Optional[str] = None
    is_take_home: Optional[bool] = None

    model_config = ConfigDict(extra="ignore")

    @field_validator("target_text")
    @classmethod
    def target_text_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Target text must not be blank")
        return v


class ActivityBulkArchiveRequest(BaseModel):
    ids: list[str]
    archived: bool


class ActivityBulkArchiveResponse(BaseModel):
    updated: list[str]
    skipped: list[str]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_activity(
    activity_in: ActivityCreate,
    teacher: dict = Depends(get_current_teacher),
):
    teacher_id = teacher.get("sub")

    res = (
        supabase_client.table("activity")
        .insert(
            {
                "target_text": activity_in.target_text,
                "is_take_home": activity_in.is_take_home,
                "created_by": teacher_id,
            }
        )
        .execute()
    )

    if not res.data:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to create activity",
                "details": {},
            },
        )

    activity = res.data[0]

    return {
        "id": activity["id"],
        "target_text": activity["target_text"],
        "is_take_home": activity["is_take_home"],
        "created_by": activity["created_by"],
        "created_at": activity["created_at"],
    }


@router.patch("/{activity_id}")
def update_activity(
    activity_id: str,
    activity_in: ActivityUpdate,
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
                "message": "Activity not found or you do not have permission to edit it",
                "details": {},
            },
        )

    # 2. Update fields
    update_data = {}
    if activity_in.target_text is not None:
        update_data["target_text"] = activity_in.target_text
    if activity_in.is_take_home is not None:
        update_data["is_take_home"] = activity_in.is_take_home

    if update_data:
        res = supabase_client.table("activity").update(update_data).eq("id", activity_id).execute()
        if not res.data:
            raise HTTPException(
                status_code=500,
                detail={
                    "code": "INTERNAL_ERROR",
                    "message": "Failed to update activity",
                    "details": {},
                },
            )
        activity = res.data[0]
    else:
        activity = existing_res.data[0]

    return {
        "id": activity["id"],
        "target_text": activity["target_text"],
        "is_take_home": activity["is_take_home"],
        "created_by": activity["created_by"],
        "created_at": activity["created_at"],
    }


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
