# ADR 0001: OpenCV Feature Extraction & Pipeline Orchestration Architecture

- **Status:** Accepted / Implemented
- **Date:** 2026-08-26
- **Authors:** WriteWise Engineering Team
- **Implements:** `CV_PIPELINE.md` §6, §7, §8, §9; `ARCHITECTURE.md` §8; `IMPLEMENTATION_STATUS.md` Phase 1

---

## 1. Context & Problem Statement

WriteWise evaluates cursive handwriting worksheets against five core criteria:
1. Letter Formation (handled by CNN inference)
2. Slant Angle (CV)
3. Spacing Regularity (CV)
4. Baseline Alignment (CV)
5. Size Consistency (CV)

Phase 1 requires capturing raw, objective geometric measurements from uploaded worksheet photos and pairing them with teacher rubric scores to build a clean calibration dataset for Spearman's Rho correlation analysis (`PRD.md` §5).

The computer vision subsystem needed an architectural design that solves the following key challenges:
- **Scale Invariance:** Photos vary in camera distance, zoom, and resolution.
- **Cursive Segmentation Complexity:** Connecting strokes make letter-level segmentation error-prone.
- **Ascender/Descender Variation:** Letter height varies inherently based on character identity (e.g. *t, b, l* vs *a, c, e*).
- **Sub-Second Performance & Testability:** The pipeline executes synchronously on user upload without shared state corruption.

---

## 2. Decision Drivers

- **Purity & Isolation:** Every image-processing stage must be deterministic and testable with synthetic images (`TESTING.md` §4.1).
- **Scale-Invariant Ground Truth:** Metrics must be normalized against an objective physical reference on the page, not circular handwriting statistics.
- **Single Source of Truth:** Output JSON schema must serve Phase 1 raw data display, PostgreSQL `Measurement` storage, and Phase 2 diagnostic feedback overlays identically.

---

## 3. Considered Options & Architectural Decisions

### Decision 1: Pure Functional Architecture with Zero Shared State (`app/cv/features/`)
- **Chosen Approach:** All stages and feature extraction modules are pure functions accepting NumPy arrays or immutable dataclasses and returning structured outputs.
- **Module Structure:**
  - `backend/app/cv/features/slant.py`: `compute_word_slant(...)`
  - `backend/app/cv/features/spacing.py`: `compute_spacing_metrics(...)`
  - `backend/app/cv/features/baseline.py`: `compute_baseline_deviation(...)`
  - `backend/app/cv/features/size.py`: `compute_size_ratio(...)`
  - `backend/app/cv/features/__init__.py`: `extract_features(...)`
  - `backend/app/cv/models.py`: Strongly-typed schema dataclasses
  - `backend/app/cv/pipeline.py`: `run_cv_pipeline(...)` orchestrator
- **Rationale:** Avoids mutable state bugs across concurrent requests, simplifies worker threading, and allows independent unit testing of every single feature calculation without pipeline scaffolding.

### Decision 2: Printed Guideline Normalization Reference (`baseline_y - midline_y`)
- **Chosen Approach:** All ratios (baseline deviation, size consistency, gap spacing) are normalized against the detected printed ruling unit height:
  $$\text{unit\_height} = \max(1.0, \text{baseline\_y} - \text{midline\_y})$$
- **Rationale:** Normalizing against handwriting-derived dimensions (e.g. average letter height) creates circular dependency (evaluating handwriting quality using that same handwriting as ground truth). Grade 3 practice paper has printed baseline/midline ruling, providing an objective, camera-scale-invariant baseline.

### Decision 3: Hough Stroke-Filtering with Neutral Fallback for Slant Angle
- **Chosen Approach:** Use Probabilistic Hough Transform (`cv2.HoughLinesP`) on the word crop, filtered strictly to near-vertical strokes ($45^\circ \le \theta \le 135^\circ$), measuring angle deviation relative to vertical. If no near-vertical strokes are detected (e.g., punctuation or purely round letters), the word falls back to `0.0°` (neutral vertical).
- **Rationale:** Principal Component Analysis (PCA) on whole-word ink spreads fails for cursive because words are horizontally wide. Segment-filtering isolates the actual down/up pen stems carrying the slant signal.

### Decision 4: Core Zone Ink Isolation for Size Consistency
- **Chosen Approach:** Size consistency measures the vertical ink span strictly within the core band:
  $$[\text{midline\_local} - 0.1 \times \text{unit\_height},\, \text{baseline\_local} + 0.1 \times \text{unit\_height}]$$
- **Rationale:** Measuring raw word bounding-box height penalizes students unfairly for words containing tall ascenders (*b, d, k, l*) or low descenders (*g, j, p, q, y*). Isolating the core body mass measures size control accurately.

### Decision 5: Unified Output Schema (`MeasurementData`)
- **Chosen Approach:** Strongly-typed Python dataclasses with `.to_dict()` serialization matching `CV_PIPELINE.md` §8 format:
  ```json
  {
    "guide_lines": { "baseline_y": [...], "midline_y": [...], "topline_y": [...] },
    "lines": [
      {
        "line_index": 0,
        "words": [
          {
            "word_index": 0,
            "bbox": [x, y, w, h],
            "slant_deg": 7.2,
            "baseline_deviation_ratio": 0.04,
            "size_ratio": 0.91
          }
        ],
        "word_gaps": [1.8],
        "intra_word_gaps": [0.3, 0.4]
      }
    ],
    "aggregate": {
      "slant": { "mean": 6.8, "std": 1.4 },
      "word_spacing": { "mean": 1.93, "std": 0.15 },
      "letter_spacing": { "mean": 0.33, "std": 0.06 },
      "baseline_deviation": { "mean": 0.05, "std": 0.02 },
      "size_consistency": { "mean": 0.89, "std": 0.08 }
    }
  }
  ```
- **Rationale:** Single unified JSON representation avoids mismatch between Phase 1 manual score correlation and Phase 2 visual diagnostic overlay rendering.

---

## 4. Consequences & Trade-offs

### Positive Consequences
- **Complete Test Isolation:** 100% test coverage using synthetic images in `backend/tests/cv/` without any committed binary asset dependencies.
- **Fast Execution:** Pipeline executes end-to-end in < 1 second on standard phone photo dimensions, well within the 5-second performance budget (`CV_PIPELINE.md` §10).
- **Clean ML Handoff:** Returns deskewed grayscale word crops (`gray_crop`) for CNN inference while keeping binarized representations internal to geometry extraction (`CV_PIPELINE.md` §7).

### Negative / Known Limitations
- **Letter Spacing is a Rhythm Proxy:** Column-gap projection inside words identifies candidate inter-letter gaps, not verified character boundaries. Surfaced in UI documentation as a spacing regularity index.
- **Guideline Dependency:** Relies on visible 3-line ruling (standard for Grade 3 target demographic). Blank plain paper requires separate guideline synthesis in future roadmap.
