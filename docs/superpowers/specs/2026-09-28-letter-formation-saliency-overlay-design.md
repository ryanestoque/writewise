# Letter Formation Grad-CAM Saliency Overlay — Design Spec

**Date:** 2026-09-28  
**Status:** Approved  
**Implements:** PRD §7.4 (Diagnostic Engine), ML_PIPELINE §6/§8 (CNN Inference & Explainability), CV_PIPELINE §7 (Word Segmentation), DESIGN §7.4 (Diagnostic Overlay)  

---

## 1. Summary & Problem Statement

### 1.1 The Problem
In cursive handwriting analysis, individual characters feature continuous ligatures and overlaps that make discrete character bounding-box segmentation fragile and prone to error (as documented in `CV_PIPELINE.md` §1 & §5). WriteWise intentionally scores whole grayscale word crops through a fine-tuned MobileNetV2 regression head (`ML_PIPELINE.md` §6).

However, teachers and parents evaluating a student's handwriting benefit from knowing **where** inside a word stroke irregularities occurred (e.g. malformed loops, collapsed ascenders, or abrupt joins). Faking character-level bounding boxes or simulated letter overlays ("imaginary detections") introduces severe risks:
1. **Academic Defense Vulnerability:** Technical panelists at thesis defense (Holy Cross of Davao College, BSIT, Oct 2026) would identify simulated character bounding boxes as unsupported by the underlying whole-word model.
2. **Pedagogical Misleading:** An artificial box misplaced on a ligature misinforms teachers about which stroke the student struggled to form.

### 1.2 The Solution: Genuine Explainable AI (XAI) via Grad-CAM
Rather than simulating character boundaries, WriteWise utilizes **Gradient-weighted Class Activation Mapping (Grad-CAM)** directly on the MobileNetV2 regression model. By extracting the spatial gradients of the predicted formation score with respect to the final convolutional feature maps, the system isolates the exact stroke pixels that penalized the formation score.

These heatmap activations are converted into lightweight **SVG vector contour polygons** (`cv2.approxPolyDP`) and delivered in the existing Diagnostic Overlay JSON contract. The frontend renders them as animated, responsive highlight halos directly over the student's pencil strokes.

---

## 2. Mathematical & Algorithmic Foundation

### 2.1 Grad-CAM on a Continuous Regression Head
Unlike standard classification models where Grad-CAM targets a specific discrete class logit $y^c$, Stage 2 of WriteWise is a continuous regression head producing scalar $y \in [0, 100]$:

$$\text{Word Crop } (96 \times 96) \xrightarrow{\text{MobileNetV2}} A \in \mathbb{R}^{H' \times W' \times K} \xrightarrow{\text{GAP} \to \text{Dense}} y$$

Where:
- $A^k$ is feature map $k$ of the final convolutional layer (`Conv_1` / `out_relu`).
- $y$ is the predicted letter formation score.

#### Gradient and Channel Weights
Using `tf.GradientTape`:
1. Compute the gradient of $y$ with respect to each feature map $A^k$:
   $$\frac{\partial y}{\partial A^k}$$
2. Compute neuron importance weights $\alpha_k$ via global average pooling across spatial dimensions:
   $$\alpha_k = \frac{1}{Z} \sum_{i=1}^{H'} \sum_{j=1}^{W'} \frac{\partial y}{\partial A^k_{i, j}}$$

#### Defect Saliency ($L_{\text{defect}}$)
To answer "which strokes caused this word to receive a low score?":
- When $y < 75$ (`severity == "needs_attention"`), we compute the **negative activation map** (features with negative gradients pulling the score down):
  $$L_{\text{defect}} = \text{ReLU}\left( - \sum_{k} \alpha_k A^k \right)$$
- When $y \ge 75$ (`severity == "normal"`), no defect saliency is generated (`saliency_polygons = []`), keeping the UI distraction-free.

### 2.2 Post-Processing & Vector Polygon Approximation
1. **Upsampling & Smoothing:**
   $L_{\text{defect}}$ is normalized to $[0, 1]$, upsampled to the original word bounding box dimensions $(w, h)$ via bilinear interpolation, and smoothed with a $3 \times 3$ Gaussian kernel.
2. **Thresholding:**
   A binary mask is created for peak activation regions:
   $$M(x, y) = \begin{cases} 255 & \text{if } L_{\text{defect}}(x, y) \ge 0.65 \cdot \max(L_{\text{defect}}) \\ 0 & \text{otherwise} \end{cases}$$
3. **Contour Extraction & Douglas-Peucker Simplification:**
   - Contours are extracted using `cv2.findContours(M, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)`.
   - Each contour is simplified using `cv2.approxPolyDP(contour, epsilon=0.03 * arcLength, True)`.
   - Contours with $< 3$ vertices or area $< 16 \text{ px}^2$ are discarded.
4. **Coordinate Transformation:**
   For word crop placed at worksheet bounding box $[x_0, y_0, w, h]$, each local polygon vertex $[px, py]$ is translated to absolute worksheet canvas coordinates:
   $$[X_{\text{canvas}}, Y_{\text{canvas}}] = [px + x_0, py + y_0]$$

---

## 3. Data Contract & Schema Architecture

```
[backend/app/ml/inference.py]
         │ (produces WordFormationScore with saliency_polygons)
         ▼
[CV Measurement Payload] (stored in DB measurement.raw_output)
         │
         ▼
[backend/app/diagnostic/engine.py]
         │ (maps into FormationAnnotation.saliency_polygons)
         ▼
[GET /api/submissions/:id Response: DiagnosticOverlay]
         │
         ▼
[frontend/components/shared/diagnostic-overlay/formation-layer.tsx]
```

### 3.1 Backend Pydantic Schemas

#### In `backend/app/ml/models.py`:
```python
class WordFormationScore(BaseModel):
    word_index: int
    letter_formation_score: float
    saliency_polygons: list[list[list[int]]] = Field(
        default_factory=list,
        description="List of polygon vertex coordinates [[x, y], ...] in canvas space"
    )
```

#### In `backend/app/diagnostic/models.py`:
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
        description="List of stroke defect polygons for SVG rendering"
    )
```

### 3.2 Frontend TypeScript Interfaces

#### In `frontend/components/shared/diagnostic-overlay/types.ts`:
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

---

## 4. Frontend UI/UX Visualization

### 4.1 Layer Visibility & Interaction Rules

| View State | Saliency Display Behavior | Visual Style |
| :--- | :--- | :--- |
| **All Guides** (Overview) | Hidden by default; appears when user hovers or taps the attention word. | `fill-rose-500/15 stroke-rose-400/80 stroke-[1.5]` |
| **Spotlight Mode** (`activeCriterion === "letter_formation"`) | Immediately visible for all attention words ($y < 75$). | `fill-rose-500/20 stroke-rose-500/90 stroke-[1.8]` + score badge |
| **Active / Hover State** | Intensified opacity + subtle pulsing animation halo. | `fill-rose-500/30 stroke-rose-600 stroke-[2.2] animate-pulse` |
| **High Scoring Words** ($y \ge 75$) | No contours rendered (clean presentation). | Solid brand blue or emerald underline |

### 4.2 SVG Rendering Implementation
Inside `FormationLayer` (`formation-layer.tsx`):
```tsx
{/* Saliency Stroke Defect Polygons */}
{ann.saliency_polygons?.map((poly, pIdx) => {
  const pointsStr = poly.map(([px, py]) => `${px},${py}`).join(" ");
  return (
    <polygon
      key={`saliency-${id}-${pIdx}`}
      points={pointsStr}
      className={`pointer-events-none transition-all duration-200 ${
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

### 4.3 Tooltip & Pedagogical Notes
When an attention annotation is hovered/clicked, the tooltip communicates:
- **Title:** `Letter Formation (${ann.band})` (e.g. `Needs Improvement` or `Developing`)
- **Score:** `${Math.round(ann.score)} / 100`
- **Explanation:** *"Highlighted zones indicate stroke irregularities (malformed loops or abrupt joins) flagged by the CNN."*

---

## 5. Resilience, Stub Mode, & Performance

### 5.1 Latency Budget on Railway (Single CPU Worker)
- Forward inference: ~15 ms per crop.
- Grad-CAM backward tape: ~20 ms per crop.
- Contours & simplification: ~2 ms per crop.
- **Total per word:** ~37 ms.
- For a typical 8-word activity sheet: **~300 ms total**, well within the **< 3s CNN budget** specified in `ML_PIPELINE.md` §8.

### 5.2 Graceful Fallback
If gradient computation fails due to any numeric instability or unhandled exception in TensorFlow:
- The error is logged with `logger.warning("Grad-CAM computation failed for word %s: %s", idx, exc)`.
- `saliency_polygons` falls back to `[]`.
- The submission and numeric score succeed without disruption.

### 5.3 Stub Mode for CI (`ENVIRONMENT=test`)
When running in stub mode (matching `AGENTS.md` §5 and `TESTING.md` §3.2):
- For synthetic words with scores $< 65.0$, `_run_stub_inference()` generates a deterministic synthetic polygon diamond/ellipse within the word bounding box.
- CI tests verify that `saliency_polygons` is correctly serialized and passed through the diagnostic engine without requiring TensorFlow or GPU hardware.

---

## 6. Academic Defense Strategy (Holy Cross of Davao College, BSIT)

| Potential Panel Question | Recommended Technical Defense Response |
| :--- | :--- |
| *"Why didn't you put bounding boxes around individual letters in cursive words?"* | "Cursive writing is fundamentally continuous. Imposing discrete character bounding boxes introduces severe segmentation errors at ligatures. In our pipeline (`CV_PIPELINE.md` §1), we opted for holistic word segmentation and utilized Explainable AI (Grad-CAM) to localize stroke quality without relying on artificial character cuts." |
| *"How is the heatmap computed for a regression score?"* | "We backpropagate the scalar output score to the final convolutional feature maps (`Conv_1` in MobileNetV2), compute global-average-pooled channel weights, and apply a negative ReLU filter to isolate features that penalized the formation score." |
| *"Does this slow down the upload pipeline?"* | "No. Vector polygon approximation via Douglas-Peucker reduces the saliency mask to lightweight coordinates (~1.5 KB JSON payload) computed in ~300 ms on CPU, eliminating the bandwidth overhead of raster heatmaps." |

---

## 7. Verification Plan & Definition of Done

- [ ] `backend/app/ml/models.py` updated with `saliency_polygons`.
- [ ] `backend/app/ml/inference.py` implements `_compute_gradcam_saliency()` with fallback and stub generation.
- [ ] `backend/app/diagnostic/models.py` and `engine.py` pass through `saliency_polygons`.
- [ ] `frontend/components/shared/diagnostic-overlay/types.ts` and `formation-layer.tsx` render SVG polygons with responsive states.
- [ ] Backend test suite: `uv run pytest backend/tests/test_ml.py` and `backend/tests/test_diagnostic.py` pass.
- [ ] Frontend checks: `npx tsc --noEmit` and `npx eslint .` pass clean.
