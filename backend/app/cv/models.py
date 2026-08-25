"""CV Pipeline §8: Output Schema Data Models."""

from dataclasses import asdict, dataclass
from typing import Any, Dict, List


@dataclass
class MetricSummary:
    """Statistical summary (mean and standard deviation)."""

    mean: float
    std: float


@dataclass
class AggregateMetrics:
    """Aggregate handwriting quality measurements across the entire worksheet."""

    slant: MetricSummary
    word_spacing: MetricSummary
    letter_spacing: MetricSummary
    baseline_deviation: MetricSummary
    size_consistency: MetricSummary


@dataclass
class WordMeasurement:
    """Per-word geometric measurements."""

    word_index: int
    bbox: List[int]  # [x, y, w, h]
    slant_deg: float
    baseline_deviation_ratio: float
    size_ratio: float


@dataclass
class LineMeasurement:
    """Per-line measurements and gap distributions."""

    line_index: int
    words: List[WordMeasurement]
    word_gaps: List[float]
    intra_word_gaps: List[float]


@dataclass
class GuideLinesData:
    """Detected reference guidelines geometry."""

    baseline_y: List[int]
    midline_y: List[int]
    topline_y: List[int]


@dataclass
class MeasurementData:
    """Complete CV measurement schema stored in Measurement.raw_cv_data."""

    guide_lines: GuideLinesData
    lines: List[LineMeasurement]
    aggregate: AggregateMetrics

    def to_dict(self) -> Dict[str, Any]:
        """Convert dataclass hierarchy to standard JSON-compatible dictionary."""
        return asdict(self)
