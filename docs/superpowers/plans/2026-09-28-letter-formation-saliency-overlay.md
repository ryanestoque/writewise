# Letter Formation Grad-CAM Saliency Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement genuine Explainable AI (XAI) for cursive letter formation using Grad-CAM on the MobileNetV2 regression model, delivering SVG vector defect contours in the diagnostic overlay for teachers and parents.

**Architecture:** The ML inference pipeline computes negative gradients of the predicted letter formation score with respect to the last convolutional feature maps (`Conv_1` in MobileNetV2) for words needing attention ($y < 75$). Peak activation areas are converted into Douglas-Peucker simplified polygons in canvas space, serialized through the diagnostic engine contract, and rendered as animated SVG highlight halos in the frontend overlay.

**Tech Stack:** Python 3.13, TensorFlow/Keras, OpenCV (`cv2`), Pydantic v2, FastAPI, Next.js 15, React 19, TypeScript, Tailwind CSS, SVG.

**Spec:** [docs/superpowers/specs/2026-09-28-letter-formation-saliency-overlay-design.md](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/superpowers/specs/2026-09-28-letter-formation-saliency-overlay-design.md)

## Global Constraints

- Never bypass RLS or write unvalidated SQL (AGENTS.md §6).
- Inference and Grad-CAM run in-process on Railway single-worker CPU (AGENTS.md §6 rule 14, 15).
- Stub mode in `ENVIRONMENT=test` must generate deterministic synthetic contours without TensorFlow weights (TESTING.md §3.2).
- Zero new image files or storage blobs: contours are vector coordinates in the JSON overlay payload.
- Fallback must be non-blocking: failure in Grad-CAM logs a warning and returns `saliency_polygons = []` without failing submission scoring.
- Frontend must branch on error codes and remain responsive with accessible keyboard navigation (WCAG 2.4.7).

---

### Task 1: Backend Data Models & Stub Inference Updates

**Files:**
- Modify: `backend/app/ml/models.py`
- Modify: `backend/app/diagnostic/models.py`
- Modify: `backend/app/ml/inference.py`
- Test: `backend/tests/test_ml.py`

**Interfaces:**
- Produces: `WordFormationScore.saliency_polygons: list[list[list[int]]]`
- Produces: `FormationAnnotation.saliency_polygons: list[list[list[int]]]`
- Modifies: `_run_stub_inference(word_crops)` to attach synthetic polygon vertices for attention words.

- [x] **Step 1: Write the failing test for stub saliency polygons**

In `backend/tests/test_ml.py`:
```python
def test_stub_inference_includes_saliency_polygons_for_attention_words():
    from app.ml.inference import _run_stub_inference
    import numpy as np

    crops = [np.full((96, 96), 255, dtype=np.uint8) for _ in range(3)]
    result = _run_stub_inference(crops)

    assert len(result.word_scores) == 3
    for ws in result.word_scores:
        assert hasattr(ws, "saliency_polygons")
        assert isinstance(ws.saliency_polygons, list)
        if ws.letter_formation_score < 65.0:
            assert len(ws.saliency_polygons) >= 1
            poly = ws.saliency_polygons[0]
            assert len(poly) >= 3
            for pt in poly:
                assert len(pt) == 2
```

- [x] **Step 2: Run test to verify it fails**

Run: `uv run pytest backend/tests/test_ml.py -k test_stub_inference_includes_saliency_polygons_for_attention_words`  
Expected: FAIL with `AttributeError` or missing `saliency_polygons` attribute.

- [x] **Step 3: Update `WordFormationScore` and `FormationAnnotation` models**

In `backend/app/ml/models.py`:
```python
from pydantic import BaseModel, Field

class WordFormationScore(BaseModel):
    word_index: int
    letter_formation_score: float
    saliency_polygons: list[list[list[int]]] = Field(
        default_factory=list,
        description="List of stroke defect polygon coordinates [[x, y], ...] in canvas space",
    )
```

In `backend/app/diagnostic/models.py`:
```python
class FormationAnnotation(BaseModel):
    line_index: int
    word_index: int
    bbox: list[int]
    score: float
    band: str
    severity: Severity
    note: str
    saliency_polygons: list[list[list[int]]] = Field(
        default_factory=list,
        description="List of stroke defect polygon coordinates [[x, y], ...] in canvas space",
    )
```

- [x] **Step 4: Update `_run_stub_inference()` in `backend/app/ml/inference.py`**

Add deterministic synthetic polygon generation for attention words:
```python
def _run_stub_inference(word_crops: list[np.ndarray]) -> LetterFormationResult:
    rng = np.random.default_rng(_STUB_SEED)
    scores: list[float] = []
    word_scores: list[WordFormationScore] = []

    for i, _ in enumerate(word_crops):
        raw_score = float(rng.normal(_STUB_CENTER, _STUB_SPREAD))
        clamped = _clamp(raw_score)
        scores.append(clamped)

        saliency_polygons: list[list[list[int]]] = []
        if clamped < 65.0:
            # Deterministic diamond polygon for testing
            cx, cy = 48, 48
            saliency_polygons.append([
                [cx, cy - 12],
                [cx + 14, cy],
                [cx, cy + 12],
                [cx - 14, cy],
            ])

        word_scores.append(
            WordFormationScore(
                word_index=i,
                letter_formation_score=clamped,
                saliency_polygons=saliency_polygons,
            )
        )
```

- [x] **Step 5: Run tests and verify they pass**

Run: `uv run pytest backend/tests/test_ml.py`  
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add backend/app/ml/models.py backend/app/diagnostic/models.py backend/app/ml/inference.py backend/tests/test_ml.py
git commit -m "feat(ml): add saliency_polygons to formation scores and stub inference"
```

---

### Task 2: Grad-CAM Saliency Computation Implementation

**Files:**
- Modify: `backend/app/ml/inference.py`
- Test: `backend/tests/test_ml_gradcam.py`

**Interfaces:**
- Produces: `_compute_gradcam_saliency(model: Any, preprocessed_crop: np.ndarray, word_bbox: list[int] | None = None) -> list[list[list[int]]]`
- Integrates: Call inside `_run_real_inference(model, word_crops, word_bboxes)` for words with score $< 75.0$.

- [x] **Step 1: Write unit tests for `_compute_gradcam_saliency` and contour extraction**

Create `backend/tests/test_ml_gradcam.py`:
```python
import numpy as np
import pytest
from app.ml.inference import _extract_saliency_polygons_from_heatmap

def test_extract_saliency_polygons_valid_coordinates():
    # Synthetic heatmap with a hot center
    heatmap = np.zeros((96, 96), dtype=np.float32)
    heatmap[30:60, 30:60] = 0.95

    bbox = [100, 200, 96, 96]
    polygons = _extract_saliency_polygons_from_heatmap(heatmap, bbox)

    assert len(polygons) >= 1
    poly = polygons[0]
    assert len(poly) >= 3
    for x, y in poly:
        # Check translation into canvas bbox [100, 200, 96, 96]
        assert 100 <= x <= 196
        assert 200 <= y <= 296

def test_extract_saliency_polygons_empty_on_cold_heatmap():
    heatmap = np.zeros((96, 96), dtype=np.float32)
    bbox = [50, 50, 96, 96]
    polygons = _extract_saliency_polygons_from_heatmap(heatmap, bbox)
    assert polygons == []
```

- [x] **Step 2: Run test to verify it fails**

Run: `uv run pytest backend/tests/test_ml_gradcam.py`  
Expected: FAIL with `ImportError` (`_extract_saliency_polygons_from_heatmap` not defined).

- [x] **Step 3: Implement `_extract_saliency_polygons_from_heatmap` and `_compute_gradcam_saliency`**

In `backend/app/ml/inference.py`:
```python
def _extract_saliency_polygons_from_heatmap(
    heatmap: np.ndarray,
    bbox: list[int] | tuple[int, int, int, int] | None = None,
) -> list[list[list[int]]]:
    """Convert a normalized [0, 1] 2D heatmap into simplified canvas polygons."""
    max_val = float(np.max(heatmap))
    if max_val < 0.3:
        return []

    # Threshold top 35% activation
    thresh_val = max(0.4, max_val * 0.65)
    binary = ((heatmap >= thresh_val) * 255).astype(np.uint8)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    polygons: list[list[list[int]]] = []

    x0 = bbox[0] if bbox else 0
    y0 = bbox[1] if bbox else 0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 16:  # ignore tiny speckles
            continue
        epsilon = 0.03 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        if len(approx) < 3:
            continue

        poly: list[list[int]] = []
        for pt in approx:
            px, py = int(pt[0][0]), int(pt[0][1])
            poly.append([px + x0, py + y0])
        polygons.append(poly)

    return polygons


def _compute_gradcam_saliency(
    model: Any,
    preprocessed_crop: np.ndarray,
    bbox: list[int] | None = None,
) -> list[list[list[int]]]:
    """Compute defect saliency polygons using Grad-CAM on MobileNetV2."""
    try:
        import tensorflow as tf

        # Find target conv layer (Conv_1 or out_relu in MobileNetV2)
        target_layer = None
        for name in ["Conv_1", "out_relu", "top_conv"]:
            try:
                target_layer = model.get_layer(name)
                break
            except ValueError:
                continue

        if target_layer is None:
            # Fall back to last 4D conv layer
            for layer in reversed(model.layers):
                if len(getattr(layer, "output_shape", ())) == 4:
                    target_layer = layer
                    break

        if target_layer is None:
            return []

        grad_model = tf.keras.models.Model(
            inputs=[model.inputs],
            outputs=[target_layer.output, model.output],
        )

        input_tensor = tf.expand_dims(preprocessed_crop, axis=0)
        with tf.GradientTape() as tape:
            conv_outputs, predictions = grad_model(input_tensor)
            score = predictions[0][0]
            # Negative gradient: features pulling score down
            loss = -score

        grads = tape.gradient(loss, conv_outputs)
        if grads is None:
            return []

        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_outputs = conv_outputs[0]

        # Linear combination of feature maps
        cam = tf.reduce_sum(tf.multiply(pooled_grads, conv_outputs), axis=-1)
        cam = tf.maximum(cam, 0)  # ReLU
        cam_np = cam.numpy()

        cam_max = np.max(cam_np)
        if cam_max > 0:
            cam_np = cam_np / cam_max

        # Upsample to crop dimensions
        h = bbox[3] if bbox else _INPUT_SIZE
        w = bbox[2] if bbox else _INPUT_SIZE
        resized_cam = cv2.resize(cam_np, (w, h), interpolation=cv2.INTER_LINEAR)
        blurred_cam = cv2.GaussianBlur(resized_cam, (3, 3), 0)

        return _extract_saliency_polygons_from_heatmap(blurred_cam, bbox)
    except Exception as exc:
        logger.warning("Grad-CAM computation encountered an error, falling back to []: %s", exc)
        return []
```

- [x] **Step 4: Update `_run_real_inference()` and `run_letter_formation_inference()` signature**

Accept optional `word_bboxes: list[list[int]] | None = None` in `run_letter_formation_inference()`. For words scoring $< 75.0$, invoke `_compute_gradcam_saliency()`.

- [x] **Step 5: Run tests and verify they pass**

Run: `uv run pytest backend/tests/test_ml_gradcam.py backend/tests/test_ml.py`  
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add backend/app/ml/inference.py backend/tests/test_ml_gradcam.py
git commit -m "feat(ml): implement Grad-CAM defect saliency and polygon extraction"
```

---

### Task 3: Diagnostic Engine Pass-Through & Backend Tests

**Files:**
- Modify: `backend/app/diagnostic/engine.py`
- Modify: `backend/tests/test_diagnostic.py`

**Interfaces:**
- Consumes: `raw_output["lines"][l]["words"][w]["saliency_polygons"]`
- Produces: `FormationAnnotation(..., saliency_polygons=...)`

- [x] **Step 1: Write test for diagnostic engine saliency pass-through**

In `backend/tests/test_diagnostic.py`:
```python
def test_diagnostic_engine_passes_saliency_polygons_to_formation_annotation():
    from app.diagnostic.engine import generate_diagnostic_overlay

    raw_output = {
        "guide_lines": {"baseline_y": [100], "midline_y": [80], "topline_y": [60]},
        "lines": [
            {
                "line_index": 0,
                "words": [
                    {
                        "word_index": 0,
                        "bbox": [50, 70, 80, 40],
                        "letter_formation_score": 45.0,
                        "saliency_polygons": [
                            [[60, 80], [70, 80], [65, 95]]
                        ],
                    }
                ],
            }
        ],
    }

    overlay = generate_diagnostic_overlay(raw_output)
    formation = overlay["letter_formation"]["annotations"]

    assert len(formation) == 1
    assert formation[0]["saliency_polygons"] == [[[60, 80], [70, 80], [65, 95]]]
    assert formation[0]["severity"] == "needs_attention"
```

- [x] **Step 2: Run test to verify it fails**

Run: `uv run pytest backend/tests/test_diagnostic.py -k test_diagnostic_engine_passes_saliency_polygons_to_formation_annotation`  
Expected: FAIL (`saliency_polygons` is empty or not mapped).

- [x] **Step 3: Update `backend/app/diagnostic/engine.py`**

In `generate_diagnostic_overlay()` around line 90:
```python
saliency_polys = word.get("saliency_polygons") or []

formation_annotations.append(
    FormationAnnotation(
        line_index=line_idx,
        word_index=word_idx,
        bbox=bbox,
        score=round(score, 1),
        band=band,
        severity=form_sev,
        note=form_note,
        saliency_polygons=saliency_polys,
    )
)
```

- [x] **Step 4: Run diagnostic tests**

Run: `uv run pytest backend/tests/test_diagnostic.py`  
Expected: PASS

- [x] **Step 5: Run linter and formatting check**

Run: `uv run ruff check .`  
Expected: Clean with 0 errors.

- [x] **Step 6: Commit**

```bash
git add backend/app/diagnostic/engine.py backend/tests/test_diagnostic.py
git commit -m "feat(diagnostic): pass saliency polygons into formation overlay annotations"
```

---

### Task 4: Frontend Types & SVG Saliency Layer UI

**Files:**
- Modify: `frontend/components/shared/diagnostic-overlay/types.ts`
- Modify: `frontend/components/shared/diagnostic-overlay/layers/formation-layer.tsx`
- Modify: `frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx`

**Interfaces:**
- Updates `FormationAnnotation.saliency_polygons?: [number, number][][]`
- Renders SVG `<polygon>` elements with responsive styling and accessibility attributes.

- [x] **Step 1: Update TypeScript interface in `types.ts`**

In `frontend/components/shared/diagnostic-overlay/types.ts`:
```typescript
export interface FormationAnnotation {
  line_index: number;
  word_index: number;
  bbox: [number, number, number, number];
  score: number;
  band: string;
  severity: Severity;
  note: string;
  saliency_polygons?: [number, number][][];
}
```

- [x] **Step 2: Update `FormationLayer` in `formation-layer.tsx` to render polygons**

Add saliency polygons inside the annotation group:
```tsx
{/* Saliency Defect Polygons (Grad-CAM XAI) */}
{ann.saliency_polygons?.map((poly, pIdx) => {
  const pointsStr = poly.map(([px, py]) => `${px},${py}`).join(" ");
  return (
    <polygon
      key={`saliency-${id}-${pIdx}`}
      points={pointsStr}
      className={`pointer-events-none transition-all duration-300 ${
        isActive
          ? "fill-rose-500/30 stroke-rose-600 stroke-[2] animate-pulse"
          : isSpotlight
          ? "fill-rose-500/20 stroke-rose-400/80 stroke-[1.5]"
          : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 fill-rose-500/20 stroke-rose-400/80 stroke-[1.5]"
      } motion-reduce:animate-none`}
    />
  );
})}
```

- [x] **Step 3: Update `AnnotationTooltip` in `annotation-tooltip.tsx` for XAI explanation**

When `criterion === "letter_formation"` and `severity === "needs_attention"`, include an XAI subtitle:
```tsx
{isAttention && (
  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
    Highlighted zones show stroke irregularities flagged by the CNN.
  </p>
)}
```

- [x] **Step 4: Run frontend typecheck and linter**

Run: `npx tsc --noEmit` and `npx eslint .` inside `frontend/`  
Expected: 0 errors.

- [x] **Step 5: Commit**

```bash
git add frontend/components/shared/diagnostic-overlay/types.ts frontend/components/shared/diagnostic-overlay/layers/formation-layer.tsx frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx
git commit -m "feat(overlay): render Grad-CAM saliency polygons in SVG formation layer"
```

---

### Task 5: End-to-End Verification & Defense Documentation

**Files:**
- Modify: `docs/ML_PIPELINE.md`
- Run: Full backend pytest and frontend checks

- [x] **Step 1: Document Grad-CAM XAI in `docs/ML_PIPELINE.md`**

Add section 6.6 "Grad-CAM Saliency Extraction for Regression" detailing the math, `tf.GradientTape` usage, and vector polygon simplification.

- [x] **Step 2: Run full backend test suite**

Run: `uv run pytest backend/tests/`  
Expected: All tests pass.

- [x] **Step 3: Run full frontend validation**

Run: `npm --prefix frontend run build` (or `npx tsc --noEmit`)  
Expected: Build passes with zero type errors.

- [x] **Step 4: Final commit**

```bash
git add docs/ML_PIPELINE.md
git commit -m "docs(ml): document Grad-CAM regression saliency architecture"
```
