import pytest

from app.cv.quality_gate import QualityGateRejection, QualityMetrics, run_quality_gate
from tests.synthetic import make_blurry_image, make_sharp_worksheet, make_small_image


def test_quality_gate_rejection_carries_fields():
    exc = QualityGateRejection(
        code="QUALITY_GATE_BLUR",
        message="too blurry",
        measured_value=42.1,
        threshold=100.0,
    )
    assert exc.code == "QUALITY_GATE_BLUR"
    assert exc.message == "too blurry"
    assert exc.measured_value == 42.1
    assert exc.threshold == 100.0
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
    from app.cv.quality_gate import _check_resolution
    import cv2
    import numpy as np

    array = np.frombuffer(make_sharp_worksheet(), dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    assert _check_resolution(image) == 2000


def test_blurry_image_rejected_on_blur():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_blurry_image())
    assert exc_info.value.code == "QUALITY_GATE_BLUR"