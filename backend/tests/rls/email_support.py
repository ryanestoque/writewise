"""Synthetic email events emitted by the real coursework transactions."""

from datetime import timedelta
from uuid import uuid4

from app.core.supabase import supabase_client as admin
from tests.rls.notification_support import db_value


def seed_due_email(family, activity, as_of):
    admin.table("activity").update({"due_at": (as_of + timedelta(hours=2)).isoformat()}).eq(
        "id", activity
    ).execute()
    db_value("select writewise_internal.enqueue_time_based_notifications_at($1)", as_of)
    notice = (
        admin.table("notification")
        .select("id")
        .eq("activity_id", activity)
        .eq("student_id", family["students"][0])
        .eq("recipient_id", family["parent"])
        .eq("type", "due_soon")
        .execute()
        .data[0]
    )
    return (
        admin.table("email_outbox")
        .select("*")
        .eq("notification_id", notice["id"])
        .execute()
        .data[0]
    )


def completed_submission(family, activity):
    student = family["students"][0]
    return (
        admin.table("submission")
        .insert(
            {
                "student_id": student,
                "activity_id": activity,
                "status": "completed",
                "image_path": f"{student}/{uuid4()}.jpg",
                "uploader_id": family["teacher"],
                "uploader_role": "teacher",
            }
        )
        .execute()
        .data[0]
    )


def return_submission(family, activity):
    submission = completed_submission(family, activity)
    admin.rpc(
        "mutate_student_work",
        {
            "actor_id": family["teacher"],
            "target_activity_id": activity,
            "target_student_id": family["students"][0],
            "operation": "return",
            "payload": {"submission_id": submission["id"], "reason": "other"},
        },
    ).execute()
    return submission


def outbox_rows(activity):
    notices = admin.table("notification").select("id").eq("activity_id", activity).execute().data
    if not notices:
        return []
    return (
        admin.table("email_outbox")
        .select("*")
        .in_("notification_id", [notice["id"] for notice in notices])
        .execute()
        .data
    )
