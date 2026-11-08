"""Browser identities prove draft grades and internal fingerprints stay private."""

from datetime import datetime, timezone

import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin
from tests.rls.gradebook_support import stored_attempt
from tests.rls.notification_support import db_value

GRADE_COLUMNS = (
    "id,activity_id,student_id,points_override,source_submission_id,"
    "revision,released_revision,released_at"
)


@pytest.fixture
def draft_grade(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    admin.table("activity").update({"points_possible": "20", "points_revision": 1}).eq(
        "id", activity
    ).execute()
    admin.table("student_work").upsert({"activity_id": activity, "student_id": student}).execute()
    return (
        admin.table("student_work_grade")
        .insert(
            {
                "activity_id": activity,
                "student_id": student,
                "points_override": "7.25",
                "source_signature": "synthetic-unpublished-signature",
            }
        )
        .execute()
        .data[0]
    )


def read_grade(client, grade):
    return (
        client.table("student_work_grade")
        .select(GRADE_COLUMNS)
        .eq("id", grade["id"])
        .execute()
        .data
    )


def test_legacy_activity_starts_bands_only(family, assigned_activity):
    row = (
        admin.table("activity")
        .select("points_possible,points_revision")
        .eq("id", assigned_activity["id"])
        .single()
        .execute()
        .data
    )
    assert row == {"points_possible": None, "points_revision": 0}
    assert (
        admin.table("student_work_grade")
        .select("id")
        .eq("activity_id", assigned_activity["id"])
        .execute()
        .data
        == []
    )


def test_missing_work_row_defaults_to_not_excused(family, assigned_activity):
    row = (
        admin.table("student_work")
        .upsert({"activity_id": assigned_activity["id"], "student_id": family["students"][0]})
        .execute()
        .data[0]
    )
    assert row["excused"] is False


def test_owner_can_read_draft_but_parents_and_other_teachers_cannot(family, draft_grade):
    assert read_grade(family["teacher_client"], draft_grade)[0]["points_override"] == 7.25
    for client in (
        family["parent_client"],
        family["other_parent_client"],
        family["other_teacher_client"],
    ):
        assert read_grade(client, draft_grade) == []


@pytest.mark.parametrize("role", ["teacher_client", "parent_client"])
def test_authenticated_role_cannot_read_fingerprints(family, draft_grade, role):
    with pytest.raises(APIError) as failure:
        family[role].table("student_work_grade").select("source_signature").eq(
            "id", draft_grade["id"]
        ).execute()
    assert failure.value.code == "42501"


@pytest.mark.parametrize("role", ["teacher_client", "parent_client"])
def test_browser_cannot_write_grade_rows(family, draft_grade, role):
    client = family[role]
    with pytest.raises(APIError) as failure:
        client.table("student_work_grade").update({"points_override": "19"}).eq(
            "id", draft_grade["id"]
        ).execute()
    assert failure.value.code == "42501"
    assert read_grade(family["teacher_client"], draft_grade)[0]["points_override"] == 7.25


def test_publication_stamp_alone_cannot_expose_a_stale_signature(family, draft_grade):
    admin.table("student_work_grade").update(
        {
            "released_revision": draft_grade["revision"],
            "released_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", draft_grade["id"]).execute()
    assert read_grade(family["parent_client"], draft_grade) == []


def test_source_hash_helper_is_service_only_and_grade_rls_enabled():
    assert (
        db_value(
            "select relrowsecurity from pg_class where oid='public.student_work_grade'::regclass"
        )
        is True
    )
    assert (
        db_value(
            "select has_column_privilege('authenticated',"
            "'public.student_work_grade','source_signature','select')"
        )
        is False
    )
    assert (
        db_value(
            "select has_function_privilege('authenticated',"
            "'writewise_internal.grade_source_signature(uuid,uuid)','execute')"
        )
        is False
    )
    assert (
        db_value(
            "select has_function_privilege('anon',"
            "'writewise_internal.grade_publication_current(uuid,uuid)','execute')"
        )
        is False
    )


@pytest.fixture
def published_automatic_grade(family, assigned_activity, draft_grade):
    activity, student = assigned_activity["id"], family["students"][0]
    source = stored_attempt(family, activity, released=True)
    try:
        admin.table("student_work_grade").update(
            {
                "points_override": None,
                "source_submission_id": source["id"],
            }
        ).eq("id", draft_grade["id"]).execute()
        signature = db_value(
            "select writewise_internal.grade_source_signature($1::uuid,$2::uuid)", activity, student
        )
        admin.table("student_work_grade").update(
            {
                "source_signature": signature,
                "released_revision": 1,
                "released_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", draft_grade["id"]).execute()
        assert len(read_grade(family["parent_client"], draft_grade)) == 1
        yield {"grade": draft_grade, "source": source, "activity": activity, "student": student}
    finally:
        admin.table("submission").delete().eq("activity_id", activity).execute()


@pytest.mark.parametrize("change", ["maximum", "source_score", "active", "source_release", "pin"])
def test_a_real_publication_fails_closed_when_live_state_changes_without_a_grade_write(
    family, published_automatic_grade, change
):
    case = published_automatic_grade
    activity, student, source = case["activity"], case["student"], case["source"]
    if change == "maximum":
        admin.table("activity").update({"points_possible": "30"}).eq("id", activity).execute()
    elif change == "source_score":
        admin.table("measurement").update({"spacing_score": "10"}).eq(
            "submission_id", source["id"]
        ).execute()
    elif change == "active":
        stored_attempt(family, activity, released=True, created_at="2099-01-01T00:00:00Z")
    elif change == "source_release":
        admin.table("submission").update({"released_at": None}).eq("id", source["id"]).execute()
    else:
        older = stored_attempt(family, activity, released=True, created_at="2020-01-01T00:00:00Z")
        admin.table("student_work").update({"pinned_submission_id": older["id"]}).eq(
            "activity_id", activity
        ).eq("student_id", student).execute()
    assert read_grade(family["parent_client"], case["grade"]) == []
    facts = (
        family["parent_client"]
        .rpc("read_child_gradebook", {"target_student_id": student})
        .execute()
        .data
    )
    cell = facts["groups"][0]["row"]["cells"][0]
    assert cell["grade_visible"] is False
    assert cell["grade_revision"] is None
    assert cell["points_override"] is None


def test_equivalent_decimal_formatting_does_not_revoke_a_current_publication(
    family, published_automatic_grade
):
    case = published_automatic_grade
    admin.table("activity").update({"points_possible": "20.00"}).eq(
        "id", case["activity"]
    ).execute()
    assert len(read_grade(family["parent_client"], case["grade"])) == 1
