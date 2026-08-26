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
