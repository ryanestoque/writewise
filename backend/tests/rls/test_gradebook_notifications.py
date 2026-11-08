"""Excusing coursework suppresses reminder generation and both email send gates."""

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest

from app.core.supabase import supabase_client as admin
from tests.rls.email_support import authorize_at, prepare_at, processing_claim, seed_due_email
from tests.rls.gradebook_support import set_work
from tests.rls.notification_support import db_value, wait_for_database_lock

NOW = datetime(2030, 1, 1, 12, tzinfo=timezone.utc)


@pytest.mark.parametrize("offset", [timedelta(hours=2), timedelta(hours=-2)])
def test_excused_work_generates_no_due_or_missing_reminder(family, assigned_activity, offset):
    activity, student = assigned_activity["id"], family["students"][0]
    admin.table("activity").update({"due_at": (NOW + offset).isoformat()}).eq(
        "id", activity
    ).execute()
    set_work(family, activity, {"excused": True})
    db_value("select writewise_internal.enqueue_time_based_notifications_at($1)", NOW)
    assert (
        admin.table("notification")
        .select("id")
        .eq("activity_id", activity)
        .eq("student_id", student)
        .in_("type", ["due_soon", "activity_missing"])
        .execute()
        .data
        == []
    )
    set_work(family, activity, {"excused": False})
    db_value("select writewise_internal.enqueue_time_based_notifications_at($1)", NOW)
    first = (
        admin.table("notification")
        .select("id,read_at")
        .eq("activity_id", activity)
        .eq("student_id", student)
        .in_("type", ["due_soon", "activity_missing"])
        .execute()
        .data
    )
    assert len(first) == 1
    set_work(family, activity, {"excused": True})
    set_work(family, activity, {"excused": False})
    db_value("select writewise_internal.enqueue_time_based_notifications_at($1)", NOW)
    assert (
        admin.table("notification").select("id,read_at").eq("id", first[0]["id"]).execute().data
        == first
    )


@pytest.mark.parametrize("stage", ["prepare", "authorize"])
def test_excused_queued_email_is_skipped_before_sending(family, assigned_activity, stage):
    activity = assigned_activity["id"]
    row = seed_due_email(family, activity, NOW)
    token = processing_claim(row["id"], NOW)
    if stage == "authorize":
        ready = prepare_at(row["id"], token, NOW)
        assert ready["state"] == "ready"
    set_work(family, activity, {"excused": True})
    result = (
        prepare_at(row["id"], token, NOW)
        if stage == "prepare"
        else authorize_at(row["id"], token, ready["recipient"], "a" * 64, NOW)
    )
    assert result == {"state": "skipped", "code": "work_excused"}


def test_send_authorization_waiting_on_excuse_rechecks_after_activity_lock(
    family, assigned_activity
):
    activity, student = assigned_activity["id"], family["students"][0]
    row = seed_due_email(family, activity, NOW)
    token = processing_claim(row["id"], NOW)
    ready = prepare_at(row["id"], token, NOW)

    async def race():
        owner = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        waiter = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        task = None
        try:
            async with owner.transaction():
                await owner.fetchval(
                    "select id from public.activity where id=$1 for update", activity
                )
                task = asyncio.create_task(
                    waiter.fetchval(
                        "select writewise_internal.authorize_email_delivery_at($1,$2,$3,$4,$5)",
                        row["id"],
                        token,
                        ready["recipient"],
                        "a" * 64,
                        NOW,
                    )
                )
                await wait_for_database_lock(owner, waiter.get_server_pid())
                await owner.fetchval(
                    "select public.mutate_student_work($1,$2,$3,'update',$4::jsonb)",
                    family["teacher"],
                    activity,
                    student,
                    '{"excused":true}',
                )
            return json.loads(await task)
        finally:
            if task and not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            await owner.close()
            await waiter.close()

    assert asyncio.run(race()) == {"state": "skipped", "code": "work_excused"}
