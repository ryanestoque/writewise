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
    res = (
        supabase_client.table("activity")
        .select("*")
        .eq("id", data["id"])
        .execute()
    )
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