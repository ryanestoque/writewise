"""Synthetic old-schema upgrade proof. Run as a script, not a pytest module."""

import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4


def main():
    # Guard before importing settings/clients; never fall back to a hosted .env.
    if os.environ.get("ENVIRONMENT") != "test" or urlparse(
        os.environ.get("SUPABASE_URL", "")
    ).hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise SystemExit("Upgrade proof requires ENVIRONMENT=test and localhost Supabase")
    from supabase import create_client

    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["prepare", "verify"])
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    admin = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    def credentials(tag):
        return {"email": f"upgrade-{tag}@example.com", "password": f"Upgrade!{tag}Aa1"}

    def signed_in(identity):
        client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
        client.auth.sign_in_with_password(credentials(identity["tag"]))
        return client

    if args.mode == "prepare":
        users = []
        for role in ["teacher", "teacher", "parent", "parent"]:
            tag = uuid4().hex
            user = admin.auth.admin.create_user(
                {
                    **credentials(tag),
                    "email_confirm": True,
                    "user_metadata": {"role": role, "full_name": "Synthetic Upgrade User"},
                }
            ).user
            users.append({"id": user.id, "tag": tag})
        teacher, other_teacher, parent, other_parent = users
        sections = (
            admin.table("section")
            .insert(
                [
                    {"teacher_id": teacher["id"], "name": "Upgrade owned"},
                    {"teacher_id": other_teacher["id"], "name": "Upgrade foreign"},
                ]
            )
            .execute()
            .data
        )
        children = []
        for index, section in enumerate([sections[0]["id"], None, sections[1]["id"]]):
            child = (
                admin.table("student")
                .insert(
                    {
                        "full_name": "Synthetic Upgrade Child",
                        "section": "Upgrade",
                        "section_id": section,
                    }
                )
                .execute()
                .data[0]
            )
            children.append(child["id"])
            admin.table("teacher_student").insert(
                {
                    "teacher_id": teacher["id"],
                    "student_id": child["id"],
                }
            ).execute()
            admin.table("student_parent").insert(
                {
                    "student_id": child["id"],
                    "parent_id": (parent if index < 2 else other_parent)["id"],
                }
            ).execute()
        activities = (
            admin.table("activity")
            .insert(
                [
                    {
                        "created_by": teacher["id"],
                        "target_text": "Synthetic legacy take home",
                        "is_take_home": True,
                    },
                    {
                        "created_by": teacher["id"],
                        "target_text": "Synthetic legacy in class",
                        "is_take_home": False,
                    },
                ]
            )
            .execute()
            .data
        )
        visible = []
        for identity in [parent, other_parent]:
            client = signed_in(identity)
            links = client.table("student_parent").select("student_id").execute().data
            for child in links:
                for activity in activities:
                    rows = (
                        client.table("activity")
                        .select("id")
                        .eq("id", activity["id"])
                        .execute()
                        .data
                    )
                    if rows:
                        visible.append([identity["id"], child["student_id"], activity["id"]])
        assert len(visible) == 3, (
            "Legacy synthetic take-home visibility must exist before upgrading"
        )
        args.manifest.write_text(
            json.dumps(
                {
                    "users": users,
                    "children": children,
                    "activities": [a["id"] for a in activities],
                    "visible": visible,
                }
            ),
            encoding="utf-8",
        )
        print("Prepared synthetic legacy visibility fixtures")
        return

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    for identity in manifest["users"][2:]:
        client = signed_in(identity)
        links = client.table("student_parent").select("student_id").execute().data
        for _, child_id, activity_id in [v for v in manifest["visible"] if v[0] == identity["id"]]:
            assert client.table("activity").select("id").eq("id", activity_id).execute().data
            assert (
                client.rpc(
                    "is_assigned",
                    {
                        "target_activity_id": activity_id,
                        "target_student_id": child_id,
                    },
                )
                .execute()
                .data
                is True
            )
        for child in links:
            for activity_id in manifest["activities"]:
                # In-class expansion covers the same roster, including null/foreign sections.
                assert (
                    client.rpc(
                        "is_assigned",
                        {
                            "target_activity_id": activity_id,
                            "target_student_id": child["student_id"],
                        },
                    )
                    .execute()
                    .data
                    is True
                )
                row = (
                    client.table("activity")
                    .select("*")
                    .eq("id", activity_id)
                    .single()
                    .execute()
                    .data
                )
                assert row["title"] == row["target_text"].strip()[:60]
                assert row["due_at"] is None and row["close_after_due"] is False
                assert "points" not in row and "max_points" not in row
    print("Legacy visibility, sectionless/foreign-section fallback and in-class expansion verified")


if __name__ == "__main__":
    main()
