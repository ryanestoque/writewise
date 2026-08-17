from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_teacher
from app.core.db import supabase

router = APIRouter(prefix="/api/students", tags=["students"])


class StudentCreate(BaseModel):
    full_name: str = Field(..., min_length=1)
    section: str = Field(..., min_length=1)
    parent_email: Optional[str] = None


class StudentUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1)
    section: Optional[str] = Field(None, min_length=1)
    parent_email: Optional[str] = None


@router.post("")
async def create_student(
    student_in: StudentCreate, current_teacher: Annotated[dict, Depends(get_current_teacher)]
):
    teacher_id = current_teacher["sub"]

    if student_in.parent_email:
        try:
            supabase.auth.admin.invite_user_by_email(student_in.parent_email)
        except Exception:
            pass  # Ignore invite errors per requirement or handle gracefully

    try:
        student_res = (
            supabase.table("student")
            .insert(
                {
                    "full_name": student_in.full_name,
                    "section": student_in.section,
                    "parent_email": student_in.parent_email,
                }
            )
            .execute()
        )

        if not student_res.data:
            raise Exception("Failed to insert student")

        student_id = student_res.data[0]["id"]

        supabase.table("teacher_student").insert(
            {"teacher_id": teacher_id, "student_id": student_id}
        ).execute()

        return student_res.data[0]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "bad_request", "message": str(e), "details": None}},
        )


@router.patch("/{student_id}")
async def update_student(
    student_id: str,
    student_in: StudentUpdate,
    current_teacher: Annotated[dict, Depends(get_current_teacher)],
):
    teacher_id = current_teacher["sub"]

    link_res = (
        supabase.table("teacher_student")
        .select("*")
        .eq("student_id", student_id)
        .eq("teacher_id", teacher_id)
        .execute()
    )
    if not link_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {"code": "not_found", "message": "Student not found", "details": None}
            },
        )

    update_data = student_in.model_dump(exclude_unset=True)
    if not update_data:
        # Nothing to update, return the existing student data
        student_res = supabase.table("student").select("*").eq("id", student_id).execute()
        return student_res.data[0] if student_res.data else None

    if "parent_email" in update_data and update_data["parent_email"]:
        try:
            supabase.auth.admin.invite_user_by_email(update_data["parent_email"])
        except Exception:
            pass

    try:
        res = supabase.table("student").update(update_data).eq("id", student_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "bad_request", "message": str(e), "details": None}},
        )


@router.delete("/{student_id}/teacher-link")
async def remove_teacher_student_link(
    student_id: str, current_teacher: Annotated[dict, Depends(get_current_teacher)]
):
    teacher_id = current_teacher["sub"]
    try:
        res = (
            supabase.table("teacher_student")
            .delete()
            .eq("teacher_id", teacher_id)
            .eq("student_id", student_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "not_found",
                        "message": "Link not found",
                        "details": None,
                    }
                },
            )
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "bad_request", "message": str(e), "details": None}},
        )
