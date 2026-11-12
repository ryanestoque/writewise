"""Recorded-score conversion keeps rubric calibration separate from coursework points."""

from decimal import Decimal

import pytest

from app.scoring.provider import get_score_provider

CRITERIA = (
    "letter_formation",
    "size_consistency",
    "spacing",
    "slant",
    "baseline_alignment",
)


def scores(value):
    return {f"{name}_score": value for name in CRITERIA}


@pytest.mark.parametrize("engine", ["manual", "calibrated"])
def test_manual_midpoints_are_not_normalized(engine):
    provider = get_score_provider(engine)
    score = provider.recorded_grade_score(None, scores("87.5"))
    assert score.source == "manual"
    assert score.composite == Decimal("87.5")
    assert provider.activity_points(Decimal("20"), score) == Decimal("17.50")


@pytest.mark.parametrize("engine", ["manual", "calibrated"])
def test_calibrated_source_retains_its_actual_value_under_either_configuration(engine):
    provider = get_score_provider(engine)
    score = provider.recorded_grade_score(scores("82"), scores("87.5"))
    assert score.source == "calibrated"
    assert provider.activity_points(Decimal("20"), score) == Decimal("16.40")


def test_generated_composite_is_used_after_all_criteria_are_present():
    provider = get_score_provider("calibrated")
    measured = scores("82.00") | {"composite_score": "82.01"}
    score = provider.recorded_grade_score(measured, None)
    assert score.composite == Decimal("82.01")
    assert provider.activity_points(Decimal("100"), score) == Decimal("82.01")


def test_incomplete_measurement_uses_complete_recorded_manual_rubric():
    score = get_score_provider("calibrated").recorded_grade_score(
        {"letter_formation_score": "82"}, scores("62.5")
    )
    assert score.source == "manual"
    assert score.composite == Decimal("62.5")


@pytest.mark.parametrize("invalid", [None, "NaN", "Infinity", "-1", "100.01", "bad", True])
def test_incomplete_or_invalid_criteria_do_not_produce_a_grade(invalid):
    measured = scores("82") | {"spacing_score": invalid}
    provider = get_score_provider("calibrated")
    assert provider.recorded_grade_score(measured, None) is None
    assert provider.recorded_grade_score(None, measured) is None


@pytest.mark.parametrize("invalid", ["NaN", "Infinity", "-1", "100.01", "bad", True])
def test_invalid_stored_composite_does_not_publish_an_invented_value(invalid):
    measured = scores("82") | {"composite_score": invalid}
    assert get_score_provider("calibrated").recorded_grade_score(measured, None) is None


def test_manual_composite_keeps_precision_until_the_cell_is_rounded():
    provider = get_score_provider("manual")
    manual = scores("12.5") | {"letter_formation_score": "37.5"}
    score = provider.recorded_grade_score(None, manual)
    assert score.composite == Decimal("17.5")
    assert provider.activity_points(Decimal("3.33"), score) == Decimal("0.58")


@pytest.mark.parametrize(
    "possible,composite,expected",
    [("20", "82", "16.40"), ("0.05", "10", "0.01"), ("10", "0", "0.00")],
)
def test_point_rounding_is_decimal_half_up(possible, composite, expected):
    from app.scoring.gradebook import derive_points

    assert derive_points(Decimal(possible), Decimal(composite)) == Decimal(expected)


@pytest.mark.parametrize("possible", ["0", "-1", "10000", "NaN", "Infinity", "1.001"])
def test_point_conversion_rejects_invalid_maximum(possible):
    from app.scoring.gradebook import derive_points

    with pytest.raises(ValueError):
        derive_points(Decimal(possible), Decimal("82"))


@pytest.mark.parametrize("composite", ["-1", "100.01", "NaN", "Infinity"])
def test_point_conversion_rejects_invalid_source_percentage(composite):
    from app.scoring.gradebook import derive_points

    with pytest.raises(ValueError):
        derive_points(Decimal("20"), Decimal(composite))


def test_overall_weights_by_points_possible_including_an_explicit_zero():
    from app.scoring.gradebook import overall_percentage

    assert overall_percentage(
        [(Decimal("16.40"), Decimal("20")), (Decimal("0"), Decimal("10"))]
    ) == Decimal("54.67")


def test_no_included_denominator_is_unavailable_instead_of_zero():
    from app.scoring.gradebook import overall_percentage

    assert overall_percentage([]) is None
    assert overall_percentage([(Decimal("0"), Decimal("0"))]) is None


def test_resolving_recorded_scores_does_not_mutate_them():
    manual = scores("87.5")
    original = dict(manual)
    get_score_provider("manual").recorded_grade_score(None, manual)
    assert manual == original
