# ML Pipeline — Stage 1 Build & Inference Skeleton

**Date:** 2026-08-30
**Scope:** Build all ML pipeline components that don't depend on paired teacher-score data. Defer Stage 2 regression head and combined export until Phase 1 is live and collecting real data.
**Reference docs:** [ML_PIPELINE.md](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/ML_PIPELINE.md), [PRD.md §5/§11](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/PRD.md), [IMPLEMENTATION_STATUS.md](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/IMPLEMENTATION_STATUS.md) "Between Phases" block

---

## Context

The "Between Phases — Calibration" block in IMPLEMENTATION_STATUS.md is 0/6 complete. The ML pipeline is a new subsystem with no existing code (only an empty `backend/app/ml/__init__.py`). Phase 1 is not yet live, so no paired teacher-score data exists — making Stage 2 (regression head) and threshold/correlation analysis impossible to complete right now.

This spec covers everything that **can** be built independently: CCC dataset prep, Stage 1 fine-tuning, Stage 1 evaluation, and the deployed inference module skeleton (with stub). Stage 2 and export get placeholder scaffolding only.

---

## 1. CCC Dataset Prep — `training/convert_ccc.py`

**Purpose:** One-time conversion of CCC's proprietary `.chr` format into training-ready numpy arrays.

**Pipeline:**
1. Parse CCC `.chr` binary files (width, height, baseline/upperline metadata, 0/1 pixel matrix per character)
2. Convert each character to grayscale numpy array (0/1 → 0/255)
3. Pad to square (preserves stroke proportions, avoids distortion)
4. Resize to 96×96 (MobileNetV2's smallest Keras pretrained input size — ML_PIPELINE §2.3)
5. Save as `.npy` files organized by split and class label
6. Respect CCC's predefined split: 38,160 training pool / 19,133 test
7. Carve ~10% from training pool as validation (~34,300 train / ~3,800 val) — ML_PIPELINE §2.1
8. Output a manifest CSV: `filename, label, split`

**Output structure:**
```
training/data/processed/
├── train/          # ~34,300 .npy files
├── val/            # ~3,800 .npy files
├── test/           # 19,133 .npy files
└── manifest.csv
```

**CCC `.vec` files are ignored** — pre-extracted feature vectors would bypass the CNN entirely (ML_PIPELINE §2.2).

---

## 2. Stage 1 Fine-Tuning — `training/stage1_finetune.ipynb`

**Purpose:** Colab notebook that fine-tunes MobileNetV2 on CCC to learn cursive stroke features. This model is never deployed as-is — only its convolutional backbone carries forward.

**Environment:** Google Colab free GPU tier (ML_PIPELINE §7).

### 2.1 Data Loading
- Load `.npy` arrays and manifest from converted CCC dataset (uploaded to Google Drive)
- Build `tf.data.Dataset` pipelines for train/val splits
- Batch size: 32

### 2.2 Preprocessing
- Grayscale → 3-channel duplication (MobileNetV2 expects RGB)
- Normalize to [-1, 1] via `tf.keras.applications.mobilenet_v2.preprocess_input`
- Augmentation (training only):
  - Rotation: ±10–15° (capped — cursive letters confuse under heavy rotation, ML_PIPELINE §4.2)
  - Slight scale/translation
  - Mild elastic distortion

### 2.3 Model Architecture
```python
base = MobileNetV2(input_shape=(96, 96, 3), include_top=False, weights='imagenet')
x = GlobalAveragePooling2D()(base.output)
output = Dense(52, activation='softmax')(x)  # 26 upper + 26 lower
model = Model(inputs=base.input, outputs=output)
```

### 2.4 Two-Phase Training (ML_PIPELINE §4.1)

**Phase A — Head only:**
- Freeze entire MobileNetV2 base
- Optimizer: Adam, lr=1e-3
- Loss: categorical crossentropy
- ~5-10 epochs (head convergence)

**Phase B — Partial unfreeze:**
- Unfreeze top ~30% of MobileNetV2 layers (from ~`block_12` onward)
- Optimizer: Adam, lr=1e-5
- Early stopping on validation loss (patience ~5 epochs)

### 2.5 Checkpoint
- Save best model (by val_loss) to Google Drive as `.keras`
- Print validation accuracy/loss at end of each phase

---

## 3. Stage 1 Evaluation — `training/evaluate_stage1.py`

**Purpose:** Standalone script producing the exact metrics PRD §11 requires for the thesis.

**Input:** Best Stage 1 `.keras` checkpoint + CCC test set (19,133 characters, completely untouched during training)

**Output metrics:**
- Overall accuracy (target: ≥90% per PRD §11)
- Per-class precision, recall, F1-score (`sklearn.metrics.classification_report`)
- Macro-averaged precision/recall/F1
- 52×52 confusion matrix (heatmap image + CSV)

**Output location:** `training/results/stage1_evaluation/`
```
training/results/stage1_evaluation/
├── classification_report.txt
├── confusion_matrix.csv
├── confusion_matrix.png
└── summary.json    # {accuracy, macro_precision, macro_recall, macro_f1}
```

**Decision gate:** If accuracy is well under 90%, consider EfficientNet-B0 backbone per ML_PIPELINE §12.

---

## 4. Inference Module — `backend/app/ml/`

**Purpose:** The deployed inference code in the FastAPI service. Built with a stub so integration can be wired up and tested before a real model exists.

### 4.1 `backend/app/ml/model.py` — Model Loader

- **Production:** Downloads `.keras` artifact from Supabase Storage at container startup via FastAPI lifespan event. Failed load crashes startup (AGENTS.md §6 rule 13).
- **Dev/Test (stub mode):** When `ENVIRONMENT=test` or when `ENVIRONMENT=dev` and no model artifact URL is configured, loads a stub that returns plausible fake scores. This matches TESTING.md §3.2's existing stubbing convention.
- **Singleton:** Module-level reference, single Uvicorn worker (AGENTS.md §6 rule 15).

### 4.2 `backend/app/ml/inference.py` — Inference Function

```python
def run_letter_formation_inference(
    word_crops: list[np.ndarray],
) -> LetterFormationResult:
    """
    Takes word crops from CV pipeline (CV_PIPELINE §7 handoff),
    returns per-word letter_formation_score + aggregate {mean, std}.
    """
```

**Per-crop preprocessing:** pad-to-square → resize 96×96 → grayscale-to-3-channel → normalize [-1, 1]

**Output type (`LetterFormationResult`):**
```python
@dataclass
class WordFormationScore:
    word_index: int
    letter_formation_score: float  # clamped [0, 100]

@dataclass
class LetterFormationResult:
    word_scores: list[WordFormationScore]
    aggregate_mean: float
    aggregate_std: float
```

This maps directly to ML_PIPELINE §11's output schema additions (`letter_formation_score` per word, `letter_formation: {mean, std}` in aggregate).

**Stub behavior:** Returns scores drawn from `N(65, 15)`, clamped to [0, 100].

**Error handling:** Raises `ModelInferenceError` on failure, caught at the API layer into the standard error envelope (AGENTS.md §4).

### 4.3 `backend/app/ml/exceptions.py`

```python
class ModelInferenceError(Exception):
    """Raised when CNN inference fails on a word crop batch."""
```

---

## 5. Scaffolding & Placeholders

### 5.1 `training/` Directory

```
training/
├── convert_ccc.py              # Full implementation (§1)
├── stage1_finetune.ipynb       # Full implementation (§2)
├── evaluate_stage1.py          # Full implementation (§3)
├── stage2_calibrate.py         # Placeholder — skeleton + NotImplementedError
├── export_model.py             # Placeholder — skeleton + NotImplementedError
├── data/                       # Gitignored — raw + processed CCC data
├── results/                    # Gitignored — evaluation outputs
└── README.md                   # Workflow doc mapping to ML_PIPELINE.md
```

### 5.2 `stage2_calibrate.py` Placeholder

- Docstring: "Trains the regression head on frozen Stage 1 backbone using paired teacher-score / word-crop data from Phase 1. Cannot run until real paired data exists. See ML_PIPELINE.md §6."
- Argparse skeleton: `--paired-data-path`, `--stage1-checkpoint`, `--output-path`
- Architecture definition: frozen backbone + `GAP → Dense(64, relu) → Dense(1)`
- Target scale: 12.5 / 37.5 / 62.5 / 87.5 (ML_PIPELINE §6.4)
- Loss: MSE
- Body: `raise NotImplementedError("Awaiting paired data from Phase 1")`

### 5.3 `export_model.py` Placeholder

- Docstring: "Combines frozen Stage 1 backbone + trained Stage 2 head into a single .keras artifact for deployment. See ML_PIPELINE.md §7."
- Argparse skeleton: `--stage1-checkpoint`, `--stage2-checkpoint`, `--output-path`
- Body: `raise NotImplementedError("Awaiting trained Stage 2 head")`

### 5.4 `training/README.md`

Workflow document:
1. Download CCC dataset → `training/data/`
2. Run `python convert_ccc.py` → produces processed `.npy` files in `training/data/processed/`
3. Upload `data/processed/` to Google Drive
4. Open `stage1_finetune.ipynb` in Colab, run training, save checkpoint to Drive
5. Download checkpoint, run `python evaluate_stage1.py --checkpoint <path>` locally
6. Check `results/stage1_evaluation/summary.json` — target ≥90% accuracy
7. *(When paired data exists)* Run `python stage2_calibrate.py --paired-data-path <path> --stage1-checkpoint <path>`
8. *(After Stage 2)* Run `python export_model.py` → upload resulting `.keras` to Supabase Storage

### 5.5 `.gitignore` Additions

```
training/data/
training/results/
*.keras
*.h5
```

---

## 6. What's Explicitly NOT in Scope

| Item | Reason |
|---|---|
| Stage 2 regression-head training (real) | No paired data yet — placeholder only |
| Combined model export (real) | Depends on Stage 2 |
| Threshold/correlation analysis (Spearman's Rho) | Depends on paired data — separate task |
| API route integration (wiring inference into submission flow) | Separate bounded task after this |
| `SCORING_ENGINE` flag flip | Phase 2 integration — separate task |
| Visual overlay annotation generation | Unrelated to ML — separate task |

---

## 7. IMPLEMENTATION_STATUS Updates

After completion, update "Between Phases — Calibration" in IMPLEMENTATION_STATUS.md:

| Item | New Status |
|---|---|
| ML Stage 1 — CCC dataset prep (format conversion, split) | Done |
| ML Stage 1 — fine-tuning (two-phase) | Done |
| ML Stage 1 — evaluation (Accuracy/Precision/Recall/F1) | Done |
| ML Stage 2 — regression-head training/calibration | Not Started (placeholder built) |
| Export combined inference artifact (`.keras`) | Not Started (placeholder built) |
| Threshold/correlation analysis | Not Started (out of scope) |

---

## 8. Verification Plan

### Automated
- `uv run ruff check .` — backend lint passes with new `ml/` module
- `uv run pytest backend/tests/ml/` — shape/plumbing tests against stub (TESTING.md §4.2)
- `npx tsc --noEmit` — frontend unaffected but verify no breakage

### Manual
- Run `convert_ccc.py` against CCC dataset locally → verify output structure matches §1
- Run `stage1_finetune.ipynb` in Colab → verify training completes, checkpoint saves
- Run `evaluate_stage1.py` → verify metrics output, check accuracy against ≥90% target
- Import `backend.app.ml.inference` in dev → verify stub returns plausible scores
