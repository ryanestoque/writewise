# WriteWise — ML_PIPELINE.md

**CNN Letter-Formation Model — Build Guide**

- **Document type:** Internal engineering build guide (companion to PRD.md, ARCHITECTURE.md, DESIGN.md, CV_PIPELINE.md)
- **Scope:** the CNN itself — architecture, training (both stages), evaluation, export, and deployed inference for letter-formation scoring. Picks up exactly where CV_PIPELINE.md §7 leaves off (a deskewed grayscale word crop) and ends at a per-word letter-formation score fed into the same `Measurement` output CV_PIPELINE.md defined (§8 there).
- **Status:** Draft v1

---

## 1. The Core Problem This Doc Solves

Two mismatches had to be resolved before any model code gets written:

1. **Training data is per-character; runtime input is per-word.** Both candidate datasets (Kaggle's original cursive alphabet set, and CCC/C-Cube — see §2) are individual character images. CV_PIPELINE.md §1/§5 already committed to word-level segmentation only, not letter-level, so the model has to somehow bridge single-character training to whole-word inference.
2. **"Letter formation quality" was never a labeled target in any available dataset.** CCC and Kaggle both label *which* letter an image shows, not *how well-formed* it is. There's no off-the-shelf ground truth for the actual thing this system needs to score.

**Resolution — a two-stage model:**

- **Stage 1 — Character classifier**, fine-tuned on CCC. Its real purpose isn't to ship as a production classifier — it's to force the convolutional backbone to learn strong, cursive-specific stroke features (loops, joins, proportions) from a large labeled dataset. This is also what satisfies PRD §11's stated CNN evaluation (Accuracy/Precision/Recall/F1 on a held-out split) — see §5.
- **Stage 2 — Letter-formation regression head**, built on top of Stage 1's backbone, trained on the paired raw-measurement/teacher-score dataset Phase 1 is already collecting for the OpenCV criteria (PRD §5). This calibrates formation-quality scoring against real teacher judgment, the same calibration philosophy the other four criteria use — see §6.

Considered and rejected: a sliding-window approach using known target-text letter counts to estimate rough letter positions within a word crop, then classifying each window and aggregating. This reintroduces the exact window-misalignment risk CV_PIPELINE.md already rejected letter-level segmentation over — just moved into the ML layer instead of the CV layer.

---

## 2. Dataset — CCC (Cursive Character Challenge / C-Cube)

Switched from the originally-scoped Kaggle cursive alphabet dataset to CCC (Idiap): 57,293 individual cursive characters, manually extracted from cursive words, including both upper- and lowercase letters, each with baseline/upperline/extreme-point metadata.

### 2.1 Split
CCC ships its own predefined split — **use it as-is**, rather than inventing a different ratio:
- **Training pool: 38,160 characters** → carve ~10% out as validation (~34,300 train / ~3,800 val).
- **Test: 19,133 characters** — kept completely untouched, used only for the final Stage 1 evaluation in §5. Using the benchmark's own split keeps results comparable to anything else published against CCC.

### 2.2 Format Conversion
CCC data is **not images** — it's a custom `.chr` bitmap format (width, height, baseline/upperline metadata, then a 0/1 pixel matrix per character). A one-time conversion script parses each `.chr` file into a grayscale numpy array (0/1 → 0/255).

CCC also ships a `.vec` format with 34-dimensional pre-extracted feature vectors per character. **These are not used** — feeding pre-extracted vectors instead of raw pixels would bypass the CNN entirely, defeating Stage 1's actual purpose (teaching the backbone stroke features from raw pixels).

### 2.3 Input Sizing
Character bitmaps are variable-sized; MobileNetV2 needs a fixed input. Pipeline: **pad to square** (preserves stroke proportions, avoids distortion) → **resize to 96×96** — the smallest of Keras's official MobileNetV2 pretrained-weight sizes, chosen to keep CPU inference fast for Stage 2's later per-word-crop cost at runtime (§8).

---

## 3. Backbone Architecture

**MobileNetV2** (`tf.keras.applications.MobileNetV2`), ImageNet-pretrained, fine-tuned on CCC.

Chosen over heavier options (ResNet50, VGG, etc.) for two reasons:
- **Deployment constraint** — inference runs in-process on the same single Railway container as everything else (ARCHITECTURE's decision, no GPU, no separate inference service), and a submission with multiple words means multiple forward passes per submission (§8). MobileNetV2's small footprint (~14MB) and CPU-inference speed fit this directly.
- **Team constraint** — it's the most heavily documented "default" transfer-learning backbone in Keras tutorials, which matters for a 4-person team building this for the first time under a tight deadline.

*(EfficientNet-B0 would likely edge out MobileNetV2 on raw accuracy for similar compute cost — a genuinely close call, but not worth the extra unfamiliarity given the timeline.)*

---

## 4. Stage 1 — Fine-Tuning on CCC

**Goal:** teach the backbone cursive-specific stroke features via character classification. This model is never deployed as-is — only its (later frozen) convolutional layers carry forward into Stage 2.

### 4.1 Two-Phase Fine-Tuning
- **Phase A** — freeze the entire MobileNetV2 base. Train only a new classification head (dense layer → softmax over CCC's character classes) for a handful of epochs, letting the new head adapt without disturbing pretrained ImageNet weights.
- **Phase B** — unfreeze the top portion of the base (not the earliest layers — those capture generic edges/textures that don't need to change). Continue training the whole thing at a much lower learning rate.

### 4.2 Augmentation
Small rotation (±10–15°, capped deliberately), slight scaling/translation, mild elastic distortion. The rotation ceiling matters specifically for cursive: some lowercase cursive letters are structurally similar to others under enough rotation, and confusing letter *identity* during Stage 1 would poison the feature-learning goal the whole stage exists for.

### 4.3 Training Schedule
- **Optimizer:** Adam. Learning rate ~1e-3 for the head-only phase (4.1 Phase A), dropping to ~1e-5 once the base unfreezes (Phase B).
- **Stopping criterion:** early stopping on validation loss (using the validation split carved out in §2.1), not a fixed epoch count.

---

## 5. Stage 1 Evaluation

Run once, after fine-tuning completes, against CCC's **untouched 19,133-character test set** (§2.1). This is the evaluation PRD §11 asks for directly: Accuracy, Precision, Recall, F1-Score. Lives in `training/` (§9) as a script run after training, not as a CI test that reruns on every push — results feed the thesis documentation, not a pass/fail gate.

---

## 6. Stage 2 — Letter-Formation Regression Head

### 6.1 Granularity: Per-Word Scoring
Calibration data (the teacher's `ManualScore`, PRD §5/§8) is entered **once per submission**, but inference runs **per word crop** (CV_PIPELINE.md's handoff unit). Resolution: each word crop is scored **independently**, then averaged across the submission for calibration against the teacher's single per-submission score.

Chosen over pooling embeddings first and scoring once, for two reasons: simpler to train (no variable-length pooling logic across submissions with different word counts), and it produces a **per-word letter-formation score for free** — exactly the granular, spatially-anchored data PRD §7.4's diagnostic overlay needs to point at *which word* has weak formation, matching how every other criterion in CV_PIPELINE.md's schema already works per-word.

### 6.2 Training Labels — A Known Limitation
The teacher's per-submission score is inherited as the training target by **every word crop from that submission** (weak labeling) — there's no finer-grained ground truth, since asking teachers to score individual words during Phase 1 would be a heavier ask on top of what they're already doing manually.

**This means:** the model learns "how good is formation on a typical word from a submission this teacher rated this way," not "how good is this specific word." The **submission-level average** is what's actually calibrated against real teacher judgment; individual per-word scores are a reasonable-but-unverified interpolation. Document this limitation wherever per-word scores are surfaced (§12).

### 6.3 Architecture
- **Backbone: frozen.** Stage 1 already fine-tuned MobileNetV2 on 57K+ CCC characters; Stage 2's calibration data is whatever Phase 1 produces — a small fraction of that in submission count. Continuing to fine-tune the full backbone on that little data risks bad overfitting.
- **Head:** `GlobalAveragePooling2D` → `Dense(64, relu)` → `Dense(1)` on top of the frozen embeddings.

### 6.4 Output — Already a Calibrated Score
Unlike the four OpenCV criteria, this head's output is **not** a raw pre-calibration measurement. CV_PIPELINE.md's criteria follow a two-step pattern: raw physical measurement → separately, PRD §5's "Between Phases" step derives threshold ranges mapping raw values to rubric bands. Stage 2's head is trained *directly* against teacher scores, so its output already lives in the same space as a calibrated score — the calibration is baked into training, not a downstream step.

**Target scale:** Phase 1's manual rubric entry is a segmented-button-group selection (a small discrete set, not a continuous slider), using the same 4-level qualitative bands already defined for diagnostic output — Needs Improvement / Developing / Satisfactory / Excellent. These map to representative points on the shared 0–100 scale the other criteria's calibrated scores live on: **12.5 / 37.5 / 62.5 / 87.5**, evenly split. The head trains against these numeric targets with MSE loss.

**Output clamping:** raw head output is clamped to [0, 100] as a cheap sanity guard (§10).

### 6.5 Integration with `ScoreProvider`
CV_PIPELINE.md's schema shape stays uniform — `letter_formation_score` added per word alongside the existing per-word fields, and `letter_formation: { mean, std }` added to `aggregate` alongside the other four criteria (full schema in §11). Nothing downstream (frontend, overlay renderer) needs special-case logic for a structurally different field.

What *does* differ is the `ScoreProvider`'s internal logic per criterion: for the four OpenCV criteria, it applies the threshold-mapping function derived from calibration analysis. For letter formation, it's an **identity passthrough** — the "raw" value already is the score. Same schema shape, different logic per criterion — consistent with `ScoreProvider` already being described in ARCHITECTURE §10 as a per-criterion abstraction, not a new pattern.

---

## 7. Training Operations

**Where training runs:** entirely offline, outside the Railway production container. Railway serves the finished artifact; it does not train it — mirrors how PRD §5 already frames calibration analysis as offline work.
- **Stage 1:** Google Colab's free GPU tier recommended — fine-tuning on 34K+ images benefits significantly from GPU access a Railway container doesn't have.
- **Stage 2:** light enough to run on CPU, even locally.

**Export:** the **combined final inference model** — frozen Stage 1 backbone + trained Stage 2 head — exported as a **single artifact**, not two files the FastAPI service has to stitch together at runtime. Format: plain Keras `.keras` (or TF SavedModel), matching PRD §10's TensorFlow/Keras stack.

**TFLite — deliberately deferred.** A legitimate CPU-inference speedup, but extra conversion-pipeline complexity to debug under a tight deadline, for a speed gain not yet confirmed necessary. Reasonable escape hatch if §8's performance budget turns out too optimistic once real numbers come in — not built preemptively against a hypothetical problem.

---

## 8. Deployed Inference

Per ARCHITECTURE, the exported artifact is downloaded from Supabase Storage and kept resident in memory on the Railway container via a FastAPI lifespan event (loaded once at startup, not per-request).

**Performance budget:** under **3 seconds total** CNN inference per submission (5–10 word crops through the frozen backbone + Stage 2 head on CPU). Combined with CV_PIPELINE.md's <5s CV-portion budget, that's **~8s total worst-case** — comfortably inside typical platform timeout windows (30–60s) and consistent with DESIGN.md's synchronous "Analyzing..." loading state. Like CV_PIPELINE.md's tunable constants, this is a target to validate against real hardware once the model is actually running on Railway, not a benchmarked number yet.

**Failure handling:**
- **Bad/edge-case word crop** — no separate confidence-estimation system (MC dropout, ensembles, predicted variance would be disproportionate effort given the post-segmentation gate, CV_PIPELINE.md §5.3, already exists specifically to keep garbage crops out). Just clamp output to [0, 100].
- **Model artifact fails to load at startup** — the container fails startup entirely (loud crash/restart, visible in Railway's log viewer) rather than coming up in a degraded "CV works, CNN doesn't" state. The CNN is core functionality, not optional.

---

## 9. Module Structure

Training code and deployed inference code are **not the same thing, deployed to the same place** — training never touches the Railway container (§7).

```
backend/app/ml/
├── model.py         # loads the .keras artifact once at startup, keeps it resident in memory
└── inference.py      # run_letter_formation_inference(word_crops) → per-word scores + aggregate

training/                # repo root, NOT under backend/app — never deployed
├── stage1_finetune.ipynb   # Colab notebook, CCC fine-tuning + §5 evaluation
├── stage2_calibrate.py     # regression head training on Phase 1 paired data
└── export_model.py          # combines both into the single deployable artifact
```

`inference.py` exposes a plain function (not a class), same convention as CV_PIPELINE.md's stages — takes the word crops CV_PIPELINE.md's pipeline already produced, returns data in the shape §11 defines. A specific exception type, `ModelInferenceError`, is raised on failure and caught at the same API layer into the existing standardized error envelope — no new error-handling pattern introduced here.

---

## 10. Testing Strategy

- **Stage 1** has real ground truth: CCC's held-out test set (§5). This is the actual PRD §11 evaluation, run in `training/`, not a repeated CI check.
- **Stage 2** has no equivalent — there's no synthetic way to fake "teacher-judged letter formation quality" the way CV_PIPELINE.md faked known angles and distances for its unit tests. Stage 2 gets **shape/plumbing tests only**: does `run_letter_formation_inference()` accept a word crop and return a float in [0, 100]; does it handle an empty word-crop list without crashing; does clamping actually clamp. These verify the code doesn't break — not that the model is good.

**Actual Stage 2 quality** is judged by the same offline Spearman's Rho correlation against real Phase 1 teacher scores that PRD §5 already runs for the OpenCV criteria — inherently offline, not a CI gate, same treatment CV_PIPELINE.md gave its own calibration validation.

---

## 11. Output Schema (extends CV_PIPELINE.md §8)

Adds to the existing `Measurement` JSON — same structure, new fields:

```json
{
  "lines": [
    {
      "line_index": 0,
      "words": [
        {
          "word_index": 0,
          "bbox": [x, y, w, h],
          "slant_deg": 7.2,
          "baseline_deviation_ratio": 0.04,
          "size_ratio": 0.91,
          "letter_formation_score": 71.4
        }
      ]
    }
  ],
  "aggregate": {
    "slant": { "mean": 6.8, "std": 1.4 },
    "word_spacing": { "mean": 1.93, "std": 0.15 },
    "letter_spacing": { "mean": 0.33, "std": 0.06 },
    "baseline_deviation": { "mean": 0.05, "std": 0.02 },
    "size_consistency": { "mean": 0.89, "std": 0.08 },
    "letter_formation": { "mean": 74.2, "std": 9.6 }
  }
}
```

`letter_formation_score` and `letter_formation.mean/std` are the only new fields — everything else is exactly CV_PIPELINE.md §8's schema, unchanged.

---

## 12. Known Risks & Open Items

- **Weak-labeling limitation (§6.2)** — per-word letter-formation scores are an unverified interpolation from a submission-level teacher score, not individually verified ground truth. State this plainly wherever per-word scores reach a teacher or parent.
- **MobileNetV2 vs. EfficientNet-B0 (§3)** — a close call decided in favor of team familiarity and documentation availability over a possible small accuracy edge. Worth revisiting only if Stage 1's held-out evaluation (§5) comes in well under the 90% target PRD §11 sets.
- **Performance budget (§8)** — the <3s / ~8s total figures are targets, not benchmarks. Validate against real Railway hardware once the exported model is actually deployed; TFLite conversion (§7) is the fallback if these prove too optimistic.
- **Stage 2 has no automated accuracy gate (§10)** — by design, since none is possible without real teacher-scored data. This makes the offline Spearman's Rho step from PRD §5 not just a nice-to-have validation, but the *only* signal that Stage 2 actually works. Don't let it slip on the timeline.
