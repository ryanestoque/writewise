"""CV Pipeline §6.3: Baseline Alignment Feature Extraction.

Measures the vertical distance between the word's lower ink boundary and the detected baseline.
"""

from typing import Optional, Tuple

import cv2
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

        # Suppress horizontal printed guidelines in the lower crop area (below baseline)
        # to prevent printed notebook lines from corrupting baseline measurement
        rel_base_y = baseline_y - bbox_y
        h_len = max(20, int(0.40 * binary_crop.shape[1]))
        if h_len < binary_crop.shape[1] and binary_crop.shape[0] > 0:
            h_lines = cv2.morphologyEx(
                ink_mask.astype(np.uint8),
                cv2.MORPH_OPEN,
                cv2.getStructuringElement(cv2.MORPH_RECT, (h_len, 1)),
            )
            if np.any(h_lines):
                line_mask_half = max(2, int(0.04 * norm_unit))
                h_lines_below = h_lines.copy()
                # Only suppress horizontal line remnants that lie strictly below the baseline_y zone
                cutoff = max(0, rel_base_y + line_mask_half + 1)
                if cutoff < h_lines.shape[0]:
                    h_lines_below[:cutoff, :] = 0
                    ink_mask[h_lines_below > 0] = False

        # Constrain search window for letter-body baseline:
        # A word's resting letter body baseline is near baseline_y.
        # Ink below baseline_y + 0.35 * unit_height belongs to descender loops (q, f, g, y, p)
        # or adjacent lower ruling lines.
        max_search_y = rel_base_y + int(0.35 * norm_unit)

        ink_ys, ink_xs = np.where(ink_mask)

        if len(ink_ys) > 0:
            col_bottoms = []
            unique_xs = np.unique(ink_xs)
            for x in unique_xs:
                col_ys = ink_ys[(ink_xs == x) & (ink_ys <= max_search_y)]
                if len(col_ys) > 0:
                    col_bottoms.append(int(np.max(col_ys)))

            if len(col_bottoms) > 0:
                y_bottom = bbox_y + int(np.percentile(col_bottoms, 60))
            else:
                valid_ys = ink_ys[ink_ys <= max_search_y]
                if len(valid_ys) > 0:
                    y_bottom = bbox_y + int(np.percentile(valid_ys, 60))
                else:
                    y_bottom = bbox_y + int(np.min(ink_ys))
        else:
            y_bottom = bbox_y + bbox_h
    else:
        y_bottom = bbox_y + bbox_h

    deviation_pixels = abs(y_bottom - baseline_y)
    deviation_ratio = deviation_pixels / norm_unit
    return round(float(deviation_ratio), 2), int(y_bottom)

