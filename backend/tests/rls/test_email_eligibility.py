"""Preparation rechecks current event/recipient authority using fixed database time."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.supabase import supabase_client as admin
from tests.rls.email_support import (
    completed_submission,
    outbox_rows,
    prepare_at,
    processing_claim,
    return_submission,
    seed_due_email,
)

NOW = datetime(2030, 1, 1, 12, tzinfo=timezone.utc)


@pytest.fixture
def email_case(family, assigned_activity):
    activity = assigned_activity["id"]
    row = seed_due_email(family, activity, NOW)
    try:
        yield activity, row
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()
        admin.table("parent").update({"email_notifications": True}).eq(
            "id", family["parent"]
        ).execute()


def test_wrong_claim_never_returns_a_recipient(email_case):
    _, row = email_case
    processing_claim(row["id"], NOW)
    assert prepare_at(row["id"], uuid4(), NOW) == {"state": "lost"}


def test_preparation_uses_confirmed_auth_email_not_mutable_profile(family, email_case):
    _, row = email_case
    original = admin.table("parent").select("email").eq("id", family["parent"]).execute().data[0]
    try:
        admin.table("parent").update({"email": "untrusted-profile@example.com"}).eq(
            "id", family["parent"]
        ).execute()
        result = prepare_at(row["id"], processing_claim(row["id"], NOW), NOW)
        canonical = admin.auth.admin.get_user_by_id(family["parent"]).user.email
        assert result == {"state": "ready", "event_type": "due_soon", "recipient": canonical}
    finally:
        admin.table("parent").update(original).eq("id", family["parent"]).execute()


@pytest.mark.parametrize(
    "change,code",
    [
        ("preference", "preference_off"),
        ("archive", "activity_archived"),
        ("deadline", "deadline_changed"),
        ("completed", "event_obsolete"),
    ],
)
def test_committed_state_change_suppresses_queued_reminder(family, email_case, change, code):
    activity, row = email_case
    token = processing_claim(row["id"], NOW)
    if change == "preference":
        admin.table("parent").update({"email_notifications": False}).eq(
            "id", family["parent"]
        ).execute()
    elif change == "archive":
        admin.table("activity").update({"is_archived": True}).eq("id", activity).execute()
    elif change == "deadline":
        admin.table("activity").update({"due_at": (NOW + timedelta(hours=3)).isoformat()}).eq(
            "id", activity
        ).execute()
    else:
        completed_submission(family, activity)
    assert prepare_at(row["id"], token, NOW) == {"state": "skipped", "code": code}
    state = (
        admin.table("email_outbox")
        .select("status,claim_token,lease_expires_at")
        .eq("id", row["id"])
        .execute()
        .data[0]
    )
    assert state == {"status": "skipped", "claim_token": None, "lease_expires_at": None}


def test_removed_parent_link_suppresses_queued_email(family, email_case):
    _, row = email_case
    link = {"parent_id": family["parent"], "student_id": family["students"][0]}
    try:
        admin.table("student_parent").delete().eq("parent_id", link["parent_id"]).eq(
            "student_id", link["student_id"]
        ).execute()
        assert prepare_at(row["id"], processing_claim(row["id"], NOW), NOW) == {
            "state": "skipped",
            "code": "relationship_revoked",
        }
    finally:
        admin.table("student_parent").upsert(link).execute()


@pytest.mark.parametrize(
    "offset,allowed", [(timedelta(0), True), (timedelta(microseconds=1), False)]
)
def test_due_boundary_is_inclusive_and_past_due_is_obsolete(email_case, offset, allowed):
    _, row = email_case
    check = NOW + timedelta(hours=2) + offset
    result = prepare_at(row["id"], processing_claim(row["id"], check), check)
    assert result["state"] == ("ready" if allowed else "skipped")
    if not allowed:
        assert result["code"] == "event_obsolete"


def test_a_later_return_supersedes_an_unsent_earlier_request(family, assigned_activity):
    activity = assigned_activity["id"]
    try:
        return_submission(family, activity)
        older = outbox_rows(activity)[0]
        return_submission(family, activity)
        check = datetime.now(timezone.utc)
        assert prepare_at(older["id"], processing_claim(older["id"], check), check) == {
            "state": "skipped",
            "code": "event_obsolete",
        }
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()
