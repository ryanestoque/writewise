"""Synthetic email events emitted by the real coursework transactions."""

import json
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


def processing_claim(row_id, as_of):
    token = uuid4()
    baseline = outbox_row(row_id)["attempts"]
    admin.table("email_outbox").update(
        {
            "status": "processing",
            "claim_token": str(token),
            "claim_attempts": baseline,
            "lease_expires_at": (as_of + timedelta(minutes=2)).isoformat(),
        }
    ).eq("id", row_id).execute()
    return token


def prepare_at(row_id, token, as_of):
    raw = db_value(
        "select writewise_internal.prepare_email_delivery_at($1,$2,$3)", row_id, token, as_of
    )
    return json.loads(raw) if isinstance(raw, str) else raw


def claim_at(as_of):
    raw = db_value("select writewise_internal.claim_email_delivery_at($1)", as_of)
    return json.loads(raw) if isinstance(raw, str) else raw


def authorize_at(row_id, token, recipient, digest, as_of):
    raw = db_value(
        "select writewise_internal.authorize_email_delivery_at($1,$2,$3,$4,$5)",
        row_id,
        token,
        recipient,
        digest,
        as_of,
    )
    return json.loads(raw) if isinstance(raw, str) else raw


def finish_at(row_id, token, outcome, as_of, *, provider_id=None, error_code=None, retry_at=None):
    return db_value(
        "select writewise_internal.finish_email_delivery_at($1,$2,$3,$4,$5,$6,$7)",
        row_id,
        token,
        outcome,
        provider_id,
        error_code,
        retry_at,
        as_of,
    )


def outbox_row(row_id):
    return admin.table("email_outbox").select("*").eq("id", row_id).execute().data[0]
