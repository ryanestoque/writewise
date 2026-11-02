"""Real signed-in clients verify release privacy and counted-attempt selection."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

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
    due = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    mutate(family, activity, "update", {"due_at_override": due})
    teacher = (
        family["teacher_client"]
        .table("activity_work_state")
        .select("work_status,effective_due_at")
        .eq("activity_id", activity)
        .execute()
        .data[0]
    )
    parent = (
        family["parent_client"]
        .table("activity_work_state")
        .select("work_status,effective_due_at")
        .eq("activity_id", activity)
        .execute()
        .data[0]
    )
    assert teacher["work_status"] == "Draft"
    assert parent["work_status"] == "Turned in"
    assert parent["effective_due_at"] == teacher["effective_due_at"]


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
