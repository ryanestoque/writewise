from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from app.api.deps import get_current_teacher
from app.core.config import settings
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
    frontend_origin = settings.CORS_ALLOWED_ORIGINS.split(",")[0].strip()
    redirect_url = f"{frontend_origin}/auth/callback"

    try:
        user_res = supabase_client.auth.admin.invite_user_by_email(
            email=email,
            options={
                "redirect_to": redirect_url,
                "data": {
                    "role": "parent",
                    "full_name": f"{student_name}'s Parent",
                    "student_id": student_id,
                },
            },
        )
        u = getattr(user_res, "user", None) or user_res
        parent_id = str(u.id) if getattr(u, "id", None) else None
        if parent_id:
            supabase_client.table("parent").upsert(
                {
                    "id": parent_id,
                    "full_name": (getattr(u, "user_metadata", None) or {}).get("full_name")
                    or f"{student_name}'s Parent",
                    "email": email,
                }
            ).execute()
            supabase_client.table("student_parent").upsert(
                {"student_id": student_id, "parent_id": parent_id},
                on_conflict="student_id,parent_id",
            ).execute()
            is_confirmed = bool(
                getattr(u, "confirmed_at", None) or getattr(u, "email_confirmed_at", None)
            )
            status = "active" if is_confirmed else "pending"
            supabase_client.table("student").update({"parent_status": status}).eq(
                "id", student_id
            ).execute()
        return True, None
    except Exception as e:
        error_msg = str(e)
        # Sibling / Existing parent handling: If user already exists in auth
        if "already been registered" in error_msg or "already exists" in error_msg.lower():
            parent_id = None
            parent_res = supabase_client.table("parent").select("id").eq("email", email).execute()
            if parent_res.data:
                parent_id = parent_res.data[0]["id"]
            else:
                users = supabase_client.auth.admin.list_users()
                for u in users:
                    if u.email and u.email.lower() == email.lower():
                        parent_id = str(u.id)
                        supabase_client.table("parent").upsert(
                            {
                                "id": parent_id,
                                "full_name": (u.user_metadata or {}).get("full_name")
                                or f"{student_name}'s Parent",
                                "email": email,
                            }
                        ).execute()
                        break

            if parent_id:
                # Link student to parent
                supabase_client.table("student_parent").upsert(
                    {"student_id": student_id, "parent_id": parent_id},
                    on_conflict="student_id,parent_id",
                ).execute()

                # Determine confirmation status
                is_confirmed = False
                try:
                    user_obj = supabase_client.auth.admin.get_user_by_id(parent_id)
                    u = getattr(user_obj, "user", None) or user_obj
                    is_confirmed = bool(
                        getattr(u, "confirmed_at", None) or getattr(u, "email_confirmed_at", None)
                    )
                except Exception:
                    pass

                status = "active" if is_confirmed else "pending"
                supabase_client.table("student").update({"parent_status": status}).eq(
                    "id", student_id
                ).execute()
                return True, None

        if "rate limit" in error_msg.lower():
            return (
                False,
                "Email rate limit exceeded. Please wait a few minutes before resending, "
                "or configure Custom SMTP in Supabase.",
            )

        return False, error_msg


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
        insert_data["parent_status"] = "pending"

    res = supabase_client.table("student").insert(insert_data).execute()

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

    # Re-fetch student to get up-to-date parent_status
    refreshed = supabase_client.table("student").select("*").eq("id", student_id).execute()
    if refreshed.data:
        student = refreshed.data[0]

    return {
        "id": student_id,
        "full_name": student["full_name"],
        "section": student["section"],
        "parent_email": student.get("parent_email"),
        "parent_status": student.get("parent_status"),
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
        if not cleaned_email:
            update_data["parent_status"] = None
        else:
            update_data["parent_status"] = "pending"

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

    # Re-fetch student to get up-to-date parent_status
    refreshed = supabase_client.table("student").select("*").eq("id", student_id).execute()
    if refreshed.data:
        student = refreshed.data[0]

    return {
        "id": student_id,
        "full_name": student["full_name"],
        "section": student["section"],
        "parent_email": student.get("parent_email"),
        "parent_status": student.get("parent_status"),
        "parent_invited": parent_invited,
        "parent_invite_error": parent_invite_error,
        "created_at": student["created_at"],
    }


@router.post("/{student_id}/resend-invite")
def resend_parent_invite(student_id: str, teacher: dict = Depends(get_current_teacher)):
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

    # 2. Verify student has parent email
    student_res = (
        supabase_client.table("student")
        .select("id, full_name, parent_email, parent_status")
        .eq("id", student_id)
        .execute()
    )
    if not student_res.data:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "NOT_FOUND",
                "message": "Student not found",
                "details": {},
            },
        )

    student = student_res.data[0]
    email = student.get("parent_email")
    if not email or not email.strip():
        raise HTTPException(
            status_code=400,
            detail={
                "code": "BAD_REQUEST",
                "message": "Student does not have a parent email linked",
                "details": {},
            },
        )

    # 3. Trigger invite
    parent_invited, parent_invite_error = _invite_parent(
        email=email.strip(),
        student_id=student_id,
        student_name=student["full_name"],
    )

    if not parent_invited:
        if "rate limit" in (parent_invite_error or "").lower():
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": parent_invite_error,
                    "details": {},
                },
            )
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVITE_FAILED",
                "message": parent_invite_error or "Failed to send parent invite",
                "details": {},
            },
        )

    # Refresh student
    refreshed = (
        supabase_client.table("student").select("id, parent_status").eq("id", student_id).execute()
    )
    current_status = (
        (refreshed.data[0].get("parent_status") if refreshed.data else None) or "pending"
    )

    return {
        "success": True,
        "student_id": student_id,
        "parent_email": email,
        "parent_status": current_status,
        "message": "Parent invitation sent successfully",
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
