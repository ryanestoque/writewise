# Continuous Ruling Descender Segmentation & Baseline Alignment Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent cursive descender tails (letters q, f, g, y, p, j, z) from being severed into standalone ghost "words" on adjacent blank rulings, and ensure baseline alignment measures the true letter-body resting line rather than descender loop extremities.

**Architecture:**
1. Fix line row-band bounds in [`segmentation.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/app/cv/segmentation.py) so adjacent continuous rulings (`base_y[i] == topline_y[i+1]`) allow descender margin down to the next row's midline, preserving descenders within their parent word.
2. Add core-zone intersection validation in [`segmentation.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/app/cv/segmentation.py) so word candidates that sit entirely outside a line's midline-to-baseline writing zone are rejected.
3. Update [`baseline.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/app/cv/features/baseline.py) to use a robust column-wise percentile instead of raw `np.max(ink_ys)`, preventing descender loops from corrupting baseline deviation scores.

**Tech Stack:** Python 3.13, OpenCV (`cv2`), NumPy, pytest

**Spec:** [`docs/CV_PIPELINE.md`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/CV_PIPELINE.md) §5.1–§5.3, §6.3; [`docs/adr/0001-cv-feature-extraction-and-pipeline.md`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/adr/0001-cv-feature-extraction-and-pipeline.md)

## Global Constraints
- Preserve single Uvicorn worker and in-process pipeline execution (`AGENTS.md` §6.14, §6.15).
- All error responses and exceptions match existing schemas (`PostSegmentationRejection`).
- No changes to RLS, database migrations, or frontend schemas needed.
- `uv run ruff check .` and `uv run pytest tests/cv/` must pass cleanly.

---

### Task 1: Continuous Ruling Bounds & Core-Zone Word Filtering in `segmentation.py`

**Files:**
- Modify: [`backend/app/cv/segmentation.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/app/cv/segmentation.py:165-185,295-350)
- Test: [`backend/tests/cv/test_segmentation.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/tests/cv/test_segmentation.py)

**Interfaces:**
- Consumes: `DeskewResult` from [`app.cv.guide_lines`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/app/cv/guide_lines.py)
- Produces: `SegmentationResult` with clean word bounding boxes that retain full descenders on their originating line without spawning ghost words on empty lines below.

- [ ] **Step 1: Write failing test in `test_segmentation.py` for continuous ruling descenders**

Add `test_continuous_ruling_preserves_descenders_without_ghost_words` to [`backend/tests/cv/test_segmentation.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/tests/cv/test_segmentation.py):

```python
def test_continuous_ruling_preserves_descenders_without_ghost_words():
    """On continuous ruled paper where base_y[i] == topline_y[i+1], descenders

    must remain attached to row i and must not spawn false words on empty row i+1.
    """
    import cv2
    import numpy as np
    from app.cv.guide_lines import DeskewResult

    h, w = 2000, 2000
    binary = np.zeros((h, w), dtype=np.uint8)

    # 2 continuous rulings:
    # Row 0: top=400, mid=500, base=600
    # Row 1: top=600, mid=700, base=800 (empty row)
    toplines = [400, 600]
    midlines = [500, 700]
    baselines = [600, 800]

    # Draw word 'quick' on Row 0:
    # Body between 490 and 605
    # Letter 'q' has descender extending down to y=690 (inside Row 1 ascender space, above Row 1 midline 700)
    # Body strokes:
    for x in range(300, 700, 15):
        cv2.line(binary, (x, 505), (x + 8, 602), 255, thickness=4)
    # Descender stroke at x=330 down to y=685:
    cv2.line(binary, (330, 602), (330, 685), 255, thickness=4)

    deskew = DeskewResult(
        gray=binary,
        denoised=binary,
        binary=binary,
        topline_y=toplines,
        midline_y=midlines,
        baseline_y=baselines,
        deskew_angle=0.0,
    )

    result = segment_lines_and_words(deskew, expected_word_count=1)

    assert result.total_word_count == 1
    assert len(result.lines[0].words) == 1
    assert len(result.lines[1].words) == 0

    word = result.lines[0].words[0]
    bx, by, bw, bh = word.bbox
    # Bounding box should encompass the descender (reaching beyond y=670)
    assert by + bh >= 680
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/cv/test_segmentation.py::test_continuous_ruling_preserves_descenders_without_ghost_words -v`
Expected: FAIL (either `total_word_count == 2` because Row 1 catches the tail as a ghost word, or `by + bh` does not encompass descender).

- [ ] **Step 3: Update `segmentation.py` with continuous ruling band bounds and core-zone filtering**

In [`backend/app/cv/segmentation.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/app/cv/segmentation.py):
1. Update row band calculation (around lines 165–181):
```python
        # §5.1: Row band calculation with ascender/descender margin
        ascender_pad = int(0.40 * line_height)
        descender_pad = int(0.45 * line_height)

        band_top = max(0, top_y - ascender_pad)
        band_bottom = min(img_h, base_y + descender_pad)

        # Bound by adjacent lines if present
        if i > 0:
            prev_mid = deskew.midline_y[i - 1]
            prev_base = deskew.baseline_y[i - 1]
            # On continuous paper (prev_base == top_y), ascenders can reach into previous row's lower zone up to prev_mid
            band_top = max(band_top, prev_mid)
        if i < n_rulings - 1:
            next_mid = deskew.midline_y[i + 1]
            # On continuous paper (base_y == next_top), descenders can reach into next row's upper zone up to next_mid
            band_bottom = min(band_bottom, next_mid)
```

2. In `_create_word_segment` (around line 320), filter out any candidate whose ink does not substantially intersect the line's core zone (between `mid_y` and `base_y`):
```python
            # Candidate must intersect the ruling line's core zone (between midline and baseline).
            # Stray ascenders from below or descenders from above on an empty ruling do not have body ink in the core zone.
            core_margin = int(0.15 * unit_height)
            if (bbox_y + bbox_h) < (mid_y - core_margin) or bbox_y > (base_y + core_margin):
                return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/cv/test_segmentation.py -v`
Expected: PASS all segmentation tests.

- [ ] **Step 5: Commit**

```bash
git add backend/app/cv/segmentation.py backend/tests/cv/test_segmentation.py
git commit -m "fix(cv): preserve descenders in continuous rulings and filter ghost words"
```

---

### Task 2: Robust Baseline Measurement for Words with Descenders in `baseline.py`

**Files:**
- Modify: [`backend/app/cv/features/baseline.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/app/cv/features/baseline.py:40-54)
- Test: [`backend/tests/cv/test_baseline.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/tests/cv/test_baseline.py)

**Interfaces:**
- Consumes: `word_bbox`, `baseline_y`, `unit_height`, `binary_crop`
- Produces: `deviation_ratio: float` relative to `unit_height`.

- [ ] **Step 1: Write failing test in `test_baseline.py` for words containing descenders**

Add `test_baseline_deviation_ignores_descender_tails` to [`backend/tests/cv/test_baseline.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/tests/cv/test_baseline.py):

```python
def test_baseline_deviation_ignores_descender_tails():
    """Words with descenders (q, f, g, y, p) must measure the letter-body baseline

    alignment, not the bottom of the descender loop.
    """
    # Crop height 120, width 100.
    # Letter body sits on baseline y=500 (row 50 in crop, bbox_y=450).
    # Letter 'q' has descender extending down to row 110 (y=560).
    crop = np.full((120, 100), 0, dtype=np.uint8)
    # Most columns (x=20..95) have ink ending at row 50:
    crop[10:51, 20:95] = 255
    # Descender column (x=10..15) extends down to row 110:
    crop[10:111, 10:16] = 255

    bbox = (100, 450, 100, 120)
    # Baseline at y=500, unit_height=50.
    deviation = compute_baseline_deviation(
        word_bbox=bbox, baseline_y=500, unit_height=50.0, binary_crop=crop
    )
    # Letter body rests at y=450+50=500 -> diff should be 0.0 (or <= 0.05), NOT 60/50 = 1.20!
    assert deviation <= 0.05
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/cv/test_baseline.py::test_baseline_deviation_ignores_descender_tails -v`
Expected: FAIL (`deviation == 1.2 != 0.05`).

- [ ] **Step 3: Update `compute_baseline_deviation` to use robust column percentile**

In [`backend/app/cv/features/baseline.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/backend/app/cv/features/baseline.py:40-54):

```python
    if binary_crop is not None and binary_crop.size > 0:
        ink_mask = get_ink_mask(binary_crop)
        ink_ys, ink_xs = np.where(ink_mask)

        if len(ink_ys) > 0:
            # Find the bottom-most ink pixel in each ink-containing column
            # to prevent isolated descender loops (q, f, g, y, p) from dominating the baseline
            col_bottoms = []
            unique_xs = np.unique(ink_xs)
            for x in unique_xs:
                col_bottoms.append(int(np.max(ink_ys[ink_xs == x])))

            if len(col_bottoms) > 0:
                # 60th percentile represents the common bottom shelf of letter bodies
                # without being thrown off by descender loops (which occupy only 10-25% of word width)
                y_bottom = bbox_y + int(np.percentile(col_bottoms, 60))
            else:
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
Expected: PASS all 6 tests in `test_baseline.py`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/cv/features/baseline.py backend/tests/cv/test_baseline.py
git commit -m "fix(cv): calculate robust letter baseline ignoring descender tails"
```

---

### Task 3: Full Verification Against Real Submission & Test Suite

**Files:**
- Test: Full backend test suite + live verification script

- [ ] **Step 1: Run full CV pytest suite and linter**

Run: `uv run pytest tests/cv/ -v`
Run: `uv run ruff check .`
Expected: 64 passed, 0 lint errors.

- [ ] **Step 2: Run verification on user's real worksheet image**

Run verification script on the user's test image (`67497e36-e57b-47bd-a85c-fd3c91c25871/23665966-a578-4aa2-b148-74f80c56c748.jpg`):
```bash
uv run python -c "
import os, json
from dotenv import load_dotenv
from supabase import create_client
from app.cv.pipeline import run_cv_pipeline
from app.diagnostic.engine import generate_diagnostic_overlay

load_dotenv('backend/.env')
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))
img_bytes = supabase.storage.from_('submission-images').download('67497e36-e57b-47bd-a85c-fd3c91c25871/23665966-a578-4aa2-b148-74f80c56c748.jpg')

res = run_cv_pipeline(img_bytes, expected_word_count=4)
overlay = generate_diagnostic_overlay(res.measurement.model_dump())

total_words = sum(len(l.words) for l in res.measurement.lines)
print('Total detected words:', total_words)
assert total_words == 4, f'Expected 4 words, got {total_words}'

for l in res.measurement.lines:
    if l.words:
        print(f'Line {l.line_index}: {len(l.words)} words')
        for w in l.words:
            print('  word:', w.bbox, 'base_dev:', w.baseline_deviation_ratio, 'size_rat:', w.size_ratio)

print('Size annotations:', len(overlay['size']['annotations']))
print('Baseline annotations:', len(overlay['baseline']['annotations']))
"
```
Expected:
- Exactly 4 detected words on Line 1.
- Line 2 has 0 words.
- No false "needs_attention" boxes on descender loops.

- [ ] **Step 3: Update documentation if needed and final commit**

```bash
git add .
git commit -m "docs: document continuous ruling descender fix in CV_PIPELINE.md"
```
