"""Existing activity/work routes expose the same strict grade inputs."""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.api.activity_contracts import ActivityCreate, ActivityUpdate
from app.api.submission_contracts import StudentWorkUpdate


def test_activity_create_accepts_points_and_update_keeps_omission_distinct():
    request = ActivityCreate(
        title="Practice", target_text="hello", assignments=[], points_possible="20"
    )
    assert request.points_possible == Decimal(20)
    assert ActivityUpdate(title="Practice").model_dump(exclude_unset=True) == {"title": "Practice"}
    assert ActivityUpdate(points_possible=None, confirm_remove_points=True).model_dump(
        exclude_unset=True
    ) == {"points_possible": None, "confirm_remove_points": True}


@pytest.mark.parametrize("value", [True, "0", "-1", "1.001", "NaN", "10000"])
def test_exposed_activity_contract_reuses_points_validation(value):
    with pytest.raises(ValidationError):
        ActivityUpdate(points_possible=value)


def test_exposed_removal_confirmation_requires_explicit_null():
    with pytest.raises(ValidationError):
        ActivityUpdate(confirm_remove_points=True)


def test_work_update_supports_zero_clear_excuse_and_existing_deadline():
    assert StudentWorkUpdate(points_override="0").points_override == Decimal(0)
    assert StudentWorkUpdate(points_override=None).model_dump(exclude_unset=True) == {
        "points_override": None
    }
    assert StudentWorkUpdate(excused=False).model_dump(exclude_unset=True) == {"excused": False}
    assert StudentWorkUpdate(due_at_override=None).model_dump(exclude_unset=True) == {
        "due_at_override": None
    }
    with pytest.raises(ValidationError):
        StudentWorkUpdate(excused=None)
