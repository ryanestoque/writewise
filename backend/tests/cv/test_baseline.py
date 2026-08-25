import numpy as np

from app.cv.features.baseline import compute_baseline_deviation


def test_baseline_deviation_perfect_alignment():
    # Baseline at y=500, unit_height=50. Word bbox: (100, 450, 80, 50) -> bottom y = 500
    bbox = (100, 450, 80, 50)
    deviation = compute_baseline_deviation(word_bbox=bbox, baseline_y=500, unit_height=50.0)
    assert deviation == 0.0


def test_baseline_deviation_floating_above():
    # Baseline at y=500, unit_height=50. Word bottom at y=490 -> diff = 10 -> ratio = 10/50 = 0.20
    bbox = (100, 440, 80, 50)  # y_bottom = 490
    deviation = compute_baseline_deviation(word_bbox=bbox, baseline_y=500, unit_height=50.0)
    assert deviation == 0.20


def test_baseline_deviation_dipping_below():
    # Baseline at y=500, unit_height=50. Word bottom at y=510 -> diff = 10 -> ratio = 10/50 = 0.20
    bbox = (100, 460, 80, 50)  # y_bottom = 510
    deviation = compute_baseline_deviation(word_bbox=bbox, baseline_y=500, unit_height=50.0)
    assert deviation == 0.20


def test_baseline_deviation_with_binary_crop():
    # Crop height 60, ink down to row 50 (relative to bbox_y=440) -> bottom ink y = 490
    crop = np.full((60, 80), 255, dtype=np.uint8)
    crop[10:51, 10:70] = 0  # ink down to index 50
    bbox = (100, 440, 80, 60)
    deviation = compute_baseline_deviation(
        word_bbox=bbox, baseline_y=500, unit_height=50.0, binary_crop=crop
    )
    # y_bottom = 440 + 50 = 490. diff = |490 - 500| = 10. ratio = 10/50 = 0.20
    assert deviation == 0.20
