"""Signed-in recipient isolation and atomic notification delivery receipts."""

import asyncio
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import asyncpg
import pytest
from postgrest.exceptions import APIError
from supabase import create_client

from app.core.supabase import supabase_client as admin


def seed_notice(family, activity, recipient=None):
    return (
        admin.table("notification")
        .insert(
            {
                "recipient_id": recipient or family["parent"],
                "type": "activity_assigned",
                "activity_id": activity,
                "student_id": family["students"][0],
                "dedupe_key": f"fixture:{uuid4()}",
            }
        )
        .execute()
        .data[0]
    )


def db_value(query, *parameters):
    async def execute():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        try:
            return await connection.fetchval(query, *parameters)
        finally:
            await connection.close()

    return asyncio.run(execute())


def test_recipient_reads_only_own_rows_and_count(family, assigned_activity):
    own = seed_notice(family, assigned_activity["id"])
    other = seed_notice(family, assigned_activity["id"], family["other_parent"])
    ids = [own["id"], other["id"]]
    response = (
        family["parent_client"]
        .table("notification")
        .select("id", count="exact")
        .in_("id", ids)
        .execute()
    )
    assert response.data == [{"id": own["id"]}]
    assert response.count == 1
    assert (
        family["teacher_client"].table("notification").select("id").in_("id", ids).execute().data
        == []
    )
    assert family["other_parent_client"].table("notification").select("id").in_(
        "id", ids
    ).execute().data == [{"id": other["id"]}]


@pytest.mark.parametrize("operation", ["insert", "update", "delete"])
def test_browser_cannot_mutate_notifications(family, assigned_activity, operation):
    notice = seed_notice(family, assigned_activity["id"])
    table = family["parent_client"].table("notification")
    with pytest.raises(APIError):
        if operation == "insert":
            table.insert({**notice, "id": str(uuid4()), "dedupe_key": str(uuid4())}).execute()
        elif operation == "update":
            table.update({"read_at": "2030-01-01T00:00:00Z"}).eq("id", notice["id"]).execute()
        else:
            table.delete().eq("id", notice["id"]).execute()
    assert admin.table("notification").select("read_at").eq("id", notice["id"]).execute().data == [
        {"read_at": None}
    ]


def test_anonymous_and_private_schema_access_denied(family, assigned_activity):
    notice = seed_notice(family, assigned_activity["id"])
    anonymous = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    with pytest.raises(APIError):
        anonymous.table("notification").select("id").eq("id", notice["id"]).execute()
    with pytest.raises(APIError):
        family["parent_client"].schema("writewise_internal").table("notification_delivery").select(
            "dedupe_key"
        ).execute()
    assert not db_value(
        "select has_function_privilege('authenticated', "
        "'writewise_internal.put_notification(uuid,public.notification_type,uuid,uuid,uuid,text)', "
        "'EXECUTE')"
    )


def test_epoch_key_preserves_microseconds_and_timezone():
    stamp = datetime(2030, 1, 1, microsecond=123456, tzinfo=timezone.utc)
    query = "select writewise_internal.notification_epoch_us($1)"
    assert db_value(query, stamp) == "1893456000123456"
    assert db_value(query, stamp.astimezone(timezone(timedelta(hours=8)))) == "1893456000123456"
    assert db_value(query, stamp + timedelta(microseconds=1)) == "1893456000123457"


def test_fanout_is_atomic_and_idempotent(family, assigned_activity, second_parent):
    identity = str(uuid4())
    query = "select writewise_internal.notify_work_parents('activity_assigned', $1, $2, null, $3)"
    assert db_value(query, assigned_activity["id"], family["students"][0], identity) == 2
    assert db_value(query, assigned_activity["id"], family["students"][0], identity) == 0
    rows = (
        admin.table("notification")
        .select("recipient_id")
        .eq("activity_id", assigned_activity["id"])
        .like("dedupe_key", f"%:{identity}")
        .execute()
        .data
    )
    assert {row["recipient_id"] for row in rows} == {family["parent"], second_parent["id"]}


def test_failed_notice_rolls_back_delivery_claim(family, assigned_activity):
    key = f"rollback:{uuid4()}"

    async def exercise():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        transaction = connection.transaction()
        await transaction.start()
        try:
            await connection.execute(
                "create function pg_temp.fail_notice() returns trigger language plpgsql as $$ "
                "begin raise exception 'synthetic failure'; end $$; "
                "create trigger fail_notice before insert on public.notification "
                "for each row execute function pg_temp.fail_notice()"
            )
            with pytest.raises(asyncpg.PostgresError):
                async with connection.transaction():
                    await connection.fetchval(
                        "select writewise_internal.put_notification($1,'activity_assigned',"
                        "$2,$3,null,$4)",
                        family["parent"],
                        assigned_activity["id"],
                        family["students"][0],
                        key,
                    )
            assert (
                await connection.fetchval(
                    "select count(*) from writewise_internal.notification_delivery "
                    "where dedupe_key=$1",
                    key,
                )
                == 0
            )
        finally:
            await transaction.rollback()
            await connection.close()

    asyncio.run(exercise())


def test_delivery_survives_submission_deletion(family, assigned_activity):
    activity = assigned_activity["id"]
    student = family["students"][0]
    key = f"resubmitted_after_return:{uuid4()}"
    query = "select writewise_internal.put_notification($1,'resubmitted_after_return',$2,$3,$4,$5)"
    ids = []
    try:
        for index in range(2):
            submission = (
                admin.table("submission")
                .insert(
                    {
                        "activity_id": activity,
                        "student_id": student,
                        "image_path": f"{student}/{uuid4()}.jpg",
                        "status": "completed",
                        "uploader_id": family["teacher"],
                        "uploader_role": "teacher",
                    }
                )
                .execute()
                .data[0]["id"]
            )
            ids.append(submission)
            inserted = db_value(query, family["teacher"], activity, student, submission, key)
            if index == 0:
                assert inserted is not None
                admin.table("submission").delete().eq("id", submission).execute()
            else:
                assert inserted is None
        assert admin.table("notification").select("id").eq("dedupe_key", key).execute().data == []
        assert (
            db_value(
                "select count(*) from writewise_internal.notification_delivery where dedupe_key=$1",
                key,
            )
            == 1
        )
    finally:
        admin.table("submission").delete().in_("id", ids).execute()
