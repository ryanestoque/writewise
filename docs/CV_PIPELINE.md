# WriteWise — CV_PIPELINE.md

**OpenCV-Based Feature Extraction Pipeline — Build Guide**

- **Document type:** Internal engineering build guide (companion to PRD.md, ARCHITECTURE.md, DESIGN.md ML_PIPELINE.md, DATABASE.md, API_SPEC.md, TECH_STACK.md, SECURITY.md, TESTING.md, DEPLOYMENT.md)
- **Scope:** everything from a validated worksheet photo through to (a) raw per-criterion measurements and (b) word-crop images handed off for CNN classification. Does **not** cover CNN architecture, training, or inference (see `ML_PIPELINE.md`, not yet written) or score computation from raw measurements (see ARCHITECTURE.md §10, the `ScoreProvider` abstraction — already fully specified there).
- **Status:** Draft v1

---

## 1. Pipeline Overview

```
Worksheet photo
      │
      ▼
1. Quality Gate ──────────────── reject (blur / brightness / contrast / resolution)
      │
      ▼
2. Preprocessing (grayscale → median blur → Otsu threshold)
      │
      ▼
3. Guide-Line Detection (Hough transform: baseline / midline / topline)
      │
      ▼
4. Deskew (rotate using guide-line angle)
      │
      ▼
5. Line Segmentation (row bands from deskewed guide lines)
      │
      ▼
6. Word Segmentation (column-gap projection per line)
      │
      ▼
7. Post-Segmentation Gate ─────── reject (detected word count vs. target text)
      │
      ▼
8. Feature Extraction (slant, spacing, baseline, size — per word, on binarized image)
      │
      ▼
9. Output Assembly ──┬── Raw measurement JSON (→ Measurement record)
                      └── Grayscale word crops (→ CNN inference, ML_PIPELINE.md)
```

Two things to notice about this ordering, since they weren't obvious going in:

- **Guide-line detection happens before deskew, and drives it.** Worksheets used in the pilot reliably have printed baseline/midline/topline ruling (confirmed for Matina Aplaya Elementary — Grade 3 handwriting practice sheets universally use this ruling regardless of activity content). That means the guide lines are a more reliable deskew-angle source than trying to infer rotation from the handwriting itself, and once deskewed, the guide lines' y-positions directly define line boundaries — no separate ink-density row-projection step is needed for line segmentation.
- **Segmentation stops at word-level.** The CNN receives whole-word crops, not individual letters. Cursive strokes connect letters within a word, and automatic letter-level segmentation is a genuinely hard, error-prone problem (even the CCC/C-Cube academic benchmark dataset needed *manual* character extraction from cursive words). Given the compressed timeline and that Phase 1 calibration-data integrity is the project's top-flagged risk, this pipeline does not attempt it. See §5 and §6.2 for how spacing is still measured at near-letter granularity without full letter segmentation.

---

## 2. Quality Gate

Runs first, before any of the real processing. Fails fast with a specific reason if the photo itself is unusable — protects Phase 1 calibration data from being built on garbage input.

| Check | Method | Reject if | Note |
|---|---|---|---|
| Blur | `cv2.Laplacian(gray, cv2.CV_64F).var()` | variance < 100 | Standard rule-of-thumb for document-style phone photos |
| Brightness | Grayscale mean intensity | outside 50–200 (of 255) | Catches severe under/overexposure |
| Contrast | Grayscale intensity std dev | < 20 | Catches washed-out/flat images even when mean brightness looks fine |
| Resolution | Shorter image side | < 1500px | Proxy check — guide-line pixel spacing isn't known yet at this stage, so this rules out heavily downscaled/screenshotted images by absolute size instead |

**All four thresholds are starting defaults, not final values.** They're reasonable literature/rule-of-thumb picks made with zero real worksheet photos to test against. Once Phase 1 is live and real rejections start coming in, revisit these against actual false-positive/false-negative rates.

Rejected submissions are **not discarded** — per ARCHITECTURE.md, they're persisted as a `Submission` row with status `rejected`, the image, and the failure reason, so Phase 1 usability findings aren't lost.

---

## 3. Preprocessing

Runs on every image that clears the quality gate.

1. **Grayscale** — `cv2.cvtColor(img, COLOR_BGR2GRAY)`.
2. **Denoise** — median blur (`cv2.medianBlur`, small kernel, e.g. 3×3), not Gaussian. Median blur preserves edges, which matters because thresholding and line/contour detection downstream need sharp stroke edges — Gaussian blur would soften exactly the detail those steps rely on.
3. **Threshold** — Otsu's method (`cv2.threshold(..., THRESH_OTSU)`). Auto-picks the binarization cutoff from each image's own histogram rather than a fixed value, since lighting/exposure will vary across different phones and classrooms.

Deskew is **not** part of this stage — it depends on guide-line detection (§4) running first.

---

## 4. Guide-Line Detection & Deskew

1. **Detect** baseline, midline, and topline as near-horizontal line segments via `cv2.HoughLinesP` on the thresholded image.
2. **Deskew** — use the detected guide-line angle (not handwriting-derived slant) to rotate the whole image level via `cv2.warpAffine`. This corrects worksheet photo rotation only. It must not be confused with — or accidentally correct away — the actual handwriting slant, which is a feature we're measuring, not noise to remove.
3. Post-deskew, the guide lines are horizontal and their y-positions become the reference geometry for everything downstream: line boundaries (§5.1), baseline deviation (§6.3), and size-consistency normalization (§6.4, §6.5).

---

## 5. Segmentation

### 5.1 Line Segmentation
Each text line's row band is defined directly from consecutive detected baselines (post-deskew) — not from an ink-density row projection. This is more robust than ink-based detection because it doesn't depend on how much or how consistently the student wrote on a given line.

### 5.2 Word Segmentation
Within each line's row band:
1. Compute a vertical (column-wise) ink-pixel projection profile.
2. Identify all column gaps (runs of near-zero ink).
3. Classify a gap as a **word boundary** if its width ≥ **2.5–3× the median gap width** in that line; narrower gaps are treated as within-word.

Using the line's own median as the reference (rather than a fixed pixel count) keeps this working across different handwriting sizes and photo resolutions without hardcoding pixel values. **The 2.5–3× multiplier is a tunable constant** — recalibrate once real Phase 1 photos are available.

### 5.3 Post-Segmentation Gate
A technically-fine photo can still yield unusable segmentation output — a blank/unfinished worksheet, the wrong sheet photographed, or handwriting too faint to have survived the quality gate but too faint to segment. Since the expected word count is already known from the Activity's target text:

- Compare detected word count to expected word count.
- If detected count is wildly off (e.g., less than half of expected, or zero), reject — reusing the same rejected-`Submission` pattern as the quality gate (§2), not a separate failure path.

---

## 6. Feature Extraction

All four criteria operate on the binarized (post-threshold) image, per word.

### 6.1 Slant Angle
1. Run `cv2.HoughLinesP` within each word's region.
2. Filter to near-vertical segments (within ±45° of vertical) — this isolates the up/down pen strokes that carry the slant signal and excludes the horizontal connecting strokes between letters.
3. Average the surviving segments' angle relative to true vertical, measured against the detected guide lines' perpendicular (not absolute image vertical) — keeps this self-consistent even if deskew isn't perfect.

*(Considered and rejected: a PCA/image-moments approach on ink-pixel spread. Cursive words are wide and horizontally dominant in overall shape, so the dominant PCA axis tends to track word direction rather than stroke lean — it would need extra correction the line-segment-filtering approach avoids by construction.)*

### 6.2 Spacing
Reuses the column-gap data already computed during word segmentation (§5.2) — no additional segmentation work needed:
- **Word-to-word spacing** = mean/std over gaps classified as word boundaries.
- **Letter-to-letter spacing** = mean/std over the narrower within-word gaps.

**Caveat:** the within-word gaps are *candidate* inter-letter gaps, not verified letter boundaries — a messy loop or crossed "t" can create a spurious dip in the ink-density profile. This measures spacing **rhythm/regularity**, which is what the criterion actually needs (consistency of spacing pattern), but the letter-spacing number specifically should be documented as an approximation, not ground truth.

### 6.3 Baseline Alignment
For each word: vertical pixel distance from the word's lower ink boundary to the detected baseline guide line (§4), converted to a normalized ratio (§6.5).

### 6.4 Size Consistency
Worksheets have a printed midline in addition to baseline (3-line guide ruling). For each word:
1. Measure the "core" ink height — the ink mass between baseline and midline, excluding ascender/descender strokes that extend above midline or below baseline.
2. Express as a ratio to the printed baseline-to-midline distance (§6.5).
3. Size-consistency score = variance of this ratio across all words in the submission.

This avoids the unfair comparison that raw word-bounding-box height would create (a word containing an ascender like "b" or "l" is naturally taller than one without, regardless of the student's actual size control).

### 6.5 Normalization Reference
All ratios above (baseline deviation, size consistency) — and, implicitly, spacing — are normalized against the **detected baseline-to-midline pixel distance** for that worksheet, not "average letter height in the image" (an earlier ARCHITECTURE.md decision, superseded here now that guide lines are confirmed present). Guide-line spacing is a fixed external reference printed on the page, independent of how the student actually writes — using it avoids the circularity of normalizing handwriting-quality measurements against a reference derived from that same handwriting. It remains fully scale-invariant (guide-line spacing in pixels scales with camera zoom/distance exactly like letter height would), so this doesn't reintroduce the physical-scale-marker problem ARCHITECTURE.md's original decision was avoiding.

---

## 7. CNN Handoff

Per detected word, crop from the **deskewed grayscale image** (post-deskew, pre-binarization) using the word's bounding box — computed on the binarized image, but applied to the grayscale source. The binarized image stays internal to this pipeline's own geometric measurements (§6); the CNN gets the richer grayscale crop, since a hard black/white image throws away stroke-quality signal (smoothness, pressure variation, anti-aliased edges) a classifier can use to judge letter formation.

This crop format is the full extent of this document's involvement with the CNN — everything after receiving it (model architecture, inference, letter-formation output interpretation) belongs to `ML_PIPELINE.md`.

---

## 8. Output Schema

Stored as the `Measurement` record's raw JSON. Single unified structure — Phase 1's raw-measurement display, Phase 2's diagnostic overlay rendering, and the scoring engine (ARCHITECTURE.md §10) all read from this same shape, rather than each stage inventing its own partial output.

```json
{
  "guide_lines": {
    "baseline_y": [412, 498, 584],
    "midline_y": [438, 524, 610],
    "topline_y": [386, 472, 558]
  },
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
      "word_gaps": [1.8, 2.1, 1.9],
      "intra_word_gaps": [0.3, 0.4, 0.35, 0.28]
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

`word_gaps` / `intra_word_gaps` and all ratio fields are expressed relative to baseline-to-midline distance (§6.5).

---

## 9. Module Structure

```
backend/app/cv/
├── quality_gate.py       # §2
├── preprocessing.py       # §3
├── guide_lines.py         # §4
├── segmentation.py        # §5
├── features/
│   ├── slant.py           # §6.1
│   ├── spacing.py         # §6.2
│   ├── baseline.py        # §6.3
│   └── size.py             # §6.4
└── pipeline.py             # orchestrator — chains stages, assembles §8 output
```

- Each stage is a **plain function**, not a class — takes an image array (or the prior stage's structured output) in, returns structured data out. No shared mutable pipeline-object state between stages. This keeps every stage trivially unit-testable in isolation (see §11): `compute_slant(word_image)` can be tested standalone with a synthetic input and an expected angle, no pipeline scaffolding required.
- Errors are specific exception types raised from the relevant stage — `QualityGateRejection`, `SegmentationFailure`, etc. — caught once at the API layer and converted into ARCHITECTURE.md's standardized JSON error envelope (`{ error: { code, message, details } }`). Both gates in this pipeline (§2, §5.3) plug directly into error handling that already exists elsewhere in the system.

---

## 10. Performance Budget

**Target: under 5 seconds** for the full CV portion of this document (quality gate through feature extraction) on a typical single-worksheet photo. This does not include CNN inference time, which is `ML_PIPELINE.md`'s budget to define separately.

This number matters beyond raw UX: DESIGN.md's loading state is simulated/timed staged progress text, not real backend stage streaming — the fake progress sequence has to be calibrated against how long the backend actually takes, or the UI finishes "Analyzing..." before results actually arrive. It also needs to leave headroom for CNN inference on top of it, while keeping total end-to-end processing comfortably inside typical platform timeout windows (Railway/most reverse proxies default around 30–60s), since this is synchronous with no background job queue.

---

## 11. Testing Strategy

See **TESTING.md §4.1** — the single source of truth for this pipeline's unit test strategy (synthetic, ground-truth-asserting images, generated at test-run time) and how it fits into the full CI suite. (Superseded here; this section previously held that content directly.)

---

## 12. Known Risks & Open Items

- **Tunable constants** — the word-gap multiplier (§5.2, 2.5–3×) and all four quality-gate thresholds (§2) are starting defaults, not empirically validated. Flag for recalibration once real Phase 1 photos are flowing.
- **Letter-spacing approximation** — §6.2's within-word gap measurement is a rhythm/regularity proxy, not verified letter boundaries. Document this limitation wherever letter-spacing numbers are surfaced to teachers/parents.
- **Word-level CNN scope** — segmenting to word-level rather than letter-level (§1, §5) is a deliberate scope decision given cursive segmentation's difficulty, not an oversight. It does mean `ML_PIPELINE.md` needs to design around whole-word crops rather than isolated letters — flagged there, not resolved here.
