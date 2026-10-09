import uuid

import pytest

from app.core.supabase import supabase_client


@pytest.fixture
def cleanup_sections():
    section_ids = []
    yield section_ids
    for sid in section_ids:
        # Unlink students first if any
        supabase_client.table("student").update({"section_id": None}).eq(
            "section_id", sid
        ).execute()
        supabase_client.table("section").delete().eq("id", sid).execute()


def test_list_sections_empty_or_existing(client):
    response = client.get("/api/sections")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_create_section_success(client, cleanup_sections):
    name = f"TestSec_{uuid.uuid4().hex[:6]}"
    response = client.post("/api/sections", json={"name": name})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == name
    assert data["student_count"] == 0
    cleanup_sections.append(data["id"])


def test_create_duplicate_section_fails(client, cleanup_sections):
    name = f"TestSec_{uuid.uuid4().hex[:6]}"
    res1 = client.post("/api/sections", json={"name": name})
    assert res1.status_code == 200
    cleanup_sections.append(res1.json()["id"])

    res2 = client.post("/api/sections", json={"name": name})
    assert res2.status_code == 409
    body = res2.json()
    assert body["error"]["code"] == "SECTION_NAME_EXISTS"


def test_rename_section_syncs_students(client, cleanup_sections):
    old_name = f"OldSec_{uuid.uuid4().hex[:6]}"
    new_name = f"NewSec_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/sections", json={"name": old_name})
    sec_id = res.json()["id"]
    cleanup_sections.append(sec_id)

    # Create student in this section
    stu_res = client.post(
        "/api/students",
        json={"full_name": "Test Student Sec", "section": old_name, "section_id": sec_id},
    )
    stu_id = stu_res.json()["id"]

    try:
        # Rename section
        patch_res = client.patch(f"/api/sections/{sec_id}", json={"name": new_name})
        assert patch_res.status_code == 200
        assert patch_res.json()["name"] == new_name

        # Verify student.section was synced
        student_check = (
            supabase_client.table("student")
            .select("section")
            .eq("id", stu_id)
            .single()
            .execute()
        )
        assert student_check.data["section"] == new_name
    finally:
        supabase_client.table("student").delete().eq("id", stu_id).execute()


def test_delete_empty_section_success(client):
    name = f"EmptySec_{uuid.uuid4().hex[:6]}"
    create_res = client.post("/api/sections", json={"name": name})
    sec_id = create_res.json()["id"]

    del_res = client.delete(f"/api/sections/{sec_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True


def test_delete_section_with_students_blocked(client, cleanup_sections):
    name = f"ActiveSec_{uuid.uuid4().hex[:6]}"
    create_res = client.post("/api/sections", json={"name": name})
    sec_id = create_res.json()["id"]
    cleanup_sections.append(sec_id)

    # Assign student
    stu_res = client.post(
        "/api/students",
        json={"full_name": "Active Student", "section": name, "section_id": sec_id},
    )
    stu_id = stu_res.json()["id"]

    try:
        del_res = client.delete(f"/api/sections/{sec_id}")
        assert del_res.status_code == 409
        assert del_res.json()["error"]["code"] == "SECTION_NOT_EMPTY"
    finally:
        supabase_client.table("student").delete().eq("id", stu_id).execute()
