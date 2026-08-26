"""Unit tests for CV Pipeline §3: Preprocessing.

Per TESTING §4.1 — synthetic images, generated at test time, asserting
known ground truth.  No fixture files committed.
"""

import cv2
import numpy as np
import pytest

from app.cv.preprocessing import PreprocessResult, preprocess
from tests.synthetic import make_sharp_worksheet

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _encode_gray(gray: np.ndarray) -> bytes:
    """Encode a single-channel image as JPEG bytes for ``preprocess()``."""
    # preprocess() expects a color (BGR) input it can decode, so
    # convert gray → BGR before encoding.
    bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    _, buf = cv2.imencode(".jpg", bgr)
    return buf.tobytes()


def _make_bimodal_image(
    width: int = 2000,
    height: int = 2600,
    bg: int = 200,
    ink: int = 40,
) -> bytes:
    """Create a simple bimodal image (light bg + dark rectangles).

    Returns JPEG bytes.  The two intensity populations are far apart so
    Otsu's threshold should land squarely between them.
    """
    img = np.full((height, width, 3), bg, dtype=np.uint8)
    # Draw a grid of dark rectangles to simulate ink strokes
    for y in range(100, height - 100, 200):
        for x in range(100, width - 100, 150):
            cv2.rectangle(img, (x, y), (x + 80, y + 40), (ink, ink, ink), -1)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


# ---------------------------------------------------------------------------
# Tests: PreprocessResult dataclass
# ---------------------------------------------------------------------------


def test_preprocess_result_fields():
    """Smoke-test that the dataclass carries all expected fields."""
    dummy = np.zeros((10, 10), dtype=np.uint8)
    result = PreprocessResult(gray=dummy, denoised=dummy, binary=dummy, otsu_threshold=127.0)
    assert result.otsu_threshold == 127.0
    assert result.gray is dummy


# ---------------------------------------------------------------------------
# Tests: Grayscale conversion
# ---------------------------------------------------------------------------


def test_grayscale_single_channel():
    """Output gray image must be single-channel with same HxW."""
    image_bytes = make_sharp_worksheet()
    result = preprocess(image_bytes)

    assert result.gray.ndim == 2, "Gray should be 2D (single channel)"
    assert result.gray.dtype == np.uint8


def test_grayscale_preserves_dimensions():
    """Gray dimensions must match the original decoded image."""
    image_bytes = make_sharp_worksheet(width=1800, height=2400)
    result = preprocess(image_bytes)

    # Decode independently to get expected dimensions
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    original = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    expected_h, expected_w = original.shape[:2]

    assert result.gray.shape == (expected_h, expected_w)


# ---------------------------------------------------------------------------
# Tests: Median blur (denoising)
# ---------------------------------------------------------------------------


def test_denoise_reduces_noise():
    """Median blur should reduce salt-and-pepper noise."""
    # Create a clean gray image, add noise, encode, preprocess
    rng = np.random.default_rng(42)
    clean = np.full((2000, 2000), 180, dtype=np.uint8)
    # Add salt-and-pepper noise
    noise_mask = rng.random((2000, 2000))
    clean[noise_mask < 0.02] = 0  # pepper
    clean[noise_mask > 0.98] = 255  # salt

    noisy_bytes = _encode_gray(clean)
    result = preprocess(noisy_bytes)

    # After median blur, extreme pixels (0 and 255 noise) should be
    # substantially reduced compared to the grayscale (pre-blur) output
    extremes_before = np.sum((result.gray == 0) | (result.gray == 255))
    extremes_after = np.sum((result.denoised == 0) | (result.denoised == 255))
    assert extremes_after < extremes_before, (
        "Median blur should reduce extreme-value (noise) pixels"
    )


def test_denoise_preserves_edges():
    """Median blur should preserve strong edges (not soften them)."""
    # Create a sharp vertical edge: left half dark, right half light
    img = np.zeros((2000, 2000), dtype=np.uint8)
    img[:, :1000] = 40
    img[:, 1000:] = 200

    image_bytes = _encode_gray(img)
    result = preprocess(image_bytes)

    # Sample a horizontal slice across the edge in the denoised image.
    # The transition from dark to light should still be sharp (within
    # a few pixels of column 1000), not smeared over a wide gradient.
    row = result.denoised[1000, :]
    # Find where the big jump happens
    diffs = np.abs(np.diff(row.astype(np.int16)))
    edge_cols = np.where(diffs > 50)[0]
    assert len(edge_cols) > 0, "Edge should still be detectable after denoise"
    # Edge should be within ±5px of column 1000 (median blur kernel is 3×3)
    edge_center = int(np.median(edge_cols))
    assert abs(edge_center - 1000) <= 5, f"Edge shifted to column {edge_center}, expected near 1000"


# ---------------------------------------------------------------------------
# Tests: Otsu threshold (binarization)
# ---------------------------------------------------------------------------


def test_binary_only_contains_0_and_255():
    """Otsu output must be strictly binary — only 0 and 255."""
    image_bytes = make_sharp_worksheet()
    result = preprocess(image_bytes)

    unique_values = set(np.unique(result.binary))
    assert unique_values.issubset({0, 255}), (
        f"Binary image should only contain 0 and 255, got {unique_values}"
    )


def test_otsu_threshold_between_peaks():
    """On a bimodal image, Otsu's threshold should fall between the two
    intensity clusters."""
    bg, ink = 200, 40
    image_bytes = _make_bimodal_image(bg=bg, ink=ink)
    result = preprocess(image_bytes)

    # Threshold should be between the two peaks (with margin for JPEG
    # compression artifacts)
    assert ink < result.otsu_threshold < bg, (
        f"Otsu threshold {result.otsu_threshold} should be between ink={ink} and bg={bg}"
    )


def test_binary_inv_ink_is_white():
    """THRESH_BINARY_INV: dark ink pixels should become 255 (white),
    light background should become 0 (black)."""
    bg, ink = 200, 40
    image_bytes = _make_bimodal_image(bg=bg, ink=ink)
    result = preprocess(image_bytes)

    # Sample a known ink region (center of one of the drawn rectangles)
    # The first rectangle is drawn at roughly (100, 100) to (180, 140)
    ink_region = result.binary[110:130, 120:160]
    # Most pixels in the ink region should be 255 (foreground)
    ink_white_ratio = np.mean(ink_region == 255)
    assert ink_white_ratio > 0.8, (
        f"Ink region should be mostly 255 (got {ink_white_ratio:.0%} white)"
    )

    # Sample a known background region (top-left corner, well away from rects)
    bg_region = result.binary[10:50, 10:50]
    bg_black_ratio = np.mean(bg_region == 0)
    assert bg_black_ratio > 0.8, (
        f"Background region should be mostly 0 (got {bg_black_ratio:.0%} black)"
    )


# ---------------------------------------------------------------------------
# Tests: End-to-end
# ---------------------------------------------------------------------------


def test_preprocess_returns_result_type():
    """preprocess() must return a PreprocessResult."""
    result = preprocess(make_sharp_worksheet())
    assert isinstance(result, PreprocessResult)


def test_all_outputs_same_dimensions():
    """gray, denoised, and binary must all have the same HxW."""
    result = preprocess(make_sharp_worksheet())
    assert result.gray.shape == result.denoised.shape == result.binary.shape


def test_invalid_bytes_raises_value_error():
    """Garbage bytes should raise ValueError, not crash."""
    with pytest.raises(ValueError, match="Could not decode"):
        preprocess(b"not an image at all")


def test_quality_gate_passing_image_also_preprocesses():
    """An image that passes the quality gate should also preprocess
    without error — verifying there's no incompatibility between the
    two stages."""
    from app.cv.quality_gate import run_quality_gate

    image_bytes = make_sharp_worksheet()
    # Should not raise
    run_quality_gate(image_bytes)
    result = preprocess(image_bytes)
    assert result.binary.shape == result.gray.shape
