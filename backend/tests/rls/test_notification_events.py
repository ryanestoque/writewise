"""Events are emitted by the actual transactional coursework RPCs."""

import asyncio
import json
import os
from datetime import datetime, timezone
from uuid import uuid4

import asyncpg
import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin
from tests.rls.notification_support import wait_for_database_lock


def notices(activity, kind, student=None):
    query = admin.table("notification").select("*").eq("activity_id", activity).eq("type", kind)
    if student:
        query = query.eq("student_id", student)
    return query.execute().data


def update_targets(family, activity, targets):
    return (
        admin.rpc(
            "update_assigned_activity",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
                "payload": {"assignments": targets},
            },
        )
        .execute()
        .data
    )


def work(family, activity, submission, operation, **extra):
    return (
        admin.rpc(
            "mutate_student_work",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
                "target_student_id": family["students"][0],
                "operation": operation,
                "payload": {"submission_id": submission, **extra},
            },
        )
        .execute()
        .data
    )


def record(family, activity, role="parent", status="processing"):
    submission = str(uuid4())
    actor = family["parent"] if role == "parent" else family["teacher"]
    return (
        admin.rpc(
            "record_student_submission",
            {
                "actor_id": actor,
                "target_activity_id": activity,
                "target_student_id": family["students"][0],
                "payload": {
                    "id": submission,
                    "image_path": f"{family['students'][0]}/{submission}.jpg",
                    "uploader_role": role,
                    "status": status,
                    "rejection_code": "IMAGE_TOO_BLURRY" if status == "rejected" else None,
                    "accepted_at": datetime.now(timezone.utc).isoformat(),
                },
            },
        )
        .execute()
        .data
    )


def complete(family, submission):
    return (
        admin.rpc(
            "complete_student_submission",
            {
                "actor_id": submission["uploader_id"],
                "target_submission_id": submission["id"],
            },
        )
        .execute()
        .data
    )


@pytest.fixture
def event_activity(family, assigned_activity):
    activity = assigned_activity["id"]
    yield activity
    admin.table("submission").delete().eq("activity_id", activity).execute()


def test_assignment_targets_are_deduplicated_and_unchanged_edit_is_silent(
    family, assigned_activity
):
    activity = assigned_activity["id"]
    student = family["students"][0]
    initial = notices(activity, "activity_assigned", student)
    assert len(initial) == 1
    targets = [
        {"section_id": family["sections"][0]},
        {"student_id": student},
        {"student_id": family["students"][2]},
    ]
    update_targets(family, activity, targets)
    assert [row["id"] for row in notices(activity, "activity_assigned", student)] == [
        initial[0]["id"]
    ]
    update_targets(family, activity, [{"student_id": family["students"][2]}])
    update_targets(family, activity, targets)
    assert len(notices(activity, "activity_assigned", student)) == 2
    update_targets(family, activity, targets)
    assert len(notices(activity, "activity_assigned", student)) == 2


def test_assignment_fans_out_to_all_current_parents(family, second_parent, assigned_activity):
    activity = assigned_activity["id"]
    update_targets(family, activity, [{"student_id": family["students"][2]}])
    update_targets(family, activity, [{"student_id": family["students"][0]}])
    recipients = {row["recipient_id"] for row in notices(activity, "activity_assigned")}
    assert {family["parent"], family["other_parent"], second_parent["id"]} <= recipients


def test_roster_move_and_parent_link_do_not_emit_assignment(
    family, assigned_activity, second_parent
):
    activity = assigned_activity["id"]
    before = {row["id"] for row in notices(activity, "activity_assigned")}
    student = family["students"][1]
    try:
        admin.table("student").update({"section_id": family["sections"][0]}).eq(
            "id", student
        ).execute()
        assert {row["id"] for row in notices(activity, "activity_assigned")} == before
    finally:
        admin.table("student").update({"section_id": family["sections"][1]}).eq(
            "id", student
        ).execute()


def test_invalid_assignment_rolls_back_events(family, assigned_activity):
    activity = assigned_activity["id"]
    before = {row["id"] for row in notices(activity, "activity_assigned")}
    with pytest.raises(APIError):
        update_targets(family, activity, [{"section_id": family["sections"][2]}])
    assert {row["id"] for row in notices(activity, "activity_assigned")} == before


def test_parent_rejection_is_uploader_only_and_not_resubmitted(
    family, second_parent, event_activity
):
    rejected = record(family, event_activity, status="rejected")
    rows = notices(event_activity, "submission_rejected")
    assert [(row["recipient_id"], row["submission_id"]) for row in rows] == [
        (family["parent"], rejected["id"])
    ]
    assert notices(event_activity, "resubmitted_after_return") == []
    record(family, event_activity, role="teacher", status="rejected")
    assert len(notices(event_activity, "submission_rejected")) == 1


def test_return_retry_completion_and_deletion_dedupe(family, second_parent, event_activity):
    initial = complete(family, record(family, event_activity, role="teacher"))
    work(family, event_activity, initial["id"], "return", reason="incomplete")
    returned = notices(event_activity, "submission_returned")
    assert {(row["recipient_id"], row["submission_id"]) for row in returned} == {
        (family["parent"], initial["id"]),
        (second_parent["id"], initial["id"]),
    }
    record(family, event_activity, status="rejected")
    assert notices(event_activity, "resubmitted_after_return") == []
    retry = complete(family, record(family, event_activity))
    emitted = notices(event_activity, "resubmitted_after_return")
    assert [(row["recipient_id"], row["submission_id"]) for row in emitted] == [
        (family["teacher"], retry["id"])
    ]
    admin.table("submission").delete().eq("id", retry["id"]).execute()
    second = complete(family, record({**family, "parent": second_parent["id"]}, event_activity))
    assert notices(event_activity, "resubmitted_after_return") == []
    work(family, event_activity, second["id"], "return", reason="incomplete")
    third = complete(family, record(family, event_activity))
    assert [
        row["submission_id"] for row in notices(event_activity, "resubmitted_after_return")
    ] == [third["id"]]


def test_ordinary_or_teacher_upload_does_not_emit_resubmission(family, event_activity):
    first = complete(family, record(family, event_activity))
    assert notices(event_activity, "resubmitted_after_return") == []
    work(family, event_activity, first["id"], "return", reason="incomplete")
    complete(family, record(family, event_activity, role="teacher"))
    assert notices(event_activity, "resubmitted_after_return") == []


def test_release_retry_and_redraft_release(family, event_activity, second_parent):
    submission = complete(family, record(family, event_activity, role="teacher"))
    admin.table("measurement").insert(
        {
            "submission_id": submission["id"],
            "raw_output": {},
            "letter_formation_score": 80,
            "size_consistency_score": 80,
            "spacing_score": 80,
            "slant_score": 80,
            "baseline_alignment_score": 80,
        }
    ).execute()
    first = work(family, event_activity, submission["id"], "release")
    again = work(family, event_activity, submission["id"], "release")
    assert first["released_at"] == again["released_at"]
    rows = notices(event_activity, "score_released")
    assert {row["recipient_id"] for row in rows} == {family["parent"], second_parent["id"]}
    assert len(rows) == 2
    admin.rpc(
        "save_manual_submission_score",
        {
            "actor_id": family["teacher"],
            "target_submission_id": submission["id"],
            "payload": {
                f"{criterion}_band": "satisfactory"
                for criterion in (
                    "letter_formation",
                    "size_consistency",
                    "spacing",
                    "slant",
                    "baseline_alignment",
                )
            },
        },
    ).execute()
    assert (
        family["parent_client"]
        .table("measurement")
        .select("id")
        .eq("submission_id", submission["id"])
        .execute()
        .data
        == []
    )
    work(family, event_activity, submission["id"], "release")
    assert len(notices(event_activity, "score_released")) == 4


def test_bulk_release_uses_single_emitter_and_retry_is_silent(
    family, event_activity, second_parent
):
    submission = complete(family, record(family, event_activity, role="teacher"))
    admin.table("measurement").insert(
        {
            "submission_id": submission["id"],
            "raw_output": {},
            **{
                f"{criterion}_score": 80
                for criterion in (
                    "letter_formation",
                    "size_consistency",
                    "spacing",
                    "slant",
                    "baseline_alignment",
                )
            },
        }
    ).execute()
    parameters = {"actor_id": family["teacher"], "target_activity_id": event_activity}
    assert admin.rpc("release_activity_results", parameters).execute().data["released_count"] == 1
    assert admin.rpc("release_activity_results", parameters).execute().data["released_count"] == 0
    rows = notices(event_activity, "score_released")
    assert len(rows) == 2
    assert {row["recipient_id"] for row in rows} == {family["parent"], second_parent["id"]}


def test_explicit_pin_prevents_false_resubmission(family, event_activity):
    first = complete(family, record(family, event_activity))
    second = complete(family, record(family, event_activity))
    work(family, event_activity, second["id"], "return", reason="incomplete")
    admin.rpc(
        "mutate_student_work",
        {
            "actor_id": family["teacher"],
            "target_activity_id": event_activity,
            "target_student_id": family["students"][0],
            "operation": "update",
            "payload": {"pinned_submission_id": first["id"]},
        },
    ).execute()
    complete(family, record(family, event_activity))
    assert notices(event_activity, "resubmitted_after_return") == []


def test_return_notice_failure_rolls_back_work_and_delivery(family, event_activity):
    submission = complete(family, record(family, event_activity, role="teacher"))

    async def exercise():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        transaction = connection.transaction()
        await transaction.start()
        try:
            await connection.execute(
                "create function pg_temp.fail_return_notice() returns trigger "
                "language plpgsql as $$ "
                "begin raise exception 'synthetic_return_failure'; end $$; "
                "create trigger fail_return_notice before insert on public.notification "
                "for each row execute function pg_temp.fail_return_notice()"
            )
            with pytest.raises(asyncpg.PostgresError, match="synthetic_return_failure"):
                async with connection.transaction():
                    await connection.fetchval(
                        "select public.mutate_student_work($1,$2,$3,'return',$4::jsonb)",
                        family["teacher"],
                        event_activity,
                        family["students"][0],
                        json.dumps({"submission_id": submission["id"], "reason": "incomplete"}),
                    )
            assert (
                await connection.fetchval(
                    "select status::text from public.submission where id=$1", submission["id"]
                )
                == "completed"
            )
            assert (
                await connection.fetchval(
                    "select count(*) from writewise_internal.notification_delivery "
                    "where activity_id=$1 and dedupe_key like 'submission_returned:%'",
                    event_activity,
                )
                == 0
            )
        finally:
            await transaction.rollback()
            await connection.close()

    asyncio.run(exercise())


@pytest.mark.parametrize("event", ["assignment", "release", "rejection", "completion"])
def test_notice_failure_rolls_back_entire_coursework_mutation(family, event_activity, event):
    activity, student = event_activity, family["students"][0]
    submission = None
    if event in {"release", "completion"}:
        submission = complete(family, record(family, activity, role="teacher"))
        if event == "completion":
            work(family, activity, submission["id"], "return", reason="incomplete")
            submission = record(family, activity)
        else:
            admin.table("measurement").insert(
                {
                    "submission_id": submission["id"],
                    "raw_output": {},
                    **{
                        f"{criterion}_score": 80
                        for criterion in (
                            "letter_formation",
                            "size_consistency",
                            "spacing",
                            "slant",
                            "baseline_alignment",
                        )
                    },
                }
            ).execute()

    async def exercise():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        transaction = connection.transaction()
        await transaction.start()
        try:
            # Match the backend service SDK's JWT context for the caller-scoped
            # assignment check, while retaining owner access for test-only DDL.
            await connection.execute(
                "select set_config('request.jwt.claims', $1, true)",
                json.dumps({"role": "service_role"}),
            )

            async def state():
                # Compare persisted work and delivery evidence, not just the error.
                return {
                    table: await connection.fetchval(
                        "select coalesce(jsonb_agg(to_jsonb(entry) "
                        "order by to_jsonb(entry)::text),"
                        f"'[]'::jsonb) from {table} entry where {column}=$1",
                        activity,
                    )
                    for table, column in (
                        ("public.activity", "id"),
                        ("public.activity_assignment", "activity_id"),
                        ("public.student_work", "activity_id"),
                        ("public.submission", "activity_id"),
                        ("public.notification", "activity_id"),
                        ("writewise_internal.notification_delivery", "activity_id"),
                    )
                }

            before = await state()
            await connection.execute(
                "create function pg_temp.fail_coursework_notice() returns trigger "
                "language plpgsql as $$ begin raise exception using "
                "errcode='XX000',message='synthetic_notice_failure'; end $$; "
                "create trigger fail_coursework_notice before insert on public.notification "
                "for each row execute function pg_temp.fail_coursework_notice()"
            )
            with pytest.raises(asyncpg.InternalServerError, match="synthetic_notice_failure"):
                async with connection.transaction():
                    if event == "assignment":
                        await connection.fetchval(
                            "select public.update_assigned_activity($1,$2,$3::jsonb)",
                            family["teacher"],
                            activity,
                            json.dumps(
                                {
                                    "title": "Must roll back",
                                    "assignments": [{"student_id": family["students"][1]}],
                                }
                            ),
                        )
                    elif event == "release":
                        await connection.fetchval(
                            "select public.mutate_student_work($1,$2,$3,'release',$4::jsonb)",
                            family["teacher"],
                            activity,
                            student,
                            json.dumps({"submission_id": submission["id"]}),
                        )
                    elif event == "rejection":
                        target = str(uuid4())
                        await connection.fetchval(
                            "select public.record_student_submission($1,$2,$3,$4::jsonb)",
                            family["parent"],
                            activity,
                            student,
                            json.dumps(
                                {
                                    "id": target,
                                    "image_path": f"{student}/{target}.jpg",
                                    "uploader_role": "parent",
                                    "status": "rejected",
                                    "rejection_code": "IMAGE_TOO_BLURRY",
                                }
                            ),
                        )
                    else:
                        await connection.fetchval(
                            "select public.complete_student_submission($1,$2)",
                            family["parent"],
                            submission["id"],
                        )
            assert await state() == before
        finally:
            await transaction.rollback()
            await connection.close()

    asyncio.run(exercise())


@pytest.mark.parametrize("change_targets", [False, True])
def test_concurrent_roster_move_does_not_become_an_assignment_event(
    family, assigned_activity, change_targets
):
    activity, student = assigned_activity["id"], family["students"][1]
    payload = (
        {"assignments": assigned_activity["assignments"]}
        if change_targets
        else {"title": "Updated title"}
    )
    assert notices(activity, "activity_assigned", student) == []

    async def exercise():
        locker, worker, observer = [
            await asyncpg.connect(os.environ["SUPABASE_DB_URL"]) for _ in range(3)
        ]
        lock_transaction, work_transaction = locker.transaction(), worker.transaction()
        await lock_transaction.start()
        await work_transaction.start()
        task = None
        lock_key = int(uuid4().hex[:14], 16)
        try:
            await locker.execute("select pg_advisory_xact_lock($1::bigint)", lock_key)
            await worker.execute(
                "create function pg_temp.pause_activity_edit() returns trigger "
                "language plpgsql as $$ "
                "begin perform pg_advisory_xact_lock(TG_ARGV[0]::bigint); return NEW; end $$; "
                "create trigger pause_activity_edit before update on public.activity "
                f"for each row execute function pg_temp.pause_activity_edit('{lock_key}')"
            )
            task = asyncio.create_task(
                worker.fetchval(
                    "select public.update_assigned_activity($1,$2,$3::jsonb)",
                    family["teacher"],
                    activity,
                    json.dumps(payload),
                )
            )
            await wait_for_database_lock(observer, worker.get_server_pid())
            admin.table("student").update({"section_id": family["sections"][0]}).eq(
                "id", student
            ).execute()
            await lock_transaction.commit()
            await task
            assert (
                await worker.fetchval(
                    "select count(*) from public.notification where activity_id=$1 "
                    "and student_id=$2 and type='activity_assigned'",
                    activity,
                    student,
                )
                == 0
            )
        finally:
            if task and not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            if worker.is_in_transaction():
                await work_transaction.rollback()
            if locker.is_in_transaction():
                await lock_transaction.rollback()
            for connection in (locker, worker, observer):
                await connection.close()

    try:
        asyncio.run(exercise())
    finally:
        admin.table("student").update({"section_id": family["sections"][1]}).eq(
            "id", student
        ).execute()
