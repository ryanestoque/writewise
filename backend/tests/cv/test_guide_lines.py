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


def test_detect_and_deskew_rejects_cursive_handwriting_as_guideline_peak():
    """Wide cursive words (spanning 30%+ of width) must not trigger guideline peaks."""
    import cv2
    import numpy as np

    from app.cv.preprocessing import PreprocessResult

    h, w = 3000, 2400
    binary = np.zeros((h, w), dtype=np.uint8)

    # 3 real guidelines for a ruling (top=1000, mid=1200, base=1400)
    cv2.line(binary, (100, 1000), (w - 100, 1000), 255, thickness=4)
    cv2.line(binary, (100, 1200), (w - 100, 1200), 255, thickness=4)
    cv2.line(binary, (100, 1400), (w - 100, 1400), 255, thickness=4)

    # Simulate a wide cursive handwriting stroke (e.g. at y=1300, spanning 800px)
    # but drawn with diagonal/looping strokes without long straight horizontal runs
    for x in range(400, 1200, 20):
        cv2.line(binary, (x, 1220), (x + 15, 1380), 255, thickness=5)

    prep = PreprocessResult(gray=binary, denoised=binary, binary=binary, otsu_threshold=100.0)
    result = detect_and_deskew(prep)

    # Only the true ruling should be detected, not a split at y=1300
    assert len(result.baseline_y) == 1
    assert result.topline_y[0] == 1000
    assert result.midline_y[0] == 1200
    assert result.baseline_y[0] == 1400


def test_detect_and_deskew_no_overlapping_phantom_rulings():
    """Distinct 3-line rows with inter-row gaps must not produce phantom interlaced rulings."""
    import cv2
    import numpy as np

    from app.cv.preprocessing import PreprocessResult

    h, w = 2000, 2000
    binary = np.zeros((h, w), dtype=np.uint8)

    # 2 distinct 3-line rulings (each having Blue, Red, Blue) with 80px inter-row gap
    # Row 0: 400, 460, 520
    # Row 1: 600, 660, 720
    for y in [400, 460, 520, 600, 660, 720]:
        cv2.line(binary, (100, y), (w - 100, y), 255, thickness=3)

    prep = PreprocessResult(gray=binary, denoised=binary, binary=binary, otsu_threshold=100.0)
    result = detect_and_deskew(prep)

    # Exactly 2 rulings should be detected, NOT 3 (no phantom at (520, 600, 660))
    assert len(result.baseline_y) == 2
    assert result.topline_y == [400, 600]
    assert result.midline_y == [460, 660]
    assert result.baseline_y == [520, 720]


def test_detect_and_deskew_continuous_rulings_detected_correctly():
    """Continuous 3-line rulings (where base of row N is top of row N+1) must not skip rows."""
    import cv2
    import numpy as np

    from app.cv.preprocessing import PreprocessResult

    h, w = 2000, 2000
    binary = np.zeros((h, w), dtype=np.uint8)

    # 3 continuous rulings with uniform 60px line spacing:
    # Row 0: 400, 460, 520
    # Row 1: 520, 580, 640
    # Row 2: 640, 700, 760
    for y in [400, 460, 520, 580, 640, 700, 760]:
        cv2.line(binary, (100, y), (w - 100, y), 255, thickness=3)

    prep = PreprocessResult(gray=binary, denoised=binary, binary=binary, otsu_threshold=100.0)
    result = detect_and_deskew(prep)

    # All 3 continuous rulings must be detected
    assert len(result.baseline_y) == 3
    assert result.topline_y == [400, 520, 640]
    assert result.midline_y == [460, 580, 700]
    assert result.baseline_y == [520, 640, 760]


def test_detect_and_deskew_faint_red_midlines_in_color_image():
    """Faint red midlines (high R, low B) must be preserved in color images."""
    import cv2
    import numpy as np

    from app.cv.preprocessing import preprocess

    h, w = 2000, 2000
    # Create white paper background (BGR = 155, 155, 155)
    color = np.full((h, w, 3), 155, dtype=np.uint8)

    # 1 ruling with Blue Top (400), Faint Red Mid (500), Blue Base (600)
    # Blue top line (R=110, G=125, B=145)
    cv2.line(color, (100, 400), (w - 100, 400), (145, 125, 110), thickness=4)
    # Faint red midline (R=160, G=140, B=135) — faint in standard grayscale
    cv2.line(color, (100, 500), (w - 100, 500), (135, 140, 160), thickness=4)
    # Blue baseline (R=110, G=125, B=145)
    cv2.line(color, (100, 600), (w - 100, 600), (145, 125, 110), thickness=4)

    # Encode as JPEG bytes and preprocess
    _, img_bytes = cv2.imencode(".jpg", color)
    prep = preprocess(img_bytes.tobytes())
    result = detect_and_deskew(prep)

    assert len(result.baseline_y) == 1
    assert result.topline_y[0] == 400
    assert result.midline_y[0] == 500
    assert result.baseline_y[0] == 600

