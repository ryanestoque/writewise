import pytest

from app.core.supabase import supabase_client
from tests.conftest import TEST_TEACHER_ID


@pytest.fixture
def cleanup_activities():
    activity_ids = []
    yield activity_ids
    for aid in activity_ids:
        supabase_client.table("activity").delete().eq("id", aid).execute()


def test_create_activity(client, cleanup_activities):
    payload = {"target_text": "the quick brown fox", "is_take_home": False}
    response = client.post("/api/activities", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["target_text"] == "the quick brown fox"
    assert data["is_take_home"] is False
    assert data["created_by"] == TEST_TEACHER_ID
    assert "created_at" in data

    cleanup_activities.append(data["id"])

    # Verify in DB
    res = supabase_client.table("activity").select("*").eq("id", data["id"]).execute()
    assert len(res.data) == 1
    assert res.data[0]["target_text"] == "the quick brown fox"
    assert res.data[0]["created_by"] == TEST_TEACHER_ID


def test_create_take_home_activity(client, cleanup_activities):
    payload = {"target_text": "cursive letters a b c", "is_take_home": True}
    response = client.post("/api/activities", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["is_take_home"] is True
    assert data["target_text"] == "cursive letters a b c"

    cleanup_activities.append(data["id"])


def test_create_activity_defaults_not_take_home(client, cleanup_activities):
    payload = {"target_text": "hello world"}
    response = client.post("/api/activities", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["is_take_home"] is False

    cleanup_activities.append(data["id"])


def test_create_activity_empty_text_fails(client):
    payload = {"target_text": "   ", "is_take_home": False}
    response = client.post("/api/activities", json=payload)
    assert response.status_code == 422


def test_update_activity(client, cleanup_activities):
    # 1. Create
    payload = {"target_text": "original text", "is_take_home": False}
    create_res = client.post("/api/activities", json=payload)
    assert create_res.status_code == 201
    act_id = create_res.json()["id"]
    cleanup_activities.append(act_id)

    # 2. Update
    update_payload = {"target_text": "updated cursive sentence", "is_take_home": True}
    update_res = client.patch(f"/api/activities/{act_id}", json=update_payload)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["target_text"] == "updated cursive sentence"
    assert updated_data["is_take_home"] is True


def test_delete_activity(client):
    # 1. Create
    payload = {"target_text": "temp to delete", "is_take_home": False}
    create_res = client.post("/api/activities", json=payload)
    assert create_res.status_code == 201
    act_id = create_res.json()["id"]

    # 2. Delete
    del_res = client.delete(f"/api/activities/{act_id}")
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True

    # 3. Verify gone
    del_res2 = client.delete(f"/api/activities/{act_id}")
    assert del_res2.status_code == 404


def test_toggle_archive_activity(client, cleanup_activities):
    # 1. Create
    create_res = client.post(
        "/api/activities", json={"target_text": "archive me", "is_take_home": False}
    )
    assert create_res.status_code == 201
    act_id = create_res.json()["id"]
    cleanup_activities.append(act_id)

    # 2. Archive
    arch_res = client.patch(f"/api/activities/{act_id}/archive")
    assert arch_res.status_code == 200
    assert arch_res.json() == {"id": act_id, "is_archived": True}

    # 3. Verify in DB
    res = supabase_client.table("activity").select("is_archived").eq("id", act_id).execute()
    assert res.data[0]["is_archived"] is True

    # 4. Unarchive
    unarch_res = client.patch(f"/api/activities/{act_id}/archive")
    assert unarch_res.status_code == 200
    assert unarch_res.json() == {"id": act_id, "is_archived": False}

    res = supabase_client.table("activity").select("is_archived").eq("id", act_id).execute()
    assert res.data[0]["is_archived"] is False


def test_toggle_archive_activity_not_found(client):
    response = client.patch("/api/activities/99999999-9999-9999-9999-999999999999/archive")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_bulk_archive_activities(client, cleanup_activities):
    # 1. Create two activities
    ids = []
    for text in ["bulk one", "bulk two"]:
        create_res = client.post("/api/activities", json={"target_text": text})
        assert create_res.status_code == 201
        ids.append(create_res.json()["id"])
    cleanup_activities.extend(ids)

    # 2. Bulk archive
    bulk_res = client.post("/api/activities/bulk-archive", json={"ids": ids, "archived": True})
    assert bulk_res.status_code == 200
    body = bulk_res.json()
    assert sorted(body["updated"]) == sorted(ids)
    assert body["skipped"] == []

    # 3. Verify in DB
    res = supabase_client.table("activity").select("id, is_archived").in_("id", ids).execute()
    assert all(row["is_archived"] is True for row in res.data)

    # 4. Bulk unarchive
    restore_res = client.post("/api/activities/bulk-archive", json={"ids": ids, "archived": False})
    assert restore_res.status_code == 200
    assert sorted(restore_res.json()["updated"]) == sorted(ids)


def test_bulk_archive_skips_non_owned_ids(client, cleanup_activities):
    # 1. Create one owned activity
    create_res = client.post("/api/activities", json={"target_text": "owned activity"})
    assert create_res.status_code == 201
    owned_id = create_res.json()["id"]
    cleanup_activities.append(owned_id)

    # 2. Bulk archive with a non-existent (non-owned) id mixed in
    foreign_id = "99999999-9999-9999-9999-999999999999"
    bulk_res = client.post(
        "/api/activities/bulk-archive",
        json={"ids": [owned_id, foreign_id], "archived": True},
    )
    assert bulk_res.status_code == 200
    body = bulk_res.json()
    assert body["updated"] == [owned_id]
    assert body["skipped"] == [foreign_id]


def test_bulk_archive_empty_ids(client):
    response = client.post("/api/activities/bulk-archive", json={"ids": [], "archived": True})
    assert response.status_code == 200
    assert response.json() == {"updated": [], "skipped": []}
