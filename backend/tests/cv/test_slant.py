import cv2
import numpy as np
import pytest

from app.cv.features.slant import analyze_word_slant, compute_word_slant


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
    assert compute_word_slant(blank) is None

    # Strictly horizontal stroke (filtered out)
    horizontal = np.full((80, 100), 255, dtype=np.uint8)
    cv2.line(horizontal, (10, 40), (90, 40), 0, 3)
    assert compute_word_slant(horizontal) is None


def test_slant_with_pipeline_inverted_crop():
    """Pipeline binary crops use THRESH_BINARY_INV (paper=0, ink=255)."""
    # Create inverted binary crop with 15 deg lean
    crop = np.full((80, 100), 0, dtype=np.uint8)
    cx, cy = 50, 40
    length = 50
    rad = np.radians(90.0 - 15.0)
    dx = int(length / 2 * np.cos(rad))
    dy = int(length / 2 * np.sin(rad))
    cv2.line(crop, (cx - dx, cy + dy), (cx + dx, cy - dy), 255, 3)

    slant = compute_word_slant(crop, reference_perpendicular_deg=90.0)
    assert abs(slant - 15.0) <= 3.0


def _stems_with_short_fragments(angle: float, thickness: int = 5) -> np.ndarray:
    crop = np.zeros((180, 380), dtype=np.uint8)
    for index in range(3):
        x = 65 + index * 100
        dx = round(95 * np.tan(np.radians(angle)))
        cv2.line(crop, (x + dx, 25), (x, 120), 255, thickness)
    for index in range(8):
        x = 15 + index * 40
        cv2.line(crop, (x, 148), (x + 14, 162), 255, 3)
    return crop


@pytest.mark.parametrize("angle", [-30.0, 0.0, 15.0, 30.0])
def test_short_diagonal_fragments_do_not_override_sustained_stems(angle):
    measured = compute_word_slant(_stems_with_short_fragments(angle))
    assert measured is not None
    assert abs(measured - angle) <= 3.0


def test_slant_uses_reference_perpendicular():
    # The same image stroke is 15 degrees from image vertical, 25 from an 80-degree reference.
    measured = compute_word_slant(_make_stroke_crop(15), reference_perpendicular_deg=80)
    assert measured is not None
    assert abs(measured - 25.0) <= 3.0


@pytest.mark.parametrize("scale", [0.5, 1.0, 2.0])
@pytest.mark.parametrize("thickness", [2, 5, 10])
def test_stem_measurement_is_stable_across_scale_and_pen_width(scale, thickness):
    crop = _stems_with_short_fragments(15, thickness)
    crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
    result = analyze_word_slant(crop, unit_height=95 * scale, ink_is_light=True)
    assert result.angle_deg is not None
    assert abs(result.angle_deg - 15) <= 2
    assert result.segment_count >= 2


@pytest.mark.parametrize(
    "angles, minimum_std, maximum_std",
    [
        ([12, 12, 12, 12], 0, 2),
        ([-30, 30, -30, 30], 25, 35),
    ],
)
def test_stroke_consistency_is_separate_from_mean_lean(angles, minimum_std, maximum_std):
    crop = np.zeros((130, 450), dtype=np.uint8)
    for index, angle in enumerate(angles):
        x = index * 95 + 70
        dx = round(80 * np.tan(np.radians(angle)))
        cv2.line(crop, (x + dx, 20), (x, 100), 255, 4)
    result = analyze_word_slant(crop, unit_height=80, ink_is_light=True)
    assert result.std_deg is not None
    assert minimum_std <= result.std_deg <= maximum_std
    if minimum_std > 0:
        assert abs(result.angle_deg) <= 2


@pytest.mark.parametrize("thickness", [2, 5, 12])
def test_round_loops_without_sustained_stems_are_unmeasurable(thickness):
    crop = np.zeros((100, 200), dtype=np.uint8)
    for x in (50, 130):
        cv2.ellipse(crop, (x, 50), (30, 30), 0, 0, 360, 255, thickness)
    result = analyze_word_slant(crop, unit_height=60, ink_is_light=True)
    assert result.angle_deg is None
    assert result.std_deg is None
    assert result.segment_count == 0


def test_tight_pipeline_crop_uses_known_ink_polarity():
    crop = np.full((80, 12), 255, dtype=np.uint8)
    result = analyze_word_slant(crop, unit_height=40, ink_is_light=True)
    assert result.angle_deg is not None
    assert abs(result.angle_deg) <= 2


def test_rule_suppression_preserves_crossing_stem_orientation():
    crop = np.zeros((140, 300), dtype=np.uint8)
    for x in (50, 130, 210):
        cv2.line(crop, (x + 25, 15), (x, 110), 255, 4)
    for row in (30, 110):
        cv2.line(crop, (0, row), (299, row), 255, 3)
    result = analyze_word_slant(crop, unit_height=80, guideline_rows=(30, 110), ink_is_light=True)
    assert result.angle_deg is not None
    assert abs(result.angle_deg - 15) <= 2
    assert result.std_deg <= 2
