# ADR 0003: Handwritten Text Recognition (HTR) and Target Text Verification

- **Status:** Accepted / Implemented
- **Date:** 2026-10-02
- **Authors:** WriteWise Engineering Team
- **Implements:** `PRD.md`, `CV_PIPELINE.md` (HTR section)

---

## 1. Context & Problem Statement

WriteWise needs to verify that students have traced or copied the actual target words specified in the activity. Before passing cursive crops to the CNN backbone for letter formation scoring, the system must ensure the uploaded text is a genuine attempt at the prompted text, rather than a different word entirely or garbled scribbles. 

However, verifying cursive text presents specific challenges:
1. **Ruling Line Noise:** Worksheets contain distinct blue and red notebook ruling lines that intersect with cursive loops and stems. Standard thresholding often turns these lines into solid black bars, ruining text recognition.
2. **Cursive Ambiguities:** Elementary handwriting often features ambiguous connecting strokes. Strict spelling verification penalizes students for common cursive similarities (e.g., mistaking an `a` for an `e` or an `n` for a `u`).
3. **Deployment Constraints:** Like the scoring CNN, the HTR model must be lightweight, capable of running on a single-worker container without blowing up the memory budget, and testable without a local weights artifact.

---

## 2. Decision Drivers

- **Robustness against format:** The HTR step needs to read words effectively regardless of notebook guidelines.
- **Fairness to learners:** The target text verification must be forgiving of common cursive mistakes; it is a quality gate to prevent garbage submissions, not a spelling test.
- **Production Safety:** The model must load dynamically in production but fail safely to a deterministic stub mode in CI and local environments.

---

## 3. Considered Options & Architectural Decisions

### Decision 1: CTC HTR Model Integration

- **Chosen Approach:** We use a lightweight Connectionist Temporal Classification (CTC) HTR model for word-level text transcription. It is deployed as a module-level singleton in `backend/app/ml/htr.py`.
- **Implementation:** Similar to the CNN scoring backbone (ADR 0002), the `.keras` model artifact is downloaded from Supabase Storage on container startup. If `ENVIRONMENT=test` or no artifact path is provided in `dev`, it falls back to a deterministic stub mode that always validates the text as a match.
- **Rationale:** This keeps the memory footprint small, adheres to the single-worker constraint, and prevents large model files from blocking CI/CD pipelines or local development.

---

### Decision 2: Ruling Line Suppression via HSV color filtering

- **Chosen Approach:** Before thresholding, the word crop is converted to the HSV color space to detect blue and red ruling lines. We neutralize these colored pixels to the white background unless they intersect with dark stroke pixels. We supplement this with morphological structural line detection (extracting horizontal lines and subtracting vertical strokes to preserve character stems).
- **Rationale:** Standard OpenCV Otsu thresholding cannot distinguish between pencil lead and dark blue ink lines. Using color filtering + morphological operations cleans the crop effectively without destroying cursive loops.

---

### Decision 3: Image Preprocessing Pipeline (128x32)

- **Chosen Approach:** Preprocessing resizes the cleaned word crop to a fixed height of `32` while preserving the aspect ratio. It is then padded with a white background (`255`) to a fixed width of `128` and normalized to `[0, 1]`. 
- **Rationale:** Non-uniform scaling distorts slant angles and curvature. Padding to a strict 128x32 window preserves pen stroke proportions while conforming to the fixed input shape expected by the HTR sequence model.

---

### Decision 4: Cursive-Aware Levenshtein Verification

- **Chosen Approach:** We implemented a custom normalized Levenshtein similarity metric that incorporates a predefined set of `CURSIVE_CONFUSION_PAIRS` (e.g., `(a, e)`, `(n, u)`, `(r, v)`). Substitutions between these specific pairs incur a heavily reduced penalty (0.25 cost instead of 1.0).
- **Verification Logic:** The final verification score is a 50/50 blend of the global string similarity and the word-level average similarity. The submission passes if the combined score meets the threshold ($\ge 0.65$) and no individual word falls below the minimum word similarity ($\ge 0.60$).
- **Rationale:** Elementary students frequently produce loops that blur the lines between `a`/`e` or `l`/`t`. Heavily penalizing these common morphological similarities at the transcription stage would lead to frustrating false rejections before the CNN scoring even begins.

---

## 4. Consequences & Trade-offs

### Positive Consequences
- **Target Integrity:** The system successfully filters out inappropriate or off-topic submissions, ensuring the Phase 1 training data pairs teacher scores with the correct target words.
- **Forgiving Quality Gate:** The confusion-pair Levenshtein distance ensures that students are graded on their letter formation by the CNN, rather than being prematurely rejected by the HTR for minor loop ambiguities.
- **Zero-Friction Dev:** Stub mode prevents HTR from being a blocker in local development environments.

### Negative / Known Limitations
- **Processing Overhead:** HSV filtering and morphological ruling line suppression add latency to the CV pipeline before inference occurs.
- **Grayscale Scans:** The HSV line suppression strategy relies on colored ruling lines. Worksheets scanned strictly in grayscale will fall back to morphological line suppression, which can occasionally thin out genuine horizontal strokes (like the cross on a `t`).
