"""Unit tests for Grad-CAM saliency and contour extraction (ML_PIPELINE §6/§8)."""

import numpy as np

from app.ml.inference import (
    _compute_gradcam_saliency,
    _extract_saliency_polygons_from_heatmap,
)


def test_extract_saliency_polygons_valid_coordinates():
    """Verify that a hotspot generates valid closed polygons translated to canvas bbox."""
    heatmap = np.zeros((96, 96), dtype=np.float32)
    # Hot region in the middle
    heatmap[30:60, 30:60] = 0.95

    bbox = [100, 200, 96, 96]
    polygons = _extract_saliency_polygons_from_heatmap(heatmap, bbox)

    assert len(polygons) >= 1
    poly = polygons[0]
    assert len(poly) >= 3
    for x, y in poly:
        # Check translation into canvas bbox [100, 200, 96, 96]
        assert 100 <= x <= 196
        assert 200 <= y <= 296


def test_extract_saliency_polygons_empty_on_cold_heatmap():
    """Verify that a cold or low-activation heatmap produces no polygons."""
    heatmap = np.zeros((96, 96), dtype=np.float32)
    bbox = [50, 50, 96, 96]
    polygons = _extract_saliency_polygons_from_heatmap(heatmap, bbox)
    assert polygons == []


def test_compute_gradcam_saliency_graceful_fallback():
    """Verify that _compute_gradcam_saliency falls back safely to [] if model is invalid."""
    crop = np.zeros((96, 96, 3), dtype=np.float32)
    bbox = [10, 20, 80, 40]
    # Pass an invalid model (None or non-Keras object)
    result = _compute_gradcam_saliency(None, crop, bbox)
    assert result == []
