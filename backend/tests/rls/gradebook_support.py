"""Synthetic gradebook setup and actual browser-role checks on the ephemeral stack."""

import asyncio
import json
import os
from datetime import datetime, timezone
from uuid import uuid4

import asyncpg

from app.core.supabase import supabase_client as admin

GRADE_COLUMNS = (
    "id,activity_id,student_id,points_override,source_submission_id,"
    "revision,released_revision,released_at"
)


def configure_points(family, activity_id, value):
    return (
        admin.rpc(
            "update_assigned_activity",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity_id,
                "payload": {"points_possible": value},
            },
        )
        .execute()
        .data
    )


def set_work(family, activity_id, payload, student_id=None):
    return (
        admin.rpc(
            "mutate_student_work",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity_id,
                "target_student_id": student_id or family["students"][0],
                "operation": "update",
                "payload": payload,
            },
        )
        .execute()
        .data
    )


def read_grade(client, activity_id, student_id):
    return (
        client.table("student_work_grade")
        .select(GRADE_COLUMNS)
        .eq("activity_id", activity_id)
        .eq("student_id", student_id)
        .execute()
        .data
    )


def release_work(family, activity_id, student_id, revision):
    return (
        admin.rpc(
            "release_student_work_grade",
            {
                "actor_id": family["teacher"],
                "target_activity_id": activity_id,
                "target_student_id": student_id,
                "expected_revision": revision,
            },
        )
        .execute()
        .data
    )


def stored_attempt(family, activity_id, *, released=False, created_at=None, measured=True):
    student = family["students"][0]
    payload = {
        "activity_id": activity_id,
        "student_id": student,
        "image_path": f"{student}/{uuid4()}.jpg",
        "status": "completed",
        "uploader_id": family["teacher"],
        "uploader_role": "teacher",
        "released_at": datetime.now(timezone.utc).isoformat() if released else None,
    }
    if created_at:
        payload["created_at"] = created_at
    row = admin.table("submission").insert(payload).execute().data[0]
    if measured:
        admin.table("measurement").insert(
            {
                "submission_id": row["id"],
                "raw_output": {},
                **{
                    f"{name}_score": "82"
                    for name in (
                        "letter_formation",
                        "size_consistency",
                        "spacing",
                        "slant",
                        "baseline_alignment",
                    )
                },
            }
        ).execute()
    return row


def caller_sql_value(caller_id, statement, *parameters):
    async def execute():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        try:
            async with connection.transaction():
                await connection.execute("set local role authenticated")
                await connection.execute(
                    "select set_config('request.jwt.claims',$1,true)",
                    json.dumps({"sub": caller_id, "role": "authenticated"}),
                )
                return await connection.fetchval(statement, *parameters)
        finally:
            await connection.close()

    return asyncio.run(execute())
