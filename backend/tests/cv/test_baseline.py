import numpy as np

from app.cv.features.baseline import compute_baseline_deviation


def test_baseline_deviation_perfect_alignment():
    # Baseline at y=500, unit_height=50. Word bbox: (100, 450, 80, 50) -> bottom y = 500
    bbox = (100, 450, 80, 50)
    deviation, measured_y = compute_baseline_deviation(
        word_bbox=bbox, baseline_y=500, unit_height=50.0
    )
    assert deviation == 0.0
    assert measured_y == 500


def test_baseline_deviation_floating_above():
    # Baseline at y=500, unit_height=50. Word bottom at y=490 -> diff = 10 -> ratio = 10/50 = 0.20
    bbox = (100, 440, 80, 50)  # y_bottom = 490
    deviation, measured_y = compute_baseline_deviation(
        word_bbox=bbox, baseline_y=500, unit_height=50.0
    )
    assert deviation == 0.20
    assert measured_y == 490


def test_baseline_deviation_dipping_below():
    # Baseline at y=500, unit_height=50. Word bottom at y=510 -> diff = 10 -> ratio = 10/50 = 0.20
    bbox = (100, 460, 80, 50)  # y_bottom = 510
    deviation, measured_y = compute_baseline_deviation(
        word_bbox=bbox, baseline_y=500, unit_height=50.0
    )
    assert deviation == 0.20
    assert measured_y == 510


def test_baseline_deviation_with_binary_crop():
    # Crop height 60, ink down to row 50 (relative to bbox_y=440) -> bottom ink y = 490
    crop = np.full((60, 80), 255, dtype=np.uint8)
    crop[10:51, 10:70] = 0  # ink down to index 50
    bbox = (100, 440, 80, 60)
    deviation, measured_y = compute_baseline_deviation(
        word_bbox=bbox, baseline_y=500, unit_height=50.0, binary_crop=crop
    )
    # y_bottom = 440 + 50 = 490. diff = |490 - 500| = 10. ratio = 10/50 = 0.20
    assert deviation == 0.20
    assert measured_y == 490


def test_baseline_deviation_with_pipeline_inverted_crop():
    """Pipeline binary crops use THRESH_BINARY_INV (paper=0, ink=255)."""
    # Crop height 60, ink down to row 50 (relative to bbox_y=440) -> bottom ink y = 490
    crop = np.full((60, 80), 0, dtype=np.uint8)
    crop[10:51, 10:70] = 255  # ink down to index 50
    bbox = (100, 440, 80, 60)
    deviation, measured_y = compute_baseline_deviation(
        word_bbox=bbox, baseline_y=500, unit_height=50.0, binary_crop=crop
    )
    # y_bottom = 440 + 50 = 490. diff = |490 - 500| = 10. ratio = 10/50 = 0.20
    assert deviation == 0.20
    assert measured_y == 490


def test_baseline_deviation_ignores_descender_tails():
    """Words with descenders (q, f, g, y, p) must measure the letter-body baseline
    alignment, not the bottom of the descender loop.
    """
    # Crop height 120, width 100.
    # Letter body sits on baseline y=500 (row 50 in crop, bbox_y=450).
    # Letter 'q' has descender extending down to row 110 (y=560).
    crop = np.full((120, 100), 0, dtype=np.uint8)
    # Most columns (x=20..95) have ink ending at row 50:
    crop[10:51, 20:95] = 255
    # Descender column (x=10..15) extends down to row 110:
    crop[10:111, 10:16] = 255

    bbox = (100, 450, 100, 120)
    # Baseline at y=500, unit_height=50.
    deviation, measured_y = compute_baseline_deviation(
        word_bbox=bbox, baseline_y=500, unit_height=50.0, binary_crop=crop
    )
    # Letter body rests at y=450+50=500 -> diff should be <= 0.05, measured_y near 500 (NOT 560!)
    assert deviation <= 0.05
    assert abs(measured_y - 500) <= 2

