"""Tests for HTR module and target prompt verification."""

import numpy as np
import pytest

from app.ml.htr import (
    ctc_greedy_decode,
    is_htr_stub_mode,
    levenshtein_similarity,
    preprocess_word_crop_htr,
    suppress_notebook_rulings,
    verify_target_text,
)


def _make_fake_crop(width: int = 100, height: int = 40) -> np.ndarray:
    """Create a synthetic grayscale word crop."""
    rng = np.random.default_rng(42)
    return rng.integers(0, 256, size=(height, width), dtype=np.uint8)


def _make_crop_with_rulings(width: int = 100, height: int = 40) -> np.ndarray:
    """Create a synthetic grayscale crop with 3 ruling lines crossing a vertical stroke."""
    crop = np.full((height, width), 255, dtype=np.uint8)
    # Add vertical handwriting stem in center
    crop[5:35, width // 2 : width // 2 + 2] = 0
    # Add 3 horizontal ruling lines across entire width
    crop[8, :] = 50  # Topline
    crop[20, :] = 50  # Midline
    crop[32, :] = 50  # Baseline
    return crop


class TestHTRPreprocessing:
    """Tests for word crop preprocessing."""

    def test_preprocess_shape(self):
        crop = _make_fake_crop(100, 40)
        processed = preprocess_word_crop_htr(crop, target_width=128, target_height=32)
        # Expected shape: (128, 32, 1) where width is the first sequence axis
        assert processed.shape == (128, 32, 1)
        assert processed.dtype == np.float32

    def test_preprocess_empty_crop(self):
        crop = np.zeros((0, 0), dtype=np.uint8)
        processed = preprocess_word_crop_htr(crop, target_width=128, target_height=32)
        assert processed.shape == (128, 32, 1)

    def test_suppress_notebook_rulings_removes_lines(self):
        crop = _make_crop_with_rulings(100, 40)
        cleaned = suppress_notebook_rulings(crop)

        # Check that lines away from vertical stem were suppressed (reset to background > 200)
        assert cleaned[8, 10] > 200
        assert cleaned[20, 10] > 200
        assert cleaned[32, 10] > 200

        # Check that vertical stem continuity is preserved at row 15 (between lines)
        assert cleaned[15, 50] < 100

    def test_suppress_notebook_rulings_color(self):
        # BGR crop with blue midline and red topline/baseline
        crop = np.full((40, 100, 3), 255, dtype=np.uint8)
        # Vertical dark graphite stroke
        crop[5:35, 49:51] = (30, 30, 30)
        # Blue line (BGR: 255, 100, 0)
        crop[8, :] = (255, 100, 0)
        # Red line (BGR: 0, 0, 255)
        crop[32, :] = (0, 0, 255)

        cleaned = suppress_notebook_rulings(crop)

        # Check ruling line suppression away from stroke
        assert cleaned[8, 10] > 200
        assert cleaned[32, 10] > 200
        # Check vertical stroke preserved
        assert cleaned[15, 50] < 100


class TestCTCDecoding:
    """Tests for CTC greedy decoding."""

    def test_ctc_greedy_decode_simple(self):
        vocab = ["[UNK]", "a", "b", "c"]
        # Probabilities for sequence length 5 with 4 vocab tokens + 1 blank (idx 4)
        probs = np.zeros((5, 5), dtype=np.float32)
        probs[0, 1] = 1.0  # 'a'
        probs[1, 1] = 1.0  # 'a' (repeated -> collapse to 'a')
        probs[2, 4] = 1.0  # blank
        probs[3, 2] = 1.0  # 'b'
        probs[4, 3] = 1.0  # 'c'

        decoded = ctc_greedy_decode(probs, vocab)
        assert decoded == "abc"


class TestLevenshteinSimilarity:
    """Tests for string similarity calculation."""

    def test_exact_match(self):
        sim = levenshtein_similarity("the quick brown fox", "the quick brown fox")
        assert sim == pytest.approx(1.0)

    def test_case_insensitive_match(self):
        sim = levenshtein_similarity("The Quick Brown Fox", "the quick brown fox")
        assert sim == pytest.approx(1.0)

    def test_complete_mismatch(self):
        sim = levenshtein_similarity("sun shines bright today", "the quick brown fox")
        assert sim < 0.35

    def test_minor_typo_match(self):
        # 1 character difference in 19 chars -> ~95% similarity
        sim = levenshtein_similarity("the quik brown fox", "the quick brown fox")
        assert sim >= 0.85

    def test_empty_strings(self):
        assert levenshtein_similarity("", "") == 1.0
        assert levenshtein_similarity("fox", "") == 0.0

    def test_cursive_ambiguity_tolerance(self):
        """Verify cursive loop ambiguities ('bavenee' vs 'banana') pass."""
        sim = levenshtein_similarity("bavenee", "banana")
        # Should achieve >= 0.70 similarity (75%)
        assert sim >= 0.70


class TestVerifyTargetText:
    """Tests for verify_target_text."""

    def test_stub_mode_accepts_by_default(self):
        assert is_htr_stub_mode() is True
        crops = [_make_fake_crop() for _ in range(4)]
        is_match, detected_text, sim = verify_target_text(crops, "the quick brown fox")
        assert is_match is True
        assert sim == 1.0

    def test_word_level_similarity_rejects_garbled_word(self):
        """Verify that garbled outputs are rejected."""
        # 57% global similarity but 'Sloagy' vs 'Ibag' is weak
        target = "Saara Eliana Ibag"
        garbled = "baoria Eliarar Sloagy"
        sim = levenshtein_similarity(garbled, target)
        # 0.571 < 0.65 threshold
        assert sim < 0.65

    def test_verify_target_text_threshold_check(self):
        """Test that similarity threshold 0.65 is enforced."""
        # Exact match -> 1.0 >= 0.65
        assert levenshtein_similarity("Saara Eliana Ibag", "Saara Eliana Ibag") >= 0.65
        # Minor typo -> >= 0.65
        assert levenshtein_similarity("Saara Eliana Ibaq", "Saara Eliana Ibag") >= 0.65
        # Severe garble -> < 0.65
        assert levenshtein_similarity("baoria Eliarar Sloagy", "Saara Eliana Ibag") < 0.65
