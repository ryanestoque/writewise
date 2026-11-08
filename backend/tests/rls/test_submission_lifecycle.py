"""Real signed-in clients verify release privacy and counted-attempt selection."""

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import asyncpg
import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin


def mutate(family, activity, operation, payload, student=None):
    return (
        admin.rpc(
            "mutate_student_work",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
                "target_student_id": student or family["students"][0],
                "operation": operation,
                "payload": payload,
            },
        )
        .execute()
        .data
    )


@pytest.fixture
def attempts(family, assigned_activity):
    activity = assigned_activity["id"]
    student = family["students"][0]
    rows = []
    for index in range(2):
        row = (
            admin.table("submission")
            .insert(
                {
                    "activity_id": activity,
                    "student_id": student,
                    "image_path": f"{student}/{uuid4()}.jpg",
                    "status": "completed",
                    "uploader_id": family["teacher"],
                    "uploader_role": "teacher",
                    "created_at": f"2026-11-0{index + 1}T01:00:00Z",
                }
            )
            .execute()
            .data[0]
        )
        admin.table("measurement").insert(
            {
                "submission_id": row["id"],
                "raw_output": {"private": "diagnostic"},
                "letter_formation_score": 80,
                "size_consistency_score": 80,
                "spacing_score": 80,
                "slant_score": 80,
                "baseline_alignment_score": 80,
                "overlay": {"private": "overlay"},
            }
        ).execute()
        admin.table("manual_score").insert(
            {
                "submission_id": row["id"],
                "graded_by": family["teacher"],
                **{
                    f"{criterion}_band": "excellent"
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
        rows.append(row)
    yield rows
    admin.table("submission").delete().eq("activity_id", activity).execute()


def active_ids(client, activity):
    return [
        row["id"]
        for row in client.table("active_submission")
        .select("id")
        .eq("activity_id", activity)
        .execute()
        .data
    ]


def test_parent_historical_work_survives_section_move(family, assigned_activity, attempts):
    activity = assigned_activity["id"]
    student = family["students"][0]
    admin.table("activity").update({"due_at": "2030-01-01T00:00:00Z"}).eq("id", activity).execute()
    try:
        admin.table("student").update({"section_id": family["sections"][1]}).eq(
            "id", student
        ).execute()
        rows = (
            family["parent_client"]
            .table("activity_work_state")
            .select("student_id,effective_due_at")
            .eq("activity_id", activity)
            .eq("student_id", student)
            .execute()
            .data
        )
        assert rows == [{"student_id": student, "effective_due_at": "2030-01-01T00:00:00+00:00"}]
        assert (
            family["other_parent_client"]
            .table("activity_work_state")
            .select("student_id")
            .eq("activity_id", activity)
            .eq("student_id", student)
            .execute()
            .data
            == []
        )
    finally:
        admin.table("student").update({"section_id": family["sections"][0]}).eq(
            "id", student
        ).execute()


def test_new_drafts_hide_both_score_tables_and_embedded_diagnostics(
    family, assigned_activity, attempts
):
    parent = family["parent_client"]
    submission = attempts[-1]["id"]
    for table in ("measurement", "manual_score"):
        assert parent.table(table).select("*").eq("submission_id", submission).execute().data == []
    rows = (
        parent.table("submission")
        .select("id,measurement(*),manual_score(*)")
        .eq("id", submission)
        .execute()
        .data
    )
    assert len(rows) == 1
    assert rows[0]["measurement"] in (None, [])
    assert rows[0]["manual_score"] in (None, [])


def test_release_exposes_only_active_child_result(family, assigned_activity, attempts):
    activity = assigned_activity["id"]
    current = attempts[-1]["id"]
    assert active_ids(family["parent_client"], activity) == [current]
    result = mutate(family, activity, "release", {"submission_id": current})
    assert result["released_at"]
    for table in ("measurement", "manual_score"):
        assert (
            len(
                family["parent_client"]
                .table(table)
                .select("*")
                .eq("submission_id", current)
                .execute()
                .data
            )
            == 1
        )
        assert (
            family["other_parent_client"]
            .table(table)
            .select("*")
            .eq("submission_id", current)
            .execute()
            .data
            == []
        )
    again = mutate(family, activity, "release", {"submission_id": current})
    assert again["released_at"] == result["released_at"]


def test_return_blocks_old_fallback_but_explicit_pin_restores_it(
    family, assigned_activity, attempts
):
    activity = assigned_activity["id"]
    old, current = attempts
    mutate(family, activity, "return", {"submission_id": current["id"], "reason": "incomplete"})
    assert active_ids(family["teacher_client"], activity) == []
    work = (
        family["parent_client"]
        .table("activity_work_state")
        .select("work_status")
        .eq("activity_id", activity)
        .execute()
        .data
    )
    assert work == [{"work_status": "Returned"}]
    mutate(family, activity, "update", {"pinned_submission_id": old["id"]})
    assert active_ids(family["parent_client"], activity) == [old["id"]]
    mutate(family, activity, "update", {"pinned_submission_id": None})
    assert active_ids(family["parent_client"], activity) == []


def test_return_retains_released_scores_and_rubric_history(family, assigned_activity, attempts):
    activity = assigned_activity["id"]
    current = attempts[-1]["id"]
    released = mutate(family, activity, "release", {"submission_id": current})
    returned = mutate(
        family,
        activity,
        "return",
        {
            "submission_id": current,
            "reason": "other",
            "note": "Please try again",
        },
    )
    assert returned["released_at"] == released["released_at"]
    assert returned["return_note"] == "Please try again"
    assert (
        len(
            family["parent_client"]
            .table("manual_score")
            .select("id")
            .eq("submission_id", current)
            .execute()
            .data
        )
        == 1
    )
    assert active_ids(family["parent_client"], activity) == []


def test_inactive_release_and_mismatched_pin_roll_back(family, assigned_activity, attempts):
    activity = assigned_activity["id"]
    with pytest.raises(APIError) as error:
        mutate(family, activity, "release", {"submission_id": attempts[0]["id"]})
    assert error.value.code == "WW410"
    with pytest.raises(APIError) as error:
        mutate(
            family,
            activity,
            "update",
            {
                "due_at_override": "2027-01-01T00:00:00Z",
                "pinned_submission_id": str(uuid4()),
            },
        )
    assert error.value.code == "WW422"
    assert (
        admin.table("student_work")
        .select("due_at_override")
        .eq("activity_id", activity)
        .execute()
        .data
        == []
    )


def test_work_deadline_and_parent_draft_status(family, assigned_activity, attempts):
    activity = assigned_activity["id"]
    student = family["students"][0]
    due = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    mutate(family, activity, "update", {"due_at_override": due})
    teacher = (
        family["teacher_client"]
        .table("activity_work_state")
        .select("work_status,effective_due_at")
        .eq("activity_id", activity)
        .eq("student_id", student)
        .single()
        .execute()
        .data
    )
    parent = (
        family["parent_client"]
        .table("activity_work_state")
        .select("work_status,effective_due_at")
        .eq("activity_id", activity)
        .eq("student_id", student)
        .single()
        .execute()
        .data
    )
    assert teacher["work_status"] == "Draft"
    assert parent["work_status"] == "Turned in"
    assert parent["effective_due_at"] == teacher["effective_due_at"]


def test_release_view_embeds_score_tables_under_parent_rls(family, assigned_activity, attempts):
    activity = assigned_activity["id"]
    parent = family["parent_client"]
    rows = (
        parent.table("active_submission")
        .select("id,measurement(*),manual_score(*)")
        .eq("activity_id", activity)
        .execute()
        .data
    )
    assert [row["id"] for row in rows] == [attempts[-1]["id"]]
    assert rows[0]["measurement"] in (None, [])
    assert rows[0]["manual_score"] in (None, [])


@pytest.mark.parametrize("status", ["processing", "rejected"])
def test_only_completed_attempt_can_be_returned(family, assigned_activity, attempts, status):
    current = attempts[-1]["id"]
    admin.table("submission").update({"status": status}).eq("id", current).execute()
    with pytest.raises(APIError) as error:
        mutate(
            family,
            assigned_activity["id"],
            "return",
            {
                "submission_id": current,
                "reason": "incomplete",
            },
        )
    assert error.value.code == "WW409"


def test_resubmission_completion_replaces_return_without_old_fallback(
    family, assigned_activity, attempts
):
    activity = assigned_activity["id"]
    student = family["students"][0]
    mutate(
        family,
        activity,
        "return",
        {
            "submission_id": attempts[-1]["id"],
            "reason": "incomplete",
        },
    )
    new_id = str(uuid4())
    admin.rpc(
        "record_student_submission",
        {
            "actor_id": family["teacher"],
            "target_activity_id": activity,
            "target_student_id": student,
            "payload": {
                "id": new_id,
                "image_path": f"{student}/{new_id}.jpg",
                "status": "processing",
                "uploader_role": "teacher",
            },
        },
    ).execute()
    assert active_ids(family["parent_client"], activity) == []
    admin.table("measurement").insert({"submission_id": new_id, "raw_output": {}}).execute()
    admin.rpc(
        "complete_student_submission",
        {
            "actor_id": family["teacher"],
            "target_submission_id": new_id,
        },
    ).execute()
    assert active_ids(family["parent_client"], activity) == [new_id]
    assert (
        family["parent_client"]
        .table("measurement")
        .select("id")
        .eq("submission_id", new_id)
        .execute()
        .data
        == []
    )


def test_bulk_release_skips_inactive_and_repeated_results(family, assigned_activity, attempts):
    parameters = {"actor_id": family["teacher"], "target_activity_id": assigned_activity["id"]}
    result = admin.rpc("release_activity_results", parameters).execute().data
    assert result == {
        "released_count": 1,
        "submission_ids": [attempts[-1]["id"]],
        "released_grade_count": 0,
        "grade_student_ids": [],
    }
    assert admin.rpc("release_activity_results", parameters).execute().data == {
        "released_count": 0,
        "submission_ids": [],
        "released_grade_count": 0,
        "grade_student_ids": [],
    }


def test_changed_rubric_redrafts_but_unchanged_save_preserves_release(
    family, assigned_activity, attempts
):
    current = attempts[-1]["id"]
    released = mutate(family, assigned_activity["id"], "release", {"submission_id": current})
    bands = {
        f"{criterion}_band": "excellent"
        for criterion in (
            "letter_formation",
            "size_consistency",
            "spacing",
            "slant",
            "baseline_alignment",
        )
    }
    parameters = {"actor_id": family["teacher"], "target_submission_id": current, "payload": bands}
    admin.rpc("save_manual_submission_score", parameters).execute()
    assert admin.table("submission").select("released_at").eq("id", current).execute().data == [
        {
            "released_at": released["released_at"],
        }
    ]
    bands["spacing_band"] = "developing"
    admin.rpc("save_manual_submission_score", parameters).execute()
    assert (
        family["parent_client"]
        .table("manual_score")
        .select("id")
        .eq("submission_id", current)
        .execute()
        .data
        == []
    )


def test_service_rpc_rechecks_foreign_teacher(family, assigned_activity, attempts):
    with pytest.raises(APIError) as error:
        admin.rpc(
            "mutate_student_work",
            {
                "actor_id": family["other_teacher"],
                "target_activity_id": assigned_activity["id"],
                "target_student_id": family["students"][0],
                "operation": "return",
                "payload": {"submission_id": attempts[-1]["id"], "reason": "incomplete"},
            },
        ).execute()
    assert error.value.code == "WW404"


def test_release_waits_for_return_and_rechecks_eligibility_after_lock(
    family,
    assigned_activity,
    attempts,
):
    """A queued release must not publish the attempt returned by the lock owner."""

    async def exercise():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"], command_timeout=15)
        queued = None
        try:
            async with connection.transaction():
                await connection.execute(
                    "select id from public.activity where id=$1::uuid for update",
                    assigned_activity["id"],
                )
                queued = asyncio.get_running_loop().run_in_executor(
                    None,
                    lambda: mutate(
                        family,
                        assigned_activity["id"],
                        "release",
                        {
                            "submission_id": attempts[-1]["id"],
                        },
                    ),
                )
                blocked = False
                for _ in range(100):
                    await connection.execute("select pg_stat_clear_snapshot()")
                    blocked = await connection.fetchval(
                        "select exists(select 1 from pg_stat_activity p "
                        "where pg_backend_pid() = any(pg_blocking_pids(p.pid)))"
                    )
                    if blocked:
                        break
                    if queued.done():
                        break
                    await asyncio.sleep(0.05)
                assert blocked, "Release did not wait for the activity transaction"
                await connection.fetchval(
                    "select public.mutate_student_work("
                    "$1::uuid,$2::uuid,$3::uuid,'return',$4::jsonb)",
                    family["teacher"],
                    assigned_activity["id"],
                    family["students"][0],
                    json.dumps({"submission_id": attempts[-1]["id"], "reason": "incomplete"}),
                )
            with pytest.raises(APIError) as error:
                await asyncio.wait_for(queued, timeout=10)
            assert error.value.code == "WW410"
        finally:
            await connection.close()

    asyncio.run(exercise())
    row = (
        admin.table("submission")
        .select("status,released_at")
        .eq("id", attempts[-1]["id"])
        .execute()
        .data[0]
    )
    assert row == {"status": "returned", "released_at": None}


def test_completion_rechecks_roster_relationship(family, assigned_activity, attempts):
    current = attempts[-1]["id"]
    student = family["students"][0]
    admin.table("submission").update({"status": "processing"}).eq("id", current).execute()
    admin.table("teacher_student").delete().eq("teacher_id", family["teacher"]).eq(
        "student_id", student
    ).execute()
    try:
        with pytest.raises(APIError) as error:
            admin.rpc(
                "complete_student_submission",
                {
                    "actor_id": family["teacher"],
                    "target_submission_id": current,
                },
            ).execute()
        assert error.value.code == "WW404"
    finally:
        admin.table("teacher_student").insert(
            {
                "teacher_id": family["teacher"],
                "student_id": student,
            }
        ).execute()


def test_equal_upload_timestamps_use_deterministic_id_order(family, assigned_activity, attempts):
    ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"]
    for submission_id in ids:
        admin.table("submission").insert(
            {
                "id": submission_id,
                "activity_id": assigned_activity["id"],
                "student_id": family["students"][0],
                "status": "completed",
                "image_path": "synthetic/tied.jpg",
                "uploader_id": family["teacher"],
                "uploader_role": "teacher",
                "created_at": "2030-01-01T00:00:00Z",
            }
        ).execute()
    assert active_ids(family["parent_client"], assigned_activity["id"]) == [ids[1]]


def test_parent_upload_accepted_at_due_survives_processing_past_due(family, assigned_activity):
    activity = assigned_activity["id"]
    accepted = datetime.now(timezone.utc) - timedelta(seconds=5)
    admin.table("activity").update(
        {
            "due_at": accepted.isoformat(),
            "close_after_due": True,
        }
    ).eq("id", activity).execute()
    parent_id = family["parent_client"].auth.get_session().user.id
    submission_id = str(uuid4())
    row = (
        admin.rpc(
            "record_student_submission",
            {
                "actor_id": parent_id,
                "target_activity_id": activity,
                "target_student_id": family["students"][0],
                "payload": {
                    "id": submission_id,
                    "image_path": "synthetic/deadline.jpg",
                    "status": "rejected",
                    "uploader_role": "parent",
                    "rejection_code": "QUALITY_GATE_BLUR",
                    "rejection_details": "Synthetic retake",
                    "accepted_at": accepted.isoformat(),
                },
            },
        )
        .execute()
        .data
    )
    try:
        assert datetime.fromisoformat(row["created_at"]) == accepted
        assert row["status"] == "rejected"
        assert row["released_at"] is None
    finally:
        admin.table("submission").delete().eq("id", submission_id).execute()


def test_deleting_a_pinned_attempt_clears_pin_and_uses_eligible_successor(
    family,
    assigned_activity,
    attempts,
):
    activity = assigned_activity["id"]
    mutate(family, activity, "update", {"pinned_submission_id": attempts[0]["id"]})
    admin.table("submission").delete().eq("id", attempts[0]["id"]).execute()
    assert active_ids(family["parent_client"], activity) == [attempts[-1]["id"]]
    work = (
        admin.table("student_work")
        .select("pinned_submission_id")
        .eq("activity_id", activity)
        .execute()
        .data
    )
    assert work == [{"pinned_submission_id": None}]


def test_incomplete_measurement_without_rubric_is_not_releasable(
    family, assigned_activity, attempts
):
    current = attempts[-1]["id"]
    admin.table("manual_score").delete().eq("submission_id", current).execute()
    admin.table("measurement").update({"spacing_score": None}).eq(
        "submission_id", current
    ).execute()
    with pytest.raises(APIError) as error:
        mutate(family, assigned_activity["id"], "release", {"submission_id": current})
    assert error.value.code == "WW410"


def test_pin_cannot_select_another_childs_completed_attempt(family, assigned_activity, attempts):
    activity = assigned_activity["id"]
    foreign = (
        admin.table("submission")
        .insert(
            {
                "activity_id": activity,
                "student_id": family["students"][2],
                "status": "completed",
                "image_path": "synthetic/foreign.jpg",
                "uploader_id": family["teacher"],
                "uploader_role": "teacher",
            }
        )
        .execute()
        .data[0]["id"]
    )
    with pytest.raises(APIError) as error:
        mutate(family, activity, "update", {"pinned_submission_id": foreign})
    assert error.value.code == "WW422"


@pytest.mark.parametrize("client_key", ["teacher_client", "parent_client", "other_parent_client"])
def test_browser_cannot_mutate_work_or_call_service_rpc(family, assigned_activity, client_key):
    client = family[client_key]
    with pytest.raises(APIError):
        client.rpc(
            "mutate_student_work",
            {
                "actor_id": family["teacher"],
                "target_activity_id": assigned_activity["id"],
                "target_student_id": family["students"][0],
                "operation": "update",
                "payload": {"due_at_override": None},
            },
        ).execute()
    with pytest.raises(APIError):
        client.table("student_work").insert(
            {
                "activity_id": assigned_activity["id"],
                "student_id": family["students"][0],
            }
        ).execute()
