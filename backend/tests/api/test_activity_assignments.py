import pytest

from app.api.deps import get_current_teacher, get_current_user
from app.core.supabase import supabase_client as admin
from app.main import app
from tests.conftest import TEST_TEACHER_ID


@pytest.fixture
def targets():
    section = (
        admin.table("section")
        .insert(
            {
                "teacher_id": TEST_TEACHER_ID,
                "name": "Assignment API fixture",
            }
        )
        .execute()
        .data[0]
    )
    student = (
        admin.table("student")
        .insert({"full_name": "Synthetic Target", "section": "Fixture"})
        .execute()
        .data[0]
    )
    admin.table("teacher_student").insert(
        {
            "teacher_id": TEST_TEACHER_ID,
            "student_id": student["id"],
        }
    ).execute()
    yield {"section": section["id"], "student": student["id"]}
    admin.table("student").delete().eq("id", student["id"]).execute()
    admin.table("section").delete().eq("id", section["id"]).execute()


def test_create_mixed_deduplicated_and_patch_nullable_omission(client, targets):
    target = {"section_id": targets["section"]}
    created = client.post(
        "/api/activities",
        json={
            "title": "Loops",
            "target_text": "one two three four five six",
            "instructions": "Copy carefully",
            "due_at": "2026-11-02T12:00:00+08:00",
            "assignments": [target, target, {"student_id": targets["student"]}],
        },
    )
    assert created.status_code == 201, created.text
    row = created.json()
    try:
        assert len(row["assignments"]) == 2
        patched = client.patch(
            f"/api/activities/{row['id']}", json={"instructions": None, "due_at": None}
        )
        assert patched.status_code == 200
        assert patched.json()["instructions"] is None and patched.json()["due_at"] is None
        assert patched.json()["assignments"] == row["assignments"]
        invalid = client.patch(
            f"/api/activities/{row['id']}", json={"assignments": [], "title": "Bad"}
        )
        assert invalid.status_code == 422
        assert invalid.json()["error"]["code"] == "INVALID_ASSIGNMENT_TARGET"
        assert (
            admin.table("activity")
            .select("title")
            .eq("id", row["id"])
            .single()
            .execute()
            .data["title"]
            == "Loops"
        )
    finally:
        admin.table("activity").delete().eq("id", row["id"]).execute()


def test_parent_cannot_create_assigned_activity(client, targets):
    app.dependency_overrides.pop(get_current_teacher)
    app.dependency_overrides[get_current_user] = lambda: {"sub": TEST_TEACHER_ID, "role": "parent"}
    response = client.post(
        "/api/activities",
        json={
            "title": "Forbidden",
            "target_text": "words",
            "assignments": [{"section_id": targets["section"]}],
        },
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
