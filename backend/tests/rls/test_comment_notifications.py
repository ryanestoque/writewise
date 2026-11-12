"""Comment fanout is body-free, coalesced, recipient-scoped and atomic."""

from uuid import uuid4

import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin
from tests.rls.comment_support import post_comment
from tests.rls.notification_support import db_value


def notices(activity):
    return (
        admin.table("notification")
        .select("*")
        .eq("activity_id", activity)
        .eq("type", "comment_posted")
        .execute()
        .data
    )


def test_posts_notify_all_other_participants_without_bodies_or_email(
    family, assigned_activity, second_parent, comment_submission
):
    activity, _student = (assigned_activity["id"], family["students"][0])
    sentinel = "SYNTHETIC_PRIVATE_NOTICE_TEXT"
    before_outbox = db_value(
        "select count(*) from public.email_outbox o join public.notification n "
        "on n.id=o.notification_id where n.activity_id=$1::uuid",
        activity,
    )
    for _ in range(3):
        post_comment(family["teacher"], comment_submission["id"], sentinel)
    rows = notices(activity)
    assert {row["recipient_id"] for row in rows} == {family["parent"], second_parent["id"]}
    assert len(rows) == 2
    assert all((row["comment_version"] == 3 and row["read_at"] is None for row in rows))
    assert all((row["submission_id"] == comment_submission["id"] for row in rows))
    assert sentinel not in str(rows)
    assert (
        db_value(
            "select count(*) from public.email_outbox o join public.notification n "
            "on n.id=o.notification_id where n.activity_id=$1::uuid",
            activity,
        )
        == before_outbox
    )
    assert (
        db_value(
            "select count(*) from writewise_internal.notification_delivery "
            "where activity_id=$1::uuid and dedupe_key like 'comment:%'",
            activity,
        )
        == 6
    )


def test_parent_reply_does_not_acknowledge_or_advance_own_unread_notice(
    family, assigned_activity, comment_submission
):
    activity, _student = (assigned_activity["id"], family["students"][0])
    post_comment(family["teacher"], comment_submission["id"])
    post_comment(family["parent"], comment_submission["id"])
    rows = {row["recipient_id"]: row for row in notices(activity)}
    assert rows[family["parent"]]["comment_version"] == 1
    assert rows[family["parent"]]["read_at"] is None
    assert rows[family["teacher"]]["comment_version"] == 2


@pytest.mark.parametrize(
    "target", ["public.notification", "writewise_internal.notification_delivery"]
)
def test_notice_or_receipt_failure_rolls_back_comment_counter_and_work(
    family, assigned_activity, target, comment_submission
):
    activity, _student = (assigned_activity["id"], family["students"][0])
    name = "comment_fault_" + uuid4().hex
    function = "writewise_internal." + name
    db_value(
        f"create function {function}() returns trigger language plpgsql "
        "security invoker set search_path='' as $$ begin "
        f"if new.activity_id='{activity}'::uuid and new.dedupe_key like 'comment:%' then "
        "raise exception 'Synthetic comment rollback'; end if; return new; end; $$"
    )
    try:
        db_value(
            f"create trigger {name} before insert on {target} "
            f"for each row execute function {function}()"
        )
        try:
            with pytest.raises(APIError) as failure:
                post_comment(family["teacher"], comment_submission["id"])
            assert failure.value.code == "P0001"
            assert (
                admin.table("private_comment")
                .select("id")
                .eq("submission_id", comment_submission["id"])
                .execute()
                .data
                == []
            )
            assert (
                admin.table("student_work")
                .select("activity_id")
                .eq("activity_id", activity)
                .execute()
                .data
                == []
            )
            assert notices(activity) == []
            assert (
                db_value(
                    "select count(*) from writewise_internal.notification_delivery "
                    "where activity_id=$1::uuid and dedupe_key like 'comment:%'",
                    activity,
                )
                == 0
            )
        finally:
            db_value(f"drop trigger {name} on {target}")
    finally:
        db_value(f"drop function {function}()")
