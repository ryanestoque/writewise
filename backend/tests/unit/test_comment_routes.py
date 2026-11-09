"""Mounted routes and real SDK requests; only the external HTTP transport is controlled."""

import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from supabase import ClientOptions, create_client

from app.api.deps import get_current_user
from app.core.supabase import supabase_client
from app.main import app

TEACHER = "11111111-1111-1111-1111-111111111111"
PARENT = "22222222-2222-2222-2222-222222222222"
STUDENT = "33333333-3333-3333-3333-333333333333"
ACTIVITY = "44444444-4444-4444-4444-444444444444"
COMMENT = "55555555-5555-5555-5555-555555555555"
NOTICE = "66666666-6666-6666-6666-666666666666"
STAMP = "2030-01-01T02:00:00Z"
SENTINEL = "SYNTHETIC_PRIVATE_COMMENT_BOUNDARY"
POST_PATH = f"/api/activities/{ACTIVITY}/students/{STUDENT}/comments"


@pytest.fixture
def comment_case(monkeypatch):
    state = SimpleNamespace(
        actor=TEACHER,
        claimed_role="parent",
        activity_exists=True,
        owner=TEACHER,
        linked=False,
        assigned=True,
        history=False,
        comment_exists=True,
        author=TEACHER,
        calls=[],
        failure_stage=None,
        failure_code="XX000",
        transport_failure=False,
        malformed=False,
        failure_seen=False,
        notice_exists=True,
        notice_type="comment_posted",
    )

    def respond(request):
        path = request.url.path.removeprefix("/rest/v1/")
        stage = "mutation" if path.startswith("rpc/") and path != "rpc/is_assigned" else path
        if stage == state.failure_stage:
            state.failure_seen = True
            if state.transport_failure:
                raise ValueError(SENTINEL)
            return httpx.Response(
                400,
                json={
                    "code": state.failure_code,
                    "message": SENTINEL,
                    "details": SENTINEL,
                    "hint": SENTINEL,
                },
            )
        if path == "activity":
            assert request.url.params["id"] == f"eq.{ACTIVITY}"
            return httpx.Response(
                200,
                json=[{"id": ACTIVITY, "created_by": state.owner}] if state.activity_exists else [],
            )
        if path == "student_parent":
            assert request.url.params["parent_id"] == f"eq.{state.actor}"
            assert request.url.params["student_id"] == f"eq.{STUDENT}"
            return httpx.Response(200, json=[{"student_id": STUDENT}] if state.linked else [])
        if path == "rpc/is_assigned":
            assert json.loads(request.content) == {
                "target_activity_id": ACTIVITY,
                "target_student_id": STUDENT,
            }
            return httpx.Response(200, json=state.assigned)
        if path == "private_comment":
            if "id" in request.url.params:
                assert request.url.params["id"] == f"eq.{COMMENT}"
                return httpx.Response(
                    200,
                    json=[
                        {
                            "id": COMMENT,
                            "activity_id": ACTIVITY,
                            "student_id": STUDENT,
                            "author_id": state.author,
                        }
                    ]
                    if state.comment_exists
                    else [],
                )
            assert request.url.params["activity_id"] == f"eq.{ACTIVITY}"
            assert request.url.params["student_id"] == f"eq.{STUDENT}"
            return httpx.Response(200, json=[{"id": COMMENT}] if state.history else [])
        if path in {"submission", "student_work_grade"}:
            assert request.url.params["activity_id"] == f"eq.{ACTIVITY}"
            assert request.url.params["student_id"] == f"eq.{STUDENT}"
            return httpx.Response(200, json=[])
        if path == "notification":
            assert request.url.params["id"] == f"eq.{NOTICE}"
            assert request.url.params["recipient_id"] == f"eq.{state.actor}"
            return httpx.Response(
                200, json=[{"id": NOTICE, "type": state.notice_type}] if state.notice_exists else []
            )
        payload = json.loads(request.content)
        state.calls.append((path, payload))
        assert payload["actor_id"] == state.actor
        if path == "rpc/post_private_comment":
            assert set(payload) == {
                "actor_id",
                "target_activity_id",
                "target_student_id",
                "comment_body",
            }
            assert payload["target_activity_id"] == ACTIVITY
            assert payload["target_student_id"] == STUDENT
            assert payload["comment_body"] == "Synthetic reply"
            return httpx.Response(
                200,
                json={
                    "id": COMMENT,
                    "activity_id": ACTIVITY,
                    "student_id": STUDENT,
                    "author_role": SENTINEL
                    if state.malformed
                    else "teacher"
                    if state.actor == state.owner
                    else "parent",
                    "created_at": STAMP,
                    "comment_version": 1,
                    "body": SENTINEL,
                },
            )
        if path == "rpc/delete_private_comment":
            assert payload == {"actor_id": state.actor, "target_comment_id": COMMENT}
            return httpx.Response(200, json={"deleted": True})
        if path == "rpc/set_comment_thread_lock":
            assert payload == {
                "actor_id": state.actor,
                "target_activity_id": ACTIVITY,
                "target_student_id": STUDENT,
                "locked": True,
            }
            return httpx.Response(
                200,
                json={
                    "activity_id": ACTIVITY,
                    "student_id": STUDENT,
                    "comments_locked": True,
                },
            )
        if path == "rpc/mark_comment_notification_read":
            assert payload == {
                "actor_id": state.actor,
                "target_notification_id": NOTICE,
                "expected_comment_version": 2,
            }
            return httpx.Response(200, json={"id": NOTICE, "read_at": STAMP})
        if path == "rpc/mark_notification_read":
            assert payload == {"actor_id": state.actor, "target_notification_id": NOTICE}
            return httpx.Response(200, json={"id": NOTICE, "read_at": STAMP})
        raise AssertionError("Unexpected comment SDK request")

    transport = httpx.Client(transport=httpx.MockTransport(respond))
    sdk = create_client(
        "http://127.0.0.1:54321", "unit-key", options=ClientOptions(httpx_client=transport)
    )
    monkeypatch.setattr(supabase_client, "_postgrest", sdk.postgrest)
    app.dependency_overrides[get_current_user] = lambda: {
        "sub": state.actor,
        "role": state.claimed_role,
    }
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            state.client = client
            yield state
    finally:
        app.dependency_overrides.clear()
        transport.close()


def test_owner_post_uses_relationship_not_claimed_parent_role(comment_case):
    response = comment_case.client.post(POST_PATH, json={"body": "  Synthetic reply  "})
    assert response.status_code == 201, response.text
    assert response.json()["author_role"] == "teacher"
    assert response.json()["comment_version"] == 1
    assert "body" not in response.json() and SENTINEL not in response.text


def test_linked_parent_post_uses_real_membership_despite_teacher_claim(comment_case):
    comment_case.actor, comment_case.claimed_role, comment_case.linked = PARENT, "teacher", True
    response = comment_case.client.post(POST_PATH, json={"body": "Synthetic reply"})
    assert response.status_code == 201, response.text
    assert response.json()["author_role"] == "parent"


def test_unlinked_parent_cannot_post_with_forged_teacher_claim(comment_case):
    comment_case.actor, comment_case.claimed_role = PARENT, "teacher"
    response = comment_case.client.post(POST_PATH, json={"body": "Synthetic reply"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
    assert comment_case.calls == []


def test_never_assigned_pair_is_not_created_by_posting(comment_case):
    comment_case.assigned = False
    response = comment_case.client.post(POST_PATH, json={"body": "Synthetic reply"})
    assert response.status_code == 404 and comment_case.calls == []


def test_parent_cannot_lock_even_with_teacher_claim(comment_case):
    comment_case.actor, comment_case.claimed_role, comment_case.linked = PARENT, "teacher", True
    response = comment_case.client.put(POST_PATH + "/lock", json={"locked": True})
    assert response.status_code == 404 and comment_case.calls == []


def test_owner_lock_only_writes_comment_lock_state(comment_case):
    response = comment_case.client.put(POST_PATH + "/lock", json={"locked": True})
    assert response.status_code == 200
    assert response.json() == {
        "activity_id": ACTIVITY,
        "student_id": STUDENT,
        "comments_locked": True,
    }
    assert [name for name, _payload in comment_case.calls] == ["rpc/set_comment_thread_lock"]


def test_author_delete_has_empty_204_response(comment_case):
    response = comment_case.client.delete(f"/api/comments/{COMMENT}")
    assert response.status_code == 204 and response.content == b""


def test_owner_cannot_delete_another_author_comment(comment_case):
    comment_case.author = PARENT
    response = comment_case.client.delete(f"/api/comments/{COMMENT}")
    assert response.status_code == 404 and comment_case.calls == []


@pytest.mark.parametrize("stage", ["activity", "rpc/is_assigned", "mutation"])
@pytest.mark.parametrize("transport_failure", [False, True])
def test_private_database_and_transport_failures_do_not_escape(
    comment_case, caplog, stage, transport_failure
):
    comment_case.failure_stage, comment_case.transport_failure = stage, transport_failure
    response = comment_case.client.post(POST_PATH, json={"body": "Synthetic reply"})
    assert response.status_code == 500
    assert comment_case.failure_seen
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert SENTINEL not in response.text and SENTINEL not in caplog.text


@pytest.mark.parametrize(
    "sql_code,expected,status",
    [
        ("WW404", "NOT_FOUND", 404),
        ("WW412", "ACTIVITY_NOT_ASSIGNED", 404),
        ("WW422", "VALIDATION_ERROR", 422),
        ("WW440", "COMMENTS_LOCKED", 409),
        ("WW441", "ACTIVITY_ARCHIVED", 409),
    ],
)
def test_database_conflicts_use_stable_envelopes(comment_case, sql_code, expected, status):
    comment_case.failure_stage, comment_case.failure_code = "mutation", sql_code
    response = comment_case.client.post(POST_PATH, json={"body": "Synthetic reply"})
    assert response.status_code == status
    assert response.json()["error"]["code"] == expected and SENTINEL not in response.text


def test_invalid_success_metadata_is_sanitized_before_response_validation(comment_case, caplog):
    comment_case.malformed = True
    response = comment_case.client.post(POST_PATH, json={"body": "Synthetic reply"})
    assert response.status_code == 500
    assert SENTINEL not in response.text and SENTINEL not in caplog.text


def test_extra_json_keys_cannot_echo_private_text_in_validation_errors(comment_case, caplog):
    response = comment_case.client.post(
        POST_PATH, json={"body": "Synthetic reply", SENTINEL: "extra"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert SENTINEL not in response.text and SENTINEL not in caplog.text
    assert comment_case.calls == []


def test_comment_alert_requires_and_forwards_its_expected_version(comment_case):
    path = f"/api/notifications/{NOTICE}/read"
    missing = comment_case.client.post(path)
    assert missing.status_code == 422 and comment_case.calls == []
    response = comment_case.client.post(path, json={"expected_comment_version": 2})
    assert response.status_code == 200
    assert response.json() == {"id": NOTICE, "read_at": STAMP}


def test_newer_comment_read_conflict_preserves_unread_error_contract(comment_case):
    comment_case.failure_stage, comment_case.failure_code = "mutation", "WW442"
    response = comment_case.client.post(
        f"/api/notifications/{NOTICE}/read",
        json={"expected_comment_version": 2},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "COMMENT_READ_CONFLICT"
    assert SENTINEL not in response.text


def test_missing_authentication_fails_before_comment_operations(comment_case):
    app.dependency_overrides.clear()
    response = comment_case.client.post(POST_PATH, json={"body": "Synthetic reply"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED" and comment_case.calls == []
