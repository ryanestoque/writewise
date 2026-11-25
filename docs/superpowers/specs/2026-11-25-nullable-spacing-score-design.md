# Nullable Spacing Score & Dynamic Composite Scoring Design

**Date:** 2026-11-25  
**Status:** Proposed  
**Scope:** CV feature extraction, calibrated & manual scoring, Postgres schema, gradebook calculation, diagnostic overlay, and frontend score/rubric UI.

---

## 1. Problem & Goal

When a cursive handwriting worksheet contains only a single word (or one word per line), there are no inter-word gaps to measure. Currently:

1. `backend/app/cv/features/spacing.py` (`calc_stats([])`) returns `MetricSummary(mean=0.0, std=0.0)` instead of `(None, None)`.
2. `backend/app/scoring/provider.py` (`CalibratedScoreProvider`) reads `word_spacing.mean == 0.0` as a measured gap of `0.0` against the `1.4` target ratio, penalizing the student (`word_score = 51.0`) for a criterion that was never tested.
3. `supabase/migrations/0006_measurement.sql` computes `measurement.composite_score` as `(sum of 5 scores) / 5`, which evaluates to `NULL` if any single criterion is `NULL` (already a latent bug for `slant_score`, which can return `None`).
4. `backend/app/scoring/gradebook.py` (`resolve_recorded_score`) requires all 5 criteria to be non-null, dropping submissions with a `NULL` criterion from coursework points.
5. `supabase/migrations/0007_manual_score.sql` and `ManualScoreRequest` require `spacing_band` to be `NOT NULL`, forcing teachers to invent a spacing rating on single-word worksheets.

**Goal:** Treat Spacing as **Not Applicable (`null` / `N/A`)** whenever a worksheet has no inter-word gaps — in both automated calibrated scoring and teacher manual rubric scoring — and compute `composite_score` as the unweighted mean of the applicable (non-null) criteria so single-word worksheets receive fair, accurate grades and coursework points.

---

## 2. Architecture & Data Flow

```
Segmented Lines (0 word_gaps)
  │
  ├─► CV Features (spacing.py)
  │     word_spacing = MetricSummary(mean=None, std=None)
  │     letter_spacing = MetricSummary(mean=..., std=...)  # None if []
  │
  ├─► CalibratedScoreProvider (provider.py)
  │     word_spacing.mean is None ──► spacing_score = None
  │     composite_score = mean(non-null criteria)  # e.g. / 4
  │
  ├─► Diagnostic Engine (engine.py)
  │     spacing.annotations = []
  │     spacing.not_applicable_reason = "Single-word sample — no word spacing to evaluate"
  │
  ├─► Postgres (measurement & manual_score)
  │     measurement.spacing_score = NULL
  │     measurement.composite_score = GENERATED mean(non-null criteria)
  │     manual_score.spacing_band = NULL (optional) ──► spacing_score = NULL
  │
  ├─► Gradebook (gradebook.py)
  │     resolve_recorded_score averages non-null criteria (requires core 3 criteria)
  │     derive_points(possible, composite) unchanged
  │
  └─► Frontend UI
        Score cards / rubric / overlay display "N/A" for null spacing on scored work
        Manual rubric form offers explicit "N/A" option on Spacing
        Progress charts skip null spacing points; composite plots normally
```

---

## 3. Component Design

### 3.1 CV Feature Extraction (`backend/app/cv/features/spacing.py`)

- Update `calc_stats(values: List[float]) -> MetricSummary`:
  - When `not values`: return `MetricSummary(mean=None, std=None)` (matching `MetricSummary`'s existing `float | None` types in `backend/app/cv/models.py`).
  - When `len(values) == 1`: keep `MetricSummary(mean=round(float(values[0]), 2), std=0.0)`.
- Check all callers of `calc_stats` across `backend/app/cv/` to ensure none assume `mean` or `std` is non-null when the input list is empty.

### 3.2 Scoring Provider (`backend/app/scoring/provider.py`)

- **`CalibratedScoreProvider.compute_scores`:**
  - Extract `word_spacing_mean` with `default=math.nan` (same pattern already used for `slant_mean`).
  - If `not math.isfinite(word_spacing_mean)`: set `spacing_score = None` (always `N/A` when there are no inter-word gaps, even if intra-word gaps exist).
  - Otherwise, compute `word_score` and `letter_score` as before (if `letter_spacing_mean` is `None`/non-finite on a multi-word worksheet of fully connected cursive words, fall back to `word_score` at 100% rather than penalizing connected cursive).
- **`CriterionScores.composite_score`:**
  - Filter the 5 criterion scores to `present = [s for s in scores if s is not None]`.
  - If `not present`: return `None` (preserves Phase 1 `ManualScoreProvider` returning all `None`).
  - Otherwise: return `round(sum(present) / len(present), 2)`.

### 3.3 Gradebook Scoring (`backend/app/scoring/gradebook.py`)

- Define optional vs. required criteria:
  - Always required for a valid recorded score: `letter_formation`, `size_consistency`, `baseline_alignment`.
  - May be `None` (`N/A`): `spacing` (single-word worksheet) and `slant` (unsupported lean in calibrated mode; required in manual mode unless we later extend N/A to slant).
- In `resolve_recorded_score(measurement, manual_score)`:
  - For `calibrated` (`measurement`): validate all non-null criteria are finite `Decimal`s in `[0, 100]`, verify the 3 always-required criteria are present, and use `measurement["composite_score"]` if present (else `sum(present) / Decimal(len(present))`).
  - For `manual` (`manual_score`): verify `letter_formation`, `size_consistency`, `slant`, and `baseline_alignment` are present; include `spacing_score` if non-null; compute `sum(present) / Decimal(len(present))`.
- `derive_points` and `overall_percentage` remain unchanged.

### 3.4 Database Migration (`supabase/migrations/`)

Add a new versioned SQL migration:

1. **`public.measurement.composite_score`:**
   Postgres does not allow `ALTER COLUMN ... SET EXPRESSION` on generated columns in all versions cleanly without drop/re-add, so drop and re-add `composite_score` as a `GENERATED ALWAYS ... STORED` column:

   ```sql
   alter table public.measurement drop column composite_score;

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

   *Note:* Check whether any views or functions depend on `measurement.composite_score` before dropping/re-adding; none of the views in `supabase/migrations/` reference `composite_score` as a view column (PL/pgSQL functions resolve columns at runtime), and `gradebook_cell_fact` / `grade_source_signature` are SQL functions that may require `create or replace` if Postgres tracks column dependencies on `language sql` functions. The migration will recreate any dependent SQL functions cleanly in the same transaction if needed.

2. **`public.manual_score.spacing_band`:**
   ```sql
   alter table public.manual_score
     alter column spacing_band drop not null;
   ```
   - `public.manual_score.spacing_score` is already a `CASE spacing_band ... END` generated column without an `ELSE`, so it automatically evaluates to `NULL` when `spacing_band IS NULL`.
   - `public.save_manual_submission_score` already casts `(payload->>'spacing_band')::public.score_band`, which yields `NULL` when `spacing_band` is `null` in JSON, and compares rows with `IS DISTINCT FROM` (null-safe).

3. **Regenerate Types:**
   - Regenerate `frontend/types/database.ts` (and `frontend/types/api.ts` if present) after applying the migration.

### 3.5 API Contract (`backend/app/api/submissions.py`)

- Update `ManualScoreRequest`:
  - `spacing_band: ScoreBandEnum | None = None`
- In `PATCH /api/submissions/{id}/manual-score`:
  - Pass `"spacing_band": body.spacing_band.value if body.spacing_band is not None else None` to `save_manual_submission_score`.
  - Response already returns `"spacing_band": row["spacing_band"]` and `"spacing_score": float(row["spacing_score"]) if row.get("spacing_score") is not None else None`.
- Update `API_SPEC.md` and `DATABASE.md` to document nullable `spacing_band` / `spacing_score` and dynamic `composite_score`.

### 3.6 Diagnostic Overlay (`backend/app/diagnostic/`)

- **`backend/app/diagnostic/models.py`:**
  - Add `not_applicable_reason: str | None = None` to `SpacingOverlay`.
- **`backend/app/diagnostic/engine.py`:**
  - Track total inter-word gaps across all lines. When `total_word_gaps == 0` (and at least 1 word was segmented), set `SpacingOverlay(annotations=[], not_applicable_reason="Single-word sample — no word spacing to evaluate")`.

### 3.7 Frontend UI

- **Submission Detail (`frontend/components/submissions/submission-detail-content.tsx`):**
  - When a submission is scored (`hasCalibratedScores` or `manual_score` exists) and `spacing_score === null`:
    - Render **`N/A`** (neutral/muted badge) on the Spacing criterion card instead of `"Pending"` or `—`.
    - On the Spacing diagnostic tab, display `overlay.spacing.not_applicable_reason` (with a sensible fallback like `"Not applicable for single-word samples"` if older rows lack the field).
- **Manual Rubric Form (`frontend/components/submissions/manual-rubric-entry-form.tsx`):**
  - Represent Spacing selection as `ScoreBand | "not_applicable" | null` in local form state (distinct from `null` = "not yet chosen" so teachers make an explicit choice).
  - Add an **`N/A`** button/option on the Spacing criterion only.
  - When `initialScores` is empty and `measurement?.word_spacing_mean == null`, pre-select `"not_applicable"` (with a subtle helper note: *"No word gaps detected"*), while still letting the teacher pick a band if needed. When loading an existing `manual_score` with `spacing_band === null`, initialize Spacing to `"not_applicable"`.
  - Allow submission when the other 4 bands are selected and Spacing is either a band or `"not_applicable"`, sending `spacing_band: null` when `"not_applicable"`.
- **Progress Charts & Dashboard (`frontend/lib/hooks/use-dashboard.ts`, `frontend/lib/hooks/use-parent-data.ts`, `frontend/lib/utils/scoring.ts`, `frontend/lib/utils/submission-status.ts`):**
  - `computeCompositeFromCriteria` and `submission-status.ts` already average only non-null criteria.
  - Verify dashboard and parent portal trend hooks pass `null` spacing through cleanly so charts skip `null` points on the Spacing series without plotting `0`.

---

## 4. Error Handling & Edge Cases

- **All 5 criteria `None` (Phase 1 `ManualScoreProvider`):** `measurement.composite_score` remains `NULL`, so Phase 1 ungraded submissions are unaffected and still show as awaiting manual grading.
- **Multi-word worksheet with fully connected cursive words (`word_spacing.mean != None`, `letter_spacing.mean == None`):** `spacing_score` uses `word_score` at 100% rather than penalizing connected cursive.
- **Single-word worksheet over-segmented by CV into 2 fragments:** Teacher can still select `N/A` on Spacing in manual grading, overriding the auto-detected word gap.
- **Corrupt/partial `measurement` row missing core criteria:** `gradebook.resolve_recorded_score` still rejects rows missing `letter_formation`, `size_consistency`, or `baseline_alignment`.
- **Legacy `measurement` rows stored before this change:** Existing rows with `word_spacing_mean = 0.0` are untouched unless backfilled via `research/backfill_scores.py` (out of scope for this change).

---

## 5. Testing Strategy

- **Backend unit tests (`uv run pytest`):**
  - `spacing.py`: `calc_stats([])` returns `MetricSummary(mean=None, std=None)`; single-word `LineSegment` returns `word_spacing=(None, None)`.
  - `provider.py`: `CalibratedScoreProvider` with `word_spacing=(None, None)` returns `spacing_score=None` and `composite_score` averaged over the 4 remaining criteria; multi-word with `letter_spacing=(None, None)` scores from `word_spacing` alone; all-`None` returns `composite_score=None`.
  - `gradebook.py`: `resolve_recorded_score` succeeds when `spacing_score=None` (calibrated and manual) and when `slant_score=None` (calibrated), computing exact `Decimal` composite `/ 4` and accurate `derive_points`; still returns `None` when a core criterion is missing.
  - `diagnostic/engine.py`: single-word input sets `spacing.not_applicable_reason` and `annotations=[]`.
- **Backend integration tests (ephemeral Supabase stack: `supabase start` → `supabase db reset` → `uv run pytest` → `supabase stop`):**
  - Postgres `measurement.composite_score` generated column computes exact `/ 4` average when `spacing_score IS NULL`, `/ 5` when all 5 present, and `NULL` when all 5 are `NULL`.
  - `PATCH /api/submissions/{id}/manual-score` accepts `spacing_band: null`, stores `NULL` in `manual_score.spacing_band` and `spacing_score`, and syncs gradebook points using the 4-criterion average.
- **Lint / typecheck / manual QA:**
  - `uv run ruff check .`, `npx eslint .`, `npx tsc --noEmit`.
  - Manual QA pass on submission detail, manual rubric entry (`N/A` flow), and gradebook view.
