"""Fixed-clock sweeps run as the cron/database owner without an application JWT."""

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

from app.core.supabase import supabase_client as admin
from tests.rls.notification_support import db_value, wait_for_database_lock

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
@pytest.mark.parametrize("take_home", [True, False])
def test_exact_deadline_boundaries_without_jwt(
    family, assigned_activity, offset, soon, missing, take_home
):
    activity, student = assigned_activity["id"], family["students"][0]
    admin.table("activity").update(
        {"due_at": (NOW + offset).isoformat(), "is_take_home": take_home}
    ).eq("id", activity).execute()
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


@pytest.mark.parametrize("change", ["completion", "deadline", "override"])
def test_change_committed_before_sweep_lock_suppresses_reminder(family, assigned_activity, change):
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

    async def exercise():
        locker, worker, observer = [
            await asyncpg.connect(os.environ["SUPABASE_DB_URL"]) for _ in range(3)
        ]
        transaction = locker.transaction()
        await transaction.start()
        task = None
        try:
            await locker.execute("select id from public.activity where id=$1 for update", activity)
            task = asyncio.create_task(worker.fetchval(SWEEP, NOW))
            await wait_for_database_lock(observer, worker.get_server_pid())
            if change == "completion":
                await locker.fetchval(
                    "select public.complete_student_submission($1,$2)",
                    family["teacher"],
                    submission,
                )
            elif change == "deadline":
                await locker.execute(
                    "update public.activity set due_at=$2 where id=$1",
                    activity,
                    NOW + timedelta(hours=48),
                )
            else:
                await locker.fetchval(
                    "select public.mutate_student_work($1,$2,$3,'update',$4::jsonb)",
                    family["teacher"],
                    activity,
                    student,
                    json.dumps({"due_at_override": (NOW + timedelta(hours=48)).isoformat()}),
                )
            await transaction.commit()
            await task
            assert count(activity, student, "due_soon") == 0
        finally:
            if task and not task.done():
                task.cancel()
            if locker.is_in_transaction():
                await transaction.rollback()
            for connection in (locker, worker, observer):
                await connection.close()

    try:
        asyncio.run(exercise())
    finally:
        admin.table("submission").delete().eq("id", submission).execute()
