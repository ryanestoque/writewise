import csv
import sys
from pathlib import Path

import pytest

# Ensure research directory is importable
repo_root = Path(__file__).resolve().parent.parent.parent
research_dir = repo_root / "research"
if str(research_dir) not in sys.path:
    sys.path.insert(0, str(research_dir))
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from analyze_correlations import (  # noqa: E402
    compute_band_distribution,
    compute_ranks,
    compute_spearman_correlation,
    derive_calibration_constants,
    format_correlation_table,
    run_analysis,
)


def test_compute_ranks_basic():
    """Test ranking without ties."""
    values = [10.0, 30.0, 20.0, 40.0]
    ranks = compute_ranks(values)
    assert ranks == [1.0, 3.0, 2.0, 4.0]


def test_compute_ranks_with_ties():
    """Test fractional ranking when ties exist."""
    values = [10.0, 20.0, 20.0, 30.0]
    ranks = compute_ranks(values)
    assert ranks == [1.0, 2.5, 2.5, 4.0]

    all_tied = [5.0, 5.0, 5.0]
    assert compute_ranks(all_tied) == [2.0, 2.0, 2.0]


def test_compute_ranks_empty():
    assert compute_ranks([]) == []


def test_spearman_correlation_perfect():
    """Perfect positive and negative rank correlations."""
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [10.0, 20.0, 30.0, 40.0, 50.0]
    rho, p_val = compute_spearman_correlation(x, y)
    assert pytest.approx(rho, abs=1e-4) == 1.0
    assert p_val < 0.05

    # Inverted
    y_rev = [50.0, 40.0, 30.0, 20.0, 10.0]
    rho_rev, p_val_rev = compute_spearman_correlation(x, y_rev)
    assert pytest.approx(rho_rev, abs=1e-4) == -1.0
    assert p_val_rev < 0.05


def test_spearman_correlation_edge_cases():
    """Test edge cases: zero variance, small sample size, mismatched lengths."""
    # Zero variance in y
    x = [1.0, 2.0, 3.0, 4.0]
    y = [5.0, 5.0, 5.0, 5.0]
    rho, p_val = compute_spearman_correlation(x, y)
    assert rho == 0.0
    assert p_val == 1.0

    # Less than 3 observations
    rho_small, p_val_small = compute_spearman_correlation([1.0, 2.0], [2.0, 4.0])
    assert p_val_small == 1.0

    # Empty inputs
    rho_empty, p_val_empty = compute_spearman_correlation([], [])
    assert rho_empty == 0.0
    assert p_val_empty == 1.0


@pytest.fixture
def mock_paired_records():
    """Fixture producing synthetic paired measurement records across 4 bands."""
    records = []
    # Band 1: Needs Improvement (score ~20)
    for i in range(5):
        records.append(
            {
                "student_code": f"STUDENT_{i:03d}",
                "submission_code": f"SUB_{i:03d}",
                "slant_mean": 25.0 + i * 0.5,
                "slant_std": 3.0,
                "word_spacing_mean": 0.5 + i * 0.05,
                "word_spacing_std": 0.1,
                "letter_spacing_mean": 0.1 + i * 0.02,
                "letter_spacing_std": 0.05,
                "baseline_deviation_mean": 0.25 + i * 0.02,
                "baseline_deviation_std": 0.05,
                "size_consistency_mean": 0.50 + i * 0.02,
                "size_consistency_std": 0.1,
                "letter_formation_mean": 20.0 + i * 1.0,
                "letter_formation_std": 2.0,
                "manual_slant_band": "Needs Improvement",
                "manual_slant_score": 20.0,
                "manual_spacing_band": "Needs Improvement",
                "manual_spacing_score": 20.0,
                "manual_baseline_alignment_band": "Needs Improvement",
                "manual_baseline_alignment_score": 20.0,
                "manual_size_consistency_band": "Needs Improvement",
                "manual_size_consistency_score": 20.0,
                "manual_letter_formation_band": "Needs Improvement",
                "manual_letter_formation_score": 20.0,
            }
        )

    # Band 2: Developing (score ~45)
    for i in range(5):
        records.append(
            {
                "student_code": f"STUDENT_{i + 5:03d}",
                "submission_code": f"SUB_{i + 5:03d}",
                "slant_mean": 20.0 + i * 0.4,
                "slant_std": 2.5,
                "word_spacing_mean": 1.0 + i * 0.05,
                "word_spacing_std": 0.1,
                "letter_spacing_mean": 0.2 + i * 0.02,
                "letter_spacing_std": 0.04,
                "baseline_deviation_mean": 0.15 + i * 0.01,
                "baseline_deviation_std": 0.03,
                "size_consistency_mean": 0.70 + i * 0.02,
                "size_consistency_std": 0.08,
                "letter_formation_mean": 45.0 + i * 1.0,
                "letter_formation_std": 2.0,
                "manual_slant_band": "Developing",
                "manual_slant_score": 45.0,
                "manual_spacing_band": "Developing",
                "manual_spacing_score": 45.0,
                "manual_baseline_alignment_band": "Developing",
                "manual_baseline_alignment_score": 45.0,
                "manual_size_consistency_band": "Developing",
                "manual_size_consistency_score": 45.0,
                "manual_letter_formation_band": "Developing",
                "manual_letter_formation_score": 45.0,
            }
        )

    # Band 3: Satisfactory (score ~70)
    for i in range(5):
        records.append(
            {
                "student_code": f"STUDENT_{i + 10:03d}",
                "submission_code": f"SUB_{i + 10:03d}",
                "slant_mean": 16.0 + i * 0.2,
                "slant_std": 2.0,
                "word_spacing_mean": 1.6 + i * 0.05,
                "word_spacing_std": 0.1,
                "letter_spacing_mean": 0.35 + i * 0.01,
                "letter_spacing_std": 0.02,
                "baseline_deviation_mean": 0.08 + i * 0.01,
                "baseline_deviation_std": 0.02,
                "size_consistency_mean": 0.90 + i * 0.02,
                "size_consistency_std": 0.05,
                "letter_formation_mean": 70.0 + i * 1.0,
                "letter_formation_std": 1.5,
                "manual_slant_band": "Satisfactory",
                "manual_slant_score": 70.0,
                "manual_spacing_band": "Satisfactory",
                "manual_spacing_score": 70.0,
                "manual_baseline_alignment_band": "Satisfactory",
                "manual_baseline_alignment_score": 70.0,
                "manual_size_consistency_band": "Satisfactory",
                "manual_size_consistency_score": 70.0,
                "manual_letter_formation_band": "Satisfactory",
                "manual_letter_formation_score": 70.0,
            }
        )

    # Band 4: Excellent (score ~90)
    for i in range(5):
        records.append(
            {
                "student_code": f"STUDENT_{i + 15:03d}",
                "submission_code": f"SUB_{i + 15:03d}",
                "slant_mean": 12.5 + i * 0.1,
                "slant_std": 1.0,
                "word_spacing_mean": 2.0 + i * 0.02,
                "word_spacing_std": 0.05,
                "letter_spacing_mean": 0.40 + i * 0.01,
                "letter_spacing_std": 0.01,
                "baseline_deviation_mean": 0.02 + i * 0.005,
                "baseline_deviation_std": 0.01,
                "size_consistency_mean": 1.00 + i * 0.01,
                "size_consistency_std": 0.03,
                "letter_formation_mean": 90.0 + i * 1.0,
                "letter_formation_std": 1.0,
                "manual_slant_band": "Excellent",
                "manual_slant_score": 90.0,
                "manual_spacing_band": "Excellent",
                "manual_spacing_score": 90.0,
                "manual_baseline_alignment_band": "Excellent",
                "manual_baseline_alignment_score": 90.0,
                "manual_size_consistency_band": "Excellent",
                "manual_size_consistency_score": 90.0,
                "manual_letter_formation_band": "Excellent",
                "manual_letter_formation_score": 90.0,
            }
        )

    return records


def test_compute_band_distribution(mock_paired_records):
    """Test distribution computation per rubric band."""
    stats = compute_band_distribution(
        mock_paired_records,
        metric_key="baseline_deviation_mean",
        band_key="manual_baseline_alignment_band",
    )
    assert "Excellent" in stats
    assert "Needs Improvement" in stats
    assert stats["Excellent"]["count"] == 5
    assert stats["Needs Improvement"]["count"] == 5
    # Baseline deviation is lowest for Excellent
    assert stats["Excellent"]["median"] < stats["Needs Improvement"]["median"]


def test_derive_calibration_constants(mock_paired_records):
    """Test deriving recommended constants for ScoreProvider."""
    constants = derive_calibration_constants(mock_paired_records)

    assert "SLANT_TARGET_DEG" in constants
    assert "SLANT_PENALTY_FACTOR" in constants
    assert "WORD_GAP_TARGET_RATIO" in constants
    assert "WORD_GAP_PENALTY_FACTOR" in constants
    assert "BASELINE_DEV_PENALTY_FACTOR" in constants
    assert "SIZE_RATIO_TARGET" in constants
    assert "SIZE_DEV_PENALTY_FACTOR" in constants

    # Excellent slant mean in fixture is ~12.7
    assert 11.0 <= constants["SLANT_TARGET_DEG"] <= 15.0
    # Size ratio target in fixture is ~1.0
    assert 0.9 <= constants["SIZE_RATIO_TARGET"] <= 1.1


def test_format_correlation_table():
    """Test ASCII table formatting."""
    results = [
        {
            "criterion": "Slant",
            "metric": "abs(slant - 12.5)",
            "n": 20,
            "spearman_rho": -0.85,
            "p_value": 0.0001,
            "meets_target": True,
        },
        {
            "criterion": "Baseline Alignment",
            "metric": "baseline_deviation_mean",
            "n": 20,
            "spearman_rho": -0.75,
            "p_value": 0.0002,
            "meets_target": True,
        },
    ]
    table = format_correlation_table(results)
    assert "Slant" in table
    assert "Baseline Alignment" in table
    assert "PASS" in table


def test_run_analysis_end_to_end(tmp_path, mock_paired_records):
    """Test running analysis from CSV input to report and JSON artifacts."""
    csv_file = tmp_path / "paired_measurements.csv"
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(mock_paired_records[0].keys()))
        writer.writeheader()
        writer.writerows(mock_paired_records)

    out_dir = tmp_path / "analysis_output"
    summary = run_analysis(input_csv=csv_file, output_dir=out_dir)

    assert summary["sample_size"] == 20
    assert "correlations" in summary
    assert "constants" in summary

    report_file = out_dir / "correlation_analysis_report.md"
    constants_file = out_dir / "calibration_constants.json"

    assert report_file.is_file()
    assert constants_file.is_file()

    content = report_file.read_text(encoding="utf-8")
    assert "# WriteWise — Correlation & Calibration Analysis Report" in content
    assert "Spearman" in content
