"""Exact coursework points from recorded scores; never recalculates handwriting quality."""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Literal

CRITERIA = (
    "letter_formation",
    "size_consistency",
    "spacing",
    "slant",
    "baseline_alignment",
)
CENT = Decimal("0.01")
MAX_POINTS = Decimal("9999.99")


@dataclass(frozen=True)
class RecordedGradeScore:
    composite: Decimal
    source: Literal["manual", "calibrated"]


def _score_decimal(value: object) -> Decimal:
    if isinstance(value, bool):
        raise ValueError("A score must be numeric")
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("A score must be numeric") from exc
    if not result.is_finite() or not 0 <= result <= 100:
        raise ValueError("A score must be finite and between zero and 100")
    return result


def resolve_recorded_score(
    measurement: Mapping[str, object] | None,
    manual_score: Mapping[str, object] | None,
) -> RecordedGradeScore | None:
    """Prefer complete recorded measurements, then a complete retained manual rubric.

    The recorded source, not the currently configured inference engine, determines
    historical scores. Missing criteria cannot be averaged into a complete grade.
    """
    candidates: tuple[
        tuple[Literal["manual", "calibrated"], Mapping[str, object] | None], ...
    ] = (("calibrated", measurement), ("manual", manual_score))
    for source, record in candidates:
        if not record:
            continue
        try:
            values = [_score_decimal(record[f"{name}_score"]) for name in CRITERIA]
            composite = sum(values, Decimal(0)) / Decimal(5)
            if source == "calibrated" and record.get("composite_score") is not None:
                composite = _score_decimal(record["composite_score"])
        except (KeyError, ValueError):
            continue
        return RecordedGradeScore(composite=composite, source=source)
    return None


def derive_points(possible: Decimal, composite: Decimal) -> Decimal:
    """Round the cell once, so the UI, totals and CSV sum the same values."""
    if (
        not possible.is_finite()
        or not 0 < possible <= MAX_POINTS
        or possible != possible.quantize(CENT)
        or not composite.is_finite()
        or not 0 <= composite <= 100
    ):
        raise ValueError("Invalid recorded points input")
    return (possible * composite / Decimal(100)).quantize(CENT, rounding=ROUND_HALF_UP)


def overall_percentage(values: Iterable[tuple[Decimal, Decimal]]) -> Decimal | None:
    """Aggregate already included, cell-rounded points; an empty denominator is unknown."""
    rows = list(values)
    earned = sum((earned for earned, _ in rows), Decimal(0))
    possible = sum((maximum for _, maximum in rows), Decimal(0))
    if not possible:
        return None
    return (earned * Decimal(100) / possible).quantize(CENT, rounding=ROUND_HALF_UP)
