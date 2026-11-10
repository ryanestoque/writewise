"""Exact-upload contracts are exercised against real callers and SQL transactions."""

from uuid import uuid4

import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin


def read_thread(caller, submission_id, **page):
    return (
        caller.rpc(
            "read_submission_comment_thread",
            {
                "target_submission_id": submission_id,
                **page,
            },
        )
        .execute()
        .data
    )


def post(actor, submission_id, body="Synthetic submission message"):
    return (
        admin.rpc(
            "post_submission_comment",
            {
                "actor_id": actor,
                "target_submission_id": submission_id,
                "comment_body": body,
            },
        )
        .execute()
        .data
    )


def lock(actor, submission_id, locked=True):
    return (
        admin.rpc(
            "set_submission_comment_lock",
            {
                "actor_id": actor,
                "target_submission_id": submission_id,
                "locked": locked,
            },
        )
        .execute()
        .data
    )


def unread(recipient, submission_id):
    return (
        admin.table("notification")
        .select("id,submission_id,comment_version,read_at")
        .eq("recipient_id", recipient)
        .eq("submission_id", submission_id)
        .eq("type", "comment_posted")
        .is_("read_at", "null")
        .execute()
        .data
    )


def test_read_empty_submission_creates_no_thread_or_grade(family, comment_submission):
    result = read_thread(family["parent_client"], comment_submission["id"])
    assert result["submission_id"] == comment_submission["id"]
    assert result["entries"] == [] and result["seen_comment_version"] is None
    assert result["can_post"] is True and result["comments_locked"] is False
    assert (
        admin.table("submission_comment_thread")
        .select("submission_id")
        .eq("submission_id", comment_submission["id"])
        .execute()
        .data
        == []
    )
    assert (
        admin.table("student_work_grade")
        .select("id")
        .eq("activity_id", comment_submission["activity_id"])
        .execute()
        .data
        == []
    )


@pytest.mark.parametrize("status", ["processing", "rejected", "completed", "returned"])
def test_source_lifecycle_status_does_not_gate_comments(family, comment_submission, status):
    source = comment_submission["id"]
    fields = {"status": status}
    if status == "returned":
        fields.update(
            returned_at="2026-11-10T00:00:00Z",
            returned_by=family["teacher"],
            return_reason="incomplete",
            return_note="Synthetic source Return",
        )
    admin.table("submission").update(fields).eq("id", source).execute()
    result = post(family["parent"], source)
    thread = read_thread(family["parent_client"], source)
    assert thread["submission_status"] == status
    assert thread["can_post"]
    assert result["id"] in {entry["id"] for entry in thread["entries"]}
    assert (
        admin.table("manual_score")
        .select("submission_id")
        .eq("submission_id", source)
        .execute()
        .data
        == []
    )


def test_two_submission_feeds_never_merge(family, comment_submission, peer_comment_submission):
    first = post(family["teacher"], comment_submission["id"], "First upload only")
    second = post(family["parent"], peer_comment_submission["id"], "Second upload only")
    assert first["comment_version"] == second["comment_version"] == 1
    assert [
        entry["id"]
        for entry in read_thread(family["parent_client"], comment_submission["id"])["entries"]
    ] == [first["id"]]
    assert [
        entry["id"]
        for entry in read_thread(family["parent_client"], peer_comment_submission["id"])["entries"]
    ] == [second["id"]]


def test_locks_and_unread_are_independent(family, comment_submission, peer_comment_submission):
    post(family["teacher"], comment_submission["id"])
    lock(family["teacher"], comment_submission["id"])
    with pytest.raises(APIError) as failure:
        post(family["parent"], comment_submission["id"])
    assert failure.value.code == "WW440"
    assert post(family["teacher"], peer_comment_submission["id"])["comment_version"] == 1
    first, second = (
        unread(family["parent"], comment_submission["id"]),
        unread(family["parent"], peer_comment_submission["id"]),
    )
    assert len(first) == len(second) == 1
    assert first[0]["id"] != second[0]["id"]
    admin.rpc(
        "mark_comment_notification_read",
        {
            "actor_id": family["parent"],
            "target_notification_id": first[0]["id"],
            "expected_comment_version": 1,
        },
    ).execute()
    assert unread(family["parent"], comment_submission["id"]) == []
    assert unread(family["parent"], peer_comment_submission["id"]) == second


def test_return_event_stays_with_its_original_upload(
    family, comment_submission, peer_comment_submission
):
    admin.table("submission").update(
        {
            "status": "returned",
            "returned_at": "2030-01-01T10:00:00Z",
            "returned_by": family["teacher"],
            "return_reason": "incomplete",
            "return_note": "Synthetic note for first upload",
        }
    ).eq("id", comment_submission["id"]).execute()
    first = read_thread(family["parent_client"], comment_submission["id"])
    assert [(entry["kind"], entry["id"]) for entry in first["entries"]] == [
        ("return", comment_submission["id"])
    ]
    assert read_thread(family["parent_client"], peer_comment_submission["id"])["entries"] == []


@pytest.mark.parametrize("identity", ["other_parent_client", "other_teacher_client"])
def test_foreign_caller_cannot_read_exact_submission(family, comment_submission, identity):
    with pytest.raises(APIError) as failure:
        read_thread(family[identity], comment_submission["id"])
    assert failure.value.code == "WW404"


def test_missing_submission_cannot_create_any_comment_state(family):
    missing = str(uuid4())
    with pytest.raises(APIError) as failure:
        post(family["parent"], missing)
    assert failure.value.code == "WW404"
    assert (
        admin.table("submission_comment_thread")
        .select("submission_id")
        .eq("submission_id", missing)
        .execute()
        .data
        == []
    )


def test_no_upload_attempt_picker_is_empty(family, assigned_activity):
    response = (
        family["parent_client"]
        .rpc(
            "list_submission_comment_attempts",
            {
                "target_activity_id": assigned_activity["id"],
                "target_student_id": family["students"][0],
            },
        )
        .execute()
        .data
    )
    assert response == {"rows": [], "next_cursor": None}
    assert admin.table("submission_comment_thread").select("submission_id").execute().data == []


def test_attempt_picker_and_history_keep_both_uploads(
    family, assigned_activity, comment_submission, peer_comment_submission
):
    for attempt in (comment_submission, peer_comment_submission):
        post(family["teacher"], attempt["id"])
    picker = (
        family["parent_client"]
        .rpc(
            "list_submission_comment_attempts",
            {
                "target_activity_id": assigned_activity["id"],
                "target_student_id": family["students"][0],
            },
        )
        .execute()
        .data
    )
    assert {row["submission_id"] for row in picker["rows"]} == {
        comment_submission["id"],
        peer_comment_submission["id"],
    }
    history = (
        family["parent_client"]
        .rpc(
            "list_submission_comment_threads",
            {
                "target_student_id": family["students"][0],
                "page_size": 1,
            },
        )
        .execute()
        .data
    )
    assert len(history["rows"]) == 1 and history["next_cursor"] is not None
    older = (
        family["parent_client"]
        .rpc(
            "list_submission_comment_threads",
            {
                "target_student_id": family["students"][0],
                "page_size": 1,
                "before_cursor": history["next_cursor"],
            },
        )
        .execute()
        .data
    )
    assert older["rows"][0]["submission_id"] != history["rows"][0]["submission_id"]


def test_source_deletion_removes_only_its_conversation(
    family, comment_submission, peer_comment_submission
):
    first = post(family["teacher"], comment_submission["id"])
    second = post(family["parent"], peer_comment_submission["id"])
    admin.rpc(
        "delete_student_submissions",
        {
            "actor_id": family["teacher"],
            "target_submission_ids": [comment_submission["id"]],
        },
    ).execute()
    assert admin.table("private_comment").select("id").eq("id", first["id"]).execute().data == []
    assert (
        admin.table("submission_comment_thread")
        .select("submission_id")
        .eq("submission_id", comment_submission["id"])
        .execute()
        .data
        == []
    )
    assert (
        admin.table("notification")
        .select("id")
        .eq("submission_id", comment_submission["id"])
        .execute()
        .data
        == []
    )
    assert admin.table("private_comment").select("id").eq("id", second["id"]).execute().data == [
        {"id": second["id"]}
    ]
