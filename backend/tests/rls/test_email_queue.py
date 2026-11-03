"""Durable leases/reservations/outcomes use actual private SQL, not a queue double."""

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import asyncpg
import httpx
import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin
from app.email.dispatcher import dispatch_emails
from app.email.provider import ResendSender
from app.email.queue import EmailQueue
from tests.rls.email_support import (
    authorize_at,
    claim_at,
    finish_at,
    outbox_row,
    outbox_rows,
    prepare_at,
    seed_due_email,
)

NOW = datetime(2030, 1, 1, 12, tzinfo=timezone.utc)
PROVIDER = "55555555-5555-4555-8555-555555555555"


@pytest.fixture
def queued_email(family, assigned_activity):
    row = seed_due_email(family, assigned_activity["id"], NOW)
    for other in outbox_rows(assigned_activity["id"]):
        if other["id"] != row["id"]:
            admin.table("email_outbox").update(
                {"status": "skipped", "last_error": "event_obsolete"}
            ).eq("id", other["id"]).execute()
    return row


def reserve(row, at=NOW, digest="a" * 64):
    claim = claim_at(at)
    assert claim["outbox_id"] == row["id"]
    ready = prepare_at(row["id"], claim["claim_token"], at)
    assert ready["state"] == "ready"
    allowed = authorize_at(row["id"], claim["claim_token"], ready["recipient"], digest, at)
    return claim, ready, allowed


def test_authorization_reserves_once_and_rotates_token(queued_email):
    claim, ready, allowed = reserve(queued_email)
    assert allowed["state"] == "authorized"
    assert allowed["attempts"] == 1
    assert allowed["claim_token"] != claim["claim_token"]
    assert authorize_at(
        queued_email["id"], claim["claim_token"], ready["recipient"], "a" * 64, NOW
    ) == {"state": "lost"}
    assert outbox_row(queued_email["id"])["attempts"] == 1


def test_a_live_lease_is_not_claimed_twice(queued_email):
    claim = claim_at(NOW)
    assert claim["outbox_id"] == queued_email["id"]
    assert claim_at(NOW + timedelta(minutes=1)) is None


def test_expired_unused_lease_recovers_without_using_attempts(queued_email):
    original = claim_at(NOW)
    recovered = claim_at(NOW + timedelta(minutes=3))
    assert recovered["outbox_id"] == queued_email["id"]
    assert recovered["claim_token"] != original["claim_token"]
    assert recovered["attempts"] == 0
    assert not finish_at(queued_email["id"], original["claim_token"], "released", NOW)


def test_finalize_requires_the_current_authorization_token(queued_email):
    claim, _, allowed = reserve(queued_email)
    assert not finish_at(
        queued_email["id"], claim["claim_token"], "sent", NOW, provider_id=PROVIDER
    )
    assert finish_at(queued_email["id"], allowed["claim_token"], "sent", NOW, provider_id=PROVIDER)
    stored = outbox_row(queued_email["id"])
    assert stored["status"] == "sent"
    assert stored["provider_message_id"] == PROVIDER
    assert stored["claim_token"] is None
    assert claim_at(NOW + timedelta(hours=1)) is None


def test_changed_retry_payload_is_terminally_skipped(queued_email):
    reserve(queued_email)
    second, ready, _ = reserve(queued_email, NOW + timedelta(minutes=3), digest="b" * 64)
    state = outbox_row(queued_email["id"])
    assert state["status"] == "skipped"
    assert state["last_error"] == "payload_changed"
    assert state["attempts"] == 1
    assert second["claim_token"]
    assert ready["recipient"]


def test_third_lost_attempt_is_not_sent_a_fourth_time(queued_email):
    for minute in (0, 3, 6):
        _, _, allowed = reserve(queued_email, NOW + timedelta(minutes=minute))
        assert allowed["state"] == "authorized"
    assert claim_at(NOW + timedelta(minutes=9)) is None
    row = outbox_row(queued_email["id"])
    assert row["attempts"] == 3
    assert row["status"] == "failed"
    assert row["last_error"] == "delivery_unknown"


def test_unknown_delivery_is_not_retried_beyond_one_hour(queued_email):
    reserve(queued_email)
    assert claim_at(NOW + timedelta(hours=1)) is None
    row = outbox_row(queued_email["id"])
    assert row["status"] == "failed"
    assert row["last_error"] == "delivery_unknown"


def test_reclaimed_retry_needs_its_own_reservation_before_finish(queued_email):
    _, _, allowed = reserve(queued_email)
    assert finish_at(
        queued_email["id"],
        allowed["claim_token"],
        "retry",
        NOW,
        error_code="provider_timeout",
        retry_at=NOW + timedelta(minutes=5),
    )
    new_claim = claim_at(NOW + timedelta(minutes=5))
    assert new_claim["attempts"] == 1
    assert not finish_at(
        queued_email["id"],
        new_claim["claim_token"],
        "sent",
        NOW + timedelta(minutes=5),
        provider_id=PROVIDER,
    )
    assert finish_at(
        queued_email["id"], new_claim["claim_token"], "released", NOW + timedelta(minutes=5)
    )
    assert outbox_row(queued_email["id"])["attempts"] == 1


def test_foreign_token_cannot_change_a_claim(queued_email):
    claim_at(NOW)
    assert not finish_at(queued_email["id"], uuid4(), "released", NOW)
    assert outbox_row(queued_email["id"])["status"] == "processing"


def test_claim_skips_an_uncommitted_claim_without_waiting(queued_email):
    async def exercise():
        locker, worker = [await asyncpg.connect(os.environ["SUPABASE_DB_URL"]) for _ in range(2)]
        transaction = locker.transaction()
        await transaction.start()
        try:
            first = await locker.fetchval(
                "select writewise_internal.claim_email_delivery_at($1)", NOW
            )
            first = json.loads(first) if isinstance(first, str) else first
            assert first["outbox_id"] == queued_email["id"]
            second = await asyncio.wait_for(
                worker.fetchval("select writewise_internal.claim_email_delivery_at($1)", NOW),
                timeout=2,
            )
            assert second is None
        finally:
            await transaction.rollback()
            await locker.close()
            await worker.close()

    asyncio.run(exercise())


def test_authorization_rechecks_preference_after_preparation(family, queued_email):
    claim = claim_at(NOW)
    ready = prepare_at(queued_email["id"], claim["claim_token"], NOW)
    assert ready["state"] == "ready"
    try:
        admin.table("parent").update({"email_notifications": False}).eq(
            "id", family["parent"]
        ).execute()
        assert authorize_at(
            queued_email["id"], claim["claim_token"], ready["recipient"], "a" * 64, NOW
        ) == {"state": "skipped", "code": "preference_off"}
        assert outbox_row(queued_email["id"])["attempts"] == 0
    finally:
        admin.table("parent").update({"email_notifications": True}).eq(
            "id", family["parent"]
        ).execute()


def test_supplied_recipient_must_match_canonical_address(queued_email):
    claim = claim_at(NOW)
    assert authorize_at(
        queued_email["id"], claim["claim_token"], "foreign@example.com", "a" * 64, NOW
    ) == {"state": "skipped", "code": "payload_changed"}
    assert outbox_row(queued_email["id"])["attempts"] == 0


@pytest.mark.parametrize("role", ["parent_client", "teacher_client", "other_parent_client"])
@pytest.mark.parametrize(
    "rpc,payload",
    [
        ("claim_email_delivery", {}),
        (
            "prepare_email_delivery",
            {"target_outbox_id": str(uuid4()), "expected_claim_token": str(uuid4())},
        ),
        (
            "authorize_email_delivery",
            {
                "target_outbox_id": str(uuid4()),
                "expected_claim_token": str(uuid4()),
                "payload_recipient": "synthetic@example.com",
                "payload_sha256": "a" * 64,
            },
        ),
        (
            "finish_email_delivery",
            {
                "target_outbox_id": str(uuid4()),
                "expected_claim_token": str(uuid4()),
                "delivery_outcome": "sent",
                "provider_id": PROVIDER,
                "error_code": None,
                "retry_at": None,
            },
        ),
    ],
)
def test_browser_cannot_call_delivery_rpcs(family, role, rpc, payload):
    with pytest.raises(APIError):
        family[role].rpc(rpc, payload).execute()


@pytest.mark.parametrize("minutes", [0, 60, 61])
def test_retry_requires_a_future_in_window_instant(queued_email, minutes):
    _, _, allowed = reserve(queued_email)
    with pytest.raises(asyncpg.CheckViolationError):
        finish_at(
            queued_email["id"],
            allowed["claim_token"],
            "retry",
            NOW,
            error_code="provider_timeout",
            retry_at=NOW + timedelta(minutes=minutes),
        )
    assert outbox_row(queued_email["id"])["status"] == "processing"


def test_real_rpc_transactions_release_locks_before_async_provider(family, assigned_activity):
    at = datetime.now(timezone.utc)
    row = seed_due_email(family, assigned_activity["id"], at)
    for other in outbox_rows(assigned_activity["id"]):
        if other["id"] != row["id"]:
            admin.table("email_outbox").update(
                {"status": "skipped", "last_error": "event_obsolete"}
            ).eq("id", other["id"]).execute()

    async def exercise():
        calls = []

        async def provider(request):
            calls.append(request)
            connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
            try:
                async with connection.transaction():
                    await connection.execute("set local lock_timeout='500ms'")
                    await connection.fetchval(
                        "select id from public.activity where id=$1 for update nowait",
                        assigned_activity["id"],
                    )
                    await connection.fetchval(
                        "select id from public.email_outbox where id=$1 for update nowait",
                        row["id"],
                    )
                await asyncio.sleep(0)
                return httpx.Response(200, json={"id": PROVIDER})
            finally:
                await connection.close()

        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        async with (
            httpx.AsyncClient(
                base_url=os.environ["SUPABASE_URL"] + "/rest/v1/",
                headers={"apikey": key, "Authorization": "Bearer " + key},
            ) as rpc,
            httpx.AsyncClient(transport=httpx.MockTransport(provider)) as external,
        ):
            counts = await dispatch_emails(
                EmailQueue(rpc),
                ResendSender(external, "synthetic-key"),
                sender_address="WriteWise <synthetic@example.com>",
                app_origin="https://example.com",
            )
        assert counts.sent == 1 and len(calls) == 1
        assert calls[0].headers["Idempotency-Key"] == "writewise-email/" + row["id"]
        assert outbox_row(row["id"])["status"] == "sent"

    asyncio.run(exercise())
