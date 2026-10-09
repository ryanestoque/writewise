from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_teacher
from app.core.supabase import supabase_client

router = APIRouter()


class SectionCreate(BaseModel):
    name: str = Field(..., min_length=1)


class SectionUpdate(BaseModel):
    name: str = Field(..., min_length=1)


class SectionResponse(BaseModel):
    id: str
    name: str
    student_count: int
    created_at: str
    updated_at: str


@router.get("", response_model=List[SectionResponse])
def list_sections(teacher: dict = Depends(get_current_teacher)):
    teacher_id = teacher.get("sub")

    # 1. Fetch teacher sections
    sec_res = (
        supabase_client.table("section")
        .select("*")
        .eq("teacher_id", teacher_id)
        .order("name")
        .execute()
    )
    sections = sec_res.data or []

    # 2. Fetch student counts for this teacher's roster
    ts_res = (
        supabase_client.table("teacher_student")
        .select("student:student_id(id, section_id)")
        .eq("teacher_id", teacher_id)
        .execute()
    )

    counts: dict[str, int] = {}
    for row in ts_res.data or []:
        stu = row.get("student")
        if stu and isinstance(stu, dict) and stu.get("section_id"):
            sid = stu["section_id"]
            counts[sid] = counts.get(sid, 0) + 1

    return [
        SectionResponse(
            id=s["id"],
            name=s["name"],
            student_count=counts.get(s["id"], 0),
            created_at=s["created_at"],
            updated_at=s["updated_at"],
        )
        for s in sections
    ]


@router.post("", response_model=SectionResponse)
def create_section(
    section_in: SectionCreate, teacher: dict = Depends(get_current_teacher)
):
    teacher_id = teacher.get("sub")
    trimmed_name = section_in.name.strip()
    if not trimmed_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Section name cannot be empty",
                "details": {},
            },
        )

    # Check uniqueness for teacher
    existing = (
        supabase_client.table("section")
        .select("id")
        .eq("teacher_id", teacher_id)
        .ilike("name", trimmed_name)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "SECTION_NAME_EXISTS",
                "message": "A section with this name already exists.",
                "details": {"name": trimmed_name},
            },
        )

    res = (
        supabase_client.table("section")
        .insert({"teacher_id": teacher_id, "name": trimmed_name})
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to create section",
                "details": {},
            },
        )

    row = res.data[0]
    return SectionResponse(
        id=row["id"],
        name=row["name"],
        student_count=0,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.patch("/{section_id}", response_model=SectionResponse)
def update_section(
    section_id: str,
    section_in: SectionUpdate,
    teacher: dict = Depends(get_current_teacher),
):
    teacher_id = teacher.get("sub")
    trimmed_name = section_in.name.strip()
    if not trimmed_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Section name cannot be empty",
                "details": {},
            },
        )

    # Verify ownership
    existing = (
        supabase_client.table("section")
        .select("*")
        .eq("id", section_id)
        .eq("teacher_id", teacher_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": "Section not found",
                "details": {},
            },
        )

    # Check collision
    collision = (
        supabase_client.table("section")
        .select("id")
        .eq("teacher_id", teacher_id)
        .neq("id", section_id)
        .ilike("name", trimmed_name)
        .execute()
    )
    if collision.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "SECTION_NAME_EXISTS",
                "message": "Another section with this name already exists.",
                "details": {"name": trimmed_name},
            },
        )

    # Update section
    res = (
        supabase_client.table("section")
        .update({"name": trimmed_name})
        .eq("id", section_id)
        .execute()
    )
    updated = res.data[0]

    # Denormalization sync: update all students referencing this section_id
    supabase_client.table("student").update({"section": trimmed_name}).eq(
        "section_id", section_id
    ).execute()

    # Count students
    c_res = (
        supabase_client.table("student")
        .select("id", count="exact")
        .eq("section_id", section_id)
        .execute()
    )
    count = c_res.count if c_res.count is not None else len(c_res.data or [])

    return SectionResponse(
        id=updated["id"],
        name=updated["name"],
        student_count=count,
        created_at=updated["created_at"],
        updated_at=updated["updated_at"],
    )


@router.delete("/{section_id}")
def delete_section(section_id: str, teacher: dict = Depends(get_current_teacher)):
    teacher_id = teacher.get("sub")

    # Verify ownership
    existing = (
        supabase_client.table("section")
        .select("id")
        .eq("id", section_id)
        .eq("teacher_id", teacher_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": "Section not found",
                "details": {},
            },
        )

    # Check if students are linked
    c_res = (
        supabase_client.table("student")
        .select("id", count="exact")
        .eq("section_id", section_id)
        .execute()
    )
    count = c_res.count if c_res.count is not None else len(c_res.data or [])
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "SECTION_NOT_EMPTY",
                "message": (
                    "Cannot delete section with assigned students. "
                    "Please reassign or unenroll students first."
                ),
                "details": {"student_count": count},
            },
        )

    supabase_client.table("section").delete().eq("id", section_id).execute()
    return {"success": True, "deleted_id": section_id}
