import json

import cv2
import numpy as np

from app.cv.features import extract_features
from app.cv.guide_lines import DeskewResult
from app.cv.models import (
    AggregateMetrics,
    GuideLinesData,
    LineMeasurement,
    MeasurementData,
    MetricSummary,
    WordMeasurement,
)
from app.cv.segmentation import LineSegment, SegmentationResult, WordSegment


def test_measurement_data_to_dict_matches_spec_structure():
    # Schema validation against CV_PIPELINE.md §8
    data = MeasurementData(
        guide_lines=GuideLinesData(
            baseline_y=[412, 498],
            midline_y=[438, 524],
            topline_y=[386, 472],
        ),
        lines=[
            LineMeasurement(
                line_index=0,
                words=[
                    WordMeasurement(
                        word_index=0,
                        bbox=[120, 390, 85, 48],
                        slant_deg=7.2,
                        baseline_deviation_ratio=0.04,
                        size_ratio=0.91,
                    )
                ],
                word_gaps=[1.8],
                intra_word_gaps=[0.3, 0.4],
            )
        ],
        aggregate=AggregateMetrics(
            slant=MetricSummary(mean=7.2, std=0.0),
            word_spacing=MetricSummary(mean=1.8, std=0.0),
            letter_spacing=MetricSummary(mean=0.35, std=0.05),
            baseline_deviation=MetricSummary(mean=0.04, std=0.0),
            size_consistency=MetricSummary(mean=0.91, std=0.0),
        ),
    )

    d = data.to_dict()
    assert "guide_lines" in d
    assert "lines" in d
    assert "aggregate" in d
    assert d["guide_lines"]["baseline_y"] == [412, 498]
    assert d["lines"][0]["words"][0]["slant_deg"] == 7.2
    assert d["aggregate"]["slant"]["mean"] == 7.2


def test_extract_features_end_to_end():
    # Setup dummy deskew and segmentation
    gray = np.full((600, 800), 200, dtype=np.uint8)
    denoised = np.full((600, 800), 200, dtype=np.uint8)
    binary = np.full((600, 800), 255, dtype=np.uint8)
    crop = np.full((40, 60), 255, dtype=np.uint8)
    crop[10:35, 10:50] = 0

    deskew = DeskewResult(
        gray=gray,
        denoised=denoised,
        binary=binary,
        baseline_y=[300],
        midline_y=[260],
        topline_y=[220],
    )

    word = WordSegment(
        word_index=0,
        bbox=(100, 260, 60, 40),
        gray_crop=crop,
        binary_crop=crop,
        intra_word_gaps=[0.3],
        raw_intra_word_gaps=[12],
    )
    line = LineSegment(
        line_index=0,
        row_band=(200, 350),
        topline_y=220,
        midline_y=260,
        baseline_y=300,
        words=[word],
        word_gaps=[],
        raw_word_gaps=[],
        intra_word_gaps=[0.3],
    )
    seg = SegmentationResult(lines=[line], total_word_count=1)

    meas = extract_features(seg, deskew)
    assert len(meas.lines) == 1
    assert len(meas.lines[0].words) == 1
    assert meas.aggregate.size_consistency.mean > 0.0
    assert meas.guide_lines.baseline_y == [300]


def _extract_slant_crops(crops):
    frame = np.zeros((300, 1000), dtype=np.uint8)
    deskew = DeskewResult(
        gray=255 - frame,
        denoised=255 - frame,
        binary=frame,
        baseline_y=[100],
        midline_y=[20],
        topline_y=[-60],
    )
    words = [
        WordSegment(index, (index * 400, 0, crop.shape[1], crop.shape[0]), 255 - crop, crop)
        for index, crop in enumerate(crops)
    ]
    line = LineSegment(0, (0, 200), -60, 20, 100, words=words)
    return extract_features(SegmentationResult([line], len(words)), deskew)


def test_unmeasurable_word_does_not_pull_mean_slant_toward_zero():
    crop = np.zeros((130, 180), dtype=np.uint8)
    cv2.line(crop, (100, 20), (79, 100), 255, 5)
    measurement = _extract_slant_crops([crop, np.zeros_like(crop)])
    assert abs(measurement.aggregate.slant.mean - 15) <= 2
    assert measurement.lines[0].words[1].slant_deg is None
    assert measurement.slant_analysis.measured_words == 1
    assert measurement.slant_analysis.total_words == 2
    assert measurement.slant_analysis.within_word_std_deg <= 2


def test_no_stem_evidence_persists_null_and_method_version():
    measurement = _extract_slant_crops([np.zeros((130, 180), dtype=np.uint8)])
    assert measurement.aggregate.slant.mean is None
    assert measurement.aggregate.slant.std is None
    raw = measurement.to_dict()
    assert raw["slant_analysis"]["method"] == "lsd_stems_v2"
    assert raw["slant_analysis"]["measured_words"] == 0
    assert raw["slant_analysis"]["within_word_std_deg"] is None
    json.dumps(raw, allow_nan=False)
