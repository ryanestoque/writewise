# CV Feature Extraction & Pipeline Orchestration (CV Pipeline Stages 6, 7, 8, 9)

**Date:** 2026-08-26
**Status:** Approved (in-chat design review)
**Implements:** IMPLEMENTATION_STATUS.md Phase 1 → "Feature extraction — slant angle", "Feature extraction — spacing", "Feature extraction — baseline alignment", "Feature extraction — size consistency", "CNN handoff crop generation", "Output schema persisted to measurement"
**Doc pointers:** CV_PIPELINE §6, §7, §8, §9; ARCHITECTURE §8; DATABASE §8; TESTING §4.1

---

## 1. Problem

With the segmentation stage and post-segmentation gate in place (`CV_PIPELINE.md` §5), the pipeline decomposes a deskewed worksheet image into detected guide lines, text lines, word bounding boxes, and cropped images.

To complete the CV analysis for Phase 1, the pipeline must:
1. Extract geometric measurements for the four core CV-evaluated criteria: **slant angle**, **spacing regularity**, **baseline alignment**, and **size consistency** per word and across the whole submission.
2. Generate grayscale word crops for CNN letter formation handoff (`CV_PIPELINE.md` §7).
3. Assemble the measurements into the unified output schema specified in `CV_PIPELINE.md` §8 for persistence in the PostgreSQL `Measurement` table (`DATABASE.md` §8).
4. Provide a top-level orchestrator (`run_cv_pipeline`) that links Stages 1 through 5 seamlessly.

**Dependency chain:** Preprocessing ✅ → Guide-Line Detection ✅ → Line & Word Segmentation ✅ → **Feature Extraction & Orchestrator** → API Integration

---

## 2. Architecture & Module Structure

Following `CV_PIPELINE.md` §9, each stage is implemented as pure functions with zero shared mutable state:

```
backend/app/cv/
├── quality_gate.py          # Stage 1 (§2) - existing
├── preprocessing.py         # Stage 2 (§3) - existing
├── guide_lines.py           # Stage 3 (§4) - existing
├── segmentation.py          # Stage 4 & 5 (§5) - existing
├── features/                # Stage 6 (§6) - NEW
│   ├── __init__.py          # extract_features orchestrator
│   ├── slant.py             # §6.1 HoughLinesP stroke lean
│   ├── spacing.py           # §6.2 Column-gap aggregation
│   ├── baseline.py          # §6.3 Lower-bound deviation
│   └── size.py              # §6.4 Core zone height consistency
├── models.py                # Schema dataclasses matching §8 JSON contract - NEW
└── pipeline.py              # End-to-end CV orchestrator (run_cv_pipeline) - NEW
```

---

## 3. Feature Extraction Algorithms

### 3.1 Slant Angle (`app/cv/features/slant.py`)
- **Signature:** `compute_word_slant(binary_crop: np.ndarray, reference_perpendicular_deg: float = 90.0) -> float`
- **Algorithm:**
  1. Detect line segments inside `binary_crop` using `cv2.HoughLinesP(binary_crop, rho=1, theta=np.pi/180, threshold=10, minLineLength=8, maxLineGap=3)`.
  2. Compute segment orientation angle $\theta = \arctan2(y_2 - y_1, x_2 - x_1) \times \frac{180}{\pi} \pmod{180}$.
  3. Filter to near-vertical strokes: segments where $45^\circ \le \theta \le 135^\circ$.
  4. Slant angle in degrees = $\theta - reference\_perpendicular\_deg$ (positive indicates forward/rightward slant, negative indicates backward/leftward slant).
  5. Return the average slant across all qualifying segments rounded to 1 decimal place.
  6. **Fallback:** If no line segments satisfy the filter, return `0.0°` (neutral vertical).

### 3.2 Spacing Regularity (`app/cv/features/spacing.py`)
- **Signature:** `compute_spacing_metrics(lines: List[LineSegment]) -> Tuple[MetricSummary, MetricSummary]`
- **Algorithm:**
  1. Collect all normalized `word_gaps` across all line segments.
  2. Collect all normalized `intra_word_gaps` across all line segments.
  3. Calculate mean and sample standard deviation (`ddof=0` or `ddof=1` when $N > 1$) for word spacing and letter spacing, rounded to 2 decimal places.
  4. **Fallback:** If list is empty or has only 1 element, set `mean = 0.0` (or element value) and `std = 0.0`.

### 3.3 Baseline Alignment (`app/cv/features/baseline.py`)
- **Signature:** `compute_baseline_deviation(word_bbox: Tuple[int, int, int, int], baseline_y: int, unit_height: float, binary_crop: Optional[np.ndarray] = None) -> float`
- **Algorithm:**
  1. Determine the lower ink boundary $y_{bottom}$:
     - If `binary_crop` is provided, find the maximum y-coordinate of ink pixels relative to global coordinates: $bbox\_y + \max(ys)$.
     - Otherwise fallback to $bbox\_y + bbox\_h$.
  2. Deviation ratio = $\frac{|y_{bottom} - baseline\_y|}{unit\_height}$, where $unit\_height = \max(1.0, float(baseline\_y - midline\_y))$.
  3. Return ratio rounded to 2 decimal places.

### 3.4 Size Consistency (`app/cv/features/size.py`)
- **Signature:** `compute_size_ratio(binary_crop: np.ndarray, word_bbox: Tuple[int, int, int, int], midline_y: int, baseline_y: int, unit_height: float) -> float`
- **Algorithm:**
  1. Translate global `midline_y` and `baseline_y` into crop-local coordinates:
     - $midline\_local = midline\_y - bbox\_y$
     - $baseline\_local = baseline\_y - bbox\_y$
  2. Define the core zone with a $10\%$ tolerance margin:
     - $y_{core\_top} = midline\_local - 0.1 \times unit\_height$
     - $y_{core\_bottom} = baseline\_local + 0.1 \times unit\_height$
  3. Extract all ink pixels in `binary_crop` whose y-coordinates satisfy $y_{core\_top} \le y \le y_{core\_bottom}$.
  4. Compute core height = $\max(ys) - \min(ys) + 1$. If no ink pixels fall within the core zone, use $\min(bbox\_h, unit\_height)$.
  5. Size ratio = $\frac{core\_height}{unit\_height}$, rounded to 2 decimal places.

---

## 4. Output Schema Contract (`app/cv/models.py`)

Matches the exact specification in `CV_PIPELINE.md` §8:

```python
from dataclasses import asdict, dataclass
from typing import Any, Dict, List

@dataclass
class MetricSummary:
    mean: float
    std: float

@dataclass
class AggregateMetrics:
    slant: MetricSummary
    word_spacing: MetricSummary
    letter_spacing: MetricSummary
    baseline_deviation: MetricSummary
    size_consistency: MetricSummary

@dataclass
class WordMeasurement:
    word_index: int
    bbox: List[int]  # [x, y, w, h]
    slant_deg: float
    baseline_deviation_ratio: float
    size_ratio: float

@dataclass
class LineMeasurement:
    line_index: int
    words: List[WordMeasurement]
    word_gaps: List[float]
    intra_word_gaps: List[float]

@dataclass
class GuideLinesData:
    baseline_y: List[int]
    midline_y: List[int]
    topline_y: List[int]

@dataclass
class MeasurementData:
    guide_lines: GuideLinesData
    lines: List[LineMeasurement]
    aggregate: AggregateMetrics

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
```

---

## 5. End-to-End Orchestrator (`app/cv/pipeline.py`)

Exposes the unified entry point:
```python
@dataclass
class CVPipelineResult:
    measurement: MeasurementData
    word_crops: List[np.ndarray]

def run_cv_pipeline(
    image_bytes: bytes,
    expected_word_count: Optional[int] = None,
) -> CVPipelineResult:
    """Execute complete CV pipeline:
    1. Decode JPEG image array
    2. Stage 1: evaluate_quality(gray) -> QualityGateRejection
    3. Stage 2: preprocess_image(img) -> Grayscale, Median Blur, Otsu Binary
    4. Stage 3: detect_guide_lines_and_deskew(gray, binary) -> DeskewResult
    5. Stage 4: segment_lines_and_words(deskew, expected_word_count) -> PostSegmentationRejection
    6. Stage 5: extract_features(segmentation_res, deskew_res) -> MeasurementData
    7. Return CVPipelineResult(measurement, word_crops)
    """
```

---

## 6. Testing Strategy (`backend/tests/cv/`)

1. **`test_slant.py`**:
   - Synthetic word crops with known vertical stroke angles (e.g. $+15^\circ, -10^\circ, 0^\circ$).
   - Fallback verification on blank crop / horizontal line crop ($0.0^\circ$).
2. **`test_spacing.py`**:
   - Test `compute_spacing_metrics` with varied gap distributions.
   - Test edge cases: empty lines, single gap, zero gaps.
3. **`test_baseline.py`**:
   - Synthetic word resting on baseline $\to$ deviation $0.0$.
   - Synthetic word displaced by known vertical offset $\to$ expected deviation ratio.
4. **`test_size.py`**:
   - Synthetic word with letters matching midline-to-baseline $\to$ ratio $\approx 1.0$.
   - Words with ascenders/descenders $\to$ verify core height is isolated.
5. **`test_pipeline.py`**:
   - Full end-to-end execution on synthetic worksheet generated via `tests/synthetic.py`.
   - Verifies schema keys and types.
   - Verifies propagation of `QualityGateRejection` and `PostSegmentationRejection`.
