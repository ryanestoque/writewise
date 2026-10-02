# Documentation Sync — HTR, Diagnostic Engine, Tracing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 11 companion docs, AGENTS.md, IMPLEMENTATION_STATUS.md, `.env.example`, and `training/README.md` into sync with three fully-implemented features that have zero or near-zero coverage in the authoritative build guides: (1) HTR / target text verification, (2) the diagnostic engine module, (3) stroke skeleton tracing & letter zoning.

**Architecture:** Documentation-only changes — no code modifications. Each task targets one or two closely-related docs with specific, concrete edit instructions. Tasks are ordered by dependency: docs that other docs cross-reference (ARCHITECTURE.md, CV_PIPELINE.md, ML_PIPELINE.md) come first, downstream docs (API_SPEC.md, TESTING.md, DEPLOYMENT.md) follow.

**Tech Stack:** Markdown only. No tooling.

**Spec:** This plan is its own spec — it was derived from a full codebase audit against all docs (conversation `39a35360-316b-4288-8e9a-b0341122deb0`).

## Global Constraints

- Do not change the voice, formatting style, or structural conventions of any doc — each doc has its own established tone and section numbering scheme; edits should read like they were always there.
- Do not reorganize existing sections or renumber existing section references — append new sections at the logical insertion point.
- Every new section or addition must cite the ADR, code file, or companion doc it relates to (matching the existing citation style of each doc).
- Preserve all existing comments, text, and content that is unrelated to these three features.
- When adding error codes to API_SPEC.md, maintain alphabetical ordering within the HTTP status group.
- When updating IMPLEMENTATION_STATUS.md, also update the summary counts table and the "Last updated" date.

---

### Task 1: ARCHITECTURE.md — Repo Map + Diagnostic Engine Section

**Files:**
- Modify: `docs/ARCHITECTURE.md:50-66` (§2 repo map)
- Modify: `docs/ARCHITECTURE.md` (add new section after the current last numbered section)

**Interfaces:**
- Consumes: Current ARCHITECTURE.md structure, `backend/app/diagnostic/` module layout
- Produces: Updated repo map that later tasks (AGENTS.md, TESTING.md) can reference; new diagnostic engine section that API_SPEC and DESIGN can point to

- [ ] **Step 1: Update the §2 repo map**

In the `backend/app/` tree inside the code fence at `docs/ARCHITECTURE.md` §2, add two new entries so the tree becomes:

```
│   ├── app/
│   │   ├── api/          # route handlers
│   │   ├── cv/            # OpenCV pipeline + quality gate
│   │   ├── diagnostic/    # diagnostic overlay engine (measurement → feedback)
│   │   ├── ml/             # CNN inference, HTR text recognition, model loaders
│   │   ├── scoring/         # ManualScoreProvider / CalibratedScoreProvider
│   │   └── core/              # config, auth, error handling
```

Changes:
1. Add `├── diagnostic/    # diagnostic overlay engine (measurement → feedback)` between `cv/` and `ml/`.
2. Change `ml/` comment from `# CNN inference wrapper, model loader` to `# CNN inference, HTR text recognition, model loaders` (reflects that `ml/` now contains both `inference.py` and `htr.py`).

Also add `training/` to the top-level tree if not already present:

```
├── training/            # offline model training scripts + HTR fine-tuning (never deployed)
```

- [ ] **Step 2: Add §X — Diagnostic Engine section**

Add a new section (use the next available section number) after the existing last section. Content:

```markdown
## [N]. Diagnostic Engine

The diagnostic engine (`backend/app/diagnostic/`) is a pure-functional Python module that transforms raw CV/ML pipeline measurements (CV_PIPELINE.md §8, ML_PIPELINE.md §11) into the human-readable feedback rendered in both Teacher and Parent portals. It is intentionally separated from signal processing (`app/cv/`) and scoring (`app/scoring/`) — it consumes their outputs but never modifies them.

**Module structure:**

backend/app/diagnostic/
├── __init__.py
├── models.py      # Pydantic models for typed overlay/annotation shapes
├── rules.py       # threshold-to-band mapping, coaching tip selection
└── engine.py      # generate_diagnostic_overlay(raw_output) → overlay JSON

**How it fits:** the submission-upload endpoint (`app/api/submissions.py`) calls `generate_diagnostic_overlay()` synchronously after scoring completes, persisting the result as the `measurement.overlay` JSON field (DATABASE.md §8). The frontend reads this field via direct Supabase reads (RLS-gated) and renders it as an interactive SVG overlay — no additional API call needed.

**Design rationale:** keeping diagnostic logic as a deterministic function with its own typed models (not inline in the API handler or mixed into CV code) means the overlay output is independently testable and the coaching-tip rules can evolve without touching pipeline or scoring code.
```

- [ ] **Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: update ARCHITECTURE.md repo map and add diagnostic engine section"
```

---

### Task 2: AGENTS.md — Repo Map + Rule #13 Clarification

**Files:**
- Modify: `AGENTS.md` (§2 repo map, §6 hard rules)

**Interfaces:**
- Consumes: ARCHITECTURE.md repo map update from Task 1
- Produces: Consistent repo map in AGENTS.md; clarified Rule #13

- [ ] **Step 1: Update §2 repo map**

Mirror the same repo map changes from Task 1 into AGENTS.md §2:

1. Add `│   │   ├── diagnostic/    # diagnostic overlay engine (measurement → feedback)` between `cv/` and `ml/`.
2. Change `ml/` comment from `# CNN inference wrapper, model loader` to `# CNN inference, HTR text recognition, model loaders`.

- [ ] **Step 2: Clarify Rule #13**

Current Rule #13:
> The CNN model loads from Supabase Storage at container startup. Never bundle it in git; a failed load should crash startup loudly, not degrade silently.

Add a clarifying note immediately after Rule #13 (not a new rule — a parenthetical or sub-bullet):

> *(This applies to the scoring CNN artifact. The HTR model (`app/ml/htr.py`) follows a different pattern by design: it falls back to stub mode on failed load rather than crashing, because target text verification is a quality gate enhancement, not core scoring functionality. See ADR 0003.)*

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md repo map and clarify Rule #13 for HTR model"
```

---

### Task 3: CV_PIPELINE.md — HTR Pipeline Step + Tracing Section

**Files:**
- Modify: `docs/CV_PIPELINE.md:13-47` (§1 pipeline diagram)
- Modify: `docs/CV_PIPELINE.md:167-173` (between §7 CNN Handoff and §8 Output Schema — insert new §7b)
- Modify: `docs/CV_PIPELINE.md:219-231` (§9 module structure)

**Interfaces:**
- Consumes: `backend/app/ml/htr.py` implementation, `backend/app/cv/tracing.py` implementation
- Produces: Pipeline diagram that ML_PIPELINE.md and API_SPEC.md can reference for the HTR step; documented tracing module

- [ ] **Step 1: Update §1 pipeline overview diagram**

After step 7 (Post-Segmentation Gate) and before step 8 (Feature Extraction), insert a new step. And after step 9 (Output Assembly), add step 10.

The updated diagram should look like:

```
...
7. Post-Segmentation Gate ─────── reject (detected word count vs. target text)
      │
      ▼
7b. Target Text Verification ──── reject (HTR-detected text ≠ target text)
    (HTR model, cursive-aware Levenshtein — see ADR 0003)
      │
      ▼
8. Feature Extraction (slant, spacing, baseline, size — per word, on binarized image)
      │
      ▼
9. Output Assembly ──┬── Raw measurement JSON (→ Measurement record)
                     └── Grayscale word crops (→ CNN inference, ML_PIPELINE.md)
      │
      ▼
10. Stroke Tracing ──┬── SVG vector stroke paths (→ letter tracing overlay)
                     └── Letter zone segmentation (→ diagnostic feedback)
```

- [ ] **Step 2: Add §7b — Target Text Verification section**

Insert a new section between §7 (CNN Handoff) and §8 (Output Schema). Content:

```markdown
### 7b. Target Text Verification (HTR)

Before passing word crops to CNN scoring, the pipeline verifies that the student actually wrote the target words specified in the activity — not different words or garbled scribbles. Full architectural rationale is in **ADR 0003** (`docs/adr/0003-htr-and-target-text-verification.md`); this section covers the pipeline integration only.

**Step sequence** (runs after post-segmentation gate, before feature extraction):

1. **Ruling line suppression** — HSV color filtering (blue/red notebook lines) + morphological horizontal line extraction, preserving vertical stroke intersections. Prevents guide lines from being read as text.
2. **Preprocessing** — each word crop is resized to 32px height (aspect-ratio preserved), padded to 128×32 with white background, normalized to [0, 1]. Matches the fixed input shape of the CTC sequence model.
3. **CTC inference** — a lightweight SimpleHTR model (separate `.keras` artifact from the scoring CNN, loaded at startup from Supabase Storage) transcribes each word crop independently via greedy best-path decoding.
4. **Cursive-aware Levenshtein verification** — a custom similarity metric with reduced penalty (0.25 instead of 1.0) for known cursive confusion pairs (`a`↔`e`, `n`↔`u`, `l`↔`t`, etc.). Combined score = 50% global string similarity + 50% word-level average. Passes if ≥ 0.65 combined and no individual word < 0.60.

**Rejection:** submissions failing verification are rejected with error code `TARGET_TEXT_MISMATCH` (422), following the same rejected-`Submission` persistence pattern as the quality gate (§2) and post-segmentation gate (§5.3).

**Bypass:** the submission endpoint accepts an optional `bypass_text_check` flag (API_SPEC §3.3) allowing teachers to override HTR rejection when the handwriting is legitimate but the model misreads it.

**Stub mode:** in `ENVIRONMENT=test` or dev without `HTR_MODEL_ARTIFACT_PATH` configured, the HTR model falls back to a deterministic stub that accepts all submissions — unblocking development and CI without requiring a real model artifact. Unlike the scoring CNN (AGENTS.md §6 Rule #13), this graceful fallback is intentional: target text verification is a quality gate enhancement, not core scoring.
```

- [ ] **Step 3: Add §10 — Stroke Tracing & Letter Zoning section**

Insert a new section after §9 (Output Schema). Content:

```markdown
## 10. Stroke Tracing & Letter Zoning

Post-pipeline module (`backend/app/cv/tracing.py`) that generates explainable visual feedback artifacts from word crops, consumed by the diagnostic overlay engine (`backend/app/diagnostic/`).

### 10.1 Morphological Skeleton
Converts binary word crops into 1-pixel-wide stroke skeletons via iterative morphological thinning. The skeleton represents the pen's centerline path — used for SVG vector stroke rendering at arbitrary zoom levels without rasterization artifacts.

### 10.2 SVG Path Extraction
Traces the skeleton into ordered contour paths, simplified via `cv2.approxPolyDP`, and exported as canvas-space polyline coordinates. The frontend renders these as `<polyline>` SVG elements, enabling the letter tracing overlay to show the exact stroke path the student produced.

### 10.3 Letter Zone Segmentation
Segments a cursive word crop into approximate letter zones using vertical stroke-density projection. Each zone is a `LetterZone` with a character label (from the activity's target text), bounding box, and optional confidence. This provides spatially-anchored letter-level feedback without requiring the fragile full letter segmentation this pipeline deliberately avoids (§1, §5).
```

- [ ] **Step 4: Update §9 module structure**

Add `tracing.py` to the module tree in §9:

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
├── pipeline.py             # orchestrator — chains stages, assembles §8 output
└── tracing.py              # §10 — stroke skeleton, SVG paths, letter zoning
```

- [ ] **Step 5: Renumber §10–§12 → §11–§13**

Existing §10 (Performance Budget), §11 (Testing Strategy), and §12 (Known Risks) shift to §11, §12, §13.

- [ ] **Step 6: Commit**

```bash
git add docs/CV_PIPELINE.md
git commit -m "docs: add HTR verification step and tracing section to CV_PIPELINE.md"
```

---

### Task 4: ML_PIPELINE.md — HTR Model Documentation

**Files:**
- Modify: `docs/ML_PIPELINE.md` (add new section, update §9 module structure)

**Interfaces:**
- Consumes: `backend/app/ml/htr.py`, `training/train_htr.ipynb`, ADR 0003
- Produces: Documented second model artifact that DEPLOYMENT.md and TESTING.md can reference

- [ ] **Step 1: Add §X — HTR Model (Target Text Verification) section**

Insert a new section after §8 (Deployed Inference) and before §9 (Module Structure). Content:

```markdown
## [N]. HTR Model — Target Text Verification

A second, separate model artifact alongside the scoring CNN — a lightweight CTC-based Handwritten Text Recognition (HTR) model used to verify that uploaded handwriting matches the activity's target prompt. Full design rationale in **ADR 0003**.

### [N].1 Architecture
SimpleHTR — a CTC sequence model trained on the IAM Words dataset. Input: 128×32 grayscale image (width-first, single channel). Output: character probability sequence decoded via CTC greedy best-path. Vocabulary: 79 characters (78 printable + `[UNK]`).

### [N].2 Deployment
Same pattern as the scoring CNN (§8): `.keras` artifact downloaded from Supabase Storage at container startup, kept resident in memory as a module-level singleton (`backend/app/ml/htr.py`).

**Key difference from the scoring CNN:** a failed HTR model load **does not** crash the container. It falls back to stub mode (all submissions pass verification). This is intentional — target text verification is a quality gate enhancement, not core scoring functionality. The scoring CNN, by contrast, *must* crash on failed load (AGENTS.md §6 Rule #13) because it is core functionality.

### [N].3 Integration Point
Called by `cv/pipeline.py` after the post-segmentation gate (CV_PIPELINE.md §7b), before feature extraction. See CV_PIPELINE.md §7b for the full step sequence.

### [N].4 Training
Fine-tuned from a pretrained SimpleHTR checkpoint on cursive word samples. Training notebook: `training/train_htr.ipynb`. Artifact: `simplehtr_iam.keras`, uploaded to the `model-artifacts` Supabase Storage bucket alongside the scoring CNN artifact.
```

- [ ] **Step 2: Update §9 module structure**

Add `htr.py` to the `backend/app/ml/` tree:

```
backend/app/ml/
├── __init__.py      # model loading orchestration at startup
├── model.py         # loads the scoring .keras artifact once at startup
├── inference.py      # run_letter_formation_inference(word_crops) → per-word scores + aggregate
├── htr.py            # HTR model: load, preprocess, CTC inference, target text verification
├── models.py         # Pydantic response models for ML outputs
└── exceptions.py     # ModelInferenceError
```

- [ ] **Step 3: Commit**

```bash
git add docs/ML_PIPELINE.md
git commit -m "docs: add HTR model section and update module structure in ML_PIPELINE.md"
```

---

### Task 5: API_SPEC.md — Error Catalog + Submission Endpoint Updates

**Files:**
- Modify: `docs/API_SPEC.md:56-81` (§2.4 error catalog)
- Modify: `docs/API_SPEC.md` (§3.3 submission endpoint — add `bypass_text_check`)

**Interfaces:**
- Consumes: `backend/app/api/submissions.py` (error codes, `bypass_text_check` parameter)
- Produces: Complete, accurate error catalog and submission contract

- [ ] **Step 1: Add `TARGET_TEXT_MISMATCH` to the §2.4 error catalog**

Add a new row to the error code table, placed after the `SEGMENTATION_COUNT_MISMATCH` row (maintaining HTTP status ordering):

```markdown
| `TARGET_TEXT_MISMATCH` | 422 | CV_PIPELINE §7b (HTR target text verification — detected text does not match activity target) |
```

- [ ] **Step 2: Update §3.3 submission upload endpoint**

In the `POST /api/submissions` section, add `bypass_text_check` to the request documentation:

In the request section, add the optional query parameter or request field:

```markdown
`bypass_text_check` (optional, boolean, default `false`): If `true`, skips HTR target text verification even if the HTR model detects a mismatch. Allows teachers to override false-positive HTR rejections when the handwriting is legitimate but the model misreads it. Ignored if the HTR model is in stub mode.
```

In the error responses subsection (if one exists), add:

```markdown
| `422 TARGET_TEXT_MISMATCH` | HTR model detected that the uploaded text does not match the activity's target text. Details include `detected_text` and `similarity_score`. Can be bypassed by retrying with `bypass_text_check: true`. |
```

- [ ] **Step 3: Commit**

```bash
git add docs/API_SPEC.md
git commit -m "docs: add TARGET_TEXT_MISMATCH error code and bypass_text_check to API_SPEC.md"
```

---

### Task 6: TESTING.md — HTR Stub Mode + Integration Test Cases

**Files:**
- Modify: `docs/TESTING.md:50-57` (§3.2 — expand CNN mocking to cover HTR)
- Modify: `docs/TESTING.md:95-103` (§4.2 — add HTR unit test section)
- Modify: `docs/TESTING.md:118-134` (§5 — add HTR integration test cases)

**Interfaces:**
- Consumes: `backend/app/ml/htr.py` stub mode behavior, `backend/tests/api/test_submissions.py`
- Produces: Complete test documentation covering both model artifacts

- [ ] **Step 1: Expand §3.2 to cover HTR mocking**

After the existing §3.2 CNN mocking content, add a new subsection or paragraph:

```markdown
**HTR model mocking** follows the same pattern: `app.ml.htr` uses a module-level singleton loaded at startup. In `ENVIRONMENT=test`, it activates stub mode automatically — `verify_target_text()` returns `(True, target_text, 1.0)` for all inputs, and `predict_word_text()` returns an empty string. Unlike the CNN mock (which prevents startup failure), the HTR stub is the module's own built-in fallback — no test-specific patching needed. This also applies in dev when `HTR_MODEL_ARTIFACT_PATH` is empty or unset.
```

- [ ] **Step 2: Add §4.X — HTR Unit Tests**

Add a new subsection after §4.2 (or as §4.2b). Content:

```markdown
### 4.[N] HTR / Target Text Verification Tests (`backend/app/ml/htr.py`)

| Function | Ground-truth test |
|---|---|
| `suppress_notebook_rulings()` | Synthetic image with colored horizontal lines → lines removed, vertical strokes preserved |
| `preprocess_word_crop_htr()` | Known input dimensions → output shape `(128, 32, 1)`, values in `[0, 1]` |
| `ctc_greedy_decode()` | Known probability matrix → expected decoded string (tests blank collapsing and repeated-character merging) |
| `levenshtein_similarity()` | Known string pairs → expected similarity scores; confusion pairs (`a`↔`e`) → reduced penalty verified |
| `verify_target_text()` in stub mode | Returns `(True, target_text, 1.0)` regardless of input |
```

- [ ] **Step 3: Add HTR integration test cases to §5 table**

Add these rows to the integration test table:

```markdown
| Valid submission, HTR text matches target | `201`, submission proceeds to scoring |
| Valid submission, HTR text does not match target | `422 TARGET_TEXT_MISMATCH`, rejected `Submission` row persisted |
| Submission with `bypass_text_check=true` despite HTR mismatch | `201`, submission proceeds despite mismatch |
```

- [ ] **Step 4: Commit**

```bash
git add docs/TESTING.md
git commit -m "docs: add HTR stub mode and test cases to TESTING.md"
```

---

### Task 7: DEPLOYMENT.md + `.env.example` — HTR Environment Variable

**Files:**
- Modify: `docs/DEPLOYMENT.md:74-82` (§6 environment variables)
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `backend/app/core/config.py` (`HTR_MODEL_ARTIFACT_PATH` setting)
- Produces: Complete env var documentation for both model artifacts

- [ ] **Step 1: Update DEPLOYMENT.md §6**

In §6, after the existing bullet 4 about `MODEL_ARTIFACT_PATH`, add:

```markdown
5. `HTR_MODEL_ARTIFACT_PATH` similarly doesn't need a real value until the HTR model is trained and uploaded (see ML_PIPELINE.md §[N]) — empty or omitted in dev activates stub mode, which is the intended local behavior.
```

- [ ] **Step 2: Update `.env.example`**

Add the `HTR_MODEL_ARTIFACT_PATH` variable to `backend/.env.example`:

```
HTR_MODEL_ARTIFACT_PATH=
```

Place it after the existing `MODEL_ARTIFACT_PATH=` line, maintaining the logical grouping of model-related variables.

- [ ] **Step 3: Commit**

```bash
git add docs/DEPLOYMENT.md backend/.env.example
git commit -m "docs: add HTR_MODEL_ARTIFACT_PATH to DEPLOYMENT.md and .env.example"
```

---

### Task 8: SECURITY.md — HTR Model Artifact Threat Note

**Files:**
- Modify: `docs/SECURITY.md` (§1 threat model, in-scope item #4)

**Interfaces:**
- Consumes: Existing threat model, HTR model loading behavior
- Produces: Threat model that acknowledges both model artifacts

- [ ] **Step 1: Expand threat item #4 or add a sub-note**

In §1's in-scope threat list, item #4 ("Malicious or malformed file upload") already covers the CV pipeline. The HTR model artifact is a different attack surface — a tampered `.keras` file in Supabase Storage could cause arbitrary code execution when loaded by TensorFlow.

Add a new in-scope threat item (or a sub-bullet under #4):

```markdown
[N]. **Tampered model artifact** — both the scoring CNN and the HTR model are `.keras` files downloaded from Supabase Storage at container startup. A compromised Storage bucket or a malicious model file could execute arbitrary code during `tf.keras.models.load_model()`. Mitigated by: Storage bucket is private (no public access), only the two named key-holders have write access to `writewise-prod` Storage (§2.1), and the model files are uploaded manually by the team — never by user input or an automated pipeline.
```

- [ ] **Step 2: Commit**

```bash
git add docs/SECURITY.md
git commit -m "docs: add model artifact tampering threat to SECURITY.md"
```

---

### Task 9: IMPLEMENTATION_STATUS.md — Add Missing Items + Update Counts

**Files:**
- Modify: `IMPLEMENTATION_STATUS.md`

**Interfaces:**
- Consumes: All previous tasks (what's actually built)
- Produces: Accurate, current implementation tracker

- [ ] **Step 1: Update "Last updated" date**

Change line 5 from:
```
**Last updated:** 2026-09-23
```
to:
```
**Last updated:** 2026-10-02
```

- [ ] **Step 2: Add HTR / Target Text Verification to the CV Pipeline table**

In the §Phase 1 CV Pipeline table, add a new row after "CNN handoff crop generation":

```markdown
| HTR target text verification | Done | CTC model + cursive-aware Levenshtein verification in `app/ml/htr.py`; integrated in submission pipeline; `bypass_text_check` override; stub mode for dev/test | CV_PIPELINE §7b, ADR 0003 |
```

- [ ] **Step 3: Add Stroke Tracing to the CV Pipeline table**

Add another row:

```markdown
| Stroke skeleton tracing & letter zoning | Done | SVG vector paths + letter zone segmentation in `app/cv/tracing.py`; consumed by diagnostic overlay | CV_PIPELINE §10 |
```

- [ ] **Step 4: Add HTR training to the Between Phases table**

Add a row to the Between Phases table:

```markdown
| HTR model fine-tuning (SimpleHTR on IAM Words) | Done | Training notebook `training/train_htr.ipynb`; artifact `simplehtr_iam.keras` uploaded to Storage | ML_PIPELINE §[N], ADR 0003 |
```

- [ ] **Step 5: Update summary counts table**

Recalculate the Done/Total counts for each phase based on the new rows and update the summary table at the top. Specifically:
- Phase 1 CV Pipeline: was 11/11, now includes HTR + tracing = adjust total and done count
- Between Phases: was 4/7 (+3 code-ready), now includes HTR training = adjust counts

- [ ] **Step 6: Commit**

```bash
git add IMPLEMENTATION_STATUS.md
git commit -m "docs: update IMPLEMENTATION_STATUS.md with HTR, tracing, and current counts"
```

---

### Task 10: training/README.md — HTR Training Workflow

**Files:**
- Modify: `training/README.md`

**Interfaces:**
- Consumes: `training/train_htr.ipynb`, `simplehtr_iam.keras` artifact
- Produces: Complete training workflow documentation

- [ ] **Step 1: Update directory structure**

Add `train_htr.ipynb` to the directory structure listing:

```
training/
├── convert_ccc.py           # Step 1: CCC format conversion
├── stage1_finetune.ipynb    # Step 2: Fine-tune MobileNetV2 on CCC (Colab)
├── evaluate_stage1.py       # Step 3: Stage 1 evaluation metrics
├── stage2_calibrate.py      # Step 4: Regression head (needs paired data)
├── export_model.py          # Step 5: Combine into deployable artifact
├── train_htr.ipynb          # HTR: Fine-tune SimpleHTR on IAM Words (Colab)
├── data/                    # Gitignored — dataset files
│   ├── raw/                 # Raw CCC download (.chr files)
│   └── processed/           # Output of convert_ccc.py (.npy files)
└── results/                 # Gitignored — evaluation outputs
```

- [ ] **Step 2: Add HTR training workflow section**

After the existing "Stage 2 (Calibration & Production Export)" section, add:

```markdown
### HTR Model (Target Text Verification)

Separate from the scoring CNN pipeline above — this trains the SimpleHTR model used to verify that uploaded handwriting matches the activity's target text (see ADR 0003).

1. **Open** `train_htr.ipynb` in Google Colab, connect to GPU runtime
2. **Train** — the notebook handles IAM Words dataset loading, preprocessing, and CTC model training
3. **Download** the resulting `.keras` artifact (e.g., `simplehtr_iam.keras`)
4. **Upload to Supabase Storage** — upload to the `model-artifacts` bucket alongside the scoring CNN artifact
5. **Set env var** — set `HTR_MODEL_ARTIFACT_PATH=simplehtr_iam.keras` in the backend `.env` / Railway dashboard
```

- [ ] **Step 3: Commit**

```bash
git add training/README.md
git commit -m "docs: add HTR training workflow to training/README.md"
```

---

### Task 11: Final Review — Cross-Reference Consistency Check

**Files:**
- Review: all files modified in Tasks 1–10

**Interfaces:**
- Consumes: all changes from Tasks 1–10
- Produces: verified cross-references

- [ ] **Step 1: Verify section number references**

Check that all cross-references between docs use the correct section numbers after any renumbering:
- CV_PIPELINE.md §7b referenced correctly from ML_PIPELINE.md, API_SPEC.md, TESTING.md
- ML_PIPELINE.md's new HTR section number referenced correctly from CV_PIPELINE.md §7b, DEPLOYMENT.md, training/README.md
- ARCHITECTURE.md's new diagnostic engine section number referenced correctly

- [ ] **Step 2: Verify ADR 0003 references**

Confirm ADR 0003 is referenced from:
- CV_PIPELINE.md §7b
- ML_PIPELINE.md HTR section
- AGENTS.md Rule #13 clarification
- IMPLEMENTATION_STATUS.md HTR row

- [ ] **Step 3: Verify error code completeness**

Confirm `TARGET_TEXT_MISMATCH` appears in:
- API_SPEC.md §2.4 error catalog
- TESTING.md §5 integration test table

- [ ] **Step 4: Commit any cross-reference fixes**

```bash
git add -A
git commit -m "docs: fix cross-references across doc sync changes"
```
