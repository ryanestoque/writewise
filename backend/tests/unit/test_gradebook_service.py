"""The same publication-aware assembler supplies portal values and export totals."""

from copy import deepcopy
from decimal import Decimal

import pytest

from app.scoring.provider import get_score_provider

STUDENT = "22222222-2222-2222-2222-222222222222"
ACTIVITY = "33333333-3333-3333-3333-333333333333"
SUBMISSION = "44444444-4444-4444-4444-444444444444"
TEACHER = "11111111-1111-1111-1111-111111111111"
SECTION = "55555555-5555-5555-5555-555555555555"
CRITERIA = ("letter_formation", "size_consistency", "spacing", "slant", "baseline_alignment")


def cell_fact(**changes):
    return {
        "activity_id": ACTIVITY, "student_id": STUDENT, "applicable": True,
        "coursework_status": "Missing", "late": False, "excused": False,
        "points_possible": "20.00", "active_submission_id": None,
        "grade_visible": True, "publication_current": False, "grade_revision": 1,
        "points_override": "0.00", "measurement": None, "manual_score": None,
    } | changes


def section_facts(cells=None):
    return {
        "section_id": SECTION, "section_name": "Synthetic section", "teacher_id": TEACHER,
        "activities": [{"id": ACTIVITY, "title": "Synthetic activity",
                        "created_at": "2026-11-08T00:00:00Z", "is_archived": False,
                        "points_possible": "20.00"}],
        "rows": [{"student_id": STUDENT, "student_name": "Synthetic child",
                  "cells": cells if cells is not None else [cell_fact()]}],
    }


def measured(value="82"):
    return {f"{criterion}_score": value for criterion in CRITERIA}


def test_teacher_draft_automatic_points_enter_only_the_teacher_total():
    from app.gradebook.service import build_cell

    fact = cell_fact(coursework_status="Draft", active_submission_id=SUBMISSION,
                     points_override=None, measurement=measured())
    cell = build_cell(fact, audience="teacher", provider=get_score_provider("manual"))
    assert cell.final_points == Decimal("16.40")
    assert cell.included is True
    assert cell.publication == "draft"


@pytest.mark.parametrize("visible,current", [(False, False), (True, False), (False, True)])
def test_parent_has_no_fallback_over_a_hidden_or_stale_grade(visible, current):
    from app.gradebook.service import build_cell

    fact = cell_fact(grade_visible=visible, publication_current=current,
                     coursework_status="Draft", active_submission_id=SUBMISSION,
                     measurement=measured(), points_override="3.00")
    cell = build_cell(fact, audience="parent", provider=get_score_provider("calibrated"))
    assert cell.final_points is None
    assert cell.automatic_points is None
    assert cell.points_override is None
    assert cell.grade_revision is None
    assert cell.included is False
    assert cell.publication == "unavailable"
    assert cell.coursework_status == "Turned in"


def test_released_zero_without_upload_enters_parent_denominator_without_a_fake_assessment():
    from app.gradebook.service import build_cell

    cell = build_cell(cell_fact(publication_current=True), audience="parent",
                      provider=get_score_provider("calibrated"))
    assert cell.final_points == 0
    assert cell.included is True
    assert cell.coursework_status == "Missing"
    assert cell.assessment_composite is None
    assert cell.active_submission_id is None


def test_excused_retains_the_teacher_override_but_never_contributes():
    from app.gradebook.service import build_cell

    cell = build_cell(cell_fact(excused=True), audience="teacher",
                      provider=get_score_provider("manual"))
    assert cell.coursework_status == "Excused"
    assert cell.points_override == 0
    assert cell.included is False
    assert cell.late is False


def test_missing_without_an_override_is_not_an_automatic_zero():
    from app.gradebook.service import build_cell

    cell = build_cell(cell_fact(points_override=None), audience="teacher",
                      provider=get_score_provider("manual"))
    assert cell.final_points is None
    assert cell.included is False


def test_bands_only_retains_released_assessment_without_inventing_points():
    from app.gradebook.service import build_cell

    fact = cell_fact(points_possible=None, grade_visible=False, points_override=None,
                     active_submission_id=SUBMISSION, coursework_status="Released",
                     measurement=measured())
    cell = build_cell(fact, audience="parent", provider=get_score_provider("manual"))
    assert cell.assessment_composite == Decimal("82")
    assert cell.assessment_source == "calibrated"
    assert cell.final_points is None
    assert cell.included is False


def test_non_applicable_cells_cannot_display_or_contribute_any_points():
    from app.gradebook.service import build_cell

    cell = build_cell(cell_fact(applicable=False), audience="teacher",
                      provider=get_score_provider("manual"))
    assert cell.coursework_status == "Not assigned"
    assert cell.final_points is None
    assert cell.points_possible is None
    assert cell.included is False


def test_no_active_attempt_cannot_derive_points_from_a_historical_record():
    from app.gradebook.service import build_cell

    cell = build_cell(cell_fact(points_override=None, measurement=measured()), audience="teacher",
                      provider=get_score_provider("manual"))
    assert cell.final_points is None
    assert cell.assessment_composite is None


def test_totals_weight_mixed_maxima_and_keep_archived_contributions():
    from app.gradebook.service import assemble_section

    other = "66666666-6666-6666-6666-666666666666"
    facts = section_facts([
        cell_fact(points_override="16.40", publication_current=True),
        cell_fact(activity_id=other, points_possible="10", publication_current=True),
    ])
    facts["activities"].append({"id": other, "title": "Archived synthetic",
                                 "created_at": "2026-11-07T00:00:00Z", "is_archived": True,
                                 "points_possible": "10"})
    book = assemble_section(facts, get_score_provider("manual"))
    assert book.rows[0].totals.model_dump(mode="json") == {
        "earned": "16.40", "possible": "30.00", "percentage": "54.67"
    }


def test_no_included_grades_have_an_unknown_overall_not_zero():
    from app.gradebook.service import assemble_section

    book = assemble_section(section_facts([cell_fact(points_override=None)]),
                            get_score_provider("manual"))
    assert book.rows[0].totals.percentage is None


def test_duplicate_pair_facts_cannot_double_count_a_grade():
    from app.gradebook.service import assemble_section

    facts = section_facts([cell_fact(), cell_fact()])
    with pytest.raises(ValueError):
        assemble_section(facts, get_score_provider("manual"))


def test_a_missing_cell_cannot_silently_change_the_denominator():
    from app.gradebook.service import assemble_section

    with pytest.raises(ValueError):
        assemble_section(section_facts([]), get_score_provider("manual"))


def test_child_assembly_cannot_accept_a_different_students_row():
    from app.gradebook.service import assemble_child

    facts = {"student_id": "77777777-7777-7777-7777-777777777777", "groups": [{
        "teacher_id": TEACHER, "teacher_name": "Synthetic teacher",
        "activities": section_facts()["activities"], "row": section_facts()["rows"][0],
    }]}
    with pytest.raises(ValueError):
        assemble_child(facts, get_score_provider("manual"))


def test_assembler_does_not_mutate_the_fact_snapshot():
    from app.gradebook.service import assemble_section

    facts = section_facts()
    original = deepcopy(facts)
    assemble_section(facts, get_score_provider("manual"))
    assert facts == original
