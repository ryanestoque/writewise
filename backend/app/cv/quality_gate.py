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


def _check_blur(gray: np.ndarray) -> float:
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    if variance < BLUR_VARIANCE_MIN:
        raise QualityGateRejection(
            code="QUALITY_GATE_BLUR",
            message="This photo is too blurry to analyze. Hold the camera steady and try again.",
            measured_value=float(variance),
            threshold=float(BLUR_VARIANCE_MIN),
        )
    return float(variance)


def _check_brightness(gray: np.ndarray) -> float:
    mean = gray.mean()
    if mean < BRIGHTNESS_MIN:
        raise QualityGateRejection(
            code="QUALITY_GATE_BRIGHTNESS",
            message="This photo is too dark to analyze. Retake it in better lighting.",
            measured_value=float(mean),
            threshold=float(BRIGHTNESS_MIN),
        )
    if mean > BRIGHTNESS_MAX:
        raise QualityGateRejection(
            code="QUALITY_GATE_BRIGHTNESS",
            message="This photo is overexposed to analyze. "
            "Retake it with less direct light or flash.",
            measured_value=float(mean),
            threshold=float(BRIGHTNESS_MAX),
        )
    return float(mean)


def _check_contrast(gray: np.ndarray) -> float:
    std = gray.std()
    if std < CONTRAST_STD_MIN:
        raise QualityGateRejection(
            code="QUALITY_GATE_CONTRAST",
            message="This photo doesn't have enough contrast to analyze. "
            "Retake it against a plain, well-lit background.",
            measured_value=float(std),
            threshold=float(CONTRAST_STD_MIN),
        )
    return float(std)


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

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur_variance = _check_blur(gray)
    brightness_mean = _check_brightness(gray)
    contrast_std = _check_contrast(gray)

    return QualityMetrics(
        blur_variance=blur_variance,
        brightness_mean=brightness_mean,
        contrast_std=contrast_std,
        resolution_short_side=short_side,
    )
