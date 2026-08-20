import pytest

from app.cv.quality_gate import QualityGateRejection, QualityMetrics


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