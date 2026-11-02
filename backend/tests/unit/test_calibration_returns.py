"""Invalid worksheet returns cannot silently enter correlation or model training."""

import csv
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))


@pytest.mark.parametrize(
    "reason,eligible",
    [
        ("wrong_worksheet", False),
        ("blurry_or_cropped", False),
        ("wrong_target_text", False),
        ("incomplete", True),
        ("other", True),
        ("", True),
    ],
)
def test_calibration_csv_filters_invalid_returns_but_preserves_other_attempts(
    tmp_path, reason, eligible
):
    from research.calibration_filters import read_calibration_csv

    path = tmp_path / "paired.csv"
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["score", "return_reason", "is_active_attempt"])
        writer.writeheader()
        writer.writerow({"score": "87.5", "return_reason": reason, "is_active_attempt": "False"})
    rows = read_calibration_csv(path)
    assert len(rows) == int(eligible)
    assert len(read_calibration_csv(path, include_invalid_returns=True)) == 1


def test_legacy_calibration_csv_without_return_fields_still_loads(tmp_path):
    from research.calibration_filters import read_calibration_csv

    path = tmp_path / "old.csv"
    path.write_text("score,band\n87.5,excellent\n", encoding="utf-8")
    assert read_calibration_csv(path) == [{"score": "87.5", "band": "excellent"}]


def test_correlation_loader_excludes_invalid_returns_before_numeric_analysis(tmp_path):
    from research.analyze_correlations import load_measurements_csv

    path = tmp_path / "measurements.csv"
    path.write_text(
        "submission_code,slant_mean,return_reason\nBAD,90,wrong_worksheet\nGOOD,12.5,incomplete\n",
        encoding="utf-8",
    )
    assert load_measurements_csv(path) == [
        {
            "submission_code": "GOOD",
            "slant_mean": 12.5,
            "return_reason": "incomplete",
        }
    ]
    assert len(load_measurements_csv(path, include_invalid_returns=True)) == 2


@pytest.mark.parametrize("include_invalid,expected", [(False, [37.5]), (True, [37.5, 87.5])])
def test_stage2_dataset_filters_invalid_return_labels(tmp_path, include_invalid, expected):
    from PIL import Image
    from training.stage2_calibrate import load_paired_dataset

    Image.new("RGB", (96, 96), "white").save(tmp_path / "crop.png")
    path = tmp_path / "crops.csv"
    path.write_text(
        "crop_path,score,return_reason\ncrop.png,87.5,wrong_target_text\ncrop.png,37.5,other\n",
        encoding="utf-8",
    )
    train, _ = load_paired_dataset(str(path), include_invalid_returns=include_invalid)
    labels = sorted(float(value) for _, batch in train for value in batch.numpy().flatten())
    assert labels == expected
