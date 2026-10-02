"""OpenCV Stroke Skeleton Tracing & Cursive Letter Zoning.

Converts word binary crops into SVG vector stroke paths (centerline pen trace)
and segments cursive words into letter zones for explainable visual feedback.
"""

from dataclasses import dataclass
from typing import List, Optional

import cv2
import numpy as np


@dataclass
class LetterZone:
    """Character zone within a cursive word crop."""

    char: str
    bbox: List[int]  # [x, y, w, h] in absolute worksheet canvas space
    confidence: Optional[float] = None
    peak_t: Optional[int] = None


def morphological_skeleton(binary_inv: np.ndarray) -> np.ndarray:
    """Compute 1-pixel wide morphological skeleton of ink strokes."""
    if binary_inv is None or binary_inv.size == 0 or cv2.countNonZero(binary_inv) == 0:
        return (
            np.zeros_like(binary_inv)
            if binary_inv is not None
            else np.zeros((0, 0), dtype=np.uint8)
        )

    skeleton = np.zeros(binary_inv.shape, dtype=np.uint8)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    temp = np.empty_like(binary_inv)
    eroded = np.empty_like(binary_inv)
    img = binary_inv.copy()

    while True:
        cv2.erode(img, element, eroded)
        cv2.dilate(eroded, element, temp)
        cv2.subtract(img, temp, temp)
        cv2.bitwise_or(skeleton, temp, skeleton)
        img[:] = eroded
        if cv2.countNonZero(img) == 0:
            break
    return skeleton


def extract_stroke_svg_paths(
    binary_crop: np.ndarray,
    word_bbox: List[int],
    epsilon_factor: float = 0.015,
) -> List[str]:
    """Convert binary crop ink strokes into SVG path strings ("M x y L x y ...").
    Parameters
    ----------
    binary_crop : np.ndarray
        Binary crop image where ink pixels are > 0.
    word_bbox : List[int]
        Word bounding box [x0, y0, width, height] on the worksheet canvas.
    epsilon_factor : float
        Polyline simplification factor for Douglas-Peucker algorithm.

    Returns
    -------
    List[str]
        List of SVG path string definitions ('d' attribute).
    """
    if binary_crop is None or binary_crop.size == 0 or len(word_bbox) < 4:
        return []

    x0, y0, w_box, h_box = word_bbox[:4]
    h_crop, w_crop = binary_crop.shape[:2]

    if h_crop == 0 or w_crop == 0 or cv2.countNonZero(binary_crop) == 0:
        return []

    # Calculate scale factor if crop dimensions differ slightly from bbox dimensions
    scale_x = w_box / float(w_crop)
    scale_y = h_box / float(h_crop)

    # 1. Compute 1-pixel wide skeleton trace of handwriting ink
    skel = morphological_skeleton(binary_crop)

    if cv2.countNonZero(skel) == 0:
        return []

    # 2. Extract polyline contours from the skeleton
    contours, _ = cv2.findContours(skel, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)

    svg_paths: List[str] = []
    for cnt in contours:
        if len(cnt) < 2:
            continue

        # Simplify contour to reduce vertex count while preserving curve fidelity
        peri = cv2.arcLength(cnt, False)
        epsilon = max(1.0, epsilon_factor * peri)
        approx = cv2.approxPolyDP(cnt, epsilon, False)

        if len(approx) < 2:
            continue

        path_cmds: List[str] = []
        for i, pt in enumerate(approx):
            px, py = pt[0]
            # Translate local crop coordinates to absolute canvas coordinates
            canvas_x = round(x0 + px * scale_x, 1)
            canvas_y = round(y0 + py * scale_y, 1)

            # Format float nicely without trailing .0 if integer
            x_str = f"{int(canvas_x)}" if canvas_x.is_integer() else f"{canvas_x:.1f}"
            y_str = f"{int(canvas_y)}" if canvas_y.is_integer() else f"{canvas_y:.1f}"

            if i == 0:
                path_cmds.append(f"M {x_str} {y_str}")
            else:
                path_cmds.append(f"L {x_str} {y_str}")

        svg_paths.append(" ".join(path_cmds))

    return svg_paths


def segment_word_letter_zones(
    binary_crop: np.ndarray,
    word_bbox: List[int],
    expected_text: Optional[str] = None,
) -> List[LetterZone]:
    """Segment word crop into letter zones relative to the absolute worksheet canvas.

    Uses vertical projection profile with 1D Gaussian smoothing to find natural
    cursive ligature valleys between connected characters.

    Parameters
    ----------
    binary_crop : np.ndarray
        Binary crop where ink > 0.
    word_bbox : List[int]
        Word bounding box [x0, y0, w, h] on worksheet canvas.
    expected_text : Optional[str]
        Target prompt word text (e.g. "banana").

    Returns
    -------
    List[LetterZone]
        List of letter zones with character labels and canvas bounding boxes.
    """
    if not expected_text or len(expected_text) == 0 or len(word_bbox) < 4:
        return []

    x0, y0, w_box, h_box = word_bbox[:4]
    n_letters = len(expected_text)

    if binary_crop is None or binary_crop.size == 0 or cv2.countNonZero(binary_crop) == 0:
        # Fallback to uniform horizontal partitioning across word bbox
        char_w = w_box / float(n_letters)
        zones: List[LetterZone] = []
        for i, char in enumerate(expected_text):
            x_min = int(round(x0 + i * char_w))
            x_max = int(round(x0 + (i + 1) * char_w))
            zones.append(
                LetterZone(
                    char=char,
                    bbox=[x_min, y0, max(1, x_max - x_min), h_box],
                    confidence=0.90,
                )
            )
        return zones

    h_crop, w_crop = binary_crop.shape[:2]
    scale_x = w_box / float(w_crop)

    # 1. Compute vertical projection profile (ink column density)
    proj = np.sum(binary_crop > 0, axis=0).astype(float)
    non_zero = np.where(proj > 0)[0]
    if len(non_zero) == 0:
        x_start, x_end = 0, w_crop
    else:
        x_start, x_end = int(non_zero[0]), int(non_zero[-1])

    span = max(1, x_end - x_start)

    # 2. Smooth vertical projection with 1D Gaussian blur to locate ligature valleys
    kernel_size = max(5, int(w_crop * 0.04))
    if kernel_size % 2 == 0:
        kernel_size += 1
    smoothed = cv2.GaussianBlur(proj.reshape(1, -1), (kernel_size, 1), 0).flatten()

    # 3. Proportionally partition word span and snap boundaries to local projection minima (valleys)
    initial_char_w = span / float(n_letters)
    boundaries = [x_start]

    curr_x = x_start
    for i in range(n_letters - 1):
        target_split = curr_x + initial_char_w
        search_radius = int(initial_char_w * 0.30)
        search_start = max(curr_x + 5, int(target_split - search_radius))
        search_end = min(w_crop - 1, int(target_split + search_radius))

        if search_end > search_start:
            local_min_offset = int(np.argmin(smoothed[search_start:search_end]))
            snapped_split = search_start + local_min_offset
        else:
            snapped_split = int(round(target_split))

        boundaries.append(snapped_split)
        curr_x = snapped_split

    boundaries.append(x_end)

    # 4. Construct LetterZone objects in absolute canvas coordinates
    zones: List[LetterZone] = []
    for i, char in enumerate(expected_text):
        c_min_crop = boundaries[i]
        c_max_crop = boundaries[i + 1]

        canvas_x = int(round(x0 + c_min_crop * scale_x))
        canvas_w = max(1, int(round((c_max_crop - c_min_crop) * scale_x)))

        zones.append(
            LetterZone(
                char=char,
                bbox=[canvas_x, y0, canvas_w, h_box],
                confidence=0.92,
            )
        )

    return zones

