"""Dispatch authentication/envelopes before queue or provider access."""

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import settings
from app.main import app

SECRET = "synthetic-dispatch-secret-0123456789"
PATH = "/api/internal/dispatch-emails"


@pytest.fixture
def delivery_settings(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_DISPATCH_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_DISPATCH_SECRET", SecretStr(SECRET))
    monkeypatch.setattr(settings, "RESEND_API_KEY", SecretStr("synthetic-key"))
    monkeypatch.setattr(settings, "EMAIL_FROM", "sender@example.com")
    monkeypatch.setattr(settings, "APP_BASE_URL", "https://portal.example")
    yield
    app.dependency_overrides.clear()


@pytest.mark.parametrize("header", [None, "", "wrong-secret"])
def test_dispatch_rejects_missing_or_wrong_secret(delivery_settings, header):
    with TestClient(app) as client:
        response = client.post(PATH, headers={"X-Dispatch-Secret": header} if header else {})
    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "UNAUTHORIZED",
            "message": "Email dispatch authentication required.",
            "details": {},
        }
    }


def test_browser_bearer_does_not_authorize_dispatch(delivery_settings):
    with TestClient(app) as client:
        response = client.post(PATH, headers={"Authorization": "Bearer synthetic-user-token"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_empty_configured_secret_cannot_authenticate(delivery_settings, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_DISPATCH_SECRET", SecretStr(""))
    with TestClient(app) as client:
        response = client.post(PATH, headers={"X-Dispatch-Secret": SECRET})
    assert response.status_code == 401


def test_valid_secret_with_dispatch_disabled_returns_cataloged_503(delivery_settings, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_DISPATCH_ENABLED", False)
    with TestClient(app) as client:
        response = client.post(PATH, headers={"X-Dispatch-Secret": SECRET})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "EMAIL_DISPATCH_UNAVAILABLE"


def install_resources(*, failure=False):
    from app.api.internal_emails import get_email_delivery_resources
    from app.email.provider import ResendSender
    from app.email.queue import EmailQueue

    calls = []

    def respond(request):
        calls.append(request)
        assert request.url.path == "/rest/v1/rpc/claim_email_delivery"
        if failure:
            return httpx.Response(500, json={"message": "private-note parent@example.com"})
        return httpx.Response(200, content=b"null", headers={"Content-Type": "application/json"})

    async def resources():
        async with (
            httpx.AsyncClient(
                base_url="http://127.0.0.1:54321/rest/v1/", transport=httpx.MockTransport(respond)
            ) as rpc,
            httpx.AsyncClient(transport=httpx.MockTransport(respond)) as provider,
        ):
            yield EmailQueue(rpc), ResendSender(provider, "synthetic-key")

    app.dependency_overrides[get_email_delivery_resources] = resources
    return calls


def test_empty_queue_is_zero_counts_and_spoofed_body_is_ignored(delivery_settings):
    calls = install_resources()
    with TestClient(app) as client:
        response = client.post(
            PATH + "?limit=999&recipient=foreign",
            headers={"X-Dispatch-Secret": SECRET},
            json={"outbox_id": "foreign", "recipient": "foreign", "provider_url": "foreign"},
        )
    assert response.status_code == 200
    assert response.json() == {"claimed": 0, "sent": 0, "retried": 0, "failed": 0, "skipped": 0}
    assert len(calls) == 1
    assert calls[0].content == b"{}"


def test_queue_failure_is_sanitized_and_not_sent_to_general_exception_logger(
    delivery_settings, caplog
):
    install_resources(failure=True)
    with TestClient(app) as client:
        response = client.post(PATH, headers={"X-Dispatch-Secret": SECRET})
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "private-note" not in response.text + caplog.text
    assert "parent@example.com" not in response.text + caplog.text
    assert SECRET not in response.text + caplog.text


def test_denied_request_never_resolves_queue_resources(delivery_settings):
    calls = install_resources()
    with TestClient(app) as client:
        response = client.post(PATH, headers={"X-Dispatch-Secret": "wrong-secret"})
    assert response.status_code == 401
    assert calls == []


def test_openapi_uses_header_key_and_typed_counts(delivery_settings):
    operation = app.openapi()["paths"][PATH]["post"]
    assert operation["security"]
    response = operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert response["$ref"].endswith("/DispatchCounts")
