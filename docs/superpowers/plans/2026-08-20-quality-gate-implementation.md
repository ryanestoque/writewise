# Quality Gate (CV Pipeline Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the CV pipeline's quality gate stage — four fast, cheap image-quality checks (resolution, blur, brightness, contrast) that run synchronously inside submission upload, rejecting photos too poor to produce reliable measurements before any expensive CV/CNN processing runs.

**Architecture:** A pure image-processing module (`backend/app/cv/quality_gate.py`) with zero FastAPI dependency runs four checks in cheap-to-expensive order (resolution → blur → brightness → contrast) against a once-decoded grayscale image, fail-fasting on the first failing check by raising a custom `QualityGateRejection` exception. `create_submission` catches that exception inline: the rejected image is still uploaded to Storage and a `status='rejected'` row is still inserted (not discarded — this protects the Phase 1 calibration dataset and feeds later usability analysis), then a `422` is returned in the standard error envelope. The success path is unaffected and continues to the existing Storage/DB flow.

**Tech Stack:** Python 3.13, FastAPI, opencv-python-headless, numpy, pytest, uv, ruff

**Spec:** the attached quality-gate design doc, dated 2026-08-19 (place at `docs/specs/2026-08-19-quality-gate-design.md` in-repo if you keep dated specs there — adjust path to match your actual docs convention). This plan argues from that spec; executors should read both.

## Global Constraints

- opencv-python-headless (not opencv-python) — Railway container is headless, no GUI deps needed
- All four thresholds are module-level constants, clearly named and grouped at the top of `quality_gate.py`, documented as tunable Phase-1-recalibration values (not locked)
- Checks run in this fixed order and fail-fast on the first failure: resolution → blur → brightness → contrast
- Resolution: shorter side of image dimensions < 1500px rejects → code `QUALITY_GATE_RESOLUTION`
- Blur: `cv2.Laplacian(gray, cv2.CV_64F).var()` < 100.0 rejects → code `QUALITY_GATE_BLUR`
- Brightness: `gray.mean()` outside 50–200 (of 255) rejects → code `QUALITY_GATE_BRIGHTNESS` for both directions (different message for "too dark" vs. "overexposed")
- Contrast: `gray.std()` < 20.0 rejects → code `QUALITY_GATE_CONTRAST`
- `QualityGateRejection` is a plain `@dataclass`-decorated `Exception` subclass — never `HTTPException`; `quality_gate.py` never imports FastAPI, so it stays trivially unit-testable in isolation
- Error response shape (matches API_SPEC §3.3 exactly): `{"error": {"code": ..., "message": ..., "details": {"submission_id": ..., "measured_value": ..., "threshold": ...}}}`
- Rejected submissions are HTTP `422` (not `400` — the request was valid, the content just couldn't be processed)
- Synthetic, programmatically-generated test images only — no committed fixture files, generated at test-run time (TESTING §4.1)
- Verification commands: `uv run ruff check .` · `uv run pytest tests/cv/test_quality_gate.py tests/api/test_submissions.py -v` · full suite `uv run pytest -v`

## Plan Status

- **Task 1 — Synthetic Image Generators:** done.
- **Task 2 — Quality Gate Core Module:** done. Every generator/check pairing in this plan has been numerically verified end-to-end (not just reasoned about) — see the note at the end of Task 2.
- **Task 3 — Submission Endpoint Integration:** **unblocked and done 2026-08-20** — the section below was filled in with exact line anchors and helper names from the real files, plus three extra discoveries (existing success-path tests needed bigger images, schema already had the rejection columns, 422 constant name).

---

### Task 1: Synthetic Image Generators

**Files:**
- Modify: `backend/pyproject.toml` (add `opencv-python-headless` dependency)
- Create: `backend/tests/synthetic.py`
- Test: `backend/tests/test_synthetic.py`

**Interfaces:**
- Produces: six functions in `tests/synthetic.py`, all `(width: int = <default>, height: int = <default>) -> bytes` returning JPEG-encoded bytes:
  - `make_sharp_worksheet(width=2000, height=2600)` — passes all four checks
  - `make_blurry_image(width=2000, height=2600)` — fails blur only
  - `make_dark_image(width=2000, height=2600)` — fails brightness only (too dark)
  - `make_bright_image(width=2000, height=2600)` — fails brightness only (overexposed)
  - `make_low_contrast_image(width=2000, height=2600)` — fails contrast only
  - `make_small_image(width=800, height=600)` — fails resolution only, otherwise valid quality
  - Task 2 imports all six of these directly: `from tests.synthetic import make_sharp_worksheet, make_blurry_image, make_dark_image, make_bright_image, make_low_contrast_image, make_small_image`

- [ ] **Step 1: Add the opencv-python-headless dependency**

```bash
cd backend
uv add opencv-python-headless
```

Run: `uv run python -c "import cv2, numpy; print(cv2.__version__)"`
Expected: prints a version string with no `ModuleNotFoundError`

- [ ] **Step 2: Write the failing sanity tests for the generators**

These assert each generator's raw, JPEG-round-tripped pixel properties directly via `cv2` — independent of `quality_gate.py` (which doesn't exist yet) — so this task is testable on its own. Margins are set well inside the actual measured values (not flush against the thresholds) so minor OpenCV/JPEG-encoder version differences across machines don't cause flakiness.

Create `backend/tests/test_synthetic.py`:

```python
import cv2
import numpy as np

from tests.synthetic import (
    make_sharp_worksheet,
    make_blurry_image,
    make_dark_image,
    make_bright_image,
    make_low_contrast_image,
    make_small_image,
)


def _decode_gray(jpeg_bytes: bytes) -> np.ndarray:
    array = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def test_sharp_worksheet_passes_all_quality_properties():
    gray = _decode_gray(make_sharp_worksheet())
    assert min(gray.shape) >= 1500
    assert cv2.Laplacian(gray, cv2.CV_64F).var() >= 150
    assert 100 <= gray.mean() <= 195
    assert gray.std() >= 25


def test_blurry_image_has_low_blur_variance():
    gray = _decode_gray(make_blurry_image())
    assert cv2.Laplacian(gray, cv2.CV_64F).var() < 50


def test_dark_image_isolates_brightness_failure():
    gray = _decode_gray(make_dark_image())
    assert gray.mean() < 45
    assert cv2.Laplacian(gray, cv2.CV_64F).var() >= 100  # must still clear blur


def test_bright_image_isolates_brightness_failure():
    gray = _decode_gray(make_bright_image())
    assert gray.mean() > 205
    assert cv2.Laplacian(gray, cv2.CV_64F).var() >= 100  # must still clear blur


def test_low_contrast_image_isolates_contrast_failure():
    gray = _decode_gray(make_low_contrast_image())
    assert gray.std() < 15
    assert cv2.Laplacian(gray, cv2.CV_64F).var() >= 100  # must still clear blur
    assert 50 <= gray.mean() <= 200  # must still clear brightness


def test_small_image_isolates_resolution_failure():
    gray = _decode_gray(make_small_image())
    assert min(gray.shape) < 1500
    assert cv2.Laplacian(gray, cv2.CV_64F).var() >= 100
    assert 50 <= gray.mean() <= 200
    assert gray.std() >= 20
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/test_synthetic.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'tests.synthetic'`

- [ ] **Step 4: Implement the synthetic image generators**

Create `backend/tests/synthetic.py`:

```python
"""Synthetic, programmatically-generated test images with known ground truth.

Shared by all CV pipeline test modules (TESTING §4.1). No fixture files are
committed — every image is generated at test-run time.
"""

import cv2
import numpy as np

# Tuned so each generator's JPEG-encoded output sits clearly on the correct
# side of quality_gate.py's thresholds (RESOLUTION_MIN_SHORT_SIDE=1500,
# BLUR_VARIANCE_MIN=100.0, BRIGHTNESS range 50-200, CONTRAST_STD_MIN=20.0).
_SHARP_BG = 190
_SHARP_INK = 30
_DARK_BG = 20
_DARK_INK = 255
_BRIGHT_BG = 240
_BRIGHT_INK = 0
_LOW_CONTRAST_BG = 140
_LOW_CONTRAST_INK = 125
_LOW_CONTRAST_CELL = 6  # checkerboard cell size in px


def _base_worksheet(width, height, bg_value, ink_value, n_lines=8, rng_seed=42, density=15000):
    """White-ish background with printed guide lines + scattered dark
    rectangles simulating writing. `density` controls stroke count
    (n_strokes = area / density) — lower density means more, smaller strokes.
    """
    rng = np.random.default_rng(rng_seed)
    img = np.full((height, width), bg_value, dtype=np.uint8)

    line_gap = height // (n_lines + 1)
    for i in range(1, n_lines + 1):
        y = i * line_gap
        cv2.line(img, (0, y), (width, y), int(bg_value * 0.85), thickness=2)

    n_strokes = max(20, (width * height) // density)
    for _ in range(n_strokes):
        y_line = rng.integers(1, n_lines + 1) * line_gap
        x = rng.integers(0, max(1, width - 60))
        w = rng.integers(15, 45)
        h = rng.integers(20, 55)
        y = max(0, y_line - h)
        cv2.rectangle(img, (x, y), (x + w, y_line), ink_value, thickness=-1)

    return img


def make_sharp_worksheet(width: int = 2000, height: int = 2600) -> bytes:
    """
    Generate a synthetic worksheet image that passes all quality checks.
    White background with dark guide lines and simple shapes simulating
    writing. Returns JPEG bytes.
    """
    img = _base_worksheet(width, height, bg_value=_SHARP_BG, ink_value=_SHARP_INK)
    ok, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_blurry_image(width: int = 2000, height: int = 2600) -> bytes:
    """Generate an image with Laplacian variance below the blur threshold."""
    img = _base_worksheet(width, height, bg_value=_SHARP_BG, ink_value=_SHARP_INK)
    img = cv2.GaussianBlur(img, (61, 61), 20)
    ok, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_dark_image(width: int = 2000, height: int = 2600) -> bytes:
    """Generate an image with mean brightness below 50."""
    img = _base_worksheet(width, height, bg_value=_DARK_BG, ink_value=_DARK_INK)
    ok, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_bright_image(width: int = 2000, height: int = 2600) -> bytes:
    """Generate an image with mean brightness above 200."""
    img = _base_worksheet(width, height, bg_value=_BRIGHT_BG, ink_value=_BRIGHT_INK)
    ok, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_low_contrast_image(width: int = 2000, height: int = 2600) -> bytes:
    """
    Generate an image with intensity std dev below 20.

    Uses a fine checkerboard (every pixel borders an edge, so Laplacian
    variance stays high) between two close gray values (so population std
    stays low) — this is what makes it fail contrast specifically, without
    also tripping the blur check first.
    """
    img = np.full((height, width), _LOW_CONTRAST_BG, dtype=np.uint8)
    yy, xx = np.mgrid[0:height, 0:width]
    checker = ((xx // _LOW_CONTRAST_CELL) + (yy // _LOW_CONTRAST_CELL)) % 2 == 0
    img[checker] = _LOW_CONTRAST_INK
    ok, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_small_image(width: int = 800, height: int = 600) -> bytes:
    """Generate a valid-quality image whose shorter side is below 1500px."""
    img = _base_worksheet(width, height, bg_value=_SHARP_BG, ink_value=_SHARP_INK)
    ok, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_synthetic.py -v`
Expected: 6 passed

- [ ] **Step 6: Lint check**

Run: `uv run ruff check .`
Expected: no errors (if ruff flags the unused `ok` variable from `cv2.imencode`, rename it `_` in each function)

- [ ] **Step 7: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/tests/synthetic.py backend/tests/test_synthetic.py
git commit -m "test: add synthetic image generators for CV pipeline tests"
```

---

### Task 2: Quality Gate Core Module

**Files:**
- Create: `backend/app/cv/__init__.py`
- Create: `backend/app/cv/quality_gate.py`
- Create: `backend/tests/cv/__init__.py`
- Test: `backend/tests/cv/test_quality_gate.py`

**Interfaces:**
- Consumes: the six generator functions from Task 1 (`tests.synthetic`)
- Produces (all importable from `app.cv.quality_gate`), consumed by Task 3:
  - `run_quality_gate(image_bytes: bytes) -> QualityMetrics`
  - `QualityGateRejection` — `Exception` subclass with fields `code: str`, `message: str`, `measured_value: float`, `threshold: float`
  - `QualityMetrics` — dataclass with fields `blur_variance: float`, `brightness_mean: float`, `contrast_std: float`, `resolution_short_side: int`

- [ ] **Step 1: Create package markers**

```bash
mkdir -p backend/app/cv backend/tests/cv
touch backend/app/cv/__init__.py backend/tests/cv/__init__.py
```

- [ ] **Step 2: Write the failing test for the exception and metrics dataclasses**

Create `backend/tests/cv/test_quality_gate.py`:

```python
import pytest

from app.cv.quality_gate import QualityGateRejection, QualityMetrics


def test_quality_gate_rejection_carries_fields():
    exc = QualityGateRejection(
        code="QUALITY_GATE_BLUR",
        message="too blurry",
        measured_value=42.1,
        threshold=100.0,
    )
    assert exc.code == "QUALITY_GATE_BLUR"
    assert exc.message == "too blurry"
    assert exc.measured_value == 42.1
    assert exc.threshold == 100.0
    with pytest.raises(QualityGateRejection):
        raise exc


def test_quality_metrics_carries_fields():
    metrics = QualityMetrics(
        blur_variance=300.0,
        brightness_mean=150.0,
        contrast_std=35.0,
        resolution_short_side=2000,
    )
    assert metrics.blur_variance == 300.0
    assert metrics.resolution_short_side == 2000
```

- [ ] **Step 3: Run test to verify it fails**

Run: `uv run pytest tests/cv/test_quality_gate.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.cv.quality_gate'`

- [ ] **Step 4: Implement the dataclasses**

Create `backend/app/cv/quality_gate.py`:

```python
"""Quality gate: fast, cheap image-quality checks that run before any
expensive CV/CNN processing (CV_PIPELINE §2).
"""

from dataclasses import dataclass

import cv2
import numpy as np

# Tunable thresholds — starting defaults per CV_PIPELINE §2 note, to be
# recalibrated once real Phase 1 photos flow.
RESOLUTION_MIN_SHORT_SIDE = 1500
BLUR_VARIANCE_MIN = 100.0
BRIGHTNESS_MIN = 50
BRIGHTNESS_MAX = 200
CONTRAST_STD_MIN = 20.0


@dataclass
class QualityGateRejection(Exception):
    """Raised when an image fails a quality check."""

    code: str
    message: str
    measured_value: float
    threshold: float


@dataclass
class QualityMetrics:
    """Quality measurements from all four checks. Returned on pass."""

    blur_variance: float
    brightness_mean: float
    contrast_std: float
    resolution_short_side: int
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/cv/test_quality_gate.py -v`
Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/cv/__init__.py backend/tests/cv/__init__.py backend/app/cv/quality_gate.py backend/tests/cv/test_quality_gate.py
git commit -m "feat: add QualityGateRejection and QualityMetrics dataclasses"
```

- [ ] **Step 7: Write the failing test for the resolution check**

Append to `backend/tests/cv/test_quality_gate.py`:

```python
from tests.synthetic import make_sharp_worksheet, make_small_image


def test_small_image_rejected_on_resolution():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_small_image())
    assert exc_info.value.code == "QUALITY_GATE_RESOLUTION"
    assert exc_info.value.measured_value == 600.0
    assert exc_info.value.threshold == 1500.0


def test_sharp_worksheet_passes_resolution():
    # Full end-to-end pass is tested once all four checks exist (Step 19).
    # For now this only exercises resolution, so call the private helper
    # directly rather than the not-yet-complete run_quality_gate.
    from app.cv.quality_gate import _check_resolution
    import cv2
    import numpy as np

    array = np.frombuffer(make_sharp_worksheet(), dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    assert _check_resolution(image) == 2000
```

Add the import at the top of the test file: `from app.cv.quality_gate import run_quality_gate` (alongside the existing `QualityGateRejection, QualityMetrics` import).

- [ ] **Step 8: Run tests to verify they fail**

Run: `uv run pytest tests/cv/test_quality_gate.py -v`
Expected: FAIL — `run_quality_gate` and `_check_resolution` don't exist yet

- [ ] **Step 9: Implement the resolution check**

Append to `backend/app/cv/quality_gate.py`:

```python
def _check_resolution(image: np.ndarray) -> int:
    height, width = image.shape[:2]
    short_side = min(width, height)
    if short_side < RESOLUTION_MIN_SHORT_SIDE:
        raise QualityGateRejection(
            code="QUALITY_GATE_RESOLUTION",
            message="This photo's resolution is too low to analyze. "
            "Move closer or use a higher-resolution camera.",
            measured_value=float(short_side),
            threshold=float(RESOLUTION_MIN_SHORT_SIDE),
        )
    return short_side


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
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)

    short_side = _check_resolution(image)

    # remaining checks added in later steps
    raise NotImplementedError("blur/brightness/contrast checks not yet implemented")
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `uv run pytest tests/cv/test_quality_gate.py -v`
Expected: 4 passed (the two from Step 2 plus the two from Step 7)

- [ ] **Step 11: Commit**

```bash
git add backend/app/cv/quality_gate.py backend/tests/cv/test_quality_gate.py
git commit -m "feat: add resolution check to quality gate"
```

- [ ] **Step 12: Write the failing test for the blur check**

Append to `backend/tests/cv/test_quality_gate.py`:

```python
from tests.synthetic import make_blurry_image


def test_blurry_image_rejected_on_blur():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_blurry_image())
    assert exc_info.value.code == "QUALITY_GATE_BLUR"
```

- [ ] **Step 13: Run test to verify it fails**

Run: `uv run pytest tests/cv/test_quality_gate.py::test_blurry_image_rejected_on_blur -v`
Expected: FAIL — raises `NotImplementedError`, not `QualityGateRejection`

- [ ] **Step 14: Implement the blur check and wire it into the orchestrator**

In `backend/app/cv/quality_gate.py`, add `_check_blur` above `run_quality_gate`:

```python
def _check_blur(gray: np.ndarray) -> float:
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    if variance < BLUR_VARIANCE_MIN:
        raise QualityGateRejection(
            code="QUALITY_GATE_BLUR",
            message="This photo is too blurry to analyze. "
            "Hold the camera steady and try again.",
            measured_value=float(variance),
            threshold=float(BLUR_VARIANCE_MIN),
        )
    return float(variance)
```

Replace the body of `run_quality_gate` (the `NotImplementedError` line and the comment above it) with:

```python
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur_variance = _check_blur(gray)

    # remaining checks added in later steps
    raise NotImplementedError("brightness/contrast checks not yet implemented")
```

- [ ] **Step 15: Run tests to verify they pass**

Run: `uv run pytest tests/cv/test_quality_gate.py -v`
Expected: 5 passed

- [ ] **Step 16: Commit**

```bash
git add backend/app/cv/quality_gate.py backend/tests/cv/test_quality_gate.py
git commit -m "feat: add blur check to quality gate"
```

- [ ] **Step 17: Write the failing tests for the brightness check**

Append to `backend/tests/cv/test_quality_gate.py`:

```python
from tests.synthetic import make_dark_image, make_bright_image


def test_dark_image_rejected_on_brightness():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_dark_image())
    assert exc_info.value.code == "QUALITY_GATE_BRIGHTNESS"
    assert exc_info.value.threshold == 50.0


def test_bright_image_rejected_on_brightness():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_bright_image())
    assert exc_info.value.code == "QUALITY_GATE_BRIGHTNESS"
    assert exc_info.value.threshold == 200.0
```

- [ ] **Step 18: Run tests to verify they fail**

Run: `uv run pytest tests/cv/test_quality_gate.py::test_dark_image_rejected_on_brightness tests/cv/test_quality_gate.py::test_bright_image_rejected_on_brightness -v`
Expected: FAIL — both raise `NotImplementedError`

- [ ] **Step 19: Implement the brightness check and wire it in**

In `backend/app/cv/quality_gate.py`, add `_check_brightness` above `run_quality_gate`:

```python
def _check_brightness(gray: np.ndarray) -> float:
    mean = gray.mean()
    if mean < BRIGHTNESS_MIN:
        raise QualityGateRejection(
            code="QUALITY_GATE_BRIGHTNESS",
            message="This photo is too dark to analyze. "
            "Retake it in better lighting.",
            measured_value=float(mean),
            threshold=float(BRIGHTNESS_MIN),
        )
    if mean > BRIGHTNESS_MAX:
        raise QualityGateRejection(
            code="QUALITY_GATE_BRIGHTNESS",
            message="This photo is overexposed to analyze. "
            "Retake it with less direct light or flash.",
            measured_value=float(mean),
            threshold=float(BRIGHTNESS_MAX),
        )
    return float(mean)
```

Replace the `NotImplementedError` line and its comment in `run_quality_gate` with:

```python
    brightness_mean = _check_brightness(gray)

    # contrast check added in next step
    raise NotImplementedError("contrast check not yet implemented")
```

- [ ] **Step 20: Run tests to verify they pass**

Run: `uv run pytest tests/cv/test_quality_gate.py -v`
Expected: 7 passed

- [ ] **Step 21: Commit**

```bash
git add backend/app/cv/quality_gate.py backend/tests/cv/test_quality_gate.py
git commit -m "feat: add brightness check to quality gate"
```

- [ ] **Step 22: Write the failing test for the contrast check**

Append to `backend/tests/cv/test_quality_gate.py`:

```python
from tests.synthetic import make_low_contrast_image


def test_low_contrast_image_rejected_on_contrast():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_low_contrast_image())
    assert exc_info.value.code == "QUALITY_GATE_CONTRAST"
```

- [ ] **Step 23: Run test to verify it fails**

Run: `uv run pytest tests/cv/test_quality_gate.py::test_low_contrast_image_rejected_on_contrast -v`
Expected: FAIL — raises `NotImplementedError`

- [ ] **Step 24: Implement the contrast check, complete the orchestrator**

In `backend/app/cv/quality_gate.py`, add `_check_contrast` above `run_quality_gate`:

```python
def _check_contrast(gray: np.ndarray) -> float:
    std = gray.std()
    if std < CONTRAST_STD_MIN:
        raise QualityGateRejection(
            code="QUALITY_GATE_CONTRAST",
            message="This photo doesn't have enough contrast to analyze. "
            "Retake it against a plain, well-lit background.",
            measured_value=float(std),
            threshold=float(CONTRAST_STD_MIN),
        )
    return float(std)
```

Replace the `NotImplementedError` line and its comment in `run_quality_gate` with the final return:

```python
    contrast_std = _check_contrast(gray)

    return QualityMetrics(
        blur_variance=blur_variance,
        brightness_mean=brightness_mean,
        contrast_std=contrast_std,
        resolution_short_side=short_side,
    )
```

`run_quality_gate` should now read top to bottom as: decode → `_check_resolution` → convert to grayscale → `_check_blur` → `_check_brightness` → `_check_contrast` → return `QualityMetrics`.

- [ ] **Step 25: Run tests to verify they pass**

Run: `uv run pytest tests/cv/test_quality_gate.py -v`
Expected: 9 passed

- [ ] **Step 26: Write the remaining spec test-table cases — full pass and fail-fast ordering**

Append to `backend/tests/cv/test_quality_gate.py`:

```python
from app.cv.quality_gate import QualityMetrics
from tests.synthetic import make_sharp_worksheet


def test_sharp_worksheet_passes_end_to_end():
    result = run_quality_gate(make_sharp_worksheet())
    assert isinstance(result, QualityMetrics)
    assert result.resolution_short_side >= 1500
    assert result.blur_variance >= 100.0
    assert 50 <= result.brightness_mean <= 200
    assert result.contrast_std >= 20.0


def test_fail_fast_checks_resolution_first():
    # Combine multiple failure modes (small + dark + blurred); resolution
    # is checked first, so that must be the reported failure regardless
    # of what else is wrong with the image.
    import cv2
    import numpy as np

    array = np.frombuffer(make_small_image(), dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    darkened = np.clip(gray.astype(int) - 100, 0, 255).astype("uint8")
    blurred = cv2.GaussianBlur(darkened, (31, 31), 15)
    ok, buf = cv2.imencode(".jpg", blurred)

    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(buf.tobytes())
    assert exc_info.value.code == "QUALITY_GATE_RESOLUTION"
```

- [ ] **Step 27: Run the full test file and lint**

Run: `uv run pytest tests/cv/test_quality_gate.py -v && uv run ruff check .`
Expected: 11 passed, no lint errors

- [ ] **Step 28: Commit**

```bash
git add backend/app/cv/quality_gate.py backend/tests/cv/test_quality_gate.py
git commit -m "feat: add contrast check, complete quality gate orchestrator"
```

> **Verification note:** every generator/check pairing in this task (sharp worksheet passes; blurry → `QUALITY_GATE_BLUR`; dark/bright → `QUALITY_GATE_BRIGHTNESS`; low-contrast → `QUALITY_GATE_CONTRAST`; small → `QUALITY_GATE_RESOLUTION`; the combined small+dark+blurry case → `QUALITY_GATE_RESOLUTION` on fail-fast ordering) was run end-to-end against this exact code before this plan was written, confirming the isolation each generator is designed for actually holds — none of it is guessed.

---

### Task 3: Submission Endpoint Integration

> **Unblocked 2026-08-20** with the actual contents of `backend/app/api/submissions.py` and `backend/tests/api/test_submissions.py` in hand. Line anchors below reference the file exactly as it read when the plan was written: hardening ends at line 91 (`hardened_bytes = validate_and_harden_image(file_bytes)`), the Storage upload is lines 101-116, and the DB insert (status `'processing'`) is lines 118-133.

**Files:**
- Modify: `backend/app/api/submissions.py` — insert quality gate between step 5 (hardening) and the Upload & Persist section
- Modify: `backend/tests/api/test_submissions.py` — update two existing success-path tests + add three rejection tests
- Modify: `docs/superpowers/plans/2026-08-20-quality-gate-implementation.md` — this section itself (already done)

**Context discovered while unblocking (verified against the repo):**

1. **Existing success-path tests will break** unless updated: `test_successful_upload` posts a 100×100 JPEG and `test_png_upload_converts_to_jpeg` posts a 50×50 PNG — both would now return `422 QUALITY_GATE_RESOLUTION` instead of `201`. They must switch to a quality-gate-passing image. Step 1 below handles this.
2. **Schema needs no migration:** `submission.rejection_code text` and `submission.rejection_details jsonb` already exist (migration `0005_submission.sql`). `rejection_details` is `jsonb`, so a plain message string is stored as a JSON string value — matching the spec's `str(exc.message)`.
3. **`rejection_details` insert value:** spec §5.1 says `rejection_details = str(exc.message)` — pass `rejection.message` directly; supabase-py serializes the string as a valid JSON value.
4. **422 constant:** use `status.HTTP_422_UNPROCESSABLE_CONTENT` (the non-deprecated name in current starlette; `HTTP_422_UNPROCESSABLE_ENTITY` warns).
5. **Error envelope conversion:** `app/main.py`'s `http_exception_handler` wraps any `HTTPException` whose `detail` dict contains `"code"` into `{"error": detail}` — so raise `HTTPException(status_code=422, detail={...})` with the rejection fields and it comes out shaped exactly per API_SPEC §3.3.

- [ ] **Step 1: Update the two existing success-path tests to pass the quality gate**

In `backend/tests/api/test_submissions.py`:

1. Replace the `PIL`-based 100×100 helper with the shared synthetic generators (keep `_make_test_jpeg` for the file-type/large-file tests that never reach the gate, or delete it if unused after the edits — check with `ruff`/`grep`):
   - `test_successful_upload`: post `make_sharp_worksheet()` instead of `_make_test_jpeg()`.
   - `test_png_upload_converts_to_jpeg`: build a passing PNG by decoding `make_sharp_worksheet()` and re-encoding via `cv2.imencode(".png", ...)` (PNG is lossless, so the pixels — and thus gate results — are identical to the passing JPEG).

- [ ] **Step 2: Run the file to confirm the two updated tests pass**

Run: `uv run pytest tests/api/test_submissions.py::TestCreateSubmission::test_successful_upload tests/api/test_submissions.py::TestCreateSubmission::test_png_upload_converts_to_jpeg -v`
Expected: 2 passed. (Requires `backend/.env` pointing at the hosted `writewise-dev` project — same as the existing suite.)

- [ ] **Step 3: Write the failing rejection-flow tests**

Append to `backend/tests/api/test_submissions.py` (per spec §7.2 — three cases):

```python
from tests.synthetic import make_blurry_image, make_sharp_worksheet


def test_blurry_upload_rejected_with_422(self, client, test_activity, test_student):
    response = client.post(
        "/api/submissions",
        data={
            "activity_id": test_activity["id"],
            "student_id": test_student["id"],
        },
        files={"image": ("blurry.jpg", io.BytesIO(make_blurry_image()), "image/jpeg")},
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "QUALITY_GATE_BLUR"
    assert "submission_id" in error["details"]
    assert "measured_value" in error["details"]
    assert "threshold" in error["details"]
    return error["details"]["submission_id"]  # consumed by the next two tests


def test_rejected_submission_persisted(
    self, client, test_activity, test_student, cleanup_submissions
):
    response = client.post(...)  # same blurry upload
    submission_id = response.json()["error"]["details"]["submission_id"]
    cleanup_submissions.append({"id": submission_id, "image_path": f"{test_student['id']}/{submission_id}.jpg"})
    db_res = (
        supabase_client.table("submission")
        .select("*")
        .eq("id", submission_id)
        .execute()
    )
    assert len(db_res.data) == 1
    assert db_res.data[0]["status"] == "rejected"
    assert db_res.data[0]["rejection_code"] == "QUALITY_GATE_BLUR"


def test_rejected_image_persisted_in_storage(
    self, client, test_activity, test_student, cleanup_submissions
):
    response = client.post(...)  # same blurry upload
    submission_id = response.json()["error"]["details"]["submission_id"]
    cleanup_submissions.append({"id": submission_id, "image_path": f"{test_student['id']}/{submission_id}.jpg"})
    image_path = f"{test_student['id']}/{submission_id}.jpg"
    file_bytes = supabase_client.storage.from_("submission-images").download(image_path)
    assert file_bytes  # non-empty = file exists
```

Implementation note: the three tests re-post the blurry image independently (fixtures give each a fresh activity/student pair) rather than sharing one upload via a fixture — matches the existing test file's style. Import `io` already exists in the file; add `from tests.synthetic import make_blurry_image` and use the existing `make_sharp_worksheet` import for Steps 1.

- [ ] **Step 4: Run tests to verify they fail**

Run: `uv run pytest tests/api/test_submissions.py -v`
Expected: the three new tests FAIL (server still returns `201` + `status='processing'`, no `rejection_code`), the two updated ones pass, and the rest stay green.

- [ ] **Step 5: Integrate the quality gate into `create_submission`**

In `backend/app/api/submissions.py`:

1. Add the import at the top:
```python
from app.cv.quality_gate import QualityGateRejection, run_quality_gate
```

2. Immediately after the hardening line (`hardened_bytes = validate_and_harden_image(file_bytes)`), add the quality gate step:
```python
    # 6. Quality gate: cheap quality checks before expensive CV processing.
    # Rejections are still persisted (status='rejected') to protect the
    # Phase 1 calibration dataset, then surfaced as 422 (spec §5).
    rejection = None
    try:
        run_quality_gate(hardened_bytes)
    except QualityGateRejection as exc:
        # Note: `as exc` is implicitly deleted after the except clause, so
        # rebind to a persistent name here.
        rejection = exc
```
   **GOTCHA FOUND DURING EXECUTION (deviated from the original snippet):** the first attempt used `except QualityGateRejection as rejection: pass` + `else: rejection = None` and hit `UnboundLocalError` on the rejection path — CPython implicitly deletes the `as`-target name when the except clause ends, so `rejection` was unbound by the DB-insert line. Initializing `rejection = None` before the try and rebinding to a different name in the except is the fix (verified by the three integration tests).

3. Renumber the Upload & Persist comments 6→7, 7→8, 8→9, 9→10, 10→11 (cosmetic, keeps the flow legible).

4. In the DB insert (now step 10), branch the status and rejection fields:
```python
    db_res = (
        supabase_client.table("submission")
        .insert(
            {
                "id": submission_id,
                "activity_id": activity_id,
                "student_id": student_id,
                "image_path": image_path,
                "status": "rejected" if rejection else "processing",
                "rejection_code": rejection.code if rejection else None,
                "rejection_details": rejection.message if rejection else None,
                "uploader_id": teacher_id,
                "uploader_role": "teacher",
            }
        )
        .execute()
    )
```

5. After the `db_res.data` guard and `submission = db_res.data[0]`, add the rejection branch before the existing success return:
```python
    # 11. Rejected: return 422 with the standard error envelope (API_SPEC §3.3)
    if rejection:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": rejection.code,
                "message": rejection.message,
                "details": {
                    "submission_id": submission_id,
                    "measured_value": rejection.measured_value,
                    "threshold": rejection.threshold,
                },
            },
        )
```

The success path (return 201) is untouched. `main.py`'s handler already wraps the `detail` dict into `{"error": ...}`.

- [ ] **Step 6: Run the rejection tests to verify they pass**

Run: `uv run pytest tests/api/test_submissions.py -v`
Expected: all 8 tests in `TestCreateSubmission` pass, including the three new ones.

- [ ] **Step 7: Lint**

Run: `uv run ruff check .`
Expected: no errors (watch for unused `_make_test_jpeg` if it becomes dead code — delete it).

- [ ] **Step 8: Full suite + commit**

Run: `uv run pytest -v` (against hosted `writewise-dev` per AGENTS.md §5's local reality — no supabase CLI/Docker in this workspace)
Expected: all existing tests still pass, plus the new cv + synthetic + api tests.

```bash
git add backend/app/api/submissions.py backend/tests/api/test_submissions.py docs/superpowers/plans/2026-08-20-quality-gate-implementation.md
git commit -m "feat: integrate quality gate into submission upload with rejection persistence"
```

---

## Self-Review

**Spec coverage:** Deliverable 1 (`quality_gate.py`) → Task 2. Deliverable 2 (`synthetic.py`) → Task 1. Deliverable 3 (`test_quality_gate.py`) → Task 2, covering every row of spec §7.1's test table. Deliverable 5 (`opencv-python-headless` dependency) → Task 1, Step 1. Deliverable 4 (`submissions.py` integration, spec §5, and the corresponding §7.2 integration tests) → Task 3, currently blocked pending the two files listed above.

**Placeholder scan:** Tasks 1–2 contain no TBD/TODO markers and no references to undefined functions — every function, type, and threshold value used in a later step was defined in an earlier one, and the whole chain was executed for real (see the verification note) rather than reasoned about abstractly. Task 3 is explicitly marked blocked rather than filled with guessed function names.

**Type consistency:** `run_quality_gate(image_bytes: bytes) -> QualityMetrics`, `QualityGateRejection(code, message, measured_value, threshold)`, and `QualityMetrics(blur_variance, brightness_mean, contrast_std, resolution_short_side)` are used identically everywhere they appear across both tasks.
