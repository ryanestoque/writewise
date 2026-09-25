"""CV Pipeline §6.3: Baseline Alignment Feature Extraction.

Measures the vertical distance between the word's lower ink boundary and the detected baseline.
"""

from typing import Optional, Tuple

import numpy as np

from app.cv.features.utils import get_ink_mask


def compute_baseline_deviation(
    word_bbox: Tuple[int, int, int, int],
    baseline_y: int,
    unit_height: float,
    binary_crop: Optional[np.ndarray] = None,
) -> Tuple[float, int]:
    """Compute normalized baseline deviation ratio and resting baseline y.

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
    Tuple[float, int]
        (deviation_ratio, measured_y) where deviation_ratio is relative to unit height
        and measured_y is the absolute Y-coordinate of the word's resting baseline.
    """
    _bbox_x, bbox_y, _bbox_w, bbox_h = word_bbox
    norm_unit = max(1.0, float(unit_height))

    if binary_crop is not None and binary_crop.size > 0:
        ink_mask = get_ink_mask(binary_crop)
        ink_ys, ink_xs = np.where(ink_mask)

        if len(ink_ys) > 0:
            # Find the bottom-most ink pixel in each ink-containing column
            # to prevent isolated descender loops (q, f, g, y, p) from dominating the baseline
            col_bottoms = []
            unique_xs = np.unique(ink_xs)
            for x in unique_xs:
                col_bottoms.append(int(np.max(ink_ys[ink_xs == x])))

            if len(col_bottoms) > 0:
                # 60th percentile represents the common bottom shelf of letter bodies
                # without being thrown off by descender loops (occupying 10-25% of width)
                y_bottom = bbox_y + int(np.percentile(col_bottoms, 60))
            else:
                y_bottom = bbox_y + int(np.max(ink_ys))
        else:
            y_bottom = bbox_y + bbox_h
    else:
        y_bottom = bbox_y + bbox_h

    deviation_pixels = abs(y_bottom - baseline_y)
    deviation_ratio = deviation_pixels / norm_unit
    return round(float(deviation_ratio), 2), int(y_bottom)
