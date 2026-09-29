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


def _run_stub_inference(
    word_crops: list[np.ndarray],
    word_bboxes: list[list[int]] | None = None,
) -> LetterFormationResult:
    """Return deterministic plausible scores without a real model (TESTING §3.2)."""
    rng = np.random.default_rng(_STUB_SEED)

    scores: list[float] = []
    word_scores: list[WordFormationScore] = []

    for i, _ in enumerate(word_crops):
        raw_score = float(rng.normal(_STUB_CENTER, _STUB_SPREAD))
        clamped = _clamp(raw_score)
        scores.append(clamped)

        saliency_polygons: list[list[list[int]]] = []
        if clamped < 65.0:
            # Deterministic synthetic polygon within the word crop / bbox
            bbox = word_bboxes[i] if word_bboxes and i < len(word_bboxes) else [0, 0, 96, 96]
            bx, by, bw, bh = bbox
            cx, cy = bx + bw // 2, by + bh // 2
            rx, ry = max(4, bw // 6), max(4, bh // 4)
            saliency_polygons.append(
                [
                    [cx, cy - ry],
                    [cx + rx, cy],
                    [cx, cy + ry],
                    [cx - rx, cy],
                ]
            )

        word_scores.append(
            WordFormationScore(
                word_index=i,
                letter_formation_score=clamped,
                saliency_polygons=saliency_polygons,
            )
        )

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


def _extract_saliency_polygons_from_heatmap(
    heatmap: np.ndarray,
    bbox: list[int] | tuple[int, int, int, int] | None = None,
) -> list[list[list[int]]]:
    """Convert a normalized [0, 1] 2D heatmap into simplified canvas polygons."""
    max_val = float(np.max(heatmap))
    if max_val < 0.3:
        return []

    # Threshold top 35% activation
    thresh_val = max(0.4, max_val * 0.65)
    binary = ((heatmap >= thresh_val) * 255).astype(np.uint8)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    polygons: list[list[list[int]]] = []

    x0 = int(bbox[0]) if bbox else 0
    y0 = int(bbox[1]) if bbox else 0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 16:  # ignore tiny speckles
            continue
        epsilon = 0.03 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        if len(approx) < 3:
            continue

        poly: list[list[int]] = []
        for pt in approx:
            px, py = int(pt[0][0]), int(pt[0][1])
            poly.append([px + x0, py + y0])
        polygons.append(poly)

    return polygons


def _compute_gradcam_saliency(
    model: Any,
    preprocessed_crop: np.ndarray,
    bbox: list[int] | None = None,
) -> list[list[list[int]]]:
    """Compute defect saliency polygons using Grad-CAM on MobileNetV2."""
    if model is None:
        return []

    try:
        import tensorflow as tf

        # Find target conv layer (Conv_1 or out_relu in MobileNetV2)
        target_layer = None
        for name in ["Conv_1", "out_relu", "top_conv"]:
            try:
                target_layer = model.get_layer(name)
                break
            except (ValueError, AttributeError):
                continue

        if target_layer is None:
            # Fall back to last 4D conv layer
            for layer in reversed(getattr(model, "layers", [])):
                if len(getattr(layer, "output_shape", ())) == 4:
                    target_layer = layer
                    break

        if target_layer is None:
            return []

        grad_model = tf.keras.models.Model(
            inputs=[model.inputs],
            outputs=[target_layer.output, model.output],
        )

        input_tensor = tf.expand_dims(preprocessed_crop, axis=0)
        with tf.GradientTape() as tape:
            conv_outputs, predictions = grad_model(input_tensor)
            score = predictions[0][0]
            # Negative gradient: features pulling score down
            loss = -score

        grads = tape.gradient(loss, conv_outputs)
        if grads is None:
            return []

        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_outputs = conv_outputs[0]

        # Linear combination of feature maps
        cam = tf.reduce_sum(tf.multiply(pooled_grads, conv_outputs), axis=-1)
        cam = tf.maximum(cam, 0)  # ReLU
        cam_np = cam.numpy()

        cam_max = float(np.max(cam_np))
        if cam_max > 0:
            cam_np = cam_np / cam_max

        # Upsample to crop dimensions
        h = bbox[3] if bbox else _INPUT_SIZE
        w = bbox[2] if bbox else _INPUT_SIZE
        resized_cam = cv2.resize(cam_np, (w, h), interpolation=cv2.INTER_LINEAR)
        blurred_cam = cv2.GaussianBlur(resized_cam, (3, 3), 0)

        return _extract_saliency_polygons_from_heatmap(blurred_cam, bbox)
    except Exception as exc:
        logger.warning("Grad-CAM computation encountered an error, falling back to []: %s", exc)
        return []


def _run_real_inference(
    model: Any,
    word_crops: list[np.ndarray],
    word_bboxes: list[list[int]] | None = None,
) -> LetterFormationResult:
    """Run real CNN inference on word crops with Grad-CAM saliency."""
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

        saliency_polygons: list[list[list[int]]] = []
        if clamped < 75.0:
            bbox = word_bboxes[i] if word_bboxes and i < len(word_bboxes) else None
            saliency_polygons = _compute_gradcam_saliency(
                model=model,
                preprocessed_crop=preprocessed[i],
                bbox=bbox,
            )

        word_scores.append(
            WordFormationScore(
                word_index=i,
                letter_formation_score=clamped,
                saliency_polygons=saliency_polygons,
            )
        )

    mean = float(np.mean(scores))
    std = float(np.std(scores))

    return LetterFormationResult(
        word_scores=word_scores,
        aggregate_mean=mean,
        aggregate_std=std,
    )


def run_letter_formation_inference(
    word_crops: list[np.ndarray],
    word_bboxes: list[list[int]] | None = None,
) -> LetterFormationResult:
    """Run letter-formation inference on word crops from the CV pipeline.

    Parameters
    ----------
    word_crops : list[np.ndarray]
        Deskewed grayscale word crops from CV_PIPELINE §7's handoff.
    word_bboxes : list[list[int]] | None, optional
        Bounding boxes [x, y, w, h] in canvas coordinates for each word crop.

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
            return _run_stub_inference(word_crops, word_bboxes)

        model = get_model()
        if model is None:
            raise ModelInferenceError(
                "Model is None but stub mode is not active — this should not happen. "
                "Check that load_model() was called at startup."
            )

        return _run_real_inference(model, word_crops, word_bboxes)

    except ModelInferenceError:
        raise
    except Exception as exc:
        raise ModelInferenceError(
            f"CNN inference failed on {len(word_crops)} word crops: {exc}"
        ) from exc
