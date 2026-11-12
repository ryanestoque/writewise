"""Actual Node CLI -> mounted FastAPI route, with controlled RPC/provider HTTP."""

import json
import os
import shutil
import socket
import subprocess
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest
import uvicorn
from pydantic import SecretStr

from app.api.internal_emails import get_email_delivery_resources
from app.core.config import settings
from app.email.provider import ResendSender
from app.email.queue import EmailQueue
from app.main import app

SECRET = "synthetic-caller-secret-0123456789-do-not-log"
OUTBOX = "11111111-1111-4111-8111-111111111111"
TOKEN = "22222222-2222-4222-8222-222222222222"
AUTHORIZED = "33333333-3333-4333-8333-333333333333"
PROVIDER = "44444444-4444-4444-8444-444444444444"
ADDRESS = "synthetic-caller-private@example.test"
CALLER = Path(__file__).resolve().parents[3] / "ops/email-dispatch/dispatch.mjs"


@pytest.mark.parametrize("mode", ["success", "unauthorized", "disabled"])
def test_actual_cli_respects_mounted_dispatch_authentication_and_counts(monkeypatch, mode):
    monkeypatch.setattr(settings, "EMAIL_DISPATCH_ENABLED", mode != "disabled")
    monkeypatch.setattr(settings, "EMAIL_DISPATCH_SECRET", SecretStr(SECRET))
    monkeypatch.setattr(settings, "EMAIL_FROM", "sender@example.test")
    monkeypatch.setattr(settings, "APP_BASE_URL", "https://portal.example.test")
    calls = []
    claims = 0

    def rpc_response(request):
        nonlocal claims
        operation = request.url.path.rsplit("/", 1)[-1]
        payload = json.loads(request.content)
        calls.append(operation)
        now = datetime.now(timezone.utc)
        if operation == "claim_email_delivery":
            claims += 1
            if claims > 1:
                return httpx.Response(200, content=b"null")
            return httpx.Response(
                200,
                json={
                    "outbox_id": OUTBOX,
                    "notification_id": OUTBOX,
                    "event_type": "submission_returned",
                    "claim_token": TOKEN,
                    "lease_expires_at": (now + timedelta(minutes=2)).isoformat(),
                    "attempts": 0,
                },
            )
        if operation == "prepare_email_delivery":
            assert payload["expected_claim_token"] == TOKEN
            return httpx.Response(
                200,
                json={
                    "state": "ready",
                    "recipient": ADDRESS,
                    "event_type": "submission_returned",
                },
            )
        if operation == "authorize_email_delivery":
            assert payload["payload_recipient"] == ADDRESS
            return httpx.Response(
                200,
                json={
                    "state": "authorized",
                    "claim_token": AUTHORIZED,
                    "attempts": 1,
                    "first_attempt_at": now.isoformat(),
                    "authorized_at": now.isoformat(),
                },
            )
        if operation == "finish_email_delivery":
            assert payload["expected_claim_token"] == AUTHORIZED
            assert payload["delivery_outcome"] == "sent"
            assert payload["provider_id"] == PROVIDER
            return httpx.Response(200, json=True)
        raise AssertionError("Unexpected controlled RPC")

    def provider_response(request):
        calls.append("provider")
        assert request.url == "https://api.resend.com/emails"
        assert json.loads(request.content)["to"] == [ADDRESS]
        assert request.headers["Idempotency-Key"] == "writewise-email/" + OUTBOX
        return httpx.Response(201, json={"id": PROVIDER})

    async def resources():
        calls.append("resources")
        async with (
            httpx.AsyncClient(
                base_url="https://controlled-rpc.example.test/rest/v1/",
                transport=httpx.MockTransport(rpc_response),
            ) as rpc,
            httpx.AsyncClient(transport=httpx.MockTransport(provider_response)) as provider,
        ):
            yield EmailQueue(rpc), ResendSender(provider, "synthetic-provider-key")

    monkeypatch.setitem(app.dependency_overrides, get_email_delivery_resources, resources)
    node = shutil.which("node")
    assert node is not None, "Node 24 is required for caller integration"
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(
        uvicorn.Config(
            app,
            lifespan="off",
            access_log=False,
            log_level="critical",
        )
    )
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    try:
        thread.start()
        deadline = time.monotonic() + 5
        while not server.started and thread.is_alive() and time.monotonic() < deadline:
            time.sleep(0.01)
        assert server.started, "Controlled loopback API did not start"
        env = {
            key: os.environ[key]
            for key in ("PATH", "SYSTEMROOT", "TEMP", "TMP")
            if key in os.environ
        }
        env.update(
            {
                "WRITEWISE_EMAIL_SCHEDULER_ENABLED": "true",
                "WRITEWISE_ALLOW_LOCALHOST": "true",
                "WRITEWISE_BACKEND_ORIGIN": f"http://127.0.0.1:{port}",
                "EMAIL_DISPATCH_SECRET": SECRET
                if mode != "unauthorized"
                else "wrong-secret-0123456789-0123456789",
            }
        )
        result = subprocess.run(
            [node, str(CALLER)], env=env, capture_output=True, text=True, timeout=10, check=False
        )
        assert result.stderr == ""
        for private in (SECRET, ADDRESS, PROVIDER, "synthetic-provider-key", str(port)):
            assert private not in result.stdout
        output = json.loads(result.stdout)
        if mode == "success":
            assert result.returncode == 0
            assert output == {
                "code": "dispatch_ok",
                "counts": {
                    "claimed": 1,
                    "sent": 1,
                    "retried": 0,
                    "failed": 0,
                    "skipped": 0,
                },
            }
            assert calls == [
                "resources",
                "claim_email_delivery",
                "prepare_email_delivery",
                "authorize_email_delivery",
                "provider",
                "finish_email_delivery",
                "claim_email_delivery",
            ]
        else:
            assert result.returncode == 1
            assert output == {"code": "dispatch_http"}
            assert calls == []
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        sock.close()
        assert not thread.is_alive(), "Controlled API thread failed to stop"
