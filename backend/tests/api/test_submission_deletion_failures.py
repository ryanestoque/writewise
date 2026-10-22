"""Deletion failure contracts, using the real SDK against controlled HTTP responses.

No hosted project is contacted. The full integration suite separately verifies
Storage removal and Postgres cascades against the ephemeral Supabase stack.
Default suite collection still loads tests/conftest.py and requires that stack;
an isolated run uses --confcutdir=tests/api and dummy local Supabase settings.
"""

import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from supabase import ClientOptions, create_client

from app.api import submissions
from app.api.deps import get_current_user
from app.core.config import settings
from app.main import app

TEACHER_ID = "11111111-1111-1111-1111-111111111111"
STUDENT_ID = "22222222-2222-2222-2222-222222222222"
SUBMISSION_IDS = [
    "44444444-4444-4444-4444-444444444444",
    "55555555-5555-5555-5555-555555555555",
]
PRIVATE_ERROR = "provider failure containing private-internal-context"


@pytest.fixture
def deletion_case(monkeypatch):
    rows = [
        {
            "id": submission_id,
            "student_id": STUDENT_ID,
            "uploader_id": TEACHER_ID,
            "uploader_role": "teacher",
            "image_path": f"{STUDENT_ID}/{submission_id}.jpg",
        }
        for submission_id in SUBMISSION_IDS
    ]
    state = SimpleNamespace(
        rows={row["id"]: row for row in rows},
        measurements=set(SUBMISSION_IDS),
        manual_scores=set(SUBMISSION_IDS),
        images={row["image_path"] for row in rows},
        storage_failure=None,
        database_failure=False,
        concurrent_delete=None,
        lose_database_response=False,
    )

    def matching_ids(request):
        expression = request.url.params.get("id") or request.url.params.get("submission_id")
        if expression.startswith("eq."):
            return [expression.removeprefix("eq.")]
        assert expression.startswith("in.("), expression
        return expression[4:-1].split(",")

    def respond(request):
        path = request.url.path
        if path == "/storage/v1/object/submission-images":
            assert request.method == "DELETE"
            paths = json.loads(request.content)["prefixes"]
            if state.storage_failure == "partial":
                state.images.discard(paths[0])
            if state.storage_failure == "timeout":
                raise httpx.ReadTimeout(PRIVATE_ERROR, request=request)
            if state.storage_failure:
                return httpx.Response(
                    503,
                    json={"statusCode": "503", "error": "Unavailable", "message": PRIVATE_ERROR},
                )
            removed = [{"name": key} for key in paths if key in state.images]
            state.images.difference_update(paths)
            return httpx.Response(200, json=removed)

        table = path.removeprefix("/rest/v1/")
        if request.method == "GET":
            if table == "teacher_student":
                return httpx.Response(200, json=[{"student_id": STUDENT_ID}])
            assert table == "submission", (request.method, path)
            return httpx.Response(
                200, json=[state.rows[sid] for sid in matching_ids(request) if sid in state.rows]
            )

        assert request.method == "DELETE", (request.method, path)
        ids = matching_ids(request)
        if table == "submission":
            if state.database_failure:
                return httpx.Response(
                    500,
                    json={"code": "XX000", "message": PRIVATE_ERROR, "details": "", "hint": ""},
                )
            if state.concurrent_delete:
                sid = state.concurrent_delete
                state.rows.pop(sid)
                state.measurements.discard(sid)
                state.manual_scores.discard(sid)
            deleted = [state.rows.pop(sid) for sid in ids if sid in state.rows]
            state.measurements.difference_update(ids)
            state.manual_scores.difference_update(ids)
            if state.lose_database_response:
                state.lose_database_response = False
                raise httpx.ReadTimeout(PRIVATE_ERROR, request=request)
            return httpx.Response(200, json=deleted)
        # Model the old separate child DELETEs so partial DB cleanup is observable.
        if table == "measurement":
            state.measurements.difference_update(ids)
        elif table == "manual_score":
            state.manual_scores.difference_update(ids)
        else:
            pytest.fail(f"Unexpected table: {table}")
        return httpx.Response(200, json=[])

    with httpx.Client(transport=httpx.MockTransport(respond)) as http_client:
        sdk = create_client(
            "http://127.0.0.1:54321",
            "test-service-role-key",
            options=ClientOptions(httpx_client=http_client),
        )
        monkeypatch.setattr(submissions, "supabase_client", sdk)
        monkeypatch.setattr(settings, "ENVIRONMENT", "test")
        previous_overrides = app.dependency_overrides.copy()
        app.dependency_overrides[get_current_user] = lambda: {
            "sub": TEACHER_ID,
            "role": "teacher",
        }
        try:
            with TestClient(app) as client:
                yield state, client
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(previous_overrides)


def delete(client, batch):
    if batch:
        return client.post("/api/submissions/batch-delete", json={"submission_ids": SUBMISSION_IDS})
    return client.delete(f"/api/submissions/{SUBMISSION_IDS[0]}")


@pytest.mark.parametrize("batch", [False, True], ids=["single", "batch"])
@pytest.mark.parametrize("failure", ["http", "timeout", "partial"])
def test_storage_failure_preserves_all_database_records(deletion_case, batch, failure):
    state, client = deletion_case
    state.storage_failure = failure

    response = delete(client, batch)

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert set(state.rows) == set(SUBMISSION_IDS)
    assert state.measurements == set(SUBMISSION_IDS)
    assert state.manual_scores == set(SUBMISSION_IDS)

    state.storage_failure = None
    retried = delete(client, batch)

    assert retried.status_code == 200
    expected_remaining = set() if batch else {SUBMISSION_IDS[1]}
    assert set(state.rows) == expected_remaining
    assert state.measurements == expected_remaining
    assert state.manual_scores == expected_remaining


@pytest.mark.parametrize("batch", [False, True], ids=["single", "batch"])
def test_database_failure_preserves_related_records_and_allows_retry(deletion_case, batch):
    state, client = deletion_case
    state.database_failure = True

    failed = delete(client, batch)

    assert failed.status_code == 500
    assert set(state.rows) == set(SUBMISSION_IDS)
    assert state.measurements == set(SUBMISSION_IDS)
    assert state.manual_scores == set(SUBMISSION_IDS)

    state.database_failure = False
    retried = delete(client, batch)

    assert retried.status_code == 200
    expected_remaining = set() if batch else {SUBMISSION_IDS[1]}
    assert set(state.rows) == expected_remaining
    assert state.measurements == expected_remaining
    assert state.manual_scores == expected_remaining


@pytest.mark.parametrize("batch", [False, True], ids=["single", "batch"])
@pytest.mark.parametrize("failure", ["http", "database"])
def test_deletion_errors_do_not_expose_provider_details(deletion_case, batch, failure, caplog):
    state, client = deletion_case
    if failure == "database":
        state.database_failure = True
    else:
        state.storage_failure = failure

    response = delete(client, batch)

    assert response.status_code == 500
    assert response.json()["error"]["details"] == {}
    assert PRIVATE_ERROR not in response.text
    assert PRIVATE_ERROR not in caplog.text


def test_batch_counts_only_rows_deleted_by_this_request(deletion_case):
    state, client = deletion_case
    state.concurrent_delete = SUBMISSION_IDS[1]

    response = delete(client, batch=True)

    assert response.status_code == 200
    assert response.json() == {"deleted_count": 1, "deleted_ids": [SUBMISSION_IDS[0]]}
    assert not state.rows
    assert not state.images


@pytest.mark.parametrize("batch", [False, True], ids=["single", "batch"])
def test_retry_after_lost_database_response_recognizes_already_deleted_rows(deletion_case, batch):
    state, client = deletion_case
    state.lose_database_response = True

    failed = delete(client, batch)

    assert failed.status_code == 500
    expected_remaining = set() if batch else {SUBMISSION_IDS[1]}
    assert set(state.rows) == expected_remaining
    assert state.measurements == expected_remaining
    assert state.manual_scores == expected_remaining

    retried = delete(client, batch)

    if batch:
        assert retried.status_code == 200
        assert retried.json() == {"deleted_count": 0, "deleted_ids": []}
    else:
        assert retried.status_code == 404
        assert retried.json()["error"]["code"] == "NOT_FOUND"
