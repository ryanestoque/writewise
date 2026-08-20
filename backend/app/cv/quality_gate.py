"""Quality gate: fast, cheap image-quality checks that run before any
expensive CV/CNN processing (CV_PIPELINE §2).
"""

from dataclasses import dataclass

import cv2
import numpy as np

# Tunable thresholds — starting defaults per CV_PIPELINE §2 note, to be
# recalibrated once real Phase 1 photos flow.
RESOLUTION_MIN_SHORT_SIDE = 1500
BLUR_VARIANCE_MIN = 100.0
BRIGHTNESS_MIN = 50
BRIGHTNESS_MAX = 200
CONTRAST_STD_MIN = 20.0


@dataclass
class QualityGateRejection(Exception):
    """Raised when an image fails a quality check."""

    code: str
    message: str
    measured_value: float
    threshold: float


@dataclass
class QualityMetrics:
    """Quality measurements from all four checks. Returned on pass."""

    blur_variance: float
    brightness_mean: float
    contrast_std: float
    resolution_short_side: int


def _check_resolution(image: np.ndarray) -> int:
    height, width = image.shape[:2]
    short_side = min(width, height)
    if short_side < RESOLUTION_MIN_SHORT_SIDE:
        raise QualityGateRejection(
            code="QUALITY_GATE_RESOLUTION",
            message="This photo's resolution is too low to analyze. "
            "Move closer or use a higher-resolution camera.",
            measured_value=float(short_side),
            threshold=float(RESOLUTION_MIN_SHORT_SIDE),
        )
    return short_side


def run_quality_gate(image_bytes: bytes) -> QualityMetrics:
    """
    Run all four quality checks on a hardened JPEG image.

    Checks run in order, fail-fast on first failure:
    1. Resolution (shortest side)
    2. Blur (Laplacian variance)
    3. Brightness (grayscale mean intensity)
    4. Contrast (grayscale intensity std dev)

    Returns QualityMetrics on success.
    Raises QualityGateRejection on failure.
    """
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)

    short_side = _check_resolution(image)

    # remaining checks added in later steps
    raise NotImplementedError("blur/brightness/contrast checks not yet implemented")