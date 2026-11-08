"""Observed activity-lock waits prove stale publications cannot win lifecycle races."""

import asyncio
import json
import os
from uuid import uuid4

import asyncpg
import pytest

from app.core.supabase import supabase_client as admin
from tests.rls.gradebook_support import (
    configure_points,
    read_grade,
    release_work,
    set_work,
    stored_attempt,
)
from tests.rls.notification_support import wait_for_database_lock
from tests.rls.test_gradebook_lifecycle import complete


def test_bulk_zero_waits_for_completion_and_skips_new_counted_attempt(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    configure_points(family, activity, "20")
    admin.table("activity").update({"due_at": "2020-01-01T00:00:00Z"}).eq("id", activity).execute()
    source = stored_attempt(family, activity)
    admin.table("submission").update({"status": "processing"}).eq("id", source["id"]).execute()

    async def race():
        owner = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        waiter = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        task = None
        try:
            await waiter.execute(
                "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)"
            )
            async with owner.transaction():
                await owner.execute(
                    "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)"
                )
                await owner.fetchval(
                    "select id from public.activity where id=$1 for update", activity
                )
                task = asyncio.create_task(
                    waiter.fetchval(
                        "select public.assign_zero_missing($1,$2,$3::uuid[])",
                        family["teacher"],
                        activity,
                        [student],
                    )
                )
                await wait_for_database_lock(owner, waiter.get_server_pid())
                await owner.fetchval(
                    "select public.complete_student_submission($1,$2)",
                    family["teacher"],
                    source["id"],
                )
            return json.loads(await task)
        finally:
            if task and not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            await owner.close()
            await waiter.close()

    try:
        assert asyncio.run(race()) == {"changed_student_ids": [], "skipped_student_ids": [student]}
        assert read_grade(family["teacher_client"], activity, student)[0]["points_override"] is None
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()


@pytest.mark.parametrize("change", ["override", "points", "pin", "return", "complete", "delete"])
def test_release_waiting_for_a_changed_work_revision_cannot_publish_old_state(
    family, assigned_activity, change
):
    activity, student = assigned_activity["id"], family["students"][0]
    configure_points(family, activity, "20")
    try:
        source = complete(family, activity, created_at="2020-01-01T00:00:00Z")
        set_work(family, activity, {"points_override": "5"})
        old = read_grade(family["teacher_client"], activity, student)[0]
        release_work(family, activity, student, old["revision"])
        another = None
        if change in ("pin", "complete"):
            another = stored_attempt(
                family,
                activity,
                created_at="2019-01-01T00:00:00Z" if change == "pin" else "2021-01-01T00:00:00Z",
            )
            if change == "complete":
                admin.table("submission").update({"status": "processing"}).eq(
                    "id", another["id"]
                ).execute()

        async def race():
            owner = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
            waiter = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
            task = None
            try:
                await waiter.execute(
                    "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)"
                )
                async with owner.transaction():
                    await owner.execute(
                        "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)"
                    )
                    await owner.fetchval(
                        "select id from public.activity where id=$1 for update", activity
                    )
                    task = asyncio.create_task(
                        waiter.fetchval(
                            "select public.release_student_work_grade($1,$2,$3,$4)",
                            family["teacher"],
                            activity,
                            student,
                            old["revision"],
                        )
                    )
                    await wait_for_database_lock(owner, waiter.get_server_pid())
                    if change in ("override", "pin", "return"):
                        payload = (
                            '{"points_override":"7"}'
                            if change == "override"
                            else (
                                '{"pinned_submission_id":"' + another["id"] + '"}'
                                if change == "pin"
                                else '{"submission_id":"'
                                + source["id"]
                                + '","reason":"incomplete"}'
                            )
                        )
                        await owner.fetchval(
                            "select public.mutate_student_work($1,$2,$3,$4,$5::jsonb)",
                            family["teacher"],
                            activity,
                            student,
                            "return" if change == "return" else "update",
                            payload,
                        )
                    elif change == "points":
                        await owner.fetchval(
                            "select public.update_assigned_activity($1,$2,$3::jsonb)",
                            family["teacher"],
                            activity,
                            '{"points_possible":"30"}',
                        )
                    elif change == "complete":
                        await owner.fetchval(
                            "select public.complete_student_submission($1,$2)",
                            family["teacher"],
                            another["id"],
                        )
                    else:
                        await owner.fetchval(
                            "select public.delete_student_submissions($1,$2::uuid[])",
                            family["teacher"],
                            [source["id"]],
                        )
                with pytest.raises(asyncpg.PostgresError) as failure:
                    await task
                assert failure.value.sqlstate == "WW431"
            finally:
                if task and not task.done():
                    task.cancel()
                    await asyncio.gather(task, return_exceptions=True)
                await owner.close()
                await waiter.close()

        asyncio.run(race())
        assert read_grade(family["parent_client"], activity, student) == []
        current = read_grade(family["teacher_client"], activity, student)[0]
        assert current["revision"] > old["revision"]
        assert current["points_override"] == (7 if change == "override" else 5)
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()


def test_failed_grade_event_rolls_back_both_rubric_and_points_publication(
    family, assigned_activity
):
    activity, student = assigned_activity["id"], family["students"][0]
    configure_points(family, activity, "20")
    try:
        source = complete(family, activity)
        revision = read_grade(family["teacher_client"], activity, student)[0]["revision"]

        async def failed_publish():
            connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
            try:
                with pytest.raises(asyncpg.PostgresError):
                    async with connection.transaction():
                        await connection.execute(
                            "select set_config('request.jwt.claims',"
                            '\'{"role":"service_role"}\',true)'
                        )
                        await connection.execute(
                            "create function pg_temp.reject_grade_notice() returns trigger "
                            "language plpgsql as $$ begin if new.type='score_released' then "
                            "raise exception 'synthetic event failure'; end if; return new; end; $$"
                        )
                        name = "test_grade_event_" + uuid4().hex
                        await connection.execute(
                            f"create trigger {name} before insert on public.notification "
                            "for each row execute function pg_temp.reject_grade_notice()"
                        )
                        await connection.fetchval(
                            "select public.release_student_work_grade($1,$2,$3,$4)",
                            family["teacher"],
                            activity,
                            student,
                            revision,
                        )
            finally:
                await connection.close()

        asyncio.run(failed_publish())
        assert read_grade(family["teacher_client"], activity, student)[0]["released_at"] is None
        assert (
            admin.table("submission")
            .select("released_at")
            .eq("id", source["id"])
            .single()
            .execute()
            .data["released_at"]
            is None
        )
        assert (
            admin.table("notification")
            .select("id")
            .eq("activity_id", activity)
            .eq("type", "score_released")
            .execute()
            .data
            == []
        )
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()
