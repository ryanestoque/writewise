"""Disposable-only cutover proof; persist synthetic IDs/hashes and no private text."""

import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from comment_upgrade_check import cleanup, db_value, fingerprint, parent_client, prepare, schema
from postgrest.exceptions import APIError
from supabase import create_client


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def migration_versions():
    return db_value(
        "select coalesce(jsonb_agg(version order by version),'[]'::jsonb) "
        "from supabase_migrations.schema_migrations"
    )


def delivery_hash(manifest):
    return digest(
        db_value(
            "select coalesce(jsonb_agg(to_jsonb(d) order by d.dedupe_key),'[]'::jsonb) "
            "from writewise_internal.notification_delivery d where d.activity_id=any($1::uuid[])",
            manifest["activities"],
        )
    )


def blocked_hash(admin, manifest):
    return digest(
        {
            "academic": fingerprint(admin, manifest),
            "delivery": delivery_hash(manifest),
            "comments": admin.table("private_comment").select("*").order("id").execute().data,
            "notices": admin.table("notification")
            .select("*")
            .eq("type", "comment_posted")
            .order("id")
            .execute()
            .data,
            "migrations": migration_versions(),
        }
    )


def prepare_fixture(admin, manifest):
    db_value(
        "select cron.alter_job(jobid,active:=false) from cron.job where jobname in "
        "('writewise-deadline-notifications','writewise-email-dispatch')"
    )
    prepare(admin, manifest)
    first = manifest["families"][0]
    rows = (
        admin.table("submission")
        .select("id")
        .eq("activity_id", first["current"])
        .eq("student_id", first["students"][0])
        .order("created_at")
        .execute()
        .data
    )
    assert len(rows) >= 2
    manifest["source_ids"] = [row["id"] for row in rows[:2]]
    manifest["delivery_hash"] = delivery_hash(manifest)
    manifest["migration_versions"] = migration_versions()


def add_legacy_fixture(admin, manifest, kind):
    first = manifest["families"][0]
    activity, student = first["current"], first["students"][0]
    if kind == "legacy-comment":
        admin.rpc(
            "post_private_comment",
            {
                "actor_id": first["teacher"],
                "target_activity_id": activity,
                "target_student_id": student,
                "comment_body": "Synthetic legacy cutover message",
            },
        ).execute()
        admin.table("notification").delete().eq("activity_id", activity).eq(
            "type", "comment_posted"
        ).execute()
    else:
        admin.table("notification").insert(
            {
                "recipient_id": first["parent"],
                "type": "comment_posted",
                "activity_id": activity,
                "student_id": student,
                "submission_id": None,
                "comment_version": 1,
                "dedupe_key": f"comment:legacy-notice:{uuid4()}",
            }
        ).execute()
    manifest["blocked_hash"] = blocked_hash(admin, manifest)


def verify_blocked(admin, manifest):
    assert db_value("select to_regclass('public.submission_comment_thread')") is None
    assert migration_versions() == manifest["migration_versions"]
    assert blocked_hash(admin, manifest) == manifest["blocked_hash"]
    assert db_value(
        "select to_regprocedure('public.post_private_comment(uuid,uuid,uuid,text)') is not null"
    )


def verify_cutover(admin, manifest):
    schema()
    assert fingerprint(admin, manifest) == manifest["before_hash"]
    assert delivery_hash(manifest) == manifest["delivery_hash"]
    assert admin.table("private_comment").select("id").execute().data == []
    assert admin.table("submission_comment_thread").select("submission_id").execute().data == []
    for signature in (
        "public.post_private_comment(uuid,uuid,uuid,text)",
        "public.read_private_comment_thread(uuid,uuid,jsonb,integer)",
        "public.list_private_comment_threads(uuid,uuid,jsonb,integer)",
        "public.set_comment_thread_lock(uuid,uuid,uuid,boolean)",
        "writewise_internal.can_read_comment_work(uuid,uuid)",
        "writewise_internal.has_comment_work_history(uuid,uuid)",
        "writewise_internal.has_comment_activity_history(uuid)",
        "writewise_internal.comment_write_context(uuid,uuid,uuid)",
    ):
        assert db_value("select to_regprocedure($1) is null", signature)
    for signature, caller, definer in (
        ("public.read_submission_comment_thread(uuid,jsonb,integer)", True, False),
        ("public.list_submission_comment_attempts(uuid,uuid,jsonb,integer)", True, False),
        ("public.list_submission_comment_threads(uuid,uuid,jsonb,integer)", True, False),
        ("writewise_internal.submission_comment_context(uuid)", True, True),
        ("writewise_internal.submission_comment_candidates(uuid,uuid)", True, True),
        ("public.post_submission_comment(uuid,uuid,text)", False, False),
        ("public.set_submission_comment_lock(uuid,uuid,boolean)", False, False),
        ("public.delete_private_comment(uuid,uuid)", False, False),
    ):
        assert (
            db_value("select has_function_privilege('authenticated',$1,'execute')", signature)
            == caller
        )
        assert not db_value("select has_function_privilege('anon',$1,'execute')", signature)
        assert db_value("select has_function_privilege('service_role',$1,'execute')", signature)
        assert db_value(
            "select prosecdef=$2 and proconfig=array['search_path=\"\"']::text[] "
            "and not exists(select 1 from aclexplode(proacl) x "
            "where x.grantee=0 and x.privilege_type='EXECUTE') "
            "from pg_proc where oid=$1::regprocedure",
            signature,
            definer,
        )
    for table in ("private_comment", "submission_comment_thread"):
        assert db_value(
            "select relrowsecurity from pg_class where oid=$1::regclass", f"public.{table}"
        )
        for operation in ("insert", "update", "delete"):
            assert not db_value(
                "select has_table_privilege('authenticated',$1,$2)", f"public.{table}", operation
            )
        assert db_value(
            "select exists(select 1 from pg_constraint where conrelid=$1::regclass "
            "and contype='f' and confdeltype='c')",
            f"public.{table}",
        )
    assert db_value("select to_regclass('public.private_comment_feed') is not null")
    assert db_value("select to_regclass('public.notification_comment_unread_uniq') is not null")
    first, other = manifest["families"]
    source_a, source_b = manifest["source_ids"]
    parent = parent_client(admin, first["parent"])
    before_grades = (
        admin.table("student_work_grade")
        .select("*")
        .eq("activity_id", first["current"])
        .execute()
        .data
    )
    posted = []
    for source in (source_a, source_b):
        posted.append(
            admin.rpc(
                "post_submission_comment",
                {
                    "actor_id": first["teacher"],
                    "target_submission_id": source,
                    "comment_body": "Synthetic exact-source upgrade reply",
                },
            )
            .execute()
            .data
        )
    assert [item["comment_version"] for item in posted] == [1, 1]
    admin.rpc(
        "set_submission_comment_lock",
        {
            "actor_id": first["teacher"],
            "target_submission_id": source_a,
            "locked": True,
        },
    ).execute()
    first_thread = (
        parent.rpc("read_submission_comment_thread", {"target_submission_id": source_a})
        .execute()
        .data
    )
    second_thread = (
        parent.rpc("read_submission_comment_thread", {"target_submission_id": source_b})
        .execute()
        .data
    )
    assert first_thread["comments_locked"] and not second_thread["comments_locked"]
    assert posted[1]["id"] not in {entry["id"] for entry in first_thread["entries"]}
    assert all(
        entry["id"] == source_b for entry in second_thread["entries"] if entry["kind"] == "return"
    )
    notice = first_thread["unread_notice"]
    admin.rpc(
        "mark_comment_notification_read",
        {
            "actor_id": first["parent"],
            "target_notification_id": notice["id"],
            "expected_comment_version": notice["comment_version"],
        },
    ).execute()
    assert (
        parent.rpc("read_submission_comment_thread", {"target_submission_id": source_b})
        .execute()
        .data["unread_notice"]
        is not None
    )
    admin.rpc(
        "set_submission_comment_lock",
        {"actor_id": first["teacher"], "target_submission_id": source_a, "locked": False},
    ).execute()
    successor = (
        admin.rpc(
            "post_submission_comment",
            {
                "actor_id": first["teacher"],
                "target_submission_id": source_a,
                "comment_body": "Synthetic new unread cycle",
            },
        )
        .execute()
        .data
    )
    assert successor["comment_version"] == 2
    next_notice = (
        parent.rpc("read_submission_comment_thread", {"target_submission_id": source_a})
        .execute()
        .data["unread_notice"]
    )
    assert next_notice["id"] != notice["id"] and next_notice["comment_version"] == 2
    assert (
        parent.rpc("read_submission_comment_thread", {"target_submission_id": source_b})
        .execute()
        .data["unread_notice"]["comment_version"]
        == 1
    )
    assert (
        admin.table("student_work_grade")
        .select("*")
        .eq("activity_id", first["current"])
        .execute()
        .data
        == before_grades
    )
    foreign = parent_client(admin, other["parent"])
    try:
        foreign.rpc("read_submission_comment_thread", {"target_submission_id": source_b}).execute()
    except APIError as error:
        assert error.code == "WW404"
    else:
        raise AssertionError("Foreign family could read submission comments")
    admin.rpc(
        "delete_student_submissions",
        {
            "actor_id": first["teacher"],
            "target_submission_ids": [source_a],
        },
    ).execute()
    for table in ("private_comment", "submission_comment_thread", "notification"):
        assert (
            admin.table(table).select("submission_id").eq("submission_id", source_a).execute().data
            == []
        )
    assert admin.table("private_comment").select("id").eq("id", posted[1]["id"]).execute().data == [
        {"id": posted[1]["id"]}
    ]
    admin.table("student_parent").delete().eq("parent_id", first["parent"]).eq(
        "student_id", first["students"][0]
    ).execute()
    try:
        parent.rpc("read_submission_comment_thread", {"target_submission_id": source_b}).execute()
    except APIError as error:
        assert error.code == "WW404"
    else:
        raise AssertionError("Revoked parent could read submission comments")


def main():
    for variable in ("SUPABASE_URL", "SUPABASE_DB_URL"):
        if os.environ.get("ENVIRONMENT") != "test" or urlparse(
            os.environ.get(variable, "")
        ).hostname not in {"127.0.0.1", "localhost", "::1"}:
            raise SystemExit("Submission-comment proof requires test mode and localhost")
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "mode",
        choices=("prepare", "schema", "legacy-comment", "legacy-notice", "blocked", "verify"),
    )
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    if args.mode == "schema":
        schema()
        return
    admin = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    manifest = (
        {key: [] for key in ("users", "students", "activities", "submissions", "families")}
        if args.mode == "prepare"
        else json.loads(args.manifest.read_text(encoding="utf-8"))
    )
    try:
        if args.mode == "prepare":
            prepare_fixture(admin, manifest)
        elif args.mode in {"legacy-comment", "legacy-notice"}:
            add_legacy_fixture(admin, manifest, args.mode)
        elif args.mode == "blocked":
            verify_blocked(admin, manifest)
        else:
            verify_cutover(admin, manifest)
        if args.mode in {"prepare", "legacy-comment", "legacy-notice"}:
            args.manifest.write_text(json.dumps(manifest), encoding="utf-8")
        print(f"Synthetic submission-comment proof: {args.mode} passed; IDs/hashes only")
    except Exception:
        if args.mode == "prepare":
            cleanup(admin, manifest)
        raise SystemExit(f"Synthetic submission-comment proof failed during {args.mode}") from None
    finally:
        if args.mode == "verify":
            cleanup(admin, manifest)


if __name__ == "__main__":
    main()
