"""Real async request construction with only Resend HTTP replaced."""

import asyncio
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx
import pytest

from app.email.templates import render_email

OUTBOX = UUID("44444444-4444-4444-4444-444444444444")
PROVIDER = "55555555-5555-4555-8555-555555555555"


def exercise(response):
    from app.email.provider import ResendSender

    calls = []

    def respond(request):
        calls.append(request)
        return response(request) if callable(response) else response

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            mail = render_email(
                "due_soon", "parent@example.com", "sender@example.com", "https://portal.example"
            )
            sender = ResendSender(client, "synthetic-resend-key")
            return await sender.send(mail, OUTBOX)

    return asyncio.run(run()), calls


def test_sender_constructs_one_fixed_origin_request_and_stable_key():
    result, calls = exercise(httpx.Response(200, json={"id": PROVIDER}))
    assert result.disposition == "sent"
    assert result.message_id == PROVIDER
    assert len(calls) == 1
    request = calls[0]
    assert str(request.url) == "https://api.resend.com/emails"
    assert request.headers["Idempotency-Key"] == f"writewise-email/{OUTBOX}"
    assert request.headers["Authorization"] == "Bearer synthetic-resend-key"
    assert "apikey" not in request.headers
    body = json.loads(request.content)
    assert body["to"] == ["parent@example.com"]
    assert body["subject"] == "WriteWise: an activity is due soon"


@pytest.mark.parametrize(
    "status,name,disposition,code,stop",
    [
        (500, "application_error", "retry", "provider_unavailable", False),
        (429, "rate_limit_exceeded", "retry", "provider_throttled", True),
        (429, "daily_quota_exceeded", "retry", "provider_throttled", True),
        (429, "monthly_quota_exceeded", "retry", "provider_throttled", True),
        (409, "concurrent_idempotent_requests", "retry", "provider_unavailable", False),
        (409, "invalid_idempotent_request", "failed", "idempotency_conflict", False),
        (401, "missing_api_key", "failed", "provider_configuration", True),
        (403, "validation_error", "failed", "provider_configuration", True),
        (422, "validation_error", "failed", "provider_rejected", False),
        (400, "unknown", "failed", "provider_rejected", False),
    ],
)
def test_provider_errors_are_classified_without_retaining_payload(
    status, name, disposition, code, stop, caplog
):
    result, calls = exercise(
        httpx.Response(status, json={"name": name, "message": "private-note parent@example.com"})
    )
    assert result.disposition == disposition
    assert result.code == code
    assert result.stop_batch is stop
    assert result.message_id is None
    assert len(calls) == 1
    assert "private-note" not in repr(result) + caplog.text
    assert "parent@example.com" not in repr(result) + caplog.text


@pytest.mark.parametrize("body", [None, {"id": "private-note"}, ["private-note"]])
def test_malformed_acceptance_is_retryable_and_never_called_sent(body):
    response = (
        httpx.Response(200, text="not-json") if body is None else httpx.Response(200, json=body)
    )
    result, _ = exercise(response)
    assert result.disposition == "retry"
    assert result.code == "provider_unavailable"
    assert result.message_id is None


def test_connection_failure_is_sanitized_without_automatic_retry(caplog):
    def unavailable(request):
        raise httpx.ConnectError("private-note parent@example.com", request=request)

    result, calls = exercise(unavailable)
    assert result.disposition == "retry"
    assert result.code == "provider_unavailable"
    assert len(calls) == 1
    assert "private-note" not in repr(result) + caplog.text


def test_response_redirect_is_not_followed():
    result, calls = exercise(
        httpx.Response(307, headers={"Location": "https://foreign.example/collect"})
    )
    assert result.disposition == "failed"
    assert len(calls) == 1
    assert calls[0].url.host == "api.resend.com"


@pytest.mark.parametrize(
    "header,expected",
    [
        ("Tue, 01 Jan 2030 00:00:00 GMT", datetime(2030, 1, 1, tzinfo=timezone.utc)),
        ("invalid-private-note", None),
        ("-4", None),
    ],
)
def test_retry_after_date_and_invalid_values(header, expected):
    result, _ = exercise(httpx.Response(429, headers={"Retry-After": header}))
    assert result.retry_not_before == expected


def test_provider_request_has_an_overall_timeout():
    from app.email.provider import ResendSender

    calls = []

    async def stalled(request):
        calls.append(request)
        await asyncio.Event().wait()

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(stalled)) as client:
            mail = render_email(
                "due_soon", "parent@example.com", "sender@example.com", "https://portal.example"
            )
            async with asyncio.timeout(6):
                return await ResendSender(client, "synthetic-key").send(mail, OUTBOX)

    result = asyncio.run(run())
    assert result.disposition == "retry"
    assert result.code == "provider_timeout"
    assert len(calls) == 1


@pytest.mark.parametrize(
    "status,code,stop",
    [
        (429, "provider_throttled", True),
        (401, "provider_configuration", True),
        (200, "provider_unavailable", False),
    ],
)
def test_large_payload_does_not_hide_quota_or_credential_status(status, code, stop):
    result, _ = exercise(httpx.Response(status, json={"id": PROVIDER, "message": "x" * 20000}))
    assert result.code == code
    assert result.stop_batch is stop
    assert result.message_id is None


def test_numeric_retry_hint_is_relative_to_response_time():
    before = datetime.now(timezone.utc)
    result, _ = exercise(httpx.Response(429, headers={"Retry-After": "600"}))
    after = datetime.now(timezone.utc)
    assert (
        before + timedelta(seconds=600) <= result.retry_not_before <= after + timedelta(seconds=600)
    )


def test_read_timeout_is_classified_without_retaining_its_message():
    def timed_out(request):
        raise httpx.ReadTimeout("private-note parent@example.com", request=request)

    result, calls = exercise(timed_out)
    assert result.code == "provider_timeout"
    assert len(calls) == 1
    assert "private-note" not in repr(result)
