"""Strict gradebook input and decimal response contracts, independent of SQL."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

import pytest
from pydantic import ValidationError

ACTIVITY = UUID("33333333-3333-3333-3333-333333333333")
STUDENT = UUID("22222222-2222-2222-2222-222222222222")


@pytest.mark.parametrize("value", ["0", "-1", "1.001", "NaN", "Infinity", "10000", True])
def test_invalid_activity_points_are_rejected(value):
    from app.gradebook.contracts import ActivityPointsUpdate

    with pytest.raises(ValidationError):
        ActivityPointsUpdate(points_possible=value)


def test_null_points_preserve_explicit_removal_and_default_omission():
    from app.gradebook.contracts import ActivityPointsUpdate

    assert ActivityPointsUpdate().model_dump(exclude_unset=True) == {}
    assert ActivityPointsUpdate(points_possible=None).model_dump(exclude_unset=True) == {
        "points_possible": None
    }


def test_removal_confirmation_requires_explicit_null_points():
    from app.gradebook.contracts import ActivityPointsUpdate

    with pytest.raises(ValidationError):
        ActivityPointsUpdate(confirm_remove_points=True)
    with pytest.raises(ValidationError):
        ActivityPointsUpdate(points_possible="20", confirm_remove_points=True)
    assert ActivityPointsUpdate(points_possible=None, confirm_remove_points=True)


@pytest.mark.parametrize("value", ["-1", "1.001", "NaN", "Infinity", "10000", True])
def test_invalid_point_overrides_are_rejected(value):
    from app.gradebook.contracts import WorkGradeUpdate

    with pytest.raises(ValidationError):
        WorkGradeUpdate(points_override=value)


def test_work_grade_zero_and_null_reset_are_distinct_from_an_omitted_field():
    from app.gradebook.contracts import WorkGradeUpdate

    assert WorkGradeUpdate(points_override="0").points_override == Decimal(0)
    assert WorkGradeUpdate(points_override=None).model_dump(exclude_unset=True) == {
        "points_override": None
    }
    assert WorkGradeUpdate(excused=False).model_dump(exclude_unset=True) == {"excused": False}
    with pytest.raises(ValidationError):
        WorkGradeUpdate()
    with pytest.raises(ValidationError):
        WorkGradeUpdate(excused=None)


@pytest.mark.parametrize("revision", [0, -1, True, "2"])
def test_release_requires_an_actual_positive_integer_revision(revision):
    from app.gradebook.contracts import GradeReleaseRequest

    with pytest.raises(ValidationError):
        GradeReleaseRequest(expected_revision=revision)


@pytest.mark.parametrize("model_name", ["AssignZeroMissingRequest", "ExcuseStudentsRequest"])
def test_explicit_empty_bulk_selection_is_rejected(model_name):
    from app.gradebook import contracts

    model = getattr(contracts, model_name)
    with pytest.raises(ValidationError):
        model(student_ids=[], excused=True) if model_name == "ExcuseStudentsRequest" else model(
            student_ids=[]
        )


def test_optional_zero_selection_and_duplicate_ids_are_normalized():
    from app.gradebook.contracts import AssignZeroMissingRequest

    assert AssignZeroMissingRequest().student_ids is None
    request = AssignZeroMissingRequest(student_ids=[STUDENT, STUDENT])
    assert request.student_ids == [STUDENT]
    with pytest.raises(ValidationError):
        AssignZeroMissingRequest(student_ids=None)


def test_forged_actor_or_role_fields_are_forbidden():
    from app.gradebook.contracts import GradeReleaseRequest

    with pytest.raises(ValidationError):
        GradeReleaseRequest(expected_revision=1, actor_id=str(STUDENT))
    with pytest.raises(ValidationError):
        GradeReleaseRequest(expected_revision=1, role="teacher")


def test_decimal_responses_use_two_place_strings_without_exposing_signatures():
    from app.gradebook.contracts import GradebookTotals, WorkGradeRecord

    totals = GradebookTotals(earned=Decimal("16.4"), possible=Decimal("20"), percentage=None)
    assert totals.model_dump(mode="json") == {
        "earned": "16.40", "possible": "20.00", "percentage": None
    }
    grade = WorkGradeRecord(
        id=ACTIVITY, activity_id=ACTIVITY, student_id=STUDENT,
        points_override=Decimal(0), source_submission_id=None,
        revision=1, released_revision=1, released_at=datetime.now(timezone.utc),
    )
    assert grade.model_dump(mode="json")["points_override"] == "0.00"
    with pytest.raises(ValidationError):
        WorkGradeRecord(**grade.model_dump(), source_signature="private")
