from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

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