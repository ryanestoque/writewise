"""Stem lean and within-word orientation spread (CV_PIPELINE section 6.1).

Straight edge segments are evidence of stem orientation, not recognized letters
or independent pen strokes. Unsupported crops deliberately have no angle.
"""

from dataclasses import dataclass

import cv2
import numpy as np

from app.cv.features.utils import get_ink_mask
from app.cv.tracing import suppress_guidelines_preserving_strokes

SLANT_METHOD = "lsd_stems_v2"
_UNIT_PIXELS = 64.0
_MIN_STEM_HEIGHT = 0.60 * _UNIT_PIXELS
_PADDING = 8


@dataclass(frozen=True)
class SlantEstimate:
    angle_deg: float | None
    std_deg: float | None
    segment_count: int
    # Accepted segments in original crop coordinates, available for local inspection.
    segments: tuple[tuple[float, float, float, float], ...] = ()


def analyze_word_slant(
    binary_crop: np.ndarray,
    reference_perpendicular_deg: float = 90.0,
    *,
    unit_height: float | None = None,
    guideline_rows: tuple[int, ...] = (),
    ink_is_light: bool | None = None,
) -> SlantEstimate:
    """Measure sustained stem edges and their length-weighted angular spread.

    The pipeline supplies printed guideline height and known ink polarity.
    Standalone callers may omit them; ink height then supplies a fallback scale.
    Positive lean is forward/right relative to the reference perpendicular.
    Spread describes detected stem edges, not all letters or a confidence interval.
    """
    unavailable = SlantEstimate(None, None, 0)
    if binary_crop is None or binary_crop.size == 0:
        return unavailable
    if ink_is_light is None:
        mask = get_ink_mask(binary_crop)
    else:
        mask = binary_crop > 128 if ink_is_light else binary_crop < 128
    ink_rows = np.flatnonzero(np.any(mask, axis=1))
    if len(ink_rows) < 2:
        return unavailable
    unit = float(unit_height) if unit_height is not None else float(np.ptp(ink_rows) + 1)
    if not np.isfinite(unit) or unit <= 0:
        return unavailable

    scale = _UNIT_PIXELS / unit
    height, width = mask.shape
    normalized = cv2.resize(
        mask.astype(np.uint8) * 255,
        (max(1, round(width * scale)), max(1, round(height * scale))),
        interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR,
    )
    normalized = cv2.copyMakeBorder(
        normalized,
        _PADDING,
        _PADDING,
        _PADDING,
        _PADDING,
        cv2.BORDER_CONSTANT,
        value=0,
    )
    if guideline_rows:
        normalized = suppress_guidelines_preserving_strokes(
            normalized,
            [0, 0, normalized.shape[1], normalized.shape[0]],
            [round(row * scale) + _PADDING for row in guideline_rows],
        )

    detected = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD).detect(normalized)[0]
    if detected is None:
        return unavailable
    angles, weights, segments = [], [], []
    for x1, y1, x2, y2 in detected.reshape(-1, 4):
        if y1 > y2:
            x1, x2, y1, y2 = x2, x1, y2, y1
        vertical_span = float(y2 - y1)
        if vertical_span < _MIN_STEM_HEIGHT:
            continue
        angle = float(np.degrees(np.arctan2(float(x1 - x2), vertical_span)))
        angle -= reference_perpendicular_deg - 90.0
        angle = (angle + 90.0) % 180.0 - 90.0
        if abs(angle) > 45:
            continue
        angles.append(angle)
        weights.append(vertical_span)
        segments.append(tuple(float((v - _PADDING) / scale) for v in (x1, y1, x2, y2)))
    if not angles:
        return unavailable
    lean = float(np.average(angles, weights=weights))
    spread = float(np.sqrt(np.average((np.asarray(angles) - lean) ** 2, weights=weights)))
    return SlantEstimate(round(lean, 1), round(spread, 1), len(angles), tuple(segments))


def compute_word_slant(
    binary_crop: np.ndarray,
    reference_perpendicular_deg: float = 90.0,
) -> float | None:
    """Return mean stem lean, or None when there is insufficient stem evidence."""
    return analyze_word_slant(binary_crop, reference_perpendicular_deg).angle_deg
