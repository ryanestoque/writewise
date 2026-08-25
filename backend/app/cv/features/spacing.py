"""CV Pipeline §6.2: Spacing Regularity Feature Extraction.

Aggregates word-to-word spacing and intra-word (letter) spacing regularity across lines.
"""

from typing import List, Tuple

import numpy as np

from app.cv.models import MetricSummary
from app.cv.segmentation import LineSegment


def calc_stats(values: List[float]) -> MetricSummary:
    """Calculate mean and sample standard deviation for a list of values."""
    if not values:
        return MetricSummary(mean=0.0, std=0.0)
    if len(values) == 1:
        return MetricSummary(mean=round(float(values[0]), 2), std=0.0)

    mean_val = float(np.mean(values))
    std_val = float(np.std(values, ddof=1))
    return MetricSummary(mean=round(mean_val, 2), std=round(std_val, 2))


def compute_spacing_metrics(
    lines: List[LineSegment],
) -> Tuple[MetricSummary, MetricSummary]:
    """Compute aggregate word spacing and letter spacing statistics.

    Parameters
    ----------
    lines : List[LineSegment]
        Segmented writing lines containing normalized gap measurements.

    Returns
    -------
    Tuple[MetricSummary, MetricSummary]
        (word_spacing_summary, letter_spacing_summary)
    """
    all_word_gaps: List[float] = []
    all_letter_gaps: List[float] = []

    for line in lines:
        all_word_gaps.extend(line.word_gaps)
        all_letter_gaps.extend(line.intra_word_gaps)

    word_spacing = calc_stats(all_word_gaps)
    letter_spacing = calc_stats(all_letter_gaps)

    return word_spacing, letter_spacing
