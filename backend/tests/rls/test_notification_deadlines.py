"""Fixed-clock sweeps run as the cron/database owner without an application JWT."""

import asyncio
import os
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

from app.core.supabase import supabase_client as admin
from tests.rls.notification_support import db_value

NOW = datetime(2030, 1, 1, 12, tzinfo=timezone.utc)
SWEEP = "select writewise_internal.enqueue_time_based_notifications_at($1)"


def count(activity, student, kind):
    return len(
        admin.table("notification")
        .select("id")
        .eq("activity_id", activity)
        .eq("student_id", student)
        .eq("type", kind)
        .execute()
        .data
    )


@pytest.mark.parametrize(
    "offset,soon,missing",
    [
        (timedelta(hours=24), 1, 0),
        (timedelta(hours=24, microseconds=1), 0, 0),
        (timedelta(0), 1, 0),
        (timedelta(microseconds=-1), 0, 1),
    ],
)
def test_exact_deadline_boundaries_without_jwt(family, assigned_activity, offset, soon, missing):
    activity, student = assigned_activity["id"], family["students"][0]
    admin.table("activity").update({"due_at": (NOW + offset).isoformat()}).eq(
        "id", activity
    ).execute()
    db_value(SWEEP, NOW)
    db_value(SWEEP, NOW)
    assert count(activity, student, "due_soon") == soon
    assert count(activity, student, "activity_missing") == missing
    assert (
        admin.table("student_work").select("student_id").eq("activity_id", activity).execute().data
        == []
    )


def test_changed_override_rearms_but_restored_deadline_does_not(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    due = NOW + timedelta(hours=2)
    admin.table("activity").update({"due_at": due.isoformat()}).eq("id", activity).execute()
    db_value(SWEEP, NOW)
    assert count(activity, student, "due_soon") == 1
    for override in [due + timedelta(microseconds=1), None]:
        admin.rpc(
            "mutate_student_work",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
                "target_student_id": student,
                "operation": "update",
                "payload": {"due_at_override": override.isoformat() if override else None},
            },
        ).execute()
        db_value(SWEEP, NOW)
        assert count(activity, student, "due_soon") == 2


def test_archived_unassigned_and_null_due_are_excluded(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    db_value(SWEEP, NOW)
    assert count(activity, student, "due_soon") == 0
    admin.table("activity").update({"due_at": NOW.isoformat(), "is_archived": True}).eq(
        "id", activity
    ).execute()
    db_value(SWEEP, NOW)
    assert count(activity, student, "due_soon") == 0
    admin.table("activity").update({"is_archived": False}).eq("id", activity).execute()
    admin.rpc(
        "update_assigned_activity",
        {
            "actor_id": family["teacher"],
            "target_activity_id": activity,
            "payload": {"assignments": [{"student_id": family["students"][2]}]},
        },
    ).execute()
    db_value(SWEEP, NOW)
    assert count(activity, student, "due_soon") == 0
    assert count(activity, family["students"][2], "due_soon") == 1


def test_only_completed_active_attempt_suppresses_reminders(family, assigned_activity):
    from uuid import uuid4

    activity, student = assigned_activity["id"], family["students"][0]
    admin.table("activity").update({"due_at": NOW.isoformat()}).eq("id", activity).execute()
    submission = (
        admin.table("submission")
        .insert(
            {
                "activity_id": activity,
                "student_id": student,
                "image_path": f"{student}/{uuid4()}.jpg",
                "status": "processing",
                "uploader_id": family["teacher"],
                "uploader_role": "teacher",
            }
        )
        .execute()
        .data[0]["id"]
    )
    try:
        db_value(SWEEP, NOW)
        assert count(activity, student, "due_soon") == 1
        admin.rpc(
            "complete_student_submission",
            {
                "actor_id": family["teacher"],
                "target_submission_id": submission,
            },
        ).execute()
        db_value(SWEEP, NOW + timedelta(microseconds=1))
        assert count(activity, student, "activity_missing") == 0
    finally:
        admin.table("submission").delete().eq("id", submission).execute()


def test_concurrent_sweeps_insert_once(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    admin.table("activity").update({"due_at": NOW.isoformat()}).eq("id", activity).execute()

    async def exercise():
        connections = [await asyncpg.connect(os.environ["SUPABASE_DB_URL"]) for _ in range(2)]
        try:
            await asyncio.gather(*(connection.fetchval(SWEEP, NOW) for connection in connections))
        finally:
            for connection in connections:
                await connection.close()

    asyncio.run(exercise())
    assert count(activity, student, "due_soon") == 1


def test_one_named_private_cron_job():
    assert (
        db_value(
            "select count(*) from cron.job where jobname='writewise-deadline-notifications' "
            "and schedule='*/15 * * * *' "
            "and command='select writewise_internal.enqueue_time_based_notifications();'"
        )
        == 1
    )
    assert not db_value(
        "select has_function_privilege('authenticated', "
        "'writewise_internal.enqueue_time_based_notifications()', 'EXECUTE')"
    )
