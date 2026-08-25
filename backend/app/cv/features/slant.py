"""CV Pipeline §6.1: Slant Angle Feature Extraction.

Measures the angle of near-vertical pen strokes relative to guide-line perpendicular.
"""

from typing import List

import cv2
import numpy as np


def compute_word_slant(
    binary_crop: np.ndarray,
    reference_perpendicular_deg: float = 90.0,
) -> float:
    """Compute handwriting slant angle (in degrees) for a single word crop.

    Parameters
    ----------
    binary_crop : np.ndarray
        Binarized word crop where ink is dark (0) and paper is light (255),
        or inverted binary where ink is > 0.
    reference_perpendicular_deg : float, default=90.0
        Perpendicular reference angle in degrees relative to horizontal baseline.

    Returns
    -------
    float
        Average slant deviation in degrees (positive = forward/right slant,
        negative = backward/left slant). Defaults to 0.0 if no qualifying
        strokes are detected.
    """
    if binary_crop is None or binary_crop.size == 0:
        return 0.0

    # Ensure ink is foreground (255) for HoughLinesP
    if np.mean(binary_crop == 0) > 0.5:
        # Inverted: ink was 255
        ink_img = (binary_crop == 0).astype(np.uint8) * 255
    else:
        # Standard Otsu: paper 255, ink 0
        ink_img = (binary_crop < 128).astype(np.uint8) * 255

    # If ink image has virtually no ink, return 0.0
    if np.count_nonzero(ink_img) < 10:
        return 0.0

    # Detect line segments using Probabilistic Hough Transform
    lines = cv2.HoughLinesP(
        ink_img,
        rho=1,
        theta=np.pi / 180,
        threshold=10,
        minLineLength=8,
        maxLineGap=3,
    )

    if lines is None or len(lines) == 0:
        return 0.0

    valid_slants: List[float] = []
    for line in lines:
        coords = line.ravel()
        if len(coords) < 4:
            continue
        x1, y1, x2, y2 = coords[0], coords[1], coords[2], coords[3]
        dx = float(x2 - x1)
        dy = float(y2 - y1)

        if dx == 0 and dy == 0:
            continue

        # In image coordinates, y increases downward.
        # Orientation angle in degrees [0, 180): 0 is horizontal right, 90 is vertical down.
        angle = float(np.degrees(np.arctan2(abs(dy), dx)))

        # Filter to near-vertical strokes (within +-45 deg of vertical: 45 to 135 deg)
        if 45.0 <= angle <= 135.0:
            if y2 != y1:
                # normalize so y1 is top (smaller y) and y2 is bottom (larger y)
                if y1 > y2:
                    x1, x2 = x2, x1
                    y1, y2 = y2, y1
                # Forward slant: top leans right relative to bottom (x1 > x2)
                stroke_dx = float(x1 - x2)
                stroke_dy = float(y2 - y1)
                slant_deg = float(np.degrees(np.arctan2(stroke_dx, stroke_dy)))
                if abs(slant_deg) <= 45.0:
                    valid_slants.append(slant_deg)

    if not valid_slants:
        return 0.0

    return round(float(np.mean(valid_slants)), 1)
