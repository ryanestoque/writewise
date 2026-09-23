# WriteWise — Research & Calibration Scripts

Offline statistical analysis and data export tools for calibration and defense validation.
Full architectural and mathematical details are documented in [CALIBRATION_SCORING_GUIDE.md](../docs/CALIBRATION_SCORING_GUIDE.md).

> ⚠️ **Note:** These scripts are run offline by authorized researchers using service-role credentials and are **never deployed** to production containers or bundled in client-facing APIs.

---

## Directory Contents

| Script | Purpose | Output |
| :--- | :--- | :--- |
| [`export_dataset.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/research/export_dataset.py) | Exports and anonymizes paired Phase 1 data (raw CV measurements + teacher rubric scores + word crops). | `research/output/paired_measurements.csv`<br>`research/output/paired_crops.csv` |
| [`analyze_correlations.py`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/research/analyze_correlations.py) | Computes Spearman's Rho ($\rho$), evaluates rubric band distributions, derives constants for `backend/app/scoring/provider.py`, and generates thesis defense reports. | `research/output/correlation_analysis_report.md`<br>`research/output/correlation_analysis_results.json` |

---

## Workflow

### 1. Export Paired Dataset
After Phase 1 data collection, run the export script using the dev/service-role credentials:

```bash
cd research
python export_dataset.py --output-dir output
```

### 2. Run Spearman's Rho & Threshold Derivation
Compute rank correlations against teacher rubric scores and derive calibration constants:

```bash
python analyze_correlations.py \
    --input output/paired_measurements.csv \
    --output-dir output
```

### 3. Update Scoring Engine
1. Check that Spearman's $\rho \ge 0.70$ ($p < 0.05$) per criterion in `output/correlation_analysis_report.md`.
2. Copy the recommended constants into `backend/app/scoring/provider.py`.
3. Set `SCORING_ENGINE=calibrated` in the backend environment.
