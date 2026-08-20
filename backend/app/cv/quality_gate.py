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