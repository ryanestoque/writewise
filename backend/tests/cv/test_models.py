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
