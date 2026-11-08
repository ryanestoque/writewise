"""Read RPC scope is enforced by actual caller JWTs, including empty/foreign scopes."""

from uuid import uuid4

import pytest
from postgrest.exceptions import APIError

from app.core.supabase import supabase_client as admin


def test_teacher_empty_section_is_distinct_from_a_denied_scope(family):
    section = admin.table("section").insert({
        "teacher_id": family["teacher"], "name": f"Synthetic empty {uuid4().hex}"
    }).execute().data[0]
    try:
        book = family["teacher_client"].rpc("read_section_gradebook", {
            "target_section_id": section["id"]
        }).execute().data
        assert book["section_id"] == section["id"]
        assert book["activities"] == []
        assert book["rows"] == []
        with pytest.raises(APIError) as failure:
            family["other_teacher_client"].rpc("read_section_gradebook", {
                "target_section_id": section["id"]
            }).execute()
        assert failure.value.code == "WW404"
    finally:
        admin.table("section").delete().eq("id", section["id"]).execute()


def test_parent_cannot_query_an_unlinked_child_or_a_section(family):
    with pytest.raises(APIError) as failure:
        family["parent_client"].rpc("read_child_gradebook", {
            "target_student_id": family["students"][2]
        }).execute()
    assert failure.value.code == "WW404"
    with pytest.raises(APIError) as failure:
        family["parent_client"].rpc("read_section_gradebook", {
            "target_section_id": family["sections"][0]
        }).execute()
    assert failure.value.code == "WW404"


def test_current_section_contains_only_its_roster(family, assigned_activity):
    book = family["teacher_client"].rpc("read_section_gradebook", {
        "target_section_id": family["sections"][0]
    }).execute().data
    assert {row["student_id"] for row in book["rows"]} == {family["students"][0]}
    assert assigned_activity["id"] in {item["id"] for item in book["activities"]}


def test_parent_bands_only_work_has_no_invented_grade(family, assigned_activity):
    book = family["parent_client"].rpc("read_child_gradebook", {
        "target_student_id": family["students"][0]
    }).execute().data
    assert book["student_id"] == family["students"][0]
    assert len(book["groups"]) == 1
    group = book["groups"][0]
    assert group["teacher_id"] == family["teacher"]
    assert group["teacher_name"]
    assert group["row"]["student_id"] == family["students"][0]
    cell = next(cell for cell in group["row"]["cells"]
                if cell["activity_id"] == assigned_activity["id"])
    assert cell["points_possible"] is None
    assert cell["grade_visible"] is False
    assert cell["grade_revision"] is None
    assert cell["points_override"] is None
    assert "source_signature" not in cell
    assert family["parent_client"].table("teacher").select("id,email").eq(
        "id", family["teacher"]
    ).execute().data == []


def test_sibling_without_relevant_work_does_not_inherit_another_childs_columns(
    family, assigned_activity
):
    book = family["parent_client"].rpc("read_child_gradebook", {
        "target_student_id": family["students"][1]
    }).execute().data
    assert book["groups"] == []
