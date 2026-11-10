"""Real JWTs cross FastAPI authorization, SQL transactions and browser RLS."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.supabase import supabase_client as admin
from app.main import app
from tests.rls.notification_support import db_value


@pytest.fixture
def real_comment_api():
    assert get_current_user not in app.dependency_overrides
    with TestClient(app) as client:
        yield client


def authorization(client):
    return {"Authorization": "Bearer " + client.auth.get_session().access_token}


def comment_path(submission_id):
    return f"/api/submissions/{submission_id}/comments"


def test_parent_post_is_shared_with_owner_and_other_linked_parent(
    real_comment_api, family, assigned_activity, second_parent, comment_submission
):
    path = comment_path(comment_submission["id"])
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
    real_comment_api, family, assigned_activity, identity, comment_submission
):
    path = comment_path(comment_submission["id"])
    response = real_comment_api.post(
        path, headers=authorization(family[identity]), json={"body": "Synthetic unauthorized text"}
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_owner_lock_is_enforced_for_parent_and_author_can_delete_while_locked(
    real_comment_api, family, assigned_activity, comment_submission
):
    path = comment_path(comment_submission["id"])
    parent, owner = (
        authorization(family["parent_client"]),
        authorization(family["teacher_client"]),
    )
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
    real_comment_api, family, assigned_activity, comment_submission
):
    response = real_comment_api.post(
        comment_path(comment_submission["id"]), json={"body": "Synthetic text"}
    )
    assert response.status_code == 401 and response.json()["error"]["code"] == "UNAUTHORIZED"


def test_private_comment_text_is_absent_from_real_gradebook_csv_and_logs(
    real_comment_api, family, assigned_activity, caplog, comment_submission
):
    sentinel = "SYNTHETIC_PRIVATE_COMMENT_EXPORT_SENTINEL"
    headers = authorization(family["teacher_client"])
    posted = real_comment_api.post(
        comment_path(comment_submission["id"]), headers=headers, json={"body": sentinel}
    )
    assert posted.status_code == 201
    exported = real_comment_api.get(
        f"/api/sections/{family['sections'][0]}/gradebook.csv", headers=headers
    )
    assert exported.status_code == 200, exported.text
    assert "text/csv" in exported.headers["content-type"]
    assert sentinel not in exported.text and sentinel not in caplog.text


@pytest.mark.parametrize("actor", ["teacher", "parent"])
def test_authorized_source_delete_removes_comments_but_preserves_peer_upload(
    real_comment_api, family, comment_submission, peer_comment_submission, actor
):
    source = comment_submission["id"]
    if actor == "parent":
        admin.table("submission").update(
            {"uploader_id": family["parent"], "uploader_role": "parent"}
        ).eq("id", source).execute()
    posted = real_comment_api.post(
        comment_path(source),
        headers=authorization(family["teacher_client"]),
        json={"body": "Synthetic source comment"},
    )
    peer = real_comment_api.post(
        comment_path(peer_comment_submission["id"]),
        headers=authorization(family["parent_client"]),
        json={"body": "Synthetic retained peer comment"},
    )
    assert posted.status_code == peer.status_code == 201
    response = real_comment_api.delete(
        f"/api/submissions/{source}", headers=authorization(family[f"{actor}_client"])
    )
    assert response.status_code == 200, response.text
    assert (
        admin.table("private_comment").select("id").eq("id", posted.json()["id"]).execute().data
        == []
    )
    assert admin.table("private_comment").select("id").eq(
        "id", peer.json()["id"]
    ).execute().data == [{"id": peer.json()["id"]}]


def test_graded_parent_delete_keeps_conversation_and_unreleased_scores_private(
    real_comment_api, family, comment_submission
):
    source = comment_submission["id"]
    admin.table("submission").update(
        {"uploader_id": family["parent"], "uploader_role": "parent"}
    ).eq("id", source).execute()
    posted = real_comment_api.post(
        comment_path(source),
        headers=authorization(family["teacher_client"]),
        json={"body": "Synthetic teacher comment"},
    )
    assert posted.status_code == 201
    admin.table("manual_score").insert(
        {
            "submission_id": source,
            "graded_by": family["teacher"],
            **{
                f"{criterion}_band": "excellent"
                for criterion in (
                    "letter_formation",
                    "size_consistency",
                    "spacing",
                    "slant",
                    "baseline_alignment",
                )
            },
        }
    ).execute()
    response = real_comment_api.delete(
        f"/api/submissions/{source}", headers=authorization(family["parent_client"])
    )
    assert (
        response.status_code == 409
        and response.json()["error"]["code"] == "SUBMISSION_ALREADY_GRADED"
    )
    assert (
        family["parent_client"]
        .table("manual_score")
        .select("id")
        .eq("submission_id", source)
        .execute()
        .data
        == []
    )
    assert family["parent_client"].table("private_comment").select("id").eq(
        "id", posted.json()["id"]
    ).execute().data == [{"id": posted.json()["id"]}]


def test_storage_failure_does_not_remove_submission_comments(
    real_comment_api, family, comment_submission, monkeypatch
):
    source = comment_submission["id"]
    posted = real_comment_api.post(
        comment_path(source),
        headers=authorization(family["teacher_client"]),
        json={"body": "Synthetic retained after storage failure"},
    )
    assert posted.status_code == 201

    def failed_remove(_bucket, _paths):
        raise TimeoutError("Synthetic unavailable Storage operation")

    monkeypatch.setattr(type(admin.storage.from_("submission-images")), "remove", failed_remove)
    response = real_comment_api.delete(
        f"/api/submissions/{source}", headers=authorization(family["teacher_client"])
    )
    assert response.status_code == 500
    assert admin.table("submission").select("id").eq("id", source).execute().data == [
        {"id": source}
    ]
    assert admin.table("private_comment").select("id").eq(
        "id", posted.json()["id"]
    ).execute().data == [{"id": posted.json()["id"]}]


def test_database_delete_failure_keeps_submission_comments(
    real_comment_api, family, comment_submission
):
    source = comment_submission["id"]
    posted = real_comment_api.post(
        comment_path(source),
        headers=authorization(family["teacher_client"]),
        json={"body": "Synthetic retained after database failure"},
    )
    assert posted.status_code == 201
    name = "comment_delete_fault_" + uuid4().hex
    function = "writewise_internal." + name
    db_value(
        f"create function {function}() returns trigger language plpgsql "
        "security invoker set search_path='' as $$ begin "
        f"if old.id='{source}'::uuid then raise exception 'Synthetic deletion rollback'; "
        "end if; return old; end; $$"
    )
    try:
        db_value(
            f"create trigger {name} before delete on public.submission "
            f"for each row execute function {function}()"
        )
        try:
            response = real_comment_api.delete(
                f"/api/submissions/{source}", headers=authorization(family["teacher_client"])
            )
            assert response.status_code == 500
            assert admin.table("submission").select("id").eq("id", source).execute().data == [
                {"id": source}
            ]
            assert admin.table("private_comment").select("id").eq(
                "id", posted.json()["id"]
            ).execute().data == [{"id": posted.json()["id"]}]
        finally:
            db_value(f"drop trigger {name} on public.submission")
    finally:
        db_value(f"drop function {function}()")
