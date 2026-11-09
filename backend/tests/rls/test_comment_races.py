"""Observed database locks establish posting/read races without timing guesses."""

import asyncio
import json
import os

import asyncpg
import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin
from tests.rls.comment_support import post_comment, seed_comment
from tests.rls.notification_support import wait_for_database_lock


def notice_for(family, activity):
    return (
        admin.table("notification")
        .select("id,comment_version,read_at")
        .eq("activity_id", activity)
        .eq("recipient_id", family["parent"])
        .eq("type", "comment_posted")
        .is_("read_at", "null")
        .single()
        .execute()
        .data
    )


def mark(family, notice, version):
    return (
        admin.rpc(
            "mark_comment_notification_read",
            {
                "actor_id": family["parent"],
                "target_notification_id": notice,
                "expected_comment_version": version,
            },
        )
        .execute()
        .data
    )


def test_version_guard_is_required_even_for_seeded_comment_notice(family, assigned_activity):
    activity = assigned_activity["id"]
    comment = seed_comment(family, activity)
    notice = (
        admin.table("notification")
        .insert(
            {
                "recipient_id": family["parent"],
                "type": "comment_posted",
                "activity_id": activity,
                "student_id": family["students"][0],
                "dedupe_key": "comment:seed:" + comment["id"],
                "comment_version": 1,
            }
        )
        .execute()
        .data[0]
    )
    with pytest.raises(APIError) as failure:
        admin.rpc(
            "mark_notification_read",
            {
                "actor_id": family["parent"],
                "target_notification_id": notice["id"],
            },
        ).execute()
    assert failure.value.code == "WW422"
    first = mark(family, notice["id"], 1)
    assert mark(family, notice["id"], 1) == first


def test_stale_read_cannot_clear_coalesced_newer_comment(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    post_comment(family["teacher"], activity, student)
    old = notice_for(family, activity)
    post_comment(family["teacher"], activity, student)
    with pytest.raises(APIError) as failure:
        mark(family, old["id"], old["comment_version"])
    assert failure.value.code == "WW442"
    current = notice_for(family, activity)
    assert current["id"] == old["id"] and current["comment_version"] == 2
    first = mark(family, old["id"], 2)
    assert mark(family, old["id"], 2) == first
    post_comment(family["teacher"], activity, student)
    assert notice_for(family, activity)["id"] != old["id"]


async def connections():
    owner = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
    try:
        waiter = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
    except BaseException:
        await owner.close()
        raise
    await waiter.execute(
        "select set_config('request.jwt.claims',$1,false)", json.dumps({"role": "service_role"})
    )
    await owner.execute(
        "select set_config('request.jwt.claims',$1,false)", json.dumps({"role": "service_role"})
    )
    return owner, waiter


async def finish(owner, waiter, task):
    if task and not task.done():
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
    await owner.close()
    await waiter.close()


def test_all_read_snapshot_does_not_swallow_a_waiting_coalesced_version(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    # Assignment creation legitimately has an ordinary unread notice. Isolate the
    # coalesced-comment count without weakening the unread-version assertion.
    admin.rpc("mark_all_notifications_read", {"actor_id": family["parent"]}).execute()
    post_comment(family["teacher"], activity, student)

    async def race():
        owner, waiter = await connections()
        task = None
        try:
            async with owner.transaction():
                await owner.fetchval(
                    "select id from public.activity where id=$1::uuid for update", activity
                )
                await owner.fetchval(
                    "select public.post_private_comment($1::uuid,$2::uuid,$3::uuid,$4)",
                    family["teacher"],
                    activity,
                    student,
                    "Synthetic concurrent reply",
                )
                task = asyncio.create_task(
                    waiter.fetchval(
                        "select public.mark_all_notifications_read($1::uuid)", family["parent"]
                    )
                )
                await wait_for_database_lock(owner, waiter.get_server_pid())
            return json.loads(await task)
        finally:
            await finish(owner, waiter, task)

    result = asyncio.run(race())
    assert result["updated_count"] == 0
    assert notice_for(family, activity)["comment_version"] == 2


@pytest.mark.parametrize(
    "change,code",
    [
        ("lock", "WW440"),
        ("archive", "WW441"),
        ("section", "WW412"),
        ("targets", "WW412"),
        ("unlink", "WW404"),
        ("roster", "WW412"),
    ],
)
def test_post_observes_changes_committed_while_waiting_for_activity(
    family, assigned_activity, change, code
):
    activity, student = assigned_activity["id"], family["students"][0]
    # Existing history makes assignment removal readable, but never writable.
    seed_comment(family, activity)

    async def race():
        owner, waiter = await connections()
        task = None
        try:
            async with owner.transaction():
                await owner.fetchval(
                    "select id from public.activity where id=$1::uuid for update", activity
                )
                task = asyncio.create_task(
                    waiter.fetchval(
                        "select public.post_private_comment($1::uuid,$2::uuid,$3::uuid,$4)",
                        family["parent"],
                        activity,
                        student,
                        "Synthetic blocked reply",
                    )
                )
                await wait_for_database_lock(owner, waiter.get_server_pid())
                if change == "lock":
                    await owner.execute(
                        "update public.student_work set comments_locked=true "
                        "where activity_id=$1::uuid and student_id=$2::uuid",
                        activity,
                        student,
                    )
                elif change == "archive":
                    await owner.execute(
                        "update public.activity set is_archived=true where id=$1::uuid", activity
                    )
                elif change == "section":
                    await owner.execute(
                        "update public.student set section_id=$1::uuid where id=$2::uuid",
                        family["sections"][1],
                        student,
                    )
                elif change == "targets":
                    await owner.execute(
                        "delete from public.activity_assignment where activity_id=$1::uuid",
                        activity,
                    )
                elif change == "unlink":
                    await owner.execute(
                        "delete from public.student_parent "
                        "where student_id=$1::uuid and parent_id=$2::uuid",
                        student,
                        family["parent"],
                    )
                else:
                    await owner.execute(
                        "delete from public.teacher_student "
                        "where student_id=$1::uuid and teacher_id=$2::uuid",
                        student,
                        family["teacher"],
                    )
            with pytest.raises(asyncpg.PostgresError) as failure:
                await task
            assert failure.value.sqlstate == code
        finally:
            await finish(owner, waiter, task)

    try:
        asyncio.run(race())
    finally:
        if change == "section":
            admin.table("student").update({"section_id": family["sections"][0]}).eq(
                "id", student
            ).execute()
        elif change == "unlink":
            admin.table("student_parent").upsert(
                {"student_id": student, "parent_id": family["parent"]}
            ).execute()
        elif change == "roster":
            admin.table("teacher_student").upsert(
                {"student_id": student, "teacher_id": family["teacher"]}
            ).execute()


def test_simultaneous_posts_get_distinct_monotonic_versions(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]

    async def race():
        owner, waiter = await connections()
        try:
            results = await asyncio.gather(
                *[
                    connection.fetchval(
                        "select public.post_private_comment($1::uuid,$2::uuid,$3::uuid,$4)",
                        family["teacher"],
                        activity,
                        student,
                        "Synthetic parallel reply",
                    )
                    for connection in (owner, waiter)
                ]
            )
            return [json.loads(result)["comment_version"] for result in results]
        finally:
            await finish(owner, waiter, None)

    assert sorted(asyncio.run(race())) == [1, 2]
    assert notice_for(family, activity)["comment_version"] == 2


def test_teacher_post_excludes_parent_unlinked_before_its_gate(
    family, assigned_activity, second_parent
):
    activity, student = assigned_activity["id"], family["students"][0]

    async def race():
        owner, waiter = await connections()
        task = None
        try:
            async with owner.transaction():
                await owner.fetchval(
                    "select id from public.activity where id=$1::uuid for update", activity
                )
                task = asyncio.create_task(
                    waiter.fetchval(
                        "select public.post_private_comment($1::uuid,$2::uuid,$3::uuid,$4)",
                        family["teacher"],
                        activity,
                        student,
                        "Synthetic recipient snapshot",
                    )
                )
                await wait_for_database_lock(owner, waiter.get_server_pid())
                await owner.execute(
                    "delete from public.student_parent "
                    "where parent_id=$1::uuid and student_id=$2::uuid",
                    family["parent"],
                    student,
                )
            assert json.loads(await task)["author_role"] == "teacher"
        finally:
            await finish(owner, waiter, task)

    try:
        asyncio.run(race())
        rows = (
            admin.table("notification")
            .select("recipient_id")
            .eq("activity_id", activity)
            .eq("type", "comment_posted")
            .execute()
            .data
        )
        assert rows == [{"recipient_id": second_parent["id"]}]
    finally:
        admin.table("student_parent").upsert(
            {
                "parent_id": family["parent"],
                "student_id": student,
            }
        ).execute()


@pytest.mark.parametrize("first", ["post", "read"])
def test_single_read_and_coalescing_preserve_unread_in_both_observed_lock_orders(
    family, assigned_activity, first
):
    activity, student = assigned_activity["id"], family["students"][0]
    post_comment(family["teacher"], activity, student)
    old = notice_for(family, activity)

    async def race():
        owner, waiter = await connections()
        task = None
        try:
            async with owner.transaction():
                if first == "post":
                    await owner.fetchval(
                        "select public.post_private_comment($1::uuid,$2::uuid,$3::uuid,$4)",
                        family["teacher"],
                        activity,
                        student,
                        "Synthetic held post",
                    )
                    task = asyncio.create_task(
                        waiter.fetchval(
                            "select public.mark_comment_notification_read($1::uuid,$2::uuid,1)",
                            family["parent"],
                            old["id"],
                        )
                    )
                else:
                    await owner.fetchval(
                        "select public.mark_comment_notification_read($1::uuid,$2::uuid,1)",
                        family["parent"],
                        old["id"],
                    )
                    task = asyncio.create_task(
                        waiter.fetchval(
                            "select public.post_private_comment($1::uuid,$2::uuid,$3::uuid,$4)",
                            family["teacher"],
                            activity,
                            student,
                            "Synthetic waiting post",
                        )
                    )
                await wait_for_database_lock(owner, waiter.get_server_pid())
            if first == "post":
                with pytest.raises(asyncpg.PostgresError) as failure:
                    await task
                assert failure.value.sqlstate == "WW442"
            else:
                assert json.loads(await task)["comment_version"] == 2
        finally:
            await finish(owner, waiter, task)

    asyncio.run(race())
    current = notice_for(family, activity)
    assert current["comment_version"] == 2 and current["read_at"] is None
    assert (current["id"] == old["id"]) is (first == "post")
