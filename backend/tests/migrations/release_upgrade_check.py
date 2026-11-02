"""Prove old results remain released and the first new upload is draft; localhost only."""

import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4


def main():
    if os.environ.get("ENVIRONMENT") != "test" or urlparse(
        os.environ.get("SUPABASE_URL", "")
    ).hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise SystemExit("Release upgrade proof requires test mode and localhost Supabase")
    from supabase import create_client

    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["prepare", "verify"])
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    admin = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    def credentials(tag):
        return {"email": f"release-{tag}@example.com", "password": f"Release!{tag}Aa1"}

    if args.mode == "prepare":
        identities = []
        for role in ("teacher", "parent"):
            tag = uuid4().hex
            user = admin.auth.admin.create_user(
                {
                    **credentials(tag),
                    "email_confirm": True,
                    "user_metadata": {"role": role, "full_name": "Synthetic Release Upgrade"},
                }
            ).user
            identities.append({"id": user.id, "tag": tag})
        teacher, parent = identities
        student = (
            admin.table("student")
            .insert(
                {
                    "full_name": "Synthetic Release Child",
                    "section": "Synthetic",
                }
            )
            .execute()
            .data[0]["id"]
        )
        admin.table("teacher_student").insert(
            {
                "teacher_id": teacher["id"],
                "student_id": student,
            }
        ).execute()
        admin.table("student_parent").insert(
            {
                "parent_id": parent["id"],
                "student_id": student,
            }
        ).execute()
        activity = (
            admin.rpc(
                "create_assigned_activity",
                {
                    "actor_id": teacher["id"],
                    "payload": {
                        "title": "Release upgrade",
                        "target_text": "one two three four five six",
                        "is_take_home": True,
                        "assignments": [{"student_id": student}],
                    },
                },
            )
            .execute()
            .data["id"]
        )
        submission = (
            admin.table("submission")
            .insert(
                {
                    "activity_id": activity,
                    "student_id": student,
                    "image_path": "synthetic/upgrade.jpg",
                    "status": "completed",
                    "uploader_id": teacher["id"],
                    "uploader_role": "teacher",
                }
            )
            .execute()
            .data[0]["id"]
        )
        admin.table("measurement").insert(
            {
                "submission_id": submission,
                "raw_output": {},
                "letter_formation_score": 80,
                "size_consistency_score": 80,
                "spacing_score": 80,
                "slant_score": 80,
                "baseline_alignment_score": 80,
            }
        ).execute()
        admin.table("manual_score").insert(
            {
                "submission_id": submission,
                "graded_by": teacher["id"],
                **{
                    f"{key}_band": "excellent"
                    for key in (
                        "letter_formation",
                        "size_consistency",
                        "spacing",
                        "slant",
                        "baseline_alignment",
                    )
                },
            }
        ).execute()
        manifest = {
            "teacher": teacher,
            "parent": parent,
            "student": student,
            "activity": activity,
            "submission": submission,
        }
        args.manifest.write_text(json.dumps(manifest), encoding="utf-8")
    else:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))

    parent = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    parent.auth.sign_in_with_password(credentials(manifest["parent"]["tag"]))
    for table in ("measurement", "manual_score"):
        assert (
            len(
                parent.table(table)
                .select("id")
                .eq("submission_id", manifest["submission"])
                .execute()
                .data
            )
            == 1
        )
    if args.mode == "verify":
        old = (
            parent.table("submission")
            .select("released_at")
            .eq("id", manifest["submission"])
            .execute()
            .data[0]
        )
        assert old["released_at"] is not None
        new_id = str(uuid4())
        admin.rpc(
            "record_student_submission",
            {
                "actor_id": manifest["parent"]["id"],
                "target_activity_id": manifest["activity"],
                "target_student_id": manifest["student"],
                "payload": {
                    "id": new_id,
                    "image_path": "synthetic/new.jpg",
                    "uploader_role": "parent",
                    "status": "processing",
                },
            },
        ).execute()
        admin.table("measurement").insert({"submission_id": new_id, "raw_output": {}}).execute()
        completed = (
            admin.rpc(
                "complete_student_submission",
                {
                    "actor_id": manifest["parent"]["id"],
                    "target_submission_id": new_id,
                },
            )
            .execute()
            .data
        )
        assert completed["released_at"] is None
        assert (
            parent.table("measurement").select("id").eq("submission_id", new_id).execute().data
            == []
        )
    print(f"Release upgrade {args.mode} passed using synthetic localhost records")


if __name__ == "__main__":
    main()
