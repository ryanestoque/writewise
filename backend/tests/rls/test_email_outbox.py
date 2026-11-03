"""Real event enqueue, owner preference, and service-only queue boundaries."""

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import asyncpg
import pytest
from postgrest.exceptions import APIError
from supabase import create_client

from app.core.supabase import supabase_client as admin
from tests.rls.email_support import (
    completed_submission,
    outbox_rows,
    return_submission,
    seed_due_email,
)
from tests.rls.notification_support import db_value

NOW = datetime(2030, 1, 1, 12, tzinfo=timezone.utc)


@pytest.fixture
def email_activity(family, assigned_activity):
    activity = assigned_activity["id"]
    try:
        yield activity
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()
        admin.table("parent").update({"email_notifications": True}).eq(
            "id", family["parent"]
        ).execute()


def test_due_event_enqueues_once_with_exact_deadline(family, email_activity):
    first = seed_due_email(family, email_activity, NOW)
    second = seed_due_email(family, email_activity, NOW)
    assert first["id"] == second["id"]
    assert first["status"] == "pending"
    assert first["attempts"] == 0
    assert datetime.fromisoformat(first["due_at"]) == NOW + timedelta(hours=2)
    assert first["claim_token"] is None
    assert first["first_attempt_at"] is None


def test_return_fans_out_one_email_per_current_parent(family, email_activity, second_parent):
    returned = return_submission(family, email_activity)
    rows = outbox_rows(email_activity)
    notices = (
        admin.table("notification")
        .select("id,recipient_id,submission_id")
        .eq("activity_id", email_activity)
        .eq("type", "submission_returned")
        .execute()
        .data
    )
    assert {notice["recipient_id"] for notice in notices} == {family["parent"], second_parent["id"]}
    assert {row["notification_id"] for row in rows} == {notice["id"] for notice in notices}
    assert all(row["status"] == "pending" and row["due_at"] is None for row in rows)
    assert all(notice["submission_id"] == returned["id"] for notice in notices)


def test_opt_out_keeps_in_app_event_and_terminally_skips_email(family, email_activity):
    admin.table("parent").update({"email_notifications": False}).eq(
        "id", family["parent"]
    ).execute()
    row = seed_due_email(family, email_activity, NOW)
    assert row["status"] == "skipped"
    assert row["last_error"] == "preference_off"
    notice = (
        admin.table("notification")
        .select("read_at")
        .eq("id", row["notification_id"])
        .execute()
        .data[0]
    )
    assert notice["read_at"] is None
    admin.table("parent").update({"email_notifications": True}).eq("id", family["parent"]).execute()
    repeated = seed_due_email(family, email_activity, NOW)
    assert repeated["id"] == row["id"]
    assert repeated["status"] == "skipped"


@pytest.mark.parametrize("role", ["parent", "teacher"])
def test_profile_preference_update_is_owner_scoped(family, role):
    actor, foreign = family[role], family[f"other_{role}"]
    client = family[f"{role}_client"]
    try:
        result = client.table(role).update({"email_notifications": False}).eq("id", actor).execute()
        assert [row["email_notifications"] for row in result.data] == [False]
        assert (
            client.table(role)
            .update({"email_notifications": False})
            .eq("id", foreign)
            .execute()
            .data
            == []
        )
        assert (
            client.table(role).select("email_notifications").eq("id", foreign).execute().data == []
        )
    finally:
        admin.table(role).update({"email_notifications": True}).eq("id", actor).execute()


@pytest.mark.parametrize("operation", ["select", "insert", "update", "delete"])
@pytest.mark.parametrize("role", ["parent", "teacher"])
def test_browser_cannot_access_email_outbox(family, email_activity, operation, role):
    row = seed_due_email(family, email_activity, NOW)
    table = family[f"{role}_client"].table("email_outbox")
    with pytest.raises(APIError):
        if operation == "select":
            table.select("id").eq("id", row["id"]).execute()
        elif operation == "insert":
            table.insert({"notification_id": row["notification_id"]}).execute()
        elif operation == "update":
            table.update({"status": "sent"}).eq("id", row["id"]).execute()
        else:
            table.delete().eq("id", row["id"]).execute()
    assert admin.table("email_outbox").select("status").eq("id", row["id"]).execute().data == [
        {"status": "pending"}
    ]


def test_assignment_and_missing_events_do_not_enqueue(family, email_activity):
    assert outbox_rows(email_activity) == []
    seed_due_email(family, email_activity, NOW)
    before = {row["id"] for row in outbox_rows(email_activity)}
    db_value(
        "select writewise_internal.enqueue_time_based_notifications_at($1)", NOW + timedelta(days=1)
    )
    assert {row["id"] for row in outbox_rows(email_activity)} == before


def test_deleted_notification_cascades_email_without_rearming_delivery(family, email_activity):
    row = seed_due_email(family, email_activity, NOW)
    admin.table("notification").delete().eq("id", row["notification_id"]).execute()
    assert admin.table("email_outbox").select("id").eq("id", row["id"]).execute().data == []
    db_value("select writewise_internal.enqueue_time_based_notifications_at($1)", NOW)
    assert (
        admin.table("notification").select("id").eq("id", row["notification_id"]).execute().data
        == []
    )
    assert all(candidate["id"] != row["id"] for candidate in outbox_rows(email_activity))


def test_anonymous_cannot_read_queued_email(family, email_activity):
    row = seed_due_email(family, email_activity, NOW)
    anonymous = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    with pytest.raises(APIError):
        anonymous.table("email_outbox").select("id").eq("id", row["id"]).execute()


@pytest.mark.parametrize(
    "kind",
    [
        "activity_assigned",
        "submission_rejected",
        "score_released",
        "activity_missing",
        "resubmitted_after_return",
    ],
)
def test_only_email_eligible_kinds_enqueue(family, email_activity, kind):
    target = None
    if kind in {"submission_rejected", "score_released", "resubmitted_after_return"}:
        target = completed_submission(family, email_activity)["id"]
    db_value(
        "select writewise_internal.put_notification($1,$2::public.notification_type,$3,$4,$5,$6)",
        family["parent"],
        kind,
        email_activity,
        family["students"][0],
        target,
        f"synthetic-other-event:{uuid4()}",
    )
    assert outbox_rows(email_activity) == []


@pytest.mark.parametrize("origin", ["return", "deadline"])
def test_outbox_failure_rolls_back_origin_notice_and_receipt(family, email_activity, origin):
    submission = completed_submission(family, email_activity)
    admin.table("activity").update({"due_at": (NOW + timedelta(hours=2)).isoformat()}).eq(
        "id", email_activity
    ).execute()
    if origin == "deadline":
        admin.table("submission").delete().eq("id", submission["id"]).execute()

    async def exercise():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        transaction = connection.transaction()
        await transaction.start()
        try:
            await connection.execute(
                "select set_config('request.jwt.claims',$1,true)",
                json.dumps({"role": "service_role", "sub": family["teacher"]}),
            )
            await connection.execute(
                "create function pg_temp.fail_email() returns trigger language plpgsql as $$ "
                "begin raise exception 'synthetic email failure'; end $$; "
                "create trigger fail_email before insert on public.email_outbox "
                "for each row execute function pg_temp.fail_email()"
            )
            with pytest.raises(asyncpg.PostgresError, match="synthetic email failure"):
                async with connection.transaction():
                    if origin == "deadline":
                        await connection.fetchval(
                            "select writewise_internal.enqueue_time_based_notifications_at($1)", NOW
                        )
                    else:
                        await connection.fetchval(
                            "select public.mutate_student_work($1,$2,$3,'return',$4::jsonb)",
                            family["teacher"],
                            email_activity,
                            family["students"][0],
                            json.dumps({"submission_id": submission["id"], "reason": "other"}),
                        )
            assert (
                await connection.fetchval(
                    "select count(*) from public.notification where activity_id=$1 "
                    "and type in ('due_soon','submission_returned')",
                    email_activity,
                )
                == 0
            )
            assert (
                await connection.fetchval(
                    "select count(*) from writewise_internal.notification_delivery "
                    "where activity_id=$1 and (dedupe_key like 'due_soon:%' "
                    "or dedupe_key like 'submission_returned:%')",
                    email_activity,
                )
                == 0
            )
            if origin == "return":
                assert (
                    await connection.fetchval(
                        "select status::text from public.submission where id=$1", submission["id"]
                    )
                    == "completed"
                )
        finally:
            await transaction.rollback()
            await connection.close()

    asyncio.run(exercise())
