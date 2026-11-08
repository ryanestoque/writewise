"""Published work grades follow explicit release and the actual active attempt."""

import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin
from tests.rls.gradebook_support import (
    configure_points,
    read_grade,
    release_work,
    set_work,
    stored_attempt,
)


@pytest.fixture
def graded_work(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    configure_points(family, activity, "20")
    try:
        yield activity, student
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()


def grade(family, work):
    return read_grade(family["teacher_client"], *work)[0]


def complete(family, activity, *, created_at=None, measured=True):
    source = stored_attempt(family, activity, created_at=created_at, measured=measured)
    admin.table("submission").update({"status": "processing"}).eq("id", source["id"]).execute()
    admin.rpc(
        "complete_student_submission",
        {
            "actor_id": family["teacher"],
            "target_submission_id": source["id"],
        },
    ).execute()
    return source


def notices(activity):
    return (
        admin.table("notification")
        .select("id,submission_id,dedupe_key")
        .eq("activity_id", activity)
        .eq("type", "score_released")
        .execute()
        .data
    )


def test_zero_release_without_upload_is_private_until_released_and_idempotent(family, graded_work):
    activity, student = graded_work
    set_work(family, activity, {"points_override": "0"})
    revision = grade(family, graded_work)["revision"]
    assert read_grade(family["parent_client"], activity, student) == []
    result = release_work(family, activity, student, revision)
    assert result["grade_released"] is True
    assert result["rubric_released"] is False
    assert result["submission_id"] is None
    assert len(read_grade(family["parent_client"], activity, student)) == 1
    assert admin.table("submission").select("id").eq("activity_id", activity).execute().data == []
    first = notices(activity)
    assert len(first) == 1 and first[0]["submission_id"] is None
    again = release_work(family, activity, student, revision)
    assert again["grade_released"] is False
    assert again["released_at"] == result["released_at"]
    assert notices(activity) == first
    assert (
        admin.table("email_outbox")
        .select("id")
        .in_("notification_id", [row["id"] for row in first])
        .execute()
        .data
        == []
    )


def test_stale_revision_cannot_publish_a_changed_override(family, graded_work):
    activity, student = graded_work
    first = set_work(family, activity, {"points_override": "3"})["grade"]
    set_work(family, activity, {"points_override": "7"})
    with pytest.raises(APIError) as failure:
        release_work(family, activity, student, first["revision"])
    assert failure.value.code == "WW431"
    assert notices(activity) == []
    assert read_grade(family["parent_client"], activity, student) == []


def test_combined_release_emits_once_and_revised_points_emit_a_new_grade_event(family, graded_work):
    activity, student = graded_work
    source = complete(family, activity)
    current = grade(family, graded_work)
    result = release_work(family, activity, student, current["revision"])
    assert result["grade_released"] and result["rubric_released"]
    assert result["submission_id"] == source["id"]
    assert len(notices(activity)) == 1
    set_work(family, activity, {"points_override": "19"})
    result = release_work(family, activity, student, grade(family, graded_work)["revision"])
    assert result["grade_released"] and not result["rubric_released"]
    assert len(notices(activity)) == 2


def test_override_on_ungraded_attempt_does_not_publish_an_absent_assessment(family, graded_work):
    activity, student = graded_work
    source = complete(family, activity, measured=False)
    set_work(family, activity, {"points_override": "10"})
    result = release_work(family, activity, student, grade(family, graded_work)["revision"])
    assert result["grade_released"] and not result["rubric_released"]
    assert (
        admin.table("submission")
        .select("released_at")
        .eq("id", source["id"])
        .single()
        .execute()
        .data["released_at"]
        is None
    )


@pytest.mark.parametrize("reason", ["excused", "ungraded", "bands_only"])
def test_unreleasable_work_never_emits_or_publishes(family, graded_work, reason):
    activity, student = graded_work
    set_work(family, activity, {"points_override": "0"})
    if reason == "excused":
        set_work(family, activity, {"excused": True})
    elif reason == "ungraded":
        set_work(family, activity, {"points_override": None})
    else:
        admin.rpc(
            "update_assigned_activity",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
                "payload": {"points_possible": None, "confirm_remove_points": True},
            },
        ).execute()
    with pytest.raises(APIError) as failure:
        release_work(family, activity, student, grade(family, graded_work)["revision"])
    assert failure.value.code == "WW430"
    assert notices(activity) == []


def test_new_active_attempt_keeps_override_and_redrafts_but_processing_does_not(
    family, graded_work
):
    activity, student = graded_work
    complete(family, activity, created_at="2020-01-01T00:00:00Z")
    set_work(family, activity, {"points_override": "5"})
    old = grade(family, graded_work)
    release_work(family, activity, student, old["revision"])
    source = complete(family, activity, created_at="2021-01-01T00:00:00Z")
    current = grade(family, graded_work)
    assert current["source_submission_id"] == source["id"]
    assert current["points_override"] == 5
    assert current["revision"] > old["revision"] and current["released_at"] is None
    assert read_grade(family["parent_client"], activity, student) == []
    release_work(family, activity, student, current["revision"])
    pending = stored_attempt(family, activity, created_at="2022-01-01T00:00:00Z")
    admin.table("submission").update({"status": "processing"}).eq("id", pending["id"]).execute()
    assert grade(family, graded_work)["revision"] == current["revision"]
    assert len(read_grade(family["parent_client"], activity, student)) == 1


def test_return_of_nonactive_attempt_preserves_current_grade_and_active_return_redrafts(
    family, graded_work
):
    activity, student = graded_work
    old = complete(family, activity, created_at="2020-01-01T00:00:00Z")
    active = complete(family, activity, created_at="2021-01-01T00:00:00Z")
    current = grade(family, graded_work)
    release_work(family, activity, student, current["revision"])
    for source, changes in [(old, False), (active, True)]:
        admin.rpc(
            "mutate_student_work",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
                "target_student_id": student,
                "operation": "return",
                "payload": {"submission_id": source["id"], "reason": "incomplete"},
            },
        ).execute()
        after = grade(family, graded_work)
        assert (after["revision"] > current["revision"]) is changes
        assert (after["released_at"] is None) is changes


def test_bulk_release_includes_no_upload_override_without_changing_legacy_counts(
    family, graded_work
):
    activity, student = graded_work
    source = complete(family, activity)
    set_work(family, activity, {"points_override": "0"}, family["students"][2])
    result = (
        admin.rpc(
            "release_activity_results",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
            },
        )
        .execute()
        .data
    )
    assert result["released_count"] == 1 and result["submission_ids"] == [source["id"]]
    assert result["released_grade_count"] == 2
    assert sorted(result["grade_student_ids"]) == sorted([student, family["students"][2]])
    repeated = (
        admin.rpc(
            "release_activity_results",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
            },
        )
        .execute()
        .data
    )
    assert repeated["released_count"] == repeated["released_grade_count"] == 0


def test_unexcusing_preserves_override_but_requires_another_release(family, graded_work):
    activity, student = graded_work
    set_work(family, activity, {"points_override": "0"})
    release_work(family, activity, student, grade(family, graded_work)["revision"])
    set_work(family, activity, {"excused": True})
    set_work(family, activity, {"excused": False})
    current = grade(family, graded_work)
    assert current["points_override"] == 0 and current["released_at"] is None
    assert read_grade(family["parent_client"], activity, student) == []


def test_deleting_active_source_keeps_override_and_redrafts_atomically(family, graded_work):
    activity, student = graded_work
    source = complete(family, activity)
    set_work(family, activity, {"points_override": "9"})
    old = grade(family, graded_work)
    release_work(family, activity, student, old["revision"])
    result = (
        admin.rpc(
            "delete_student_submissions",
            {
                "actor_id": family["teacher"],
                "target_submission_ids": [source["id"]],
            },
        )
        .execute()
        .data
    )
    assert result == {"deleted_ids": [source["id"]]}
    current = grade(family, graded_work)
    assert current["source_submission_id"] is None and current["points_override"] == 9
    assert current["revision"] > old["revision"] and current["released_at"] is None


def test_other_teacher_cannot_publish_or_delete_foreign_work(family, graded_work):
    activity, student = graded_work
    source = complete(family, activity)
    for function, params in [
        (
            "release_student_work_grade",
            {
                "target_activity_id": activity,
                "target_student_id": student,
                "expected_revision": grade(family, graded_work)["revision"],
            },
        ),
        ("delete_student_submissions", {"target_submission_ids": [source["id"]]}),
    ]:
        with pytest.raises(APIError) as failure:
            admin.rpc(function, {"actor_id": family["other_teacher"], **params}).execute()
        assert failure.value.code == "WW404"
