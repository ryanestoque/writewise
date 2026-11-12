"""Localhost-only pre-gradebook upgrade proof; manifest has no login secrets or names."""

import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

import asyncpg
from supabase import create_client


def db_value(statement, *parameters):
    async def run():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        try:
            return await connection.fetchval(statement, *parameters)
        finally:
            await connection.close()

    return asyncio.run(run())


def parent_client(admin, user_id):
    # Generate and consume locally; no email is sent and no token enters the manifest.
    email = admin.auth.admin.get_user_by_id(user_id).user.email
    link = admin.auth.admin.generate_link({"type": "magiclink", "email": email})
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    client.auth.verify_otp({"type": "magiclink", "token_hash": link.properties.hashed_token})
    return client


def fingerprint(admin, manifest):
    snapshot = {}
    ids = manifest["submissions"]
    for table, columns in (
        ("submission", "id,status,released_at,created_at,student_id,activity_id"),
        ("measurement", "*"),
        (
            "manual_score",
            "*",
        ),
    ):
        key = "id" if table == "submission" else "submission_id"
        snapshot[table] = (
            admin.table(table).select(columns).in_(key, ids).order("id").execute().data
        )
    for table in ("notification", "email_outbox"):
        if table == "notification":
            snapshot[table] = (
                admin.table(table)
                .select(
                    "id,recipient_id,type,activity_id,student_id,submission_id,"
                    "dedupe_key,read_at,created_at"
                )
                .in_("activity_id", manifest["activities"])
                .order("id")
                .execute()
                .data
            )
        else:
            notice_ids = [row["id"] for row in snapshot["notification"]]
            snapshot[table] = (
                admin.table(table)
                .select("*")
                .in_("notification_id", notice_ids)
                .order("id")
                .execute()
                .data
                if notice_ids
                else []
            )
    snapshot["receipts"] = json.loads(
        db_value(
            "select coalesce(jsonb_agg(to_jsonb(d) order by dedupe_key),'[]') "
            "from writewise_internal.notification_delivery d where activity_id=any($1::uuid[])",
            manifest["activities"],
        )
    )
    for index, family in enumerate(manifest["families"]):
        parent = parent_client(admin, family["parent"])
        snapshot[f"parent-{index}"] = {
            "activities": parent.table("activity")
            .select("id")
            .in_("id", manifest["activities"])
            .order("id")
            .execute()
            .data,
            "rubrics": parent.table("manual_score")
            .select("*")
            .in_("submission_id", ids)
            .order("submission_id")
            .execute()
            .data,
            "measurements": parent.table("measurement")
            .select("submission_id,composite_score")
            .in_("submission_id", ids)
            .order("submission_id")
            .execute()
            .data,
            "preference": admin.table("parent")
            .select("email_notifications")
            .eq("id", family["parent"])
            .single()
            .execute()
            .data,
        }
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()


def cleanup(admin, manifest):
    for activity in manifest["activities"]:
        admin.table("submission").delete().eq("activity_id", activity).execute()
        admin.table("activity").delete().eq("id", activity).execute()
    for student in manifest["students"]:
        admin.table("student").delete().eq("id", student).execute()
    for user in reversed(manifest["users"]):
        admin.auth.admin.delete_user(user)


def prepare(admin, manifest):
    criteria = ("letter_formation", "size_consistency", "spacing", "slant", "baseline_alignment")
    for index in range(2):
        family = {}
        for role in ("teacher", "parent"):
            tag = uuid4().hex
            user = admin.auth.admin.create_user(
                {
                    "email": f"grade-upgrade-{tag}@example.com",
                    "password": f"Grade!{tag}Aa1",
                    "email_confirm": True,
                    "user_metadata": {"role": role, "full_name": "Synthetic Upgrade"},
                }
            ).user
            manifest["users"].append(user.id)
            family[role] = user.id
        family["students"] = []
        for _ in range(2):
            student = (
                admin.table("student")
                .insert({"full_name": "Synthetic Child", "section": "Synthetic"})
                .execute()
                .data[0]["id"]
            )
            family["students"].append(student)
            manifest["students"].append(student)
            admin.table("teacher_student").insert(
                {"teacher_id": family["teacher"], "student_id": student}
            ).execute()
        admin.table("student_parent").insert(
            {"parent_id": family["parent"], "student_id": family["students"][0]}
        ).execute()
        manifest["families"].append(family)
        for historical in (False, True):
            activity = (
                admin.rpc(
                    "create_assigned_activity",
                    {
                        "actor_id": family["teacher"],
                        "payload": {
                            "title": "Synthetic upgrade",
                            "target_text": "one two three four five six",
                            "due_at": "2030-01-01T14:00:00Z",
                            "assignments": [{"student_id": family["students"][0]}],
                        },
                    },
                )
                .execute()
                .data["id"]
            )
            manifest["activities"].append(activity)
            family["historical" if historical else "current"] = activity
            for attempt in range(1 if historical else 2):
                submission = (
                    admin.table("submission")
                    .insert(
                        {
                            "activity_id": activity,
                            "student_id": family["students"][0],
                            "image_path": f"{family['students'][0]}/{uuid4()}.jpg",
                            "status": "completed",
                            "uploader_id": family["teacher"],
                            "uploader_role": "teacher",
                            "created_at": f"2020-01-0{attempt + 1}T00:00:00Z",
                            "released_at": "2020-01-03T00:00:00Z" if attempt == 0 else None,
                        }
                    )
                    .execute()
                    .data[0]["id"]
                )
                manifest["submissions"].append(submission)
                if index == 0:
                    admin.table("manual_score").insert(
                        {
                            "submission_id": submission,
                            "graded_by": family["teacher"],
                            **{f"{name}_band": "excellent" for name in criteria},
                        }
                    ).execute()
                else:
                    admin.table("measurement").insert(
                        {
                            "submission_id": submission,
                            "raw_output": {},
                            **{f"{name}_score": 82 for name in criteria},
                        }
                    ).execute()
            if historical:
                admin.table("activity_assignment").delete().eq("activity_id", activity).execute()
        admin.table("student_work").insert(
            {
                "activity_id": family["current"],
                "student_id": family["students"][0],
                "due_at_override": "2030-01-01T15:00:00Z",
            }
        ).execute()
        if index == 1:
            admin.table("parent").update({"email_notifications": False}).eq(
                "id", family["parent"]
            ).execute()
        db_value(
            "select writewise_internal.notify_work_parents('due_soon',$1,$2,null,"
            "writewise_internal.notification_epoch_us('2030-01-01T15:00:00Z'))",
            family["current"],
            family["students"][0],
        )
        if index == 0:
            admin.table("notification").update({"read_at": "2020-01-03T00:00:00Z"}).eq(
                "activity_id", family["current"]
            ).eq("type", "due_soon").execute()
    manifest["before_hash"] = fingerprint(admin, manifest)


def verify(admin, manifest):
    assert fingerprint(admin, manifest) == manifest["before_hash"], (
        "Historical score/publication/queue state changed"
    )
    assert admin.table("student_work_grade").select("id").execute().data == []
    assert all(
        row["points_possible"] is None and row["points_revision"] == 0
        for row in admin.table("activity")
        .select("points_possible,points_revision")
        .in_("id", manifest["activities"])
        .execute()
        .data
    )
    assert all(
        row["excused"] is False
        for row in admin.table("student_work")
        .select("excused")
        .in_("activity_id", manifest["activities"])
        .execute()
        .data
    )
    first, other = manifest["families"]
    student = first["students"][0]
    new_activity = (
        admin.rpc(
            "create_assigned_activity",
            {
                "actor_id": first["teacher"],
                "payload": {
                    "title": "Synthetic post-upgrade",
                    "target_text": "one two three four five six",
                    "points_possible": "20",
                    "assignments": [{"student_id": student}],
                },
            },
        )
        .execute()
        .data["id"]
    )
    manifest["activities"].append(new_activity)
    work = (
        admin.rpc(
            "mutate_student_work",
            {
                "actor_id": first["teacher"],
                "target_activity_id": new_activity,
                "target_student_id": student,
                "operation": "update",
                "payload": {"points_override": "0"},
            },
        )
        .execute()
        .data
    )
    parent = parent_client(admin, first["parent"])
    assert (
        parent.table("student_work_grade")
        .select("id")
        .eq("activity_id", new_activity)
        .execute()
        .data
        == []
    )
    result = (
        admin.rpc(
            "release_student_work_grade",
            {
                "actor_id": first["teacher"],
                "target_activity_id": new_activity,
                "target_student_id": student,
                "expected_revision": work["grade"]["revision"],
            },
        )
        .execute()
        .data
    )
    assert result["grade_released"] and result["submission_id"] is None
    assert (
        admin.table("submission").select("id").eq("activity_id", new_activity).execute().data == []
    )
    assert (
        len(
            parent.table("student_work_grade")
            .select("id")
            .eq("activity_id", new_activity)
            .execute()
            .data
        )
        == 1
    )
    assert (
        parent_client(admin, other["parent"])
        .table("student_work_grade")
        .select("id")
        .eq("activity_id", new_activity)
        .execute()
        .data
        == []
    )
    admin.rpc(
        "update_assigned_activity",
        {
            "actor_id": first["teacher"],
            "target_activity_id": new_activity,
            "payload": {"assignments": [{"student_id": first["students"][1]}]},
        },
    ).execute()
    assert parent.table("activity").select("id").eq("id", new_activity).execute().data == [
        {"id": new_activity}
    ]
    facts = parent.rpc("read_child_gradebook", {"target_student_id": student}).execute().data
    assert any(
        cell["activity_id"] == new_activity and cell["publication_current"]
        for group in facts["groups"]
        for cell in group["row"]["cells"]
    )


def main():
    for variable in ("SUPABASE_URL", "SUPABASE_DB_URL"):
        if os.environ.get("ENVIRONMENT") != "test" or urlparse(
            os.environ.get(variable, "")
        ).hostname not in {"127.0.0.1", "localhost", "::1"}:
            raise SystemExit("Gradebook upgrade proof requires test mode and localhost")
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("prepare", "schema", "verify"))
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    if args.mode == "schema":
        assert db_value("select to_regclass('public.student_work_grade')") is not None, (
            "Gradebook schema absent"
        )
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
            print("Synthetic gradebook upgrade fixture prepared; no credentials/names/images saved")
        else:
            verify(admin, manifest)
            print(
                "Gradebook upgrade verified: historical scores/releases/queues preserved; "
                "draft zero, family isolation and retained metadata passed"
            )
    except Exception:
        if args.mode == "prepare":
            cleanup(admin, manifest)
        raise
    finally:
        if args.mode == "verify":
            cleanup(admin, manifest)


if __name__ == "__main__":
    main()
