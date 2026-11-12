"""Real Bearer identities exercise the RLS read path through the mounted API."""

import csv
import io
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.supabase import supabase_client as admin
from app.main import app
from tests.rls.notification_support import db_value


@pytest.fixture
def real_client():
    overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(overrides)


def bearer(client):
    return {"Authorization": "Bearer " + client.auth.get_session().access_token}


def test_real_teacher_json_and_csv_share_an_authorized_section(
    family, assigned_activity, real_client
):
    section = family["sections"][0]
    headers = bearer(family["teacher_client"])
    result = real_client.get(f"/api/sections/{section}/gradebook", headers=headers)
    assert result.status_code == 200, result.text
    book = result.json()
    assert [row["student_id"] for row in book["rows"]] == [family["students"][0]]
    assert result.headers["cache-control"] == "no-store"
    exported = real_client.get(f"/api/sections/{section}/gradebook.csv", headers=headers)
    assert exported.status_code == 200
    csv_rows = list(csv.DictReader(io.StringIO(exported.content.decode("utf-8-sig"))))
    assert len(csv_rows) == 1
    assert csv_rows[0]["student_id"] == book["rows"][0]["student_id"]
    assert csv_rows[0]["overall_percentage"] == ""
    assert "source_signature" not in result.text


def test_real_parent_cannot_read_a_section_or_a_foreign_child(
    family, assigned_activity, real_client
):
    headers = bearer(family["parent_client"])
    for suffix in ("gradebook", "gradebook.csv"):
        result = real_client.get(f"/api/sections/{family['sections'][0]}/{suffix}", headers=headers)
        assert result.status_code == 403
    foreign = real_client.get(
        f"/api/students/{family['students'][2]}/gradebook", headers=headers
    )
    assert foreign.status_code == 404
    assert foreign.json()["error"]["code"] == "NOT_FOUND"
    own = real_client.get(f"/api/students/{family['students'][0]}/gradebook", headers=headers)
    assert own.status_code == 200
    assert own.json()["student_id"] == family["students"][0]


def test_real_parent_has_no_derived_fallback_after_a_released_override_becomes_draft(
    family, assigned_activity, real_client, request
):
    activity, student = assigned_activity["id"], family["students"][0]
    admin.table("activity").update({"points_possible": "20", "points_revision": 1}).eq(
        "id", activity
    ).execute()
    admin.table("student_work").upsert({"activity_id": activity, "student_id": student}).execute()
    submission = admin.table("submission").insert({
        "activity_id": activity, "student_id": student, "image_path": f"{student}/synthetic.jpg",
        "status": "completed", "released_at": datetime.now(timezone.utc).isoformat(),
        "uploader_id": family["teacher"], "uploader_role": "teacher",
    }).execute().data[0]
    request.addfinalizer(
        lambda: admin.table("submission").delete().eq("id", submission["id"]).execute()
    )
    admin.table("measurement").insert({
        "submission_id": submission["id"], "raw_output": {},
        **{f"{name}_score": 82 for name in (
            "letter_formation", "size_consistency", "spacing", "slant", "baseline_alignment"
        )},
    }).execute()
    grade = admin.table("student_work_grade").insert({
        "activity_id": activity, "student_id": student, "points_override": "3",
        "source_submission_id": submission["id"], "source_signature": "pending",
    }).execute().data[0]
    signature = db_value("select writewise_internal.grade_source_signature($1::uuid,$2::uuid)",
                         activity, student)
    admin.table("student_work_grade").update({
        "source_signature": signature, "released_revision": 1,
        "released_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", grade["id"]).execute()
    headers = bearer(family["parent_client"])
    result = real_client.get(f"/api/students/{student}/gradebook", headers=headers)
    assert result.status_code == 200, result.text
    row = result.json()["groups"][0]["row"]
    assert row["cells"][0]["final_points"] == "3.00"
    assert row["totals"]["percentage"] == "15.00"
    admin.table("student_work_grade").update({
        "points_override": "4", "revision": 2, "released_revision": None, "released_at": None,
    }).eq("id", grade["id"]).execute()
    changed = real_client.get(f"/api/students/{student}/gradebook", headers=headers)
    assert changed.status_code == 200
    row = changed.json()["groups"][0]["row"]
    assert row["cells"][0]["final_points"] is None
    assert row["cells"][0]["automatic_points"] is None
    assert row["cells"][0]["grade_revision"] is None
    assert row["cells"][0]["assessment_composite"] == "82.00"
    assert row["totals"]["percentage"] is None


def test_more_than_a_thousand_cells_are_not_silently_truncated(family, real_client):
    students, activities = [], []
    try:
        students = admin.table("student").insert([
            {"full_name": f"Synthetic large {index:03}", "section": "Synthetic",
             "section_id": family["sections"][0]} for index in range(90)
        ]).execute().data
        admin.table("teacher_student").insert([
            {"teacher_id": family["teacher"], "student_id": student["id"]}
            for student in students
        ]).execute()
        for index in range(12):
            activity = admin.rpc("create_assigned_activity", {
                "actor_id": family["teacher"], "payload": {
                    "title": f"Synthetic grid {index}",
                    "target_text": "one two three four five six",
                    "assignments": [{"section_id": family["sections"][0]}],
                },
            }).execute().data
            activities.append(activity["id"])
        response = real_client.get(
            f"/api/sections/{family['sections'][0]}/gradebook",
            headers=bearer(family["teacher_client"]),
        )
        assert response.status_code == 200, response.text
        book = response.json()
        assert len(book["rows"]) == 91
        assert len(book["activities"]) == 12
        assert sum(len(row["cells"]) for row in book["rows"]) == 1092
    finally:
        if activities:
            admin.table("activity").delete().in_("id", activities).execute()
        if students:
            admin.table("student").delete().in_(
                "id", [student["id"] for student in students]
            ).execute()
