"""Caller-RLS thread snapshots preserve history, exact cursors and Return time."""

import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin
from tests.rls.comment_support import seed_comment
from tests.rls.gradebook_support import stored_attempt


def thread(client, activity, student, **page):
    return (
        client.rpc(
            "read_private_comment_thread",
            {"target_activity_id": activity, "target_student_id": student, **page},
        )
        .execute()
        .data
    )


def test_empty_read_does_not_create_work_or_grades(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    result = thread(family["parent_client"], activity, student)
    assert result["activity_id"] == activity and result["student_id"] == student
    assert result["actor_role"] == "parent" and result["can_post"] is True
    assert result["can_lock"] is False and result["read_only_reasons"] == []
    assert result["entries"] == [] and result["next_cursor"] is None
    assert result["seen_comment_version"] is None and result["unread_notice"] is None
    assert (
        admin.table("student_work").select("activity_id").eq("activity_id", activity).execute().data
        == []
    )
    assert (
        admin.table("student_work_grade").select("id").eq("activity_id", activity).execute().data
        == []
    )


@pytest.mark.parametrize("identity", ["other_parent_client", "other_teacher_client"])
def test_unrelated_caller_cannot_probe_thread(family, assigned_activity, identity):
    seed_comment(family, assigned_activity["id"])
    with pytest.raises(APIError) as failure:
        thread(family[identity], assigned_activity["id"], family["students"][0])
    assert failure.value.code == "WW404"


def test_historical_comment_only_thread_survives_target_change(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    comment = seed_comment(family, activity)
    admin.rpc(
        "update_assigned_activity",
        {
            "actor_id": family["teacher"],
            "target_activity_id": activity,
            "payload": {"assignments": [{"student_id": family["students"][1]}]},
        },
    ).execute()
    result = thread(family["parent_client"], activity, student)
    assert result["assigned"] is False and result["can_post"] is False
    assert result["read_only_reasons"] == ["unassigned"]
    assert [entry["id"] for entry in result["entries"]] == [comment["id"]]
    summaries = (
        family["parent_client"]
        .rpc(
            "list_private_comment_threads",
            {
                "target_student_id": student,
            },
        )
        .execute()
        .data
    )
    assert [(row["activity_id"], row["student_id"]) for row in summaries["rows"]] == [
        (activity, student)
    ]
    sibling = (
        family["parent_client"]
        .rpc(
            "list_private_comment_threads",
            {
                "target_student_id": family["students"][1],
            },
        )
        .execute()
        .data
    )
    assert sibling["rows"] == []


def test_page_cursor_preserves_microseconds_and_has_no_duplicate(family, assigned_activity):
    first = seed_comment(family, assigned_activity["id"])
    second = seed_comment(family, assigned_activity["id"], body="Later synthetic text")
    for row, stamp in [
        (first, "2030-01-01T10:00:00.000001Z"),
        (second, "2030-01-01T10:00:00.000002Z"),
    ]:
        admin.table("private_comment").update({"created_at": stamp}).eq("id", row["id"]).execute()
    args = (family["parent_client"], assigned_activity["id"], family["students"][0])
    page = thread(*args, page_size=1)
    assert [entry["id"] for entry in page["entries"]] == [second["id"]]
    assert ".000002" in page["next_cursor"]["event_at"]
    assert page["seen_comment_version"] == 2
    older = thread(*args, before_cursor=page["next_cursor"], page_size=1)
    assert [entry["id"] for entry in older["entries"]] == [first["id"]]
    assert older["seen_comment_version"] == 1 and older["next_cursor"] is None


def test_return_entry_uses_return_time_and_projects_no_assessment(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    comment = seed_comment(family, activity)
    admin.table("private_comment").update({"created_at": "2030-01-01T10:00:00Z"}).eq(
        "id", comment["id"]
    ).execute()
    attempt = stored_attempt(family, activity, created_at="2020-01-01T00:00:00Z")
    try:
        admin.table("submission").update(
            {
                "status": "returned",
                "returned_at": "2030-01-01T10:00:00Z",
                "returned_by": family["teacher"],
                "return_reason": "incomplete",
                "return_note": "Synthetic Return context",
            }
        ).eq("id", attempt["id"]).execute()
        result = thread(family["parent_client"], activity, student, page_size=1)
        assert result["entries"] == [
            {
                "kind": "return",
                "id": attempt["id"],
                "event_at": "2030-01-01T10:00:00+00:00",
                "return_reason": "incomplete",
                "return_note": "Synthetic Return context",
            }
        ]
        assert result["seen_comment_version"] is None
        older = thread(
            family["parent_client"],
            activity,
            student,
            before_cursor=result["next_cursor"],
            page_size=1,
        )
        assert older["entries"][0]["id"] == comment["id"]
        assert older["entries"][0]["kind"] == "comment"
    finally:
        admin.table("submission").delete().eq("id", attempt["id"]).execute()


@pytest.mark.parametrize(
    "page",
    [
        {"page_size": 0},
        {"page_size": 101},
        {"before_cursor": {}},
        {"before_cursor": {"event_at": "2030-01-01T00:00:00Z", "kind": "comment"}},
        {
            "before_cursor": {
                "event_at": "invalid",
                "kind": "comment",
                "id": "11111111-1111-1111-1111-111111111111",
            }
        },
    ],
)
def test_invalid_feed_window_is_rejected(family, assigned_activity, page):
    with pytest.raises(APIError) as failure:
        thread(family["parent_client"], assigned_activity["id"], family["students"][0], **page)
    assert failure.value.code == "WW422"


def test_parent_cannot_use_teacher_summary_scope(family, assigned_activity):
    seed_comment(family, assigned_activity["id"])
    with pytest.raises(APIError) as failure:
        family["parent_client"].rpc(
            "list_private_comment_threads",
            {
                "target_activity_id": assigned_activity["id"],
            },
        ).execute()
    assert failure.value.code == "WW404"
