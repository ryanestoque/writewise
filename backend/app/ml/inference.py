"""CNN letter-formation inference (ML_PIPELINE §8).

Takes word crops from the CV pipeline (CV_PIPELINE §7 handoff) and returns
per-word letter_formation_score + aggregate {mean, std}.

In stub mode (TESTING §3.2), returns deterministic plausible scores
without running a real forward pass.
"""

import logging
from typing import Any

import cv2
import numpy as np

from app.ml.exceptions import ModelInferenceError
from app.ml.model import get_model, is_stub_mode
from app.ml.models import LetterFormationResult, WordFormationScore

logger = logging.getLogger(__name__)

# Stub parameters — plausible score distribution for UI testing
_STUB_CENTER = 65.0
_STUB_SPREAD = 15.0
_STUB_SEED = 42

# MobileNetV2 input size (ML_PIPELINE §2.3)
_INPUT_SIZE = 96


def _preprocess_crop(crop: np.ndarray) -> np.ndarray:
    """Prepare a single grayscale word crop for MobileNetV2 inference.

    Pipeline: pad-to-square -> resize 96x96 -> grayscale-to-3-channel -> normalize [-1, 1].
    Same preprocessing as training (ML_PIPELINE §2.3, §4).
    """
    h, w = crop.shape[:2]

    # Pad to square (preserves stroke proportions)
    if h != w:
        size = max(h, w)
        padded = np.full((size, size), 255, dtype=np.uint8)  # white padding
        y_offset = (size - h) // 2
        x_offset = (size - w) // 2
        padded[y_offset : y_offset + h, x_offset : x_offset + w] = crop
        crop = padded

    # Resize to 96x96
    resized = cv2.resize(crop, (_INPUT_SIZE, _INPUT_SIZE), interpolation=cv2.INTER_AREA)

    # Grayscale -> 3-channel (MobileNetV2 expects RGB)
    rgb = np.stack([resized] * 3, axis=-1)

    # Normalize to [-1, 1] (MobileNetV2 preprocess_input convention)
    normalized = (rgb.astype(np.float32) / 127.5) - 1.0

    return normalized


def _clamp(value: float, min_val: float = 0.0, max_val: float = 100.0) -> float:
    """Clamp a score to [0, 100] (ML_PIPELINE §8 failure handling)."""
    return max(min_val, min(max_val, value))


def _run_stub_inference(word_crops: list[np.ndarray]) -> LetterFormationResult:
    """Return deterministic plausible scores without a real model (TESTING §3.2)."""
    rng = np.random.default_rng(_STUB_SEED)

    scores: list[float] = []
    word_scores: list[WordFormationScore] = []

    for i, _ in enumerate(word_crops):
        raw_score = float(rng.normal(_STUB_CENTER, _STUB_SPREAD))
        clamped = _clamp(raw_score)
        scores.append(clamped)
        word_scores.append(WordFormationScore(word_index=i, letter_formation_score=clamped))

    if scores:
        mean = float(np.mean(scores))
        std = float(np.std(scores))
    else:
        mean = 0.0
        std = 0.0

    return LetterFormationResult(
        word_scores=word_scores,
        aggregate_mean=mean,
        aggregate_std=std,
    )


def _run_real_inference(
    model: Any, word_crops: list[np.ndarray]
) -> LetterFormationResult:
    """Run real CNN inference on word crops."""
    preprocessed = np.array([_preprocess_crop(crop) for crop in word_crops])

    # Batch prediction
    predictions = model.predict(preprocessed, verbose=0)

    scores: list[float] = []
    word_scores: list[WordFormationScore] = []

    for i, pred in enumerate(predictions):
        # Stage 2 head outputs a single scalar per crop
        raw_score = float(pred[0]) if hasattr(pred, "__len__") and len(pred) > 0 else float(pred)
        clamped = _clamp(raw_score)
        scores.append(clamped)
        word_scores.append(WordFormationScore(word_index=i, letter_formation_score=clamped))

    mean = float(np.mean(scores))
    std = float(np.std(scores))

    return LetterFormationResult(
        word_scores=word_scores,
        aggregate_mean=mean,
        aggregate_std=std,
    )


def run_letter_formation_inference(
    word_crops: list[np.ndarray],
) -> LetterFormationResult:
    """Run letter-formation inference on word crops from the CV pipeline.

    Parameters
    ----------
    word_crops : list[np.ndarray]
        Deskewed grayscale word crops from CV_PIPELINE §7's handoff.

    Returns
    -------
    LetterFormationResult
        Per-word letter_formation_score (clamped [0, 100]) and aggregate {mean, std}.

    Raises
    ------
    ModelInferenceError
        If inference fails on the word crop batch.
    """
    if not word_crops:
        return LetterFormationResult(word_scores=[], aggregate_mean=0.0, aggregate_std=0.0)

    try:
        if is_stub_mode():
            return _run_stub_inference(word_crops)

        model = get_model()
        if model is None:
            raise ModelInferenceError(
                "Model is None but stub mode is not active — this should not happen. "
                "Check that load_model() was called at startup."
            )

        return _run_real_inference(model, word_crops)

    except ModelInferenceError:
        raise
    except Exception as exc:
        raise ModelInferenceError(
            f"CNN inference failed on {len(word_crops)} word crops: {exc}"
        ) from exc
