"""CV Pipeline §6.4: Size Consistency Feature Extraction.

Measures the core ink height between baseline and midline to evaluate size control.
"""

from typing import Tuple

import numpy as np


def compute_size_ratio(
    binary_crop: np.ndarray,
    word_bbox: Tuple[int, int, int, int],
    midline_y: int,
    baseline_y: int,
    unit_height: float,
) -> float:
    """Compute the normalized core size ratio for a word.

    Parameters
    ----------
    binary_crop : np.ndarray
        Binarized word crop.
    word_bbox : Tuple[int, int, int, int]
        Word bounding box (x, y, w, h) in deskewed image coordinates.
    midline_y : int
        Y-coordinate of the midline guideline.
    baseline_y : int
        Y-coordinate of the baseline guideline.
    unit_height : float
        Baseline-to-midline pixel height.

    Returns
    -------
    float
        Ratio of measured core height to guideline unit height (e.g. 0.91).
    """
    _bbox_x, bbox_y, _bbox_w, bbox_h = word_bbox
    norm_unit = max(1.0, float(unit_height))

    if binary_crop is None or binary_crop.size == 0:
        return round(float(min(bbox_h, norm_unit) / norm_unit), 2)

    # Identify ink pixels
    if np.mean(binary_crop == 0) > 0.5:
        ink_ys, _ = np.where(binary_crop == 0)
    else:
        ink_ys, _ = np.where(binary_crop < 128)

    if len(ink_ys) == 0:
        return round(float(min(bbox_h, norm_unit) / norm_unit), 2)

    # Local midline and baseline in crop coordinates
    midline_local = midline_y - bbox_y
    baseline_local = baseline_y - bbox_y

    # Core zone band with 10% margin
    zone_margin = int(0.10 * norm_unit)
    core_top = midline_local - zone_margin
    core_bottom = baseline_local + zone_margin

    # Filter ink pixels falling within the core zone
    core_ink_ys = ink_ys[(ink_ys >= core_top) & (ink_ys <= core_bottom)]

    if len(core_ink_ys) > 0:
        core_height = float(np.max(core_ink_ys) - np.min(core_ink_ys) + 1)
    else:
        core_height = float(min(bbox_h, norm_unit))

    ratio = core_height / norm_unit
    return round(float(ratio), 2)
