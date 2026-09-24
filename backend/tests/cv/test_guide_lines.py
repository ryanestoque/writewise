"""Unit tests for CV Pipeline §4: Guide-Line Detection & Deskew."""

from app.cv.guide_lines import DeskewResult, detect_and_deskew
from app.cv.preprocessing import preprocess
from tests.synthetic import make_3line_worksheet


def test_detect_and_deskew_result_fields():
    """Smoke-test that the dataclass carries all expected fields."""
    image_bytes = make_3line_worksheet()
    preprocessed = preprocess(image_bytes)
    result = detect_and_deskew(preprocessed)

    assert isinstance(result, DeskewResult)
    assert len(result.baseline_y) > 0
    assert len(result.midline_y) == len(result.baseline_y)
    assert len(result.topline_y) == len(result.baseline_y)


def test_deskew_corrects_angle():
    """Given a rotated image, deskew should correct it back to horizontal."""
    # Rotate by 5 degrees
    image_bytes = make_3line_worksheet(angle_deg=5.0)
    preprocessed = preprocess(image_bytes)

    # Before deskew, lines are tilted.
    # After deskew, row projection should have sharp peaks (if it's flat).
    result = detect_and_deskew(preprocessed)

    # If correctly deskewed, the y-coordinates should match the known generated spacing
    assert len(result.baseline_y) > 0
    assert abs(result.deskew_angle) > 1.0
    assert result.color is not None
    assert result.deskewed_image_bytes is not None


def test_extracts_correct_y_coordinates():
    """The detected Y-coordinates should match the generated ones."""
    # We know make_3line_worksheet generates rulings at specific intervals.
    image_bytes = make_3line_worksheet(angle_deg=0.0)
    preprocessed = preprocess(image_bytes)
    result = detect_and_deskew(preprocessed)

    assert len(result.baseline_y) == 4  # Assuming default generator makes 4 rows

    # For a horizontal image, distance between top/mid and mid/base should be roughly equal
    # based on the synthetic generator.
    for top, mid, base in zip(result.topline_y, result.midline_y, result.baseline_y):
        assert top < mid < base
        assert 30 < (mid - top) < 100
        assert 30 < (base - mid) < 100


def test_detect_and_deskew_high_resolution():
    """High resolution image (e.g. 12MP photo) with ruling spacing > 150px is grouped correctly."""
    # 4000x5200 image with line_spacing=180px and row_gap=1000px
    image_bytes = make_3line_worksheet(
        width=4000,
        height=5200,
        angle_deg=0.0,
        line_spacing=180,
        row_gap=1000,
    )
    preprocessed = preprocess(image_bytes)
    result = detect_and_deskew(preprocessed)

    # All 4 rulings should be detected, not fragmented by a hardcoded 150px threshold
    assert len(result.baseline_y) == 4
    for top, mid, base in zip(result.topline_y, result.midline_y, result.baseline_y):
        assert top < mid < base
        assert 140 < (mid - top) < 220
        assert 140 < (base - mid) < 220


def test_detect_and_deskew_rejects_spurious_edge_peaks():
    """Detect and deskew must reject noise peaks at image border with absurd spacing."""
    import numpy as np

    from app.cv.preprocessing import PreprocessResult

    # 4064x3048 binary image with spurious noise peaks at the extreme bottom edge (5px spacing)
    h, w = 4064, 3048
    binary = np.zeros((h, w), dtype=np.uint8)
    binary[3947, :] = 255
    binary[3952, :] = 255
    binary[4008, :] = 255

    prep = PreprocessResult(gray=binary, denoised=binary, binary=binary, otsu_threshold=100.0)
    result = detect_and_deskew(prep)

    # Spurious bottom noise (5px spacing) must NOT be accepted as a ruling
    assert 4008 not in result.baseline_y
    assert len(result.baseline_y) == 0
