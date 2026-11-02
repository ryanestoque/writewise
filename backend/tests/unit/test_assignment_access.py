"""Exercise real HTTP routes/SDK with controlled external database responses."""

import json
from datetime import datetime, timezone
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from supabase import ClientOptions, create_client

from app.api import activities, assignment_access, submissions
from app.api.deps import get_current_teacher, get_current_user
from app.main import app

TEACHER = "11111111-1111-1111-1111-111111111111"
STUDENT = "22222222-2222-2222-2222-222222222222"
ACTIVITY = "33333333-3333-3333-3333-333333333333"
SECTION = "44444444-4444-4444-4444-444444444444"
NOW = datetime(2026, 11, 2, 4, tzinfo=timezone.utc)


@pytest.fixture
def case(monkeypatch):
    state = SimpleNamespace(assigned=True, role="teacher", owned=True, rpc_error=None, calls=[])
    state.activity = {
        "id": ACTIVITY,
        "created_by": TEACHER,
        "created_at": "2026-11-01T00:00:00Z",
        "title": "Loops",
        "target_text": "one two three four five six",
        "instructions": None,
        "is_take_home": True,
        "is_archived": False,
        "due_at": "2026-11-02T04:00:00Z",
        "close_after_due": True,
        "assignments": [{"section_id": SECTION, "student_id": None}],
    }

    def respond(request):
        path = request.url.path.removeprefix("/rest/v1/")
        state.calls.append(path)
        if path == "rpc/is_assigned":
            assert json.loads(request.content) == {
                "target_activity_id": ACTIVITY,
                "target_student_id": STUDENT,
            }
            return httpx.Response(200, json=state.assigned)
        if path in ("rpc/create_assigned_activity", "rpc/update_assigned_activity"):
            if state.rpc_error:
                return httpx.Response(
                    400,
                    json={
                        "code": state.rpc_error,
                        "message": "private provider context",
                        "details": "private",
                        "hint": None,
                    },
                )
            return httpx.Response(200, json=state.activity)
        if path == "activity":
            return httpx.Response(200, json=[state.activity] if state.owned else [])
        if path == "section":
            return httpx.Response(200, json=[{"id": SECTION}] if state.owned else [])
        if path in ("teacher_student", "student_parent"):
            return httpx.Response(200, json=[{"student_id": STUDENT}])
        raise AssertionError(f"Unexpected database/image side effect: {path}")

    http = httpx.Client(transport=httpx.MockTransport(respond))
    sdk = create_client(
        "http://127.0.0.1:54321", "test-key", options=ClientOptions(httpx_client=http)
    )
    for module in (activities, assignment_access, submissions):
        monkeypatch.setattr(module, "supabase_client", sdk)
    app.dependency_overrides[get_current_user] = lambda: {"sub": TEACHER, "role": state.role}
    app.dependency_overrides[get_current_teacher] = lambda: {"sub": TEACHER, "role": "teacher"}
    with TestClient(app) as client:
        state.client = client
        yield state
    app.dependency_overrides.clear()
    http.close()


@pytest.mark.parametrize("role", ["parent", "teacher"])
def test_unassigned_upload_denied_before_decoding_or_storage(case, role):
    case.assigned = False
    case.role = role
    response = case.client.post(
        "/api/submissions",
        data={"activity_id": ACTIVITY, "student_id": STUDENT},
        files={"image": ("worksheet.jpg", b"not an image", "image/jpeg")},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ACTIVITY_NOT_ASSIGNED"


def test_closed_parent_upload_denied_before_decoding(case):
    case.role = "parent"
    case.activity["due_at"] = "2020-01-01T00:00:00Z"
    response = case.client.post(
        "/api/submissions",
        data={"activity_id": ACTIVITY, "student_id": STUDENT},
        files={"image": ("worksheet.jpg", b"not an image", "image/jpeg")},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SUBMISSIONS_CLOSED"


@pytest.mark.parametrize(
    "role,now,due,closed,denied",
    [
        ("parent", NOW, "2026-11-02T04:00:00Z", True, False),
        ("parent", NOW, "2026-11-02T03:59:59Z", True, True),
        ("parent", NOW, "2026-11-02T03:59:59Z", False, False),
        ("parent", NOW, None, False, False),
        ("teacher", NOW, "2026-11-02T03:59:59Z", True, False),
    ],
)
def test_deadline_boundary_and_teacher_bypass(case, role, now, due, closed, denied):
    case.activity.update(due_at=due, close_after_due=closed)
    if denied:
        with pytest.raises(HTTPException) as caught:
            assignment_access.assert_upload_allowed(case.activity, STUDENT, role, now)
        assert caught.value.status_code == 409
    else:
        assignment_access.assert_upload_allowed(case.activity, STUDENT, role, now)


def test_empty_targets_have_domain_error_not_generic_validation(case):
    response = case.client.post(
        "/api/activities",
        json={
            "title": "Loops",
            "target_text": "words",
            "assignments": [],
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_ASSIGNMENT_TARGET"
    assert not any(path.startswith("rpc/") for path in case.calls)


def test_foreign_target_does_not_start_mutation(case):
    case.owned = False
    response = case.client.post(
        "/api/activities",
        json={
            "title": "Loops",
            "target_text": "words",
            "assignments": [{"section_id": SECTION}],
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_ASSIGNMENT_TARGET"
    assert not any(path.startswith("rpc/") for path in case.calls)


@pytest.mark.parametrize(
    "db_code,status,code",
    [
        ("22023", 422, "INVALID_ASSIGNMENT_TARGET"),
        ("P0002", 404, "NOT_FOUND"),
        ("XX000", 500, "INTERNAL_ERROR"),
    ],
)
def test_mutation_errors_map_codes_without_exposing_database_context(case, db_code, status, code):
    case.rpc_error = db_code
    response = case.client.post(
        "/api/activities",
        json={
            "title": "Loops",
            "target_text": "words",
            "assignments": [{"section_id": SECTION}],
        },
    )
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert "private" not in response.text


def test_clearing_due_date_with_closure_enabled_is_invalid(case):
    response = case.client.patch(f"/api/activities/{ACTIVITY}", json={"due_at": None})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
