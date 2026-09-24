"""CV Pipeline §4: Guide-Line Detection & Deskew.

Detects the 3-line ruling (topline, midline, baseline) and deskews the image.
"""

from dataclasses import dataclass
from typing import List, Optional

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
    deskew_angle: float = 0.0
    color: Optional[np.ndarray] = None
    deskewed_image_bytes: Optional[bytes] = None


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

    gray = cv2.warpAffine(preprocessed.gray, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=255)
    denoised = cv2.warpAffine(
        preprocessed.denoised, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=255
    )
    binary = cv2.warpAffine(preprocessed.binary, M, (w, h), flags=cv2.INTER_NEAREST, borderValue=0)

    # Deskew color image for storage persistence when tilted
    deskewed_color = None
    deskewed_bytes = None
    if preprocessed.color is not None:
        if abs(deskew_angle) >= 0.1:
            deskewed_color = cv2.warpAffine(
                preprocessed.color, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255)
            )
            success, enc = cv2.imencode(".jpg", deskewed_color, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
            if success:
                deskewed_bytes = enc.tobytes()
        else:
            deskewed_color = preprocessed.color

    # 3. Find line Y-coordinates in deskewed image
    # Extract true horizontal line structures before finding row projection peaks
    # to prevent wide cursive handwriting words from being misidentified as guidelines.
    k_w = max(40, int(w * 0.08))
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_w, 1))
    h_only = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel)

    row_proj = np.sum(h_only, axis=1) / 255.0  # number of guideline ink pixels per row

    # Find peaks (rows with many guideline ink pixels)
    peak_threshold = max(50, int(w * 0.08))
    min_line_spacing = max(20, int(h * 0.012))
    max_total_span = int(h * 0.35)
    margin_guard = max(15, int(h * 0.02))

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
                if peaks and (peak_center - peaks[-1]) < min_line_spacing:
                    if row_proj[peak_center] > row_proj[peaks[-1]]:
                        peaks[-1] = peak_center
                else:
                    peaks.append(peak_center)
    if in_peak:
        peak_center = (peak_start + len(row_proj) - 1) // 2
        if peaks and (peak_center - peaks[-1]) < min_line_spacing:
            if row_proj[peak_center] > row_proj[peaks[-1]]:
                peaks[-1] = peak_center
        else:
            peaks.append(peak_center)

    # Group and validate rulings (topline, midline, baseline)
    # A standard Grade 3 worksheet has a repeating 3-line ruling.
    # Geometry validation ensures border noise, shadows, or absurd spacing (<20px / 5px)
    # are never accepted as handwriting guidelines.
    baseline_y = []
    midline_y = []
    topline_y = []

    if len(peaks) >= 3:
        i = 0
        while i <= len(peaks) - 3:
            t = peaks[i]
            m = peaks[i + 1]
            b = peaks[i + 2]

            sp1 = m - t
            sp2 = b - m

            if (
                sp1 >= min_line_spacing
                and sp2 >= min_line_spacing
                and (b - t) <= max_total_span
                and (0.55 <= (sp1 / sp2) <= 1.8)
                and t >= margin_guard
                and b <= (h - margin_guard)
            ):
                topline_y.append(t)
                midline_y.append(m)
                baseline_y.append(b)

                avg_sp = (sp1 + sp2) / 2.0
                # On continuously ruled paper where base of row N is top of row N+1, advance by 2
                if (i + 3 < len(peaks)) and (peaks[i + 3] - b < avg_sp * 1.6):
                    i += 2
                else:
                    i += 3
                continue
            i += 1

    # Filter rulings for global spacing consistency across the page.
    # Hand-ruled or printed worksheets have uniform line height; noise clusters
    # near paper margins (like shadows, barcodes, or text) with abnormal spacing are rejected.
    if len(baseline_y) >= 2:
        sps = [(b - t) / 2.0 for t, b in zip(topline_y, baseline_y)]
        med_sp = float(np.median(sps))
        filtered_top = []
        filtered_mid = []
        filtered_base = []
        for t, m, b, sp in zip(topline_y, midline_y, baseline_y, sps):
            if 0.6 <= (sp / med_sp) <= 1.5:
                filtered_top.append(t)
                filtered_mid.append(m)
                filtered_base.append(b)
        topline_y = filtered_top
        midline_y = filtered_mid
        baseline_y = filtered_base

    return DeskewResult(
        gray=gray,
        denoised=denoised,
        binary=binary,
        baseline_y=baseline_y,
        midline_y=midline_y,
        topline_y=topline_y,
        deskew_angle=deskew_angle,
        color=deskewed_color,
        deskewed_image_bytes=deskewed_bytes,
    )
