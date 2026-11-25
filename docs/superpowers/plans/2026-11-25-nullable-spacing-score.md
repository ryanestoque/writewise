# Nullable Spacing Score & Dynamic Composite Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat Spacing as `N/A` (`null`) whenever a worksheet has no inter-word gaps (both calibrated and manual scoring) and compute `composite_score` as the unweighted mean of all non-null criteria across Postgres, backend scoring/gradebook, and frontend UI.

**Architecture:** Fix `calc_stats([])` in CV feature extraction to return `(None, None)` instead of `(0.0, 0.0)`, propagate `spacing_score = None` through `CalibratedScoreProvider` and dynamic non-null averaging through `CriterionScores.composite_score`, `gradebook.resolve_recorded_score`, and Postgres's `measurement.composite_score` generated column. Allow `manual_score.spacing_band` to be `NULL`, surface `not_applicable_reason` on `SpacingOverlay`, and update the frontend submission detail and manual rubric form to display and submit `N/A`.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, pytest, PostgreSQL / Supabase migrations, Next.js (App Router), React, TypeScript (strict), Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-25-nullable-spacing-score-design.md`

## Global Constraints

- Follow `AGENTS.md` §6 Hard Rules (SQL-first migrations only; regenerate TypeScript types in the same PR; scoring logic goes through `ScoreProvider`; never bypass RLS from frontend).
- Backend lint: `uv run ruff check .` (from `backend/`).
- Frontend lint & typecheck: `npx eslint .` and `npx tsc --noEmit` (from `frontend/`).
- Because this touches `app/api/`, `app/scoring/`, and a migration, run the full ephemeral Supabase test stack (`supabase start` → `supabase db reset` → `uv run pytest` → `supabase stop`) before completion.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`).

---

### Task 1: Return `None` for Empty Gap Lists in CV Spacing Extraction

**Files:**
- Modify: `backend/app/cv/features/spacing.py:14-24`
- Test: `backend/tests/cv/test_spacing.py`

**Interfaces:**
- Consumes: `MetricSummary(mean: float | None, std: float | None)` from `app.cv.models`
- Produces: `calc_stats([]) -> MetricSummary(mean=None, std=None)` and `compute_spacing_metrics(lines) -> tuple[MetricSummary, MetricSummary]` where empty `all_word_gaps` yields `MetricSummary(mean=None, std=None)`.

- [ ] **Step 1: Update and add failing tests in `backend/tests/cv/test_spacing.py`**

Replace `test_spacing_metrics_empty_or_single` in `backend/tests/cv/test_spacing.py` with:

```python
def test_spacing_metrics_empty_or_single():
    # Empty lines -> None summaries (never 0.0)
    w_empty, l_empty = compute_spacing_metrics([])
    assert w_empty.mean is None and w_empty.std is None
    assert l_empty.mean is None and l_empty.std is None

    # Single-word line (no word gaps, but has intra-word gaps)
    line_one_word = LineSegment(
        line_index=0,
        row_band=(0, 100),
        topline_y=20,
        midline_y=50,
        baseline_y=80,
        words=[],
        word_gaps=[],
        raw_word_gaps=[],
        intra_word_gaps=[0.25, 0.35],
    )
    w_one, l_one = compute_spacing_metrics([line_one_word])
    assert w_one.mean is None and w_one.std is None
    assert l_one.mean == 0.3 and l_one.std is not None

    # Single gap
    line_single = LineSegment(
        line_index=0,
        row_band=(0, 100),
        topline_y=20,
        midline_y=50,
        baseline_y=80,
        words=[],
        word_gaps=[1.5],
        raw_word_gaps=[15],
        intra_word_gaps=[0.3],
    )
    w_single, l_single = compute_spacing_metrics([line_single])
    assert w_single.mean == 1.5 and w_single.std == 0.0
    assert l_single.mean == 0.3 and l_single.std == 0.0
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `uv run pytest tests/cv/test_spacing.py -v`
Expected: FAIL on `assert w_empty.mean is None` (`0.0 is None`).

- [ ] **Step 3: Update `calc_stats` in `backend/app/cv/features/spacing.py`**

Change lines 14–18 of `backend/app/cv/features/spacing.py`:

```python
def calc_stats(values: List[float]) -> MetricSummary:
    """Calculate mean and sample standard deviation for a list of values."""
    if not values:
        return MetricSummary(mean=None, std=None)
    if len(values) == 1:
        return MetricSummary(mean=round(float(values[0]), 2), std=0.0)
```

- [ ] **Step 4: Run CV test suite to verify no callers break**

Run (from `backend/`): `uv run pytest tests/cv/ -v`
Expected: PASS across all CV tests.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/cv/features/spacing.py backend/tests/cv/test_spacing.py
git commit -m "fix(cv): return None metric summary when spacing gap list is empty"
```

---

### Task 2: Nullable `spacing_score` and Dynamic `composite_score` in `ScoreProvider`

**Files:**
- Modify: `backend/app/scoring/provider.py:67-83,228-240`
- Test: `backend/tests/scoring/test_provider.py`

**Interfaces:**
- Consumes: `AggregateMetrics` with `word_spacing: MetricSummary(mean=None, std=None)` and `letter_spacing: MetricSummary(mean=float | None, std=float | None)`.
- Produces:
  - `CriterionScores.composite_score -> float | None`: unweighted mean of non-null criterion scores, or `None` when all 5 are `None`.
  - `CalibratedScoreProvider.compute_scores(...) -> CriterionScores`: sets `spacing_score = None` when `word_spacing.mean` is `None`/non-finite; uses `word_score` at 100% when `word_spacing.mean` is finite and `letter_spacing.mean` is `None`/non-finite.

- [ ] **Step 1: Update and add failing tests in `backend/tests/scoring/test_provider.py`**

1. Replace `test_partial_scores_composite_is_none` (lines 72–80) with:

```python
    def test_partial_scores_composite_averages_present_criteria(self):
        scores = CriterionScores(
            letter_formation_score=80.0,
            size_consistency_score=90.0,
            spacing_score=None,
            slant_score=70.0,
            baseline_alignment_score=80.0,
        )
        assert scores.composite_score == 80.0
```

2. Update `test_unmeasurable_slant_is_not_scored_as_upright_or_ideal` (lines 119–122) to assert `scores.slant_score is None` and `scores.composite_score is not None`:

```python
    def test_unmeasurable_slant_is_not_scored_as_upright_or_ideal(self, aggregate):
        scores = CalibratedScoreProvider().compute_scores(aggregate, 80)
        assert scores.slant_score is None
        assert scores.composite_score is not None
```

3. Add tests for single-word spacing (`word_spacing.mean is None`) and fully-connected multi-word cursive (`letter_spacing.mean is None`) inside `TestCalibratedScoreProvider`:

```python
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
            word_spacing=MetricSummary(mean=WORD_GAP_TARGET_RATIO, std=0.1),
            letter_spacing=MetricSummary(mean=None, std=None),
            baseline_deviation=MetricSummary(mean=0.0, std=0.01),
            size_consistency=MetricSummary(mean=SIZE_RATIO_TARGET, std=0.05),
        )
        scores = CalibratedScoreProvider().compute_scores(aggregate, ml_result=80.0)
        assert scores.spacing_score == 100.0
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `uv run pytest tests/scoring/test_provider.py -v`
Expected: FAIL on partial composite and single-word spacing tests.

- [ ] **Step 3: Implement changes in `backend/app/scoring/provider.py`**

1. Update `CriterionScores.composite_score` (lines 67–83):

```python
    @property
    def composite_score(self) -> float | None:
        """Unweighted arithmetic mean of all non-null criteria, or None if all are None.

        Mirrors the Postgres stored generated column on public.measurement (DATABASE §8).
        """
        present = [
            s
            for s in (
                self.letter_formation_score,
                self.size_consistency_score,
                self.spacing_score,
                self.slant_score,
                self.baseline_alignment_score,
            )
            if s is not None
        ]
        if not present:
            return None
        return round(sum(present) / len(present), 2)
```

2. Update spacing calculation in `CalibratedScoreProvider.compute_scores` (lines 228–240):

```python
        # 2. Spacing score: requires inter-word gaps; single-word samples are N/A (None)
        word_spacing_mean = self._extract_metric(
            aggregate, "word_spacing", "mean", default=math.nan
        )
        letter_spacing_mean = self._extract_metric(
            aggregate, "letter_spacing", "mean", default=math.nan
        )
        if not math.isfinite(word_spacing_mean):
            spacing_score = None
        else:
            word_gap_dev = abs(word_spacing_mean - WORD_GAP_TARGET_RATIO)
            word_score = _clamp(100.0 - word_gap_dev * WORD_GAP_PENALTY_FACTOR)
            if math.isfinite(letter_spacing_mean):
                letter_gap_dev = abs(letter_spacing_mean - LETTER_GAP_TARGET_RATIO)
                letter_score = _clamp(100.0 - letter_gap_dev * LETTER_GAP_PENALTY_FACTOR)
                spacing_score = _clamp(0.6 * word_score + 0.4 * letter_score)
            else:
                spacing_score = word_score
```

- [ ] **Step 4: Run scoring tests**

Run (from `backend/`): `uv run pytest tests/scoring/test_provider.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/scoring/provider.py backend/tests/scoring/test_provider.py
git commit -m "feat(scoring): return None spacing_score for single-word samples and average non-null composite"
```

---

### Task 3: Allow Nullable Spacing (and Calibrated Slant) in Gradebook Resolution

**Files:**
- Modify: `backend/app/scoring/gradebook.py:8-60`
- Test: `backend/tests/unit/test_gradebook_scoring.py`

**Interfaces:**
- Consumes: `measurement` and `manual_score` mappings where `spacing_score` (and `slant_score` on `measurement`) may be `None`.
- Produces: `resolve_recorded_score(measurement, manual_score) -> RecordedGradeScore | None` computing exact `Decimal` composite over present criteria while requiring core criteria (`letter_formation`, `size_consistency`, `baseline_alignment`, plus `slant` for manual).

- [ ] **Step 1: Update and add failing tests in `backend/tests/unit/test_gradebook_scoring.py`**

Replace `test_incomplete_or_invalid_criteria_do_not_produce_a_grade` (lines 55–61) with:

```python
@pytest.mark.parametrize("invalid", ["NaN", "Infinity", "-1", "100.01", "bad", True])
def test_invalid_criteria_values_do_not_produce_a_grade(invalid):
    measured = scores("82") | {"spacing_score": invalid}
    provider = get_score_provider("calibrated")
    assert provider.recorded_grade_score(measured, None) is None
    assert provider.recorded_grade_score(None, measured) is None


@pytest.mark.parametrize(
    "missing_key",
    ["letter_formation_score", "size_consistency_score", "baseline_alignment_score"],
)
def test_missing_core_criterion_does_not_produce_a_grade(missing_key):
    measured = scores("82") | {missing_key: None}
    provider = get_score_provider("calibrated")
    assert provider.recorded_grade_score(measured, None) is None
    assert provider.recorded_grade_score(None, measured) is None


def test_nullable_spacing_produces_four_criterion_composite_and_points():
    provider = get_score_provider("calibrated")
    measured = {
        "letter_formation_score": "80",
        "size_consistency_score": "90",
        "spacing_score": None,
        "slant_score": "70",
        "baseline_alignment_score": "80",
    }
    cal = provider.recorded_grade_score(measured, None)
    assert cal is not None
    assert cal.source == "calibrated"
    assert cal.composite == Decimal("80")
    assert provider.activity_points(Decimal("20"), cal) == Decimal("16.00")

    manual = {
        "letter_formation_score": "87.5",
        "size_consistency_score": "62.5",
        "spacing_score": None,
        "slant_score": "62.5",
        "baseline_alignment_score": "87.5",
    }
    man = provider.recorded_grade_score(None, manual)
    assert man is not None
    assert man.source == "manual"
    assert man.composite == Decimal("75")
    assert provider.activity_points(Decimal("20"), man) == Decimal("15.00")


def test_nullable_calibrated_slant_produces_four_criterion_composite():
    provider = get_score_provider("calibrated")
    measured = scores("80") | {"slant_score": None}
    cal = provider.recorded_grade_score(measured, None)
    assert cal is not None
    assert cal.source == "calibrated"
    assert cal.composite == Decimal("80")
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `uv run pytest tests/unit/test_gradebook_scoring.py -v`
Expected: FAIL on `test_nullable_spacing_produces_four_criterion_composite_and_points` and `test_nullable_calibrated_slant_produces_four_criterion_composite`.

- [ ] **Step 3: Update `backend/app/scoring/gradebook.py`**

Update `CRITERIA` / optional criteria handling in `backend/app/scoring/gradebook.py` (lines 8–60):

```python
CRITERIA = (
    "letter_formation",
    "size_consistency",
    "spacing",
    "slant",
    "baseline_alignment",
)
OPTIONAL_CRITERIA: dict[Literal["manual", "calibrated"], frozenset[str]] = {
    "calibrated": frozenset({"spacing", "slant"}),
    "manual": frozenset({"spacing"}),
}
```

And update `resolve_recorded_score`:

```python
def resolve_recorded_score(
    measurement: Mapping[str, object] | None,
    manual_score: Mapping[str, object] | None,
) -> RecordedGradeScore | None:
    """Prefer complete recorded measurements, then a complete retained manual rubric.

    The recorded source, not the currently configured inference engine, determines
    historical scores. Optional criteria (spacing, and slant on calibrated rows) may
    be None (N/A) and are excluded from the denominator; core criteria remain required.
    """
    candidates: tuple[
        tuple[Literal["manual", "calibrated"], Mapping[str, object] | None], ...
    ] = (("calibrated", measurement), ("manual", manual_score))
    for source, record in candidates:
        if not record:
            continue
        optional = OPTIONAL_CRITERIA[source]
        try:
            values: list[Decimal] = []
            for name in CRITERIA:
                key = f"{name}_score"
                raw = record.get(key)
                if raw is None:
                    if name in optional:
                        continue
                    raise ValueError(f"Missing required criterion: {key}")
                values.append(_score_decimal(raw))
            if not values:
                continue
            composite = sum(values, Decimal(0)) / Decimal(len(values))
            if source == "calibrated" and record.get("composite_score") is not None:
                composite = _score_decimal(record["composite_score"])
        except (KeyError, ValueError):
            continue
        return RecordedGradeScore(composite=composite, source=source)
    return None
```

- [ ] **Step 4: Run gradebook unit tests**

Run (from `backend/`): `uv run pytest tests/unit/test_gradebook_scoring.py tests/unit/test_gradebook_service.py tests/unit/test_gradebook_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/scoring/gradebook.py backend/tests/unit/test_gradebook_scoring.py
git commit -m "feat(gradebook): support nullable spacing and calibrated slant in recorded score resolution"
```

---

### Task 4: Add `not_applicable_reason` to `SpacingOverlay` in Diagnostic Engine

**Files:**
- Modify: `backend/app/diagnostic/models.py:40-42`
- Modify: `backend/app/diagnostic/engine.py:40-55,190-248`
- Test: `backend/tests/diagnostic/test_engine.py`

**Interfaces:**
- Produces: `SpacingOverlay(annotations: list[SpacingAnnotation], not_applicable_reason: str | None = None)` serialized under `overlay["spacing"]["not_applicable_reason"]`.

- [ ] **Step 1: Add failing test to `backend/tests/diagnostic/test_engine.py`**

Append to `backend/tests/diagnostic/test_engine.py`:

```python
def test_single_word_sets_spacing_not_applicable_reason():
    raw_output = {
        "guide_lines": {"baseline_y": [420], "midline_y": [360], "topline_y": [300]},
        "lines": [
            {
                "line_index": 0,
                "words": [
                    {
                        "word_index": 0,
                        "bbox": [50, 360, 120, 60],
                        "slant_deg": 12.0,
                        "baseline_deviation_ratio": 0.02,
                        "size_ratio": 1.0,
                        "letter_formation_score": 85.0,
                    }
                ],
                "word_gaps": [],
                "intra_word_gaps": [0.2],
            }
        ],
    }

    overlay = generate_diagnostic_overlay(raw_output)
    assert overlay["spacing"]["annotations"] == []
    assert overlay["spacing"]["not_applicable_reason"] is not None
    assert "Single-word" in overlay["spacing"]["not_applicable_reason"]


def test_multi_word_has_no_spacing_not_applicable_reason():
    overlay = generate_diagnostic_overlay(make_sample_raw_output())
    assert overlay["spacing"]["not_applicable_reason"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `uv run pytest tests/diagnostic/test_engine.py -v`
Expected: FAIL with `KeyError: 'not_applicable_reason'`.

- [ ] **Step 3: Update `backend/app/diagnostic/models.py` and `backend/app/diagnostic/engine.py`**

In `backend/app/diagnostic/models.py`:

```python
class SpacingOverlay(BaseModel):
    annotations: list[SpacingAnnotation] = Field(default_factory=list)
    not_applicable_reason: str | None = None
```

In `backend/app/diagnostic/engine.py`:
- Track `total_words = 0` and increment `total_words += len(words)` inside the `for line in lines:` loop.
- When constructing `SpacingOverlay`:

```python
        spacing_not_applicable_reason = (
            "Single-word sample — no word spacing to evaluate"
            if total_words > 0 and len(spacing_annotations) == 0
            else None
        )
```

and pass `spacing=SpacingOverlay(annotations=spacing_annotations, not_applicable_reason=spacing_not_applicable_reason)`.
- In the fallback `except` dict, set `"spacing": {"annotations": [], "not_applicable_reason": None}`.

- [ ] **Step 4: Run diagnostic tests**

Run (from `backend/`): `uv run pytest tests/diagnostic/ -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/diagnostic/models.py backend/app/diagnostic/engine.py backend/tests/diagnostic/test_engine.py
git commit -m "feat(diagnostic): include not_applicable_reason on SpacingOverlay for single-word samples"
```

---

### Task 5: Database Migration, Manual-Score API, Docs, and Type Regeneration

**Files:**
- Create: `supabase/migrations/20261125000000_nullable_spacing_score.sql`
- Modify: `backend/app/api/submissions.py:41-47,714-723`
- Modify: `DATABASE.md` and `API_SPEC.md` (document nullable `spacing_band` / `spacing_score` and dynamic `composite_score`)
- Regenerate: `frontend/types/database.ts`
- Test: `backend/tests/rls/test_submission_lifecycle.py` (or `backend/tests/api/test_submissions.py`)

**Interfaces:**
- Produces:
  - Postgres `public.measurement.composite_score` generated column averaging non-null criteria (`NULL` if all 5 are `NULL`).
  - Postgres `public.manual_score.spacing_band` nullable (`spacing_score` auto-evaluates to `NULL` when `spacing_band IS NULL`).
  - `PATCH /api/submissions/{submission_id}/manual-score` accepts `spacing_band: ScoreBandEnum | null = None`.

- [ ] **Step 1: Create `supabase/migrations/20261125000000_nullable_spacing_score.sql`**

```sql
-- Allow nullable spacing_band on manual_score (single-word worksheets) and
-- compute measurement.composite_score as the mean of non-null criteria.

alter table public.manual_score
  alter column spacing_band drop not null;

-- Drop dependent SQL functions that reference measurement.composite_score if needed,
-- alter the generated column, and recreate them identically in the same transaction.
drop function if exists writewise_internal.gradebook_cell_fact(uuid, uuid);
drop function if exists writewise_internal.grade_source_signature(uuid, uuid);

alter table public.measurement
  drop column composite_score;

alter table public.measurement
  add column composite_score numeric(5,2) generated always as (
    case
      when (
        (case when letter_formation_score is not null then 1 else 0 end)
        + (case when size_consistency_score is not null then 1 else 0 end)
        + (case when spacing_score is not null then 1 else 0 end)
        + (case when slant_score is not null then 1 else 0 end)
        + (case when baseline_alignment_score is not null then 1 else 0 end)
      ) = 0 then null
      else round(
        (
          coalesce(letter_formation_score, 0)
          + coalesce(size_consistency_score, 0)
          + coalesce(spacing_score, 0)
          + coalesce(slant_score, 0)
          + coalesce(baseline_alignment_score, 0)
        ) / (
          (case when letter_formation_score is not null then 1 else 0 end)
          + (case when size_consistency_score is not null then 1 else 0 end)
          + (case when spacing_score is not null then 1 else 0 end)
          + (case when slant_score is not null then 1 else 0 end)
          + (case when baseline_alignment_score is not null then 1 else 0 end)
        ),
        2
      )
    end
  ) stored;
```

*(Note: In the migration, copy the exact `create function writewise_internal.grade_source_signature` and `create function writewise_internal.gradebook_cell_fact` + `revoke`/`grant` statements from `supabase/migrations/20261108045526_phase3_gradebook_store.sql` immediately after re-adding `composite_score`, and verify `supabase db reset` runs cleanly with zero dependency errors.)*

- [ ] **Step 2: Update `backend/app/api/submissions.py`**

1. Update `ManualScoreRequest` (lines 41–46):

```python
class ManualScoreRequest(BaseModel):
    letter_formation_band: ScoreBandEnum
    size_consistency_band: ScoreBandEnum
    spacing_band: ScoreBandEnum | None = None
    slant_band: ScoreBandEnum
    baseline_alignment_band: ScoreBandEnum
```

2. Update `score_payload` (lines 715–722):

```python
    score_payload = {
        "letter_formation_band": body.letter_formation_band.value,
        "size_consistency_band": body.size_consistency_band.value,
        "spacing_band": body.spacing_band.value if body.spacing_band is not None else None,
        "slant_band": body.slant_band.value,
        "baseline_alignment_band": body.baseline_alignment_band.value,
        "graded_by": teacher_id,
    }
```

- [ ] **Step 3: Add integration test for nullable `spacing_band` and dynamic `measurement.composite_score`**

Add a test in `backend/tests/rls/test_gradebook_lifecycle.py` (or `backend/tests/api/test_submissions.py`) that:
1. Inserts a `measurement` row with `letter_formation_score=80, size_consistency_score=90, spacing_score=None, slant_score=70, baseline_alignment_score=80` and verifies Postgres computes `composite_score == 80.00`.
2. Calls `PATCH /api/submissions/{id}/manual-score` with `spacing_band: None` and verifies `200 OK`, `manual_score.spacing_band is None`, `manual_score.spacing_score is None`, and gradebook points match the 4-criterion average.

- [ ] **Step 4: Run ephemeral Supabase stack, regenerate types, and run full backend tests**

```powershell
supabase start
supabase db reset
supabase gen types typescript --local > frontend/types/database.ts
cd backend
uv run ruff check .
uv run pytest
cd ..
supabase stop
```
Expected: Migration applies cleanly, `ruff` passes, full `pytest` suite passes.

- [ ] **Step 5: Update `DATABASE.md` and `API_SPEC.md` and commit**

Update the `measurement` and `manual_score` tables in `DATABASE.md` and `PATCH /api/submissions/{id}/manual-score` in `API_SPEC.md` to document nullable `spacing_band`/`spacing_score` and dynamic `composite_score`.

```powershell
git add supabase/migrations/20261125000000_nullable_spacing_score.sql backend/app/api/submissions.py backend/tests/ frontend/types/database.ts DATABASE.md API_SPEC.md
git commit -m "feat(db,api): allow nullable spacing_band and dynamic measurement composite_score"
```

---

### Task 6: Frontend Submission Detail & Diagnostic Overlay `N/A` Display

**Files:**
- Modify: `frontend/lib/hooks/use-submissions.ts` (allow `spacing_band: ScoreBand | null` in `ManualScoreInput` and `Submission["manual_score"]`)
- Modify: `frontend/components/submissions/submission-detail-content.tsx`

**Interfaces:**
- Consumes: `measurement.spacing_score: number | null`, `manual_score.spacing_band: ScoreBand | null`, `overlay.spacing.not_applicable_reason?: string | null`.
- Produces: Distinct `"N/A"` display on the Spacing criterion card when the submission is scored (`hasCalibratedScores || Boolean(submission.manual_score)`) and `spacing_score === null`, plus an informational empty-state message on the Spacing diagnostic tab.

- [ ] **Step 1: Update `frontend/lib/hooks/use-submissions.ts`**

Change `spacing_band` in `ManualScoreInput` and `Submission["manual_score"]` from `ScoreBand` to `ScoreBand | null`.

- [ ] **Step 2: Update `frontend/components/submissions/submission-detail-content.tsx`**

1. Update `onSaveAndRelease` / manual score prop types to accept `spacing_band: ScoreBand | null`.
2. When rendering each criterion card in `criteria`: if the submission is scored (`hasCalibratedScores` or `manual_score` exists) and `criterion.name === "Spacing"` and `criterion.score == null`, render an **`N/A`** badge/value (muted styling, e.g. `bg-muted/60 text-muted-foreground border-border`) instead of `"Pending"` or `—`.
3. On the Spacing diagnostic tab, when `overlay?.spacing?.annotations.length === 0` and `(overlay?.spacing?.not_applicable_reason || measurement?.word_spacing_mean == null)`, render the `not_applicable_reason` (fallback: `"Single-word sample — no word spacing to evaluate"`).

- [ ] **Step 3: Run frontend typecheck and lint**

Run (from `frontend/`): `npx tsc --noEmit; npx eslint .`
Expected: PASS with zero errors.

- [ ] **Step 4: Commit**

```powershell
git add frontend/lib/hooks/use-submissions.ts frontend/components/submissions/submission-detail-content.tsx
git commit -m "feat(ui): display N/A for unmeasurable spacing on scored submissions"
```

---

### Task 7: Frontend Manual Rubric Form `N/A` Option for Spacing & Final Verification

**Files:**
- Modify: `frontend/components/submissions/manual-rubric-entry-form.tsx`

**Interfaces:**
- Consumes: `ManualScoreInput` with `spacing_band: ScoreBand | null`, `measurement?.word_spacing_mean`.
- Produces: Explicit `"not_applicable"` (`N/A`) selection state for Spacing in both Stepper and List layouts, submitting `spacing_band: null` when selected.

- [ ] **Step 1: Update local state and validation in `manual-rubric-entry-form.tsx`**

1. Define `type SpacingSelection = ScoreBand | "not_applicable" | null;`.
2. Initialize `spacing_band` in `rubricScores` state:
   - If `initialScores` is provided: `initialScores.spacing_band ?? "not_applicable"`.
   - Else if `measurement && measurement.word_spacing_mean == null`: `"not_applicable"` (auto-suggest N/A for single-word samples).
   - Else: `null`.
3. Update `allBandsSelected` so Spacing is satisfied when `rubricScores.spacing_band !== null` (either a `ScoreBand` or `"not_applicable"`).
4. Map `"not_applicable"` → `null` when building the payload for `submitManualScore` and `onSaveAndRelease`, and in `isDirty` comparison against `initialScores`.
5. Update `ManualRubricEntryFormProps.onSaveAndRelease` to accept `spacing_band: ScoreBand | null`.

- [ ] **Step 2: Render the `N/A` option button on Spacing in Stepper and List layouts**

- For the Spacing criterion (`criterion.key === "spacing_band"`), render an **`N/A`** button alongside the 4 band buttons (e.g., shortcut `[0]` or clear `N/A` pill labeled `"N/A — Single word"` in stepper mode and `"N/A"` in list mode).
- When `measurement?.word_spacing_mean == null`, show a subtle helper hint on the Spacing criterion: `"No inter-word gaps detected — N/A recommended"`.
- Ensure clicking `N/A` announces `"Spacing marked not applicable."` for screen readers and advances to the next criterion in stepper mode just like selecting a band.

- [ ] **Step 3: Run frontend typecheck and lint**

Run (from `frontend/`): `npx tsc --noEmit; npx eslint .`
Expected: PASS with zero errors.

- [ ] **Step 4: Manual QA pass**

Verify in local dev (`npm run dev` + `uvicorn app.main:app --reload`):
1. Upload a single-word worksheet → `spacing_score` displays `N/A`, `composite_score` equals the 4-criterion average, Spacing diagnostic tab shows `"Single-word sample — no word spacing to evaluate"`.
2. Open manual rubric entry on the single-word submission → Spacing pre-selects `N/A`, saving succeeds with `spacing_band: null`, and gradebook shows accurate 4-criterion coursework points.
3. Upload a multi-word worksheet → Spacing scores normally and composite averages all 5 criteria.

- [ ] **Step 5: Commit**

```powershell
git add frontend/components/submissions/manual-rubric-entry-form.tsx
git commit -m "feat(ui): add N/A option for spacing in manual rubric entry form"
```
