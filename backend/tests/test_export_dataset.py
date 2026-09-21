import csv
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Ensure research directory is importable
repo_root = Path(__file__).resolve().parent.parent.parent
research_dir = repo_root / "research"
if str(research_dir) not in sys.path:
    sys.path.insert(0, str(research_dir))
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from export_dataset import (  # noqa: E402
    anonymize_id,
    build_crop_records,
    build_measurements_records,
    calculate_summary_stats,
    filter_paired_records,
    format_summary_report,
    run_export,
)


@pytest.fixture
def sample_paired_data():
    """Create sample submission, measurement, and manual_score records."""
    student_a = "11111111-1111-1111-1111-111111111111"
    student_b = "22222222-2222-2222-2222-222222222222"
    sub_1 = "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    sub_2 = "aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    return [
        {
            "submission": {
                "id": sub_1,
                "student_id": student_a,
                "image_path": f"{student_a}/{sub_1}.jpg",
                "status": "completed",
            },
            "measurement": {
                "id": "m1",
                "submission_id": sub_1,
                "slant_mean": 12.5,
                "slant_std": 2.1,
                "word_spacing_mean": 1.4,
                "word_spacing_std": 0.3,
                "letter_spacing_mean": 0.8,
                "letter_spacing_std": 0.1,
                "baseline_deviation_mean": 0.05,
                "baseline_deviation_std": 0.01,
                "size_consistency_mean": 1.02,
                "size_consistency_std": 0.08,
                "letter_formation_mean": 78.4,
                "letter_formation_std": 5.2,
                "raw_output": {
                    "lines": [
                        {
                            "words": [
                                {"word_index": 0, "bbox": [10, 20, 50, 30]},
                                {"word_index": 1, "bbox": [70, 20, 45, 30]},
                            ]
                        }
                    ]
                },
            },
            "manual_score": {
                "id": "ms1",
                "submission_id": sub_1,
                "letter_formation_band": "satisfactory",
                "letter_formation_score": 62.5,
                "size_consistency_band": "excellent",
                "size_consistency_score": 87.5,
                "spacing_band": "satisfactory",
                "spacing_score": 62.5,
                "slant_band": "developing",
                "slant_score": 37.5,
                "baseline_alignment_band": "excellent",
                "baseline_alignment_score": 87.5,
            },
        },
        {
            "submission": {
                "id": sub_2,
                "student_id": student_b,
                "image_path": f"{student_b}/{sub_2}.jpg",
                "status": "completed",
            },
            "measurement": {
                "id": "m2",
                "submission_id": sub_2,
                "slant_mean": 15.0,
                "slant_std": 3.0,
                "word_spacing_mean": 1.2,
                "word_spacing_std": 0.2,
                "letter_spacing_mean": 0.7,
                "letter_spacing_std": 0.1,
                "baseline_deviation_mean": 0.08,
                "baseline_deviation_std": 0.02,
                "size_consistency_mean": 0.95,
                "size_consistency_std": 0.12,
                "letter_formation_mean": 55.0,
                "letter_formation_std": 8.0,
                "raw_output": {
                    "lines": [
                        {
                            "words": [
                                {"word_index": 0, "bbox": [15, 25, 60, 35]},
                            ]
                        }
                    ]
                },
            },
            "manual_score": {
                "id": "ms2",
                "submission_id": sub_2,
                "letter_formation_band": "needs_improvement",
                "letter_formation_score": 12.5,
                "size_consistency_band": "developing",
                "size_consistency_score": 37.5,
                "spacing_band": "developing",
                "spacing_score": 37.5,
                "slant_band": "needs_improvement",
                "slant_score": 12.5,
                "baseline_alignment_band": "developing",
                "baseline_alignment_score": 37.5,
            },
        },
    ]


def test_anonymize_id():
    """Test opaque sequential anonymization with consistency."""
    mapping = {}
    id_1 = "uuid-1234"
    id_2 = "uuid-5678"

    code_1a = anonymize_id(id_1, mapping, prefix="STUDENT")
    assert code_1a == "STUDENT_001"

    # Same UUID must return the identical anonymized code
    code_1b = anonymize_id(id_1, mapping, prefix="STUDENT")
    assert code_1b == "STUDENT_001"

    # New UUID gets next incremented code
    code_2 = anonymize_id(id_2, mapping, prefix="STUDENT")
    assert code_2 == "STUDENT_002"


def test_filter_paired_records():
    """Only completed submissions with both measurement and manual_score are retained."""
    raw_submissions = [
        {"id": "sub_complete", "status": "completed", "student_id": "st1"},
        {"id": "sub_rejected", "status": "rejected", "student_id": "st2"},
        {"id": "sub_no_score", "status": "completed", "student_id": "st3"},
        {"id": "sub_no_measurement", "status": "completed", "student_id": "st4"},
    ]
    measurements = {
        "sub_complete": {"submission_id": "sub_complete", "slant_mean": 10.0},
        "sub_no_score": {"submission_id": "sub_no_score", "slant_mean": 12.0},
    }
    manual_scores = {
        "sub_complete": {"submission_id": "sub_complete", "letter_formation_band": "excellent"},
        "sub_no_measurement": {
            "submission_id": "sub_no_measurement",
            "letter_formation_band": "developing",
        },
    }

    paired = filter_paired_records(raw_submissions, measurements, manual_scores)
    assert len(paired) == 1
    assert paired[0]["submission"]["id"] == "sub_complete"
    assert "measurement" in paired[0]
    assert "manual_score" in paired[0]


def test_build_measurements_records(sample_paired_data):
    """Ensure all required columns are created and no PII exists."""
    student_map = {}
    sub_map = {}

    records = build_measurements_records(sample_paired_data, student_map, sub_map)

    assert len(records) == 2
    rec1 = records[0]

    # Check anonymized identifiers
    assert rec1["student_code"] == "STUDENT_001"
    assert rec1["submission_code"] == "SUBMISSION_001"

    # Verify no raw PII or UUIDs
    for forbidden_key in ["student_id", "id", "full_name", "teacher_id", "image_path"]:
        assert forbidden_key not in rec1

    # Check raw CV features (6 pairs)
    assert rec1["slant_mean"] == 12.5
    assert rec1["slant_std"] == 2.1
    assert rec1["word_spacing_mean"] == 1.4
    assert rec1["word_spacing_std"] == 0.3
    assert rec1["letter_spacing_mean"] == 0.8
    assert rec1["letter_spacing_std"] == 0.1
    assert rec1["baseline_deviation_mean"] == 0.05
    assert rec1["baseline_deviation_std"] == 0.01
    assert rec1["size_consistency_mean"] == 1.02
    assert rec1["size_consistency_std"] == 0.08
    assert rec1["letter_formation_mean"] == 78.4
    assert rec1["letter_formation_std"] == 5.2

    # Check manual scores
    assert rec1["manual_letter_formation_band"] == "satisfactory"
    assert rec1["manual_letter_formation_score"] == 62.5
    assert rec1["manual_size_consistency_band"] == "excellent"
    assert rec1["manual_size_consistency_score"] == 87.5
    assert rec1["manual_spacing_band"] == "satisfactory"
    assert rec1["manual_spacing_score"] == 62.5
    assert rec1["manual_slant_band"] == "developing"
    assert rec1["manual_slant_score"] == 37.5
    assert rec1["manual_baseline_alignment_band"] == "excellent"
    assert rec1["manual_baseline_alignment_score"] == 87.5


def test_build_crop_records(sample_paired_data):
    """Ensure crop records match stage2_calibrate.py expected schema."""
    sub_map = {}
    crops = build_crop_records(
        sample_paired_data,
        sub_map,
        crops_relative_dir="crops",
    )

    # Submission 1 had 2 words, Submission 2 had 1 word -> 3 total crops
    assert len(crops) == 3

    crop1 = crops[0]
    assert crop1["crop_path"] == "crops/SUBMISSION_001_word_000.jpg"
    assert crop1["submission_code"] == "SUBMISSION_001"
    assert crop1["word_index"] == 0
    assert crop1["band"] == "satisfactory"
    assert crop1["score"] == 62.5

    crop3 = crops[2]
    assert crop3["crop_path"] == "crops/SUBMISSION_002_word_000.jpg"
    assert crop3["submission_code"] == "SUBMISSION_002"
    assert crop3["word_index"] == 0
    assert crop3["band"] == "needs_improvement"
    assert crop3["score"] == 12.5


def test_calculate_summary_stats(sample_paired_data):
    """Verify summary statistics calculation."""
    stats = calculate_summary_stats(sample_paired_data)

    assert stats["total_submissions"] == 2
    assert stats["unique_students"] == 2

    # Band distribution check for letter formation
    lf_dist = stats["band_distribution"]["letter_formation"]
    assert lf_dist["satisfactory"] == 1
    assert lf_dist["needs_improvement"] == 1
    assert lf_dist["developing"] == 0
    assert lf_dist["excellent"] == 0


def test_format_summary_report(sample_paired_data):
    """Verify human-readable summary report contains privacy statement and distributions."""
    stats = calculate_summary_stats(sample_paired_data)
    report = format_summary_report(stats, crop_count=3)

    assert "Total Paired Submissions: 2" in report
    assert "Unique Anonymized Students: 2" in report
    assert "Total Word Crops Extracted: 3" in report
    assert "RA 10173 & Privacy Compliance Statement" in report
    assert "Letter Formation" in report


def test_run_export_mocked(tmp_path, sample_paired_data, monkeypatch):
    """Verify run_export creates all output files when mocked."""
    # Mock fetch_paired_records to return sample data
    monkeypatch.setattr(
        "export_dataset.fetch_paired_records",
        lambda client, limit=None: sample_paired_data,
    )
    # Mock client
    mock_client = MagicMock()
    monkeypatch.setattr("export_dataset.get_supabase_client", lambda env_file=None: mock_client)

    out_dir = tmp_path / "research_output"

    # Test with no crops first
    run_export(output_dir=out_dir, include_crops=False)

    meas_csv = out_dir / "paired_measurements.csv"
    summary_txt = out_dir / "export_summary.txt"

    assert meas_csv.is_file()
    assert summary_txt.is_file()

    with open(meas_csv, "r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))
        assert len(reader) == 2
        assert reader[0]["student_code"] == "STUDENT_001"
        assert reader[0]["submission_code"] == "SUBMISSION_001"
        assert float(reader[0]["slant_mean"]) == 12.5
