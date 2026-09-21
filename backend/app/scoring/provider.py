"""Scoring Provider Abstraction (ARCHITECTURE §10, ML_PIPELINE §6.4–§6.5).

Provides interchangeable scoring engine implementations:
- ManualScoreProvider (Phase 1): returns None for all score columns at upload time;
  teacher enters scores later via manual rubric grading.
- CalibratedScoreProvider (Phase 2): maps raw CV measurements to [0, 100] calibrated
  scores via derived threshold formulas, with identity passthrough for the CNN
  letter-formation score.
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from app.core.config import settings
from app.cv.models import AggregateMetrics
from app.ml.models import LetterFormationResult

logger = logging.getLogger(__name__)

# Calibration baseline targets and penalty constants (Phase 2 placeholder).
# In production, these constants are calibrated from paired Phase 1 data
# (Spearman's rank correlation against teacher rubric evaluations).
SLANT_TARGET_DEG = 12.5  # Ideal forward cursive slant (~10°-15°)
SLANT_PENALTY_FACTOR = 2.5

WORD_GAP_TARGET_RATIO = 2.0  # Ideal word spacing relative to midline height
WORD_GAP_PENALTY_FACTOR = 35.0

LETTER_GAP_TARGET_RATIO = 0.4  # Ideal letter spacing relative to midline height
LETTER_GAP_PENALTY_FACTOR = 100.0

BASELINE_DEV_PENALTY_FACTOR = 350.0  # Deviation relative to guideline height

SIZE_RATIO_TARGET = 1.0  # Proportion matching expected 3-line guideline height
SIZE_DEV_PENALTY_FACTOR = 120.0


def _clamp(val: float, min_val: float = 0.0, max_val: float = 100.0) -> float:
    """Clamp numeric score to [min_val, max_val] and round to 2 decimal places."""
    try:
        f = float(val)
        if f != f:  # NaN check
            return min_val
        return round(max(min_val, min(max_val, f)), 2)
    except (TypeError, ValueError):
        return min_val


@dataclass
class CriterionScores:
    """Computed or placeholder scores across the 5 PRD handwriting criteria.

    All score fields live on the standardized 0–100 scale (DATABASE §8).
    """

    letter_formation_score: float | None = None
    size_consistency_score: float | None = None
    spacing_score: float | None = None
    slant_score: float | None = None
    baseline_alignment_score: float | None = None

    @property
    def composite_score(self) -> float | None:
        """Unweighted arithmetic mean of all 5 criteria, or None if any criterion is None.

        Mirrors the Postgres stored generated column on public.measurement (DATABASE §8).
        """
        scores = [
            self.letter_formation_score,
            self.size_consistency_score,
            self.spacing_score,
            self.slant_score,
            self.baseline_alignment_score,
        ]
        if any(s is None for s in scores):
            return None
        return round(sum(scores) / 5.0, 2)

    def to_dict(self) -> dict[str, float | None]:
        """API_SPEC §3.3 scores dictionary containing all 5 criteria + composite_score."""
        return {
            "letter_formation_score": self.letter_formation_score,
            "size_consistency_score": self.size_consistency_score,
            "spacing_score": self.spacing_score,
            "slant_score": self.slant_score,
            "baseline_alignment_score": self.baseline_alignment_score,
            "composite_score": self.composite_score,
        }

    def to_db_dict(self) -> dict[str, float | None]:
        """Dictionary of column values for public.measurement table.

        Omits composite_score because it is a GENERATED ALWAYS stored column in Postgres.
        """
        return {
            "letter_formation_score": self.letter_formation_score,
            "size_consistency_score": self.size_consistency_score,
            "spacing_score": self.spacing_score,
            "slant_score": self.slant_score,
            "baseline_alignment_score": self.baseline_alignment_score,
        }


class ScoreProvider(ABC):
    """Abstract interface for scoring engine implementations (ARCHITECTURE §10)."""

    @abstractmethod
    def compute_scores(
        self,
        aggregate: AggregateMetrics | dict[str, Any],
        ml_result: LetterFormationResult | float | None = None,
    ) -> CriterionScores:
        """Compute criterion scores from raw CV aggregates and ML letter formation output."""
        pass

    def compute_score(
        self,
        aggregate: AggregateMetrics | dict[str, Any],
        ml_result: LetterFormationResult | float | None = None,
    ) -> CriterionScores:
        """Alias for compute_scores matching ARCHITECTURE §10 naming."""
        return self.compute_scores(aggregate, ml_result)


class ManualScoreProvider(ScoreProvider):
    """Phase 1 ScoreProvider: returns None for all criteria at upload/processing time.

    In Phase 1, scores are entered asynchronously by teachers via the manual rubric endpoint
    (PATCH /api/submissions/{id}/manual-score) and stored in public.manual_score.
    """

    def compute_scores(
        self,
        aggregate: AggregateMetrics | dict[str, Any],
        ml_result: LetterFormationResult | float | None = None,
    ) -> CriterionScores:
        return CriterionScores()


class CalibratedScoreProvider(ScoreProvider):
    """Phase 2 ScoreProvider: calculates 0–100 calibrated scores from raw measurements.

    - Slant, Spacing, Baseline Alignment, Size Consistency: threshold mapping formulas
      applied to raw OpenCV geometric aggregates.
    - Letter Formation: identity passthrough from CNN inference output (ML_PIPELINE §6.4–§6.5).
    """

    def _extract_metric(
        self,
        aggregate: AggregateMetrics | dict[str, Any],
        key: str,
        subkey: str = "mean",
        default: float = 0.0,
    ) -> float:
        """Extract a mean/std value from AggregateMetrics dataclass or dict."""
        if isinstance(aggregate, AggregateMetrics):
            obj = getattr(aggregate, key, None)
            if obj is not None and hasattr(obj, subkey):
                return float(getattr(obj, subkey))
            return default
        elif isinstance(aggregate, dict):
            # Nested dictionary: {"slant": {"mean": 12.5}}
            if key in aggregate and isinstance(aggregate[key], dict):
                return float(aggregate[key].get(subkey, default))
            # Flat dictionary: {"slant_mean": 12.5}
            flat_key = f"{key}_{subkey}"
            if flat_key in aggregate and aggregate[flat_key] is not None:
                return float(aggregate[flat_key])
        return default

    def _extract_letter_formation(
        self,
        aggregate: AggregateMetrics | dict[str, Any],
        ml_result: LetterFormationResult | float | None,
    ) -> float | None:
        """Extract letter formation mean from LetterFormationResult or aggregate."""
        if isinstance(ml_result, LetterFormationResult):
            return ml_result.aggregate_mean
        elif isinstance(ml_result, (int, float)):
            return float(ml_result)
        elif isinstance(aggregate, dict):
            if (
                "letter_formation_mean" in aggregate
                and aggregate["letter_formation_mean"] is not None
            ):
                return float(aggregate["letter_formation_mean"])
            if (
                "letter_formation" in aggregate
                and isinstance(aggregate["letter_formation"], dict)
                and aggregate["letter_formation"].get("mean") is not None
            ):
                return float(aggregate["letter_formation"]["mean"])
        return None

    def compute_scores(
        self,
        aggregate: AggregateMetrics | dict[str, Any],
        ml_result: LetterFormationResult | float | None = None,
    ) -> CriterionScores:
        # 1. Slant score: penalty for deviation from standard ~12.5° forward slant
        slant_mean = self._extract_metric(aggregate, "slant", "mean", default=12.5)
        slant_dev = abs(slant_mean - SLANT_TARGET_DEG)
        slant_score = _clamp(100.0 - slant_dev * SLANT_PENALTY_FACTOR)

        # 2. Spacing score: combination of word spacing and letter spacing consistency
        word_spacing_mean = self._extract_metric(
            aggregate, "word_spacing", "mean", default=WORD_GAP_TARGET_RATIO
        )
        letter_spacing_mean = self._extract_metric(
            aggregate, "letter_spacing", "mean", default=LETTER_GAP_TARGET_RATIO
        )
        word_gap_dev = abs(word_spacing_mean - WORD_GAP_TARGET_RATIO)
        letter_gap_dev = abs(letter_spacing_mean - LETTER_GAP_TARGET_RATIO)
        word_score = _clamp(100.0 - word_gap_dev * WORD_GAP_PENALTY_FACTOR)
        letter_score = _clamp(100.0 - letter_gap_dev * LETTER_GAP_PENALTY_FACTOR)
        spacing_score = _clamp(0.6 * word_score + 0.4 * letter_score)

        # 3. Baseline alignment score: penalty for vertical deviation from detected baseline
        baseline_dev_mean = self._extract_metric(
            aggregate, "baseline_deviation", "mean", default=0.0
        )
        baseline_score = _clamp(100.0 - abs(baseline_dev_mean) * BASELINE_DEV_PENALTY_FACTOR)

        # 4. Size consistency score: penalty for deviation from guideline height proportion (1.0)
        size_mean = self._extract_metric(aggregate, "size_consistency", "mean", default=1.0)
        size_dev = abs(size_mean - SIZE_RATIO_TARGET)
        size_score = _clamp(100.0 - size_dev * SIZE_DEV_PENALTY_FACTOR)

        # 5. Letter formation score: identity passthrough from CNN output (ML_PIPELINE §6.4–§6.5)
        raw_formation = self._extract_letter_formation(aggregate, ml_result)
        if raw_formation is not None:
            formation_score = _clamp(raw_formation)
        else:
            # Fallback if CNN result is unavailable
            formation_score = 65.0

        return CriterionScores(
            letter_formation_score=formation_score,
            size_consistency_score=size_score,
            spacing_score=spacing_score,
            slant_score=slant_score,
            baseline_alignment_score=baseline_score,
        )


def get_score_provider(engine: str | None = None) -> ScoreProvider:
    """Factory returning the active ScoreProvider based on SCORING_ENGINE config.

    ARCHITECTURE §10:
    - "manual" -> ManualScoreProvider (Phase 1 default)
    - "calibrated" -> CalibratedScoreProvider (Phase 2)
    """
    mode = (engine or settings.SCORING_ENGINE or "manual").strip().lower()
    if mode == "manual":
        return ManualScoreProvider()
    elif mode == "calibrated":
        return CalibratedScoreProvider()
    else:
        raise ValueError(
            f"Invalid SCORING_ENGINE: {mode!r}. Valid options are 'manual' or 'calibrated'."
        )
