"""Seed default test accounts in writewise-dev Supabase.

Creates:
- Teacher: teacher.santos@example.com / password123 (Ms. Santos)
- Parent: parent.seed@example.com / password123 (Seed Parent)
- Student: Juan Dela Cruz (Grade 3 - Sampaguita) linked to both.
"""

import os
import sys
from pathlib import Path

# Add backend directory to sys.path so app.core imports work
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from supabase import create_client  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.supabase import supabase_client  # noqa: E402

TEACHER_EMAIL = "teacher.santos@example.com"
TEACHER_PASSWORD = "password123"
TEACHER_NAME = "Ms. Santos"

PARENT_EMAIL = "parent.seed@example.com"
PARENT_PASSWORD = "password123"
PARENT_NAME = "Seed Parent"

STUDENT_ID = "22222222-2222-2222-2222-222222222222"
STUDENT_NAME = "Juan Dela Cruz"
STUDENT_SECTION = "Grade 3 - Sampaguita"


def get_existing_user(email: str):
    users = supabase_client.auth.admin.list_users()
    for u in users:
        if u.email and u.email.lower() == email.lower():
            return u
    return None


def main():
    print("--- Seeding WriteWise Dev Accounts ---")

    # 1. Teacher Account
    teacher_user = get_existing_user(TEACHER_EMAIL)
    if teacher_user:
        teacher_id = str(teacher_user.id)
        print(f"[OK] Teacher already exists in auth.users (ID: {teacher_id})")
        # Ensure password is set to password123
        supabase_client.auth.admin.update_user_by_id(
            teacher_id,
            {
                "password": TEACHER_PASSWORD,
                "user_metadata": {"role": "teacher", "full_name": TEACHER_NAME},
            },
        )
    else:
        print(f"[+] Creating teacher user {TEACHER_EMAIL}...")
        create_res = supabase_client.auth.admin.create_user({
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD,
            "email_confirm": True,
            "user_metadata": {
                "role": "teacher",
                "full_name": TEACHER_NAME,
            },
        })
        user_obj = getattr(create_res, "user", None) or create_res
        teacher_id = str(user_obj.id)
        print(f"[OK] Created teacher user in auth.users (ID: {teacher_id})")

    # Ensure teacher in public.teacher
    supabase_client.table("teacher").upsert({
        "id": teacher_id,
        "full_name": TEACHER_NAME,
        "email": TEACHER_EMAIL,
    }, on_conflict="id").execute()
    print("[OK] Verified teacher profile in public.teacher")

    # 2. Student Record (Must exist before parent so FK in trigger succeeds)
    print(f"[+] Upserting student record ({STUDENT_NAME})...")
    supabase_client.table("student").upsert({
        "id": STUDENT_ID,
        "full_name": STUDENT_NAME,
        "section": STUDENT_SECTION,
        "parent_email": PARENT_EMAIL,
        "parent_status": "active",
    }, on_conflict="id").execute()
    print("[OK] Verified student in public.student")

    # 3. Parent Account
    parent_user = get_existing_user(PARENT_EMAIL)
    if parent_user:
        parent_id = str(parent_user.id)
        print(f"[OK] Parent already exists in auth.users (ID: {parent_id})")
        supabase_client.auth.admin.update_user_by_id(
            parent_id,
            {
                "password": PARENT_PASSWORD,
                "user_metadata": {"role": "parent", "full_name": PARENT_NAME},
            },
        )
    else:
        print(f"[+] Creating parent user {PARENT_EMAIL}...")
        create_res = supabase_client.auth.admin.create_user({
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD,
            "email_confirm": True,
            "user_metadata": {
                "role": "parent",
                "full_name": PARENT_NAME,
                "student_id": STUDENT_ID,
            },
        })
        user_obj = getattr(create_res, "user", None) or create_res
        parent_id = str(user_obj.id)
        print(f"[OK] Created parent user in auth.users (ID: {parent_id})")

    # Ensure parent in public.parent
    supabase_client.table("parent").upsert({
        "id": parent_id,
        "full_name": PARENT_NAME,
        "email": PARENT_EMAIL,
    }, on_conflict="id").execute()
    print("[OK] Verified parent profile in public.parent")

    # 4. Roster links
    print("[+] Upserting teacher_student link...")
    supabase_client.table("teacher_student").upsert({
        "teacher_id": teacher_id,
        "student_id": STUDENT_ID,
    }, on_conflict="teacher_id,student_id").execute()
    print("[OK] Teacher-Student link verified")

    print("[+] Upserting student_parent link...")
    supabase_client.table("student_parent").upsert({
        "parent_id": parent_id,
        "student_id": STUDENT_ID,
    }, on_conflict="student_id,parent_id").execute()
    print("[OK] Student-Parent link verified")

    # 5. Verify Authentication with password123
    print("\n--- Verifying sign-in authentication ---")
    anon_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get(
        "SUPABASE_ANON_KEY"
    )
    if not anon_key:
        frontend_env = Path(__file__).resolve().parent.parent / "frontend" / ".env.local"
        if frontend_env.exists():
            for line in frontend_env.read_text().splitlines():
                if line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
                    anon_key = line.split("=", 1)[1].strip()
                    break

    if anon_key:
        anon_client = create_client(settings.SUPABASE_URL, anon_key)

        try:
            t_auth = anon_client.auth.sign_in_with_password({
                "email": TEACHER_EMAIL,
                "password": TEACHER_PASSWORD,
            })
            print(f"[OK] Teacher authentication successful! Logged in as: {t_auth.user.email}")
        except Exception as e:
            print(f"[ERROR] Teacher authentication failed: {e}")

        try:
            p_auth = anon_client.auth.sign_in_with_password({
                "email": PARENT_EMAIL,
                "password": PARENT_PASSWORD,
            })
            print(f"[OK] Parent authentication successful! Logged in as: {p_auth.user.email}")
        except Exception as e:
            print(f"[ERROR] Parent authentication failed: {e}")
    else:
        print("[!] Skipped sign-in test (no anon key found)")

    print("\n=== Seeding complete and verified successfully! ===")


if __name__ == "__main__":
    main()
