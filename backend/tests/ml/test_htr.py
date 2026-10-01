"""Tests for HTR module and target prompt verification."""

import numpy as np
import pytest

from app.ml.htr import (
    ctc_greedy_decode,
    is_htr_stub_mode,
    levenshtein_similarity,
    preprocess_word_crop_htr,
    verify_target_text,
)


def _make_fake_crop(width: int = 100, height: int = 40) -> np.ndarray:
    """Create a synthetic grayscale word crop."""
    rng = np.random.default_rng(42)
    return rng.integers(0, 256, size=(height, width), dtype=np.uint8)


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


class TestVerifyTargetText:
    """Tests for verify_target_text."""

    def test_stub_mode_accepts_by_default(self):
        assert is_htr_stub_mode() is True
        crops = [_make_fake_crop() for _ in range(4)]
        is_match, detected_text, sim = verify_target_text(crops, "the quick brown fox")
        assert is_match is True
        assert sim == 1.0
