"""Preparation rechecks current event/recipient authority using fixed database time."""

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import asyncpg
import pytest

from app.core.supabase import supabase_client as admin
from tests.rls.email_support import (
    completed_submission,
    outbox_rows,
    prepare_at,
    processing_claim,
    return_submission,
    seed_due_email,
)
from tests.rls.notification_support import db_value, wait_for_database_lock

NOW = datetime(2030, 1, 1, 12, tzinfo=timezone.utc)


@pytest.fixture
def email_case(family, assigned_activity):
    activity = assigned_activity["id"]
    row = seed_due_email(family, activity, NOW)
    try:
        yield activity, row
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()
        admin.table("parent").update({"email_notifications": True}).eq(
            "id", family["parent"]
        ).execute()


def test_wrong_claim_never_returns_a_recipient(email_case):
    _, row = email_case
    processing_claim(row["id"], NOW)
    assert prepare_at(row["id"], uuid4(), NOW) == {"state": "lost"}


def test_preparation_uses_confirmed_auth_email_not_mutable_profile(family, email_case):
    _, row = email_case
    original = admin.table("parent").select("email").eq("id", family["parent"]).execute().data[0]
    try:
        admin.table("parent").update({"email": "untrusted-profile@example.com"}).eq(
            "id", family["parent"]
        ).execute()
        result = prepare_at(row["id"], processing_claim(row["id"], NOW), NOW)
        canonical = admin.auth.admin.get_user_by_id(family["parent"]).user.email
        assert result == {"state": "ready", "event_type": "due_soon", "recipient": canonical}
    finally:
        admin.table("parent").update(original).eq("id", family["parent"]).execute()


@pytest.mark.parametrize(
    "change,code",
    [
        ("preference", "preference_off"),
        ("archive", "activity_archived"),
        ("deadline", "deadline_changed"),
        ("completed", "event_obsolete"),
    ],
)
def test_committed_state_change_suppresses_queued_reminder(family, email_case, change, code):
    activity, row = email_case
    token = processing_claim(row["id"], NOW)
    if change == "preference":
        admin.table("parent").update({"email_notifications": False}).eq(
            "id", family["parent"]
        ).execute()
    elif change == "archive":
        admin.table("activity").update({"is_archived": True}).eq("id", activity).execute()
    elif change == "deadline":
        admin.table("activity").update({"due_at": (NOW + timedelta(hours=3)).isoformat()}).eq(
            "id", activity
        ).execute()
    else:
        completed_submission(family, activity)
    assert prepare_at(row["id"], token, NOW) == {"state": "skipped", "code": code}
    state = (
        admin.table("email_outbox")
        .select("status,claim_token,lease_expires_at")
        .eq("id", row["id"])
        .execute()
        .data[0]
    )
    assert state == {"status": "skipped", "claim_token": None, "lease_expires_at": None}


def test_removed_parent_link_suppresses_queued_email(family, email_case):
    _, row = email_case
    link = {"parent_id": family["parent"], "student_id": family["students"][0]}
    try:
        admin.table("student_parent").delete().eq("parent_id", link["parent_id"]).eq(
            "student_id", link["student_id"]
        ).execute()
        assert prepare_at(row["id"], processing_claim(row["id"], NOW), NOW) == {
            "state": "skipped",
            "code": "relationship_revoked",
        }
    finally:
        admin.table("student_parent").upsert(link).execute()


@pytest.mark.parametrize(
    "offset,allowed", [(timedelta(0), True), (timedelta(microseconds=1), False)]
)
def test_due_boundary_is_inclusive_and_past_due_is_obsolete(email_case, offset, allowed):
    _, row = email_case
    check = NOW + timedelta(hours=2) + offset
    result = prepare_at(row["id"], processing_claim(row["id"], check), check)
    assert result["state"] == ("ready" if allowed else "skipped")
    if not allowed:
        assert result["code"] == "event_obsolete"


def test_a_later_return_supersedes_an_unsent_earlier_request(family, assigned_activity):
    activity = assigned_activity["id"]
    try:
        return_submission(family, activity)
        older = outbox_rows(activity)[0]
        return_submission(family, activity)
        check = datetime.now(timezone.utc)
        assert prepare_at(older["id"], processing_claim(older["id"], check), check) == {
            "state": "skipped",
            "code": "event_obsolete",
        }
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()


@pytest.mark.parametrize("field", ["email_confirmed_at", "banned_until", "deleted_at"])
def test_unavailable_auth_account_is_not_emailed(family, email_case, field):
    _, row = email_case
    original = db_value(f"select {field} from auth.users where id=$1", family["parent"])
    replacement = None if field == "email_confirmed_at" else NOW + timedelta(days=1)
    try:
        db_value(
            f"update auth.users set {field}=$2 where id=$1 returning id",
            family["parent"],
            replacement,
        )
        assert prepare_at(row["id"], processing_claim(row["id"], NOW), NOW) == {
            "state": "skipped",
            "code": "recipient_unavailable",
        }
    finally:
        db_value(
            f"update auth.users set {field}=$2 where id=$1 returning id", family["parent"], original
        )


def test_unassigned_due_work_is_not_reminded(family, email_case):
    activity, row = email_case
    admin.rpc(
        "update_assigned_activity",
        {
            "actor_id": family["teacher"],
            "target_activity_id": activity,
            "payload": {"assignments": [{"student_id": family["students"][2]}]},
        },
    ).execute()
    assert prepare_at(row["id"], processing_claim(row["id"], NOW), NOW) == {
        "state": "skipped",
        "code": "event_obsolete",
    }


def test_historical_return_remains_relevant_after_reassignment(family, assigned_activity):
    activity = assigned_activity["id"]
    try:
        return_submission(family, activity)
        row = outbox_rows(activity)[0]
        admin.rpc(
            "update_assigned_activity",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
                "payload": {"assignments": [{"student_id": family["students"][2]}]},
            },
        ).execute()
        result = prepare_at(row["id"], processing_claim(row["id"], NOW), NOW)
        assert result["state"] == "ready"
        assert result["event_type"] == "submission_returned"
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()


def test_in_class_deadlines_are_also_email_eligible(email_case):
    activity, row = email_case
    admin.table("activity").update({"is_take_home": False}).eq("id", activity).execute()
    assert prepare_at(row["id"], processing_claim(row["id"], NOW), NOW)["state"] == "ready"


def test_removed_teacher_roster_suppresses_queued_email(family, email_case):
    _, row = email_case
    link = {"teacher_id": family["teacher"], "student_id": family["students"][0]}
    try:
        admin.table("teacher_student").delete().eq("teacher_id", link["teacher_id"]).eq(
            "student_id", link["student_id"]
        ).execute()
        assert prepare_at(row["id"], processing_claim(row["id"], NOW), NOW) == {
            "state": "skipped",
            "code": "relationship_revoked",
        }
    finally:
        admin.table("teacher_student").upsert(link).execute()


@pytest.mark.parametrize(
    "earlier,ready", [(timedelta(0), True), (timedelta(microseconds=1), False)]
)
def test_dispatch_rechecks_twenty_four_hour_boundary(email_case, earlier, ready):
    _, row = email_case
    check = NOW - timedelta(hours=22) - earlier
    result = prepare_at(row["id"], processing_claim(row["id"], check), check)
    assert result["state"] == ("ready" if ready else "skipped")


@pytest.mark.parametrize("changed", [False, True])
def test_equivalent_override_preserves_event_but_changed_override_skips(
    family, email_case, changed
):
    activity, row = email_case
    due = NOW + timedelta(hours=2, microseconds=int(changed))
    admin.rpc(
        "mutate_student_work",
        {
            "actor_id": family["teacher"],
            "target_activity_id": activity,
            "target_student_id": family["students"][0],
            "operation": "update",
            "payload": {
                "due_at_override": due.astimezone(timezone(timedelta(hours=8))).isoformat()
            },
        },
    ).execute()
    result = prepare_at(row["id"], processing_claim(row["id"], NOW), NOW)
    assert result["state"] == ("skipped" if changed else "ready")
    if changed:
        assert result["code"] == "deadline_changed"


@pytest.mark.parametrize("status", ["processing", "completed"])
def test_only_completed_retry_suppresses_outstanding_return(family, assigned_activity, status):
    activity = assigned_activity["id"]
    try:
        return_submission(family, activity)
        row = outbox_rows(activity)[0]
        later = completed_submission(family, activity)
        if status == "processing":
            admin.table("submission").update({"status": status}).eq("id", later["id"]).execute()
        check = datetime.now(timezone.utc)
        result = prepare_at(row["id"], processing_claim(row["id"], check), check)
        assert result["state"] == ("ready" if status == "processing" else "skipped")
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()


def test_suppressed_preference_does_not_replay_when_enabled(family, email_case):
    _, row = email_case
    token = processing_claim(row["id"], NOW)
    admin.table("parent").update({"email_notifications": False}).eq(
        "id", family["parent"]
    ).execute()
    assert prepare_at(row["id"], token, NOW)["state"] == "skipped"
    admin.table("parent").update({"email_notifications": True}).eq("id", family["parent"]).execute()
    assert prepare_at(row["id"], token, NOW) == {"state": "lost"}


@pytest.mark.parametrize("change", ["deadline", "preference", "completion"])
def test_change_committed_before_waiting_preparation_is_observed(family, email_case, change):
    activity, row = email_case
    token = processing_claim(row["id"], NOW)
    submission = completed_submission(family, activity)
    admin.table("submission").update({"status": "processing"}).eq("id", submission["id"]).execute()

    async def exercise():
        locker, worker, observer = [
            await asyncpg.connect(os.environ["SUPABASE_DB_URL"]) for _ in range(3)
        ]
        transaction = locker.transaction()
        await transaction.start()
        task = None
        try:
            await locker.execute("select id from public.activity where id=$1 for update", activity)
            task = asyncio.create_task(
                worker.fetchval(
                    "select writewise_internal.prepare_email_delivery_at($1,$2,$3)",
                    row["id"],
                    token,
                    NOW,
                )
            )
            await wait_for_database_lock(observer, worker.get_server_pid())
            if change == "deadline":
                await locker.execute(
                    "update public.activity set due_at=$2 where id=$1",
                    activity,
                    NOW + timedelta(hours=3),
                )
            elif change == "preference":
                await locker.execute(
                    "update public.parent set email_notifications=false where id=$1",
                    family["parent"],
                )
            else:
                await locker.execute(
                    "select set_config('request.jwt.claims',$1,true)",
                    json.dumps({"role": "service_role", "sub": family["teacher"]}),
                )
                await locker.fetchval(
                    "select public.complete_student_submission($1,$2)",
                    family["teacher"],
                    submission["id"],
                )
            await transaction.commit()
            result = await task
            result = json.loads(result) if isinstance(result, str) else result
            expected = {
                "deadline": "deadline_changed",
                "preference": "preference_off",
                "completion": "event_obsolete",
            }[change]
            assert result == {"state": "skipped", "code": expected}
        finally:
            if task is not None and not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            if locker.is_in_transaction():
                await transaction.rollback()
            for connection in (locker, worker, observer):
                await connection.close()

    asyncio.run(exercise())
