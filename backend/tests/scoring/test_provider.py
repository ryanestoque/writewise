import pytest

from app.core.config import settings
from app.cv.models import AggregateMetrics, MetricSummary
from app.ml.models import LetterFormationResult, WordFormationScore
from app.scoring.provider import (
    LETTER_GAP_TARGET_RATIO,
    SIZE_RATIO_TARGET,
    SLANT_TARGET_DEG,
    WORD_GAP_TARGET_RATIO,
    CalibratedScoreProvider,
    CriterionScores,
    ManualScoreProvider,
    get_score_provider,
)


@pytest.fixture
def sample_aggregate() -> AggregateMetrics:
    return AggregateMetrics(
        slant=MetricSummary(mean=SLANT_TARGET_DEG, std=1.2),
        word_spacing=MetricSummary(mean=WORD_GAP_TARGET_RATIO, std=0.2),
        letter_spacing=MetricSummary(mean=LETTER_GAP_TARGET_RATIO, std=0.05),
        baseline_deviation=MetricSummary(mean=0.0, std=0.01),
        size_consistency=MetricSummary(mean=SIZE_RATIO_TARGET, std=0.05),
    )


@pytest.fixture
def sample_ml_result() -> LetterFormationResult:
    return LetterFormationResult(
        word_scores=[
            WordFormationScore(word_index=0, letter_formation_score=85.0),
            WordFormationScore(word_index=1, letter_formation_score=87.5),
        ],
        aggregate_mean=86.25,
        aggregate_std=1.25,
    )


class TestCriterionScores:
    def test_default_all_none(self):
        scores = CriterionScores()
        assert scores.letter_formation_score is None
        assert scores.size_consistency_score is None
        assert scores.spacing_score is None
        assert scores.slant_score is None
        assert scores.baseline_alignment_score is None
        assert scores.composite_score is None

        d = scores.to_dict()
        assert len(d) == 6
        assert all(v is None for v in d.values())

        db_d = scores.to_db_dict()
        assert len(db_d) == 5
        assert "composite_score" not in db_d
        assert all(v is None for v in db_d.values())

    def test_populated_composite_score(self):
        scores = CriterionScores(
            letter_formation_score=80.0,
            size_consistency_score=80.0,
            spacing_score=80.0,
            slant_score=80.0,
            baseline_alignment_score=80.0,
        )
        assert scores.composite_score == 80.0
        assert scores.to_dict()["composite_score"] == 80.0
        assert "composite_score" not in scores.to_db_dict()

    def test_partial_scores_composite_averages_present_criteria(self):
        scores = CriterionScores(
            letter_formation_score=80.0,
            size_consistency_score=90.0,
            spacing_score=None,
            slant_score=70.0,
            baseline_alignment_score=80.0,
        )
        assert scores.composite_score == 80.0

    def test_both_optional_criteria_none_averages_three_core_criteria(self):
        scores = CriterionScores(
            letter_formation_score=80.0,
            size_consistency_score=90.0,
            spacing_score=None,
            slant_score=None,
            baseline_alignment_score=70.0,
        )
        assert scores.composite_score == 80.0

    @pytest.mark.parametrize(
        "missing_core",
        ["letter_formation_score", "size_consistency_score", "baseline_alignment_score"],
    )
    def test_missing_core_criterion_yields_none_composite(self, missing_core):
        kwargs = {
            "letter_formation_score": 80.0,
            "size_consistency_score": 80.0,
            "spacing_score": 80.0,
            "slant_score": 80.0,
            "baseline_alignment_score": 80.0,
        }
        kwargs[missing_core] = None
        scores = CriterionScores(**kwargs)
        assert scores.composite_score is None


class TestManualScoreProvider:
    def test_returns_none_at_upload_time(self, sample_aggregate, sample_ml_result):
        provider = ManualScoreProvider()
        scores = provider.compute_scores(sample_aggregate, sample_ml_result)
        assert isinstance(scores, CriterionScores)
        assert scores.composite_score is None
        assert all(v is None for v in scores.to_dict().values())

    def test_compute_score_alias(self, sample_aggregate):
        provider = ManualScoreProvider()
        scores = provider.compute_score(sample_aggregate)
        assert isinstance(scores, CriterionScores)
        assert all(v is None for v in scores.to_dict().values())

    def test_accepts_dict_input(self):
        provider = ManualScoreProvider()
        scores = provider.compute_scores({"slant": {"mean": 10.0}})
        assert isinstance(scores, CriterionScores)
        assert all(v is None for v in scores.to_dict().values())


class TestCalibratedScoreProvider:
    @pytest.mark.parametrize(
        "aggregate",
        [
            {"slant": {"mean": None, "std": None}},
            {"slant_mean": None},
            AggregateMetrics(
                slant=MetricSummary(mean=None, std=None),
                word_spacing=MetricSummary(2, 0),
                letter_spacing=MetricSummary(0.4, 0),
                baseline_deviation=MetricSummary(0, 0),
                size_consistency=MetricSummary(1, 0),
            ),
        ],
    )
    def test_unmeasurable_slant_is_not_scored_as_upright_or_ideal(self, aggregate):
        scores = CalibratedScoreProvider().compute_scores(aggregate, 80)
        assert scores.slant_score is None
        assert scores.composite_score is not None

    @pytest.mark.parametrize(
        "aggregate",
        [
            {"word_spacing": {"mean": None, "std": None}, "slant": {"mean": SLANT_TARGET_DEG}},
            {"word_spacing_mean": None, "slant_mean": SLANT_TARGET_DEG},
            AggregateMetrics(
                slant=MetricSummary(mean=SLANT_TARGET_DEG, std=1.0),
                word_spacing=MetricSummary(mean=None, std=None),
                letter_spacing=MetricSummary(mean=0.25, std=0.05),
                baseline_deviation=MetricSummary(mean=0.0, std=0.01),
                size_consistency=MetricSummary(mean=SIZE_RATIO_TARGET, std=0.05),
            ),
        ],
    )
    def test_single_word_unmeasurable_spacing_is_none_and_composite_averages_four(
        self, aggregate
    ):
        scores = CalibratedScoreProvider().compute_scores(aggregate, ml_result=80.0)
        assert scores.spacing_score is None
        assert scores.composite_score is not None
        expected = round(
            (
                scores.letter_formation_score
                + scores.size_consistency_score
                + scores.slant_score
                + scores.baseline_alignment_score
            )
            / 4.0,
            2,
        )
        assert scores.composite_score == expected

    def test_multi_word_connected_cursive_without_letter_gaps_uses_word_score(self):
        aggregate = AggregateMetrics(
            slant=MetricSummary(mean=SLANT_TARGET_DEG, std=1.0),
            word_spacing=MetricSummary(mean=2.4, std=0.1),
            letter_spacing=MetricSummary(mean=None, std=None),
            baseline_deviation=MetricSummary(mean=0.0, std=0.01),
            size_consistency=MetricSummary(mean=SIZE_RATIO_TARGET, std=0.05),
        )
        scores = CalibratedScoreProvider().compute_scores(aggregate, ml_result=80.0)
        assert scores.spacing_score == 65.0

    def test_ideal_measurements_produce_high_scores(self, sample_aggregate, sample_ml_result):
        provider = CalibratedScoreProvider()
        scores = provider.compute_scores(sample_aggregate, sample_ml_result)

        assert scores.slant_score == 100.0
        assert scores.spacing_score == 100.0
        assert scores.baseline_alignment_score == 100.0
        assert scores.size_consistency_score == 100.0
        # Letter formation is identity passthrough from CNN output
        assert scores.letter_formation_score == 86.25
        assert scores.composite_score is not None
        assert 95.0 <= scores.composite_score <= 100.0

    def test_deviations_penalized(self):
        provider = CalibratedScoreProvider()
        poor_aggregate = AggregateMetrics(
            slant=MetricSummary(mean=35.0, std=5.0),  # Steep slant
            word_spacing=MetricSummary(mean=0.5, std=0.5),  # Tight spacing
            letter_spacing=MetricSummary(mean=1.2, std=0.2),
            baseline_deviation=MetricSummary(mean=0.20, std=0.05),  # High drift
            size_consistency=MetricSummary(mean=1.6, std=0.2),  # Inconsistent size
        )
        scores = provider.compute_scores(poor_aggregate, ml_result=40.0)

        assert scores.slant_score < 70.0
        assert scores.spacing_score < 70.0
        assert scores.baseline_alignment_score < 70.0
        assert scores.size_consistency_score < 70.0
        assert scores.letter_formation_score == 40.0
        assert scores.composite_score is not None
        assert scores.composite_score < 70.0

    def test_upright_consistent_cursive_does_not_collapse_to_zero(self):
        provider = CalibratedScoreProvider()
        upright_aggregate = AggregateMetrics(
            slant=MetricSummary(mean=0.5, std=0.7),
            word_spacing=MetricSummary(mean=WORD_GAP_TARGET_RATIO, std=0.1),
            letter_spacing=MetricSummary(mean=LETTER_GAP_TARGET_RATIO, std=0.02),
            baseline_deviation=MetricSummary(mean=0.0, std=0.01),
            size_consistency=MetricSummary(mean=SIZE_RATIO_TARGET, std=0.02),
        )
        scores = provider.compute_scores(upright_aggregate, ml_result=80.0)
        assert scores.slant_score is not None
        assert 50.0 <= scores.slant_score < 75.0

    def test_inconsistent_slant_std_penalized_even_at_target_mean(self):
        provider = CalibratedScoreProvider()
        consistent = AggregateMetrics(
            slant=MetricSummary(mean=SLANT_TARGET_DEG, std=2.0),
            word_spacing=MetricSummary(mean=WORD_GAP_TARGET_RATIO, std=0.1),
            letter_spacing=MetricSummary(mean=LETTER_GAP_TARGET_RATIO, std=0.02),
            baseline_deviation=MetricSummary(mean=0.0, std=0.01),
            size_consistency=MetricSummary(mean=SIZE_RATIO_TARGET, std=0.02),
        )
        erratic = AggregateMetrics(
            slant=MetricSummary(mean=SLANT_TARGET_DEG, std=10.0),
            word_spacing=MetricSummary(mean=WORD_GAP_TARGET_RATIO, std=0.1),
            letter_spacing=MetricSummary(mean=LETTER_GAP_TARGET_RATIO, std=0.02),
            baseline_deviation=MetricSummary(mean=0.0, std=0.01),
            size_consistency=MetricSummary(mean=SIZE_RATIO_TARGET, std=0.02),
        )
        consistent_scores = provider.compute_scores(consistent, ml_result=80.0)
        erratic_scores = provider.compute_scores(erratic, ml_result=80.0)
        assert consistent_scores.slant_score == 100.0
        assert erratic_scores.slant_score is not None
        assert erratic_scores.slant_score < 75.0

    def test_backward_and_chaotic_slant_scores_needs_improvement(self):
        provider = CalibratedScoreProvider()
        chaotic_backward = AggregateMetrics(
            slant=MetricSummary(mean=-10.0, std=10.0),
            word_spacing=MetricSummary(mean=WORD_GAP_TARGET_RATIO, std=0.1),
            letter_spacing=MetricSummary(mean=LETTER_GAP_TARGET_RATIO, std=0.02),
            baseline_deviation=MetricSummary(mean=0.0, std=0.01),
            size_consistency=MetricSummary(mean=SIZE_RATIO_TARGET, std=0.02),
        )
        scores = provider.compute_scores(chaotic_backward, ml_result=80.0)
        assert scores.slant_score is not None
        assert scores.slant_score < 25.0

    def test_letter_formation_identity_passthrough_and_clamping(self, sample_aggregate):
        provider = CalibratedScoreProvider()

        # Normal value passthrough
        res = provider.compute_scores(sample_aggregate, ml_result=72.4)
        assert res.letter_formation_score == 72.4

        # Clamping upper bound
        res_over = provider.compute_scores(sample_aggregate, ml_result=115.0)
        assert res_over.letter_formation_score == 100.0

        # Clamping lower bound
        res_under = provider.compute_scores(sample_aggregate, ml_result=-10.0)
        assert res_under.letter_formation_score == 0.0

    def test_accepts_dictionary_input(self):
        provider = CalibratedScoreProvider()
        raw_dict = {
            "slant": {"mean": SLANT_TARGET_DEG, "std": 1.0},
            "word_spacing": {"mean": WORD_GAP_TARGET_RATIO, "std": 0.1},
            "letter_spacing": {"mean": LETTER_GAP_TARGET_RATIO, "std": 0.05},
            "baseline_deviation": {"mean": 0.0, "std": 0.01},
            "size_consistency": {"mean": SIZE_RATIO_TARGET, "std": 0.02},
            "letter_formation": {"mean": 80.0, "std": 2.0},
        }
        scores = provider.compute_scores(raw_dict)
        assert scores.slant_score == 100.0
        assert scores.letter_formation_score == 80.0
        assert scores.composite_score is not None

    def test_accepts_flat_dictionary_input(self):
        provider = CalibratedScoreProvider()
        flat_dict = {
            "slant_mean": SLANT_TARGET_DEG,
            "word_spacing_mean": WORD_GAP_TARGET_RATIO,
            "letter_spacing_mean": LETTER_GAP_TARGET_RATIO,
            "baseline_deviation_mean": 0.0,
            "size_consistency_mean": SIZE_RATIO_TARGET,
            "letter_formation_mean": 75.0,
        }
        scores = provider.compute_scores(flat_dict)
        assert scores.slant_score == 100.0
        assert scores.letter_formation_score == 75.0


class TestGetScoreProvider:
    def test_explicit_manual(self):
        provider = get_score_provider("manual")
        assert isinstance(provider, ManualScoreProvider)

    def test_explicit_calibrated(self):
        provider = get_score_provider("calibrated")
        assert isinstance(provider, CalibratedScoreProvider)

    def test_case_insensitive(self):
        assert isinstance(get_score_provider("MANUAL"), ManualScoreProvider)
        assert isinstance(get_score_provider("Calibrated"), CalibratedScoreProvider)

    def test_invalid_engine_raises(self):
        with pytest.raises(ValueError, match="Invalid SCORING_ENGINE"):
            get_score_provider("unknown_engine")

    def test_defaults_to_settings(self, monkeypatch):
        monkeypatch.setattr(settings, "SCORING_ENGINE", "manual")
        assert isinstance(get_score_provider(), ManualScoreProvider)

        monkeypatch.setattr(settings, "SCORING_ENGINE", "calibrated")
        assert isinstance(get_score_provider(), CalibratedScoreProvider)
