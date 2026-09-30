# Size Consistency Diagnostic Overlay & Descender Segmentation Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate premature descender truncation in CV line/word segmentation (preventing amputated loops on letters like *g*, *y*, *p*), enrich diagnostic annotations with exact core-zone bounds, and redesign the frontend "Size" overlay to visualize the core x-height band rather than misleading outer bounding boxes.

**Architecture:**
1. In `backend/app/cv/segmentation.py`, refine row-band bottom calculations for non-continuous rulings so the descender pad is preserved into the inter-ruling gap without being halved prematurely by adjacent lines.
2. In `backend/app/diagnostic/models.py` and `backend/app/diagnostic/engine.py`, add `core_bbox` to `SizeAnnotation`, capturing `[x, midline_y, w, unit_height]` so the client receives the exact core handwriting zone.
3. In `frontend/components/shared/diagnostic-overlay/`, update `types.ts` and redesign `SizeLayer` (`size-layer.tsx`) to render the uniform core guideline band across each word alongside a normalized ratio badge (`e.g., 0.98×`), with subtle outer word extent brackets.

**Tech Stack:** Python 3.13, OpenCV (`cv2`), NumPy, Pydantic v2, TypeScript 5, React 19, Next.js 15, Tailwind CSS v4, SVG.

**Spec:** `docs/CV_PIPELINE.md` §5.1, §6.4, §6.5; `docs/DESIGN.md` §3.4 Diagnostic Overlays.

## Global Constraints
- Preserve single Uvicorn worker and in-process pipeline execution (`AGENTS.md` §6.14, §6.15).
- All changes must be backward-compatible with stored `Measurement` JSON in Supabase (`core_bbox` optional).
- `uv run ruff check .` and `uv run pytest tests/cv/` must pass cleanly.
- `npx eslint components/shared/diagnostic-overlay/` and `npx tsc --noEmit` must pass cleanly.

---

### Task 1: Non-Continuous Ruling Descender Preservation in `segmentation.py`

**Files:**
- Modify: `backend/app/cv/segmentation.py:295-325`
- Test: `backend/tests/cv/test_segmentation.py`

**Interfaces:**
- Consumes: `DeskewResult` from `backend/app/cv/guide_lines.py`.
- Produces: `SegmentationResult` with word bounding boxes that retain full descenders on non-continuous ruled paper without being sliced off.

- [ ] **Step 1: Write failing test in `test_segmentation.py` for non-continuous ruling descenders**

Add `test_non_continuous_ruling_preserves_descenders` in `backend/tests/cv/test_segmentation.py`:

```python
def test_non_continuous_ruling_preserves_descenders():
    """On standard ruled paper with interline gap (next_top > base_y), descenders

    like 'g' or 'y' must not be truncated at (base_y + next_top) // 2.
    """
    import cv2
    import numpy as np
    from app.cv.guide_lines import DeskewResult
    from app.cv.segmentation import segment_lines_and_words

    h, w = 1200, 1200
    binary = np.zeros((h, w), dtype=np.uint8)

    # 2 rulings with interline space:
    # Row 0: top=200, mid=260, base=320 (unit_height = 60, line_height = 120)
    # Interline gap between base_y=320 and next_top=360 is 40px
    # Row 1: top=360, mid=420, base=480 (empty)
    toplines = [200, 360]
    midlines = [260, 420]
    baselines = [320, 480]

    # Draw word 'joy' on Row 0:
    # Core body between y=262 and y=318 from x=200 to x=350
    for x in range(200, 350, 10):
        cv2.line(binary, (x, 265), (x + 6, 318), 255, thickness=3)
    # Descender for 'y' extending down to y=380 (60px below baseline, past next_top 360)
    cv2.line(binary, (330, 318), (330, 380), 255, thickness=4)

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
    word = result.lines[0].words[0]
    bx, by, bw, bh = word.bbox
    # Descender reached y=380; bounding box must not be clamped at (320+360)//2 = 340
    assert (by + bh) >= 375, f"Word bbox bottom {by + bh} severed descender extending to 380"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/cv/test_segmentation.py -k "test_non_continuous_ruling_preserves_descenders" -v`
Expected: FAIL (assertion error: `by + bh` clamped around ~340).

- [ ] **Step 3: Update `segmentation.py` line band calculation**

In `backend/app/cv/segmentation.py`:
Update lines ~298-316:
```python
        # §5.1: Row band calculation with ascender/descender margin
        ascender_pad = int(0.40 * line_height)
        descender_pad = int(max(0.60 * line_height, 0.85 * unit_height))

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
                # If interline gap is narrow, allow descender margin to reach toward next_mid
                # rather than prematurely truncating midway through the blank inter-ruling gap.
                max_descender_reach = min(next_mid, base_y + descender_pad)
                band_bottom = min(band_bottom, max_descender_reach)
            else:
                # Continuous paper: descenders reach into next row's upper zone up to next_mid
                band_bottom = min(band_bottom, next_mid)
```

- [ ] **Step 4: Re-run pytest to verify passing**

Run: `uv run pytest tests/cv/test_segmentation.py -v`
Expected: All tests pass.

---

### Task 2: Backend Diagnostic Size Annotation Enrichment (`core_bbox`)

**Files:**
- Modify: `backend/app/diagnostic/models.py:44-55`
- Modify: `backend/app/diagnostic/engine.py:102-117`
- Test: `backend/tests/cv/test_diagnostic.py` (or existing diagnostic test suite)

**Interfaces:**
- Consumes: `MeasurementData` and `GuideLinesData`.
- Produces: `SizeAnnotation` with optional `core_bbox: [x, midline_y, w, unit_height]`.

- [ ] **Step 1: Add `core_bbox` field to `SizeAnnotation` in `models.py`**

In `backend/app/diagnostic/models.py`:
```python
class SizeAnnotation(BaseModel):
    line_index: int
    word_index: int
    bbox: list[int]
    size_ratio: float
    severity: Severity
    note: str
    core_bbox: list[int] | None = None
```

- [ ] **Step 2: Populate `core_bbox` in `backend/app/diagnostic/engine.py`**

In `backend/app/diagnostic/engine.py` inside `generate_diagnostic_overlay`:
```python
                # 2. Size
                size_ratio = word.get("size_ratio", 1.0)
                sz_sev, sz_note = evaluate_size_consistency(size_ratio)
                if sz_sev == "needs_attention":
                    attention_counts["size_consistency"] += 1

                # Calculate word's core ruling bounding box [x, midline_y, w, unit_height]
                core_bbox = None
                if line_idx < len(guide_midlines) and line_idx < len(guide_baselines):
                    mid_y = guide_midlines[line_idx]
                    base_y = guide_baselines[line_idx]
                    core_h = max(1, base_y - mid_y)
                    core_bbox = [bbox[0], mid_y, bbox[2], core_h]

                size_annotations.append(
                    SizeAnnotation(
                        line_index=line_idx,
                        word_index=w_idx,
                        bbox=bbox,
                        size_ratio=round(size_ratio, 2),
                        severity=sz_sev,
                        note=sz_note,
                        core_bbox=core_bbox,
                    )
                )
```

- [ ] **Step 3: Run backend test suite**

Run: `uv run pytest tests/`
Expected: All tests pass without schema violations.

---

### Task 3: Frontend Diagnostic Size Layer Redesign

**Files:**
- Modify: `frontend/components/shared/diagnostic-overlay/types.ts:47-55`
- Modify: `frontend/components/shared/diagnostic-overlay/layers/size-layer.tsx`

**Interfaces:**
- Consumes: `SizeAnnotation` containing `bbox`, `core_bbox`, `size_ratio`, `severity`, and `note`.
- Produces: Visual representation showing:
  1. The **Core Height Zone** (uniform midline-to-baseline ruling band for that word).
  2. A ratio indicator badge (`e.g., 0.98×` or `1.02×`).
  3. Subtle outer extent brackets so the word bounds are clear without visual height distortion.

- [ ] **Step 1: Update `types.ts` with `core_bbox`**

In `frontend/components/shared/diagnostic-overlay/types.ts`:
```typescript
export interface SizeAnnotation {
  line_index: number;
  word_index: number;
  bbox: [number, number, number, number];
  size_ratio: number;
  severity: Severity;
  note: string;
  core_bbox?: [number, number, number, number] | null;
}
```

- [ ] **Step 2: Redesign `size-layer.tsx`**

In `frontend/components/shared/diagnostic-overlay/layers/size-layer.tsx`:
1. Use `ann.core_bbox` when available (falling back to `ann.bbox`).
2. Render:
   - **Core Zone Box:** Semi-transparent band bounded by midline and baseline across the word's width.
   - **Top/Bottom Guidelines:** Crisp dashed horizontal lines indicating where the midline and baseline sit.
   - **Outer Extent Brackets:** Thin, low-contrast side brackets for full word width $[x, x + w]$.
   - **Size Ratio Badge:** Small floating badge displaying `${Math.round(ann.size_ratio * 100)}%` or `${ann.size_ratio.toFixed(2)}×`.
3. Set accessible labels and tooltip payloads emphasizing core letter consistency.

- [ ] **Step 3: Verify TypeScript and Lint**

Run:
- `cd frontend && npx tsc --noEmit`
- `npx eslint components/shared/diagnostic-overlay/`

---

### Task 4: End-to-End Verification

- [ ] **Step 1: Backend tests and lint**
Run:
- `cd backend && uv run ruff check .`
- `uv run pytest tests/`

- [ ] **Step 2: Browser Verification**
Inspect `SubmissionDetail` in the browser:
- Select the `Size` criterion overlay.
- Verify that `sun`, `shines`, `bright`, and `today` now display **uniform core reference bands** matching the guideline ruling.
- Verify that the descending loops on `g` and `y` are no longer cut off by the word segmentation boundary.
