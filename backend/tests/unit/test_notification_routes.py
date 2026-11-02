"""Actual notification routes and SDK; only external HTTP is controlled."""

import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from supabase import ClientOptions, create_client

from app.api.deps import get_current_user
from app.core.supabase import supabase_client
from app.main import app

ACTOR = "11111111-1111-1111-1111-111111111111"
NOTICE = "44444444-4444-4444-4444-444444444444"
STAMP = "2030-01-01T00:00:00Z"


@pytest.fixture
def notice_case(monkeypatch):
    state = SimpleNamespace(owned=True, error=None, calls=[], actor=ACTOR)

    def respond(request):
        path = request.url.path.removeprefix("/rest/v1/")
        if path == "notification":
            assert request.url.params["recipient_id"] == f"eq.{ACTOR}"
            assert request.url.params["id"] == f"eq.{NOTICE}"
            return httpx.Response(200, json=[{"id": NOTICE}] if state.owned else [])
        assert path in {"rpc/mark_notification_read", "rpc/mark_all_notifications_read"}
        payload = json.loads(request.content)
        state.calls.append(payload)
        assert payload["actor_id"] == ACTOR
        if state.error:
            return httpx.Response(
                400,
                json={
                    "code": state.error,
                    "message": "private detail",
                    "details": None,
                    "hint": None,
                },
            )
        if path.endswith("mark_notification_read"):
            assert payload == {"actor_id": ACTOR, "target_notification_id": NOTICE}
            return httpx.Response(200, json={"id": NOTICE, "read_at": STAMP})
        assert payload == {"actor_id": ACTOR}
        return httpx.Response(200, json={"updated_count": 3, "read_at": STAMP})

    transport = httpx.Client(transport=httpx.MockTransport(respond))
    sdk = create_client(
        "http://127.0.0.1:54321", "test-key", options=ClientOptions(httpx_client=transport)
    )
    monkeypatch.setattr(supabase_client, "_postgrest", sdk.postgrest)
    app.dependency_overrides[get_current_user] = lambda: {"sub": state.actor, "role": "parent"}
    try:
        with TestClient(app) as client:
            state.client = client
            yield state
    finally:
        app.dependency_overrides.clear()
        transport.close()


def test_single_read_uses_verified_recipient(notice_case):
    response = notice_case.client.post(f"/api/notifications/{NOTICE}/read")
    assert response.status_code == 200, response.text
    assert response.json() == {"id": NOTICE, "read_at": STAMP}
    assert len(notice_case.calls) == 1


def test_read_all_ignores_spoofed_recipient(notice_case):
    response = notice_case.client.post(
        "/api/notifications/read-all?recipient_id=foreign", json={"recipient_id": "foreign"}
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"updated_count": 3, "read_at": STAMP}
    assert notice_case.calls == [{"actor_id": ACTOR}]


def test_foreign_read_never_mutates(notice_case):
    notice_case.owned = False
    response = notice_case.client.post(f"/api/notifications/{NOTICE}/read")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
    assert notice_case.calls == []


@pytest.mark.parametrize(
    "db_code,status,code", [("WW404", 404, "NOT_FOUND"), ("XX000", 500, "INTERNAL_ERROR")]
)
def test_read_error_sanitization(notice_case, db_code, status, code, caplog):
    notice_case.error = db_code
    response = notice_case.client.post(f"/api/notifications/{NOTICE}/read")
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert "private detail" not in response.text
    assert "private detail" not in caplog.text


def test_bad_uuid_returns_validation_error(notice_case):
    response = notice_case.client.post("/api/notifications/not-a-uuid/read")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert notice_case.calls == []


def test_missing_token_uses_standard_unauthorized_envelope(notice_case):
    app.dependency_overrides.clear()
    response = notice_case.client.post("/api/notifications/read-all")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
    assert response.headers["www-authenticate"] == "Bearer"
    assert notice_case.calls == []
