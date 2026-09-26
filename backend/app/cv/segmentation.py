"""CV Pipeline §5: Segmentation — Line segmentation, Word segmentation, and Post-Segmentation Gate.

- §5.1 Line Segmentation: Row bands derived from deskewed guide lines (topline to baseline).
- §5.2 Word Segmentation: Column-gap projection profile per line with dynamic
  median-gap thresholding.
- §5.3 Post-Segmentation Gate: Compares detected word count against activity expected word count.
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import cv2
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


def validate_cursive_script(
    lines: List[LineSegment],
    detected_words: int,
    expected_words: Optional[int] = None,
    min_connectivity_threshold: float = 0.40,
) -> None:
    """Validate that handwriting exhibits continuous cursive stroke connectivity (CV_PIPELINE §5.4).

    In cursive penmanship, characters within a word are joined by continuous
    ligatures across the core ruling zone, producing connected ink components
    that span the majority of the word width. In printed (manuscript) handwriting,
    each letter is an isolated glyph, resulting in disconnected components.

    Parameters
    ----------
    lines : List[LineSegment]
        Segmented writing lines containing words and their crops.
    detected_words : int
        Total words detected across all lines.
    expected_words : Optional[int]
        Target expected words from activity prompt text if available.
    min_connectivity_threshold : float, default=0.40
        Minimum ratio of maximum connected component width to word bounding box width.

    Raises
    ------
    PostSegmentationRejection
        If handwriting appears to be printed rather than cursive
        (code "QUALITY_GATE_SCRIPT_NOT_CURSIVE").
    """
    word_ratios: List[float] = []

    for line in lines:
        unit_h = max(1.0, float(line.baseline_y - line.midline_y))
        line_mask_half = max(3, int(0.08 * unit_h))
        # Words must be wide enough to contain multiple characters (>= 1.1x guideline height)
        min_word_w = int(1.1 * unit_h)

        for w in line.words:
            if w.bbox[2] < min_word_w:
                continue

            crop = w.binary_crop.copy()
            ink = (crop > 0).astype(np.uint8)

            # Suppress ruling lines to prevent them from acting as false ligatures
            for gy in (line.topline_y, line.midline_y, line.baseline_y):
                rel_y = gy - w.bbox[1]
                y1 = max(0, rel_y - line_mask_half)
                y2 = min(crop.shape[0], rel_y + line_mask_half + 1)
                if y1 < crop.shape[0] and y2 > 0:
                    ink[y1:y2, :] = 0

            n_cc, _, stats, _ = cv2.connectedComponentsWithStats(ink)
            if n_cc <= 1:
                continue

            min_area = max(15, int(0.02 * (unit_h**2)))
            valid_stats = [s for s in stats[1:] if s[cv2.CC_STAT_AREA] >= min_area]
            if not valid_stats:
                continue

            max_cc_w = max(s[cv2.CC_STAT_WIDTH] for s in valid_stats)
            ratio = max_cc_w / max(1, w.bbox[2])
            word_ratios.append(ratio)

    if len(word_ratios) >= 1:
        mean_ratio = float(np.mean(word_ratios))
        failing_count = sum(1 for r in word_ratios if r < min_connectivity_threshold)
        failing_fraction = failing_count / len(word_ratios)

        if (len(word_ratios) == 1 and mean_ratio < 0.35) or (
            len(word_ratios) >= 2
            and (mean_ratio < min_connectivity_threshold or failing_fraction >= 0.70)
        ):
            exp_words = expected_words if expected_words is not None else detected_words
            raise PostSegmentationRejection(
                code="QUALITY_GATE_SCRIPT_NOT_CURSIVE",
                message=(
                    "Handwriting appears to be printed rather than cursive. "
                    "WriteWise assesses cursive penmanship. "
                    "Please complete the activity in continuous cursive handwriting."
                ),
                detected_words=detected_words,
                expected_words=exp_words,
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
    validate_script: bool = True,
    validate_guidelines: bool = True,
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
    validate_script : bool, default=True
        Whether to enforce cursive connectivity validation (§5.4).
    validate_guidelines : bool, default=True
        Whether to enforce guideline presence and off-guidelines validation (§5.0, §5.2b).

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

    # §5.0 Guideline Presence Gate:
    # If no 3-line penmanship rulings were detected on the page, check whether handwriting exists.
    # If cursive handwriting was submitted on unruled or plain paper,
    # reject with QUALITY_GATE_NO_GUIDELINES.
    if validate_guidelines and n_rulings == 0:
        inner_binary = deskew.binary[
            int(0.02 * img_h) : int(0.98 * img_h),
            int(0.02 * img_w) : int(0.98 * img_w),
        ]
        ink_cleaned = cv2.morphologyEx(
            inner_binary,
            cv2.MORPH_OPEN,
            cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)),
        )
        total_ink_pixels = int(np.sum(ink_cleaned > 0))
        if total_ink_pixels >= 250:
            raise PostSegmentationRejection(
                code="QUALITY_GATE_NO_GUIDELINES",
                message=(
                    "No 3-line penmanship guidelines detected on the worksheet. "
                    "WriteWise requires standard 3-line ruled paper (topline, midline, baseline) "
                    "to evaluate letter sizing and alignment."
                ),
                detected_words=0,
                expected_words=expected_word_count or 0,
            )

    line_segments: List[LineSegment] = []
    total_words = 0

    for i in range(n_rulings):
        top_y = deskew.topline_y[i]
        mid_y = deskew.midline_y[i]
        base_y = deskew.baseline_y[i]

        unit_height = max(1.0, float(base_y - mid_y))
        line_height = max(1, base_y - top_y)

        # §5.1: Row band calculation with ascender/descender margin
        ascender_pad = int(0.40 * line_height)
        descender_pad = int(0.45 * line_height)

        band_top = max(0, top_y - ascender_pad)
        band_bottom = min(img_h, base_y + descender_pad)

        # Bound by adjacent lines if present
        if i > 0:
            prev_base = deskew.baseline_y[i - 1]
            band_top = max(band_top, (prev_base + top_y) // 2)
        if i < n_rulings - 1:
            next_mid = deskew.midline_y[i + 1]
            next_top = deskew.topline_y[i + 1]
            if next_top > base_y:
                band_bottom = min(band_bottom, (base_y + next_top) // 2)
            else:
                # Continuous paper: descenders reach into next row's upper zone up to next_mid
                band_bottom = min(band_bottom, next_mid)

        if band_bottom <= band_top:
            continue

        band_binary = deskew.binary[band_top:band_bottom, :].copy()
        band_height = band_bottom - band_top

        # §5.2: Create a projection mask by ignoring the continuous horizontal guide line rows
        proj_mask = band_binary.copy()

        # Suppress extreme border extremities (shadows/page edges touching image margins)
        proj_mask[:, : int(0.01 * img_w)] = 0
        proj_mask[:, int(0.99 * img_w) :] = 0
        line_mask_half = max(3, int(0.08 * unit_height))
        for gy in (top_y, mid_y, base_y):
            rel_y = gy - band_top
            y_min_line = max(0, rel_y - line_mask_half)
            y_max_line = min(proj_mask.shape[0], rel_y + line_mask_half + 1)
            if y_min_line < proj_mask.shape[0] and y_max_line > 0:
                proj_mask[y_min_line:y_max_line, :] = 0

        # Suppress wide horizontal ruling remnants that survive row slicing
        h_len = max(35, int(unit_height * 0.45))
        h_lines = cv2.morphologyEx(
            proj_mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (h_len, 1))
        )
        if np.any(h_lines):
            dilate_v = max(3, int(unit_height * 0.05))
            if dilate_v % 2 == 0:
                dilate_v += 1
            h_lines_dil = cv2.dilate(
                h_lines, cv2.getStructuringElement(cv2.MORPH_RECT, (1, dilate_v))
            )
            proj_mask[h_lines_dil > 0] = 0

        # Clean small speckle noise (paper grain / shadow dust)
        k_speck = max(1, int(0.02 * unit_height))
        if k_speck >= 2:
            proj_mask = cv2.morphologyEx(
                proj_mask,
                cv2.MORPH_OPEN,
                cv2.getStructuringElement(cv2.MORPH_RECT, (k_speck, k_speck)),
            )

        # Minimum line ink: Skip empty ruling rows early
        min_line_ink = max(40, int(0.12 * (unit_height**2)))
        if np.sum(proj_mask > 0) < min_line_ink:
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

        # Vertical ink projection across columns
        proj = np.sum(proj_mask > 0, axis=0)

        ink_threshold = max(2, int(0.04 * band_height))
        min_run_width = max(2, int(0.04 * unit_height))
        ink_runs = _find_ink_runs(proj, ink_threshold=ink_threshold, min_run_width=min_run_width)

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
        min_word_gap = max(25.0, 0.35 * unit_height)
        if gaps:
            gap_widths = [g[2] for g in gaps]
            if len(gap_widths) == 1:
                # If there is only 1 gap, check against guideline reference height
                if gap_widths[0] >= min_word_gap:
                    word_boundaries.append(0)
            else:
                median_gap = float(np.median(gap_widths))
                split_threshold = max(word_gap_multiplier * median_gap, min_word_gap)

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

        def _create_word_segment(
            runs: List[Tuple[int, int]], intra_gaps: List[int]
        ) -> Optional[WordSegment]:
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
                ink_pixel_count = len(xs)
            else:
                bbox_x = int(word_x1)
                bbox_y = int(band_top)
                bbox_w = int(word_x2 - word_x1)
                bbox_h = int(band_bottom - band_top)
                ink_pixel_count = 0

            # 1. Filter out full-width line artifacts (uncut ruling remnants or borders)
            if bbox_w > int(img_w * 0.85) or (bbox_w / max(1, bbox_h) > 12.0):
                return None

            # 2. Filter out vertical margin lines (skinny and tall spanning line band)
            if (bbox_h / max(1, bbox_w) > 2.5) and (bbox_h > int(0.50 * band_height)):
                return None

            # 3. Filter out low-density noise clouds across blank lines
            density = ink_pixel_count / max(1, bbox_w * bbox_h)
            if bbox_w > int(0.7 * unit_height) and density < 0.05:
                return None

            # 4. Filter out tiny dust / noise specks
            min_w = max(10, int(0.12 * unit_height))
            min_h = max(8, int(0.10 * unit_height))
            min_area = max(20, int(0.06 * (unit_height**2)))
            if bbox_w < min_w or bbox_h < min_h or ink_pixel_count < min_area:
                return None

            # 5. Filter out outer image border noise (shadows/table edges touching extremities)
            if bbox_y < int(0.015 * img_h) or (bbox_y + bbox_h) > int(0.985 * img_h):
                return None
            if bbox_x < int(0.01 * img_w) or (bbox_x + bbox_w) > int(0.99 * img_w):
                return None

            # 6. Candidate must intersect the ruling line's core zone.
            # Every valid cursive word has letter bodies resting in the core zone.
            # Stray ascenders or descender tails lack body ink in this line's core zone.
            core_y1 = max(0, mid_y - band_top - int(0.05 * unit_height))
            core_y2 = min(proj_mask.shape[0], base_y - band_top + int(0.05 * unit_height))
            if core_y2 > core_y1:
                core_ink = np.sum(word_ink[core_y1:core_y2, :] > 0)
                if core_ink < max(12, int(0.03 * (unit_height**2))):
                    return None

            # Safe boundary clamping
            bbox_x = max(0, min(img_w - 1, bbox_x))
            bbox_y = max(0, min(img_h - 1, bbox_y))
            bbox_w = max(1, min(img_w - bbox_x, bbox_w))
            bbox_h = max(1, min(img_h - bbox_y, bbox_h))

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
                if word_seg is not None:
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
            if word_seg is not None:
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

    # §5.2b Off-guidelines placement check:
    # If guidelines exist but insufficient words were found inside them, check whether handwriting
    # ink was placed outside the ruling bands (e.g. in margins, headers, or blank white space).
    if validate_guidelines and n_rulings > 0:
        min_expected = (
            math.ceil(expected_word_count * 0.5)
            if (expected_word_count and expected_word_count > 0)
            else 1
        )
        if total_words < min_expected:
            bands_mask = np.zeros((img_h, img_w), dtype=np.uint8)
            for seg in line_segments:
                b_top, b_bottom = seg.row_band
                bands_mask[b_top:b_bottom, :] = 255

            inner_mask = np.zeros((img_h, img_w), dtype=np.uint8)
            inner_mask[
                int(0.02 * img_h) : int(0.98 * img_h),
                int(0.02 * img_w) : int(0.98 * img_w),
            ] = 255

            cleaned_binary = cv2.morphologyEx(
                deskew.binary,
                cv2.MORPH_OPEN,
                cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)),
            )

            # Suppress ruling line horizontal remnants so printed lines don't inflate outside ink
            h_len = max(35, int(img_w * 0.05))
            h_rulings = cv2.morphologyEx(
                cleaned_binary,
                cv2.MORPH_OPEN,
                cv2.getStructuringElement(cv2.MORPH_RECT, (h_len, 1)),
            )
            stroke_only = cleaned_binary.copy()
            if np.any(h_rulings):
                stroke_only[h_rulings > 0] = 0

            outside_ink = int(np.sum((stroke_only > 0) & (inner_mask > 0) & (bands_mask == 0)))
            inside_ink = int(np.sum((stroke_only > 0) & (inner_mask > 0) & (bands_mask > 0)))
            total_stroke_ink = outside_ink + inside_ink

            if (
                outside_ink >= 400
                and total_stroke_ink > 0
                and (outside_ink / total_stroke_ink >= 0.65)
            ):
                raise PostSegmentationRejection(
                    code="QUALITY_GATE_OFF_GUIDELINES",
                    message=(
                        "Handwriting was detected outside the 3-line guidelines. "
                        "Please write inside the ruled penmanship lines."
                    ),
                    detected_words=total_words,
                    expected_words=expected_word_count or 0,
                )

    # §5.3: Post-segmentation gate check
    if expected_word_count is not None:
        validate_segmentation(
            detected_words=total_words,
            expected_words=expected_word_count,
        )

    # §5.4: Post-segmentation script check (print vs. cursive)
    if validate_script and total_words > 0:
        validate_cursive_script(
            lines=line_segments,
            detected_words=total_words,
            expected_words=expected_word_count,
        )

    return SegmentationResult(
        lines=line_segments,
        total_word_count=total_words,
    )
