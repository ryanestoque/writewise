# WriteWise — ML Training Workflow

Offline training scripts for the CNN letter-formation model.
See [ML_PIPELINE.md](../docs/ML_PIPELINE.md) for full architecture details.

**These scripts are never deployed** — only the exported `.keras` artifact
(uploaded to Supabase Storage) is used by the production backend.

## Prerequisites

- Python 3.13+ with TensorFlow/Keras installed
- CCC (Cursive Character Challenge) dataset downloaded to `data/raw/`
- Google Colab account (for Stage 1 GPU training)
- scikit-learn, matplotlib (for evaluation — `pip install scikit-learn matplotlib`)

## Directory Structure

```
training/
├── convert_ccc.py           # Step 1: CCC format conversion
├── stage1_finetune.ipynb    # Step 2: Fine-tune MobileNetV2 on CCC (Colab)
├── stage1_finetune_v2.ipynb # Corrected retraining version; preserves original runs
├── stage1_bn_comparison.ipynb # Matched Phase B comparison from run three's Phase A
├── stage1_translation_comparison.ipynb # Matched translation ablation with adaptive BN
├── evaluate_stage1.py       # Step 3: Stage 1 evaluation metrics
├── stage2_calibrate.py      # Step 4: Regression head (needs paired data)
├── export_model.py          # Step 5: Combine into deployable artifact
├── train_htr.ipynb          # HTR: Fine-tune SimpleHTR on IAM Words (Colab)
├── data/                    # Gitignored — dataset files
│   ├── raw/                 # Raw CCC download (.chr files)
│   └── processed/           # Output of convert_ccc.py (.npy files)
└── results/                 # Gitignored — evaluation outputs
```

## Workflow

### Stage 1 (can start now)

1. **Download CCC** from [Idiap](https://www.idiap.ch/en/dataset/ccc) into `data/raw/`
2. **Convert dataset:** `python convert_ccc.py` — produces `data/processed/`
3. **Upload to Drive** — copy `data/processed/` to your Google Drive
4. **Train in Colab** — open `stage1_finetune.ipynb`, connect to GPU runtime, run all cells
5. **Download checkpoint** — save the `.keras` file from Drive to your local machine
6. **Evaluate:** `python evaluate_stage1.py --checkpoint <path>` — check `results/stage1_evaluation/summary.json`
7. **Target:** >=90% accuracy on CCC test set (PRD §11)

### Stage 1 corrected retraining (v2)

Use `stage1_finetune_v2.ipynb` in a fresh Colab T4 GPU runtime. Reuse the existing
processed CCC data and train both phases from ImageNet weights. V2 fixes geometric
augmentation border fill, shares a canonical 52-class label mapping, freezes
BatchNormalization during fine-tuning, and selects the best validation-loss
checkpoint across both phases. Class counts and training logs are saved for analysis;
class balancing remains off for this corrected baseline.

For the third run, v2 fully shuffles the training split before normalization, replacing
the 2,000-sample buffer. This is the only training-policy change from the second run
(66.23% test accuracy / 57.97% macro F1; the original reached 76.10% / 66.33%). Keep
the same processed data, split, seed, architecture, augmentation, learning rates and
frozen BatchNormalization. Start both phases from ImageNet weights in a fresh runtime.
The run configuration records `experiment: run3_full_shuffle`, the full shuffle-buffer
size and reshuffling policy. The raw shuffle payload is about 302 MiB for 34,344 images.

Each run writes to `checkpoints/stage1_v2/<run-id>/` in Drive, including
`stage1_best.keras`, `run_config.json`, phase histories, and training curves.
Run Sections 1–7.1 with `RUN_FINAL_TEST = False`. Section 7.1 reloads the selected saved
checkpoint and evaluates clean training and validation images without augmentation or
shuffling. It saves `diagnostics/validation_summary.json`, classification reports, and
confusion matrices (CSV/PNG) for both splits. The summary includes the clean accuracy
gap and lists absent classes; macro metrics always include all 52 canonical classes,
so classes absent from validation contribute zero.

The original notebook and previous checkpoints are preserved. Compare the validation
loss, accuracy, macro F1 and per-class reports on the unchanged split before selecting
the configuration. Set `RUN_FINAL_TEST = True` in a new cell and run Section 8 once;
its reports go to that run's `evaluation/` folder. Do not rerun setup to enable it,
because setup creates a new run directory. Improvements and the >=90% target must be
measured after retraining. Stage 2 still requires separate validation against teacher scores.

Notebook regression checks, from the repository root:

```powershell
& backend/.venv/Scripts/python.exe -m pytest training/tests/test_stage1_notebook.py -q --basetemp training/results/notebook_test_tmp
```

### Stage 1 matched BatchNormalization comparison (fourth experiment)

Run three reached 75.35% test accuracy / 65.16% macro F1. To test whether the BN
policy contributes to the remaining errors, use `stage1_bn_comparison.ipynb` in a
fresh Colab T4 runtime. Run Sections 1–7, then stop before Section 8.

The notebook defaults to run three's folder, `20261018T074232Z-e42906`; change
`SOURCE_RUN_DIR` in Section 1 if its Drive location differs. It requires that folder's
`stage1_phase_a_best.keras` and `run_config.json`, plus the same processed CCC data.
It reuses the saved Phase A weights and runs **two Phase B branches**:

- `frozen_bn`: all BatchNormalization layers frozen, matching v2's policy.
- `adaptive_bn`: BN in the upper ~30% of the backbone can update, matching v1's policy.

Both branches start from identical weights with fresh optimizers, the same full
shuffle, and matching explicit augmentation seeds. Augmentation runs serially to
preserve random-draw order. The frozen branch is a fresh control for this experiment;
its Phase B random sequence restarts, so it need not reproduce run three exactly.
Lower backbone layers stay frozen; the learning rate, augmentation strengths,
architecture, split, class mapping and class-weighting policy stay fixed.
Each branch keeps Phase A if its fine-tuning does not improve validation loss.

Outputs go to `checkpoints/stage1_bn_comparison/<run-id>/`, with separate branch
checkpoints, configurations, histories and clean diagnostics. Share the root
`comparison_summary.json` and both `diagnostics/val_classification_report.txt` files.
The recommendation uses validation loss first, then macro F1 and accuracy; exact
ties prefer frozen BN. The comparison does not guarantee the 90% target.

Only after selecting the policy on validation, set `FINAL_VARIANT` to `"frozen_bn"`
or `"adaptive_bn"` and `RUN_FINAL_TEST = True` in a new cell, then run Section 8 once.
Do not compare both test results to choose the policy. Retain the earlier runs and
their test-evaluation history when reporting results.

Run both notebook regression suites from the repository root:

```powershell
& backend/.venv/Scripts/python.exe -m pytest training/tests -q --basetemp training/results/notebook_comparison_test_tmp
```

### Stage 1 matched translation comparison (fifth experiment)

The adaptive-BN model reached 79.14% test accuracy / 69.78% macro F1. Preserve that
checkpoint. An input audit on 1,000 training images found that all touched a canvas
edge; under a maximum allowed shift toward the bottom-right, 21.6% lost more than
5% of their ink. This stress probe does not measure average random augmentation
damage or establish that removing translation improves recognition.

Use `stage1_translation_comparison.ipynb` in a fresh Colab T4 runtime. Run Sections
1–7, then stop before Section 8. It reuses the same run-three Phase A checkpoint and
metadata as the BN comparison (`SOURCE_RUN_DIR` defaults to `20261018T074232Z-e42906`),
with the existing processed dataset. It runs **two matched Phase B branches**:

- `translation_5pct`: the current ±5% translation along each axis.
- `no_translation`: translation factor zero, while rotation and zoom remain active.

Both branches use adaptive BN in the upper ~30% of the backbone, identical starting
weights, fresh optimizers and matching shuffle/augmentation seeds. The zero-factor
translation layer stays in the pipeline to preserve the other random generators.
All other training settings and clean validation preprocessing remain unchanged.
The fresh control need not exactly reproduce run four on different hardware.

Results go to `checkpoints/stage1_translation_comparison/<run-id>/` with separate
branch checkpoints and diagnostics. Share the root `comparison_summary.json` and
both branches' `diagnostics/val_classification_report.txt` files. Selection uses
validation loss, then macro F1 and accuracy; exact ties keep the current translation.
Compare the winner with the saved adaptive-BN run on validation before testing it.
The earlier 79.14% test score is historical and is not used for candidate selection.

Keep `RUN_FINAL_TEST = False` and `FINAL_VARIANT = None` during comparison. After
reviewing validation results, choose `"translation_5pct"` or `"no_translation"` in a
new cell and enable final testing for that selected variant only. Do not rerun setup
or training to change these variables. This experiment does not guarantee the 90% target.

### HTR Model (Target Text Verification)

Separate from the scoring CNN pipeline above — this trains the SimpleHTR model used to verify that uploaded handwriting matches the activity's target text (see ADR 0003).

1. **Open** `train_htr.ipynb` in Google Colab, connect to GPU runtime
2. **Train** — the notebook handles IAM Words dataset loading, preprocessing, and CTC model training
3. **Download** the resulting `.keras` artifact (e.g., `simplehtr_iam.keras`)
4. **Upload to Supabase Storage** — upload to the `model-artifacts` bucket alongside the scoring CNN artifact
5. **Set env var** — set `HTR_MODEL_ARTIFACT_PATH=simplehtr_iam.keras` in the backend `.env` / Railway dashboard

### Stage 2 (Calibration & Production Export)

**Immediate Export (Baseline Mode — before paired data is collected):**
8. **Export deployable baseline model:**
   ```bash
   python export_model.py \
       --stage1-checkpoint checkpoints/stage1_best.keras \
       --baseline \
       --output-path artifacts/writewise-model.keras
   ```
9. **Upload to Supabase Storage** — upload `writewise-model.keras` to the `model-artifacts` bucket.

**Calibrated Export (after Phase 1 collects teacher scores):**
10. **Export paired data** — run `python research/export_dataset.py` to get teacher-score + word-crop pairs (`paired_measurements.csv` and `paired_crops.csv`).
11. **Analyze correlations & derive thresholds** — run `python research/analyze_correlations.py` to compute Spearman's Rho ($\rho \ge 0.70$), evaluate rubric band distributions, and derive calibration constants for `backend/app/scoring/provider.py`.
12. **Train regression head:**
    ```bash
    python stage2_calibrate.py \
        --paired-data-path ../research/output/paired_crops.csv \
        --stage1-checkpoint checkpoints/stage1_best.keras \
        --output-path checkpoints/stage2_calibrated.keras
    ```
13. **Export final model:**
    ```bash
    python export_model.py \
        --model-path checkpoints/stage2_calibrated.keras \
        --output-path artifacts/writewise-model.keras
    ```
14. **Update Supabase Storage** — replace `writewise-model.keras` in the `model-artifacts` bucket.
