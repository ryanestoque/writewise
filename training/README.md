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
├── evaluate_stage1.py       # Step 3: Stage 1 evaluation metrics
├── stage2_calibrate.py      # Step 4: Regression head (needs paired data)
├── export_model.py          # Step 5: Combine into deployable artifact
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

### Stage 2 (after Phase 1 is live and collecting paired data)

8. **Export paired data** — run `research/export_dataset.py` to get teacher-score + word-crop pairs
9. **Train regression head:** `python stage2_calibrate.py --paired-data-path <path> --stage1-checkpoint <path>`
10. **Export final model:** `python export_model.py --stage1-checkpoint <path> --stage2-checkpoint <path> --output <path>`
11. **Upload to Supabase Storage** — upload the `.keras` artifact to the `model-artifacts` bucket
