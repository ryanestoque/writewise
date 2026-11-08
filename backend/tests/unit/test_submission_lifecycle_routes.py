"""Real API handlers and Supabase SDK, with controlled external HTTP responses."""

import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from supabase import ClientOptions, create_client

from app.api.deps import get_current_user
from app.main import app

TEACHER = "11111111-1111-1111-1111-111111111111"
STUDENT = "22222222-2222-2222-2222-222222222222"
ACTIVITY = "33333333-3333-3333-3333-333333333333"
SUBMISSION = "44444444-4444-4444-4444-444444444444"
STAMP = "2026-11-02T04:00:00Z"


@pytest.fixture
def case(monkeypatch):
    from app.api import submission_lifecycle

    state = SimpleNamespace(role="teacher", owner=True, roster=True, error=None, writes=[])

    def respond(request):
        path = request.url.path.removeprefix("/rest/v1/")
        if path == "submission":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": SUBMISSION,
                        "activity_id": ACTIVITY,
                        "student_id": STUDENT,
                    }
                ],
            )
        if path == "activity":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": ACTIVITY,
                        "created_by": TEACHER,
                    }
                ]
                if state.owner
                else [],
            )
        if path == "teacher_student":
            return httpx.Response(200, json=[{"student_id": STUDENT}] if state.roster else [])
        if path == "rpc/is_assigned":
            return httpx.Response(200, json=True)
        if path.startswith("rpc/"):
            body = json.loads(request.content)
            state.writes.append(body)
            assert body["actor_id"] == TEACHER
            assert body["target_activity_id"] == ACTIVITY
            if state.error:
                return httpx.Response(
                    400,
                    json={
                        "code": state.error,
                        "message": "private database detail",
                        "details": "private",
                        "hint": None,
                    },
                )
            if path in ("rpc/assign_zero_missing", "rpc/excuse_activity_students"):
                return httpx.Response(
                    200, json={"changed_student_ids": [STUDENT], "skipped_student_ids": []}
                )
            if path == "rpc/release_student_work_grade":
                return httpx.Response(
                    200,
                    json={
                        "activity_id": ACTIVITY,
                        "student_id": STUDENT,
                        "revision": 2,
                        "released_at": STAMP,
                        "submission_id": None,
                        "rubric_released": False,
                        "grade_released": True,
                    },
                )
            if path == "rpc/release_activity_results":
                return httpx.Response(
                    200, json={"released_count": 1, "submission_ids": [SUBMISSION]}
                )
            assert body["target_student_id"] == STUDENT
            operation = body["operation"]
            if operation == "return":
                return httpx.Response(
                    200,
                    json={
                        "submission_id": SUBMISSION,
                        "status": "returned",
                        "returned_at": STAMP,
                        "returned_by": TEACHER,
                        "return_reason": "incomplete",
                        "return_note": None,
                        "released_at": None,
                        "effective_due_at": None,
                    },
                )
            if operation == "release":
                return httpx.Response(200, json={"submission_id": SUBMISSION, "released_at": STAMP})
            return httpx.Response(
                200,
                json={
                    "activity_id": ACTIVITY,
                    "student_id": STUDENT,
                    "due_at_override": None,
                    "pinned_submission_id": None,
                    "effective_due_at": None,
                    "updated_at": STAMP,
                },
            )
        raise AssertionError(f"Unexpected external operation: {path}")

    http = httpx.Client(transport=httpx.MockTransport(respond))
    sdk = create_client(
        "http://127.0.0.1:54321", "test-key", options=ClientOptions(httpx_client=http)
    )
    monkeypatch.setattr(submission_lifecycle, "supabase_client", sdk)
    app.dependency_overrides[get_current_user] = lambda: {"sub": TEACHER, "role": state.role}
    with TestClient(app) as client:
        state.client = client
        yield state
    app.dependency_overrides.clear()
    http.close()


def test_return_passes_authorized_actor_and_preserves_deadline_omission(case):
    result = case.client.post(
        f"/api/submissions/{SUBMISSION}/return", json={"reason": "incomplete"}
    )
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "returned"
    assert case.writes == [
        {
            "actor_id": TEACHER,
            "target_activity_id": ACTIVITY,
            "target_student_id": STUDENT,
            "operation": "return",
            "payload": {"reason": "incomplete", "submission_id": SUBMISSION},
        }
    ]


@pytest.mark.parametrize("owner,roster", [(False, True), (True, False)])
def test_unauthorized_return_never_starts_mutation(case, owner, roster):
    case.owner, case.roster = owner, roster
    result = case.client.post(
        f"/api/submissions/{SUBMISSION}/return", json={"reason": "incomplete"}
    )
    assert result.status_code == 404
    assert result.json()["error"]["code"] == "NOT_FOUND"
    assert case.writes == []


@pytest.mark.parametrize(
    "db_code,status,code",
    [
        ("WW432", 409, "POINTS_OVERRIDE_CONFLICT"),
        ("WW433", 409, "POINTS_REMOVAL_CONFIRMATION_REQUIRED"),
        ("WW434", 422, "VALIDATION_ERROR"),
    ],
)
def test_point_mutation_conflicts_use_codes_without_sql_details(case, db_code, status, code):
    case.error = db_code
    result = case.client.put(
        f"/api/activities/{ACTIVITY}/students/{STUDENT}/work", json={"points_override": "0"}
    )
    assert result.status_code == status
    assert result.json()["error"]["code"] == code
    assert "private" not in result.text


def test_work_point_and_excuse_inputs_preserve_omission_in_authorized_rpc(case):
    result = case.client.put(
        f"/api/activities/{ACTIVITY}/students/{STUDENT}/work",
        json={"points_override": "0", "excused": False},
    )
    assert result.status_code == 200, result.text
    assert case.writes[0]["payload"] == {"points_override": "0", "excused": False}


@pytest.mark.parametrize(
    "suffix,payload,rpc_field,value",
    [
        (f"students/{STUDENT}/release-grade", {"expected_revision": 2}, "expected_revision", 2),
        ("assign-zero-missing", {}, "target_student_ids", None),
        (
            "excuse-students",
            {"student_ids": [STUDENT], "excused": True},
            "target_student_ids",
            [STUDENT],
        ),
    ],
)
def test_gradebook_write_routes_use_authorized_service_lifecycle(
    case, suffix, payload, rpc_field, value
):
    result = case.client.post(f"/api/activities/{ACTIVITY}/{suffix}", json=payload)
    assert result.status_code == 200, result.text
    assert result.headers["Cache-Control"] == "no-store"
    assert case.writes[0][rpc_field] == value


def test_grade_release_conflict_is_sanitized_and_does_not_retry_new_revision(case):
    case.error = "WW431"
    result = case.client.post(
        f"/api/activities/{ACTIVITY}/students/{STUDENT}/release-grade",
        json={"expected_revision": 2},
    )
    assert result.status_code == 409
    assert result.json()["error"]["code"] == "GRADE_REVISION_CONFLICT"
    assert len(case.writes) == 1 and "private" not in result.text


@pytest.mark.parametrize("owner,role,status", [(False, "teacher", 404), (True, "parent", 403)])
def test_gradebook_bulk_write_requires_the_activity_owner(case, owner, role, status):
    case.owner, case.role = owner, role
    result = case.client.post(f"/api/activities/{ACTIVITY}/assign-zero-missing", json={})
    assert result.status_code == status
    assert case.writes == []


def test_parent_cannot_release_even_a_known_submission(case):
    case.role = "parent"
    result = case.client.post(f"/api/submissions/{SUBMISSION}/release")
    assert result.status_code == 403
    assert case.writes == []


@pytest.mark.parametrize(
    "db_code,status,code",
    [
        ("WW409", 409, "SUBMISSION_NOT_RETURNABLE"),
        ("WW410", 409, "SUBMISSION_NOT_RELEASABLE"),
        ("WW422", 422, "INVALID_WORK_SELECTION"),
        ("WW404", 404, "NOT_FOUND"),
        ("XX000", 500, "INTERNAL_ERROR"),
    ],
)
def test_lifecycle_maps_error_codes_without_private_exception_details(case, db_code, status, code):
    case.error = db_code
    result = case.client.post(f"/api/submissions/{SUBMISSION}/release")
    assert result.status_code == status
    assert result.json()["error"]["code"] == code
    assert result.json()["error"]["details"] == {}
    assert "private" not in result.text


def test_single_bulk_and_work_routes_are_registered(case):
    assert case.client.post(f"/api/submissions/{SUBMISSION}/release").status_code == 200
    bulk = case.client.post(f"/api/activities/{ACTIVITY}/release")
    assert bulk.status_code == 200
    assert bulk.json()["released_count"] == 1
    work = case.client.put(
        f"/api/activities/{ACTIVITY}/students/{STUDENT}/work",
        json={
            "due_at_override": None,
        },
    )
    assert work.status_code == 200
    assert case.writes[-1]["payload"] == {"due_at_override": None}
