"""ML Pipeline §11: Letter-formation output data models.

Extends the CV pipeline's MeasurementData with per-word letter_formation_score
and aggregate letter_formation {mean, std}.
"""

from dataclasses import dataclass


@dataclass
class WordFormationScore:
    """Per-word letter-formation score from the CNN."""

    word_index: int
    letter_formation_score: float  # clamped [0, 100]


@dataclass
class LetterFormationResult:
    """Aggregate CNN inference result for a submission's word crops."""

    word_scores: list[WordFormationScore]
    aggregate_mean: float
    aggregate_std: float
