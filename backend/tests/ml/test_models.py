"""Tests for ML data models (ML_PIPELINE §11 output schema)."""

from app.ml.exceptions import ModelInferenceError
from app.ml.models import LetterFormationResult, WordFormationScore


def test_word_formation_score_stores_values():
    score = WordFormationScore(word_index=0, letter_formation_score=71.4)
    assert score.word_index == 0
    assert score.letter_formation_score == 71.4


def test_letter_formation_result_stores_values():
    scores = [
        WordFormationScore(word_index=0, letter_formation_score=71.4),
        WordFormationScore(word_index=1, letter_formation_score=80.2),
    ]
    result = LetterFormationResult(
        word_scores=scores,
        aggregate_mean=75.8,
        aggregate_std=4.4,
    )
    assert len(result.word_scores) == 2
    assert result.aggregate_mean == 75.8
    assert result.aggregate_std == 4.4


def test_model_inference_error_is_exception():
    err = ModelInferenceError("test failure")
    assert isinstance(err, Exception)
    assert str(err) == "test failure"
