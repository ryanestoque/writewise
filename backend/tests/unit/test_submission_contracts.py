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


def test_manual_score_request_allows_nullable_spacing_band_only():
    from app.api.submissions import ManualScoreRequest

    req = ManualScoreRequest(
        letter_formation_band="satisfactory",
        size_consistency_band="developing",
        spacing_band=None,
        slant_band="excellent",
        baseline_alignment_band="satisfactory",
    )
    assert req.spacing_band is None

    for required_field in (
        "letter_formation_band",
        "size_consistency_band",
        "slant_band",
        "baseline_alignment_band",
    ):
        payload = {
            "letter_formation_band": "satisfactory",
            "size_consistency_band": "developing",
            "spacing_band": None,
            "slant_band": "excellent",
            "baseline_alignment_band": "satisfactory",
            required_field: None,
        }
        with pytest.raises(ValidationError):
            ManualScoreRequest.model_validate(payload)


def test_manual_score_route_forwards_null_spacing_band(monkeypatch):
    import json

    import httpx
    from fastapi.testclient import TestClient
    from supabase import ClientOptions, create_client

    from app.api import submissions
    from app.api.deps import get_current_teacher
    from app.core.config import settings
    from app.main import app

    teacher_id = "11111111-1111-1111-1111-111111111111"
    student_id = "22222222-2222-2222-2222-222222222222"
    activity_id = "33333333-3333-3333-3333-333333333333"
    submission_id = "44444444-4444-4444-4444-444444444444"
    rpc_calls = []

    def respond(request):
        path = request.url.path.removeprefix("/rest/v1/")
        if path == "submission":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": submission_id,
                        "activity_id": activity_id,
                        "student_id": student_id,
                        "status": "completed",
                    }
                ],
            )
        if path == "activity":
            return httpx.Response(200, json=[{"id": activity_id}])
        if path == "teacher_student":
            return httpx.Response(200, json=[{"student_id": student_id}])
        if path == "rpc/save_manual_submission_score":
            body = json.loads(request.content)
            rpc_calls.append(body)
            payload = body["payload"]
            return httpx.Response(
                200,
                json={
                    "letter_formation_band": payload["letter_formation_band"],
                    "letter_formation_score": 62.5,
                    "size_consistency_band": payload["size_consistency_band"],
                    "size_consistency_score": 37.5,
                    "spacing_band": payload["spacing_band"],
                    "spacing_score": None,
                    "slant_band": payload["slant_band"],
                    "slant_score": 87.5,
                    "baseline_alignment_band": payload["baseline_alignment_band"],
                    "baseline_alignment_score": 62.5,
                    "graded_by": teacher_id,
                    "created_at": "2026-11-25T00:00:00Z",
                },
            )
        raise AssertionError(f"Unexpected request: {path}")

    fake_client = create_client(
        "http://supabase.test",
        "fake-service-role-key",
        options=ClientOptions(httpx_client=httpx.Client(transport=httpx.MockTransport(respond))),
    )
    monkeypatch.setattr(settings, "SCORING_ENGINE", "manual")
    monkeypatch.setattr(submissions, "supabase_client", fake_client)
    app.dependency_overrides[get_current_teacher] = lambda: {"sub": teacher_id, "role": "teacher"}
    try:
        with TestClient(app) as client:
            resp = client.patch(
                f"/api/submissions/{submission_id}/manual-score",
                json={
                    "letter_formation_band": "satisfactory",
                    "size_consistency_band": "developing",
                    "spacing_band": None,
                    "slant_band": "excellent",
                    "baseline_alignment_band": "satisfactory",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 200, resp.text
    assert rpc_calls[0]["payload"]["spacing_band"] is None
    assert resp.json()["manual_score"]["spacing_band"] is None
    assert resp.json()["manual_score"]["spacing_score"] is None
