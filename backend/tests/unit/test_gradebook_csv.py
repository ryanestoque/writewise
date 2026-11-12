"""Class-record CSV exports the same cells and totals, without spreadsheet formulas."""

import csv
import io

import pytest


@pytest.mark.parametrize("value", ["=1+2", " +1", "-1+2", "@SUM(A1)", "\ttext", "\n=1"])
def test_formula_like_user_text_is_neutralized(value):
    from app.gradebook.csv_export import csv_text

    assert csv_text(value) == "'" + value


def test_plain_text_is_not_changed():
    from app.gradebook.csv_export import csv_text

    assert csv_text("Synthetic child") == "Synthetic child"
    assert csv_text("") == ""


def test_export_keeps_unicode_quoting_decimal_values_and_server_totals():
    from app.gradebook.contracts import SectionGradebook
    from app.gradebook.csv_export import render_gradebook_csv

    activity = "33333333-3333-3333-3333-333333333333"
    student = "22222222-2222-2222-2222-222222222222"
    book = SectionGradebook.model_validate({
        "section_id": "55555555-5555-5555-5555-555555555555",
        "section_name": "Synthetic", "teacher_id": "11111111-1111-1111-1111-111111111111",
        "activities": [{"id": activity, "title": '=A1,"synthetic"',
                        "created_at": "2026-11-08T00:00:00Z", "is_archived": False,
                        "points_possible": "20.00"}],
        "rows": [{"student_id": student, "student_name": "Synthetic Niño, Jr.",
                  "cells": [{"activity_id": activity, "student_id": student,
                             "applicable": True, "coursework_status": "Missing", "late": False,
                             "points_possible": "20.00", "automatic_points": None,
                             "points_override": "0.00", "final_points": "0.00",
                             "assessment_composite": None, "assessment_source": None,
                             "publication": "released", "grade_revision": 1,
                             "active_submission_id": None, "included": True}],
                  "totals": {"earned": "0.00", "possible": "20.00", "percentage": "0.00"}}],
    })
    result = render_gradebook_csv(book)
    assert result.startswith(b"\xef\xbb\xbf")
    rows = list(csv.DictReader(io.StringIO(result.decode("utf-8-sig"))))
    assert rows[0]["student_name"] == "Synthetic Niño, Jr."
    assert rows[0]["activity_title"] == "'=A1,\"synthetic\""
    assert rows[0]["final_points"] == "0.00"
    assert rows[0]["overall_percentage"] == "0.00"
    assert rows[0]["publication"] == "released"
    assert "source_signature" not in rows[0]


def test_empty_export_contains_the_header_without_a_fake_student():
    from app.gradebook.contracts import SectionGradebook
    from app.gradebook.csv_export import render_gradebook_csv

    book = SectionGradebook(
        section_id="55555555-5555-5555-5555-555555555555", section_name="Synthetic",
        teacher_id="11111111-1111-1111-1111-111111111111", activities=[], rows=[],
    )
    result = render_gradebook_csv(book).decode("utf-8-sig")
    assert result.startswith("student_name,student_id,")
    assert len(list(csv.DictReader(io.StringIO(result)))) == 0
