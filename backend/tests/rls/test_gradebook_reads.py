"""Read RPC scope is enforced by actual caller JWTs, including empty/foreign scopes."""

from uuid import uuid4

import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin
from tests.rls.gradebook_support import caller_sql_value, stored_attempt


def test_teacher_empty_section_is_distinct_from_a_denied_scope(family):
    section = (
        admin.table("section")
        .insert({"teacher_id": family["teacher"], "name": f"Synthetic empty {uuid4().hex}"})
        .execute()
        .data[0]
    )
    try:
        book = (
            family["teacher_client"]
            .rpc("read_section_gradebook", {"target_section_id": section["id"]})
            .execute()
            .data
        )
        assert book["section_id"] == section["id"]
        assert book["activities"] == []
        assert book["rows"] == []
        with pytest.raises(APIError) as failure:
            family["other_teacher_client"].rpc(
                "read_section_gradebook", {"target_section_id": section["id"]}
            ).execute()
        assert failure.value.code == "WW404"
    finally:
        admin.table("section").delete().eq("id", section["id"]).execute()


def test_parent_cannot_query_an_unlinked_child_or_a_section(family):
    with pytest.raises(APIError) as failure:
        family["parent_client"].rpc(
            "read_child_gradebook", {"target_student_id": family["students"][2]}
        ).execute()
    assert failure.value.code == "WW404"
    with pytest.raises(APIError) as failure:
        family["parent_client"].rpc(
            "read_section_gradebook", {"target_section_id": family["sections"][0]}
        ).execute()
    assert failure.value.code == "WW404"


def test_current_section_contains_only_its_roster(family, assigned_activity):
    book = (
        family["teacher_client"]
        .rpc("read_section_gradebook", {"target_section_id": family["sections"][0]})
        .execute()
        .data
    )
    assert {row["student_id"] for row in book["rows"]} == {family["students"][0]}
    assert assigned_activity["id"] in {item["id"] for item in book["activities"]}


def test_parent_bands_only_work_has_no_invented_grade(family, assigned_activity):
    book = (
        family["parent_client"]
        .rpc("read_child_gradebook", {"target_student_id": family["students"][0]})
        .execute()
        .data
    )
    assert book["student_id"] == family["students"][0]
    assert len(book["groups"]) == 1
    group = book["groups"][0]
    assert group["teacher_id"] == family["teacher"]
    assert group["teacher_name"]
    assert group["row"]["student_id"] == family["students"][0]
    cell = next(
        cell for cell in group["row"]["cells"] if cell["activity_id"] == assigned_activity["id"]
    )
    assert cell["points_possible"] is None
    assert cell["grade_visible"] is False
    assert cell["grade_revision"] is None
    assert cell["points_override"] is None
    assert "source_signature" not in cell
    assert (
        family["parent_client"]
        .table("teacher")
        .select("id,email")
        .eq("id", family["teacher"])
        .execute()
        .data
        == []
    )


def test_sibling_without_relevant_work_does_not_inherit_another_childs_columns(
    family, assigned_activity
):
    book = (
        family["parent_client"]
        .rpc("read_child_gradebook", {"target_student_id": family["students"][1]})
        .execute()
        .data
    )
    assert book["groups"] == []


def test_archived_historical_work_survives_a_section_move(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    stored_attempt(family, activity, released=True)
    try:
        admin.table("activity").update({"is_archived": True}).eq("id", activity).execute()
        admin.table("student").update({"section_id": family["sections"][1]}).eq(
            "id", student
        ).execute()
        child = (
            family["parent_client"]
            .rpc("read_child_gradebook", {"target_student_id": student})
            .execute()
            .data
        )
        assert child["groups"][0]["activities"][0]["id"] == activity
        assert child["groups"][0]["activities"][0]["is_archived"] is True
        assert child["groups"][0]["row"]["cells"][0]["applicable"] is True
        old_section = (
            family["teacher_client"]
            .rpc("read_section_gradebook", {"target_section_id": family["sections"][0]})
            .execute()
            .data
        )
        assert all(row["student_id"] != student for row in old_section["rows"])
        new_section = (
            family["teacher_client"]
            .rpc("read_section_gradebook", {"target_section_id": family["sections"][1]})
            .execute()
            .data
        )
        row = next(row for row in new_section["rows"] if row["student_id"] == student)
        assert row["cells"][0]["activity_id"] == activity
    finally:
        admin.table("student").update({"section_id": family["sections"][0]}).eq(
            "id", student
        ).execute()
        admin.table("submission").delete().eq("activity_id", activity).execute()


def test_teacher_label_helper_does_not_disclose_an_unrelated_teacher(family, assigned_activity):
    label = caller_sql_value(
        family["parent"],
        "select writewise_internal.gradebook_teacher_name($1::uuid,$2::uuid)",
        family["other_teacher"],
        family["students"][0],
    )
    assert label is None
