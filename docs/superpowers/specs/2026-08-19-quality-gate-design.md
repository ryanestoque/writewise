# Quality Gate (CV Pipeline Stage 1)

**Date:** 2026-08-19
**Status:** Approved (in-chat design review)
**Implements:** IMPLEMENTATION_STATUS.md Phase 1 → "Quality gate (blur/brightness/contrast/resolution)"
**Doc pointers:** CV_PIPELINE §2, ARCHITECTURE §8 step 2, API_SPEC §2.4/§3.3, TESTING §4.1, SECURITY §4

---

## 1. Problem

Submissions can now be uploaded and persisted. The next item in the CV pipeline dependency chain is the quality gate — a fast, cheap set of checks that rejects photos too poor to produce reliable measurements, before any expensive processing runs.

This matters beyond UX: Phase 1's entire purpose is collecting a clean paired dataset (raw measurements ↔ teacher scores) for the Spearman's Rho calibration study. A blurry or washed-out photo that limps through the pipeline doesn't just give one teacher a bad result — it pollutes the dataset the whole calibration depends on (ARCHITECTURE §8).

**Dependency chain:** Roster ✅ → Activities ✅ → Submission Upload ✅ → **Quality Gate** → Preprocessing → Guide-Line Detection → Segmentation → Feature Extraction → Pipeline Orchestrator

---

## 2. Scope

**This spec covers the quality gate only** — CV_PIPELINE §2. Four image-quality checks that run immediately after upload hardening and fail fast with a specific error if any check doesn't pass.

This is the first OpenCV module in the repo (`backend/app/cv/`). It also establishes the patterns all subsequent CV modules will follow: plain functions, specific exception types (not `HTTPException`), synthetic-image test fixtures, and the `tests/synthetic.py` shared generator module.

### Deliverables

1. **`backend/app/cv/quality_gate.py`** — four quality checks + `QualityGateRejection` exception + `QualityMetrics` dataclass
2. **`backend/tests/synthetic.py`** — shared synthetic image generators (reused by all future CV tests)
3. **`backend/tests/cv/test_quality_gate.py`** — synthetic-image unit tests per TESTING §4.1
4. **`backend/app/api/submissions.py`** modification — integrate quality gate call + rejection-persist logic
5. **`opencv-python-headless`** dependency added to `pyproject.toml`

### Explicitly out of scope

- Preprocessing, guide-line detection, segmentation, feature extraction — separate specs
- CNN inference — depends on model training (Between-Phases)
- Frontend handling of quality gate rejection errors — the upload dialog's error banner already displays `error.message` from any backend error; no frontend changes needed
- Threshold tuning — all thresholds are starting defaults (CV_PIPELINE §2 note), recalibrated once real Phase 1 photos flow

---

## 3. Quality Gate Module

### 3.1 New file: `backend/app/cv/quality_gate.py`

#### Exception type

```python
from dataclasses import dataclass

@dataclass
class QualityGateRejection(Exception):
    """Raised when an image fails a quality check."""
    code: str          # e.g. "QUALITY_GATE_BLUR"
    message: str       # Human-readable, for error.message
    measured_value: float
    threshold: float
```

**Why a custom exception, not `HTTPException`:** CV_PIPELINE §9 says each stage raises specific exception types, caught at the API layer and converted into the standard error envelope. This decouples the CV module from FastAPI — `quality_gate.py` is a pure image-processing module that knows nothing about HTTP, making it trivially unit-testable without importing FastAPI.

#### Return type

```python
@dataclass
class QualityMetrics:
    """Quality measurements from all four checks. Returned on pass."""
    blur_variance: float
    brightness_mean: float
    contrast_std: float
    resolution_short_side: int
```

Returned on success for logging/observability (ARCHITECTURE §15). Not persisted anywhere yet — later pipeline stages may want these metrics, but for now they're logged and discarded.

#### Public function

```python
def run_quality_gate(image_bytes: bytes) -> QualityMetrics:
    """
    Run all four quality checks on a hardened JPEG image.

    Checks run in order, fail-fast on first failure:
    1. Resolution (shortest side)
    2. Blur (Laplacian variance)
    3. Brightness (grayscale mean intensity)
    4. Contrast (grayscale intensity std dev)

    Returns QualityMetrics on success.
    Raises QualityGateRejection on failure.
    """
```

**Check order rationale:** Resolution is checked first because it's the cheapest (just read dimensions, no pixel-level math). If the image is too small, there's no point computing Laplacian variance or intensity stats. The remaining three checks all operate on the grayscale image, which is decoded once and shared.

#### The four checks (CV_PIPELINE §2)

| Check | Method | Reject if | Error code | Threshold |
|---|---|---|---|---|
| Resolution | Shorter side of image dimensions | < 1500px | `QUALITY_GATE_RESOLUTION` | 1500 |
| Blur | `cv2.Laplacian(gray, cv2.CV_64F).var()` | variance < 100 | `QUALITY_GATE_BLUR` | 100.0 |
| Brightness | `gray.mean()` | outside 50–200 (of 255) | `QUALITY_GATE_BRIGHTNESS` | 50–200 |
| Contrast | `gray.std()` | < 20 | `QUALITY_GATE_CONTRAST` | 20.0 |

All thresholds are module-level constants, clearly named and grouped at the top of the file for easy recalibration.

**Brightness has two failure modes:** too dark (mean < 50) and too bright (mean > 200). Both use the same error code (`QUALITY_GATE_BRIGHTNESS`) but with different messages ("too dark" vs. "overexposed"). The `measured_value` and `threshold` in the rejection tell the frontend which direction the failure went.

### 3.2 New file: `backend/app/cv/__init__.py`

Empty file — marks `app/cv/` as a Python package.

---

## 4. Synthetic Image Generators

### 4.1 New file: `backend/tests/synthetic.py`

Per TESTING §4.1: CV unit tests use synthetic, programmatically-generated images with known ground truth, generated at test-run time (not committed as fixture files). This module holds the shared generator functions used by `test_quality_gate.py` now and by all subsequent CV test modules later.

```python
# Public API for quality gate tests:

def make_sharp_worksheet(
    width: int = 2000,
    height: int = 2600,
) -> bytes:
    """
    Generate a synthetic worksheet image that passes all quality checks.
    White background with dark guide lines and simple shapes simulating writing.
    Returns JPEG bytes.
    """

def make_blurry_image(width: int = 2000, height: int = 2600) -> bytes:
    """Generate an image with Laplacian variance below the blur threshold."""

def make_dark_image(width: int = 2000, height: int = 2600) -> bytes:
    """Generate an image with mean brightness below 50."""

def make_bright_image(width: int = 2000, height: int = 2600) -> bytes:
    """Generate an image with mean brightness above 200."""

def make_low_contrast_image(width: int = 2000, height: int = 2600) -> bytes:
    """Generate an image with intensity std dev below 20."""

def make_small_image(width: int = 800, height: int = 600) -> bytes:
    """Generate a valid-quality image whose shorter side is below 1500px."""
```

**Implementation approach:** These use OpenCV (and/or numpy) directly — create a numpy array with known pixel values, optionally apply `cv2.GaussianBlur` for the blurry variant, then encode to JPEG bytes with `cv2.imencode`. No Pillow dependency in the test helpers — keeps them in the same "language" as the code under test.

The generators will be expanded as later CV test modules need more specialized fixtures (e.g. images with known guide-line positions for `test_guide_lines.py`, known word layouts for `test_segmentation.py`).

---

## 5. Integration into Submission Endpoint

### 5.1 Modify: `backend/app/api/submissions.py`

The quality gate runs **synchronously inside `create_submission`**, immediately after image hardening (current step 5) and before the Storage upload (current step 8).

**New flow (changes in bold):**

1–5. *(existing)* UUID validation, file size check, activity/teacher ownership check, roster check, image hardening
6. **Run quality gate: `run_quality_gate(hardened_bytes)`**
   - **On `QualityGateRejection`:** don't stop — continue to Storage upload and DB insert, but with rejection data:
     - Upload the hardened image to Storage (the rejected image is still persisted for later analysis — ARCHITECTURE §8)
     - Insert submission row with `status = 'rejected'`, `rejection_code = exc.code`, `rejection_details = str(exc.message)`
     - Return `422` with the standard error envelope including `submission_id`, `measured_value`, and `threshold` in `error.details` (matching API_SPEC §3.3's rejection response shape)
   - **On success:** continue with existing flow (Storage upload, DB insert with `status = 'processing'`, return `201`)

**Error response shape** (matching API_SPEC §3.3 exactly):

```json
{
  "error": {
    "code": "QUALITY_GATE_BLUR",
    "message": "This photo is too blurry to analyze. Hold the camera steady and try again.",
    "details": {
      "submission_id": "44444444-...",
      "measured_value": 42.1,
      "threshold": 100
    }
  }
}
```

**Why `422`, not `400`:** `400` means the request was malformed (bad file type, too big) — the hardening checks already cover that. `422` means the request was valid but the content couldn't be processed (blurry photo). This distinction is already established in API_SPEC §2.4's error code catalog.

### 5.2 Error conversion pattern

The `QualityGateRejection` → HTTP response conversion happens inline in the `create_submission` handler (try/except around the `run_quality_gate` call), not as a global exception handler. Rationale: the rejection flow needs to do Storage upload + DB insert before returning the error — this is submission-specific business logic, not generic error formatting.

---

## 6. Frontend Impact

**None.** The upload dialog's error handling already branches on `error.code` and displays `error.message` in an inline error banner. Quality gate rejections will surface naturally through this existing path — the teacher sees "This photo is too blurry to analyze. Hold the camera steady and try again." with a "Try Again" button.

The submission card grid on the activity detail page already handles `status = 'rejected'` with a red badge. Rejected submissions from quality gate failures will appear with the "Rejected" badge.

---

## 7. Testing

### 7.1 Unit tests: `backend/tests/cv/test_quality_gate.py`

Per TESTING §4.1's ground-truth-asserting approach — each test generates a synthetic image with known properties and asserts the quality gate produces the expected result:

| Test | Input | Expected |
|---|---|---|
| Sharp, well-lit, adequate resolution | `make_sharp_worksheet()` | Pass, returns `QualityMetrics` |
| Blurry image | `make_blurry_image()` | `QualityGateRejection`, code `QUALITY_GATE_BLUR` |
| Too dark | `make_dark_image()` | `QualityGateRejection`, code `QUALITY_GATE_BRIGHTNESS` |
| Too bright | `make_bright_image()` | `QualityGateRejection`, code `QUALITY_GATE_BRIGHTNESS` |
| Low contrast | `make_low_contrast_image()` | `QualityGateRejection`, code `QUALITY_GATE_CONTRAST` |
| Too small resolution | `make_small_image()` | `QualityGateRejection`, code `QUALITY_GATE_RESOLUTION` |
| Fail-fast ordering | Blurry + dark + small | Rejects on first failure (resolution, since it's checked first) |

### 7.2 Endpoint integration test additions: `backend/tests/api/test_submissions.py`

Add test cases matching TESTING §5's integration test table:

| Test | Input | Expected |
|---|---|---|
| Blurry image upload | `make_blurry_image()` as upload | `422`, `error.code = QUALITY_GATE_BLUR`, `error.details.submission_id` present |
| Verify rejected submission persisted | After blurry upload | `submission` row exists with `status = 'rejected'`, `rejection_code = 'QUALITY_GATE_BLUR'` |
| Verify rejected image in Storage | After blurry upload | Image file exists at `{student_id}/{submission_id}.jpg` in Storage |

### 7.3 Verification commands

- Backend lint: `uv run ruff check .`
- Backend tests: `uv run pytest tests/cv/test_quality_gate.py tests/api/test_submissions.py -v`
- Full backend suite: `uv run pytest -v` (ensure existing tests unaffected)

---

## 8. Files Summary

| Layer | File | Action | Description |
|-------|------|--------|-------------|
| Backend | `app/cv/__init__.py` | NEW | Package marker |
| Backend | `app/cv/quality_gate.py` | NEW | Four quality checks, `QualityGateRejection`, `QualityMetrics` |
| Backend | `tests/synthetic.py` | NEW | Shared synthetic image generators for all CV tests |
| Backend | `tests/cv/__init__.py` | NEW | Package marker |
| Backend | `tests/cv/test_quality_gate.py` | NEW | Unit tests with synthetic images |
| Backend | `tests/api/test_submissions.py` | MODIFY | Add quality gate rejection integration tests |
| Backend | `app/api/submissions.py` | MODIFY | Integrate quality gate call + rejection-persist logic |
| Backend | `pyproject.toml` | MODIFY | Add `opencv-python-headless` dependency |
