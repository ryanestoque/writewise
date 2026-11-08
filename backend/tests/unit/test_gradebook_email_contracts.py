"""Both existing email gates can carry the fixed excused-work skip reason."""

import pytest

from app.email.contracts import AuthorizationResult, PreparationResult


@pytest.mark.parametrize("model", [AuthorizationResult, PreparationResult])
def test_excused_work_skip_is_a_valid_delivery_result(model):
    assert model(state="skipped", code="work_excused").model_dump(exclude_none=True) == {
        "state": "skipped",
        "code": "work_excused",
    }
