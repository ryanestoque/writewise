"""WriteWise — Seed Dev Teacher & Parent Accounts.

Idempotently creates (or updates) a login-ready teacher account, a login-ready
parent account, one class section, and two linked students in the configured
non-production Supabase project (typically `writewise-dev`).

Usage:
    cd backend && uv run python ../research/seed_dev_accounts.py
    cd backend && uv run python ../research/seed_dev_accounts.py --password "YourDevPassword123!"
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import TypedDict


class SeedResult(TypedDict):
    teacher_id: str
    teacher_created: bool
    parent_id: str
    parent_created: bool
    section_id: str
    student_ids: list[str]


repo_root = Path(__file__).resolve().parent.parent
backend_dir = repo_root / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

env_file = backend_dir / ".env"
if env_file.is_file():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("'\""))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_dev_accounts")

DEFAULT_TEACHER_EMAIL = "seed.teacher@writewise.dev"
DEFAULT_TEACHER_NAME = "Ms. Clara Santos"
DEFAULT_SCHOOL_NAME = "WriteWise Dev Elementary"

DEFAULT_PARENT_EMAIL = "seed.parent@writewise.dev"
DEFAULT_PARENT_NAME = "Mr. Marco Dela Cruz"

DEFAULT_PASSWORD = "WriteWiseDev2026!"
DEFAULT_SECTION_NAME = "Grade 3 - Sampaguita"
DEFAULT_STUDENTS = (
    "Juan Dela Cruz",
    "Maria Dela Cruz",
)


def _assert_non_production() -> None:
    env = os.environ.get("ENVIRONMENT", "").strip().lower()
    if env in {"prod", "production"}:
        raise RuntimeError("Refusing to run dev seed script when ENVIRONMENT is prod/production.")


def _find_auth_user_id_by_email(supabase_client, email: str) -> str | None:
    target = email.strip().lower()
    page = 1
    per_page = 200
    while True:
        users = supabase_client.auth.admin.list_users(page=page, per_page=per_page)
        if not users:
            return None
        for user in users:
            if (getattr(user, "email", None) or "").strip().lower() == target:
                return str(user.id)
        if len(users) < per_page:
            return None
        page += 1


def _ensure_auth_user(
    supabase_client,
    *,
    email: str,
    password: str,
    role: str,
    full_name: str,
    school_name: str | None = None,
) -> tuple[str, bool]:
    metadata: dict[str, str] = {"role": role, "full_name": full_name}
    if school_name:
        metadata["school_name"] = school_name

    existing_id = _find_auth_user_id_by_email(supabase_client, email)
    if existing_id:
        supabase_client.auth.admin.update_user_by_id(
            existing_id,
            {
                "password": password,
                "email_confirm": True,
                "user_metadata": metadata,
            },
        )
        logger.info("Updated existing %s auth account id=%s", role, existing_id)
        return existing_id, False

    created = supabase_client.auth.admin.create_user(
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": metadata,
        }
    )
    user_id = str(created.user.id)
    logger.info("Created %s auth account id=%s", role, user_id)
    return user_id, True


def _ensure_section(supabase_client, *, teacher_id: str, section_name: str) -> str:
    existing = (
        supabase_client.table("section")
        .select("id")
        .eq("teacher_id", teacher_id)
        .eq("name", section_name)
        .limit(1)
        .execute()
    )
    if existing.data:
        section_id = str(existing.data[0]["id"])
        logger.info("Reusing existing section id=%s", section_id)
        return section_id

    inserted = (
        supabase_client.table("section")
        .insert({"teacher_id": teacher_id, "name": section_name})
        .execute()
    )
    section_id = str(inserted.data[0]["id"])
    logger.info("Created section id=%s", section_id)
    return section_id


def _ensure_linked_students(
    supabase_client,
    *,
    teacher_id: str,
    parent_id: str,
    parent_email: str,
    section_id: str,
    section_name: str,
    student_names: tuple[str, ...],
) -> list[str]:
    roster_res = (
        supabase_client.table("teacher_student")
        .select("student_id")
        .eq("teacher_id", teacher_id)
        .execute()
    )
    existing_ids = [row["student_id"] for row in (roster_res.data or [])]

    existing_by_name: dict[str, str] = {}
    if existing_ids:
        students_res = (
            supabase_client.table("student")
            .select("id, full_name")
            .in_("id", existing_ids)
            .execute()
        )
        for row in students_res.data or []:
            existing_by_name[row["full_name"]] = str(row["id"])

    linked_ids: list[str] = []
    for student_name in student_names:
        student_id = existing_by_name.get(student_name)
        payload = {
            "full_name": student_name,
            "section": section_name,
            "section_id": section_id,
            "parent_email": parent_email,
            "parent_status": "active",
        }
        if student_id:
            supabase_client.table("student").update(payload).eq("id", student_id).execute()
            logger.info("Updated existing student id=%s", student_id)
        else:
            inserted = supabase_client.table("student").insert(payload).execute()
            student_id = str(inserted.data[0]["id"])
            supabase_client.table("teacher_student").upsert(
                {"teacher_id": teacher_id, "student_id": student_id},
                on_conflict="teacher_id,student_id",
            ).execute()
            logger.info("Created student id=%s and linked to teacher", student_id)

        supabase_client.table("student_parent").upsert(
            {"student_id": student_id, "parent_id": parent_id},
            on_conflict="student_id,parent_id",
        ).execute()
        linked_ids.append(student_id)

    return linked_ids


def seed_dev_accounts(
    *,
    teacher_email: str = DEFAULT_TEACHER_EMAIL,
    parent_email: str = DEFAULT_PARENT_EMAIL,
    password: str = DEFAULT_PASSWORD,
    section_name: str = DEFAULT_SECTION_NAME,
) -> SeedResult:
    _assert_non_production()
    from app.core.supabase import supabase_client

    teacher_id, teacher_created = _ensure_auth_user(
        supabase_client,
        email=teacher_email,
        password=password,
        role="teacher",
        full_name=DEFAULT_TEACHER_NAME,
        school_name=DEFAULT_SCHOOL_NAME,
    )
    parent_id, parent_created = _ensure_auth_user(
        supabase_client,
        email=parent_email,
        password=password,
        role="parent",
        full_name=DEFAULT_PARENT_NAME,
    )

    section_id = _ensure_section(
        supabase_client,
        teacher_id=teacher_id,
        section_name=section_name,
    )
    student_ids = _ensure_linked_students(
        supabase_client,
        teacher_id=teacher_id,
        parent_id=parent_id,
        parent_email=parent_email,
        section_id=section_id,
        section_name=section_name,
        student_names=DEFAULT_STUDENTS,
    )

    return {
        "teacher_id": teacher_id,
        "teacher_created": teacher_created,
        "parent_id": parent_id,
        "parent_created": parent_created,
        "section_id": section_id,
        "student_ids": student_ids,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Idempotently seed dev teacher/parent accounts, a section, and 2 linked students."
        )
    )
    parser.add_argument("--teacher-email", default=DEFAULT_TEACHER_EMAIL)
    parser.add_argument("--parent-email", default=DEFAULT_PARENT_EMAIL)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--section", default=DEFAULT_SECTION_NAME)
    args = parser.parse_args()

    result = seed_dev_accounts(
        teacher_email=args.teacher_email,
        parent_email=args.parent_email,
        password=args.password,
        section_name=args.section,
    )

    print("\nSeeded WriteWise dev accounts successfully:")
    print(f"  Teacher: {args.teacher_email} (id={result['teacher_id']})")
    print(f"  Parent:  {args.parent_email} (id={result['parent_id']})")
    print(f"  Password (both): {args.password}")
    print(f"  Section: {args.section} (id={result['section_id']})")
    print(f"  Students linked: {len(result['student_ids'])} ({', '.join(result['student_ids'])})")


if __name__ == "__main__":
    main()
