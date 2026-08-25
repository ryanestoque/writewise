"""CV Pipeline §4: Guide-Line Detection & Deskew.

Detects the 3-line ruling (topline, midline, baseline) and deskews the image.
"""

from dataclasses import dataclass
from typing import List

import cv2
import numpy as np

from app.cv.preprocessing import PreprocessResult


@dataclass
class DeskewResult:
    """Output of the guide-line detection and deskew stage."""

    gray: np.ndarray
    denoised: np.ndarray
    binary: np.ndarray
    baseline_y: List[int]
    midline_y: List[int]
    topline_y: List[int]


def detect_and_deskew(preprocessed: PreprocessResult) -> DeskewResult:
    """Detect guide lines and deskew the image.

    Parameters
    ----------
    preprocessed : PreprocessResult
        The output from the preprocessing stage.

    Returns
    -------
    DeskewResult
        The deskewed images and the Y-coordinates of the detected guide lines.
    """
    h, w = preprocessed.binary.shape

    # 1. Detect lines using HoughLinesP
    lines = cv2.HoughLinesP(
        preprocessed.binary,
        rho=1,
        theta=np.pi / 180,
        threshold=int(w * 0.2),  # Require line to span at least 20% of width
        minLineLength=w * 0.3,
        maxLineGap=w * 0.05,
    )

    deskew_angle = 0.0
    if lines is not None:
        angles = []
        for line in lines:
            x1, y1, x2, y2 = line.flatten()
            angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            if -15 < angle < 15:
                angles.append(angle)
        
        if angles:
            deskew_angle = float(np.median(angles))

    # 2. Deskew the images
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, deskew_angle, 1.0)
    
    gray = cv2.warpAffine(
        preprocessed.gray, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=255
    )
    denoised = cv2.warpAffine(
        preprocessed.denoised, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=255
    )
    binary = cv2.warpAffine(
        preprocessed.binary, M, (w, h), flags=cv2.INTER_NEAREST, borderValue=0
    )

    # 3. Find line Y-coordinates in deskewed image
    row_proj = np.sum(binary, axis=1) / 255.0  # number of ink pixels per row
    
    # Find peaks (rows with many ink pixels)
    peak_threshold = w * 0.25  # 25% of width must be ink
    peaks = []
    in_peak = False
    peak_start = 0
    for y, val in enumerate(row_proj):
        if val > peak_threshold:
            if not in_peak:
                in_peak = True
                peak_start = y
        else:
            if in_peak:
                in_peak = False
                peak_center = (peak_start + y - 1) // 2
                peaks.append(peak_center)
    if in_peak:
        peaks.append((peak_start + len(row_proj) - 1) // 2)

    # Group peaks into rows (topline, midline, baseline)
    # A standard Grade 3 worksheet has a repeating 3-line ruling.
    # The gap between lines in a ruling is much smaller than the gap between rulings.
    baseline_y = []
    midline_y = []
    topline_y = []

    if peaks:
        groups = []
        current_group = [peaks[0]]
        
        # Use a dynamic threshold based on median gap if possible, or a fixed reasonable one
        # Max distance between lines in a 3-line ruling is usually < 150px on a 2600px image
        for i in range(1, len(peaks)):
            if peaks[i] - current_group[-1] < 150:
                current_group.append(peaks[i])
            else:
                groups.append(current_group)
                current_group = [peaks[i]]
        groups.append(current_group)
        
        for g in groups:
            if len(g) >= 3:
                # Assuming top-down order (smallest Y to largest Y)
                topline_y.append(g[-3])
                midline_y.append(g[-2])
                baseline_y.append(g[-1])

    return DeskewResult(
        gray=gray,
        denoised=denoised,
        binary=binary,
        baseline_y=baseline_y,
        midline_y=midline_y,
        topline_y=topline_y
    )
