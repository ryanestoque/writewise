import uuid

import pytest

from app.core.supabase import supabase_client


@pytest.fixture
def test_user_cleanup():
    created_user_ids = []
    yield created_user_ids
    for uid in created_user_ids:
        # Delete related profile/link rows if any
        try:
            supabase_client.table("student_parent").delete().eq("parent_id", uid).execute()
        except Exception:
            pass
        try:
            supabase_client.table("parent").delete().eq("id", uid).execute()
        except Exception:
            pass
        try:
            supabase_client.table("teacher").delete().eq("id", uid).execute()
        except Exception:
            pass
        try:
            supabase_client.auth.admin.delete_user(uid)
        except Exception:
            pass


def test_student_id_stripped_on_user_creation(test_user_cleanup):
    """Verify student_id in raw_user_meta_data is stripped by trigger."""
    fake_student_id = str(uuid.uuid4())
    test_email = f"parent_exploit_{uuid.uuid4().hex[:8]}@example.com"

    user_res = supabase_client.auth.admin.create_user(
        {
            "email": test_email,
            "password": "ValidPassword123!",
            "email_confirm": True,
            "user_metadata": {
                "role": "parent",
                "full_name": "Test Parent Exploit",
                "student_id": fake_student_id,
            },
        }
    )
    user_id = str(user_res.user.id)
    test_user_cleanup.append(user_id)

    # 1. Fetch user metadata to verify student_id was stripped
    fetched_user = supabase_client.auth.admin.get_user_by_id(user_id)
    u = getattr(fetched_user, "user", None) or fetched_user
    meta = u.user_metadata or {}
    assert "student_id" not in meta, "student_id must be stripped from user_metadata"
    assert meta.get("role") == "parent"

    # 2. Verify no student_parent row was created
    sp_res = (
        supabase_client.table("student_parent")
        .select("*")
        .eq("parent_id", user_id)
        .execute()
    )
    assert len(sp_res.data) == 0, "No unauthorized student_parent link should exist"


def test_role_lock_prevents_escalation(test_user_cleanup):
    """Verify that a user assigned 'parent' cannot update their metadata role to 'teacher'."""
    test_email = f"parent_escalate_{uuid.uuid4().hex[:8]}@example.com"

    user_res = supabase_client.auth.admin.create_user(
        {
            "email": test_email,
            "password": "ValidPassword123!",
            "email_confirm": True,
            "user_metadata": {
                "role": "parent",
                "full_name": "Normal Parent",
            },
        }
    )
    user_id = str(user_res.user.id)
    test_user_cleanup.append(user_id)

    # Attempt to update role to teacher via user_metadata
    supabase_client.auth.admin.update_user_by_id(
        user_id,
        {
            "user_metadata": {
                "role": "teacher",
                "full_name": "Normal Parent Modified",
            },
        },
    )

    # Verify role remains parent
    fetched_user = supabase_client.auth.admin.get_user_by_id(user_id)
    u = getattr(fetched_user, "user", None) or fetched_user
    meta = u.user_metadata or {}
    assert meta.get("role") == "parent", "Role must remain locked to parent"

    # Verify user does not exist in teacher table
    teacher_res = (
        supabase_client.table("teacher")
        .select("id")
        .eq("id", user_id)
        .execute()
    )
    assert len(teacher_res.data) == 0, "Escalated teacher record must not exist"


def test_invalid_role_defaults_to_teacher(test_user_cleanup):
    """Verify that an unauthorized role (e.g. 'admin') defaults to 'teacher'."""
    test_email = f"admin_attempt_{uuid.uuid4().hex[:8]}@example.com"

    user_res = supabase_client.auth.admin.create_user(
        {
            "email": test_email,
            "password": "ValidPassword123!",
            "email_confirm": True,
            "user_metadata": {
                "role": "superuser",
                "full_name": "Attempted Admin",
            },
        }
    )
    user_id = str(user_res.user.id)
    test_user_cleanup.append(user_id)

    fetched_user = supabase_client.auth.admin.get_user_by_id(user_id)
    u = getattr(fetched_user, "user", None) or fetched_user
    meta = u.user_metadata or {}
    assert meta.get("role") == "teacher", "Unauthorized role must coerce to teacher"
