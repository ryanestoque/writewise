# Diagnostic Engine & Visual Overlay — Design Spec

**Date:** 2026-09-14  
**Status:** Approved  
**Implements:** PRD §7.4 (Diagnostic Engine), DESIGN §7.4 (Diagnostic Overlay), DATABASE §8 (`measurement.overlay`), API_SPEC §3.3  

---

## 1. Summary

The Diagnostic Engine bridges raw Computer Vision measurements and CNN inference scores into actionable, explainable visual feedback for teachers and parents.

Instead of generating a static second image, the engine generates a structured JSON overlay persisted in `measurement.overlay` (DATABASE §8). The frontend renders this payload as an interactive, multi-layer SVG superimposed on top of the original worksheet photo inside `WorksheetImageInspector` (DESIGN §7.4).

### Key Design Decisions

1. **Severity-Tagged Comprehensive Annotations:** Rather than only emitting defect coordinates, the backend generates geometry for detected words, reference lines, and gaps, tagging each element with a severity level (`"normal"` vs. `"needs_attention"`). This lets the UI display gentle baseline and spacing guides across the worksheet while drawing attention to specific deviations.
2. **Pure Functional Diagnostic Engine (`backend/app/diagnostic/`):** Kept strictly separated from signal processing (`app/cv/`). The engine is a deterministic function `generate_diagnostic_overlay(raw_output) -> dict` with dedicated Pydantic validation models and rule heuristics.
3. **Non-Blocking Pipeline Failure:** If overlay generation encounters an anomaly, it logs the error and gracefully falls back to `null` or a minimal guide-line payload without failing the student's submission upload.
4. **Interactive Spotlight & Tooltip UI:** The frontend provides a criterion filter bar (`All`, `Formation`, `Spacing`, `Slant`, `Baseline`, `Size`). Default view displays all layers at low visual weight; selecting a criterion spotlights that layer and dims the others. Hovering or tapping an annotated element reveals an anchored tooltip with exact metrics and supportive diagnostic notes.

---

## 2. Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
| FastAPI Submission Pipeline (`POST /api/submissions`)                              |
|                                                                                   |
| 1. OpenCV Preprocessing & Feature Extraction  --> `raw_output`                    |
| 2. MobileNetV2 Word-Crop Inference           --> per-word `letter_formation_score`|
| 3. Diagnostic Engine (`app/diagnostic/engine`)--> `measurement.overlay` (JSON)    |
| 4. Persistence to Supabase `measurement` table (raw_output + overlay)             |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v  (HTTP 201 Created / GET /api/submissions)
+-----------------------------------------------------------------------------------+
| Next.js Frontend (Teacher & Parent Portals)                                       |
|                                                                                   |
| - `WorksheetImageInspector`: renders original photo with `object-contain`          |
| - `DiagnosticOverlay`: SVG layer with `viewBox` mirroring natural image dimensions |
| - Sub-layers: BaselineLayer, SpacingLayer, SizeLayer, SlantLayer, FormationLayer   |
| - Filter Toolbar: toggles active criterion spotlight & dimming                     |
| - Annotation Tooltips: floating diagnostic popovers on hover/tap                  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Backend Diagnostic Engine (`backend/app/diagnostic/`)

### 3.1 File Structure

```
backend/app/diagnostic/
├── __init__.py
├── models.py      # Typed Pydantic schemas for overlay data contract
├── rules.py       # Configurable threshold rules and classification heuristics
└── engine.py      # Functional entrypoint: generate_diagnostic_overlay(raw_output)
```

### 3.2 JSON Data Contract (`measurement.overlay`)

```json
{
  "summary": {
    "weakest_criterion": "baseline_alignment",
    "attention_item_count": 3
  },
  "baseline": {
    "guide_lines": {
      "baseline_y": [420, 680],
      "midline_y": [360, 620],
      "topline_y": [300, 560]
    },
    "annotations": [
      {
        "line_index": 0,
        "word_index": 2,
        "bbox": [210, 390, 85, 45],
        "deviation_ratio": 0.16,
        "severity": "needs_attention",
        "note": "Word drifts 16% below baseline"
      }
    ]
  },
  "spacing": {
    "annotations": [
      {
        "line_index": 0,
        "gap_index": 1,
        "x1": 195,
        "x2": 245,
        "y": 420,
        "gap_ratio": 3.4,
        "severity": "needs_attention",
        "note": "Word spacing is wide (3.4× baseline distance)"
      }
    ]
  },
  "size": {
    "annotations": [
      {
        "line_index": 0,
        "word_index": 1,
        "bbox": [120, 350, 75, 70],
        "size_ratio": 1.35,
        "severity": "needs_attention",
        "note": "Letters exceed expected midline height (1.35×)"
      }
    ]
  },
  "slant": {
    "annotations": [
      {
        "line_index": 0,
        "word_index": 0,
        "bbox": [30, 360, 80, 60],
        "angle_deg": 32.5,
        "vector": [50, 420, 65, 360],
        "severity": "needs_attention",
        "note": "Steep forward slant (32.5°)"
      }
    ]
  },
  "letter_formation": {
    "annotations": [
      {
        "line_index": 0,
        "word_index": 2,
        "bbox": [210, 390, 85, 45],
        "score": 48.0,
        "band": "developing",
        "severity": "needs_attention",
        "note": "Developing formation — slight irregular stroke closure"
      }
    ]
  }
}
```

### 3.3 Evaluation Rules & Thresholds (`rules.py`)

1. **Baseline Drift**:
   - `BASELINE_DRIFT_THRESHOLD = 0.10`
   - If `abs(baseline_deviation_ratio) > 0.10`: `severity = "needs_attention"`, otherwise `"normal"`.
2. **Word Spacing**:
   - `WORD_GAP_MIN_RATIO = 1.2`, `WORD_GAP_MAX_RATIO = 3.0`
   - If `gap_ratio < 1.2` (tight) or `gap_ratio > 3.0` (wide): `severity = "needs_attention"`, otherwise `"normal"`.
3. **Size Consistency**:
   - `SIZE_RATIO_MIN = 0.75`, `SIZE_RATIO_MAX = 1.25`
   - If `size_ratio < 0.75` (too small) or `size_ratio > 1.25` (too tall): `severity = "needs_attention"`, otherwise `"normal"`.
4. **Slant**:
   - `SLANT_MIN_DEG = -5.0` (avoid backward tilt), `SLANT_MAX_DEG = 30.0` (avoid excessive forward tilt)
   - If `slant_deg < -5.0` or `slant_deg > 30.0`: `severity = "needs_attention"`, otherwise `"normal"`.
   - Computes center vector `[x1, y1, x2, y2]` based on word centroid and tilt angle.
5. **Letter Formation**:
   - Derived from word-level CNN inference score `word["letter_formation_score"]`.
   - Score `< 62.5` (`needs_improvement` or `developing`): `severity = "needs_attention"`.
   - Score `≥ 62.5` (`satisfactory` or `excellent`): `severity = "normal"`.

---

## 4. Pipeline Integration (`backend/app/api/submissions.py`)

In `create_submission`:
1. Execute CV pipeline and attach CNN scores to `raw_output`.
2. Generate overlay:
   ```python
   overlay_dict = None
   try:
       overlay_dict = generate_diagnostic_overlay(raw_output)
   except Exception as exc:
       logger.error("Diagnostic overlay generation failed: %s", exc)
   ```
3. Insert into `measurement` row:
   ```python
   measurement_row = {
       ...,
       "raw_output": raw_output,
       "overlay": overlay_dict,
   }
   ```
4. Include `overlay` in the returned JSON response for both `POST /api/submissions` and `GET /api/submissions/{id}`.

---

## 5. Frontend Interactive Overlay Component

### 5.1 Component Structure

```
frontend/components/shared/diagnostic-overlay/
├── index.ts
├── diagnostic-overlay.tsx       # Root SVG canvas with image natural dimension viewBox
├── overlay-toolbar.tsx          # Pill filter controls + attention badge counters
├── annotation-tooltip.tsx       # Floating Radix/SVG tooltip on hover/focus
├── types.ts                     # TypeScript interfaces matching backend overlay JSON
└── layers/
    ├── baseline-layer.tsx       # Reference guide lines + baseline drift markers
    ├── spacing-layer.tsx        # Word gap brackets & width annotations
    ├── size-layer.tsx           # Bounding boxes with midline reference limits
    ├── slant-layer.tsx          # Slant directional vectors & angle badges
    └── formation-layer.tsx      # Word underlines & CNN score badges
```

### 5.2 Visual Style & Design Standards (DESIGN §7.4)

- **Default State (`activeCriterion === "all"`)**:
  - All annotations render at **low visual weight** (`opacity: 0.35–0.45`, thin 1px/1.5px strokes).
  - Attention items have a subtle glow and small marker dot (`opacity: 0.85`).
  - Ensures the worksheet is legible without feeling "covered in red flags".
- **Spotlight Mode (`activeCriterion !== "all"`)**:
  - The chosen criterion layer transitions to `opacity: 1.0` with distinct criterion coloring.
  - Other layers are dimmed to `opacity: 0.08` or hidden.
- **Palette Pairing**:
  - Baseline: Sky blue (`text-sky-500`, `stroke-sky-500`) / Amber for attention
  - Spacing: Violet (`text-violet-500`, `stroke-violet-500`) / Rose for attention
  - Size: Emerald (`text-emerald-500`, `stroke-emerald-500`) / Orange for attention
  - Slant: Indigo (`text-indigo-500`, `stroke-indigo-500`) / Amber for attention
  - Letter Formation: Brand blue (`text-brand-500`, `stroke-brand-500`) / Coral for attention
- **Colorblind & Motion Accessibility**:
  - Every severity indicator pairs color with text/icon badges.
  - Honors `prefers-reduced-motion` with `motion-reduce:transition-none`.

---

## 6. Integration Points

1. **Teacher Portal**:
   - Embedded inside `frontend/components/submissions/submission-detail-dialog.tsx`.
   - Placed directly inside `WorksheetImageInspector` as a slot child.
   - Synchronized with `CriterionBreakdown` and `RawMeasurementsTable`.
2. **Parent Portal**:
   - Embedded inside `frontend/components/parent/worksheet-view-dialog.tsx`.
   - Allows parents to view where their child can practice letter formation or spacing in take-home activities.

---

## 7. Testing & Verification

1. **Backend Unit Tests (`backend/tests/diagnostic/test_engine.py`)**:
   - Test synthetic `raw_output` with balanced metrics -> verify all 5 layers generated with `severity="normal"`.
   - Test synthetic outliers (drift > 0.10, gap > 3.0, slant > 30°, formation < 62.5) -> verify `severity="needs_attention"`.
   - Test edge cases: empty lines, missing guide lines, zero width words.
2. **Backend API Integration Tests (`backend/tests/api/test_submissions.py`)**:
   - Verify `overlay` column is saved to `measurement` in `test_create_submission_success`.
   - Verify `overlay` is present in API response payload.
3. **Frontend Checks**:
   - `npx tsc --noEmit` clean.
   - `npx eslint .` clean.
   - Manual UI check in teacher submission modal and parent worksheet dialog: test criterion filter pills, verify spotlighting, test hover tooltip popovers, and verify zoom/pan alignment.
