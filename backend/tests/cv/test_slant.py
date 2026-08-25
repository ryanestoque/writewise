import cv2
import numpy as np

from app.cv.features.slant import compute_word_slant


def _make_stroke_crop(angle_deg: float, width: int = 100, height: int = 80) -> np.ndarray:
    """Create a binary image crop containing a line at slant angle relative to vertical."""
    crop = np.full((height, width), 255, dtype=np.uint8)

    cx, cy = width // 2, height // 2
    length = 50
    # Angle relative to vertical: vertical is 90 deg. angle_deg adds lean.
    rad = np.radians(90.0 - angle_deg)
    dx = int(length / 2 * np.cos(rad))
    dy = int(length / 2 * np.sin(rad))

    cv2.line(crop, (cx - dx, cy + dy), (cx + dx, cy - dy), 0, 3)
    return crop


def test_slant_vertical_stroke():
    # True vertical stroke (0 deg slant)
    crop = _make_stroke_crop(0.0)
    slant = compute_word_slant(crop, reference_perpendicular_deg=90.0)
    assert abs(slant - 0.0) <= 2.0


def test_slant_right_leaning_stroke():
    # +15 deg rightward lean
    crop = _make_stroke_crop(15.0)
    slant = compute_word_slant(crop, reference_perpendicular_deg=90.0)
    assert abs(slant - 15.0) <= 3.0


def test_slant_left_leaning_stroke():
    # -15 deg leftward lean
    crop = _make_stroke_crop(-15.0)
    slant = compute_word_slant(crop, reference_perpendicular_deg=90.0)
    assert abs(slant - (-15.0)) <= 3.0


def test_slant_fallback_on_blank_or_horizontal_strokes():
    # Blank crop (no strokes)
    blank = np.full((80, 100), 255, dtype=np.uint8)
    assert compute_word_slant(blank) == 0.0

    # Strictly horizontal stroke (filtered out)
    horizontal = np.full((80, 100), 255, dtype=np.uint8)
    cv2.line(horizontal, (10, 40), (90, 40), 0, 3)
    assert compute_word_slant(horizontal) == 0.0
