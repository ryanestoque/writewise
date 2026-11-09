"""Real browser identities enforce comment access and retained family history."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin
from tests.rls.comment_support import seed_comment
from tests.rls.notification_support import db_value


def read_comment(client, row):
    return client.table("private_comment").select("id,body").eq("id", row["id"]).execute().data


def test_only_owner_and_linked_parents_read_comment(family, assigned_activity, second_parent):
    row = seed_comment(family, assigned_activity["id"])
    expected = [{"id": row["id"], "body": "Synthetic private message"}]
    assert read_comment(family["teacher_client"], row) == expected
    assert read_comment(family["parent_client"], row) == expected
    assert read_comment(second_parent["client"], row) == expected
    assert read_comment(family["other_parent_client"], row) == []
    assert read_comment(family["other_teacher_client"], row) == []


def test_another_roster_teacher_does_not_inherit_thread(family, assigned_activity):
    row = seed_comment(family, assigned_activity["id"])
    link = {"teacher_id": family["other_teacher"], "student_id": family["students"][0]}
    admin.table("teacher_student").insert(link).execute()
    try:
        assert read_comment(family["other_teacher_client"], row) == []
    finally:
        admin.table("teacher_student").delete().eq("teacher_id", link["teacher_id"]).eq(
            "student_id", link["student_id"]
        ).execute()


@pytest.mark.parametrize("identity", ["teacher_client", "parent_client"])
@pytest.mark.parametrize("operation", ["insert", "update", "delete"])
def test_browser_cannot_write_comments(family, assigned_activity, identity, operation):
    row = seed_comment(family, assigned_activity["id"])
    table = family[identity].table("private_comment")
    with pytest.raises(APIError) as failure:
        if operation == "insert":
            table.insert(
                {
                    "activity_id": row["activity_id"],
                    "student_id": row["student_id"],
                    "author_id": family["parent"],
                    "author_role": "parent",
                    "body": "Unauthorized browser write",
                    "comment_version": 2,
                }
            ).execute()
        elif operation == "update":
            table.update({"body": "Unauthorized edit"}).eq("id", row["id"]).execute()
        else:
            table.delete().eq("id", row["id"]).execute()
    assert failure.value.code == "42501"
    assert read_comment(family["parent_client"], row) == [
        {"id": row["id"], "body": "Synthetic private message"}
    ]


def test_comment_only_history_keeps_activity_visible_after_unassignment(family, assigned_activity):
    row = seed_comment(family, assigned_activity["id"])
    admin.rpc(
        "update_assigned_activity",
        {
            "actor_id": family["teacher"],
            "target_activity_id": assigned_activity["id"],
            "payload": {"assignments": [{"student_id": family["students"][1]}]},
        },
    ).execute()
    assert family["parent_client"].table("activity").select("id").eq(
        "id", assigned_activity["id"]
    ).execute().data == [{"id": assigned_activity["id"]}]
    assert read_comment(family["parent_client"], row)[0]["id"] == row["id"]
    assert (
        family["parent_client"]
        .table("private_comment")
        .select("id")
        .eq("activity_id", assigned_activity["id"])
        .eq("student_id", family["students"][1])
        .execute()
        .data
        == []
    )


def test_revoked_parent_link_removes_existing_comment_access(
    family, assigned_activity, second_parent
):
    row = seed_comment(family, assigned_activity["id"])
    parent, student = second_parent["id"], family["students"][0]
    admin.table("student_parent").delete().eq("parent_id", parent).eq(
        "student_id", student
    ).execute()
    try:
        assert read_comment(second_parent["client"], row) == []
    finally:
        admin.table("student_parent").insert({"parent_id": parent, "student_id": student}).execute()
    assert read_comment(second_parent["client"], row)[0]["id"] == row["id"]


def test_archiving_keeps_comment_history_readable(family, assigned_activity):
    row = seed_comment(family, assigned_activity["id"])
    admin.table("activity").update({"is_archived": True}).eq(
        "id", assigned_activity["id"]
    ).execute()
    assert read_comment(family["parent_client"], row)[0]["id"] == row["id"]


def test_parent_can_read_deleted_placeholder_without_old_body(family, assigned_activity):
    row = seed_comment(family, assigned_activity["id"])
    admin.table("private_comment").update(
        {"body": None, "deleted_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", row["id"]).execute()
    assert read_comment(family["parent_client"], row) == [{"id": row["id"], "body": None}]


@pytest.mark.parametrize(
    "changes",
    [
        {"body": None},
        {"body": ""},
        {"body": " "},
        {"body": "x" * 1001},
        {"deleted_at": "2030-01-01T00:00:00Z"},
        {"comment_version": 0},
        {"author_role": "student"},
    ],
)
def test_storage_rejects_invalid_live_or_deleted_shape(family, assigned_activity, changes):
    row = seed_comment(family, assigned_activity["id"])
    with pytest.raises(APIError) as failure:
        admin.table("private_comment").update(changes).eq("id", row["id"]).execute()
    assert failure.value.code == "23514"
    assert read_comment(family["parent_client"], row)[0]["body"] == "Synthetic private message"


def test_versions_do_not_reuse_numbers_or_reset_existing_work(family, assigned_activity):
    first = seed_comment(family, assigned_activity["id"])
    admin.table("student_work").update({"comments_locked": True}).eq(
        "activity_id", assigned_activity["id"]
    ).eq("student_id", family["students"][0]).execute()
    second = seed_comment(family, assigned_activity["id"], body="Second synthetic message")
    assert first["comment_version"] == 1 and second["comment_version"] == 2
    state = (
        admin.table("student_work")
        .select("comments_locked,comment_version")
        .eq("activity_id", assigned_activity["id"])
        .eq("student_id", family["students"][0])
        .single()
        .execute()
        .data
    )
    assert state == {"comments_locked": True, "comment_version": 2}
    duplicate = {
        key: second[key]
        for key in (
            "activity_id",
            "student_id",
            "author_id",
            "author_role",
            "body",
            "comment_version",
        )
    }
    with pytest.raises(APIError) as failure:
        admin.table("private_comment").insert(duplicate).execute()
    assert failure.value.code == "23505"


def test_removing_author_account_keeps_comment_but_not_author_reference(family, assigned_activity):
    tag = uuid4().hex
    user = admin.auth.admin.create_user(
        {
            "email": f"comment-author-{tag}@example.com",
            "password": f"Synthetic!{tag}Aa1",
            "email_confirm": True,
            "user_metadata": {"role": "parent", "full_name": "Synthetic Comment Author"},
        }
    ).user
    deleted = False
    try:
        admin.table("student_parent").insert(
            {"parent_id": user.id, "student_id": family["students"][0]}
        ).execute()
        row = seed_comment(family, assigned_activity["id"], actor_id=user.id)
        admin.auth.admin.delete_user(user.id)
        deleted = True
        retained = (
            family["parent_client"]
            .table("private_comment")
            .select("author_id,author_role,body")
            .eq("id", row["id"])
            .single()
            .execute()
            .data
        )
        assert retained == {
            "author_id": None,
            "author_role": "parent",
            "body": "Synthetic private message",
        }
    finally:
        if not deleted:
            admin.auth.admin.delete_user(user.id)


def test_deleting_activity_cascades_comment_rows(family, assigned_activity):
    row = seed_comment(family, assigned_activity["id"])
    admin.table("activity").delete().eq("id", assigned_activity["id"]).execute()
    assert admin.table("private_comment").select("id").eq("id", row["id"]).execute().data == []


def test_deleting_a_comment_only_student_cascades_work_and_comments(family, assigned_activity):
    student = (
        admin.table("student")
        .insert(
            {
                "full_name": "Synthetic Comment Child",
                "section": "Synthetic",
                "section_id": family["sections"][0],
            }
        )
        .execute()
        .data[0]["id"]
    )
    try:
        admin.table("teacher_student").insert(
            {"teacher_id": family["teacher"], "student_id": student}
        ).execute()
        row = seed_comment(family, assigned_activity["id"], student_id=student)
        admin.table("student").delete().eq("id", student).execute()
        assert admin.table("private_comment").select("id").eq("id", row["id"]).execute().data == []
        assert (
            admin.table("student_work")
            .select("activity_id")
            .eq("student_id", student)
            .execute()
            .data
            == []
        )
    finally:
        admin.table("student").delete().eq("id", student).execute()


def test_comment_table_and_history_helpers_have_scoped_grants():
    assert (
        db_value("select relrowsecurity from pg_class where oid='public.private_comment'::regclass")
        is True
    )
    assert db_value("select has_table_privilege('anon','public.private_comment','select')") is False
    assert (
        db_value("select has_table_privilege('authenticated','public.private_comment','insert')")
        is False
    )
    assert (
        db_value(
            "select has_function_privilege('authenticated',"
            "'writewise_internal.has_comment_work_history(uuid,uuid)','execute')"
        )
        is True
    )
    assert (
        db_value(
            "select has_function_privilege('anon',"
            "'writewise_internal.has_comment_work_history(uuid,uuid)','execute')"
        )
        is False
    )
