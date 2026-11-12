"""Pre-email upgrade preserves real work, notification receipts and read state."""

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

import asyncpg
from notification_upgrade_check import cleanup, snapshot
from supabase import create_client


async def database_snapshot(activity):
    connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
    try:
        return json.loads(
            await connection.fetchval(
                "select coalesce(jsonb_agg(to_jsonb(d) order by dedupe_key),'[]'::jsonb) "
                "from writewise_internal.notification_delivery d where activity_id=$1",
                activity,
            )
        )
    finally:
        await connection.close()


async def verify_scheduler():
    connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
    try:
        jobs = await connection.fetch(
            "select jobname,schedule,command,active from cron.job where jobname in "
            "('writewise-email-dispatch','writewise-deadline-notifications')"
        )
        assert {
            row["jobname"]: (row["schedule"], row["command"], row["active"]) for row in jobs
        } == {
            "writewise-deadline-notifications": (
                "*/15 * * * *",
                "select writewise_internal.enqueue_time_based_notifications();",
                True,
            ),
        }
        assert len(jobs) == 1
        assert (
            await connection.fetchval(
                "select to_regprocedure('writewise_internal.request_email_dispatch()')"
            )
            is None
        )
    finally:
        await connection.close()


def capture(admin, parent, manifest):
    activity = manifest["activity"]
    return {
        "work": snapshot(admin, parent, activity, manifest["submissions"]),
        "notifications": admin.table("notification")
        .select("*")
        .eq("activity_id", activity)
        .order("id")
        .execute()
        .data,
        "receipts": asyncio.run(database_snapshot(activity)),
    }


def main():
    for key in ("SUPABASE_URL", "SUPABASE_DB_URL"):
        if os.environ.get("ENVIRONMENT") != "test" or urlparse(
            os.environ.get(key, "")
        ).hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise SystemExit("Email upgrade proof requires test mode and localhost URLs")
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["prepare", "verify"])
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    admin = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    manifest = (
        {"users": []}
        if args.mode == "prepare"
        else json.loads(args.manifest.read_text(encoding="utf-8"))
    )
    try:
        if args.mode == "prepare":
            for role in ("teacher", "parent"):
                tag = uuid4().hex
                credentials = {
                    "email": f"email-upgrade-{tag}@example.com",
                    "password": f"Email!{tag}Aa1",
                }
                user = admin.auth.admin.create_user(
                    {
                        **credentials,
                        "email_confirm": True,
                        "user_metadata": {"role": role, "full_name": "Synthetic Email Upgrade"},
                    }
                ).user
                manifest["users"].append({"id": user.id, **credentials})
            teacher, parent_identity = manifest["users"]
            student = (
                admin.table("student")
                .insert({"full_name": "Synthetic Upgrade Child", "section": "Synthetic"})
                .execute()
                .data[0]["id"]
            )
            manifest["student"] = student
            admin.table("teacher_student").insert(
                {"teacher_id": teacher["id"], "student_id": student}
            ).execute()
            admin.table("student_parent").insert(
                {"parent_id": parent_identity["id"], "student_id": student}
            ).execute()
            activity = (
                admin.rpc(
                    "create_assigned_activity",
                    {
                        "actor_id": teacher["id"],
                        "payload": {
                            "title": "Synthetic email upgrade",
                            "target_text": "one two three four five six",
                            "is_take_home": True,
                            "due_at": "2030-01-01T14:00:00Z",
                            "assignments": [{"student_id": student}],
                        },
                    },
                )
                .execute()
                .data["id"]
            )
            manifest["activity"] = activity
            submissions = []
            for index, status in enumerate(("returned", "completed", "completed"), 1):
                payload = {
                    "activity_id": activity,
                    "student_id": student,
                    "status": status,
                    "image_path": f"{student}/{uuid4()}.jpg",
                    "uploader_id": teacher["id"],
                    "uploader_role": "teacher",
                    "created_at": f"2020-01-0{index}T00:00:00Z",
                    "released_at": "2020-01-04T00:00:00Z" if index < 3 else None,
                }
                if status == "returned":
                    payload.update(
                        returned_at="2020-01-04T00:00:00Z",
                        returned_by=teacher["id"],
                        return_reason="incomplete",
                        return_note="Synthetic note",
                    )
                submission = admin.table("submission").insert(payload).execute().data[0]["id"]
                submissions.append(submission)
                criteria = (
                    "letter_formation",
                    "size_consistency",
                    "spacing",
                    "slant",
                    "baseline_alignment",
                )
                admin.table("measurement").insert(
                    {
                        "submission_id": submission,
                        "raw_output": {},
                        **{f"{criterion}_score": 80 for criterion in criteria},
                    }
                ).execute()
                admin.table("manual_score").insert(
                    {
                        "submission_id": submission,
                        "graded_by": teacher["id"],
                        **{f"{criterion}_band": "excellent" for criterion in criteria},
                    }
                ).execute()
            manifest["submissions"] = submissions

            async def historical_events():
                connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
                try:
                    for kind, submission in (
                        ("due_soon", None),
                        ("submission_returned", submissions[0]),
                    ):
                        identity = (
                            await connection.fetchval(
                                "select writewise_internal.notification_epoch_us(due_at) "
                                "from public.activity where id=$1",
                                activity,
                            )
                            if kind == "due_soon"
                            else str(submission)
                        )
                        await connection.fetchval(
                            "select writewise_internal.notify_work_parents("
                            "$1::public.notification_type,$2,$3,$4,$5)",
                            kind,
                            activity,
                            student,
                            submission,
                            identity,
                        )
                    await connection.execute(
                        "update public.notification set read_at=$2 "
                        "where activity_id=$1 and type='due_soon'",
                        activity,
                        datetime(2020, 1, 4, tzinfo=timezone.utc),
                    )
                finally:
                    await connection.close()

            asyncio.run(historical_events())
        teacher, parent_identity = manifest["users"]
        parent = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
        parent.auth.sign_in_with_password(
            {key: parent_identity[key] for key in ("email", "password")}
        )
        if args.mode == "prepare":
            manifest["before"] = capture(admin, parent, manifest)
            assert len(manifest["before"]["work"]["parent_measurements"]) == 2
            assert {row["type"] for row in manifest["before"]["notifications"]} >= {
                "due_soon",
                "submission_returned",
            }
            args.manifest.write_text(json.dumps(manifest), encoding="utf-8")
            print("Email upgrade prepare passed using synthetic localhost records")
            return
        assert capture(admin, parent, manifest) == manifest["before"], "Historical records changed"
        for role, user in zip(("teacher", "parent"), manifest["users"], strict=True):
            assert (
                admin.table(role)
                .select("email_notifications")
                .eq("id", user["id"])
                .single()
                .execute()
                .data["email_notifications"]
                is True
            )
        notices = [row["id"] for row in manifest["before"]["notifications"]]
        assert (
            admin.table("email_outbox").select("id").in_("notification_id", notices).execute().data
            == []
        )
        asyncio.run(verify_scheduler())
        print(
            "Email upgrade verified: work, scores, notices, receipts and reads preserved; "
            "default-on preferences; no email replay"
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
