"""Prove Slice 3 preserves historical work without replaying notifications; localhost only."""

import argparse
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4


def snapshot(admin, parent, activity, submissions):
    return {
        "submissions": admin.table("submission")
        .select(
            "id,status,created_at,released_at,returned_at,returned_by,return_reason,return_note"
        )
        .in_("id", submissions)
        .order("id")
        .execute()
        .data,
        "measurements": admin.table("measurement")
        .select("submission_id,composite_score")
        .in_("submission_id", submissions)
        .order("submission_id")
        .execute()
        .data,
        "rubrics": admin.table("manual_score")
        .select(
            "submission_id,letter_formation_band,size_consistency_band,spacing_band,"
            "slant_band,baseline_alignment_band"
        )
        .in_("submission_id", submissions)
        .order("submission_id")
        .execute()
        .data,
        "parent_measurements": parent.table("measurement")
        .select("submission_id,composite_score")
        .in_("submission_id", submissions)
        .order("submission_id")
        .execute()
        .data,
        "parent_rubrics": parent.table("manual_score")
        .select(
            "submission_id,letter_formation_band,size_consistency_band,spacing_band,"
            "slant_band,baseline_alignment_band"
        )
        .in_("submission_id", submissions)
        .order("submission_id")
        .execute()
        .data,
        "parent_activities": parent.table("activity")
        .select("id")
        .eq("id", activity)
        .execute()
        .data,
        "active": parent.table("active_submission")
        .select("id")
        .eq("activity_id", activity)
        .execute()
        .data,
    }


def cleanup(admin, manifest):
    activity = manifest.get("activity")
    if activity:
        admin.table("submission").delete().eq("activity_id", activity).execute()
        admin.table("activity").delete().eq("id", activity).execute()
    if manifest.get("student"):
        admin.table("student").delete().eq("id", manifest["student"]).execute()
    for user in reversed(manifest.get("users", [])):
        admin.auth.admin.delete_user(user["id"])


def main():
    for key in ("SUPABASE_URL", "SUPABASE_DB_URL"):
        if os.environ.get("ENVIRONMENT") != "test" or urlparse(
            os.environ.get(key, "")
        ).hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise SystemExit("Notification upgrade proof requires test mode and localhost URLs")
    from supabase import create_client

    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["prepare", "verify"])
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    admin = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    if args.mode == "prepare":
        manifest = {"users": []}
        try:
            for role in ("teacher", "parent"):
                tag = uuid4().hex
                credentials = {
                    "email": f"notice-upgrade-{tag}@example.com",
                    "password": f"Notice!{tag}Aa1",
                }
                user = admin.auth.admin.create_user(
                    {
                        **credentials,
                        "email_confirm": True,
                        "user_metadata": {
                            "role": role,
                            "full_name": "Synthetic Notification Upgrade",
                        },
                    }
                ).user
                manifest["users"].append({"id": user.id, **credentials})
            teacher, parent_identity = manifest["users"]
            student = (
                admin.table("student")
                .insert(
                    {
                        "full_name": "Synthetic Upgrade Child",
                        "section": "Synthetic",
                    }
                )
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
                            "title": "Synthetic upgrade practice",
                            "target_text": "one two three four five six",
                            "is_take_home": True,
                            "assignments": [{"student_id": student}],
                        },
                    },
                )
                .execute()
                .data["id"]
            )
            manifest["activity"] = activity
            submissions = []
            for index, status in enumerate(("returned", "completed"), 1):
                payload = {
                    "activity_id": activity,
                    "student_id": student,
                    "status": status,
                    "image_path": f"{student}/{uuid4()}.jpg",
                    "uploader_id": teacher["id"],
                    "uploader_role": "teacher",
                    "created_at": f"2020-01-0{index}T00:00:00Z",
                    "released_at": "2020-01-03T00:00:00Z",
                }
                if status == "returned":
                    payload.update(
                        returned_at="2020-01-03T00:00:00Z",
                        returned_by=teacher["id"],
                        return_reason="incomplete",
                        return_note="Synthetic return note",
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
            parent = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
            parent.auth.sign_in_with_password(
                {key: parent_identity[key] for key in ("email", "password")}
            )
            manifest["before"] = snapshot(admin, parent, activity, submissions)
            assert len(manifest["before"]["parent_measurements"]) == 2
            args.manifest.write_text(json.dumps(manifest), encoding="utf-8")
        except Exception:
            cleanup(admin, manifest)
            raise
        print("Notification upgrade prepare passed using synthetic localhost records")
        return

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    try:
        teacher, parent_identity = manifest["users"]
        parent = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
        parent.auth.sign_in_with_password(
            {key: parent_identity[key] for key in ("email", "password")}
        )
        activity = manifest["activity"]
        assert snapshot(admin, parent, activity, manifest["submissions"]) == manifest["before"], (
            "Historical work changed during upgrade"
        )
        assert (
            admin.table("notification").select("id").eq("activity_id", activity).execute().data
            == []
        ), "Historical notifications were replayed"

        async def verify_database():
            import asyncpg

            connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
            try:
                assert (
                    await connection.fetchval(
                        "select count(*) from writewise_internal.notification_delivery "
                        "where activity_id=$1",
                        activity,
                    )
                    == 0
                )
                jobs = await connection.fetch(
                    "select schedule,command,active from cron.job "
                    "where jobname='writewise-deadline-notifications'"
                )
                assert len(jobs) == 1
                assert jobs[0]["schedule"] == "*/15 * * * *" and jobs[0]["active"]
                assert (
                    jobs[0]["command"]
                    == "select writewise_internal.enqueue_time_based_notifications();"
                )
                assert not await connection.fetchval(
                    "select has_function_privilege('authenticated', "
                    "'public.mark_notification_read(uuid,uuid)', 'EXECUTE')"
                )
            finally:
                await connection.close()

        asyncio.run(verify_database())
        submission = str(uuid4())
        admin.rpc(
            "record_student_submission",
            {
                "actor_id": parent_identity["id"],
                "target_activity_id": activity,
                "target_student_id": manifest["student"],
                "payload": {
                    "id": submission,
                    "image_path": f"{manifest['student']}/{submission}.jpg",
                    "status": "rejected",
                    "uploader_role": "parent",
                    "rejection_code": "IMAGE_TOO_BLURRY",
                },
            },
        ).execute()
        rows = (
            admin.table("notification")
            .select("type,recipient_id,submission_id")
            .eq("activity_id", activity)
            .execute()
            .data
        )
        assert rows == [
            {
                "type": "submission_rejected",
                "recipient_id": parent_identity["id"],
                "submission_id": submission,
            }
        ]
        print(
            "Notification upgrade verify passed: no replay, preserved work, "
            "private grants and one cron job"
        )
    finally:
        cleanup(admin, manifest)


if __name__ == "__main__":
    main()
