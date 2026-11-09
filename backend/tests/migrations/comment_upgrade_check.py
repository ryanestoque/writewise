"""Localhost-only pre-comments upgrade proof with opaque IDs and hashes only."""

import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlparse

from gradebook_upgrade_check import (
    cleanup,
    db_value,
    parent_client,
)
from gradebook_upgrade_check import (
    fingerprint as legacy_fingerprint,
)
from gradebook_upgrade_check import (
    prepare as prepare_legacy,
)
from postgrest.exceptions import APIError
from supabase import create_client


def fingerprint(admin, manifest):
    snapshot = {"legacy": legacy_fingerprint(admin, manifest)}
    for table, columns in (
        (
            "student_work",
            "activity_id,student_id,due_at_override,pinned_submission_id,updated_at,excused",
        ),
        ("student_work_grade", "*"),
        ("activity", "id,points_possible,points_revision,is_archived"),
        ("submission", "id,status,returned_at,returned_by,return_reason,return_note,released_at"),
    ):
        key = "id" if table == "activity" else "activity_id"
        snapshot[table] = (
            admin.table(table)
            .select(columns)
            .in_(key, manifest["activities"])
            .order(
                "id" if table in {"activity", "submission", "student_work_grade"} else "activity_id"
            )
            .execute()
            .data
        )
    for family in manifest["families"]:
        parent = parent_client(admin, family["parent"])
        snapshot[family["parent"]] = (
            parent.rpc(
                "read_child_gradebook",
                {
                    "target_student_id": family["students"][0],
                },
            )
            .execute()
            .data
        )
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()


def prepare(admin, manifest):
    prepare_legacy(admin, manifest)
    for index, family in enumerate(manifest["families"]):
        activity, student = family["current"], family["students"][0]
        attempts = (
            admin.table("submission")
            .select("id")
            .eq("activity_id", activity)
            .order("created_at")
            .execute()
            .data
        )
        admin.table("submission").update(
            {
                "status": "returned",
                "returned_at": "2020-01-04T00:00:00Z",
                "returned_by": family["teacher"],
                "return_reason": "incomplete",
                "return_note": "Synthetic upgrade Return",
            }
        ).eq("id", attempts[-1]["id"]).execute()
        admin.rpc(
            "update_assigned_activity",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity,
                "payload": {"points_possible": "20"},
            },
        ).execute()
        changed = (
            admin.rpc(
                "mutate_student_work",
                {
                    "actor_id": family["teacher"],
                    "target_activity_id": activity,
                    "target_student_id": student,
                    "operation": "update",
                    "payload": {
                        "points_override": "5",
                        "excused": index == 1,
                        "pinned_submission_id": attempts[0]["id"],
                    },
                },
            )
            .execute()
            .data
        )
        if index == 0:
            admin.rpc(
                "release_student_work_grade",
                {
                    "actor_id": family["teacher"],
                    "target_activity_id": activity,
                    "target_student_id": student,
                    "expected_revision": changed["grade"]["revision"],
                },
            ).execute()
    first = manifest["families"][0]
    empty = (
        admin.rpc(
            "create_assigned_activity",
            {
                "actor_id": first["teacher"],
                "payload": {
                    "title": "Synthetic no-upload zero",
                    "target_text": "one two three four five six",
                    "points_possible": "10",
                    "assignments": [{"student_id": first["students"][0]}],
                },
            },
        )
        .execute()
        .data["id"]
    )
    manifest["activities"].append(empty)
    admin.rpc(
        "mutate_student_work",
        {
            "actor_id": first["teacher"],
            "target_activity_id": empty,
            "target_student_id": first["students"][0],
            "operation": "update",
            "payload": {"points_override": "0"},
        },
    ).execute()
    manifest["before_hash"] = fingerprint(admin, manifest)


def schema():
    assert db_value("select to_regclass('public.private_comment')") is not None
    assert db_value(
        "select exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid "
        "where t.typname='notification_type' and e.enumlabel='comment_posted')"
    )
    assert db_value(
        "select exists(select 1 from information_schema.columns "
        "where table_schema='public' and table_name='student_work' "
        "and column_name='comments_locked')"
    )


def verify(admin, manifest):
    schema()
    assert fingerprint(admin, manifest) == manifest["before_hash"], "Historical facts changed"
    assert admin.table("private_comment").select("id").execute().data == []
    assert all(
        not row["comments_locked"] and row["comment_version"] == 0
        for row in admin.table("student_work")
        .select("comments_locked,comment_version")
        .in_("activity_id", manifest["activities"])
        .execute()
        .data
    )
    assert all(
        row["comment_version"] is None
        for row in admin.table("notification")
        .select("comment_version")
        .in_("activity_id", manifest["activities"])
        .execute()
        .data
    )
    first, other = manifest["families"]
    activity, student = first["current"], first["students"][0]
    grades_before = (
        admin.table("student_work_grade").select("*").eq("activity_id", activity).execute().data
    )
    posted = (
        admin.rpc(
            "post_private_comment",
            {
                "actor_id": first["teacher"],
                "target_activity_id": activity,
                "target_student_id": student,
                "comment_body": "Synthetic upgrade comment",
            },
        )
        .execute()
        .data
    )
    parent = parent_client(admin, first["parent"])
    args = {"target_activity_id": activity, "target_student_id": student}
    thread = parent.rpc("read_private_comment_thread", args).execute().data
    assert any(row["id"] == posted["id"] for row in thread["entries"])
    notice = thread["unread_notice"]
    admin.rpc(
        "mark_comment_notification_read",
        {
            "actor_id": first["parent"],
            "target_notification_id": notice["id"],
            "expected_comment_version": notice["comment_version"],
        },
    ).execute()
    admin.rpc(
        "post_private_comment",
        {
            "actor_id": first["teacher"],
            **args,
            "comment_body": "Synthetic second reply",
        },
    ).execute()
    assert (
        parent.rpc("read_private_comment_thread", args).execute().data["unread_notice"]["id"]
        != notice["id"]
    )
    admin.rpc(
        "update_assigned_activity",
        {
            "actor_id": first["teacher"],
            "target_activity_id": activity,
            "payload": {"assignments": [{"student_id": first["students"][1]}]},
        },
    ).execute()
    thread = parent.rpc("read_private_comment_thread", args).execute().data
    assert thread["can_post"] is False and thread["read_only_reasons"] == ["unassigned"]
    assert any(
        row["activity_id"] == activity
        for row in parent.rpc("list_private_comment_threads", {"target_student_id": student})
        .execute()
        .data["rows"]
    )
    foreign = parent_client(admin, other["parent"])
    try:
        foreign.rpc("read_private_comment_thread", args).execute()
    except APIError as failure:
        assert failure.code == "WW404"
    else:
        raise AssertionError("Foreign family could read conversation")
    admin.rpc(
        "delete_private_comment",
        {
            "actor_id": first["teacher"],
            "target_comment_id": posted["id"],
        },
    ).execute()
    assert (
        admin.table("private_comment")
        .select("body")
        .eq("id", posted["id"])
        .single()
        .execute()
        .data["body"]
        is None
    )
    assert (
        admin.table("student_work_grade").select("*").eq("activity_id", activity).execute().data
        == grades_before
    )


def main():
    for variable in ("SUPABASE_URL", "SUPABASE_DB_URL"):
        if os.environ.get("ENVIRONMENT") != "test" or urlparse(
            os.environ.get(variable, "")
        ).hostname not in {"127.0.0.1", "localhost", "::1"}:
            raise SystemExit("Comment upgrade proof requires test mode and localhost")
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("prepare", "schema", "verify"))
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    if args.mode == "schema":
        schema()
        return
    admin = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    manifest = (
        {key: [] for key in ("users", "students", "activities", "submissions", "families")}
        if args.mode == "prepare"
        else json.loads(args.manifest.read_text())
    )
    try:
        if args.mode == "prepare":
            prepare(admin, manifest)
            args.manifest.write_text(json.dumps(manifest), encoding="utf-8")
            print("Synthetic pre-comments fixture prepared; manifest contains opaque IDs/hashes")
        else:
            verify(admin, manifest)
            print("Comment upgrade verified: historical state, versions, history and isolation")
    except Exception:
        if args.mode == "prepare":
            cleanup(admin, manifest)
        raise
    finally:
        if args.mode == "verify":
            cleanup(admin, manifest)


if __name__ == "__main__":
    main()
