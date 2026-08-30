"""Stage 2 plumbing tests (TESTING §4.2).

Shape/plumbing only — verifies the code doesn't break, not that the model
is good. Real model evaluation is offline (ML_PIPELINE §5).
"""

import numpy as np

from app.ml.inference import run_letter_formation_inference
from app.ml.models import LetterFormationResult


def _make_fake_crop(width: int = 96, height: int = 96) -> np.ndarray:
    """Create a synthetic grayscale word crop."""
    rng = np.random.default_rng(42)
    return rng.integers(0, 256, size=(height, width), dtype=np.uint8)


class TestRunLetterFormationInference:
    """Tests for run_letter_formation_inference (TESTING §4.2)."""

    def test_returns_letter_formation_result(self):
        crops = [_make_fake_crop() for _ in range(3)]
        result = run_letter_formation_inference(crops)
        assert isinstance(result, LetterFormationResult)

    def test_returns_correct_number_of_word_scores(self):
        crops = [_make_fake_crop() for _ in range(5)]
        result = run_letter_formation_inference(crops)
        assert len(result.word_scores) == 5

    def test_word_indices_are_sequential(self):
        crops = [_make_fake_crop() for _ in range(3)]
        result = run_letter_formation_inference(crops)
        indices = [ws.word_index for ws in result.word_scores]
        assert indices == [0, 1, 2]

    def test_scores_are_clamped_to_0_100(self):
        crops = [_make_fake_crop() for _ in range(10)]
        result = run_letter_formation_inference(crops)
        for ws in result.word_scores:
            assert 0.0 <= ws.letter_formation_score <= 100.0

    def test_aggregate_mean_is_in_range(self):
        crops = [_make_fake_crop() for _ in range(5)]
        result = run_letter_formation_inference(crops)
        assert 0.0 <= result.aggregate_mean <= 100.0

    def test_aggregate_std_is_non_negative(self):
        crops = [_make_fake_crop() for _ in range(5)]
        result = run_letter_formation_inference(crops)
        assert result.aggregate_std >= 0.0

    def test_empty_crops_list_returns_empty_result(self):
        result = run_letter_formation_inference([])
        assert isinstance(result, LetterFormationResult)
        assert len(result.word_scores) == 0
        assert result.aggregate_mean == 0.0
        assert result.aggregate_std == 0.0

    def test_single_crop_returns_zero_std(self):
        crops = [_make_fake_crop()]
        result = run_letter_formation_inference(crops)
        assert len(result.word_scores) == 1
        assert result.aggregate_std == 0.0

    def test_accepts_variable_size_crops(self):
        """Word crops from CV pipeline may vary in size."""
        crops = [
            _make_fake_crop(width=120, height=80),
            _make_fake_crop(width=60, height=100),
            _make_fake_crop(width=96, height=96),
        ]
        result = run_letter_formation_inference(crops)
        assert len(result.word_scores) == 3
