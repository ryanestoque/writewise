"""Real JWTs cross FastAPI authorization, SQL transactions and browser RLS."""

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.main import app


@pytest.fixture
def real_comment_api():
    assert get_current_user not in app.dependency_overrides
    with TestClient(app) as client:
        yield client


def authorization(client):
    return {"Authorization": "Bearer " + client.auth.get_session().access_token}


def comment_path(activity, student):
    return f"/api/activities/{activity}/students/{student}/comments"


def test_parent_post_is_shared_with_owner_and_other_linked_parent(
    real_comment_api, family, assigned_activity, second_parent
):
    path = comment_path(assigned_activity["id"], family["students"][0])
    response = real_comment_api.post(
        path,
        headers=authorization(family["parent_client"]),
        json={"body": "Synthetic shared comment"},
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["author_role"] == "parent" and "body" not in payload
    for client in (family["teacher_client"], second_parent["client"]):
        assert client.table("private_comment").select("body").eq(
            "id", payload["id"]
        ).execute().data == [{"body": "Synthetic shared comment"}]
    assert (
        family["other_parent_client"]
        .table("private_comment")
        .select("id")
        .eq("id", payload["id"])
        .execute()
        .data
        == []
    )


@pytest.mark.parametrize("identity", ["other_teacher_client", "other_parent_client"])
def test_foreign_jwt_cannot_post_to_a_child_work_pair(
    real_comment_api, family, assigned_activity, identity
):
    path = comment_path(assigned_activity["id"], family["students"][0])
    response = real_comment_api.post(
        path, headers=authorization(family[identity]), json={"body": "Synthetic unauthorized text"}
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_owner_lock_is_enforced_for_parent_and_author_can_delete_while_locked(
    real_comment_api, family, assigned_activity
):
    path = comment_path(assigned_activity["id"], family["students"][0])
    parent, owner = authorization(family["parent_client"]), authorization(family["teacher_client"])
    posted = real_comment_api.post(path, headers=parent, json={"body": "Synthetic author text"})
    assert posted.status_code == 201, posted.text
    denied_lock = real_comment_api.put(path + "/lock", headers=parent, json={"locked": True})
    assert denied_lock.status_code == 404
    assert (
        real_comment_api.put(path + "/lock", headers=owner, json={"locked": True}).status_code
        == 200
    )
    blocked = real_comment_api.post(path, headers=parent, json={"body": "Synthetic blocked post"})
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "COMMENTS_LOCKED"
    delete_path = "/api/comments/" + posted.json()["id"]
    assert real_comment_api.delete(delete_path, headers=owner).status_code == 404
    assert real_comment_api.delete(delete_path, headers=parent).status_code == 204
    assert real_comment_api.delete(delete_path, headers=parent).status_code == 204
    row = (
        family["teacher_client"]
        .table("private_comment")
        .select("body,deleted_at")
        .eq("id", posted.json()["id"])
        .single()
        .execute()
        .data
    )
    assert row["body"] is None and row["deleted_at"] is not None


def test_missing_authentication_cannot_reach_comment_writes(
    real_comment_api, family, assigned_activity
):
    response = real_comment_api.post(
        comment_path(assigned_activity["id"], family["students"][0]),
        json={"body": "Synthetic text"},
    )
    assert response.status_code == 401 and response.json()["error"]["code"] == "UNAUTHORIZED"
