"""CV Pipeline §5: Segmentation — Line segmentation, Word segmentation, and Post-Segmentation Gate.

- §5.1 Line Segmentation: Row bands derived from deskewed guide lines (topline to baseline).
- §5.2 Word Segmentation: Column-gap projection profile per line with dynamic
  median-gap thresholding.
- §5.3 Post-Segmentation Gate: Compares detected word count against activity expected word count.
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np

from app.cv.guide_lines import DeskewResult


@dataclass
class PostSegmentationRejection(Exception):
    """Raised when segmentation fails the post-segmentation quality gate (CV_PIPELINE §5.3)."""

    code: str
    message: str
    detected_words: int
    expected_words: int


@dataclass
class WordSegment:
    """A single segmented word and its crops."""

    word_index: int
    bbox: Tuple[int, int, int, int]  # (x, y, w, h) in deskewed image coordinates
    gray_crop: np.ndarray  # Grayscale crop for CNN inference (§7)
    binary_crop: np.ndarray  # Binarized crop for feature extraction (§6)
    intra_word_gaps: List[float] = field(default_factory=list)  # Normalized to guideline unit
    raw_intra_word_gaps: List[int] = field(default_factory=list)  # Pixel widths


@dataclass
class LineSegment:
    """A single segmented writing line containing words and gap metrics."""

    line_index: int
    row_band: Tuple[int, int]  # (y_top, y_bottom)
    topline_y: int
    midline_y: int
    baseline_y: int
    words: List[WordSegment] = field(default_factory=list)
    word_gaps: List[float] = field(default_factory=list)  # Normalized to guideline unit
    raw_word_gaps: List[int] = field(default_factory=list)  # Pixel widths
    intra_word_gaps: List[float] = field(default_factory=list)  # All intra-word gaps on this line


@dataclass
class SegmentationResult:
    """Complete output of the segmentation stage."""

    lines: List[LineSegment]
    total_word_count: int


def validate_segmentation(detected_words: int, expected_words: int) -> None:
    """Validate detected word count against expected target word count (CV_PIPELINE §5.3).

    Raises
    ------
    PostSegmentationRejection
        If detected word count is zero or wildly off from expected word count.
    """
    if expected_words <= 0:
        return

    if detected_words == 0:
        raise PostSegmentationRejection(
            code="SEGMENTATION_COUNT_MISMATCH",
            message="No handwriting detected on worksheet.",
            detected_words=0,
            expected_words=expected_words,
        )

    min_allowed = math.ceil(expected_words * 0.5)
    max_allowed = math.ceil(expected_words * 2.5)

    if detected_words < min_allowed or detected_words > max_allowed:
        raise PostSegmentationRejection(
            code="SEGMENTATION_COUNT_MISMATCH",
            message=(
                f"Detected {detected_words} words, which differs significantly "
                f"from expected {expected_words} words."
            ),
            detected_words=detected_words,
            expected_words=expected_words,
        )


def _find_ink_runs(
    proj: np.ndarray, ink_threshold: int = 1, min_run_width: int = 2
) -> List[Tuple[int, int]]:
    """Find contiguous column spans where vertical ink projection exceeds threshold."""
    runs = []
    in_run = False
    run_start = 0

    for x, count in enumerate(proj):
        if count > ink_threshold:
            if not in_run:
                in_run = True
                run_start = x
        else:
            if in_run:
                in_run = False
                if (x - run_start) >= min_run_width:
                    runs.append((run_start, x))

    if in_run and (len(proj) - run_start) >= min_run_width:
        runs.append((run_start, len(proj)))

    return runs


def segment_lines_and_words(
    deskew: DeskewResult,
    expected_word_count: Optional[int] = None,
    word_gap_multiplier: float = 2.5,
) -> SegmentationResult:
    """Segment deskewed worksheet image into text lines and word crops.

    Parameters
    ----------
    deskew : DeskewResult
        Output of the guide-line detection and deskew stage.
    expected_word_count : int, optional
        Expected number of words from activity target text. If provided,
        triggers the Post-Segmentation Gate (§5.3).
    word_gap_multiplier : float, default=2.5
        Multiplier on median column-gap width to differentiate word boundaries
        from intra-word (letter) gaps (§5.2).

    Returns
    -------
    SegmentationResult
        Lines, words, bounding boxes, crops, and gap metrics.

    Raises
    ------
    PostSegmentationRejection
        If post-segmentation gate fails.
    """
    img_h, img_w = deskew.binary.shape
    n_rulings = len(deskew.baseline_y)

    line_segments: List[LineSegment] = []
    total_words = 0

    for i in range(n_rulings):
        top_y = deskew.topline_y[i]
        mid_y = deskew.midline_y[i]
        base_y = deskew.baseline_y[i]

        unit_height = max(1.0, float(base_y - mid_y))
        line_height = max(1, base_y - top_y)

        # §5.1: Row band calculation with ascender/descender margin
        ascender_pad = int(0.4 * line_height)
        descender_pad = int(0.4 * line_height)

        band_top = max(0, top_y - ascender_pad)
        band_bottom = min(img_h, base_y + descender_pad)

        # Bound by adjacent lines if present
        if i > 0:
            prev_base = deskew.baseline_y[i - 1]
            band_top = max(band_top, (prev_base + top_y) // 2)
        if i < n_rulings - 1:
            next_top = deskew.topline_y[i + 1]
            band_bottom = min(band_bottom, (base_y + next_top) // 2)

        if band_bottom <= band_top:
            continue

        band_binary = deskew.binary[band_top:band_bottom, :]

        # §5.2: Create a projection mask by ignoring the continuous horizontal guide line rows
        proj_mask = band_binary.copy()
        for gy in (top_y, mid_y, base_y):
            rel_y = gy - band_top
            if 0 <= rel_y < proj_mask.shape[0]:
                y_min_line = max(0, rel_y - 2)
                y_max_line = min(proj_mask.shape[0], rel_y + 3)
                proj_mask[y_min_line:y_max_line, :] = 0

        # Vertical ink projection across columns
        proj = np.sum(proj_mask > 0, axis=0)

        ink_runs = _find_ink_runs(proj, ink_threshold=1, min_run_width=2)

        if not ink_runs:
            line_segments.append(
                LineSegment(
                    line_index=i,
                    row_band=(band_top, band_bottom),
                    topline_y=top_y,
                    midline_y=mid_y,
                    baseline_y=base_y,
                    words=[],
                    word_gaps=[],
                    raw_word_gaps=[],
                    intra_word_gaps=[],
                )
            )
            continue

        # Extract gaps between consecutive ink runs
        gaps: List[Tuple[int, int, int]] = []  # (gap_start, gap_end, width)
        for idx in range(len(ink_runs) - 1):
            g_start = ink_runs[idx][1]
            g_end = ink_runs[idx + 1][0]
            g_width = g_end - g_start
            gaps.append((g_start, g_end, g_width))

        # Classify gaps into word boundaries vs intra-word gaps (§5.2)
        word_boundaries: List[int] = []
        if gaps:
            gap_widths = [g[2] for g in gaps]
            if len(gap_widths) == 1:
                # If there is only 1 gap, check against guideline reference height
                if gap_widths[0] >= max(35, int(0.5 * unit_height)):
                    word_boundaries.append(0)
            else:
                median_gap = float(np.median(gap_widths))
                split_threshold = max(word_gap_multiplier * median_gap, 25.0)

                for g_idx, g_width in enumerate(gap_widths):
                    if g_width >= split_threshold:
                        word_boundaries.append(g_idx)

        # Group ink runs into words
        words_in_line: List[WordSegment] = []
        line_word_gaps: List[float] = []
        line_raw_word_gaps: List[int] = []
        line_all_intra_gaps: List[float] = []

        current_word_runs = [ink_runs[0]]
        current_word_intra_gaps: List[int] = []

        def _create_word_segment(runs: List[Tuple[int, int]], intra_gaps: List[int]) -> WordSegment:
            word_x1 = runs[0][0]
            word_x2 = runs[-1][1]

            # Find tight ink bounding box using proj_mask ink
            word_ink = proj_mask[:, word_x1:word_x2]
            ys, xs = np.where(word_ink > 0)
            if len(xs) > 0:
                bbox_x = int(word_x1 + np.min(xs))
                bbox_y = int(band_top + np.min(ys))
                bbox_w = int(np.max(xs) - np.min(xs) + 1)
                bbox_h = int(np.max(ys) - np.min(ys) + 1)
            else:
                bbox_x = int(word_x1)
                bbox_y = int(band_top)
                bbox_w = int(word_x2 - word_x1)
                bbox_h = int(band_bottom - band_top)

            gray_crop = deskew.gray[bbox_y : bbox_y + bbox_h, bbox_x : bbox_x + bbox_w]
            binary_crop = deskew.binary[bbox_y : bbox_y + bbox_h, bbox_x : bbox_x + bbox_w]

            norm_intra = [round(g / unit_height, 3) for g in intra_gaps]
            return WordSegment(
                word_index=total_words + len(words_in_line),
                bbox=(bbox_x, bbox_y, bbox_w, bbox_h),
                gray_crop=gray_crop,
                binary_crop=binary_crop,
                intra_word_gaps=norm_intra,
                raw_intra_word_gaps=intra_gaps,
            )

        for g_idx, (g_start, g_end, g_width) in enumerate(gaps):
            if g_idx in word_boundaries:
                # Finish current word
                word_seg = _create_word_segment(current_word_runs, current_word_intra_gaps)
                line_all_intra_gaps.extend(word_seg.intra_word_gaps)
                words_in_line.append(word_seg)

                line_raw_word_gaps.append(g_width)
                line_word_gaps.append(round(g_width / unit_height, 3))

                # Start next word
                current_word_runs = [ink_runs[g_idx + 1]]
                current_word_intra_gaps = []
            else:
                current_word_runs.append(ink_runs[g_idx + 1])
                current_word_intra_gaps.append(g_width)

        # Add the final word in the line
        if current_word_runs:
            word_seg = _create_word_segment(current_word_runs, current_word_intra_gaps)
            line_all_intra_gaps.extend(word_seg.intra_word_gaps)
            words_in_line.append(word_seg)

        line_segments.append(
            LineSegment(
                line_index=i,
                row_band=(band_top, band_bottom),
                topline_y=top_y,
                midline_y=mid_y,
                baseline_y=base_y,
                words=words_in_line,
                word_gaps=line_word_gaps,
                raw_word_gaps=line_raw_word_gaps,
                intra_word_gaps=line_all_intra_gaps,
            )
        )
        total_words += len(words_in_line)

    # §5.3: Post-segmentation gate check
    if expected_word_count is not None:
        validate_segmentation(
            detected_words=total_words,
            expected_words=expected_word_count,
        )

    return SegmentationResult(
        lines=line_segments,
        total_word_count=total_words,
    )
