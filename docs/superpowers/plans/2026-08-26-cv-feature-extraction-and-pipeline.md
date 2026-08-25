# CV Feature Extraction & Pipeline Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement OpenCV-based geometric feature extraction (slant angle, spacing regularity, baseline alignment, size consistency), output schema data models conforming to `CV_PIPELINE.md` §8, and the top-level end-to-end CV pipeline orchestrator (`run_cv_pipeline`).

**Architecture:** Following `CV_PIPELINE.md` §9, feature extraction stages are built as pure, isolated functions under `backend/app/cv/features/`. The output schema is defined via strongly-typed dataclasses in `backend/app/cv/models.py` that serialize directly to the required JSON structure. The top-level orchestrator in `backend/app/cv/pipeline.py` chains Stages 1–5 synchronously, returning both the structured `MeasurementData` and deskewed grayscale word crops for CNN handoff (`CV_PIPELINE.md` §7).

**Tech Stack:** Python 3.13, opencv-python-headless, numpy, pytest, uv, ruff

**Spec:** `docs/superpowers/specs/2026-08-26-cv-feature-extraction-and-pipeline-design.md`

---

## Global Constraints

- Pure functional design for CV modules — no shared mutable pipeline state, no unnecessary class wrappers (`CV_PIPELINE.md` §9).
- Error handling: Stages raise domain exceptions (`QualityGateRejection`, `PostSegmentationRejection`) — never `HTTPException` inside CV modules.
- Normalization reference: Spacing, baseline deviation, and size consistency are normalized against guideline unit height (`baseline_y - midline_y`), scale-invariant (`CV_PIPELINE.md` §6.5).
- Output JSON format strictly follows `CV_PIPELINE.md` §8 (`guide_lines`, `lines`, `aggregate`).
- Fallback for slant angle when no vertical strokes are detected: `0.0°` (neutral vertical).
- Fallback for empty/single-gap spacing aggregates: `mean = 0.0`, `std = 0.0`.
- Synthetic, programmatically generated test images only — zero binary image blobs committed to git (`TESTING.md` §4.1).
- Linting & testing gates: `uv run ruff check .` and `uv run pytest tests/cv/ -v`.

---

### Task 1: Slant Angle Feature Module (`app/cv/features/slant.py`)

**Files:**
- Create: `backend/app/cv/features/__init__.py`
- Create: `backend/app/cv/features/slant.py`
- Create: `backend/tests/cv/test_slant.py`

**Interfaces:**
- Produces: `compute_word_slant(binary_crop: np.ndarray, reference_perpendicular_deg: float = 90.0) -> float` in `app/cv/features/slant.py`

- [ ] **Step 1: Write the failing tests for slant angle calculation**

Create `backend/tests/cv/test_slant.py`:
```python
import cv2
import numpy as np
import pytest

from app.cv.features.slant import compute_word_slant


def _make_stroke_crop(angle_deg: float, width: int = 100, height: int = 80) -> np.ndarray:
    """Create a binary image crop (255 background, 0 ink) containing a line at specified slant angle relative to vertical."""
    crop = np.full((height, width), 255, dtype=np.uint8)
    
    # 0 deg slant = 90 deg line (vertical). +15 deg slant = 75 deg in image coords or leaned right.
    # We draw line through center (cx, cy)
    cx, cy = width // 2, height // 2
    length = 50
    # Angle relative to vertical: vertical is 90 deg. angle_deg adds lean.
    rad = np.radians(90.0 - angle_deg)
    dx = int(length / 2 * np.cos(rad))
    dy = int(length / 2 * np.sin(rad))
    
    cv2.line(crop, (cx - dx, cy + dy), (cx + dx, cy - dy), 0, 3)
    return crop


def test_slant_vertical_stroke():
    # True vertical stroke (0 deg slant)
    crop = _make_stroke_crop(0.0)
    slant = compute_word_slant(crop, reference_perpendicular_deg=90.0)
    assert abs(slant - 0.0) <= 2.0


def test_slant_right_leaning_stroke():
    # +15 deg rightward lean
    crop = _make_stroke_crop(15.0)
    slant = compute_word_slant(crop, reference_perpendicular_deg=90.0)
    assert abs(slant - 15.0) <= 3.0


def test_slant_left_leaning_stroke():
    # -15 deg leftward lean
    crop = _make_stroke_crop(-15.0)
    slant = compute_word_slant(crop, reference_perpendicular_deg=90.0)
    assert abs(slant - (-15.0)) <= 3.0


def test_slant_fallback_on_blank_or_horizontal_strokes():
    # Blank crop (no strokes)
    blank = np.full((80, 100), 255, dtype=np.uint8)
    assert compute_word_slant(blank) == 0.0

    # Strictly horizontal stroke (filtered out)
    horizontal = np.full((80, 100), 255, dtype=np.uint8)
    cv2.line(horizontal, (10, 40), (90, 40), 0, 3)
    assert compute_word_slant(horizontal) == 0.0
```

- [ ] **Step 2: Run test to verify failure**

Run: `uv run pytest tests/cv/test_slant.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.cv.features'`

- [ ] **Step 3: Implement minimal code for `slant.py`**

Create `backend/app/cv/features/__init__.py`:
```python
"""CV Pipeline §6: Feature Extraction."""
```

Create `backend/app/cv/features/slant.py`:
```python
"""CV Pipeline §6.1: Slant Angle Feature Extraction.

Measures the angle of near-vertical pen strokes relative to guide-line perpendicular.
"""

from typing import Optional
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
        # Ink is 255, paper is 0
        ink_img = (binary_crop == 0).astype(np.uint8) * 255
    else:
        # Standard Otsu (paper 255, ink 0)
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

    valid_slants = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        dx = float(x2 - x1)
        dy = float(y2 - y1)

        if dx == 0 and dy == 0:
            continue

        # In image coordinates, y increases downward.
        # Orientation angle in degrees [0, 180): 0 is horizontal right, 90 is vertical down.
        angle = np.degrees(np.arctan2(abs(dy), dx))

        # Filter to near-vertical strokes (within +-45 deg of vertical: 45 to 135 deg)
        if 45.0 <= angle <= 135.0:
            # Lean relative to 90 deg vertical:
            # dy > 0 and dx > 0 means top-left to bottom-right (right lean / forward slant)
            # In image coords, if line goes from (x1, y1) to (x2, y2) with y2 > y1:
            # dx > 0 -> top leans right relative to bottom -> positive slant
            if y2 != y1:
                # normalize so y1 is top (smaller y) and y2 is bottom (larger y)
                if y1 > y2:
                    x1, x2 = x2, x1
                    y1, y2 = y2, y1
                # angle from vertical: arctan2(dx, dy)
                stroke_dx = float(x2 - x1)
                stroke_dy = float(y2 - y1)
                slant_deg = np.degrees(np.arctan2(stroke_dx, stroke_dy))
                if abs(slant_deg) <= 45.0:
                    valid_slants.append(slant_deg)

    if not valid_slants:
        return 0.0

    return round(float(np.mean(valid_slants)), 1)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/cv/test_slant.py -v`
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```bash
git add backend/app/cv/features/ backend/tests/cv/test_slant.py
git commit -m "feat(cv): implement slant angle feature extraction (CV_PIPELINE §6.1)"
```

---

### Task 2: Spacing Metrics Feature Module (`app/cv/features/spacing.py`)

**Files:**
- Create: `backend/app/cv/features/spacing.py`
- Create: `backend/tests/cv/test_spacing.py`

**Interfaces:**
- Produces: `compute_spacing_metrics(lines: List[LineSegment]) -> Tuple[MetricSummary, MetricSummary]` in `app/cv/features/spacing.py`

- [ ] **Step 1: Write the failing tests for spacing metrics**

Create `backend/tests/cv/test_spacing.py`:
```python
import pytest

from app.cv.features.spacing import compute_spacing_metrics
from app.cv.models import MetricSummary
from app.cv.segmentation import LineSegment


def test_spacing_metrics_normal_distribution():
    # Line 1: word_gaps=[1.8, 2.2], intra_word_gaps=[0.3, 0.4]
    # Line 2: word_gaps=[2.0], intra_word_gaps=[0.35, 0.45]
    line1 = LineSegment(
        line_index=0,
        row_band=(0, 100),
        topline_y=20,
        midline_y=50,
        baseline_y=80,
        words=[],
        word_gaps=[1.8, 2.2],
        raw_word_gaps=[18, 22],
        intra_word_gaps=[0.3, 0.4],
    )
    line2 = LineSegment(
        line_index=1,
        row_band=(100, 200),
        topline_y=120,
        midline_y=150,
        baseline_y=180,
        words=[],
        word_gaps=[2.0],
        raw_word_gaps=[20],
        intra_word_gaps=[0.35, 0.45],
    )

    word_spacing, letter_spacing = compute_spacing_metrics([line1, line2])

    # Word gaps: [1.8, 2.2, 2.0] -> mean=2.0, std=0.16 (sample std)
    assert word_spacing.mean == 2.0
    assert abs(word_spacing.std - 0.16) <= 0.05

    # Letter gaps: [0.3, 0.4, 0.35, 0.45] -> mean=0.38, std=0.06
    assert letter_spacing.mean == 0.38
    assert abs(letter_spacing.std - 0.06) <= 0.02


def test_spacing_metrics_empty_or_single():
    # Empty lines
    w_empty, l_empty = compute_spacing_metrics([])
    assert w_empty.mean == 0.0 and w_empty.std == 0.0
    assert l_empty.mean == 0.0 and l_empty.std == 0.0

    # Single gap
    line_single = LineSegment(
        line_index=0,
        row_band=(0, 100),
        topline_y=20,
        midline_y=50,
        baseline_y=80,
        words=[],
        word_gaps=[1.5],
        raw_word_gaps=[15],
        intra_word_gaps=[0.3],
    )
    w_single, l_single = compute_spacing_metrics([line_single])
    assert w_single.mean == 1.5 and w_single.std == 0.0
    assert l_single.mean == 0.3 and l_single.std == 0.0
```

- [ ] **Step 2: Run test to verify failure**

Run: `uv run pytest tests/cv/test_spacing.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.cv.features.spacing'`

- [ ] **Step 3: Implement minimal code for `spacing.py`**

Create `backend/app/cv/features/spacing.py`:
```python
"""CV Pipeline §6.2: Spacing Regularity Feature Extraction.

Aggregates word-to-word spacing and intra-word (letter) spacing regularity across lines.
"""

from typing import List, Tuple
import numpy as np

from app.cv.models import MetricSummary
from app.cv.segmentation import LineSegment


def _calc_stats(values: List[float]) -> MetricSummary:
    """Calculate mean and sample standard deviation for a list of values."""
    if not values:
        return MetricSummary(mean=0.0, std=0.0)
    if len(values) == 1:
        return MetricSummary(mean=round(float(values[0]), 2), std=0.0)

    mean_val = float(np.mean(values))
    std_val = float(np.std(values, ddof=1))
    return MetricSummary(mean=round(mean_val, 2), std=round(std_val, 2))


def compute_spacing_metrics(
    lines: List[LineSegment],
) -> Tuple[MetricSummary, MetricSummary]:
    """Compute aggregate word spacing and letter spacing statistics.

    Parameters
    ----------
    lines : List[LineSegment]
        Segmented writing lines containing normalized gap measurements.

    Returns
    -------
    Tuple[MetricSummary, MetricSummary]
        (word_spacing_summary, letter_spacing_summary)
    """
    all_word_gaps: List[float] = []
    all_letter_gaps: List[float] = []

    for line in lines:
        all_word_gaps.extend(line.word_gaps)
        all_letter_gaps.extend(line.intra_word_gaps)

    word_spacing = _calc_stats(all_word_gaps)
    letter_spacing = _calc_stats(all_letter_gaps)

    return word_spacing, letter_spacing
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/cv/test_spacing.py -v`
Expected: PASS

- [ ] **Step 5: Commit Task 2**

```bash
git add backend/app/cv/features/spacing.py backend/tests/cv/test_spacing.py
git commit -m "feat(cv): implement spacing metrics calculation (CV_PIPELINE §6.2)"
```

---

### Task 3: Baseline Alignment Feature Module (`app/cv/features/baseline.py`)

**Files:**
- Create: `backend/app/cv/features/baseline.py`
- Create: `backend/tests/cv/test_baseline.py`

**Interfaces:**
- Produces: `compute_baseline_deviation(word_bbox: Tuple[int, int, int, int], baseline_y: int, unit_height: float, binary_crop: Optional[np.ndarray] = None) -> float`

- [ ] **Step 1: Write the failing tests for baseline deviation**

Create `backend/tests/cv/test_baseline.py`:
```python
import numpy as np
import pytest

from app.cv.features.baseline import compute_baseline_deviation


def test_baseline_deviation_perfect_alignment():
    # Baseline at y=500, unit_height=50. Word bbox: (100, 450, 80, 50) -> bottom y = 500
    bbox = (100, 450, 80, 50)
    deviation = compute_baseline_deviation(word_bbox=bbox, baseline_y=500, unit_height=50.0)
    assert deviation == 0.0


def test_baseline_deviation_floating_above():
    # Baseline at y=500, unit_height=50. Word bottom at y=490 -> diff = 10 -> ratio = 10/50 = 0.20
    bbox = (100, 440, 80, 50)  # y_bottom = 490
    deviation = compute_baseline_deviation(word_bbox=bbox, baseline_y=500, unit_height=50.0)
    assert deviation == 0.20


def test_baseline_deviation_dipping_below():
    # Baseline at y=500, unit_height=50. Word bottom at y=510 -> diff = 10 -> ratio = 10/50 = 0.20
    bbox = (100, 460, 80, 50)  # y_bottom = 510
    deviation = compute_baseline_deviation(word_bbox=bbox, baseline_y=500, unit_height=50.0)
    assert deviation == 0.20


def test_baseline_deviation_with_binary_crop():
    # Crop height 60, but ink only extends down to row 50 (relative to bbox_y=440) -> bottom ink y = 490
    crop = np.full((60, 80), 255, dtype=np.uint8)
    crop[10:51, 10:70] = 0  # ink down to index 50
    bbox = (100, 440, 80, 60)
    deviation = compute_baseline_deviation(
        word_bbox=bbox, baseline_y=500, unit_height=50.0, binary_crop=crop
    )
    # y_bottom = 440 + 50 = 490. diff = |490 - 500| = 10. ratio = 10/50 = 0.20
    assert deviation == 0.20
```

- [ ] **Step 2: Run test to verify failure**

Run: `uv run pytest tests/cv/test_baseline.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.cv.features.baseline'`

- [ ] **Step 3: Implement minimal code for `baseline.py`**

Create `backend/app/cv/features/baseline.py`:
```python
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
    bbox_x, bbox_y, bbox_w, bbox_h = word_bbox
    norm_unit = max(1.0, float(unit_height))

    if binary_crop is not None and binary_crop.size > 0:
        ink_ys, _ = np.where(binary_crop == 0)
        if len(ink_ys) == 0:
            # Try inverted binary (> 0 is ink)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/cv/test_baseline.py -v`
Expected: PASS

- [ ] **Step 5: Commit Task 3**

```bash
git add backend/app/cv/features/baseline.py backend/tests/cv/test_baseline.py
git commit -m "feat(cv): implement baseline alignment feature extraction (CV_PIPELINE §6.3)"
```

---

### Task 4: Size Consistency Feature Module (`app/cv/features/size.py`)

**Files:**
- Create: `backend/app/cv/features/size.py`
- Create: `backend/tests/cv/test_size.py`

**Interfaces:**
- Produces: `compute_size_ratio(binary_crop: np.ndarray, word_bbox: Tuple[int, int, int, int], midline_y: int, baseline_y: int, unit_height: float) -> float`

- [ ] **Step 1: Write the failing tests for size consistency**

Create `backend/tests/cv/test_size.py`:
```python
import numpy as np
import pytest

from app.cv.features.size import compute_size_ratio


def test_size_ratio_perfect_core_height():
    # Guideline unit height = 40 (midline=460, baseline=500). Word bbox: y=460, h=40.
    # Ink occupies the full midline to baseline span (height 40).
    crop = np.full((40, 60), 255, dtype=np.uint8)
    crop[0:40, 10:50] = 0  # ink occupies full 40px
    bbox = (100, 460, 60, 40)

    ratio = compute_size_ratio(
        binary_crop=crop,
        word_bbox=bbox,
        midline_y=460,
        baseline_y=500,
        unit_height=40.0,
    )
    assert ratio == 1.0


def test_size_ratio_with_tall_ascender():
    # Guideline: midline=460, baseline=500 (unit=40).
    # Word bbox starts at y=420 (topline) with height 80 (y spans 420 to 500).
    # Ascender is in y 420-460; core is in y 460-500.
    crop = np.full((80, 60), 255, dtype=np.uint8)
    # Draw ascender (row 0 to 40 in crop) and core (row 40 to 80 in crop)
    crop[0:80, 20:25] = 0  # vertical stroke across full height
    crop[40:80, 20:50] = 0  # core body
    bbox = (100, 420, 60, 80)

    ratio = compute_size_ratio(
        binary_crop=crop,
        word_bbox=bbox,
        midline_y=460,
        baseline_y=500,
        unit_height=40.0,
    )
    # The core height between midline and baseline should be ~40px -> ratio ~ 1.0, not 2.0
    assert abs(ratio - 1.0) <= 0.15


def test_size_ratio_small_writing():
    # Core ink is only 20px tall in a 40px unit zone -> ratio = 0.50
    crop = np.full((40, 60), 255, dtype=np.uint8)
    crop[20:40, 10:50] = 0  # ink only in lower 20px
    bbox = (100, 460, 60, 40)

    ratio = compute_size_ratio(
        binary_crop=crop,
        word_bbox=bbox,
        midline_y=460,
        baseline_y=500,
        unit_height=40.0,
    )
    assert ratio == 0.50
```

- [ ] **Step 2: Run test to verify failure**

Run: `uv run pytest tests/cv/test_size.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.cv.features.size'`

- [ ] **Step 3: Implement minimal code for `size.py`**

Create `backend/app/cv/features/size.py`:
```python
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
    bbox_x, bbox_y, bbox_w, bbox_h = word_bbox
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/cv/test_size.py -v`
Expected: PASS

- [ ] **Step 5: Commit Task 4**

```bash
git add backend/app/cv/features/size.py backend/tests/cv/test_size.py
git commit -m "feat(cv): implement size consistency feature extraction (CV_PIPELINE §6.4)"
```

---

### Task 5: Output Schema Models & Feature Extractor Orchestrator (`app/cv/models.py`, `app/cv/features/__init__.py`)

**Files:**
- Create: `backend/app/cv/models.py`
- Modify: `backend/app/cv/features/__init__.py`
- Create: `backend/tests/cv/test_models.py`

**Interfaces:**
- Produces: `MeasurementData`, `AggregateMetrics`, `MetricSummary`, `WordMeasurement`, `LineMeasurement`, `GuideLinesData` in `app/cv/models.py`
- Produces: `extract_features(segmentation: SegmentationResult, deskew: DeskewResult) -> MeasurementData` in `app/cv/features/__init__.py`

- [ ] **Step 1: Write the failing tests for schema models and feature extraction assembly**

Create `backend/tests/cv/test_models.py`:
```python
import numpy as np
import pytest

from app.cv.features import extract_features
from app.cv.guide_lines import DeskewResult
from app.cv.models import (
    AggregateMetrics,
    GuideLinesData,
    LineMeasurement,
    MeasurementData,
    MetricSummary,
    WordMeasurement,
)
from app.cv.segmentation import LineSegment, SegmentationResult, WordSegment


def test_measurement_data_to_dict_matches_spec_structure():
    # Schema validation against CV_PIPELINE.md §8
    data = MeasurementData(
        guide_lines=GuideLinesData(
            baseline_y=[412, 498],
            midline_y=[438, 524],
            topline_y=[386, 472],
        ),
        lines=[
            LineMeasurement(
                line_index=0,
                words=[
                    WordMeasurement(
                        word_index=0,
                        bbox=[120, 390, 85, 48],
                        slant_deg=7.2,
                        baseline_deviation_ratio=0.04,
                        size_ratio=0.91,
                    )
                ],
                word_gaps=[1.8],
                intra_word_gaps=[0.3, 0.4],
            )
        ],
        aggregate=AggregateMetrics(
            slant=MetricSummary(mean=7.2, std=0.0),
            word_spacing=MetricSummary(mean=1.8, std=0.0),
            letter_spacing=MetricSummary(mean=0.35, std=0.05),
            baseline_deviation=MetricSummary(mean=0.04, std=0.0),
            size_consistency=MetricSummary(mean=0.91, std=0.0),
        ),
    )

    d = data.to_dict()
    assert "guide_lines" in d
    assert "lines" in d
    assert "aggregate" in d
    assert d["guide_lines"]["baseline_y"] == [412, 498]
    assert d["lines"][0]["words"][0]["slant_deg"] == 7.2
    assert d["aggregate"]["slant"]["mean"] == 7.2


def test_extract_features_end_to_end():
    # Setup dummy deskew and segmentation
    gray = np.full((600, 800), 200, dtype=np.uint8)
    binary = np.full((600, 800), 255, dtype=np.uint8)
    crop = np.full((40, 60), 255, dtype=np.uint8)
    crop[10:35, 10:50] = 0

    deskew = DeskewResult(
        gray=gray,
        binary=binary,
        rotation_angle_deg=0.0,
        baseline_y=[300],
        midline_y=[260],
        topline_y=[220],
    )

    word = WordSegment(
        word_index=0,
        bbox=(100, 260, 60, 40),
        gray_crop=crop,
        binary_crop=crop,
        intra_word_gaps=[0.3],
        raw_intra_word_gaps=[12],
    )
    line = LineSegment(
        line_index=0,
        row_band=(200, 350),
        topline_y=220,
        midline_y=260,
        baseline_y=300,
        words=[word],
        word_gaps=[],
        raw_word_gaps=[],
        intra_word_gaps=[0.3],
    )
    seg = SegmentationResult(lines=[line], total_word_count=1)

    meas = extract_features(seg, deskew)
    assert len(meas.lines) == 1
    assert len(meas.lines[0].words) == 1
    assert meas.aggregate.size_consistency.mean > 0.0
    assert meas.guide_lines.baseline_y == [300]
```

- [ ] **Step 2: Run test to verify failure**

Run: `uv run pytest tests/cv/test_models.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.cv.models'`

- [ ] **Step 3: Implement `models.py` and `features/__init__.py`**

Create `backend/app/cv/models.py`:
```python
"""CV Pipeline §8: Output Schema Data Models."""

from dataclasses import asdict, dataclass
from typing import Any, Dict, List


@dataclass
class MetricSummary:
    """Statistical summary (mean and standard deviation)."""

    mean: float
    std: float


@dataclass
class AggregateMetrics:
    """Aggregate handwriting quality measurements across the entire worksheet."""

    slant: MetricSummary
    word_spacing: MetricSummary
    letter_spacing: MetricSummary
    baseline_deviation: MetricSummary
    size_consistency: MetricSummary


@dataclass
class WordMeasurement:
    """Per-word geometric measurements."""

    word_index: int
    bbox: List[int]  # [x, y, w, h]
    slant_deg: float
    baseline_deviation_ratio: float
    size_ratio: float


@dataclass
class LineMeasurement:
    """Per-line measurements and gap distributions."""

    line_index: int
    words: List[WordMeasurement]
    word_gaps: List[float]
    intra_word_gaps: List[float]


@dataclass
class GuideLinesData:
    """Detected reference guidelines geometry."""

    baseline_y: List[int]
    midline_y: List[int]
    topline_y: List[int]


@dataclass
class MeasurementData:
    """Complete CV measurement schema stored in Measurement.raw_cv_data."""

    guide_lines: GuideLinesData
    lines: List[LineMeasurement]
    aggregate: AggregateMetrics

    def to_dict(self) -> Dict[str, Any]:
        """Convert dataclass hierarchy to standard JSON-compatible dictionary."""
        return asdict(self)
```

Update `backend/app/cv/features/__init__.py`:
```python
"""CV Pipeline §6: Feature Extraction Orchestration."""

from typing import List
import numpy as np

from app.cv.features.baseline import compute_baseline_deviation
from app.cv.features.size import compute_size_ratio
from app.cv.features.slant import compute_word_slant
from app.cv.features.spacing import _calc_stats, compute_spacing_metrics
from app.cv.guide_lines import DeskewResult
from app.cv.models import (
    AggregateMetrics,
    GuideLinesData,
    LineMeasurement,
    MeasurementData,
    MetricSummary,
    WordMeasurement,
)
from app.cv.segmentation import SegmentationResult


def extract_features(
    segmentation: SegmentationResult,
    deskew: DeskewResult,
) -> MeasurementData:
    """Extract geometric measurements for all words and assemble the §8 Measurement schema.

    Parameters
    ----------
    segmentation : SegmentationResult
        Lines, words, and gap metrics from segmentation stage.
    deskew : DeskewResult
        Deskewed images and guideline positions.

    Returns
    -------
    MeasurementData
        Complete measurement schema matching CV_PIPELINE.md §8.
    """
    line_measurements: List[LineMeasurement] = []
    all_slants: List[float] = []
    all_baseline_devs: List[float] = []
    all_size_ratios: List[float] = []

    for line in segmentation.lines:
        words_in_line: List[WordMeasurement] = []
        unit_height = max(1.0, float(line.baseline_y - line.midline_y))

        for word in line.words:
            # §6.1 Slant
            slant_deg = compute_word_slant(
                binary_crop=word.binary_crop,
                reference_perpendicular_deg=90.0,
            )
            all_slants.append(slant_deg)

            # §6.3 Baseline Deviation
            base_dev = compute_baseline_deviation(
                word_bbox=word.bbox,
                baseline_y=line.baseline_y,
                unit_height=unit_height,
                binary_crop=word.binary_crop,
            )
            all_baseline_devs.append(base_dev)

            # §6.4 Size Consistency
            size_rat = compute_size_ratio(
                binary_crop=word.binary_crop,
                word_bbox=word.bbox,
                midline_y=line.midline_y,
                baseline_y=line.baseline_y,
                unit_height=unit_height,
            )
            all_size_ratios.append(size_rat)

            words_in_line.append(
                WordMeasurement(
                    word_index=word.word_index,
                    bbox=list(word.bbox),
                    slant_deg=slant_deg,
                    baseline_deviation_ratio=base_dev,
                    size_ratio=size_rat,
                )
            )

        line_measurements.append(
            LineMeasurement(
                line_index=line.line_index,
                words=words_in_line,
                word_gaps=line.word_gaps,
                intra_word_gaps=line.intra_word_gaps,
            )
        )

    # §6.2 Spacing aggregates
    word_spacing_metric, letter_spacing_metric = compute_spacing_metrics(segmentation.lines)

    # Aggregate summaries
    slant_summary = _calc_stats(all_slants)
    baseline_summary = _calc_stats(all_baseline_devs)
    size_summary = _calc_stats(all_size_ratios)

    aggregate = AggregateMetrics(
        slant=slant_summary,
        word_spacing=word_spacing_metric,
        letter_spacing=letter_spacing_metric,
        baseline_deviation=baseline_summary,
        size_consistency=size_summary,
    )

    guide_lines = GuideLinesData(
        baseline_y=deskew.baseline_y,
        midline_y=deskew.midline_y,
        topline_y=deskew.topline_y,
    )

    return MeasurementData(
        guide_lines=guide_lines,
        lines=line_measurements,
        aggregate=aggregate,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/cv/test_models.py -v`
Expected: PASS

- [ ] **Step 5: Commit Task 5**

```bash
git add backend/app/cv/models.py backend/app/cv/features/ backend/tests/cv/test_models.py
git commit -m "feat(cv): implement measurement data models and feature extraction orchestrator"
```

---

### Task 6: Top-Level CV Pipeline Orchestrator (`app/cv/pipeline.py`) & Tests

**Files:**
- Create: `backend/app/cv/pipeline.py`
- Create: `backend/tests/cv/test_pipeline.py`
- Modify: `IMPLEMENTATION_STATUS.md`

**Interfaces:**
- Produces: `run_cv_pipeline(image_bytes: bytes, expected_word_count: Optional[int] = None) -> CVPipelineResult`

- [ ] **Step 1: Write the failing tests for end-to-end CV pipeline**

Create `backend/tests/cv/test_pipeline.py`:
```python
import cv2
import numpy as np
import pytest

from app.cv.pipeline import CVPipelineResult, run_cv_pipeline
from app.cv.quality_gate import QualityGateRejection
from app.cv.segmentation import PostSegmentationRejection
from tests.synthetic import make_blurry_image, make_sharp_worksheet


def test_run_cv_pipeline_success():
    # Generate sharp synthetic worksheet
    img_bytes = make_sharp_worksheet(width=2000, height=2600)
    result = run_cv_pipeline(img_bytes)

    assert isinstance(result, CVPipelineResult)
    assert len(result.word_crops) > 0
    assert result.measurement.guide_lines.baseline_y
    assert len(result.measurement.lines) > 0
    assert result.measurement.aggregate.slant.mean >= 0.0

    # Ensure serialization to JSON dictionary works
    meas_dict = result.measurement.to_dict()
    assert "guide_lines" in meas_dict
    assert "lines" in meas_dict
    assert "aggregate" in meas_dict


def test_run_cv_pipeline_fails_quality_gate():
    # Blurry image should trigger QualityGateRejection at Stage 1
    blurry_bytes = make_blurry_image()
    with pytest.raises(QualityGateRejection):
        run_cv_pipeline(blurry_bytes)


def test_run_cv_pipeline_fails_post_segmentation_gate():
    # Image with sharp worksheet but asking for 100 expected words -> triggers PostSegmentationRejection
    img_bytes = make_sharp_worksheet(width=2000, height=2600)
    with pytest.raises(PostSegmentationRejection):
        run_cv_pipeline(img_bytes, expected_word_count=100)
```

- [ ] **Step 2: Run test to verify failure**

Run: `uv run pytest tests/cv/test_pipeline.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.cv.pipeline'`

- [ ] **Step 3: Implement `backend/app/cv/pipeline.py`**

Create `backend/app/cv/pipeline.py`:
```python
"""CV Pipeline Orchestrator (CV_PIPELINE.md §9).

Executes Stages 1 through 6 synchronously on an input worksheet image and returns
both structured measurement data and CNN handoff word crops.
"""

from dataclasses import dataclass
from typing import List, Optional
import cv2
import numpy as np

from app.cv.features import extract_features
from app.cv.guide_lines import detect_guide_lines_and_deskew
from app.cv.models import MeasurementData
from app.cv.preprocessing import preprocess_image
from app.cv.quality_gate import run_quality_gate
from app.cv.segmentation import segment_lines_and_words


@dataclass
class CVPipelineResult:
    """Output of the complete CV pipeline."""

    measurement: MeasurementData
    word_crops: List[np.ndarray]  # Deskewed grayscale crops for CNN (§7)


def run_cv_pipeline(
    image_bytes: bytes,
    expected_word_count: Optional[int] = None,
) -> CVPipelineResult:
    """Execute the full CV feature extraction pipeline.

    Parameters
    ----------
    image_bytes : bytes
        Validated, EXIF-stripped JPEG image bytes.
    expected_word_count : Optional[int]
        Target text word count for the post-segmentation gate check (§5.3).

    Returns
    -------
    CVPipelineResult
        Structured measurements and grayscale word crops.

    Raises
    ------
    QualityGateRejection
        If image fails blur, brightness, contrast, or resolution checks.
    PostSegmentationRejection
        If detected word count deviates significantly from expected count.
    """
    # 1. Stage 1: Quality Gate
    run_quality_gate(image_bytes)

    # Decode image from bytes
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    # 2. Stage 2: Preprocessing
    prep = preprocess_image(bgr)

    # 3. Stage 3: Guide-Line Detection & Deskew
    deskew = detect_guide_lines_and_deskew(prep.gray, prep.binary)

    # 4. Stage 4: Segmentation & Post-Segmentation Gate
    segmentation = segment_lines_and_words(
        deskew=deskew,
        expected_word_count=expected_word_count,
    )

    # 5. Stage 5: Feature Extraction & Output Assembly
    measurement = extract_features(segmentation, deskew)

    # Collect grayscale crops for CNN handoff (§7)
    word_crops: List[np.ndarray] = []
    for line in segmentation.lines:
        for word in line.words:
            word_crops.append(word.gray_crop)

    return CVPipelineResult(
        measurement=measurement,
        word_crops=word_crops,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/cv/test_pipeline.py -v`
Expected: PASS

- [ ] **Step 5: Run full test suite & ruff check**

Run: `uv run ruff check .`
Run: `uv run pytest -v`
Expected: All tests PASS (80+ items)

- [ ] **Step 6: Update IMPLEMENTATION_STATUS.md and commit Task 6**

Update `IMPLEMENTATION_STATUS.md` lines 72-77 to mark feature extraction and output schema as `Done`.

```bash
git add backend/app/cv/pipeline.py backend/tests/cv/test_pipeline.py IMPLEMENTATION_STATUS.md
git commit -m "feat(cv): implement top-level CV pipeline orchestrator (CV_PIPELINE §8-9)"
```
