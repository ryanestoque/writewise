"""WriteWise — Threshold & Correlation Analysis (Spearman's Rho).

Analyzes paired handwriting dataset (raw CV/CNN measurements + teacher manual rubric scores)
produced by `research/export_dataset.py` to:
1. Compute Spearman's Rank Correlation Coefficient (ρ) and p-value per criterion.
   Target: ρ >= 0.70 ("strong" correlation) per PRD §11 success criteria.
2. Characterize raw metric distributions across rubric bands (Needs Improvement, Developing,
   Satisfactory, Excellent).
3. Derive empirical threshold cutoffs and calibration constants for
   `backend/app/scoring/provider.py`.
4. Generate a defense-ready Markdown report and JSON artifact for thesis documentation.

Usage:
    python research/analyze_correlations.py [--input research/output/paired_measurements.csv]
                                           [--output-dir research/output]
"""

import argparse
import csv
import json
import logging
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("analyze_correlations")

RUBRIC_BANDS = [
    "Needs Improvement",
    "Developing",
    "Satisfactory",
    "Excellent",
]

# Baseline targets and penalty defaults
DEFAULT_CALIBRATION = {
    "SLANT_TARGET_DEG": 12.5,
    "SLANT_PENALTY_FACTOR": 2.5,
    "WORD_GAP_TARGET_RATIO": 2.0,
    "WORD_GAP_PENALTY_FACTOR": 35.0,
    "LETTER_GAP_TARGET_RATIO": 0.4,
    "LETTER_GAP_PENALTY_FACTOR": 100.0,
    "BASELINE_DEV_PENALTY_FACTOR": 350.0,
    "SIZE_RATIO_TARGET": 1.0,
    "SIZE_DEV_PENALTY_FACTOR": 120.0,
}


def compute_ranks(values: List[float]) -> List[float]:
    """Compute fractional ranks for a sequence of values with tie handling.

    For example:
        [10.0, 20.0, 20.0, 30.0] -> [1.0, 2.5, 2.5, 4.0]
    """
    n = len(values)
    if n == 0:
        return []

    # Sort with original indices
    indexed = sorted(enumerate(values), key=lambda x: x[1])

    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and indexed[j + 1][1] == indexed[i][1]:
            j += 1

        # Fractional rank is the average of 1-based ranks from i+1 to j+1
        avg_rank = (i + 1 + j + 1) / 2.0
        for k in range(i, j + 1):
            ranks[indexed[k][0]] = avg_rank
        i = j + 1

    return ranks


def _betacf(a: float, b: float, x: float, max_iter: int = 150, eps: float = 1e-10) -> float:
    """Continued fraction evaluation for incomplete beta function."""
    qab = a + b
    qap = a + 1.0
    qam = a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < 1e-30:
        d = 1e-30
    d = 1.0 / d
    h = d

    for m in range(1, max_iter + 1):
        m2 = 2 * m
        # Even step
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < 1e-30:
            d = 1e-30
        c = 1.0 + aa / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        h *= d * c

        # Odd step
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < 1e-30:
            d = 1e-30
        c = 1.0 + aa / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        del_val = d * c
        h *= del_val

        if abs(del_val - 1.0) < eps:
            break

    return h


def regularized_incomplete_beta(a: float, b: float, x: float) -> float:
    """Compute regularized incomplete beta function I_x(a, b)."""
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0

    lbeta = math.lgamma(a) + math.lgamma(b) - math.lgamma(a + b)
    bt = math.exp(math.log(x) * a + math.log(1.0 - x) * b - lbeta)

    # Use symmetry transform for faster convergence
    if x < (a + 1.0) / (a + b + 2.0):
        return bt * _betacf(a, b, x) / a
    else:
        return 1.0 - bt * _betacf(b, a, 1.0 - x) / b


def compute_spearman_correlation(x: List[float], y: List[float]) -> Tuple[float, float]:
    """Compute Spearman's rank correlation coefficient (rho) and 2-tailed p-value.

    Returns:
        (rho, p_value): rho in [-1.0, 1.0], p_value in [0.0, 1.0].
    """
    if len(x) != len(y) or len(x) < 3:
        return 0.0, 1.0

    n = len(x)
    rx = compute_ranks(x)
    ry = compute_ranks(y)

    mean_rx = sum(rx) / n
    mean_ry = sum(ry) / n

    cov = sum((rx[i] - mean_rx) * (ry[i] - mean_ry) for i in range(n))
    var_x = sum((rx[i] - mean_rx) ** 2 for i in range(n))
    var_y = sum((ry[i] - mean_ry) ** 2 for i in range(n))

    if var_x < 1e-12 or var_y < 1e-12:
        return 0.0, 1.0

    rho = cov / math.sqrt(var_x * var_y)
    rho = max(-1.0, min(1.0, rho))

    # Calculate 2-tailed p-value using Student's t distribution approximation
    if abs(abs(rho) - 1.0) < 1e-7:
        p_val = 0.0
    else:
        # t = rho * sqrt((n - 2) / (1 - rho^2))
        # p-value is regularized incomplete beta I_{1 - rho^2}((n-2)/2, 0.5)
        df = n - 2
        a = df / 2.0
        b = 0.5
        x_val = max(0.0, min(1.0, 1.0 - rho**2))
        p_val = regularized_incomplete_beta(a, b, x_val)

    return round(rho, 4), round(p_val, 6)


def _percentile(sorted_vals: List[float], p: float) -> float:
    """Calculate p-th percentile (p in [0, 100]) of a sorted list."""
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]

    k = (len(sorted_vals) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    d0 = sorted_vals[int(f)] * (c - k)
    d1 = sorted_vals[int(c)] * (k - f)
    return d0 + d1


def compute_band_distribution(
    records: List[Dict[str, Any]],
    metric_key: str,
    band_key: str,
) -> Dict[str, Any]:
    """Calculate summary statistics of a metric grouped by rubric band."""
    band_groups: Dict[str, List[float]] = {b: [] for b in RUBRIC_BANDS}

    for r in records:
        band = r.get(band_key)
        val = r.get(metric_key)
        if band in band_groups and val is not None and val != "":
            try:
                band_groups[band].append(float(val))
            except (ValueError, TypeError):
                continue

    result: Dict[str, Any] = {}
    for band, vals in band_groups.items():
        if not vals:
            result[band] = {
                "count": 0,
                "mean": None,
                "std": None,
                "median": None,
                "q25": None,
                "q75": None,
                "min": None,
                "max": None,
            }
            continue

        s_vals = sorted(vals)
        n = len(s_vals)
        mean = sum(s_vals) / n
        std = math.sqrt(sum((v - mean) ** 2 for v in s_vals) / n) if n > 1 else 0.0

        result[band] = {
            "count": n,
            "mean": round(mean, 4),
            "std": round(std, 4),
            "median": round(_percentile(s_vals, 50), 4),
            "q25": round(_percentile(s_vals, 25), 4),
            "q75": round(_percentile(s_vals, 75), 4),
            "min": round(s_vals[0], 4),
            "max": round(s_vals[-1], 4),
        }

    return result


def derive_calibration_constants(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Derive recommended calibration constants from empirical band distributions.

    Matches constants used by CalibratedScoreProvider in `backend/app/scoring/provider.py`.
    """
    constants = dict(DEFAULT_CALIBRATION)

    # 1. Slant
    slant_stats = compute_band_distribution(records, "slant_mean", "manual_slant_band")
    if slant_stats["Excellent"]["count"] > 0 and slant_stats["Excellent"]["median"] is not None:
        constants["SLANT_TARGET_DEG"] = round(slant_stats["Excellent"]["median"], 2)

    # Slant penalty factor: based on deviation spread from target
    target_slant = constants["SLANT_TARGET_DEG"]
    exc_slant = slant_stats["Excellent"]["median"]
    ni_slant = slant_stats["Needs Improvement"]["median"]
    if exc_slant is not None and ni_slant is not None:
        delta_dev = abs(ni_slant - target_slant) - abs(exc_slant - target_slant)
        if delta_dev > 1.0:
            # Score drop is 75 (from ~87.5 to ~12.5)
            penalty = 75.0 / delta_dev
            constants["SLANT_PENALTY_FACTOR"] = round(max(1.0, min(10.0, penalty)), 2)

    # 2. Spacing (Word & Letter)
    word_stats = compute_band_distribution(records, "word_spacing_mean", "manual_spacing_band")
    if word_stats["Excellent"]["count"] > 0 and word_stats["Excellent"]["median"] is not None:
        constants["WORD_GAP_TARGET_RATIO"] = round(word_stats["Excellent"]["median"], 2)

    letter_stats = compute_band_distribution(records, "letter_spacing_mean", "manual_spacing_band")
    if letter_stats["Excellent"]["count"] > 0 and letter_stats["Excellent"]["median"] is not None:
        constants["LETTER_GAP_TARGET_RATIO"] = round(letter_stats["Excellent"]["median"], 2)

    # 3. Baseline Alignment
    base_stats = compute_band_distribution(
        records, "baseline_deviation_mean", "manual_baseline_alignment_band"
    )
    exc_base = base_stats["Excellent"]["median"]
    ni_base = base_stats["Needs Improvement"]["median"]
    if exc_base is not None and ni_base is not None:
        delta_base = ni_base - exc_base
        if delta_base > 0.01:
            penalty = 75.0 / delta_base
            constants["BASELINE_DEV_PENALTY_FACTOR"] = round(max(50.0, min(800.0, penalty)), 1)

    # 4. Size Consistency
    size_stats = compute_band_distribution(
        records, "size_consistency_mean", "manual_size_consistency_band"
    )
    if size_stats["Excellent"]["count"] > 0 and size_stats["Excellent"]["median"] is not None:
        constants["SIZE_RATIO_TARGET"] = round(size_stats["Excellent"]["median"], 2)

    target_size = constants["SIZE_RATIO_TARGET"]
    exc_size = size_stats["Excellent"]["median"]
    ni_size = size_stats["Needs Improvement"]["median"]
    if exc_size is not None and ni_size is not None:
        delta_size = abs(ni_size - target_size) - abs(exc_size - target_size)
        if delta_size > 0.05:
            penalty = 75.0 / delta_size
            constants["SIZE_DEV_PENALTY_FACTOR"] = round(max(20.0, min(400.0, penalty)), 1)

    return constants


def format_correlation_table(results: List[Dict[str, Any]]) -> str:
    """Format correlation analysis results as a clean text table."""
    headers = [
        "Criterion",
        "Metric Analyzed",
        "N",
        "Spearman ρ",
        "p-value",
        "Target (≥0.70)",
        "Status",
    ]
    col_widths = [22, 26, 6, 12, 12, 15, 8]

    def build_row(vals: List[str]) -> str:
        return " | ".join(f"{val:<{w}}" for val, w in zip(vals, col_widths))

    border = "-+-".join("-" * w for w in col_widths)
    lines = [build_row(headers), border]

    for r in results:
        status_str = "PASS" if r.get("meets_target") else "PENDING"
        row_vals = [
            str(r.get("criterion", "")),
            str(r.get("metric", "")),
            str(r.get("n", "")),
            f"{r.get('spearman_rho', 0.0):+.4f}",
            f"{r.get('p_value', 1.0):.6f}",
            "|ρ| ≥ 0.70",
            status_str,
        ]
        lines.append(build_row(row_vals))

    return "\n".join(lines)


def generate_markdown_report(analysis_results: Dict[str, Any], output_path: Path) -> str:
    """Generate comprehensive Markdown report for thesis documentation."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    sample_size = analysis_results.get("sample_size", 0)
    correlations = analysis_results.get("correlations", [])
    band_distributions = analysis_results.get("band_distributions", {})
    constants = analysis_results.get("constants", {})

    lines = [
        "# WriteWise — Correlation & Calibration Analysis Report",
        "",
        f"**Generated:** {now_str}  ",
        f"**Sample Size (Paired Submissions):** {sample_size}  ",
        "**Target Defense Requirement:** Spearman's rank correlation $\\rho \\ge 0.70$ (PRD §11)  ",
        "",
        "---",
        "",
        "## 1. Executive Summary & Success Metric Validation",
        "",
        "This report evaluates the statistical association between WriteWise's automated",
        "OpenCV/CNN measurements and manual rubric evaluations provided by teachers during",
        "Phase 1 calibration.",
        "",
        "| Criterion | Metric Analyzed | N | Spearman's $\\rho$ | p-value | "
        "Target ($|\\rho| \\ge 0.70$) | Status |",
        "|---|---|---|---|---|---|---|",
    ]

    all_passed = True
    for c in correlations:
        status = "✅ PASS" if c.get("meets_target") else "⚠️ BELOW THRESHOLD"
        if not c.get("meets_target"):
            all_passed = False
        lines.append(
            f"| {c['criterion']} | `{c['metric']}` | {c['n']} | "
            f"{c['spearman_rho']:+.4f} | {c['p_value']:.6f} | "
            f"$\\ge 0.70$ | {status} |"
        )

    status_msg = (
        "✅ ALL CRITERIA MEET OR EXCEED THRESHOLD (ρ ≥ 0.70)"
        if all_passed
        else "⚠️ FURTHER DATA COLLECTION OR THRESHOLD TUNING REQUIRED"
    )
    lines.extend(
        [
            "",
            f"**Overall Calibration Status:** {status_msg}",
            "",
            "---",
            "",
            "## 2. Metric Distributions by Rubric Band",
            "",
            "Summary distribution statistics (median, IQR, min–max) for raw CV features across",
            "teacher rubric bands:",
            "",
        ]
    )

    for crit_name, stats in band_distributions.items():
        lines.extend(
            [
                f"### {crit_name}",
                "",
                "| Band | Count | Median | IQR (Q25 – Q75) | Mean ± Std | Range (Min – Max) |",
                "|---|---|---|---|---|---|",
            ]
        )
        for band in RUBRIC_BANDS:
            b_data = stats.get(band, {})
            if b_data.get("count", 0) > 0:
                lines.append(
                    f"| {band} | {b_data['count']} | {b_data['median']} | "
                    f"{b_data['q25']} – {b_data['q75']} | {b_data['mean']} ± {b_data['std']} | "
                    f"{b_data['min']} – {b_data['max']} |"
                )
            else:
                lines.append(f"| {band} | 0 | - | - | - | - |")
        lines.append("")

    lines.extend(
        [
            "---",
            "",
            "## 3. Recommended Calibration Constants (`provider.py`)",
            "",
            "Empirically derived constants to configure `backend/app/scoring/provider.py`:",
            "",
            "```python",
            f"SLANT_TARGET_DEG = {constants.get('SLANT_TARGET_DEG', 12.5)}",
            f"SLANT_PENALTY_FACTOR = {constants.get('SLANT_PENALTY_FACTOR', 2.5)}",
            "",
            f"WORD_GAP_TARGET_RATIO = {constants.get('WORD_GAP_TARGET_RATIO', 2.0)}",
            f"WORD_GAP_PENALTY_FACTOR = {constants.get('WORD_GAP_PENALTY_FACTOR', 35.0)}",
            "",
            f"LETTER_GAP_TARGET_RATIO = {constants.get('LETTER_GAP_TARGET_RATIO', 0.4)}",
            f"LETTER_GAP_PENALTY_FACTOR = {constants.get('LETTER_GAP_PENALTY_FACTOR', 100.0)}",
            "",
            f"BASELINE_DEV_PENALTY_FACTOR = {constants.get('BASELINE_DEV_PENALTY_FACTOR', 350.0)}",
            "",
            f"SIZE_RATIO_TARGET = {constants.get('SIZE_RATIO_TARGET', 1.0)}",
            f"SIZE_DEV_PENALTY_FACTOR = {constants.get('SIZE_DEV_PENALTY_FACTOR', 120.0)}",
            "```",
            "",
            "---",
            "",
            "## 4. Thesis Defense & Panel Citations",
            "",
            "- **Methodology:** Spearman's rank correlation ($\\rho$) was computed to assess the",
            "  monotonic relationship between continuous computer-vision measurements and ordinal",
            "  teacher rubric grades.",
            "- **Significance:** Two-tailed p-values are computed using Student's t distribution",
            "  with $n - 2$ degrees of freedom.",
            "- **Privacy Compliance:** All analyses performed strictly on anonymized tokens",
            "  (`STUDENT_xxx`) with no identifiable PII (RA 10173).",
            "",
        ]
    )

    report_text = "\n".join(lines)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report_text, encoding="utf-8")
    logger.info("Saved correlation analysis report to %s", output_path)
    return report_text


def load_measurements_csv(csv_path: Path) -> List[Dict[str, Any]]:
    """Load paired measurements CSV generated by research/export_dataset.py."""
    if not csv_path.is_file():
        raise FileNotFoundError(f"Input file not found: {csv_path}")

    records = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            parsed_row: Dict[str, Any] = {}
            for k, v in row.items():
                if v is None or v == "":
                    parsed_row[k] = None
                    continue
                try:
                    # Attempt numeric conversion
                    if "." in v:
                        parsed_row[k] = float(v)
                    else:
                        parsed_row[k] = int(v)
                except ValueError:
                    parsed_row[k] = v
            records.append(parsed_row)

    return records


def run_analysis(
    input_csv: Path,
    output_dir: Path,
) -> Dict[str, Any]:
    """Execute complete correlation analysis pipeline."""
    records = load_measurements_csv(input_csv)
    n = len(records)
    logger.info("Loaded %d records from %s", n, input_csv)

    # 1. Define correlation pairs
    pairs_to_test = [
        {
            "criterion": "Slant (Deviation)",
            "metric": "abs(slant_mean - 12.5)",
            "x_extractor": lambda r: (
                abs(float(r["slant_mean"]) - 12.5) if r.get("slant_mean") is not None else None
            ),
            "y_extractor": lambda r: (
                float(r["manual_slant_score"]) if r.get("manual_slant_score") is not None else None
            ),
            "expected_sign": -1,  # Lower deviation = higher score -> negative correlation
        },
        {
            "criterion": "Slant (Raw)",
            "metric": "slant_mean",
            "x_extractor": lambda r: (
                float(r["slant_mean"]) if r.get("slant_mean") is not None else None
            ),
            "y_extractor": lambda r: (
                float(r["manual_slant_score"]) if r.get("manual_slant_score") is not None else None
            ),
            "expected_sign": None,
        },
        {
            "criterion": "Word Spacing",
            "metric": "word_spacing_mean",
            "x_extractor": lambda r: (
                float(r["word_spacing_mean"]) if r.get("word_spacing_mean") is not None else None
            ),
            "y_extractor": lambda r: (
                float(r["manual_spacing_score"])
                if r.get("manual_spacing_score") is not None
                else None
            ),
            "expected_sign": 1,
        },
        {
            "criterion": "Letter Spacing",
            "metric": "letter_spacing_mean",
            "x_extractor": lambda r: (
                float(r["letter_spacing_mean"])
                if r.get("letter_spacing_mean") is not None
                else None
            ),
            "y_extractor": lambda r: (
                float(r["manual_spacing_score"])
                if r.get("manual_spacing_score") is not None
                else None
            ),
            "expected_sign": 1,
        },
        {
            "criterion": "Baseline Alignment",
            "metric": "baseline_deviation_mean",
            "x_extractor": lambda r: (
                float(r["baseline_deviation_mean"])
                if r.get("baseline_deviation_mean") is not None
                else None
            ),
            "y_extractor": lambda r: (
                float(r["manual_baseline_alignment_score"])
                if r.get("manual_baseline_alignment_score") is not None
                else None
            ),
            "expected_sign": -1,  # Lower deviation = higher score -> negative correlation
        },
        {
            "criterion": "Size Consistency",
            "metric": "size_consistency_mean",
            "x_extractor": lambda r: (
                float(r["size_consistency_mean"])
                if r.get("size_consistency_mean") is not None
                else None
            ),
            "y_extractor": lambda r: (
                float(r["manual_size_consistency_score"])
                if r.get("manual_size_consistency_score") is not None
                else None
            ),
            "expected_sign": 1,
        },
        {
            "criterion": "Letter Formation",
            "metric": "letter_formation_mean",
            "x_extractor": lambda r: (
                float(r["letter_formation_mean"])
                if r.get("letter_formation_mean") is not None
                else None
            ),
            "y_extractor": lambda r: (
                float(r["manual_letter_formation_score"])
                if r.get("manual_letter_formation_score") is not None
                else None
            ),
            "expected_sign": 1,
        },
    ]

    correlations: List[Dict[str, Any]] = []
    for pair in pairs_to_test:
        xs: List[float] = []
        ys: List[float] = []
        for r in records:
            x_val = pair["x_extractor"](r)
            y_val = pair["y_extractor"](r)
            if x_val is not None and y_val is not None:
                xs.append(x_val)
                ys.append(y_val)

        if len(xs) >= 3:
            rho, p_val = compute_spearman_correlation(xs, ys)
            meets_target = abs(rho) >= 0.70
        else:
            rho, p_val, meets_target = 0.0, 1.0, False

        correlations.append(
            {
                "criterion": pair["criterion"],
                "metric": pair["metric"],
                "n": len(xs),
                "spearman_rho": rho,
                "p_value": p_val,
                "meets_target": meets_target,
            }
        )

    # 2. Band distribution breakdowns
    band_distributions = {
        "Slant (slant_mean)": compute_band_distribution(records, "slant_mean", "manual_slant_band"),
        "Word Spacing (word_spacing_mean)": compute_band_distribution(
            records, "word_spacing_mean", "manual_spacing_band"
        ),
        "Letter Spacing (letter_spacing_mean)": compute_band_distribution(
            records, "letter_spacing_mean", "manual_spacing_band"
        ),
        "Baseline Alignment (baseline_deviation_mean)": compute_band_distribution(
            records, "baseline_deviation_mean", "manual_baseline_alignment_band"
        ),
        "Size Consistency (size_consistency_mean)": compute_band_distribution(
            records, "size_consistency_mean", "manual_size_consistency_band"
        ),
        "Letter Formation (letter_formation_mean)": compute_band_distribution(
            records, "letter_formation_mean", "manual_letter_formation_band"
        ),
    }

    # 3. Derive recommended calibration constants
    constants = derive_calibration_constants(records)

    analysis_results = {
        "sample_size": n,
        "correlations": correlations,
        "band_distributions": band_distributions,
        "constants": constants,
    }

    # 4. Generate outputs
    output_dir.mkdir(parents=True, exist_ok=True)
    report_file = output_dir / "correlation_analysis_report.md"
    generate_markdown_report(analysis_results, report_file)

    constants_file = output_dir / "calibration_constants.json"
    with open(constants_file, "w", encoding="utf-8") as f:
        json.dump(constants, f, indent=2)
    logger.info("Saved calibration constants to %s", constants_file)

    # Print ASCII table to console
    print("\n" + "=" * 80)
    print("WriteWise Correlation Analysis (Spearman's Rho vs. PRD §11 Target >= 0.70)")
    print("=" * 80)
    print(format_correlation_table(correlations))
    print("=" * 80 + "\n")

    return analysis_results


def main() -> None:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(
        description="Analyze Spearman's correlation and derive calibration thresholds."
    )
    parser.add_argument(
        "--input",
        "-i",
        type=Path,
        default=Path("research/output/paired_measurements.csv"),
        help="Path to paired_measurements.csv",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        type=Path,
        default=Path("research/output"),
        help="Directory to save analysis report and calibration constants",
    )
    args = parser.parse_args()

    try:
        run_analysis(input_csv=args.input, output_dir=args.output_dir)
    except Exception as e:
        logger.error("Analysis failed: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
