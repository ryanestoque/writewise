"""Quality gate: fast, cheap image-quality checks that run before any
expensive CV/CNN processing (CV_PIPELINE §2).
"""

from dataclasses import dataclass

import cv2
import numpy as np

# Provisional capture thresholds; validate against real phone photos before treating
# them as calibrated. Blank paper and printed rules must not dominate writing detail.
RESOLUTION_MIN_SHORT_SIDE = 1500
BLUR_VARIANCE_MIN = 15.0
BRIGHTNESS_MIN = 50
BRIGHTNESS_MAX = 210
STROKE_CONTRAST_MIN = 12.0

# Require sustained stroke-to-paper separation so paper/sensor noise cannot
# dominate the detail population merely by covering more pixels than the writing.
_MIN_DETAIL_PIXELS = 100
_MIN_COMPONENT_PIXELS = 16


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


@dataclass
class _WritingDetail:
    blur_variance: float
    stroke_contrast: float


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


def _find_dashed_rules(candidates: np.ndarray) -> np.ndarray:
    """Join short straight structures to find horizontal dashed midlines."""
    w = candidates.shape[1]
    dash_seeds = cv2.morphologyEx(
        candidates,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (max(12, int(w * 0.015)), 1)),
    )
    joined_dashes = cv2.morphologyEx(
        dash_seeds,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, int(w * 0.03)), 1)),
    )
    return cv2.morphologyEx(
        joined_dashes,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (max(30, int(w * 0.12)), 1)),
    )


def _measure_writing_detail(gray: np.ndarray) -> _WritingDetail:
    """Measure local stroke detail without blank margins or long printed rules.

    This is a cheap candidate mask, not text recognition or word segmentation.
    Closing estimates the nearby paper intensity even under gradual shadows.
    """
    h, w = gray.shape[:2]
    short_side = min(h, w)
    if short_side > RESOLUTION_MIN_SHORT_SIDE:
        scale = RESOLUTION_MIN_SHORT_SIDE / short_side
        eval_gray = cv2.resize(
            gray,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_AREA,
        )
    else:
        eval_gray = gray

    # Sensor/JPEG noise must neither overwhelm contrast candidates nor count as
    # sharp handwriting. A small median filter preserves the stroke boundaries.
    eval_gray = cv2.medianBlur(eval_gray, 3)
    h, w = eval_gray.shape
    background = cv2.morphologyEx(
        eval_gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (41, 41))
    )
    stroke_delta = cv2.subtract(background, eval_gray)
    candidates = (stroke_delta >= STROKE_CONTRAST_MIN).astype(np.uint8) * 255
    _, labels, stats, _ = cv2.connectedComponentsWithStats(candidates)
    keep_components = stats[:, cv2.CC_STAT_AREA] >= _MIN_COMPONENT_PIXELS
    keep_components[0] = False
    candidates = keep_components[labels].astype(np.uint8) * 255

    horizontal = cv2.morphologyEx(
        candidates,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (max(30, int(w * 0.12)), 1)),
    )
    vertical = cv2.morphologyEx(
        candidates,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(30, int(h * 0.12)))),
    )
    # Join only short straight horizontal structures when looking for dashed
    # midlines. Bridging arbitrary foreground gaps would also erase cursive joins.
    rule_mask = horizontal | vertical | _find_dashed_rules(candidates)
    # Phone captures can be rotated before downstream deskew. Suppress those
    # long rules too, so their sharp diagonal edges cannot mask blurred writing.
    lines = cv2.HoughLinesP(
        candidates,
        rho=1,
        theta=np.pi / 180,
        threshold=max(60, int(w * 0.10)),
        minLineLength=max(80, int(w * 0.15)),
        maxLineGap=10,
    )
    ruling_angles: list[tuple[float, float]] = []
    if lines is not None:
        for x1, y1, x2, y2 in lines.reshape(-1, 4):
            angle = (float(np.degrees(np.arctan2(y2 - y1, x2 - x1))) + 90) % 180 - 90
            if abs(angle) <= 15:
                ruling_angles.append((angle, float(np.hypot(x2 - x1, y2 - y1))))
            if abs(angle) <= 15 or abs(angle) >= 75:
                cv2.line(rule_mask, (x1, y1), (x2, y2), 255, thickness=3)

    if ruling_angles:
        # Numerous shorter handwriting segments can outvote printed rules in
        # an unweighted median. Estimate the page angle from the longest lines.
        longest = max(length for _, length in ruling_angles)
        angle = float(np.median([a for a, length in ruling_angles if length >= 0.8 * longest]))
        if abs(angle) >= 0.5:
            # Align only the measurement mask to join tilted dashes, then map
            # the exclusions back. The uploaded image and its strokes stay intact.
            transform = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
            aligned = cv2.warpAffine(candidates, transform, (w, h), flags=cv2.INTER_NEAREST)
            aligned_rules = _find_dashed_rules(aligned)
            tilted_rules = cv2.warpAffine(
                aligned_rules,
                cv2.invertAffineTransform(transform),
                (w, h),
                flags=cv2.INTER_NEAREST,
            )
            rule_mask |= tilted_rules
    rules = cv2.dilate(rule_mask, np.ones((7, 7), dtype=np.uint8)) > 0
    candidates[rules] = 0

    # Discard photo-edge borders and the interpolation ring around excluded rules.
    margin_y, margin_x = max(1, int(h * 0.02)), max(1, int(w * 0.02))
    candidates[:margin_y, :] = candidates[-margin_y:, :] = 0
    candidates[:, :margin_x] = candidates[:, -margin_x:] = 0
    stroke_values = stroke_delta[candidates > 0]
    if stroke_values.size < _MIN_DETAIL_PIXELS:
        return _WritingDetail(blur_variance=0.0, stroke_contrast=0.0)

    # Include stroke edges when measuring focus, while keeping ruling edges out.
    detail_mask = cv2.dilate(candidates, np.ones((7, 7), dtype=np.uint8)) > 0
    detail_mask[rules] = False
    laplacian = cv2.Laplacian(eval_gray, cv2.CV_64F)
    contrast = float(np.percentile(stroke_values, 90))
    # Faint but sharp pencil has smaller derivatives than dark ink. Compensate
    # within the readable contrast range rather than labeling faintness as blur.
    contrast_scale = max(1.0, (2 * STROKE_CONTRAST_MIN) / contrast)
    return _WritingDetail(
        blur_variance=float(laplacian[detail_mask].var()) * contrast_scale**2,
        stroke_contrast=contrast,
    )


def _check_blur(gray: np.ndarray, *, detail: _WritingDetail | None = None) -> float:
    variance = (detail or _measure_writing_detail(gray)).blur_variance
    if variance < BLUR_VARIANCE_MIN:
        raise QualityGateRejection(
            code="QUALITY_GATE_BLUR",
            message="This photo is too blurry to analyze. Hold the camera steady and try again.",
            measured_value=float(variance),
            threshold=float(BLUR_VARIANCE_MIN),
        )
    return float(variance)


def _check_brightness(gray: np.ndarray, *, detail: _WritingDetail) -> float:
    mean = gray.mean()
    if mean < BRIGHTNESS_MIN:
        raise QualityGateRejection(
            code="QUALITY_GATE_BRIGHTNESS",
            message="This photo is too dark to analyze. Retake it in better lighting.",
            measured_value=float(mean),
            threshold=float(BRIGHTNESS_MIN),
        )
    if mean > BRIGHTNESS_MAX and detail.stroke_contrast < STROKE_CONTRAST_MIN:
        raise QualityGateRejection(
            code="QUALITY_GATE_BRIGHTNESS",
            message="This bright photo does not show enough writing detail. "
            "Retake it in even lighting without direct light or flash.",
            measured_value=float(mean),
            threshold=float(BRIGHTNESS_MAX),
        )
    return float(mean)


def _check_contrast(gray: np.ndarray, *, detail: _WritingDetail | None = None) -> float:
    contrast = (detail or _measure_writing_detail(gray)).stroke_contrast
    if contrast < STROKE_CONTRAST_MIN:
        raise QualityGateRejection(
            code="QUALITY_GATE_CONTRAST",
            message="This photo doesn't have enough contrast to analyze. "
            "Retake it in even lighting with the camera focused on the writing.",
            measured_value=contrast,
            threshold=STROKE_CONTRAST_MIN,
        )
    # Retain the existing diagnostic field; acceptance uses local stroke contrast.
    return float(gray.std())


def run_quality_gate(image_bytes: bytes) -> QualityMetrics:
    """
    Run all four quality checks on a hardened JPEG image.

    Checks run in order, fail-fast on first failure:
    1. Resolution (shortest side)
    2. Brightness (dark capture, or bright capture with lost writing detail)
    3. Contrast (local stroke-to-paper intensity difference)
    4. Blur (Laplacian variance around stroke candidates, excluding printed rules)

    Returns QualityMetrics on success.
    Raises QualityGateRejection on failure.
    """
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)

    short_side = _check_resolution(image)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    detail = _measure_writing_detail(gray)
    brightness_mean = _check_brightness(gray, detail=detail)
    contrast_std = _check_contrast(gray, detail=detail)
    blur_variance = _check_blur(gray, detail=detail)

    return QualityMetrics(
        blur_variance=blur_variance,
        brightness_mean=brightness_mean,
        contrast_std=contrast_std,
        resolution_short_side=short_side,
    )
