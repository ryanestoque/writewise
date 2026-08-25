"""CV Pipeline §6.3: Baseline Alignment Feature Extraction.

Measures the vertical distance between the word's lower ink boundary and the detected baseline.
"""

from typing import Optional, Tuple

import numpy as np


def compute_baseline_deviation(
    word_bbox: Tuple[int, int, int, int],
    baseline_y: int,
    unit_height: float,
    binary_crop: Optional[np.ndarray] = None,
) -> float:
    """Compute normalized baseline deviation ratio for a single word.

    Parameters
    ----------
    word_bbox : Tuple[int, int, int, int]
        Bounding box (x, y, w, h) in deskewed image coordinates.
    baseline_y : int
        Y-coordinate of the reference baseline guideline.
    unit_height : float
        Baseline-to-midline pixel height for normalization.
    binary_crop : Optional[np.ndarray]
        Binarized word crop for precise pixel-level lower boundary detection.

    Returns
    -------
    float
        Deviation ratio relative to unit height (e.g. 0.05).
    """
    _bbox_x, bbox_y, _bbox_w, bbox_h = word_bbox
    norm_unit = max(1.0, float(unit_height))

    if binary_crop is not None and binary_crop.size > 0:
        ink_ys, _ = np.where(binary_crop == 0)
        if len(ink_ys) == 0:
            # Try inverted binary (> 128 is ink)
            ink_ys, _ = np.where(binary_crop > 128)

        if len(ink_ys) > 0:
            y_bottom = bbox_y + int(np.max(ink_ys))
        else:
            y_bottom = bbox_y + bbox_h
    else:
        y_bottom = bbox_y + bbox_h

    deviation_pixels = abs(y_bottom - baseline_y)
    deviation_ratio = deviation_pixels / norm_unit
    return round(float(deviation_ratio), 2)
