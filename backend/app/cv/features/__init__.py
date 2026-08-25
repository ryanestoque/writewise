"""CV Pipeline §6: Feature Extraction Orchestration."""

from typing import List

from app.cv.features.baseline import compute_baseline_deviation
from app.cv.features.size import compute_size_ratio
from app.cv.features.slant import compute_word_slant
from app.cv.features.spacing import calc_stats, compute_spacing_metrics
from app.cv.guide_lines import DeskewResult
from app.cv.models import (
    AggregateMetrics,
    GuideLinesData,
    LineMeasurement,
    MeasurementData,
    WordMeasurement,
)
from app.cv.segmentation import SegmentationResult


def extract_features(
    segmentation: SegmentationResult,
    deskew: DeskewResult,
) -> MeasurementData:
    """Extract geometric measurements for all words and assemble the §8 Measurement schema.

    Parameters
    ----------
    segmentation : SegmentationResult
        Lines, words, and gap metrics from segmentation stage.
    deskew : DeskewResult
        Deskewed images and guideline positions.

    Returns
    -------
    MeasurementData
        Complete measurement schema matching CV_PIPELINE.md §8.
    """
    line_measurements: List[LineMeasurement] = []
    all_slants: List[float] = []
    all_baseline_devs: List[float] = []
    all_size_ratios: List[float] = []

    for line in segmentation.lines:
        words_in_line: List[WordMeasurement] = []
        unit_height = max(1.0, float(line.baseline_y - line.midline_y))

        for word in line.words:
            # §6.1 Slant
            slant_deg = compute_word_slant(
                binary_crop=word.binary_crop,
                reference_perpendicular_deg=90.0,
            )
            all_slants.append(slant_deg)

            # §6.3 Baseline Deviation
            base_dev = compute_baseline_deviation(
                word_bbox=word.bbox,
                baseline_y=line.baseline_y,
                unit_height=unit_height,
                binary_crop=word.binary_crop,
            )
            all_baseline_devs.append(base_dev)

            # §6.4 Size Consistency
            size_rat = compute_size_ratio(
                binary_crop=word.binary_crop,
                word_bbox=word.bbox,
                midline_y=line.midline_y,
                baseline_y=line.baseline_y,
                unit_height=unit_height,
            )
            all_size_ratios.append(size_rat)

            words_in_line.append(
                WordMeasurement(
                    word_index=word.word_index,
                    bbox=list(word.bbox),
                    slant_deg=slant_deg,
                    baseline_deviation_ratio=base_dev,
                    size_ratio=size_rat,
                )
            )

        line_measurements.append(
            LineMeasurement(
                line_index=line.line_index,
                words=words_in_line,
                word_gaps=line.word_gaps,
                intra_word_gaps=line.intra_word_gaps,
            )
        )

    # §6.2 Spacing aggregates
    word_spacing_metric, letter_spacing_metric = compute_spacing_metrics(segmentation.lines)

    # Aggregate summaries
    slant_summary = calc_stats(all_slants)
    baseline_summary = calc_stats(all_baseline_devs)
    size_summary = calc_stats(all_size_ratios)

    aggregate = AggregateMetrics(
        slant=slant_summary,
        word_spacing=word_spacing_metric,
        letter_spacing=letter_spacing_metric,
        baseline_deviation=baseline_summary,
        size_consistency=size_summary,
    )

    guide_lines = GuideLinesData(
        baseline_y=deskew.baseline_y,
        midline_y=deskew.midline_y,
        topline_y=deskew.topline_y,
    )

    return MeasurementData(
        guide_lines=guide_lines,
        lines=line_measurements,
        aggregate=aggregate,
    )
