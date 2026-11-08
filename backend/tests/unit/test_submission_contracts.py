"""Lifecycle validation protects deadlines, pin identity, and note boundaries."""

import pytest
from pydantic import ValidationError


def contracts():
    from app.api.submission_contracts import ReturnSubmissionRequest, StudentWorkUpdate

    return ReturnSubmissionRequest, StudentWorkUpdate


def test_return_deadline_omission_is_distinct_from_reset():
    request, _ = contracts()
    assert "resubmit_due_at" not in request(reason="incomplete").model_fields_set
    assert "resubmit_due_at" in request(reason="incomplete", resubmit_due_at=None).model_fields_set


@pytest.mark.parametrize("note,expected", [("  Try again  ", "Try again"), ("  ", None)])
def test_return_note_is_trimmed_and_blank_is_null(note, expected):
    request, _ = contracts()
    assert request(reason="other", note=note).note == expected


@pytest.mark.parametrize(
    "payload",
    [
        {"reason": "typo"},
        {"reason": "other", "note": "a" * 2001},
        {"reason": "other", "resubmit_due_at": "2026-11-04T12:00:00"},
        {"reason": "other", "returned_by": "teacher"},
    ],
)
def test_invalid_return_input_cannot_enter_lifecycle(payload):
    request, _ = contracts()
    with pytest.raises(ValidationError):
        request.model_validate(payload)


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"earned_points": 0},
        {"pinned_submission_id": "bad-uuid"},
        {"due_at_override": "2026-11-04T12:00:00"},
    ],
)
def test_invalid_work_updates_cannot_mutate_work(payload):
    _, request = contracts()
    with pytest.raises(ValidationError):
        request.model_validate(payload)


def test_work_reset_and_offset_deadline_are_preserved():
    _, request = contracts()
    reset = request(pinned_submission_id=None)
    assert reset.model_dump(mode="json", exclude_unset=True) == {"pinned_submission_id": None}
    deadline = request(due_at_override="2026-11-04T12:00:00+08:00")
    assert deadline.due_at_override.isoformat() == "2026-11-04T12:00:00+08:00"


@pytest.mark.parametrize("role", ["parent", "unknown"])
def test_upload_response_never_discloses_draft_measurements_to_non_teacher(role):
    from app.api.submission_contracts import create_upload_response

    response = create_upload_response(
        "11111111-1111-1111-1111-111111111111",
        {"scores": {"composite_score": 80}, "raw_output": {"private": True}},
        role,
    )
    assert response.measurement is None
    assert response.released_at is None
    assert response.status == "completed"


def test_teacher_upload_response_retains_measurements_for_review():
    from app.api.submission_contracts import create_upload_response

    response = create_upload_response(
        "11111111-1111-1111-1111-111111111111", {"scores": {"composite_score": 80}}, "teacher"
    )
    assert response.measurement == {"scores": {"composite_score": 80}}
