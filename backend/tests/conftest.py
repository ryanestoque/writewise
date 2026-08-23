import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_parent, get_current_teacher
from app.core.supabase import supabase_client
from app.main import app

# Fetch a real teacher ID from the database to avoid FK constraints.
# Uses the service-role client which must have SELECT on public.teacher
# (granted via supabase/migrations/0013_grants.sql).
try:
    res = supabase_client.table("teacher").select("id").limit(1).execute()
    TEST_TEACHER_ID = res.data[0]["id"] if res.data else "11111111-1111-1111-1111-111111111111"
except Exception as exc:
    raise RuntimeError(
        "conftest: could not query public.teacher via service_role. "
        "Make sure the ephemeral Supabase stack is running and migrations "
        "have been applied (supabase db reset). "
        f"Original error: {exc}"
    ) from exc


def override_get_current_teacher():
    return {"sub": TEST_TEACHER_ID, "role": "teacher"}


def override_get_current_parent():
    return {"sub": "22222222-2222-2222-2222-222222222222", "role": "parent"}


@pytest.fixture
def client():
    app.dependency_overrides[get_current_teacher] = override_get_current_teacher
    app.dependency_overrides[get_current_parent] = override_get_current_parent
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
