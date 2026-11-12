"""Real service transactions recheck participants and isolate academic state."""

import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin
from tests.rls.comment_support import post_comment
from tests.rls.gradebook_support import configure_points, read_grade, release_work, set_work


def lock_thread(family, submission_id, locked=True):
    return (
        admin.rpc(
            "set_submission_comment_lock",
            {
                "actor_id": family["teacher"],
                "target_submission_id": submission_id,
                "locked": locked,
            },
        )
        .execute()
        .data
    )


def delete_comment(actor, comment):
    return (
        admin.rpc("delete_private_comment", {"actor_id": actor, "target_comment_id": comment})
        .execute()
        .data
    )


def test_post_trims_text_without_creating_a_grade(family, assigned_activity, comment_submission):
    activity, _student = (assigned_activity["id"], family["students"][0])
    result = post_comment(family["parent"], comment_submission["id"], "\u2003 One\n two \xa0")
    assert result["author_role"] == "parent" and result["comment_version"] == 1
    assert "body" not in result
    stored = (
        admin.table("private_comment")
        .select("body,author_id,comment_version")
        .eq("id", result["id"])
        .single()
        .execute()
        .data
    )
    assert stored == {"body": "One\n two", "author_id": family["parent"], "comment_version": 1}
    assert admin.table("submission").select("id").eq("activity_id", activity).execute().data == [
        {"id": comment_submission["id"]}
    ]
    assert (
        admin.table("student_work_grade").select("id").eq("activity_id", activity).execute().data
        == []
    )


def test_in_class_closed_overdue_excused_work_still_accepts_comments(
    family, assigned_activity, comment_submission
):
    activity = assigned_activity["id"]
    admin.table("activity").update(
        {"is_take_home": False, "due_at": "2020-01-01T00:00:00Z", "close_after_due": True}
    ).eq("id", activity).execute()
    set_work(family, activity, {"excused": True})
    result = post_comment(family["parent"], comment_submission["id"])
    assert result["author_role"] == "parent"


@pytest.mark.parametrize("actor_key", ["other_teacher", "other_parent"])
def test_foreign_actor_cannot_create_a_work_anchor(
    family, assigned_activity, actor_key, comment_submission
):
    with pytest.raises(APIError) as failure:
        post_comment(family[actor_key], comment_submission["id"])
    assert failure.value.code == "WW404"
    assert (
        admin.table("student_work")
        .select("activity_id")
        .eq("activity_id", assigned_activity["id"])
        .execute()
        .data
        == []
    )


@pytest.mark.parametrize("actor_key", ["teacher", "parent"])
def test_lock_blocks_every_participant_until_unlocked(
    family, assigned_activity, actor_key, comment_submission
):
    _activity, _student = (assigned_activity["id"], family["students"][0])
    assert lock_thread(family, comment_submission["id"])["comments_locked"] is True
    with pytest.raises(APIError) as failure:
        post_comment(family[actor_key], comment_submission["id"])
    assert failure.value.code == "WW440"
    lock_thread(family, comment_submission["id"], False)
    assert post_comment(family[actor_key], comment_submission["id"])["comment_version"] == 1


def test_archive_has_distinct_denial_and_does_not_clear_teacher_lock(
    family, assigned_activity, comment_submission
):
    activity, _student = (assigned_activity["id"], family["students"][0])
    lock_thread(family, comment_submission["id"])
    admin.table("activity").update({"is_archived": True}).eq("id", activity).execute()
    with pytest.raises(APIError) as failure:
        post_comment(family["parent"], comment_submission["id"])
    assert failure.value.code == "WW441"
    admin.table("activity").update({"is_archived": False}).eq("id", activity).execute()
    with pytest.raises(APIError) as failure:
        post_comment(family["parent"], comment_submission["id"])
    assert failure.value.code == "WW440"


def test_author_can_scrub_own_read_only_comment_but_teacher_cannot_delete_it(
    family, assigned_activity, comment_submission
):
    activity, _student = (assigned_activity["id"], family["students"][0])
    comment = post_comment(family["parent"], comment_submission["id"])
    with pytest.raises(APIError) as failure:
        delete_comment(family["teacher"], comment["id"])
    assert failure.value.code == "WW404"
    admin.rpc(
        "update_assigned_activity",
        {
            "actor_id": family["teacher"],
            "target_activity_id": activity,
            "payload": {"assignments": [{"student_id": family["students"][1]}]},
        },
    ).execute()
    lock_thread(family, comment_submission["id"])
    admin.table("activity").update({"is_archived": True}).eq("id", activity).execute()
    assert delete_comment(family["parent"], comment["id"]) == {"deleted": True}
    assert delete_comment(family["parent"], comment["id"]) == {"deleted": True}
    stored = (
        admin.table("private_comment")
        .select("body,deleted_at,created_at")
        .eq("id", comment["id"])
        .single()
        .execute()
        .data
    )
    assert stored["body"] is None and stored["deleted_at"] is not None
    assert stored["created_at"] == comment["created_at"]


@pytest.mark.parametrize("body", ["", "\u2003\xa0", "x" * 1001], ids=["empty", "blank", "long"])
def test_sql_boundary_rejects_invalid_text_without_creating_work(
    family, assigned_activity, body, comment_submission
):
    with pytest.raises(APIError) as failure:
        post_comment(family["parent"], comment_submission["id"], body)
    assert failure.value.code == "WW422"
    assert (
        admin.table("student_work")
        .select("activity_id")
        .eq("activity_id", assigned_activity["id"])
        .execute()
        .data
        == []
    )


@pytest.mark.parametrize("identity", ["teacher_client", "parent_client"])
def test_browser_cannot_supply_actor_to_service_only_post(
    family, assigned_activity, identity, comment_submission
):
    with pytest.raises(APIError) as failure:
        family[identity].rpc(
            "post_submission_comment",
            {
                "actor_id": family["teacher"],
                "comment_body": "Synthetic forged post",
                "target_submission_id": comment_submission["id"],
            },
        ).execute()
    assert failure.value.code == "42501"


def test_comment_changes_preserve_a_released_grade(family, assigned_activity, comment_submission):
    activity, student = (assigned_activity["id"], family["students"][0])
    configure_points(family, activity, "20")
    set_work(family, activity, {"points_override": "5"})
    grade = read_grade(family["teacher_client"], activity, student)[0]
    release_work(family, activity, student, grade["revision"])
    before = read_grade(family["parent_client"], activity, student)
    comment = post_comment(family["teacher"], comment_submission["id"])
    lock_thread(family, comment_submission["id"])
    lock_thread(family, comment_submission["id"], False)
    delete_comment(family["teacher"], comment["id"])
    assert read_grade(family["parent_client"], activity, student) == before
    assert admin.table("submission").select("id").eq("activity_id", activity).execute().data == [
        {"id": comment_submission["id"]}
    ]


def test_sql_text_counts_unicode_code_points_and_preserves_internal_newlines(
    family, assigned_activity, comment_submission
):
    text = "🙂" * 998 + "\nX"
    posted = post_comment(
        family["parent"], comment_submission["id"], "\x1c\u2003" + text + "\u3000\x85"
    )
    assert (
        admin.table("private_comment")
        .select("body")
        .eq("id", posted["id"])
        .single()
        .execute()
        .data["body"]
        == text
    )
