import pytest

from app.cv.quality_gate import QualityGateRejection, QualityMetrics, run_quality_gate
from tests.synthetic import (
    make_blurry_image,
    make_bright_image,
    make_dark_image,
    make_low_contrast_image,
    make_sharp_worksheet,
    make_small_image,
)


def test_quality_gate_rejection_carries_fields():
    exc = QualityGateRejection(
        code="QUALITY_GATE_BLUR",
        message="too blurry",
        measured_value=8.1,
        threshold=15.0,
    )
    assert exc.code == "QUALITY_GATE_BLUR"
    assert exc.message == "too blurry"
    assert exc.measured_value == 8.1
    assert exc.threshold == 15.0
    with pytest.raises(QualityGateRejection):
        raise exc


def test_quality_metrics_carries_fields():
    metrics = QualityMetrics(
        blur_variance=300.0,
        brightness_mean=150.0,
        contrast_std=35.0,
        resolution_short_side=2000,
    )
    assert metrics.blur_variance == 300.0
    assert metrics.resolution_short_side == 2000


def test_small_image_rejected_on_resolution():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_small_image())
    assert exc_info.value.code == "QUALITY_GATE_RESOLUTION"
    assert exc_info.value.measured_value == 600.0
    assert exc_info.value.threshold == 1500.0


def test_sharp_worksheet_passes_resolution():
    # Full end-to-end pass is tested once all four checks exist (Step 19).
    # For now this only exercises resolution, so call the private helper
    # directly rather than the not-yet-complete run_quality_gate.
    import cv2
    import numpy as np

    from app.cv.quality_gate import _check_resolution

    array = np.frombuffer(make_sharp_worksheet(), dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    assert _check_resolution(image) == 2000


def test_blurry_image_rejected_on_blur():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_blurry_image())
    assert exc_info.value.code == "QUALITY_GATE_BLUR"
    assert exc_info.value.threshold == 15.0


def test_dark_image_rejected_on_brightness():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_dark_image())
    assert exc_info.value.code == "QUALITY_GATE_BRIGHTNESS"
    assert exc_info.value.threshold == 50.0


def test_bright_image_rejected_on_brightness():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_bright_image())
    assert exc_info.value.code == "QUALITY_GATE_BRIGHTNESS"
    assert exc_info.value.threshold == 210.0


def test_low_contrast_image_rejected_on_contrast():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_low_contrast_image())
    assert exc_info.value.code == "QUALITY_GATE_CONTRAST"
    assert exc_info.value.threshold == 12.0


def test_sharp_worksheet_passes_end_to_end():
    result = run_quality_gate(make_sharp_worksheet())
    assert isinstance(result, QualityMetrics)
    assert result.resolution_short_side >= 1500
    assert result.blur_variance >= 15.0
    assert 50 <= result.brightness_mean <= 210
    assert result.contrast_std >= 12.0


def test_realistic_sparse_pencil_worksheet_passes_contrast():
    """Verify that a realistic phone capture of sparse cursive writing on ruled paper
    (which naturally has lower global standard deviation due to mostly blank paper)
    passes the contrast check.
    """
    import numpy as np

    from app.cv.quality_gate import _check_contrast

    # Simulate 12MP capture of ruled notebook paper with sparse pencil writing (~16–19 std)
    h, w = 4000, 3000
    paper = np.random.normal(145, 14, (h, w)).clip(0, 255).astype(np.uint8)
    std = _check_contrast(paper)
    assert std >= 12.0


def test_realistic_sparse_pencil_worksheet_passes_blur():
    """Verify that a sharp, realistic phone photo with sparse pencil writing
    (which naturally has lower global variance due to blank paper) passes blur check.
    """
    from app.cv.quality_gate import _check_blur
    from tests.synthetic import _base_worksheet

    # Simulate 12MP phone camera with sparse pencil writing
    img = _base_worksheet(3000, 4000, bg_value=190, ink_value=90, density=350000)
    variance = _check_blur(img)
    assert variance >= 15.0


def test_realistic_sparse_pencil_worksheet_blurred_is_rejected():
    """Verify that an actual blurry photo of sparse writing is reliably caught."""
    import cv2

    from app.cv.quality_gate import _check_blur
    from tests.synthetic import _base_worksheet

    img = _base_worksheet(3000, 4000, bg_value=190, ink_value=90, density=350000)
    blurred = cv2.GaussianBlur(img, (25, 25), 5.0)
    with pytest.raises(QualityGateRejection) as exc_info:
        _check_blur(blurred)
    assert exc_info.value.code == "QUALITY_GATE_BLUR"
    assert exc_info.value.threshold == 15.0


def test_fail_fast_checks_resolution_first():
    # Combine multiple failure modes (small + dark + blurred); resolution
    # is checked first, so that must be the reported failure regardless
    # of what else is wrong with the image.
    import cv2
    import numpy as np

    array = np.frombuffer(make_small_image(), dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    darkened = np.clip(gray.astype(int) - 100, 0, 255).astype("uint8")
    blurred = cv2.GaussianBlur(darkened, (31, 31), 15)
    _, buf = cv2.imencode(".jpg", blurred)

    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(buf.tobytes())
    assert exc_info.value.code == "QUALITY_GATE_RESOLUTION"
