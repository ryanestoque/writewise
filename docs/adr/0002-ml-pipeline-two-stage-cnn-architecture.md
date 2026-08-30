# ADR 0002: ML Pipeline Two-Stage CNN & Inference Architecture

- **Status:** Accepted / Implemented (Stage 1 & Inference Subsystem)
- **Date:** 2026-08-30
- **Authors:** WriteWise Engineering Team
- **Implements:** `ML_PIPELINE.md` §2–§11; `PRD.md` §5, §11; `ARCHITECTURE.md` §8; `IMPLEMENTATION_STATUS.md` Between Phases

---

## 1. Context & Problem Statement

WriteWise evaluates cursive handwriting worksheets against five criteria, with **Letter Formation** being the primary non-geometric criterion. Unlike slant, spacing, baseline alignment, and size consistency (which are solved by deterministic OpenCV algorithms in ADR 0001), letter formation requires deep representation learning to recognize cursive stroke aesthetics, curvature, and topological correctness.

However, developing the machine learning component presents unique challenges:
1. **Scarcity of Paired Rubric Data at Launch:** Real Grade 3 worksheets with verified multi-teacher rubric scores do not exist prior to Phase 1 data collection.
2. **Computational Budget & Deployment Constraints:** The system runs on a lean single-worker container on Railway (CPU inference, 512MB–1GB RAM target) and must execute in < 2 seconds per submission.
3. **Continuous Integration & Local Testability:** CI environments and local developer setups cannot require downloading or hosting multi-megabyte model artifacts just to run test suites.
4. **Separation of Training vs. Serving:** Training involves GPU acceleration (Colab), large raw datasets (CCC/C-Cube), and specialized data science libraries (`scikit-learn`, `matplotlib`) that must never bloat the production backend service.

---

## 2. Decision Drivers

- **Phased Decoupling:** Enable building and validating all independent ML components (dataset conversion, backbone fine-tuning, evaluation metrics, backend API contract) without blocking on Phase 1's live data collection.
- **Model Efficiency:** Backbone must have a lightweight parameter footprint (< 3M parameters) and low latency on CPU inference.
- **Explainable Output Integration:** Per-word letter formation scores must seamlessly integrate into `MeasurementData` and aggregate metrics for diagnostic reporting.
- **Production Hardening:** Fatal startup crashes in production if model artifacts fail to load (AGENTS.md rule 13), while allowing zero-friction stubbed execution in CI and local dev.

---

## 3. Considered Options & Architectural Decisions

### Decision 1: Two-Stage Model Architecture (Backbone Pre-training + Regression Calibration)

- **Chosen Approach:**
  - **Stage 1 (Feature Backbone):** MobileNetV2 (ImageNet-pretrained) fine-tuned on the CCC (Cursive Character Challenge) / C-Cube dataset (~57k characters across 52 classes: `a`–`z`, `A`–`Z`) using a two-phase training regimen (Phase A: frozen base, Adam $\text{lr}=10^{-3}$; Phase B: top 30% unfrozen, Adam $\text{lr}=10^{-5}$ with early stopping). Target: $\ge 90\%$ classification accuracy on CCC held-out test set.
  - **Stage 2 (Regression Calibration Head):** A shallow regression MLP (`GlobalAveragePooling2D` $\to$ `Dense(64, relu)` $\to$ `Dense(1)`) attached to the frozen Stage 1 backbone and trained via MSE on paired Phase 1 teacher scores mapped to numeric targets (Needs Improvement: 12.5, Developing: 37.5, Satisfactory: 62.5, Excellent: 87.5).
  - **Export:** Exported as a unified `.keras` single-graph artifact taking $96 \times 96 \times 3$ input and outputting a single scalar letter-formation score.
- **Rationale:** Direct training of a CNN on small paired teacher datasets leads to severe overfitting. Pre-training on CCC forces the convolutional filters to learn cursive stroke semantics (loops, stems, connectors) before calibrating to teacher rubric judgment.

---

### Decision 2: Isolated Offline Training Scaffolding (`training/`)

- **Chosen Approach:** All training code resides in `training/` at the repository root, completely isolated from `backend/`:
  - `convert_ccc.py`: Parses proprietary CCC `.chr` files, inverts pixel maps, pads to square, resizes to $96 \times 96$, and generates train/val/test `.npy` splits with `manifest.csv`.
  - `stage1_finetune.ipynb`: Self-contained Google Colab notebook targeting free-tier T4 GPUs with Drive integration.
  - `evaluate_stage1.py`: Generates thesis-required metrics (overall accuracy, macro precision/recall/F1, $52 \times 52$ confusion matrix heatmap/CSV, and `summary.json`).
  - `stage2_calibrate.py` & `export_model.py`: Documented CLI skeletons raising `NotImplementedError` until paired Phase 1 data is collected.
  - `.gitignore`: Enforces strict exclusion of `training/data/`, `training/results/`, `*.keras`, and `*.h5`.
- **Rationale:** Prevents heavyweight ML dependencies (`scikit-learn`, `matplotlib`, CUDA toolchains) from entering `backend/pyproject.toml` and ensures dataset files are never committed to git.

---

### Decision 3: Zero-Bloat Backend Module with Deterministic Stub (`backend/app/ml/`)

- **Chosen Approach:**
  - `backend/app/ml/exceptions.py`: `ModelInferenceError` for standardized API error handling.
  - `backend/app/ml/models.py`: `WordFormationScore` and `LetterFormationResult` dataclasses.
  - `backend/app/ml/model.py`: Module-level singleton loaded once during FastAPI `lifespan` startup. If `ENVIRONMENT=test` or in `dev` without `MODEL_ARTIFACT_PATH`, activates stub mode. In production, downloads the `.keras` artifact from Supabase Storage (`MODEL_STORAGE_BUCKET`); failure raises a fatal `RuntimeError` on startup.
  - `backend/app/ml/inference.py`: `run_letter_formation_inference(word_crops)` accepts raw deskewed word crops from the CV pipeline, preprocesses them (pad-to-square, resize $96 \times 96$, 3-channel stack, $[-1, 1]$ normalize), and returns per-word and aggregate scores clamped to $[0, 100]$. In stub mode, produces deterministic plausible distributions ($\mathcal{N}(65.0, 15.0)$ with seed 42).
- **Rationale:** Keeps the deployed inference path simple and fast with zero external RPC overhead while adhering to single Uvicorn worker constraints (AGENTS.md rule 15) and CI test gating rules (TESTING.md §3.2).

---

### Decision 4: Square-Padded Normalization Pipeline

- **Chosen Approach:** All word crops from `CV_PIPELINE §7` undergo:
  1. **Square-Padding:** Pad shorter dimension with white background ($255$) before resizing.
  2. **Resize:** $96 \times 96$ via `cv2.INTER_AREA`.
  3. **Channel Duplication:** Replicate single-channel grayscale to 3 channels for MobileNetV2 compatibility.
  4. **Normalization:** Map $[0, 255] \to [-1.0, 1.0]$ via $(x / 127.5) - 1.0$.
- **Rationale:** Direct non-uniform scaling of words distorts cursive aspect ratios and slant angles. Padding to square preserves pen stroke proportions regardless of word length.

---

## 4. Consequences & Trade-offs

### Positive Consequences
- **Complete Test Isolation:** Backend ML inference and error handling are fully verified by automated unit tests without requiring a real neural network weights file locally.
- **Smooth Phase 1 $\to$ Phase 2 Transition:** Backend contracts (`LetterFormationResult`, `run_letter_formation_inference`) and health check endpoints are live today; swapping from stub to calibrated weights requires only setting `MODEL_ARTIFACT_PATH` in production environment variables.
- **Reproducible Academic Research:** The `training/` pipeline generates publication- and defense-ready artifacts (confusion matrices, classification reports, summary JSON) conforming to PRD §11 thesis specifications.

### Negative / Known Limitations
- **Word-Level vs. Character-Level Inference in Production:** While Stage 1 is trained on individual CCC characters, Stage 2 infers on whole-word crops because cursive connecting strokes prevent reliable automated letter segmentation. The Stage 1 convolutional feature maps generalize to word-level stroke density and loop quality, but character-level bounding annotations are not output in inference.
- **Memory Footprint:** MobileNetV2 occupies ~14MB disk and ~40MB RAM resident in the Uvicorn process. Single-worker execution is strictly required to prevent RAM duplication.
