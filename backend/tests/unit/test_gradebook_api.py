"""Mounted gradebook reads forward the verified caller JWT, never the service key."""

import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.main import app

TEACHER = "11111111-1111-1111-1111-111111111111"
STUDENT = "22222222-2222-2222-2222-222222222222"
ACTIVITY = "33333333-3333-3333-3333-333333333333"
SECTION = "55555555-5555-5555-5555-555555555555"


def empty_section():
    return {"section_id": SECTION, "section_name": "Synthetic section", "teacher_id": TEACHER,
            "activities": [], "rows": []}


@pytest.fixture
def gradebook_case(monkeypatch):
    from app.api import gradebook
    from app.core.config import settings

    state = SimpleNamespace(role="teacher", requests=[], response=empty_section(), error=None)
    original_client = httpx.AsyncClient

    def respond(request):
        state.requests.append(request)
        assert request.headers["Authorization"] == "Bearer submitted-test-token"
        assert request.headers["apikey"] == "test-public-gradebook-key"
        assert request.headers["apikey"] != settings.SUPABASE_SERVICE_ROLE_KEY
        if state.error:
            return httpx.Response(400, json={"code": state.error, "message": "private SQL body"})
        return httpx.Response(200, json=state.response)

    def caller_client(**kwargs):
        return original_client(transport=httpx.MockTransport(respond), **kwargs)

    monkeypatch.setattr(gradebook, "AsyncClient", caller_client)
    monkeypatch.setattr(settings, "SUPABASE_ANON_KEY", "test-public-gradebook-key")
    app.dependency_overrides[get_current_user] = lambda: {"sub": TEACHER, "role": state.role}
    with TestClient(app) as client:
        state.client = client
        yield state
    app.dependency_overrides.clear()


def test_section_read_uses_the_exact_caller_identity_and_a_coherent_rpc(gradebook_case):
    result = gradebook_case.client.get(
        f"/api/sections/{SECTION}/gradebook",
        headers={"Authorization": "Bearer submitted-test-token"},
    )
    assert result.status_code == 200, result.text
    assert result.json() == empty_section()
    assert result.headers["Cache-Control"] == "no-store"
    request = gradebook_case.requests[0]
    assert request.url.path == "/rest/v1/rpc/read_section_gradebook"
    assert json.loads(request.content) == {"target_section_id": SECTION}


def test_csv_and_json_share_the_same_section_scope(gradebook_case):
    result = gradebook_case.client.get(
        f"/api/sections/{SECTION}/gradebook.csv",
        headers={"Authorization": "Bearer submitted-test-token"},
    )
    assert result.status_code == 200
    assert result.content.startswith(b"\xef\xbb\xbfstudent_name,student_id,")
    assert result.headers["Cache-Control"] == "no-store"
    assert SECTION in result.headers["Content-Disposition"]
    assert "read_section_gradebook" in str(gradebook_case.requests[0].url)


def test_missing_bearer_is_rejected_before_a_database_read(gradebook_case):
    result = gradebook_case.client.get(f"/api/sections/{SECTION}/gradebook")
    assert result.status_code == 401
    assert result.json()["error"]["code"] == "UNAUTHORIZED"
    assert gradebook_case.requests == []


def test_parent_cannot_read_or_export_a_teacher_section(gradebook_case):
    gradebook_case.role = "parent"
    for suffix in ("gradebook", "gradebook.csv"):
        result = gradebook_case.client.get(
            f"/api/sections/{SECTION}/{suffix}",
            headers={"Authorization": "Bearer submitted-test-token"},
        )
        assert result.status_code == 403
    assert gradebook_case.requests == []


def test_parent_child_read_is_not_a_teacher_role_or_section_request(gradebook_case):
    gradebook_case.role = "parent"
    gradebook_case.response = {"student_id": STUDENT, "groups": []}
    result = gradebook_case.client.get(
        f"/api/students/{STUDENT}/gradebook",
        headers={"Authorization": "Bearer submitted-test-token"},
    )
    assert result.status_code == 200
    assert result.json() == gradebook_case.response
    assert gradebook_case.requests[0].url.path == "/rest/v1/rpc/read_child_gradebook"


def test_denied_scope_is_not_disguised_as_an_empty_gradebook(gradebook_case):
    gradebook_case.error = "WW404"
    result = gradebook_case.client.get(
        f"/api/sections/{SECTION}/gradebook",
        headers={"Authorization": "Bearer submitted-test-token"},
    )
    assert result.status_code == 404
    assert result.json()["error"]["code"] == "NOT_FOUND"
    assert "private SQL body" not in result.text


@pytest.mark.parametrize("payload", [[], None, {"unexpected": "private response"}])
def test_malformed_database_read_is_a_sanitized_failure(gradebook_case, payload):
    gradebook_case.response = payload
    result = gradebook_case.client.get(
        f"/api/sections/{SECTION}/gradebook",
        headers={"Authorization": "Bearer submitted-test-token"},
    )
    assert result.status_code == 500
    assert result.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "private response" not in result.text


def test_no_public_key_does_not_fall_back_to_service_role(gradebook_case, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "SUPABASE_ANON_KEY", "")
    result = gradebook_case.client.get(
        f"/api/sections/{SECTION}/gradebook",
        headers={"Authorization": "Bearer submitted-test-token"},
    )
    assert result.status_code == 500
    assert gradebook_case.requests == []


def test_repository_rejects_non_gradebook_rpc_without_sending_a_request():
    from app.gradebook.repository import read_gradebook_facts

    async def run():
        def reject(request):
            raise AssertionError("An arbitrary RPC must never be forwarded")
        async with httpx.AsyncClient(
            base_url="http://127.0.0.1:54321/rest/v1/", transport=httpx.MockTransport(reject)
        ) as client:
            with pytest.raises(ValueError):
                await read_gradebook_facts(client, "mutate_student_work", {})
    asyncio.run(run())
