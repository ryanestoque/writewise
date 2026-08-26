import pytest

from app.core.supabase import supabase_client
from tests.conftest import TEST_TEACHER_ID


# To clean up students created during the test
@pytest.fixture
def cleanup_students():
    student_ids = []
    yield student_ids
    for sid in student_ids:
        # Delete student, which cascades to teacher_student
        supabase_client.table("student").delete().eq("id", sid).execute()


def test_create_student(client, cleanup_students):
    payload = {"full_name": "Test Student Python", "section": "Grade 3 - Test"}
    response = client.post("/api/students", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["full_name"] == payload["full_name"]
    assert data["section"] == payload["section"]
    assert data["parent_email"] is None
    assert data["parent_invited"] is False

    # Store ID for cleanup
    student_id = data["id"]
    cleanup_students.append(student_id)

    # Verify the link exists
    res = (
        supabase_client.table("teacher_student")
        .select("*")
        .eq("student_id", student_id)
        .eq("teacher_id", TEST_TEACHER_ID)
        .execute()
    )
    assert len(res.data) == 1


def test_create_student_with_parent_email(client, cleanup_students):
    payload = {
        "full_name": "Test Student With Parent",
        "section": "Grade 3 - Parent",
        "parent_email": "parent_test_student@example.com",
    }
    response = client.post("/api/students", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["full_name"] == payload["full_name"]
    assert data["section"] == payload["section"]
    assert data["parent_email"] == "parent_test_student@example.com"

    student_id = data["id"]
    cleanup_students.append(student_id)

    # Verify directly in DB
    res = supabase_client.table("student").select("parent_email").eq("id", student_id).execute()
    assert len(res.data) == 1
    assert res.data[0]["parent_email"] == "parent_test_student@example.com"


def test_update_student(client, cleanup_students):
    # 1. Create a student to update
    payload = {"full_name": "To Be Updated", "section": "Grade 3 - A"}
    create_res = client.post("/api/students", json=payload)
    student_id = create_res.json()["id"]
    cleanup_students.append(student_id)

    # 2. Update it
    update_payload = {"full_name": "Updated Name", "section": "Grade 3 - B"}
    response = client.patch(f"/api/students/{student_id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Name"
    assert data["section"] == "Grade 3 - B"
    assert data["parent_email"] is None


def test_update_student_parent_email(client, cleanup_students):
    # 1. Create a student
    payload = {"full_name": "Student Parent Edit", "section": "Grade 3 - C"}
    create_res = client.post("/api/students", json=payload)
    student_id = create_res.json()["id"]
    cleanup_students.append(student_id)

    # 2. Add parent email
    update_payload = {"parent_email": "updated_parent@example.com"}
    response = client.patch(f"/api/students/{student_id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["parent_email"] == "updated_parent@example.com"

    # 3. Clear parent email by passing empty string
    clear_payload = {"parent_email": ""}
    response2 = client.patch(f"/api/students/{student_id}", json=clear_payload)
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["parent_email"] is None

    # Verify directly in DB
    res = supabase_client.table("student").select("parent_email").eq("id", student_id).execute()
    assert len(res.data) == 1
    assert res.data[0]["parent_email"] is None


def test_update_student_not_found(client):
    # Try updating a non-existent student or one not on the roster
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = client.patch(f"/api/students/{fake_id}", json={"full_name": "Should Fail"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_remove_student_link(client, cleanup_students):
    # 1. Create a student
    create_res = client.post(
        "/api/students", json={"full_name": "To Be Removed", "section": "Grade 3 - C"}
    )
    student_id = create_res.json()["id"]
    cleanup_students.append(student_id)

    # 2. Delete the link
    response = client.delete(f"/api/students/{student_id}/teacher-link")
    assert response.status_code == 200

    # 3. Verify link is gone
    res = (
        supabase_client.table("teacher_student")
        .select("*")
        .eq("student_id", student_id)
        .eq("teacher_id", TEST_TEACHER_ID)
        .execute()
    )
    assert len(res.data) == 0

    # 4. Try deleting it again -> should be 404
    response2 = client.delete(f"/api/students/{student_id}/teacher-link")
    assert response2.status_code == 404
