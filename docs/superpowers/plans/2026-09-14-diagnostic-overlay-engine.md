# Diagnostic Engine & Visual Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the backend Diagnostic Engine to compute severity-tagged geometry annotations into `measurement.overlay` (JSON) and build the interactive multi-layer SVG overlay in Next.js for the Teacher and Parent portals.

**Architecture:** Pure functional Python module `backend/app/diagnostic/` with typed Pydantic models and calibrated threshold rules evaluating `raw_output`. Persisted synchronously in `create_submission`. Next.js frontend renders an SVG canvas matching image aspect ratio with a criterion spotlight filter bar and interactive diagnostic tooltips.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, Pytest; Next.js 15, React 19, TypeScript (strict), Tailwind CSS, Lucide React, Radix UI.

**Spec:** [docs/superpowers/specs/2026-09-14-diagnostic-overlay-engine-design.md](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/superpowers/specs/2026-09-14-diagnostic-overlay-engine-design.md)

## Global Constraints

- Never bypass RLS from app code (AGENTS.md §6).
- API errors follow `{ error: { code, message, details } }` format (API_SPEC §2.4).
- `measurement.overlay` is stored as JSONB in PostgreSQL, never a baked raster image (DATABASE §8).
- Overlay failure during submission must not crash the upload pipeline (Spec §1).
- Frontend respects `prefers-reduced-motion` and pairs colors with textual/icon indicators (DESIGN §10).

---

### Task 1: Backend Diagnostic Models & Rules

**Files:**
- Create: `backend/app/diagnostic/__init__.py`
- Create: `backend/app/diagnostic/models.py`
- Create: `backend/app/diagnostic/rules.py`
- Test: `backend/tests/diagnostic/test_rules.py`

**Interfaces:**
- Produces:
  - `Severity = Literal["normal", "needs_attention"]`
  - Pydantic models: `BaselineAnnotation`, `SpacingAnnotation`, `SizeAnnotation`, `SlantAnnotation`, `LetterFormationAnnotation`, `DiagnosticOverlay`
  - Rule functions in `rules.py`:
    - `evaluate_baseline_drift(deviation_ratio: float) -> tuple[Severity, str]`
    - `evaluate_word_gap(gap_ratio: float) -> tuple[Severity, str]`
    - `evaluate_size_consistency(size_ratio: float) -> tuple[Severity, str]`
    - `evaluate_slant(slant_deg: float, bbox: list[int]) -> tuple[Severity, list[int], str]`
    - `evaluate_letter_formation(score: float | None) -> tuple[Severity, str, str]`

- [x] **Step 1: Write failing tests for diagnostic rules and models**

Create `backend/tests/diagnostic/test_rules.py`:
```python
from app.diagnostic.rules import (
    evaluate_baseline_drift,
    evaluate_word_gap,
    evaluate_size_consistency,
    evaluate_slant,
    evaluate_letter_formation,
)


def test_evaluate_baseline_drift():
    sev, note = evaluate_baseline_drift(0.04)
    assert sev == "normal"
    assert "consistent" in note.lower()

    sev, note = evaluate_baseline_drift(0.18)
    assert sev == "needs_attention"
    assert "18%" in note


def test_evaluate_word_gap():
    sev, note = evaluate_word_gap(2.0)
    assert sev == "normal"

    sev, note = evaluate_word_gap(3.5)
    assert sev == "needs_attention"
    assert "wide" in note.lower()

    sev, note = evaluate_word_gap(0.8)
    assert sev == "needs_attention"
    assert "tight" in note.lower()


def test_evaluate_size_consistency():
    sev, note = evaluate_size_consistency(1.0)
    assert sev == "normal"

    sev, note = evaluate_size_consistency(1.35)
    assert sev == "needs_attention"
    assert "exceed" in note.lower()


def test_evaluate_slant():
    sev, vector, note = evaluate_slant(12.0, [100, 200, 80, 50])
    assert sev == "normal"
    assert len(vector) == 4

    sev, vector, note = evaluate_slant(35.0, [100, 200, 80, 50])
    assert sev == "needs_attention"
    assert "steep" in note.lower()


def test_evaluate_letter_formation():
    sev, band, note = evaluate_letter_formation(75.0)
    assert sev == "normal"
    assert band == "satisfactory"

    sev, band, note = evaluate_letter_formation(45.0)
    assert sev == "needs_attention"
    assert band == "developing"
```

- [x] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/diagnostic/test_rules.py -v`  
Expected: FAIL (ModuleNotFoundError: No module named 'app.diagnostic')

- [x] **Step 3: Implement models.py, rules.py, and __init__.py**

Create `backend/app/diagnostic/__init__.py`:
```python
"""Diagnostic Engine package."""
```

Create `backend/app/diagnostic/models.py`:
```python
from typing import Literal
from pydantic import BaseModel, Field

Severity = Literal["normal", "needs_attention"]


class GuideLinesData(BaseModel):
    baseline_y: list[int] = Field(default_factory=list)
    midline_y: list[int] = Field(default_factory=list)
    topline_y: list[int] = Field(default_factory=list)


class BaselineAnnotation(BaseModel):
    line_index: int
    word_index: int
    bbox: list[int]
    deviation_ratio: float
    severity: Severity
    note: str


class BaselineOverlay(BaseModel):
    guide_lines: GuideLinesData
    annotations: list[BaselineAnnotation] = Field(default_factory=list)


class SpacingAnnotation(BaseModel):
    line_index: int
    gap_index: int
    x1: int
    x2: int
    y: int
    gap_ratio: float
    severity: Severity
    note: str


class SpacingOverlay(BaseModel):
    annotations: list[SpacingAnnotation] = Field(default_factory=list)


class SizeAnnotation(BaseModel):
    line_index: int
    word_index: int
    bbox: list[int]
    size_ratio: float
    severity: Severity
    note: str


class SizeOverlay(BaseModel):
    annotations: list[SizeAnnotation] = Field(default_factory=list)


class SlantAnnotation(BaseModel):
    line_index: int
    word_index: int
    bbox: list[int]
    angle_deg: float
    vector: list[int]
    severity: Severity
    note: str


class SlantOverlay(BaseModel):
    annotations: list[SlantAnnotation] = Field(default_factory=list)


class FormationAnnotation(BaseModel):
    line_index: int
    word_index: int
    bbox: list[int]
    score: float
    band: str
    severity: Severity
    note: str


class FormationOverlay(BaseModel):
    annotations: list[FormationAnnotation] = Field(default_factory=list)


class OverlaySummary(BaseModel):
    weakest_criterion: str
    attention_item_count: int


class DiagnosticOverlay(BaseModel):
    summary: OverlaySummary
    baseline: BaselineOverlay
    spacing: SpacingOverlay
    size: SizeOverlay
    slant: SlantOverlay
    letter_formation: FormationOverlay
```

Create `backend/app/diagnostic/rules.py`:
```python
import math
from typing import Literal

Severity = Literal["normal", "needs_attention"]

# Thresholds per Spec §3.3
BASELINE_DRIFT_THRESHOLD = 0.10
WORD_GAP_MIN_RATIO = 1.2
WORD_GAP_MAX_RATIO = 3.0
SIZE_RATIO_MIN = 0.75
SIZE_RATIO_MAX = 1.25
SLANT_MIN_DEG = -5.0
SLANT_MAX_DEG = 30.0
FORMATION_SCORE_THRESHOLD = 62.5


def evaluate_baseline_drift(deviation_ratio: float) -> tuple[Severity, str]:
    abs_dev = abs(deviation_ratio)
    pct = round(abs_dev * 100)
    if abs_dev > BASELINE_DRIFT_THRESHOLD:
        direction = "below" if deviation_ratio > 0 else "above"
        return "needs_attention", f"Word drifts {pct}% {direction} the baseline"
    return "normal", f"Word baseline alignment is consistent ({pct}% deviation)"


def evaluate_word_gap(gap_ratio: float) -> tuple[Severity, str]:
    ratio = round(gap_ratio, 1)
    if gap_ratio > WORD_GAP_MAX_RATIO:
        return "needs_attention", f"Word spacing is noticeably wide ({ratio}× midline height)"
    if gap_ratio < WORD_GAP_MIN_RATIO:
        return "needs_attention", f"Word spacing is tight ({ratio}× midline height)"
    return "normal", f"Word spacing is well-proportioned ({ratio}× midline height)"


def evaluate_size_consistency(size_ratio: float) -> tuple[Severity, str]:
    ratio = round(size_ratio, 2)
    if size_ratio > SIZE_RATIO_MAX:
        return "needs_attention", f"Letters exceed expected midline height ({ratio}×)"
    if size_ratio < SIZE_RATIO_MIN:
        return "needs_attention", f"Letters are smaller than midline height ({ratio}×)"
    return "normal", f"Letter size is consistent with guideline height ({ratio}×)"


def evaluate_slant(slant_deg: float, bbox: list[int]) -> tuple[Severity, list[int], str]:
    x, y, w, h = bbox
    cx = x + w // 2
    cy = y + h // 2

    rad = math.radians(slant_deg)
    length = max(20, h // 2)
    dx = int(length * math.sin(rad))
    dy = int(length * math.cos(rad))

    vector = [cx - dx, cy + dy, cx + dx, cy - dy]
    angle = round(slant_deg, 1)

    if slant_deg > SLANT_MAX_DEG:
        return "needs_attention", vector, f"Steep forward slant ({angle}°)"
    if slant_deg < SLANT_MIN_DEG:
        return "needs_attention", vector, f"Backward slant ({angle}°)"
    return "normal", vector, f"Standard cursive slant ({angle}°)"


def evaluate_letter_formation(score: float | None) -> tuple[Severity, str, str]:
    if score is None:
        score = 65.0

    rounded = round(score, 1)
    if score >= 85.0:
        return "normal", "excellent", f"Excellent formation ({rounded}/100)"
    if score >= 62.5:
        return "normal", "satisfactory", f"Satisfactory formation ({rounded}/100)"
    if score >= 35.0:
        return "needs_attention", "developing", f"Developing formation ({rounded}/100) — practice stroke loops"
    return "needs_attention", "needs_improvement", f"Needs improvement ({rounded}/100) — guided tracing recommended"
```

- [x] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/diagnostic/test_rules.py -v`  
Expected: PASS (5 passed)

- [x] **Step 5: Commit**

```bash
git add backend/app/diagnostic/ backend/tests/diagnostic/
git commit -m "feat(diagnostic): add diagnostic models and severity evaluation rules"
```

---

### Task 2: Backend Diagnostic Engine Core

**Files:**
- Create: `backend/app/diagnostic/engine.py`
- Test: `backend/tests/diagnostic/test_engine.py`

**Interfaces:**
- Consumes: `raw_output` dictionary from CV pipeline and CNN inference.
- Produces: `generate_diagnostic_overlay(raw_output: dict) -> dict` returning a serialized `DiagnosticOverlay`.

- [x] **Step 1: Write failing tests for engine.py**

Create `backend/tests/diagnostic/test_engine.py`:
```python
from app.diagnostic.engine import generate_diagnostic_overlay


def make_sample_raw_output():
    return {
        "guide_lines": {
            "baseline_y": [420, 680],
            "midline_y": [360, 620],
            "topline_y": [300, 560],
        },
        "lines": [
            {
                "line_index": 0,
                "words": [
                    {
                        "word_index": 0,
                        "bbox": [50, 360, 80, 60],
                        "slant_deg": 12.0,
                        "baseline_deviation_ratio": 0.04,
                        "size_ratio": 0.95,
                        "letter_formation_score": 82.0,
                    },
                    {
                        "word_index": 1,
                        "bbox": [180, 350, 100, 75],
                        "slant_deg": 34.0,  # Outlier
                        "baseline_deviation_ratio": 0.16,  # Outlier
                        "size_ratio": 1.35,  # Outlier
                        "letter_formation_score": 45.0,  # Outlier
                    },
                ],
                "word_gaps": [3.6],  # Outlier gap
                "intra_word_gaps": [0.3],
            }
        ],
        "aggregate": {
            "slant": {"mean": 23.0, "std": 11.0},
            "word_spacing": {"mean": 3.6, "std": 0.0},
            "letter_spacing": {"mean": 0.3, "std": 0.0},
            "baseline_deviation": {"mean": 0.10, "std": 0.06},
            "size_consistency": {"mean": 1.15, "std": 0.20},
            "letter_formation": {"mean": 63.5, "std": 18.5},
        },
    }


def test_generate_diagnostic_overlay_structure():
    raw_output = make_sample_raw_output()
    overlay = generate_diagnostic_overlay(raw_output)

    assert "summary" in overlay
    assert "baseline" in overlay
    assert "spacing" in overlay
    assert "size" in overlay
    assert "slant" in overlay
    assert "letter_formation" in overlay

    # Check baseline
    assert len(overlay["baseline"]["guide_lines"]["baseline_y"]) == 2
    assert len(overlay["baseline"]["annotations"]) == 2
    assert overlay["baseline"]["annotations"][0]["severity"] == "normal"
    assert overlay["baseline"]["annotations"][1]["severity"] == "needs_attention"

    # Check spacing
    assert len(overlay["spacing"]["annotations"]) == 1
    assert overlay["spacing"]["annotations"][0]["severity"] == "needs_attention"

    # Check slant
    assert overlay["slant"]["annotations"][1]["severity"] == "needs_attention"

    # Check letter formation
    assert overlay["letter_formation"]["annotations"][1]["severity"] == "needs_attention"

    # Check summary count
    assert overlay["summary"]["attention_item_count"] >= 4


def test_generate_diagnostic_overlay_resilient_on_empty_input():
    empty_raw = {"guide_lines": {}, "lines": []}
    overlay = generate_diagnostic_overlay(empty_raw)
    assert overlay["summary"]["attention_item_count"] == 0
    assert len(overlay["baseline"]["annotations"]) == 0
```

- [x] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/diagnostic/test_engine.py -v`  
Expected: FAIL (ImportError: cannot import name 'generate_diagnostic_overlay')

- [x] **Step 3: Implement engine.py**

Create `backend/app/diagnostic/engine.py`:
```python
import logging
from typing import Any

from app.diagnostic.models import (
    BaselineAnnotation,
    BaselineOverlay,
    DiagnosticOverlay,
    FormationAnnotation,
    FormationOverlay,
    GuideLinesData,
    OverlaySummary,
    SizeAnnotation,
    SizeOverlay,
    SlantAnnotation,
    SlantOverlay,
    SpacingAnnotation,
    SpacingOverlay,
)
from app.diagnostic.rules import (
    evaluate_baseline_drift,
    evaluate_letter_formation,
    evaluate_size_consistency,
    evaluate_slant,
    evaluate_word_gap,
)

logger = logging.getLogger(__name__)


def generate_diagnostic_overlay(raw_output: dict[str, Any]) -> dict[str, Any]:
    """Pure functional transformer converting CV raw_output to DiagnosticOverlay JSON."""
    try:
        gl_raw = raw_output.get("guide_lines") or {}
        guide_lines = GuideLinesData(
            baseline_y=gl_raw.get("baseline_y", []),
            midline_y=gl_raw.get("midline_y", []),
            topline_y=gl_raw.get("topline_y", []),
        )

        baseline_annotations: list[BaselineAnnotation] = []
        spacing_annotations: list[SpacingAnnotation] = []
        size_annotations: list[SizeAnnotation] = []
        slant_annotations: list[SlantAnnotation] = []
        formation_annotations: list[FormationAnnotation] = []

        attention_counts = {
            "baseline_alignment": 0,
            "spacing": 0,
            "size_consistency": 0,
            "slant": 0,
            "letter_formation": 0,
        }

        lines = raw_output.get("lines") or []
        for line in lines:
            line_idx = line.get("line_index", 0)
            words = line.get("words") or []
            word_gaps = line.get("word_gaps") or []

            # Word-level annotations
            for word in words:
                w_idx = word.get("word_index", 0)
                bbox = word.get("bbox", [0, 0, 0, 0])

                # 1. Baseline
                drift = word.get("baseline_deviation_ratio", 0.0)
                b_sev, b_note = evaluate_baseline_drift(drift)
                if b_sev == "needs_attention":
                    attention_counts["baseline_alignment"] += 1
                baseline_annotations.append(
                    BaselineAnnotation(
                        line_index=line_idx,
                        word_index=w_idx,
                        bbox=bbox,
                        deviation_ratio=round(drift, 3),
                        severity=b_sev,
                        note=b_note,
                    )
                )

                # 2. Size
                size_ratio = word.get("size_ratio", 1.0)
                sz_sev, sz_note = evaluate_size_consistency(size_ratio)
                if sz_sev == "needs_attention":
                    attention_counts["size_consistency"] += 1
                size_annotations.append(
                    SizeAnnotation(
                        line_index=line_idx,
                        word_index=w_idx,
                        bbox=bbox,
                        size_ratio=round(size_ratio, 2),
                        severity=sz_sev,
                        note=sz_note,
                    )
                )

                # 3. Slant
                slant_deg = word.get("slant_deg", 0.0)
                sl_sev, vector, sl_note = evaluate_slant(slant_deg, bbox)
                if sl_sev == "needs_attention":
                    attention_counts["slant"] += 1
                slant_annotations.append(
                    SlantAnnotation(
                        line_index=line_idx,
                        word_index=w_idx,
                        bbox=bbox,
                        angle_deg=round(slant_deg, 1),
                        vector=vector,
                        severity=sl_sev,
                        note=sl_note,
                    )
                )

                # 4. Letter Formation
                score = word.get("letter_formation_score")
                f_sev, band, f_note = evaluate_letter_formation(score)
                if f_sev == "needs_attention":
                    attention_counts["letter_formation"] += 1
                formation_annotations.append(
                    FormationAnnotation(
                        line_index=line_idx,
                        word_index=w_idx,
                        bbox=bbox,
                        score=round(score if score is not None else 65.0, 1),
                        band=band,
                        severity=f_sev,
                        note=f_note,
                    )
                )

            # Spacing between consecutive words
            for gap_idx, gap_ratio in enumerate(word_gaps):
                if gap_idx + 1 < len(words):
                    w1_bbox = words[gap_idx].get("bbox", [0, 0, 0, 0])
                    w2_bbox = words[gap_idx + 1].get("bbox", [0, 0, 0, 0])
                    x1 = w1_bbox[0] + w1_bbox[2]
                    x2 = w2_bbox[0]
                    y = w1_bbox[1] + w1_bbox[3] // 2
                else:
                    x1, x2, y = 0, 0, 0

                sp_sev, sp_note = evaluate_word_gap(gap_ratio)
                if sp_sev == "needs_attention":
                    attention_counts["spacing"] += 1
                spacing_annotations.append(
                    SpacingAnnotation(
                        line_index=line_idx,
                        gap_index=gap_idx,
                        x1=x1,
                        x2=x2,
                        y=y,
                        gap_ratio=round(gap_ratio, 2),
                        severity=sp_sev,
                        note=sp_note,
                    )
                )

        weakest = max(attention_counts, key=lambda k: attention_counts[k])
        total_attention = sum(attention_counts.values())

        overlay = DiagnosticOverlay(
            summary=OverlaySummary(
                weakest_criterion=weakest,
                attention_item_count=total_attention,
            ),
            baseline=BaselineOverlay(
                guide_lines=guide_lines,
                annotations=baseline_annotations,
            ),
            spacing=SpacingOverlay(annotations=spacing_annotations),
            size=SizeOverlay(annotations=size_annotations),
            slant=SlantOverlay(annotations=slant_annotations),
            letter_formation=FormationOverlay(annotations=formation_annotations),
        )
        return overlay.model_dump()
    except Exception as exc:
        logger.error("Failed to generate diagnostic overlay: %s", exc)
        return {
            "summary": {"weakest_criterion": "none", "attention_item_count": 0},
            "baseline": {"guide_lines": {"baseline_y": [], "midline_y": [], "topline_y": []}, "annotations": []},
            "spacing": {"annotations": []},
            "size": {"annotations": []},
            "slant": {"annotations": []},
            "letter_formation": {"annotations": []},
        }
```

- [x] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/diagnostic/test_engine.py -v`  
Expected: PASS (2 passed)

- [x] **Step 5: Commit**

```bash
git add backend/app/diagnostic/engine.py backend/tests/diagnostic/test_engine.py
git commit -m "feat(diagnostic): implement diagnostic overlay generator engine"
```

---

### Task 3: Pipeline Integration into Submission Processing & API

**Files:**
- Modify: `backend/app/api/submissions.py`
- Test: `backend/tests/api/test_submissions.py`

**Interfaces:**
- Consumes: `generate_diagnostic_overlay` from `app.diagnostic.engine`.
- Produces: `overlay` field populated on `measurement` database row and in `SubmissionResponse` & `GetSubmissionResponse`.

- [x] **Step 1: Write integration tests verifying overlay persistence and response**

Add test method to `backend/tests/api/test_submissions.py` under `TestCreateSubmission`:
```python
    def test_submission_generates_and_persists_overlay(
        self, client, test_activity, test_student, supabase_client
    ):
        img_bytes = make_segmented_worksheet()
        response = client.post(
            "/api/submissions",
            data={
                "activity_id": test_activity["id"],
                "student_id": test_student["id"],
            },
            files={"image": ("worksheet.jpg", img_bytes, "image/jpeg")},
        )
        assert response.status_code == 201
        data = response.json()
        sub_id = data["submission"]["id"]

        # 1. Returned API payload includes populated overlay
        assert "overlay" in data["submission"]
        overlay = data["submission"]["overlay"]
        assert overlay is not None
        assert "summary" in overlay
        assert "baseline" in overlay
        assert "spacing" in overlay
        assert "letter_formation" in overlay

        # 2. Database row in measurement table contains the overlay
        meas_res = (
            supabase_client.table("measurement")
            .select("overlay")
            .eq("submission_id", sub_id)
            .execute()
        )
        assert len(meas_res.data) == 1
        db_overlay = meas_res.data[0]["overlay"]
        assert db_overlay is not None
        assert "summary" in db_overlay
```

- [x] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/api/test_submissions.py::TestCreateSubmission::test_submission_generates_and_persists_overlay -v`  
Expected: FAIL (AssertionError: overlay is None)

- [x] **Step 3: Modify submissions.py to generate overlay and persist it**

In `backend/app/api/submissions.py`:
1. Import `generate_diagnostic_overlay`:
   ```python
   from app.diagnostic.engine import generate_diagnostic_overlay
   ```
2. After attaching CNN scores to `raw_output`, call `generate_diagnostic_overlay`:
   ```python
   # 11b. Diagnostic Overlay generation (PRD §7.4, DESIGN §7.4)
   overlay_dict = generate_diagnostic_overlay(raw_output)
   ```
3. Attach `overlay` to `measurement_row`:
   ```python
   measurement_row = {
       "submission_id": submission_id,
       ...,
       "raw_output": raw_output,
       "overlay": overlay_dict,
       "created_by": current_user.id,
   }
   ```
4. Include `overlay` in returned response dictionary:
   ```python
   "overlay": overlay_dict,
   ```

- [x] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/api/test_submissions.py -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/app/api/submissions.py backend/tests/api/test_submissions.py
git commit -m "feat(api): wire diagnostic overlay generation into submission creation"
```

---

### Task 4: Frontend Types & Modular SVG Layers

**Files:**
- Create: `frontend/components/shared/diagnostic-overlay/types.ts`
- Create: `frontend/components/shared/diagnostic-overlay/layers/baseline-layer.tsx`
- Create: `frontend/components/shared/diagnostic-overlay/layers/spacing-layer.tsx`
- Create: `frontend/components/shared/diagnostic-overlay/layers/size-layer.tsx`
- Create: `frontend/components/shared/diagnostic-overlay/layers/slant-layer.tsx`
- Create: `frontend/components/shared/diagnostic-overlay/layers/formation-layer.tsx`

**Interfaces:**
- Produces:
  - `CriterionFilter = "all" | "letter_formation" | "spacing" | "size_consistency" | "slant" | "baseline_alignment"`
  - `DiagnosticOverlayData` TypeScript interface
  - Sub-layer SVG components accepting `overlay`, `activeCriterion`, and hover callbacks.

- [x] **Step 1: Create types.ts**

Create `frontend/components/shared/diagnostic-overlay/types.ts` matching backend schema with full strict typings.

- [x] **Step 2: Create sub-layer SVG components**

Create individual criterion SVG sub-renderers with Tailwind styles, hover events, and appropriate color coding:
- `layers/baseline-layer.tsx` (reference guide lines + baseline drift markers)
- `layers/spacing-layer.tsx` (word-gap brackets + ratio labels)
- `layers/size-layer.tsx` (bounding boxes with midline guide caps)
- `layers/slant-layer.tsx` (directional vectors through centroid)
- `layers/formation-layer.tsx` (word underlines & score band pills)

- [x] **Step 3: Run TypeScript compiler check**

Run: `npx tsc --noEmit`  
Expected: Clean pass with 0 errors.

- [x] **Step 4: Commit**

```bash
git add frontend/components/shared/diagnostic-overlay/
git commit -m "feat(frontend): create diagnostic overlay SVG criterion layers and types"
```

---

### Task 5: Frontend Root Overlay Component, Toolbar & Tooltip

**Files:**
- Create: `frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx`
- Create: `frontend/components/shared/diagnostic-overlay/overlay-toolbar.tsx`
- Create: `frontend/components/shared/diagnostic-overlay/diagnostic-overlay.tsx`
- Create: `frontend/components/shared/diagnostic-overlay/index.ts`

**Interfaces:**
- Produces:
  - `<DiagnosticOverlay overlay={...} imageUrl={...} visible={true} />`
  - `<OverlayToolbar activeCriterion={...} onChangeCriterion={...} overlay={...} />`

- [x] **Step 1: Create annotation-tooltip.tsx**

Renders an accessible floating popover/badge positioned over the active hovered annotation element, displaying criterion name, severity badge, and explanatory note.

- [x] **Step 2: Create overlay-toolbar.tsx**

Pill filter bar with:
- Buttons: `All`, `Formation`, `Spacing`, `Slant`, `Baseline`, `Size`
- Flagged count badges (e.g. `All (3)`, amber dot if attention count > 0)
- Master visibility toggle.

- [x] **Step 3: Create diagnostic-overlay.tsx and index.ts**

The root SVG canvas component using `viewBox="0 0 naturalWidth naturalHeight"` with `preserveAspectRatio="xMidYMid meet"`, holding state for hovered annotation and rendering the layers.

- [x] **Step 4: Run TypeScript compiler check**

Run: `npx tsc --noEmit`  
Expected: Clean pass with 0 errors.

- [x] **Step 5: Commit**

```bash
git add frontend/components/shared/diagnostic-overlay/
git commit -m "feat(frontend): build interactive diagnostic overlay canvas, toolbar, and tooltip"
```

---

### Task 6: Wire Diagnostic Overlay into Teacher & Parent Portals and Verify

**Files:**
- Modify: `frontend/components/submissions/submission-detail-dialog.tsx`
- Modify: `frontend/components/parent/worksheet-view-dialog.tsx`

**Interfaces:**
- Consumes: `<DiagnosticOverlay />` and `<OverlayToolbar />` inside `WorksheetImageInspector`.
- Passes `measurement.overlay` (or fallback to guide lines if legacy).

- [x] **Step 1: Update submission-detail-dialog.tsx**

In `frontend/components/submissions/submission-detail-dialog.tsx`:
- Import `DiagnosticOverlay`, `OverlayToolbar`, `extractOverlay`.
- Replace or enhance `GuideLineOverlay` inside `WorksheetImageInspector`:
  - Show `<OverlayToolbar />` above the image inspector.
  - Render `<DiagnosticOverlay />` as a child inside `WorksheetImageInspector`.
  - Connect selection with the criterion breakdown list.

- [x] **Step 2: Update worksheet-view-dialog.tsx**

In `frontend/components/parent/worksheet-view-dialog.tsx`:
- Render `<DiagnosticOverlay />` inside the parent worksheet modal so parents can inspect annotations on take-home activities.

- [x] **Step 3: Run verification tests and linters**

```bash
cd backend && uv run pytest -v
cd ../frontend && npx tsc --noEmit && npx eslint .
```
Expected: All backend unit/API tests pass; frontend compiles with 0 TypeScript/lint errors.

- [x] **Step 4: Manual QA Verification**

1. Launch web browser to `http://localhost:3000`.
2. Log in as teacher, open an existing completed submission modal.
3. Test filter pills: toggle between All, Formation, Spacing, Slant, Baseline, Size.
4. Hover over highlighted words and observe diagnostic popover tooltip.
5. Verify SVG annotations remain aligned during zoom in/out and panning.

- [x] **Step 5: Commit**

```bash
git add frontend/components/submissions/submission-detail-dialog.tsx frontend/components/parent/worksheet-view-dialog.tsx
git commit -m "feat: integrate interactive diagnostic overlay into teacher and parent portals"
```
