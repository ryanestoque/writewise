import numpy as np

from app.cv.features.size import compute_size_ratio


def test_size_ratio_perfect_core_height():
    # Guideline unit height = 40 (midline=460, baseline=500). Word bbox: y=460, h=40.
    # Ink occupies the full midline to baseline span (height 40).
    crop = np.full((40, 60), 255, dtype=np.uint8)
    crop[0:40, 10:50] = 0  # ink occupies full 40px
    bbox = (100, 460, 60, 40)

    ratio = compute_size_ratio(
        binary_crop=crop,
        word_bbox=bbox,
        midline_y=460,
        baseline_y=500,
        unit_height=40.0,
    )
    assert ratio == 1.0


def test_size_ratio_with_tall_ascender():
    # Guideline: midline=460, baseline=500 (unit=40).
    # Word bbox starts at y=420 (topline) with height 80 (y spans 420 to 500).
    # Ascender is in y 420-460; core is in y 460-500.
    crop = np.full((80, 60), 255, dtype=np.uint8)
    # Draw ascender (row 0 to 40 in crop) and core (row 40 to 80 in crop)
    crop[0:80, 20:25] = 0  # vertical stroke across full height
    crop[40:80, 20:50] = 0  # core body
    bbox = (100, 420, 60, 80)

    ratio = compute_size_ratio(
        binary_crop=crop,
        word_bbox=bbox,
        midline_y=460,
        baseline_y=500,
        unit_height=40.0,
    )
    # The core height between midline and baseline should be ~40px -> ratio ~ 1.0, not 2.0
    assert abs(ratio - 1.0) <= 0.15


def test_size_ratio_small_writing():
    # Core ink is only 20px tall in a 40px unit zone -> ratio = 0.50
    crop = np.full((40, 60), 255, dtype=np.uint8)
    crop[20:40, 10:50] = 0  # ink only in lower 20px
    bbox = (100, 460, 60, 40)

    ratio = compute_size_ratio(
        binary_crop=crop,
        word_bbox=bbox,
        midline_y=460,
        baseline_y=500,
        unit_height=40.0,
    )
    assert ratio == 0.50
