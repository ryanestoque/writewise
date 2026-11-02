"""Events are emitted by the actual transactional coursework RPCs."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin


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


def test_return_retry_completion_and_deletion_dedupe(family, event_activity):
    initial = complete(family, record(family, event_activity, role="teacher"))
    work(family, event_activity, initial["id"], "return", reason="incomplete")
    returned = notices(event_activity, "submission_returned")
    assert [(row["recipient_id"], row["submission_id"]) for row in returned] == [
        (family["parent"], initial["id"])
    ]
    record(family, event_activity, status="rejected")
    assert notices(event_activity, "resubmitted_after_return") == []
    retry = complete(family, record(family, event_activity))
    emitted = notices(event_activity, "resubmitted_after_return")
    assert [(row["recipient_id"], row["submission_id"]) for row in emitted] == [
        (family["teacher"], retry["id"])
    ]
    admin.table("submission").delete().eq("id", retry["id"]).execute()
    second = complete(family, record(family, event_activity))
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
            "composite_score": 80,
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
