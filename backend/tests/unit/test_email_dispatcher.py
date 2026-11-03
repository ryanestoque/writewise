"""Exercise actual async queue/dispatcher/provider code over controlled HTTP."""

import asyncio
import json
from types import SimpleNamespace
from uuid import UUID

import httpx
import pytest

OUTBOX = "11111111-1111-4111-8111-111111111111"
NOTICE = "22222222-2222-4222-8222-222222222222"
CLAIM = "33333333-3333-4333-8333-333333333333"
AUTHORIZED = "44444444-4444-4444-8444-444444444444"
PROVIDER = "55555555-5555-4555-8555-555555555555"
STAMP = "2030-01-01T12:00:00Z"


def delivery_case(**options):
    return SimpleNamespace(
        preparation=options.get("preparation", "ready"),
        authorization=options.get("authorization", "authorized"),
        provider_status=options.get("provider_status", 200),
        finish=options.get("finish", True),
        many=options.get("many", False),
        malformed=options.get("malformed", False),
        elapsed_after_prepare=options.get("elapsed_after_prepare", 0),
        elapsed=0,
        calls=[],
        claims=0,
    )


async def run_case(state):
    from app.email.dispatcher import dispatch_emails
    from app.email.provider import ResendSender
    from app.email.queue import EmailQueue

    def rpc_response(request):
        name = request.url.path.rsplit("/", 1)[-1]
        payload = json.loads(request.content)
        state.calls.append((name, payload))
        assert request.headers["apikey"] == "synthetic-service-key"
        if name == "claim_email_delivery":
            state.claims += 1
            if state.claims > 1 and not state.many:
                return httpx.Response(
                    200, content=b"null", headers={"Content-Type": "application/json"}
                )
            return httpx.Response(
                200,
                json={
                    "outbox_id": str(UUID(int=UUID(OUTBOX).int + state.claims - 1)),
                    "notification_id": NOTICE,
                    "event_type": "due_soon",
                    "claim_token": CLAIM,
                    "lease_expires_at": "2030-01-01T12:02:00Z",
                    "attempts": 0,
                },
            )
        if name == "prepare_email_delivery":
            state.elapsed = state.elapsed_after_prepare
            assert payload["expected_claim_token"] == CLAIM
            if state.preparation == "ready":
                return httpx.Response(
                    200,
                    json={
                        "state": "ready",
                        "recipient": "parent@example.com",
                        "event_type": "due_soon",
                    },
                )
            if state.preparation == "lost":
                return httpx.Response(200, json={"state": "lost"})
            return httpx.Response(200, json={"state": "skipped", "code": "preference_off"})
        if name == "authorize_email_delivery":
            assert payload["expected_claim_token"] == CLAIM
            assert payload["payload_recipient"] == "parent@example.com"
            assert len(payload["payload_sha256"]) == 64
            if state.malformed:
                return httpx.Response(200, json={"state": "authorized"})
            if state.authorization == "skipped":
                return httpx.Response(200, json={"state": "skipped", "code": "payload_changed"})
            return httpx.Response(
                200,
                json={
                    "state": "authorized",
                    "claim_token": AUTHORIZED,
                    "attempts": 1,
                    "first_attempt_at": STAMP,
                    "authorized_at": STAMP,
                },
            )
        assert name == "finish_email_delivery"
        assert payload["expected_claim_token"] == (
            CLAIM if payload["delivery_outcome"] == "released" else AUTHORIZED
        )
        return httpx.Response(200, json=state.finish)

    def provider_response(request):
        state.calls.append(("provider", json.loads(request.content)))
        assert "apikey" not in request.headers
        if state.provider_status == 200:
            return httpx.Response(200, json={"id": PROVIDER})
        return httpx.Response(
            state.provider_status,
            json={"name": "daily_quota_exceeded", "message": "private-note parent@example.com"},
        )

    async with (
        httpx.AsyncClient(
            base_url="http://127.0.0.1:54321/rest/v1/",
            headers={"apikey": "synthetic-service-key"},
            transport=httpx.MockTransport(rpc_response),
        ) as rpc,
        httpx.AsyncClient(transport=httpx.MockTransport(provider_response)) as provider,
    ):
        return await dispatch_emails(
            EmailQueue(rpc),
            ResendSender(provider, "synthetic-provider-key"),
            sender_address="sender@example.com",
            app_origin="https://portal.example",
        )


def test_dispatch_commits_outcome_using_authorized_token():
    state = delivery_case()
    result = asyncio.run(run_case(state))
    assert result.model_dump() == {"claimed": 1, "sent": 1, "retried": 0, "failed": 0, "skipped": 0}
    assert [name for name, _ in state.calls] == [
        "claim_email_delivery",
        "prepare_email_delivery",
        "authorize_email_delivery",
        "provider",
        "finish_email_delivery",
        "claim_email_delivery",
    ]
    outcome = state.calls[4][1]
    assert outcome["delivery_outcome"] == "sent"
    assert outcome["provider_id"] == PROVIDER


@pytest.mark.parametrize("stage", ["prepare", "authorize"])
def test_skip_never_sends_to_provider(stage):
    state = delivery_case(
        preparation="skipped" if stage == "prepare" else "ready",
        authorization="skipped" if stage == "authorize" else "authorized",
    )
    result = asyncio.run(run_case(state))
    assert result.skipped == 1
    assert result.sent == 0
    assert "provider" not in [name for name, _ in state.calls]


def test_quota_error_records_retry_and_stops_the_batch():
    state = delivery_case(provider_status=429, many=True)
    result = asyncio.run(run_case(state))
    assert result.model_dump() == {"claimed": 1, "sent": 0, "retried": 1, "failed": 0, "skipped": 0}
    assert state.claims == 1
    finish = [payload for name, payload in state.calls if name == "finish_email_delivery"][0]
    assert finish["delivery_outcome"] == "retry"
    assert finish["retry_at"] == "2030-01-01T12:05:00+00:00"
    assert finish["error_code"] == "provider_throttled"


def test_lost_or_malformed_authorization_never_sends():
    state = delivery_case(malformed=True)
    with pytest.raises(RuntimeError, match="Email"):
        asyncio.run(run_case(state))
    assert "provider" not in [name for name, _ in state.calls]


def test_lost_finalization_is_not_reported_as_success():
    state = delivery_case(finish=False)
    with pytest.raises(RuntimeError, match="Email"):
        asyncio.run(run_case(state))
    assert [name for name, _ in state.calls].count("provider") == 1


def test_dispatch_claims_at_most_ten_rows():
    state = delivery_case(many=True)
    result = asyncio.run(run_case(state))
    assert result.claimed == result.sent == 10
    assert state.claims == 10


def test_exhausted_budget_releases_claim_before_reservation(monkeypatch):
    from app.email import dispatcher

    state = delivery_case(elapsed_after_prepare=15)
    monkeypatch.setattr(dispatcher, "monotonic", lambda: state.elapsed)
    result = asyncio.run(run_case(state))
    assert result.claimed == 1
    assert result.sent == 0
    names = [name for name, _ in state.calls]
    assert "authorize_email_delivery" not in names
    assert "provider" not in names
    assert state.calls[-1][1]["delivery_outcome"] == "released"
