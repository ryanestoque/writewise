"""Activity points and work mutations are atomic, on-demand and revision-aware."""

from uuid import uuid4

import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin
from tests.rls.gradebook_support import configure_points, read_grade, set_work, stored_attempt


@pytest.fixture
def points_activity(family, assigned_activity):
    configure_points(family, assigned_activity["id"], "20")
    row = (
        admin.table("activity")
        .select("id,points_possible,points_revision,title")
        .eq("id", assigned_activity["id"])
        .single()
        .execute()
        .data
    )
    assert row["points_possible"] == 20
    return row


def test_enabling_points_without_work_does_not_preallocate_grade_or_work_rows(
    family, points_activity
):
    activity = points_activity["id"]
    assert points_activity["points_revision"] == 1
    assert (
        admin.table("student_work_grade").select("id").eq("activity_id", activity).execute().data
        == []
    )
    assert (
        admin.table("student_work").select("student_id").eq("activity_id", activity).execute().data
        == []
    )


def test_zero_is_an_on_demand_hidden_draft_without_a_submission(family, points_activity):
    activity, student = points_activity["id"], family["students"][0]
    result = set_work(family, activity, {"points_override": "0.00"})
    grade = read_grade(family["teacher_client"], activity, student)[0]
    assert result["grade"]["revision"] == grade["revision"]
    assert "source_signature" not in result["grade"]
    assert grade["points_override"] == 0
    assert grade["released_at"] is None
    assert read_grade(family["parent_client"], activity, student) == []
    assert admin.table("submission").select("id").eq("activity_id", activity).execute().data == []


def test_identical_override_and_unrelated_edits_preserve_the_grade_revision(
    family, points_activity
):
    activity = points_activity["id"]
    first = set_work(family, activity, {"points_override": "0"})["grade"]
    second = set_work(family, activity, {"points_override": "0.00"})["grade"]
    assert second["revision"] == first["revision"]
    changed_due = set_work(family, activity, {"due_at_override": "2030-01-01T00:00:00Z"})
    assert changed_due["grade"]["revision"] == first["revision"]
    configure_points(family, activity, "20.00")
    stored = read_grade(family["teacher_client"], activity, family["students"][0])[0]
    assert stored["revision"] == first["revision"]


@pytest.mark.parametrize("value", ["0", "-1", "1.001", "NaN", "Infinity", "10000"])
def test_invalid_activity_maximum_is_rejected_atomically(family, points_activity, value):
    with pytest.raises(APIError) as failure:
        configure_points(family, points_activity["id"], value)
    assert failure.value.code == "WW434"
    maximum = (
        admin.table("activity")
        .select("points_possible")
        .eq("id", points_activity["id"])
        .single()
        .execute()
        .data["points_possible"]
    )
    assert maximum == 20


@pytest.mark.parametrize("value", ["-1", "20.01", "1.001", "NaN", "Infinity"])
def test_invalid_override_is_rejected_without_leaving_grade_state(family, points_activity, value):
    activity = points_activity["id"]
    with pytest.raises(APIError) as failure:
        set_work(family, activity, {"points_override": value})
    assert failure.value.code == "WW434"
    assert read_grade(family["teacher_client"], activity, family["students"][0]) == []


def test_override_requires_points_but_excuse_does_not(family, assigned_activity):
    activity = assigned_activity["id"]
    with pytest.raises(APIError) as failure:
        set_work(family, activity, {"points_override": "0"})
    assert failure.value.code == "WW434"
    result = set_work(family, activity, {"excused": True})
    assert result["excused"] is True
    parent_state = (
        family["parent_client"]
        .table("activity_work_state")
        .select("work_status,late")
        .eq("activity_id", activity)
        .eq("student_id", family["students"][0])
        .execute()
        .data
    )
    assert parent_state == [{"work_status": "Excused", "late": False}]


def test_lowering_maximum_below_an_override_rolls_back_other_activity_edits(
    family, points_activity
):
    activity = points_activity["id"]
    set_work(family, activity, {"points_override": "15"})
    with pytest.raises(APIError) as failure:
        admin.rpc(
            "update_assigned_activity",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
                "payload": {"points_possible": "10", "title": "Should roll back"},
            },
        ).execute()
    assert failure.value.code == "WW432"
    row = (
        admin.table("activity")
        .select("points_possible,title")
        .eq("id", activity)
        .single()
        .execute()
        .data
    )
    assert row == {"points_possible": 20, "title": points_activity["title"]}


def test_removing_points_needs_confirmation_and_clears_overrides_without_reusing_identity(
    family, points_activity
):
    activity, student = points_activity["id"], family["students"][0]
    original = set_work(family, activity, {"points_override": "7"})["grade"]
    with pytest.raises(APIError) as failure:
        configure_points(family, activity, None)
    assert failure.value.code == "WW433"
    admin.rpc(
        "update_assigned_activity",
        {
            "actor_id": family["teacher"],
            "target_activity_id": activity,
            "payload": {"points_possible": None, "confirm_remove_points": True},
        },
    ).execute()
    cleared = read_grade(family["teacher_client"], activity, student)[0]
    assert cleared["points_override"] is None
    assert cleared["released_at"] is None
    configure_points(family, activity, "30")
    restored = read_grade(family["teacher_client"], activity, student)[0]
    assert restored["id"] == original["id"]
    assert restored["revision"] > original["revision"]
    assert restored["points_override"] is None
    assert restored["released_at"] is None


def test_first_enable_can_use_a_released_source_but_later_maximum_edits_redraft(
    family, assigned_activity
):
    activity, student = assigned_activity["id"], family["students"][0]
    stored_attempt(family, activity, released=True)
    try:
        before = admin.table("notification").select("id").eq("activity_id", activity).execute().data
        configure_points(family, activity, "20")
        grade = read_grade(family["parent_client"], activity, student)[0]
        assert grade["released_revision"] == grade["revision"]
        after = admin.table("notification").select("id").eq("activity_id", activity).execute().data
        assert len(after) == len(before)
        configure_points(family, activity, "30")
        assert read_grade(family["parent_client"], activity, student) == []
        revised = read_grade(family["teacher_client"], activity, student)[0]
        assert revised["revision"] > grade["revision"]
        source = (
            admin.table("submission").select("released_at").eq("activity_id", activity).execute()
        )
        assert source.data[0]["released_at"] is not None
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()


def test_bulk_zero_rechecks_missing_and_never_overwrites_existing_work(family, points_activity):
    activity = points_activity["id"]
    admin.table("activity").update({"due_at": "2020-01-01T00:00:00Z"}).eq("id", activity).execute()
    expected = sorted([family["students"][0], family["students"][2]])
    result = (
        admin.rpc(
            "assign_zero_missing",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
            },
        )
        .execute()
        .data
    )
    assert result == {"changed_student_ids": expected, "skipped_student_ids": []}
    repeated = (
        admin.rpc(
            "assign_zero_missing",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
            },
        )
        .execute()
        .data
    )
    assert repeated == {"changed_student_ids": [], "skipped_student_ids": expected}


def test_bulk_zero_skips_excused_and_completed_work(family, points_activity):
    activity = points_activity["id"]
    admin.table("activity").update({"due_at": "2020-01-01T00:00:00Z"}).eq("id", activity).execute()
    set_work(family, activity, {"excused": True}, family["students"][2])
    stored_attempt(family, activity)
    try:
        result = (
            admin.rpc(
                "assign_zero_missing",
                {
                    "actor_id": family["teacher"],
                    "target_activity_id": activity,
                },
            )
            .execute()
            .data
        )
        assert result["changed_student_ids"] == []
        assert sorted(result["skipped_student_ids"]) == sorted(
            [family["students"][0], family["students"][2]]
        )
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()


def test_bulk_excuse_does_not_accept_foreign_or_unassigned_targets(family, points_activity):
    unknown = str(uuid4())
    student = family["students"][0]
    result = (
        admin.rpc(
            "excuse_activity_students",
            {
                "actor_id": family["teacher"],
                "target_activity_id": points_activity["id"],
                "target_student_ids": [student, family["students"][1], unknown],
                "excused": True,
            },
        )
        .execute()
        .data
    )
    assert result["changed_student_ids"] == [student]
    assert sorted(result["skipped_student_ids"]) == sorted([family["students"][1], unknown])
