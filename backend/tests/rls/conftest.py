"""Synthetic identities; authorization assertions use signed-in anon-key clients."""

import os
from uuid import uuid4

import pytest
from supabase import create_client

from app.core.supabase import supabase_client as admin


@pytest.fixture(scope="module")
def family():
    users = []
    students = []
    clients = []

    def identity(role):
        tag = uuid4().hex
        email = f"phase3-{tag}@example.com"
        password = f"Phase3!{tag}Aa1"
        user = admin.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"role": role, "full_name": "Synthetic Phase3 User"},
            }
        ).user
        users.append(user.id)
        client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
        client.auth.sign_in_with_password({"email": email, "password": password})
        clients.append(client)
        return user.id, client

    try:
        teacher, teacher_client = identity("teacher")
        other_teacher, other_teacher_client = identity("teacher")
        parent, parent_client = identity("parent")
        other_parent, other_parent_client = identity("parent")
        sections = (
            admin.table("section")
            .insert(
                [
                    {"teacher_id": teacher, "name": "Synthetic A"},
                    {"teacher_id": teacher, "name": "Synthetic B"},
                    {"teacher_id": other_teacher, "name": "Synthetic foreign"},
                ]
            )
            .execute()
            .data
        )
        for section in [sections[0]["id"], sections[1]["id"], None]:
            student = (
                admin.table("student")
                .insert(
                    {
                        "full_name": "Synthetic Child",
                        "section": "Synthetic",
                        "section_id": section,
                    }
                )
                .execute()
                .data[0]
            )
            students.append(student["id"])
            admin.table("teacher_student").insert(
                {
                    "teacher_id": teacher,
                    "student_id": student["id"],
                }
            ).execute()
        admin.table("student_parent").insert(
            [
                {"student_id": students[0], "parent_id": parent},
                {"student_id": students[1], "parent_id": parent},
                {"student_id": students[2], "parent_id": other_parent},
            ]
        ).execute()
        yield {
            "teacher": teacher,
            "teacher_client": teacher_client,
            "other_teacher": other_teacher,
            "other_teacher_client": other_teacher_client,
            "parent": parent,
            "other_parent": other_parent,
            "parent_client": parent_client,
            "other_parent_client": other_parent_client,
            "students": students,
            "sections": [s["id"] for s in sections],
        }
    finally:
        # Deleting students first avoids section ON DELETE RESTRICT during account cleanup.
        for student_id in students:
            admin.table("student").delete().eq("id", student_id).execute()
        for user_id in reversed(users):
            admin.auth.admin.delete_user(user_id)


@pytest.fixture
def assigned_activity(family):
    row = (
        admin.rpc(
            "create_assigned_activity",
            {
                "actor_id": family["teacher"],
                "payload": {
                    "title": "Synthetic loops",
                    "target_text": "one two three four five six",
                    "is_take_home": True,
                    "assignments": [
                        {"section_id": family["sections"][0]},
                        {"student_id": family["students"][2]},
                    ],
                },
            },
        )
        .execute()
        .data
    )
    yield row
    admin.table("activity").delete().eq("id", row["id"]).execute()


@pytest.fixture
def second_parent(family):
    tag = uuid4().hex
    credentials = {"email": f"notification-{tag}@example.com", "password": f"Notice!{tag}Aa1"}
    user = admin.auth.admin.create_user(
        {
            **credentials,
            "email_confirm": True,
            "user_metadata": {"role": "parent", "full_name": "Synthetic Notification Parent"},
        }
    ).user
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    try:
        client.auth.sign_in_with_password(credentials)
        admin.table("student_parent").insert(
            {"student_id": family["students"][0], "parent_id": user.id}
        ).execute()
        yield {"id": user.id, "client": client}
    finally:
        admin.table("student_parent").delete().eq("parent_id", user.id).execute()
        admin.auth.admin.delete_user(user.id)


@pytest.fixture
def comment_submission(family, assigned_activity):
    from tests.rls.gradebook_support import stored_attempt

    row = stored_attempt(family, assigned_activity["id"], measured=False)
    try:
        yield row
    finally:
        admin.table("submission").delete().eq("id", row["id"]).execute()


@pytest.fixture
def peer_comment_submission(family, assigned_activity):
    from tests.rls.gradebook_support import stored_attempt

    row = stored_attempt(family, assigned_activity["id"], measured=False)
    try:
        yield row
    finally:
        admin.table("submission").delete().eq("id", row["id"]).execute()
