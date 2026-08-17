from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from app.api.deps import get_current_teacher
from app.core.supabase import supabase_client

router = APIRouter()


class StudentCreate(BaseModel):
    full_name: str
    section: str
    parent_email: Optional[str] = None


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    section: Optional[str] = None
    parent_email: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


def _invite_parent(email: str, student_id: str, student_name: str):
    try:
        supabase_client.auth.admin.invite_user_by_email(
            email=email,
            options={
                "data": {
                    "role": "parent",
                    "full_name": f"{student_name}'s Parent",  # default name or derived
                    "student_id": student_id,
                }
            },
        )
        return True, None
    except Exception as e:
        return False, str(e)


@router.post("")
def create_student(student_in: StudentCreate, teacher: dict = Depends(get_current_teacher)):
    teacher_id = teacher.get("sub")

    # 1. Insert student
    insert_data = {
        "full_name": student_in.full_name,
        "section": student_in.section,
    }
    if student_in.parent_email and student_in.parent_email.strip():
        insert_data["parent_email"] = student_in.parent_email.strip()

    res = (
        supabase_client.table("student")
        .insert(insert_data)
        .execute()
    )

    if not res.data:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": "Failed to create student", "details": {}},
        )

    student = res.data[0]
    student_id = student["id"]

    # 2. Insert teacher_student link
    supabase_client.table("teacher_student").insert(
        {"teacher_id": teacher_id, "student_id": student_id}
    ).execute()

    # 3. Optional parent invite
    parent_invited = False
    parent_invite_error = None
    if student_in.parent_email and student_in.parent_email.strip():
        parent_invited, parent_invite_error = _invite_parent(
            email=student_in.parent_email.strip(),
            student_id=student_id,
            student_name=student_in.full_name,
        )

    return {
        "id": student_id,
        "full_name": student["full_name"],
        "section": student["section"],
        "parent_email": student.get("parent_email"),
        "parent_invited": parent_invited,
        "parent_invite_error": parent_invite_error,
        "created_at": student["created_at"],
    }


@router.patch("/{student_id}")
def update_student(
    student_id: str, student_in: StudentUpdate, teacher: dict = Depends(get_current_teacher)
):
    teacher_id = teacher.get("sub")

    # 1. Verify ownership
    link_res = (
        supabase_client.table("teacher_student")
        .select("*")
        .eq("teacher_id", teacher_id)
        .eq("student_id", student_id)
        .execute()
    )
    if not link_res.data:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NOT_FOUND",
                "message": "Student not found on your roster",
                "details": {},
            },
        )

    # 2. Update student fields if provided
    update_data = {}
    if student_in.full_name is not None:
        update_data["full_name"] = student_in.full_name
    if student_in.section is not None:
        update_data["section"] = student_in.section
    if student_in.parent_email is not None:
        cleaned_email = student_in.parent_email.strip()
        update_data["parent_email"] = cleaned_email if cleaned_email else None

    student = None
    if update_data:
        res = supabase_client.table("student").update(update_data).eq("id", student_id).execute()
        if res.data:
            student = res.data[0]

    if student is None:
        # fetch the student to return
        res = supabase_client.table("student").select("*").eq("id", student_id).execute()
        student = res.data[0]

    # 3. Optional parent invite
    parent_invited = False
    parent_invite_error = None
    if student_in.parent_email and student_in.parent_email.strip():
        parent_invited, parent_invite_error = _invite_parent(
            email=student_in.parent_email.strip(),
            student_id=student_id,
            student_name=student["full_name"],
        )

    return {
        "id": student_id,
        "full_name": student["full_name"],
        "section": student["section"],
        "parent_email": student.get("parent_email"),
        "parent_invited": parent_invited,
        "parent_invite_error": parent_invite_error,
        "created_at": student["created_at"],
    }


@router.delete("/{student_id}/teacher-link")
def remove_student_link(student_id: str, teacher: dict = Depends(get_current_teacher)):
    teacher_id = teacher.get("sub")

    res = (
        supabase_client.table("teacher_student")
        .delete()
        .eq("teacher_id", teacher_id)
        .eq("student_id", student_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NOT_FOUND",
                "message": "Student not found on your roster",
                "details": {},
            },
        )

    return {"student_id": student_id, "teacher_id": teacher_id, "unenrolled": True}
