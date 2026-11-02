"""Request contract checks runnable without a database (--confcutdir=tests/unit)."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.activities import ActivityCreate, ActivityUpdate


def valid_activity(**changes):
    return {
        "title": "Loop practice",
        "target_text": "one two three four five six",
        "assignments": [{"section_id": str(uuid4())}],
        **changes,
    }


@pytest.mark.parametrize("field", ["title", "assignments"])
def test_new_activity_requires_title_and_explicit_targets(field):
    payload = valid_activity()
    del payload[field]
    with pytest.raises(ValidationError):
        ActivityCreate.model_validate(payload)


@pytest.mark.parametrize(
    "target",
    [
        {},
        {"section_id": str(uuid4()), "student_id": str(uuid4())},
        {"student_id": "not-a-uuid"},
        {"student_id": str(uuid4()), "teacher_id": str(uuid4())},
    ],
)
def test_assignment_target_requires_exactly_one_valid_id(target):
    with pytest.raises(ValidationError):
        ActivityCreate.model_validate(valid_activity(assignments=[target]))


def test_title_and_target_text_are_trimmed():
    activity = ActivityCreate.model_validate(
        valid_activity(title="  Loops  ", target_text="  loops  ")
    )
    assert activity.title == "Loops"
    assert activity.target_text == "loops"


def test_deadline_requires_timezone_offset():
    with pytest.raises(ValidationError):
        ActivityCreate.model_validate(valid_activity(due_at="2026-11-02T12:00:00"))


@pytest.mark.parametrize(
    "field", ["title", "target_text", "assignments", "is_take_home", "close_after_due"]
)
def test_patch_disallows_explicit_null_for_nonnullable_fields(field):
    with pytest.raises(ValidationError):
        ActivityUpdate.model_validate({field: None})


def test_patch_preserves_omissions_and_nullable_clears():
    assert ActivityUpdate.model_validate({}).model_dump(exclude_unset=True) == {}
    patch = ActivityUpdate.model_validate({"instructions": None, "due_at": None})
    assert patch.model_dump(exclude_unset=True) == {"instructions": None, "due_at": None}
