# ML Pipeline Stage 1 Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all ML pipeline components that don't depend on paired teacher-score data — CCC dataset conversion, Stage 1 Colab notebook, Stage 1 evaluation script, deployed inference module (with stub), and placeholder scaffolding for deferred Stage 2 work.

**Architecture:** Two-stage CNN model (ML_PIPELINE.md). Stage 1 fine-tunes MobileNetV2 on CCC for character classification (learning stroke features). Stage 2 (deferred — placeholder only) will add a regression head trained on paired teacher scores. The inference module in `backend/app/ml/` loads a model at startup (or a stub in dev/test) and exposes a function the CV pipeline can call.

**Tech Stack:** TensorFlow/Keras, MobileNetV2, numpy, scikit-learn (for evaluation metrics), matplotlib (for confusion matrix visualization)

**Spec:** [`docs/superpowers/specs/2026-08-30-ml-pipeline-stage1-build.md`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/superpowers/specs/2026-08-30-ml-pipeline-stage1-build.md)

## Global Constraints

- Python >=3.13, TensorFlow >=2.21.0 (pinned in `pyproject.toml`)
- `training/` directory lives at repo root, never under `backend/` — training code is never deployed
- `training/data/` and `training/results/` are gitignored — no dataset files or model artifacts in git
- CNN inference is stubbed via `ENVIRONMENT=test` in CI (TESTING.md §3.2) — tests never need a real model
- Failed model load at startup crashes the container in production (AGENTS.md §6 rule 13)
- Single Uvicorn worker only (AGENTS.md §6 rule 15)
- `ModelInferenceError` caught into the standard `{error: {code, message, details}}` envelope
- No new pip dependencies for `backend/` — TensorFlow, numpy, and opencv are already present
- `training/` scripts may use additional deps (scikit-learn, matplotlib) installed ad hoc in Colab or locally — these are NOT added to `backend/pyproject.toml`
- Colab notebook targets free-tier T4 GPU for Stage 1 training

---

### Task 1: Inference Module — Exceptions & Data Models

Build the foundation types that `inference.py` and its tests depend on.

**Files:**
- Create: `backend/app/ml/exceptions.py`
- Create: `backend/app/ml/models.py`
- Test: `backend/tests/ml/__init__.py`, `backend/tests/ml/test_models.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `ModelInferenceError(Exception)` — used by `inference.py` (Task 2), API error handler
  - `WordFormationScore(word_index: int, letter_formation_score: float)` — dataclass
  - `LetterFormationResult(word_scores: list[WordFormationScore], aggregate_mean: float, aggregate_std: float)` — dataclass

- [x] Create test directory `backend/tests/ml/` and `__init__.py`
- [x] Write `backend/tests/ml/test_models.py` with 3 unit tests
- [x] Verify tests fail prior to implementation
- [x] Implement `backend/app/ml/exceptions.py` with `ModelInferenceError`
- [x] Implement `backend/app/ml/models.py` with dataclasses matching ML_PIPELINE §11
- [x] Run `uv run pytest tests/ml/test_models.py -v` (3 passed)
- [x] Run `uv run ruff check app/ml/ tests/ml/`
- [x] Commit: `feat(ml): add inference exceptions and output data models`

---

### Task 2: Inference Module — Model Loader & Inference Function

The core deployed code: loads a model (or stub) at startup, exposes `run_letter_formation_inference()`.

**Files:**
- Create: `backend/app/ml/model.py`
- Create: `backend/app/ml/inference.py`
- Modify: `backend/app/ml/__init__.py`
- Test: `backend/tests/ml/test_inference.py`

**Interfaces:**
- Consumes:
  - `ModelInferenceError` from `app.ml.exceptions` (Task 1)
  - `WordFormationScore`, `LetterFormationResult` from `app.ml.models` (Task 1)
  - `settings.ENVIRONMENT`, `settings.MODEL_STORAGE_BUCKET`, `settings.MODEL_ARTIFACT_PATH` from `app.core.config`
- Produces:
  - `load_model() -> None` — called at startup, sets module-level `_model` singleton
  - `get_model() -> Any` — returns the loaded model or None (stub mode)
  - `is_stub_mode() -> bool` — evaluates whether stub mode is active
  - `run_letter_formation_inference(word_crops: list[np.ndarray]) -> LetterFormationResult` — the public API

- [x] Write `backend/tests/ml/test_inference.py` with 9 plumbing tests (TESTING §4.2)
- [x] Verify tests fail prior to implementation
- [x] Implement `backend/app/ml/model.py` with production Supabase download and stub fallbacks
- [x] Implement `backend/app/ml/inference.py` with crop preprocessing (square-pad, 96×96, 3-ch, [-1, 1] normalize) and clamped score aggregation
- [x] Update `backend/app/ml/__init__.py` with module docstring and public exports
- [x] Run `uv run pytest tests/ml/ -v` (12 passed)
- [x] Run `uv run ruff check app/ml/ tests/ml/`
- [x] Commit: `feat(ml): add model loader and inference function with stub support`

---

### Task 3: FastAPI Lifespan Integration & Health Check

Wire the model loader into the app's startup sequence and update the health check to reflect real model status.

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_main.py`

**Interfaces:**
- Consumes:
  - `load_model()` from `app.ml.model` (Task 2)
  - `is_stub_mode()` from `app.ml.model` (Task 2)
- Produces:
  - FastAPI lifespan event that calls `load_model()` at startup
  - Updated `/api/health` endpoint reporting real `model_loaded` and `model_stub` status

- [x] Update `backend/tests/test_main.py` with assertions for `model_stub`
- [x] Verify tests fail prior to implementation
- [x] Modify `backend/app/main.py` with `asynccontextmanager` lifespan and updated `/api/health`
- [x] Run `uv run pytest tests/test_main.py -v` (2 passed)
- [x] Run broader test suite `uv run pytest tests/ -v --ignore=tests/api --ignore=tests/core`
- [x] Run `uv run ruff check app/main.py`
- [x] Commit: `feat(ml): wire model loader into FastAPI lifespan and update health check`

---

### Task 4: Training Scaffolding — Directory, README, Gitignore, Placeholders

Create the `training/` directory structure with workflow documentation, gitignore rules, and placeholder scripts for deferred Stage 2 work.

**Files:**
- Create: `training/README.md`
- Create: `training/stage2_calibrate.py`
- Create: `training/export_model.py`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `training/` directory structure matching ML_PIPELINE §9
  - Placeholder scripts with docstrings, argparse skeletons, and `NotImplementedError` bodies
  - Updated `.gitignore` excluding `training/data/`, `training/results/`, `*.keras`, `*.h5`

- [x] Update `.gitignore` with training data and artifact exclusions
- [x] Create `training/README.md` documenting Stage 1 and Stage 2 workflows
- [x] Create `training/stage2_calibrate.py` with argparse and `NotImplementedError`
- [x] Create `training/export_model.py` with argparse and `NotImplementedError`
- [x] Verify both CLI scripts display `--help` and raise errors on invocation
- [x] Commit: `chore(training): add directory scaffolding, README, and Stage 2 placeholders`

---

### Task 5: CCC Dataset Conversion Script

Full implementation of the format conversion pipeline — parses CCC's proprietary `.chr` format into training-ready numpy arrays.

**Files:**
- Create: `training/convert_ccc.py`

**Interfaces:**
- Consumes: CCC dataset `.chr` files in `training/data/raw/`
- Produces: processed `.npy` files in `training/data/processed/{train,val,test}/` + `manifest.csv`

- [x] Implement `training/convert_ccc.py` (`parse_chr_file`, `pad_to_square`, `process_character`, `discover_characters`, `convert_split`)
- [x] Verify train/val/test splitting logic (90/10 split with seed 42)
- [x] Verify `convert_ccc.py --help` output
- [x] Commit: `feat(training): add CCC dataset conversion script`

---

### Task 6: Stage 1 Fine-Tuning Colab Notebook

The training notebook for MobileNetV2 fine-tuning on CCC. Written as `.ipynb` for Colab's interactive GPU environment.

**Files:**
- Create: `training/stage1_finetune.ipynb`

**Interfaces:**
- Consumes: processed `.npy` files from `convert_ccc.py` (Task 5) uploaded to Google Drive
- Produces: Stage 1 `.keras` checkpoint saved to Google Drive

- [x] Build generator script to construct valid Jupyter notebook JSON
- [x] Output `training/stage1_finetune.ipynb` with 16 cells (Setup, Loading, Augmentation, MobileNetV2 model, Phase A head-only, Phase B partial unfreeze, Training curves)
- [x] Verify valid notebook JSON structure and clean up generator
- [x] Commit: `feat(training): add Stage 1 MobileNetV2 fine-tuning Colab notebook`

---

### Task 7: Stage 1 Evaluation Script

Full implementation of the evaluation script that produces thesis-ready metrics.

**Files:**
- Create: `training/evaluate_stage1.py`

**Interfaces:**
- Consumes: Stage 1 `.keras` checkpoint + processed CCC test set (19,133 characters)
- Produces: `training/results/stage1_evaluation/` — classification report, confusion matrix CSV/PNG, summary JSON

- [x] Implement `training/evaluate_stage1.py` (`load_test_data`, `preprocess_for_inference`, metrics via sklearn)
- [x] Output `classification_report.txt`, `confusion_matrix.csv`, `confusion_matrix.png`, and `summary.json`
- [x] Verify `evaluate_stage1.py --help` output
- [x] Commit: `feat(training): add Stage 1 evaluation script for thesis metrics`

---

### Task 8: Final Verification & Status Update

Run all checks, verify everything works together, and update IMPLEMENTATION_STATUS.md.

**Files:**
- Modify: `IMPLEMENTATION_STATUS.md`

- [x] Run full backend linter: `uv run ruff check .` (clean)
- [x] Run all ML unit tests: `uv run pytest tests/ml/ -v` (12 passed)
- [x] Run broader test suite: `uv run pytest tests/ -v --ignore=tests/api --ignore=tests/core` (71 passed)
- [x] Verify all 4 training CLI scripts `--help` outputs
- [x] Update `IMPLEMENTATION_STATUS.md` Between Phases section from 0 / 6 to 3 / 6
- [x] Commit: `docs: update IMPLEMENTATION_STATUS with ML Stage 1 completion`
