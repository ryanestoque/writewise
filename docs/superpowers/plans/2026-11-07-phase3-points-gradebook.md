# Phase 3 Slice 5 — Points and Gradebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended when selected by the user) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read this plan and its spec first. Execute inline unless the user selects delegation; this planning pass dispatches no agents.

**Goal:** Add optional activity points, teacher overrides, excused work, a teacher section gradebook, released-only parent grades and a matching class-record CSV, preserving the existing assessment and calibration scales.

**Architecture:** ScoreProvider resolves recorded scores and derives points using decimal arithmetic; one backend assembler serves both portals and CSV. Caller-JWT, security-invoker database read functions supply a coherent RLS-filtered fact snapshot. FastAPI-authorized, service-only write functions maintain separate grade publication records alongside the existing work lifecycle.

**Tech Stack:** Existing Python 3.13, FastAPI/Pydantic v2, HTTPX 0.28.1 from Slice 4, Supabase Postgres 17/PostgREST, pytest/asyncpg, Next.js 16/React 19, TanStack Query and Base UI shadcn components. Node 24. No added package, queue, worker, frontend test framework or model artifact.

**Spec:** [Approved points and gradebook design](../specs/2026-11-07-phase3-points-gradebook-design.md), approved 2026-11-07 when the user requested this plan. The approved mapping uses the existing composite, including manual midpoint scores; the previously suggested 25/50/75/100 normalization is rejected.

## Execution record

**2026-11-08 — inline execution selected.** Work is isolated in `.worktrees/phase3-points-gradebook` on `feat/phase3-points-gradebook`. Local merge `98e083f` integrates email branch `0208549` with main `6c77b06` only on this feature branch. The one conflict was parent-settings container width: main's max-width was retained alongside the email preference control. Neither source branch nor the email worktree was changed.

Frozen dependencies were installed into this worktree's own backend `.venv`; its frontend dependencies use a junction to the existing main node_modules. Fresh baseline: **153 database-free tests passed**, one upstream Starlette/TestClient warning; Ruff, ESLint and TypeScript passed. The initial console-script pytest invocation lacked the backend import path with `--confcutdir`; `uv run --frozen python -m pytest` includes the current backend directory and passes without an application/config change. Use that module invocation for subsequent checks.

Pinned Supabase CLI 2.115.0 was inspected. Local startup reports `LegacyDockerLifecycleInspectError`: Docker and Podman are both unavailable. A feature-branch CI trigger and the first storage/read RLS tests are prepared; their red run awaits authorization to publish this new branch to the existing repository's disposable CI. No new migration or hosted change has been performed.

**Task 1 red/green:** All 61 new scoring/contract cases first failed on absent functionality, then passed after implementation. The complete database-free regression run passed **214 tests**, with one upstream Starlette/TestClient warning. Ruff passes. Recorded manual midpoints, calibrated precedence, incomplete/non-finite/boolean inputs, decimal rounding, strict request fields and safe decimal responses are covered. These models remain unmounted, so there is no exposed API or database contract change yet.

| Task | Execution state |
|---|---|
| 0 — isolation/baseline/SQL runner | Isolation and local baseline complete; disposable SQL runner pending new-branch publication authorization |
| 1 — math/contracts | Complete: 61-case red/green and 214-test database-free regression passed |
| 2 — storage/read facts | Initial RLS tests written; red run pending; no migration implemented |
| 3–10 | Pending |

**Disposable SQL runner authorized (2026-11-08):** The user explicitly authorized pushing this branch and subsequent checkpoints to `https://github.com/ryanestoque/writewise` for feature-branch CI. [Initial CI run 42448061916](https://github.com/ryanestoque/writewise/actions/runs/42448061916), head `743acc3`, passed **732 tests**; the 14 new storage/read cases failed on missing columns/table/read functions (8 failures and 6 fixture errors), establishing the intended missing-schema red boundary. Existing migration/upgrade checks passed before those tests.

CLI allocated `supabase/migrations/20261108045526_phase3_gradebook_store.sql`. It adds storage/guards and caller-RLS fact reads. Pair-specific metadata history and a caller-rights cell-fact helper refine the SQL implementation without exposing grades/signatures or changing the approved behavior. This schema is unverified until the next disposable-stack run. A provisional CI migration checkpoint is used to obtain the actual generated database artifact; amend that checkpoint with its exact artifact before treating it as the delivered schema/types commit. Never hand-maintain the type approximation.

**Independent Task 6 progress:** While CI established its SQL red proof, shared assembly/CSV first failed 24 missing-feature cases, then passed them; mounted caller-JWT API reads first failed their missing implementation and now pass 11 controlled transport/role/error cases. An additional completeness test first reproduced silent omission of a cell and then passed with a snapshot guard. The full database-free suite passed **250 cases**, one upstream warning; ESLint/TypeScript passed with the actual generated OpenAPI types. Write endpoints and real SQL/API integration remain pending. The real-JWT API and >1000-cell integration cases now join the schema verification checkpoint. No new provider send, hosted migration, merge to main or deployment is authorized or performed.

**Storage/read migrated proof (2026-11-08):** [CI run 42449346256](https://github.com/ryanestoque/writewise/actions/runs/42449346256) on provisional head `96d5e86` passed **786 tests**, all four existing upgrade proofs, schema replay, real-JWT gradebook JSON/CSV isolation, the 1,092-cell read through its actual 10-second caller transport, and the security-advisor error gate. Its only failing step was the expected final committed-database-contract comparison. Artifact `13604488894` is associated with exactly `96d5e86607fc298a8ad5fde2f8a06c1582c1c9b0`; its actual generated database.ts was copied byte-for-byte after confirming the migration still matched that commit. Amend only this feature branch's provisional schema commit to include that artifact, and re-run final-head CI.

A read-only boundary review found no confirmed Critical/Important code defect in the implemented storage/read scope. Its verification recommendations add genuine current-publication source/maximum/pin/release invalidation, historical/archive/section moves and unrelated teacher-label denial cases. Those additional cases are not covered by the 786-test run and remain pending their next CI run. The feature's lifecycle writes, UI and final manual gates remain outstanding.

**Next red boundary:** Added those reviewer-recommended cases and a value-equivalent decimal-format publication case, plus activity/work mutation cases for Task 3. The mutation APIs are intentionally absent at this checkpoint; their red run precedes production mutation code. Storage migration/type delivery is now paired in amended local commit `fed9d92`. Publish this amended checkpoint and its new test child only with a lease against our own provisional remote `96d5e86`; source branches/main and unrelated work remain untouched.

## Global Constraints

**Independent Task 7 transport progress:** Account-scoped gradebook reads and CSV download now verify the exact session/token before and after transport; account changes abort stale results. The persistent notification controller also cancels/removes gradebook caches on auth changes. Eleven controlled scenarios passed, including logout/account-switch races, token rotation, HTTP errors and object-URL cleanup. ESLint and TypeScript passed. No gradebook screen or mutation UI is delivered by this checkpoint.

The following sentences are copied from the approved spec and apply to every task:

- “Slice 5 may proceed while Slice 4 email manual QA remains pending.”
- “Gradebook points use the existing numeric composite directly.”
- “Do not normalize manual bands to 25/50/75/100.”
- “Manual criterion values remain 12.5 / 37.5 / 62.5 / 87.5.”
- “Assign 0 creates a draft grade.”
- “A teacher must explicitly release it before a parent can see it or it enters the parent's total, including when there is no upload.”
- “Do not fabricate a submission to support this.”
- “Store teacher overrides and publication metadata, and calculate derived points and totals when reading.”
- “Use the existing active selector; add no alternate latest-attempt algorithm.”
- “Browser writes are denied; FastAPI performs application authorization before invoking service-only mutations.”
- “A parent must never fall back to an older or automatically derived grade when the current grade record is draft or hidden by RLS.”
- “Overrides belong to student × activity, so they persist until cleared; after a new active attempt they remain draft and visibly identified as overrides to the teacher.”
- “Archived activities retain their academic contribution.”
- “No additional email type is introduced.”
- “No provider I/O or image processing runs under these locks.”
- “Frontend branches on codes only.”

Also preserve AGENTS.md hard rules: SQL-first migrations; actual generated types; service credentials backend-only; image checks/EXIF stripping and persisted rejections; authorized offline research exports; no app rate limiter; in-process CV/CNN; one Uvicorn worker. Logs contain IDs and fixed outcomes, never names, point/measurement values, CSV bodies, tokens or provider data.

## Planning baseline and execution boundary

- Inspected local `main` at `6c77b06` and the email worktree at `0208549` on `feat/phase3-email-notifications`. Their merge base is `c3369cd`. Re-read these refs at execution; no remote freshness is claimed.
- Main has newer parent and authentication UI; the email branch contains the six email migrations through `20261103132241`, its actual generated contracts and four upgrade proofs. Main does not yet contain those email files.
- This pass writes planning/status documentation only. Every execution checkbox below starts unchecked. No feature branch creation, application code, migration file, hosted reset, provider send, commit, push or deployment is performed by writing this plan.
- Establish isolation when executing, using using-git-worktrees. Create `feat/phase3-points-gradebook` from current `main`; if email is still unmerged, integrate the local email branch into this new branch only. Preserve main's newer UI and the separate email worktree. This does not close email QA or authorize publishing a new branch.
- Local Docker/Podman was unavailable in the email execution record. Detect it again. Establish a working localhost stack or a user-authorized disposable CI runner before schema delivery. A previous authorization to push the email branch is not authorization to publish this new branch.
- No automated frontend suite exists by project policy. Frontend tasks use manual acceptance cases, lint, types, a production build and focused controlled transport checks where they protect account/race boundaries.

## File map

| Unit | New files | Existing files to modify |
|---|---|---|
| Score/total math | `backend/app/scoring/gradebook.py`; `backend/tests/unit/test_gradebook_scoring.py`, `test_gradebook_contracts.py` | `backend/app/scoring/provider.py` |
| Schema and read facts | CLI-created `phase3_gradebook_store` migration; `backend/tests/rls/gradebook_support.py`, `test_gradebook_storage.py`, `test_gradebook_reads.py` | `backend/tests/rls/conftest.py`; `frontend/types/database.ts` |
| Activity/work mutations | CLI-created `phase3_gradebook_mutations` migration; `backend/tests/rls/test_gradebook_mutations.py` | `backend/app/api/activity_contracts.py`, `submission_contracts.py`, `submission_lifecycle.py`, `assignment_access.py`; generated API/database types |
| Lifecycle/publication | CLI-created `phase3_gradebook_lifecycle` migration; `backend/tests/rls/test_gradebook_lifecycle.py`, `test_gradebook_races.py` | `backend/app/api/submissions.py`; lifecycle response models; existing deletion/lifecycle tests |
| Reminder integration | CLI-created `phase3_gradebook_notifications` migration; `backend/tests/rls/test_gradebook_notifications.py` | New versions of existing deadline/email functions; `backend/app/email/contracts.py`; existing scheduler/eligibility/dispatcher tests |
| API/CSV | `backend/app/gradebook/__init__.py`, `contracts.py`, `repository.py`, `service.py`, `csv_export.py`; `backend/app/api/gradebook.py`; `backend/tests/unit/test_gradebook_api.py`, `test_gradebook_csv.py`; `backend/tests/rls/test_gradebook_api.py` | `backend/app/main.py`, `core/config.py`, `.env.example`; generated API types |
| Shared UI/data | `frontend/lib/gradebook/transport.ts`; `frontend/lib/hooks/use-gradebook.ts`; `frontend/components/gradebook/points-field.tsx`, `gradebook-cell.tsx`, `work-grade-sheet.tsx`, `gradebook-bulk-dialog.tsx` | Activity create/edit fields/hooks; work status and query invalidation |
| Teacher grid | `frontend/app/(teacher)/gradebook/page.tsx`; `frontend/components/gradebook/teacher-gradebook.tsx` | `frontend/components/teacher-sidebar.tsx`, `teacher-header.tsx` |
| Parent grades | `frontend/components/gradebook/parent-grades.tsx` | `frontend/app/(parent)/progress/progress-content.tsx`; notification presentation/data/provider/destination |
| Upgrade/closeout | `backend/tests/migrations/gradebook_upgrade_check.py` | CI; companion docs, proposal, tracker; this execution record |

Do not modify applied historical migrations. Logical migration names here are arguments to `supabase migration new`; record each actual allocated path when the command runs.

## Shared contracts — names all tasks must use

### Database interfaces

All new public write RPCs are SECURITY INVOKER, `search_path = ''`, service-role-only. Private helpers live in `writewise_internal`, which remains outside exposed schemas. Read RPCs are SECURITY INVOKER and grant execution to authenticated callers; they derive identity with `auth.uid()`, never a supplied actor or role.

| Function | Exact parameters and result |
|---|---|
| `writewise_internal.grade_source_signature` | `(work_activity uuid, work_student uuid) -> text`; signature of selected active ID, all five recorded measurement values, all five manual bands, actual points possible, points revision, override and excused state; no derived grade math |
| `writewise_internal.grade_publication_current` | `(work_activity uuid, work_student uuid) -> boolean`; narrowly scoped SECURITY DEFINER boolean guard, actual family/owner check and live source/revision validation; no caller-supplied row/hash |
| `writewise_internal.has_grade_activity_history` | `(work_activity uuid) -> boolean`; narrow SECURITY DEFINER metadata guard; true only for the current parent linked to a child with a retained grade for that activity; no grade content returned |
| `writewise_internal.gradebook_teacher_name` | `(work_teacher uuid, work_student uuid) -> text|null`; narrow SECURITY DEFINER label lookup, own teacher or linked parent with relevant coursework only; returns full_name, never contact/profile fields |
| `writewise_internal.sync_work_grade` | `(work_activity uuid, work_student uuid, force_redraft boolean default false, allow_initial_publish boolean default false) -> public.student_work_grade`; caller already holds activity/work locks |
| `writewise_internal.publish_work_grade` | `(actor_id uuid, work_activity uuid, work_student uuid, expected_revision bigint) -> jsonb`; authorizes, locks, synchronizes, checks revision, publishes eligible rubric/grade and emits one event |
| `public.release_student_work_grade` | `(actor_id uuid, target_activity_id uuid, target_student_id uuid, expected_revision bigint) -> jsonb`; delegates to private publisher |
| `public.assign_zero_missing` | `(actor_id uuid, target_activity_id uuid, target_student_ids uuid[] default null) -> jsonb`; null = all eligible currently Missing; explicit list limits the set |
| `public.excuse_activity_students` | `(actor_id uuid, target_activity_id uuid, target_student_ids uuid[], excused boolean) -> jsonb`; nonempty explicit selection |
| `public.delete_student_submissions` | `(actor_id uuid, target_submission_ids uuid[]) -> jsonb`; activity/work locks, existing teacher/parent deletion authorization, atomic delete + grade synchronization; result `{deleted_ids: uuid[]}` |
| `public.read_section_gradebook` | `(target_section_id uuid) -> jsonb`; one snapshot with metadata, roster, relevant activities and cells; owner must match `auth.uid()` |
| `public.read_child_gradebook` | `(target_student_id uuid) -> jsonb`; one snapshot for the linked child, grouped by owning teacher |

Keep existing `create_assigned_activity`, `update_assigned_activity`, `mutate_student_work`, `complete_student_submission`, `save_manual_submission_score` and `release_activity_results` signatures. Extend their bodies and additive return fields. Keep the old submission-only meaning of `released_count` and `submission_ids`; add `released_grade_count` and `grade_student_ids`.

### HTTP contracts

All decimal response fields serialize as fixed two-place strings; source criterion facts are decimal strings internally. UUIDs and timestamps use existing generated schemas. Monetary formatting is not appropriate; labels say points.

| Route | Request | Success |
|---|---|---|
| Existing activity POST/PATCH | `points_possible: Decimal | null`; PATCH additionally `confirm_remove_points: bool = false` | Existing response + `points_possible`; revision is DB metadata |
| Existing work PUT | Existing due/pin fields + `points_override: Decimal | null`, `excused: bool`; omit preserves; null clears override | Existing work fields + excused and teacher-visible `grade` |
| `POST /api/activities/{activity_id}/students/{student_id}/release-grade` | `{expected_revision: positive integer}` | `GradeReleaseResponse` below |
| `POST /api/activities/{activity_id}/assign-zero-missing` | `{student_ids?: UUID[]}`; supplied array must be nonempty | `BulkGradeResponse` below |
| `POST /api/activities/{activity_id}/excuse-students` | `{student_ids: nonempty UUID[], excused: bool}` | `BulkGradeResponse` |
| `GET /api/sections/{section_id}/gradebook` | Bearer teacher; no student-selected role or clock | `SectionGradebook` |
| `GET /api/students/{student_id}/gradebook` | Bearer linked parent | `ChildGradebook` |
| `GET /api/sections/{section_id}/gradebook.csv` | Same teacher scope | UTF-8 BOM CSV, `text/csv`, `attachment; filename="gradebook-<section UUID>.csv"`, `Cache-Control: no-store` |

`GradeReleaseResponse`: `{activity_id, student_id, revision, released_at, submission_id: UUID|null, rubric_released: bool, grade_released: bool}`. `BulkGradeResponse`: `{changed_student_ids: UUID[], skipped_student_ids: UUID[]}`; duplicates are normalized and output IDs sorted.

`GradebookCell`: `{activity_id, student_id, applicable: bool, coursework_status, late: bool, points_possible: str|null, automatic_points: str|null, points_override: str|null, final_points: str|null, assessment_composite: str|null, assessment_source: "manual"|"calibrated"|null, publication: "draft"|"released"|"unavailable", grade_revision: int|null, active_submission_id: UUID|null, included: bool}`. Parent responses never use `draft`, expose hidden override/revision information or fall back to older grades; unavailable grade values are null. A separately released assessment may still supply its composite/band, including on bands-only work; this does not publish draft gradebook points.

`GradebookTotals`: `{earned: str, possible: str, percentage: str|null}`. `GradebookRow`: `{student_id, student_name, cells: GradebookCell[], totals: GradebookTotals}`. `GradebookActivity`: `{id,title,created_at,is_archived,points_possible: str|null}`. `SectionGradebook`: `{section_id,section_name,teacher_id,activities: GradebookActivity[],rows: GradebookRow[]}`. `ChildGradebook`: `{student_id,groups: {teacher_id,teacher_name,activities: GradebookActivity[],row: GradebookRow}[]}`. Sort students by name then ID; activities by created_at descending then ID descending; groups by teacher display name then ID.

`WorkGradeRecord`: `{id, activity_id, student_id, points_override: Decimal|null, source_submission_id: UUID|null, revision: int, released_revision: int|null, released_at: datetime|null}`; used only in the teacher-only work response. It excludes source_signature. Add `StudentWorkResponse.grade: WorkGradeRecord|null` and `excused: bool` together with their SQL response changes in Task 3.

`coursework_status` uses the exact Literal values `Assigned`, `Returned`, `Missing`, `Draft`, `Released`, `Turned in`, `Excused`, `Not assigned`; parent assembly never outputs Draft. Define `GradebookTeacherGroup` for the ChildGradebook group object and define every named request/response model in `contracts.py` before mounting it.

Database facts use these same scope/row identifiers, plus `grade_visible`, `publication_current`, `grade_revision`, `points_override`, and nullable `measurement`/`manual_score` maps of the five numeric fields. The five names are `letter_formation_score`, `size_consistency_score`, `spacing_score`, `slant_score`, `baseline_alignment_score`; measurement may also provide its generated `composite_score`. Read RPCs cast every numeric fact to text and omit source signatures. No N+1 reads.

New errors: `GRADE_NOT_RELEASABLE` / 409 / SQL `WW430`; `GRADE_REVISION_CONFLICT` / 409 / `WW431`; `POINTS_OVERRIDE_CONFLICT` / 409 / `WW432`; `POINTS_REMOVAL_CONFIRMATION_REQUIRED` / 409 / `WW433`. Reuse `NOT_FOUND`/404, `VALIDATION_ERROR`/422 and `INTERNAL_ERROR`/500. Invalid decimal/range writes from service RPCs use `WW434`, mapped to `VALIDATION_ERROR`. Never return raw SQL/provider details.

### Python and frontend interfaces

```python
# app/scoring/gradebook.py
@dataclass(frozen=True)
class RecordedGradeScore:
    composite: Decimal
    source: Literal["manual", "calibrated"]

def resolve_recorded_score(measurement: Mapping[str, object] | None,
                           manual_score: Mapping[str, object] | None
                           ) -> RecordedGradeScore | None: ...
def derive_points(possible: Decimal, composite: Decimal) -> Decimal: ...
def overall_percentage(values: Iterable[tuple[Decimal, Decimal]]) -> Decimal | None: ...

# Add concrete default methods to ScoreProvider; both implementations inherit them.
def recorded_grade_score(self, measurement, manual_score) -> RecordedGradeScore | None: ...
def activity_points(self, possible: Decimal, score: RecordedGradeScore) -> Decimal: ...

# app/gradebook/service.py: Pydantic contracts live in contracts.py.
def build_cell(fact: dict, *, audience: Literal["teacher", "parent"],
               provider: ScoreProvider) -> GradebookCell: ...
def assemble_section(facts: dict, provider: ScoreProvider) -> SectionGradebook: ...
def assemble_child(facts: dict, provider: ScoreProvider) -> ChildGradebook: ...

# app/gradebook/repository.py
async def read_gradebook_facts(client: httpx.AsyncClient, rpc: str,
                               parameters: dict[str, str]) -> dict: ...
# app/gradebook/csv_export.py
def csv_text(value: str) -> str: ...
def render_gradebook_csv(book: SectionGradebook) -> bytes: ...
```

The signatures above define interfaces; task code below supplies their bodies. Do not put ellipsis bodies into production. `GradebookCell`, totals, row, activity, section, child and response models are defined in Task 1 before any service/route uses them.

Frontend exports: `gradebookRequest<T>(userId: string, path: string, signal?: AbortSignal): Promise<T>` in `lib/gradebook/transport.ts`; `useSectionGradebook(userId: string, sectionId: string|null)` and `useChildGradebook(userId: string, childId: string|null, enabled: boolean)` in `lib/hooks/use-gradebook.ts`. Types come only from generated `components["schemas"]`. The shared transport also exports `gradebookMutation<T>(userId: string, path: string, method: "POST"|"PUT", body: object): Promise<T>` and `downloadGradebookCsv(userId: string, sectionId: string): Promise<void>`.

## Task 0: Establish an isolated, testable execution baseline

**Files:** Planning documents; `.github/workflows/ci.yml` only if a new disposable CI trigger is needed. No feature implementation in this task.

**Interfaces:** Consumes current main/email refs; produces an isolated checkout with both required foundations, an execution record and a real ephemeral SQL runner.

- [ ] Inspect git directory/common directory, branch, submodule state, worktrees and dirty files. Read applicable AGENTS.md and using-git-worktrees. Do not reset or relocate the user's untracked `.codex/`, env files or email checkout. Use per-command `-c safe.directory=<absolute checkout>` if ownership requires it, rather than changing global config.
- [ ] Create the new feature worktree from current main using native tools or the skill's fallback. If email is not already integrated, locally merge the email branch into this new feature branch. Resolve conflicts by preserving newer main UI/auth and all email contracts; do not merge into main or change the email branch. Record resolved SHAs.

```powershell
git rev-parse --git-dir
git rev-parse --git-common-dir
git rev-parse --show-superproject-working-tree
git check-ignore .worktrees
git worktree add .worktrees/phase3-points-gradebook -b feat/phase3-points-gradebook main
# From the new checkout, only when the email branch is not an ancestor:
git merge --no-ff --no-edit feat/phase3-email-notifications
```

- [ ] Copy the approved spec and this plan into the new checkout if their planning-only copies are still untracked; compare file hashes before removing any duplicate. Commit only these planning files and their accepted-decision documentation. Do not stage the user's `.codex/`.
- [ ] Discover installed tools, Supabase `--version`/`--help`, `migration new --help`, `start --help`, `db reset --help`, `gen types typescript --help` and `db advisors --help`. Run frozen `npm ci` / `uv sync --frozen` as needed in the isolated apps. Load the Supabase/Postgres, TDD, React/shadcn, review and verification skills for execution.
- [ ] Start/reset only the checked-in localhost Supabase stack. If containers remain unavailable, request authorization for this branch's CI publication only after the branch/trigger/test checkpoint is concrete. Keep unaffected pure Python work moving while that runner is established. Never reset hosted dev/prod.
- [ ] Capture ephemeral status into environment variables without printing keys. Confirm API and DB hostnames are localhost before full pytest. Use `ENVIRONMENT=test`, empty HTR artifact, stubbed inference, `EMAIL_DISPATCH_ENABLED=false`. Follow the existing CI synthetic callback setup so email tests stay deterministic.
- [ ] Run baseline Ruff, frontend lint/types, database-free tests and the full ephemeral suite; record failures separately from feature failures. Do not claim a baseline count from the historical 671-test email run.

```powershell
# backend; all variables are process-local dummy values for database-free checks only.
$env:ENVIRONMENT = 'test'
$env:SUPABASE_URL = 'http://127.0.0.1:54321'
$env:SUPABASE_SERVICE_ROLE_KEY = 'test-key'
$env:SUPABASE_JWT_SECRET = 'test-secret'
$env:SUPABASE_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
$env:CORS_ALLOWED_ORIGINS = 'http://localhost:3000'
$env:MODEL_ARTIFACT_PATH = ''
$env:HTR_MODEL_ARTIFACT_PATH = ''
$env:EMAIL_DISPATCH_ENABLED = 'false'
uv run pytest --confcutdir=tests/unit tests/unit -q
uv run ruff check .
# frontend
npx eslint .
npx tsc --noEmit --incremental false
```

- [ ] Commit the baseline/planning checkpoint: `docs: record approved gradebook design and implementation plan`. Add this branch to CI's push list only if CI is the approved runner; retain every existing email callback/upgrade/network guard step.

## Task 1: Recorded-score conversion and typed gradebook contracts

**Files:** Create `backend/app/scoring/gradebook.py`, `backend/app/gradebook/__init__.py`, `contracts.py`, `backend/tests/unit/test_gradebook_scoring.py`, `test_gradebook_contracts.py`. Modify `provider.py`. Existing exposed activity/work contracts are extended with their SQL implementation in Task 3.

**Interfaces:** Consumes stored score maps. Produces `RecordedGradeScore`, the three pure functions, the two default ScoreProvider methods, and every model named in Shared contracts. No SQL or HTTP dependency is needed for math tests.

- [ ] Add these first failing tests, then a parameter matrix for both provider implementations, missing/non-finite criteria, range violations, calibrated precedence and rounding ties.

```python
from decimal import Decimal
import pytest
from app.scoring.provider import get_score_provider

CRITERIA = ("letter_formation", "size_consistency", "spacing", "slant", "baseline_alignment")

@pytest.mark.parametrize("engine", ["manual", "calibrated"])
def test_recorded_manual_midpoints_are_not_normalized(engine):
    provider = get_score_provider(engine)
    manual = {f"{name}_score": "87.5" for name in CRITERIA}
    score = provider.recorded_grade_score(None, manual)
    assert score.source == "manual"
    assert provider.activity_points(Decimal("20"), score) == Decimal("17.50")

def test_calibrated_result_keeps_its_actual_percentage():
    provider = get_score_provider("manual")
    measured = {f"{name}_score": "82" for name in CRITERIA}
    measured["composite_score"] = "82.00"
    score = provider.recorded_grade_score(measured, None)
    assert provider.activity_points(Decimal("20"), score) == Decimal("16.40")

def test_missing_criterion_cannot_be_averaged_as_a_complete_score():
    provider = get_score_provider("calibrated")
    assert provider.recorded_grade_score({"letter_formation_score": "82"}, None) is None
```

- [ ] Run `uv run pytest --confcutdir=tests/unit tests/unit/test_gradebook_scoring.py -q`; observe missing-method failures before implementation.
- [ ] Implement the pure functions using these bodies and constants. Define `RecordedGradeScore` with the dataclass shown in Shared contracts; import Mapping/Iterable from collections.abc, Decimal/InvalidOperation/ROUND_HALF_UP, dataclass and Literal. Never consume a partial mean or normalize bands.

```python
CRITERIA = ("letter_formation", "size_consistency", "spacing", "slant", "baseline_alignment")
CENT = Decimal("0.01")

def resolve_recorded_score(measurement, manual_score):
    for source, record in (("calibrated", measurement), ("manual", manual_score)):
        if not record:
            continue
        try:
            values = [Decimal(str(record[f"{key}_score"])) for key in CRITERIA]
        except (KeyError, InvalidOperation, TypeError, ValueError):
            continue
        if any(not value.is_finite() or not 0 <= value <= 100 for value in values):
            continue
        composite = sum(values, Decimal(0)) / Decimal(5)
        if source == "calibrated" and record.get("composite_score") is not None:
            try:
                composite = Decimal(str(record["composite_score"]))
            except (InvalidOperation, TypeError, ValueError):
                continue
        if not composite.is_finite() or not 0 <= composite <= 100:
            continue
        return RecordedGradeScore(composite=composite, source=source)
    return None

def derive_points(possible, composite):
    if (not possible.is_finite() or not 0 < possible <= Decimal("9999.99")
            or not composite.is_finite() or not 0 <= composite <= 100):
        raise ValueError("Invalid recorded points input")
    return (possible * composite / Decimal(100)).quantize(CENT, rounding=ROUND_HALF_UP)

def overall_percentage(values):
    rows = list(values)
    earned = sum((earned for earned, _ in rows), Decimal(0))
    possible = sum((maximum for _, maximum in rows), Decimal(0))
    if not possible:
        return None
    return (earned * Decimal(100) / possible).quantize(CENT, rounding=ROUND_HALF_UP)
```

Include a regression case for a malformed supplied calibrated composite. Stored composite is authoritative once five criteria are present. Manual mean uses unrounded stored midpoint numbers.

- [ ] Add `ScoreProvider.recorded_grade_score` delegating to `resolve_recorded_score` and `activity_points` delegating to `derive_points`; preserve `compute_scores`, subclasses and existing inference behavior.
- [ ] Define all gradebook models with `extra="forbid"`, Decimal fields and fixed-two-place serializers, UUID IDs and Literal status/publication types from Shared contracts. Build `PointsPossible = Annotated[Decimal, Field(gt=0, le=Decimal("9999.99"), decimal_places=2, allow_inf_nan=False)]` and `PointsOverride = Annotated[Decimal, Field(ge=0, le=Decimal("9999.99"), decimal_places=2, allow_inf_nan=False)]`. Override-vs-maximum remains transactional validation. Define reusable `ActivityPointsUpdate` (optional maximum, confirmation) and `WorkGradeUpdate` (optional override/excused) models here for pure validation; Task 3 adds their fields to the existing exposed contracts and rejects null excused. Preserve omit-vs-null semantics.
- [ ] Add contract cases for `"0"`, `"-1"`, `"1.001"`, `"NaN"`, `"Infinity"`, `"10000"`, null reset, positive release revision, empty bulk selection and forged actor/role fields. Run both new unit modules and Ruff. Existing activity/submission contract changes and their partial-field tests belong to Task 3.
- [ ] New unmounted model definitions do not change OpenAPI. Generate API types whenever existing exposed contracts change in Tasks 3–4 and when new routes are mounted in Task 6. Commit `feat: define gradebook score conversion and contracts`.

## Task 2: Grade storage, RLS and coherent read facts

**Files:** New CLI-created `phase3_gradebook_store` migration; create `gradebook_support.py`, `test_gradebook_storage.py`, `test_gradebook_reads.py`; extend RLS conftest; generate `frontend/types/database.ts`.

**Interfaces:** Consumes existing active/work/assignment and family policies. Produces grade storage, publication guard, both read RPCs and test helpers below. The synchronization/publishing helper bodies arrive in Tasks 3–4; no published state is claimed before then.

- [ ] Add failing signed-in storage tests: parent cannot read a draft override; foreign parent/teacher cannot read it; source signatures are never selectable by authenticated clients; write/RPC grants are denied. Use existing `family` and `assigned_activity` fixtures. Add these helper bodies to `backend/tests/rls/gradebook_support.py`:

```python
from app.core.supabase import supabase_client as admin

GRADE_COLUMNS = "activity_id,student_id,points_override,revision,released_revision,released_at"

def configure_points(family, activity_id, value):
    return admin.rpc("update_assigned_activity", {
        "actor_id": family["teacher"], "target_activity_id": activity_id,
        "payload": {"points_possible": value},
    }).execute().data

def set_work(family, activity_id, payload, student_id=None):
    return admin.rpc("mutate_student_work", {
        "actor_id": family["teacher"], "target_activity_id": activity_id,
        "target_student_id": student_id or family["students"][0],
        "operation": "update", "payload": payload,
    }).execute().data

def read_grade(client, activity_id, student_id):
    return client.table("student_work_grade").select(GRADE_COLUMNS).eq(
        "activity_id", activity_id
    ).eq("student_id", student_id).execute().data

def release_work(family, activity_id, student_id, revision):
    return admin.rpc("release_student_work_grade", {
        "actor_id": family["teacher"], "target_activity_id": activity_id,
        "target_student_id": student_id, "expected_revision": revision,
    }).execute().data
```

- [ ] Storage tests create a synthetic draft directly with admin, without calling future mutation helpers: create student_work first, then insert `points_override="7.25"`, revision 1 and a synthetic signature into the new table. Assert `read_grade(parent,...) == []`, `read_grade(teacher,...)[0]["points_override"] == 7.25`, and authenticated `select("source_signature")` raises APIError `42501`. Observe the absent-table red run on the disposable stack.
- [ ] Run `supabase migration new phase3_gradebook_store`. Write this schema core to its actual returned file. Use unconstrained `numeric` plus explicit precision checks so PostgreSQL does not round an excessive-scale input before validation.

```sql
alter table public.activity
  add column points_possible numeric,
  add column points_revision bigint not null default 0,
  add constraint activity_points_valid check (points_possible is null or (
    points_possible > 0 and points_possible <= 9999.99
    and points_possible = round(points_possible, 2))),
  add constraint activity_points_revision_valid check (points_revision >= 0);
alter table public.student_work add column excused boolean not null default false;

create table public.student_work_grade (
  id uuid not null default gen_random_uuid() unique,
  activity_id uuid not null,
  student_id uuid not null,
  points_override numeric check (points_override is null or (
    points_override >= 0 and points_override <= 9999.99
    and points_override = round(points_override, 2))),
  source_submission_id uuid references public.submission(id) on delete set null,
  source_signature text not null,
  revision bigint not null default 1 check (revision > 0),
  released_revision bigint,
  released_at timestamptz,
  primary key (activity_id, student_id),
  foreign key (activity_id, student_id)
    references public.student_work(activity_id, student_id) on delete cascade,
  check (released_revision is null or released_revision = revision),
  check ((released_at is null) = (released_revision is null))
);
create index student_work_grade_student on public.student_work_grade(student_id, activity_id);
create index student_work_grade_source on public.student_work_grade(source_submission_id)
  where source_submission_id is not null;
alter table public.student_work_grade enable row level security;
revoke all on public.student_work_grade from public, anon, authenticated;
grant select (id, activity_id, student_id, points_override, source_submission_id,
  revision, released_revision, released_at) on public.student_work_grade to authenticated;
grant select, insert, update, delete on public.student_work_grade to service_role;
```

- [ ] Implement `grade_source_signature` using the existing `active_submission` ID and the SQL in the helper appendix. Its SQL select joins activity/work/active/measurement/manual_score and includes actual points possible, `points_revision`, override and excused. It is a stale-state fingerprint, not a security token. Service-only invocation, empty search path and fully qualified names. Do not expose the signature through grants or read RPC JSON.
- [ ] Implement `grade_publication_current` as a narrow SECURITY DEFINER publication guard: fetch the actual grade by pair, require current `auth.uid()` to be its parent or owning roster teacher, then evaluate this predicate against freshly selected state. Return a boolean only. Keep the schema unexposed and revoke PUBLIC/anon execution. Only the declared publication/history/teacher-label helpers receive authenticated execution; signature/synchronization/mutation helpers remain service-only.

```sql
-- Predicate evaluated by the guard after the caller/pair authorization check:
g.released_revision = g.revision and g.released_at is not null
and a.points_possible is not null and not w.excused
and g.source_submission_id is not distinct from selected.id
and g.source_signature = writewise_internal.grade_source_signature(g.activity_id,g.student_id)
and (g.points_override is not null or (
  selected.id is not null and selected.released_at is not null
  and writewise_internal.is_graded(selected.id)))
```

The guard reads its real row as owner to avoid recursive grade RLS and cannot accept a guessed grade/hash from its caller. Add teacher SELECT policy (actual activity owner + roster); parent SELECT policy (actual child relationship + guard true). The hidden signature column is also denied to teachers; their fact read needs only safe fields.
- [ ] Build both read functions as one SQL/PLpgSQL snapshot each, with `SECURITY INVOKER`, `search_path=''` and authenticated-only execution. In a single SELECT/CTE, combine the root section-owner/parent-link predicate with metadata and all fact aggregation; after that SELECT raise `WW404` if its root result is null. Avoid separate metadata authorization and fact SELECT snapshots. Scope queries use visible roster rows, owned activities and pairs that are currently assigned OR have retained submissions OR retained explicit grade history; include bands-only activities. Extend activity metadata SELECT policy using the private `has_grade_activity_history` boolean helper in Shared contracts, avoiding recursive activity/grade RLS. Do not make a due-only work row historical coursework.
- [ ] Respect current metadata RLS while grouping parent work: parents cannot read teacher_student or teacher profiles directly. Derive their relevant activities from visible activity rows and the existing assignment helper, own submissions and permitted grade history; do not inner-join a parent-invisible roster table. Resolve only the authorized teacher display name with `gradebook_teacher_name` from the appendix. Do not broaden teacher-table SELECT (which would also disclose email/profile data). Test an unrelated teacher lookup returns null and direct parent teacher-profile SELECT remains denied.
- [ ] Aggregate facts with `jsonb_build_object` / `jsonb_agg` in that single statement: metadata, ordered students, ordered relevant activities and ordered cell facts. Read safe grade columns explicitly; `grade_visible` is false when RLS removes the row. Do not fall back to source scores for parent publication. A draft's existence/revision/override must not appear in a parent fact. Use the active view for source ID and activity_work_state for coursework state; teacher/parent raw score rows retain existing RLS.
- [ ] Test empty section (metadata, empty arrays), foreign section/child 404, sibling isolation, current roster/section changes, history-only and bands-only pairs, archived columns retained, parent teacher grouping and PostgREST numeric strings. Add a case with more than 1000 pairs to prove JSON RPC aggregation avoids silent REST row truncation.
- [ ] Reset/replay on ephemeral stack, run the storage/read modules, full suite and security advisors, and generate real database types. Commit `feat: add private grade publication records and RLS fact reads` with generated types. Pending Task 3/4 behavior tests stay in their own later checkpoints.

## Task 3: Points-enabled activity edits and atomic work-grade mutations

**Files:** New CLI-created `phase3_gradebook_mutations` migration; `test_gradebook_mutations.py`; activity/submission contracts and authorization modules; generated contracts.

**Interfaces:** Consumes Task 2 storage/signature. Produces `sync_work_grade`, points-aware existing activity/work RPC bodies, bulk zero and bulk excuse.

- [ ] Add red tests for enabling points on old released work, first/second enable distinction, invalid precision/range/NaN, override bounds, identical save, missing zero, bulk skips, Excuse/Unexcuse, omitted fields, points removal confirmation and override conflicts. The basic accepted zero case is:

```python
from tests.rls.gradebook_support import configure_points, set_work, read_grade

def test_assign_zero_is_a_hidden_draft_without_a_submission(family, assigned_activity):
    activity = assigned_activity["id"]
    student = family["students"][0]
    configure_points(family, activity, "20.00")
    set_work(family, activity, {"points_override": "0.00"})
    grade = read_grade(family["teacher_client"], activity, student)[0]
    assert grade["points_override"] == 0
    assert grade["released_at"] is None
    assert read_grade(family["parent_client"], activity, student) == []
    assert family["teacher_client"].table("submission").select("id").eq(
        "activity_id", activity
    ).execute().data == []
```

- [ ] Observe red via `uv run pytest tests/rls/test_gradebook_mutations.py -q`. Allocate `phase3_gradebook_mutations` with CLI.
- [ ] Implement `sync_work_grade` under existing activity → work → grade lock order. Determine selected ID from active_submission; compute fresh signature after any input mutation. A new row starts revision 1/draft. Existing source/signature changes or true `force_redraft` bump revision and clear both release columns. Identical state is a no-op. Preserve override. For bands-only work retain an existing row's ID/revision history but clear override/source/publication state; do not recreate or reuse an event identity.

```sql
-- Revision invalidation core; invoke only after observing a real change.
update public.student_work_grade set
  revision = revision + 1,
  source_submission_id = selected_id,
  source_signature = new_signature,
  released_revision = null, released_at = null
where activity_id = work_activity and student_id = work_student
returning * into grade_row;
```

`allow_initial_publish` can publish only a complete already released active source during the very first null → points change (`old points_revision = 0`). It emits no historical notification. Subsequent restoration or maximum changes always start draft. Do not delete grade rows on points removal: retain monotonic revision and opaque ID for notification deduplication.
- [ ] Extend create/update activity RPCs: validate raw JSON numeric before casting to scaled types, increment `points_revision` only on real points changes, reject removing points without `confirm_remove_points=true` if grade state exists, reject lowering maximum below any override, and synchronize affected pairs in student-ID order under the activity lock. Preserve transactional assignment fanout and existing title/deadline edits; unrelated edits must not redraft grades. Reject confirmation=true unless points_possible is explicitly null.
- [ ] Extend existing work mutation allowlist with override/excused. Validate override against the locked activity maximum; reject any override when points are disabled. Preserve deadline/pin omission/null behavior. On a changed override invalidate once, save the fresh signature and revision; no-op preserves release. Excuse immediately excludes work; unexcusing forces a draft. Neither changes submission status, rubric, pin or due override. Authorize historical explicit grade work as well as existing submission history, without allowing foreign roster writes.
- [ ] Extend exposed activity/work models from Task 1's validated fields at this checkpoint. Their SQL response includes points_possible, excused and a safe grade object; serialize the teacher's grade with `to_jsonb(grade_row) - 'source_signature'`, never the full internal row. Define all WorkGradeRecord fields from Shared contracts before adding it to StudentWorkResponse. Run existing activity/submission contract modules and regenerate actual OpenAPI types in this same delivery.
- [ ] Implement bulk zero in one transaction: lock activity, derive current roster + live assignment, sample trusted time after lock, then evaluate Missing with no active attempt, not excused and positive maximum; restrict optional selected IDs; skip any existing override or numeric grade. Loop sorted eligible student IDs using the same work update helper. Implement explicit selected-student bulk excuse using the same checks/locks. Unknown/foreign requested IDs are skipped without exposing details; a foreign activity is 404. Roll back all changes if notification/DB persistence fails.
- [ ] Add `excused` to activity_work_state as first status precedence and to relevant parent activity facts/status helpers. Preserve the view's existing columns/order by appending fields or replacing it with compatible dependencies; return `late=false` for Excused. Include explicit grade-history pairs without uploads, guarded by existing RLS. Grade publication and coursework status remain separate.
- [ ] Run mutation/storage/read modules and full ephemeral suite; regenerate API (when exposed existing routes change) and database types. Commit `feat: add points overrides excused work and bulk missing zeros`.

## Task 4: Release revisions and coordinate attempts, scoring and deletion

**Files:** New CLI-created `phase3_gradebook_lifecycle` migration; `test_gradebook_lifecycle.py`, `test_gradebook_races.py`; submission lifecycle/contracts, submission deletion helper and affected existing deletion tests; generated types.

**Interfaces:** Consumes synchronized grades. Produces private/public grade publishers and delete RPC; integrates all existing lifecycle signatures and additive release counts.

- [ ] Write the first no-upload release test, then stale revision, idempotency and rubric isolation cases:

```python
def test_zero_release_does_not_fabricate_or_publish_a_rubric(family, assigned_activity):
    from tests.rls.gradebook_support import configure_points, set_work, read_grade, release_work
    activity, student = assigned_activity["id"], family["students"][0]
    configure_points(family, activity, "20")
    set_work(family, activity, {"points_override": "0"})
    revision = read_grade(family["teacher_client"], activity, student)[0]["revision"]
    result = release_work(family, activity, student, revision)
    assert result["grade_released"] is True
    assert result["rubric_released"] is False
    assert result["submission_id"] is None
    assert read_grade(family["parent_client"], activity, student)[0]["points_override"] == 0
    again = release_work(family, activity, student, revision)
    assert again["grade_released"] is False
    assert again["released_at"] == result["released_at"]
```

- [ ] Observe red; allocate `phase3_gradebook_lifecycle`. Before implementing the publisher, apply this null-submission notification shape in the lifecycle migration so its tests can pass independently of later reminder work:

```sql
alter table public.notification drop constraint notification_submission_kind;
alter table public.notification add constraint notification_submission_kind check (
  (type = 'score_released')
  or ((submission_id is not null) = (type in (
    'submission_returned','submission_rejected','resubmitted_after_return')))
);
```

- [ ] Implement publisher using authorize_work → lock_work → sync_work_grade. Compare the supplied revision after synchronization; stale = WW431. Reject excused, bands-only or absent numeric value with WW430. An automatic grade requires complete active scored work; an override can publish alone. Release eligible rubric and grade in this transaction; leave ungraded/draft rubric untouched when only explicit points are publishable. Set `released_revision=revision`, `released_at=coalesce(released_at,now())`. When a grade actually becomes published, emit once with this identity; idempotent repeats emit nothing:

```sql
perform writewise_internal.notify_work_parents(
  'score_released', work_activity, work_student, selected_id,
  'grade:' || grade_row.id::text || ':' || grade_row.revision::text);
```
- [ ] Replace the points-enabled path of existing submission release with the common publisher after validating the supplied submission is still active/graded. Keep bands-only behavior unchanged. Extend bulk release to eligible no-upload overrides and preserve legacy submission-only count fields. Add grade counts/IDs; skip excused, no-score/no-override and already published cells. Wire new routes in Task 6, not by adding submission-shaped fake rows.
- [ ] Synchronize grade state at the end of real completion, Return, changed pin and manual-score writes, after final active selection is established. Return of a nonactive historical attempt must not redraft an unaffected active grade. A rejected/processing upload does not change selected active source. Identical manual rubric saves retain release; actual source changes invalidate it. Existing released history stays readable under its original release stamp.
- [ ] Define `delete_student_submissions` with sorted activity locks before work/grade/submission locks; snapshot affected pairs, validate every remaining row, delete in one statement and synchronize those pairs afterward. Teacher rule remains current roster membership (including co-teachers as the current delete API allows); parent rule remains own upload + actual child link + no manual rubric. Preserve missing-row retry semantics and the 100-ID API batch bound.
- [ ] Change `_delete_submission_artifacts` to receive verified `actor_id`; after Storage removal call the delete RPC instead of direct SDK table deletion. Return its real deleted IDs. Keep Storage-before-DB cleanup, retryable failure envelopes, existing authorization and logging rules. Do not lock DB rows while removing Storage objects. Expand controlled SDK deletion tests to assert actor and sorted requested IDs, failure at Storage, failure/unknown outcome at DB, repeated deletion and a lost roster/grade permission before the RPC lock.
- [ ] Add observed-lock concurrency tests using `notification_support.wait_for_database_lock`: completion versus bulk zero; override edit versus release; points edit versus release; pin/Return versus release; deletion versus release. Both operations recheck state after acquiring the shared activity lock; do not synchronize tests with fixed sleeps. Verify source fingerprint denial even after an authorized offline/direct source change that missed an application sync, then successful teacher resync/release.
- [ ] Run full ephemeral pytest, API contract tests, types, advisors and existing deletion/research compatibility cases. Commit `feat: publish versioned work grades across the submission lifecycle`.

## Task 5: Excused reminders and grade-release notifications

**Files:** New CLI-created `phase3_gradebook_notifications` migration; `test_gradebook_notifications.py`; existing notification deadline and email eligibility modules; generated database types.

**Interfaces:** Consumes excused/publication state and publisher. Produces one result-shared event per published revision, null-submission work destinations, and live excused suppression in sweep and email authorization.

- [ ] Carry forward Task 4's zero-release, combined-release, repeated-revision and event-rollback proofs. Add red cases for no email enqueue for score_released, excused deadline/email work and the two send-authorization races.
- [ ] Allocate `phase3_gradebook_notifications`. Confirm Task 4's lifecycle migration already contains this exact notification constraint change; do not apply it a second time in the notifications migration:

```sql
alter table public.notification drop constraint notification_submission_kind;
alter table public.notification add constraint notification_submission_kind check (
  (type = 'score_released')
  or ((submission_id is not null) = (type in (
    'submission_returned','submission_rejected','resubmitted_after_return')))
);
```

Preserve the put_notification work-match validation whenever a submission is supplied. Task 4's publisher uses one common emission after both publication updates:

```sql
perform writewise_internal.notify_work_parents(
  'score_released', work_activity, work_student, selected_id,
  'grade:' || grade_row.id::text || ':' || grade_row.revision::text);
```

Remove the duplicate legacy rubric emitter only for the points-enabled combined publication path; bands-only release retains its old identity. No changes to historical notification rows/receipts. A repeated release has no new transition and emits nothing. Emit a grade-only event for a revised grade even when its rubric was already released.
- [ ] Replace the deadline sweep function through a new migration, preserving exact time/lock/dedupe behavior and adding `and not coalesce(w.excused,false)` to its locked candidate query. Keep exactly one named 15-minute job.
- [ ] Replace `writewise_internal.email_eligibility` through the same new migration with an early live-work check returning `{"state":"skipped","code":"work_excused"}`. Both preparation and authorize_email_delivery_at already call it after the activity lock, so prove both boundaries rather than creating divergent checks. Add `"work_excused"` to `SkipCode` in `backend/app/email/contracts.py`; otherwise PreparationResult/AuthorizationResult will reject the new SQL response. First add unit assertions constructing both actual models with `state="skipped", code="work_excused"`, and dispatcher cases that count a skip without invoking the sender. Retain leases, digest/idempotency, time budgets, preferences, network guard and disabled activation.
- [ ] Test due-soon/missing suppression, null work-row default, unexcuse same-deadline dedupe, changed deadline re-arming, excusing after email prepare but before send authorization, post-lock excuse committed first, accepted/in-flight limit, read-state preservation, and forced notification-insert rollback of rubric+grade publication. Run scheduler/email/notification modules plus the full ephemeral suite.
- [ ] Regenerate types; commit `feat: honor excused work in reminders and grade release events`.

## Task 6: Caller-RLS gradebook API and one CSV calculation path

**Files:** Create `backend/app/gradebook/repository.py`, `service.py`, `csv_export.py`, `backend/app/api/gradebook.py`, unit API/CSV modules and `backend/tests/rls/test_gradebook_api.py`. Modify `main.py`, `core/config.py`, `.env.example`, API error docs and generated API types.

**Interfaces:** Consumes both read RPCs and ScoreProvider methods. Produces every HTTP route in Shared contracts, the three assembler functions, the CSV renderer and request-scoped JWT transport. All new write routes reuse existing application authorization and lifecycle_rpc.

- [ ] Add pure service cases before implementation: teacher draft inclusion; parent draft exclusion; no fallback when the parent fact has `grade_visible=false` despite a released measurement; explicit zero with no source; excused exclusion; absent score; no-applicable cells; mixed maxima; archived totals; bands-only band/composite; grouping by teacher. Use this minimal fact constructor in `test_gradebook_scoring.py`, not a mock of the assembler:

```python
def cell_fact(**changes):
    result = {
        "activity_id": "33333333-3333-3333-3333-333333333333",
        "student_id": "22222222-2222-2222-2222-222222222222",
        "applicable": True, "coursework_status": "Missing", "late": False,
        "excused": False, "points_possible": "20.00",
        "active_submission_id": None, "grade_visible": True,
        "publication_current": False, "grade_revision": 1,
        "points_override": "0.00", "measurement": None, "manual_score": None,
    }
    result.update(changes)
    return result

def test_parent_cannot_fall_back_to_derived_points_over_a_draft_override():
    from app.gradebook.service import build_cell
    from app.scoring.provider import get_score_provider
    measured = {f"{name}_score": "82" for name in CRITERIA}
    fact = cell_fact(grade_visible=False, points_override=None, measurement=measured)
    cell = build_cell(fact, audience="parent", provider=get_score_provider("calibrated"))
    assert cell.final_points is None
    assert cell.automatic_points is None
    assert cell.grade_revision is None
    assert cell.included is False
```

- [ ] Run the new unit modules with `--confcutdir=tests/unit`; observe missing service/route failures. Implement build_cell around this explicit order, using Task 1 Decimal helpers and models:

```python
score = provider.recorded_grade_score(fact.get("measurement"), fact.get("manual_score"))
possible = Decimal(fact["points_possible"]) if fact.get("points_possible") is not None else None
visible = bool(fact.get("grade_visible"))
published = bool(fact.get("publication_current"))
can_show_grade = visible and (audience == "teacher" or published)
automatic = provider.activity_points(possible, score) if (
    can_show_grade and possible is not None and score is not None
) else None
override = Decimal(fact["points_override"]) if (
    can_show_grade and fact.get("points_override") is not None
) else None
final = override if override is not None else automatic
included = bool(fact["applicable"] and not fact["excused"]
                and possible is not None and final is not None and can_show_grade)
```

Populate every contract field explicitly. Parent publication is `released` only when current, otherwise `unavailable`; parent grade_revision is null. Parent coursework Draft maps to Turned in. Non-applicable cells show no numbers; Excused shows its status and is never included. Parent measurement/manual maps in facts must themselves already satisfy source release RLS; derive assessment_composite/source from these permitted maps separately from grade publication. Bands-only cells can show this released assessment while final_points stays null. For each row sum included final/possible values and call overall_percentage. Assemble ordered contract arrays without any extra DB calls.

- [ ] Add backend `SUPABASE_ANON_KEY: str = ""` and document it in backend `.env.example` as the same public API key used for caller-RLS reads (not a service key). Missing configuration produces a fixed generic INTERNAL_ERROR on gradebook reads, without breaking unrelated startup or logging env values. CI already supplies SUPABASE_ANON_KEY from its ephemeral status.
- [ ] Add a request-scoped HTTPX dependency in `api/gradebook.py`. Consume `credentials = Depends(security)` and the existing verified `get_current_user`; bind that exact submitted token to the HTTPX client below. Do not call set_session on the global service client, mutate shared headers, decode an unverified token or use user_metadata as the DB authorization boundary. The SQL scope functions independently require the real teacher ownership/parent link.

```python
async def get_gradebook_client(
    credentials=Depends(security), user=Depends(get_current_user),
):
    if not settings.SUPABASE_ANON_KEY:
        raise HTTPException(500, detail={"code": "INTERNAL_ERROR",
            "message": "Could not load grades. Please try again.", "details": {}})
    async with httpx.AsyncClient(
        base_url=settings.SUPABASE_URL.rstrip("/") + "/rest/v1/",
        headers={"apikey": settings.SUPABASE_ANON_KEY,
                 "Authorization": "Bearer " + credentials.credentials},
        timeout=httpx.Timeout(10.0),
    ) as caller_client:
        yield caller_client
```

Define the dependency as `async def get_gradebook_client(credentials=Depends(security), user=Depends(get_current_user))`. Keep verified user available separately for endpoint role checks. Calls to read RPCs use only this caller client. New write routes may use the service client only after `_owned_work`/`_owned_activity` checks, and the RPC rechecks the actor inside its transaction.
- [ ] Implement read_gradebook_facts: allow only the two fixed RPC names; POST relative `rpc/<name>` with the exact target UUID parameter. On 2XX require a dict; map WW404 to NOT_FOUND, database 401 to UNAUTHORIZED and transport/unrecognized/malformed payload failures to generic INTERNAL_ERROR. Never expose response bodies, exceptions, request headers or names in logs. Do not turn denied scopes/errors into successful empty books.
- [ ] Implement teacher/parent JSON routes using the appropriate assembler; CSV calls the same section reader and assemble_section as teacher JSON. Define and mount write routes for release-grade/bulk zero/bulk excuse using Shared contract payloads and new SQL error mappings. Extend existing work errors and API_SPEC §2.4 in this task. Add `Cache-Control: no-store` to all gradebook responses.
- [ ] Write the CSV red test and full renderer. Use a long-form stable CSV: one row per student/activity cell, sorted exactly as JSON; headers `student_name,student_id,activity_title,activity_id,points_possible,final_points,coursework_status,publication,included,overall_percentage`. Overall is repeated for the student's rows. Emit an empty-data book with its header only. Keep numeric fields as validated decimal text, never prefix numeric values as text.

```python
import csv
import io

def csv_text(value: str) -> str:
    stripped = value.lstrip(" \t\r\n")
    dangerous = stripped.startswith(("=", "+", "-", "@")) or value[:1] in ("\t", "\r", "\n")
    return "'" + value if dangerous else value

def render_gradebook_csv(book):
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["student_name", "student_id", "activity_title", "activity_id",
                     "points_possible", "final_points", "coursework_status", "publication",
                     "included", "overall_percentage"])
    activities = {item.id: item for item in book.activities}
    for row in book.rows:
        for cell in row.cells:
            writer.writerow([
                csv_text(row.student_name), str(row.student_id),
                csv_text(activities[cell.activity_id].title), str(cell.activity_id),
                format(cell.points_possible, ".2f") if cell.points_possible is not None else "",
                format(cell.final_points, ".2f") if cell.final_points is not None else "",
                cell.coursework_status, cell.publication, str(cell.included).lower(),
                format(row.totals.percentage, ".2f") if row.totals.percentage is not None else "",
            ])
    return output.getvalue().encode("utf-8-sig")
```

If Pydantic response values remain Decimal internally as intended, the formatter above works before JSON serialization; do not convert internal models to string dictionaries and then apply numeric formatting. Add CSV tests for formula prefixes after leading whitespace, tabs/newlines, quotes/commas, Unicode names, null points, zero, excluded archived visibility and JSON/CSV total equality. Assert no Storage call and no body/name logging.
- [ ] Test actual mounted API + controlled HTTPX transports: missing/invalid Bearer, role mismatch, exact caller Authorization forwarded, public apikey used, no service key on read request, foreign scope, malformed errors, two concurrent identities with distinct headers and stale release conflict. Restore all dependency overrides/clients afterward. Add real signed-in stack tests hitting JSON/CSV with production dependencies rather than the root conftest's teacher override.
- [ ] Run all gradebook unit/API/RLS modules, full ephemeral suite and lint. Generate real OpenAPI types and actual DB types; commit `feat: serve RLS-backed gradebooks and matching CSV exports`.

## Task 7: Shared frontend transport and activity points controls

**Files:** Create `frontend/lib/gradebook/transport.ts`, `lib/hooks/use-gradebook.ts`, `components/gradebook/points-field.tsx`. Modify `activity-assignment-fields.tsx`, create/edit activity dialogs, activity hooks, work invalidation and status utilities; generated API types come from Task 6.

**Interfaces:** Produces the three transport exports and two hooks defined in Shared contracts. `PointsField({id,value,onChange,error,disabled}: {id:string,value:string,onChange:(value:string)=>void,error?:string,disabled?:boolean})` renders the existing Field/Input composition. No browser point/total calculation.

- [ ] Before implementation, record the currently missing controls and the expected manual cases: blank bands-only, positive decimal, zero/negative/non-finite/third fractional digit, edit untouched points, removal acknowledgement and API conflict recovery. This repository intentionally has no automated frontend suite; do not install one or create component tests that mirror markup.
- [ ] Read the current frontend-design, shadcn and React skills at execution. Use existing semantic tokens/type hierarchy. In this feature, the visual anchor is the classroom record grid with sticky student labels; surrounding controls stay quiet. Use existing Base UI `render` primitives and installed Table, Sheet, Dialog, Select, Checkbox and Field rather than replacing them.
- [ ] Implement the account-bound transport. Retrieve a valid token with getAuthToken; verify `supabase.auth.getUser(token).data.user.id === userId` before a request; after response compare the current session's ID and exact access token with those used to submit it. Account/token changes abort application of the response. Forward AbortSignal; normalize API JSON with handleApiResponse. Mutations use the same identity guards. CSV uses a fetch with Bearer, checks errors before reading the blob, verifies identity again, triggers an opaque-ID filename download and revokes its object URL.

```typescript
type SectionGradebook = components["schemas"]["SectionGradebook"];
export function useSectionGradebook(userId: string, sectionId: string | null) {
  return useQuery<SectionGradebook>({
    queryKey: ["gradebook", userId, "section", sectionId],
    enabled: !!userId && !!sectionId,
    queryFn: ({ signal }) => gradebookRequest<SectionGradebook>(
      userId, `/api/sections/${sectionId}/gradebook`, signal),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}
```

Define useChildGradebook with `['gradebook', userId, 'child', childId]` and its enabled argument so the Grades tab loads lazily. Subscribe to auth-account changes in the hook layer to cancel/remove the prior user's gradebook queries; never use keepPreviousData across a child/account switch. Define mutations for work PUT, release-grade, bulk zero and excuse through gradebookMutation; export `useGradebookActions(userId: string)` returning `{updateWork,releaseGrade,assignZeroMissing,excuseStudents}` TanStack mutations. Each mutation invalidates `['gradebook',userId]` and existing invalidateWorkQueries. Add gradebook invalidation to existing upload/score/pin/delete/activity create/edit/archive consumers without changing their authorization behavior.
- [ ] Add `points_input: string` to activity form schema/default/reset. Blank serializes null. Validate with `^(?:\d{1,4})(?:\.\d{1,2})?$` plus numeric >0 and <=9999.99; this validation uses Number only to validate input, never to compute points. Use Field error/aria-invalid, descriptive label “Points (optional)” and copy “Leave blank to show handwriting bands only.”
- [ ] In create/duplicate, include points_possible as generated request type's decimal string or null. In edit, send points only when dirty; unchanged points must not redraft. Clearing enabled points opens an AlertDialog explaining that teacher overrides are removed; send confirm_remove_points=true only from its confirmed action. Changing a maximum explains that grades need release again. Handle WW432/WW433 mapped API codes with useful field/dialog errors and refreshed data; do not inspect messages.
- [ ] Extend ActivityWorkState and parent activity status unions with Excused. Ensure Excused is not counted as pending/missing and has no Late badge. Preserve existing upload permissions: excused is a grade/status decision, not a new upload prohibition. Assessment trends remain active/released rubric trends, separate from gradebook exclusions.
- [ ] Run frontend ESLint/types. Perform the recorded activity-form cases and a controlled transport script for sign-out, account switch, token refresh, child switch, aborted fetch, CSV denial and a delayed response from the previous account. Use actual transport exports with controlled fetch/Auth boundaries; do not add a framework. Commit `feat: add account-bound gradebook data and optional points controls`.

## Task 8: Teacher section gradebook and work-grade actions

**Files:** Create `frontend/app/(teacher)/gradebook/page.tsx`, `teacher-gradebook.tsx`, `gradebook-cell.tsx`, `work-grade-sheet.tsx`, `gradebook-bulk-dialog.tsx`. Modify teacher sidebar/header and, only as needed for reuse, submission lifecycle controls.

**Interfaces:** `TeacherGradebook({userId}:{userId:string})`; `GradebookCellButton({cell,onOpen}:{cell:components['schemas']['GradebookCell'],onOpen:()=>void})`; `WorkGradeSheet({userId,cell,open,onOpenChange}:{userId:string,cell:GradebookCell|null,open:boolean,onOpenChange:(open:boolean)=>void})`; `GradebookBulkDialog({userId,activityId,studentIds,operation,open,onOpenChange}: {userId:string,activityId:string,studentIds:string[],operation:'zero'|'excuse'|'release',open:boolean,onOpenChange:(open:boolean)=>void})`.

- [ ] Record before/after manual cases: empty/no section, section with null-section students excluded, loading/error/retry, mixed points/bands, horizontal overflow, archived filter, keyboard cell navigation, draft zero/release and bulk changed/skipped counts. At 360px width only the grid scrolls horizontally; the page header/actions remain usable.
- [ ] Add a server page using existing server Supabase createClient/getUser and a login redirect. Pass only user.id to the client gradebook. In TeacherGradebook fetch the section list through gradebookRequest with a user-scoped query key (the existing GET /api/sections endpoint), then request selected section facts with useSectionGradebook. Reuse TanStack cache; no per-cell fetch during grid rendering.
- [ ] Add Gradebook to teacher classroom navigation and header title. Render a section selector, a concise purpose line, archived visibility toggle, CSV action and semantic Table. Render one button per applicable cell with accessible name containing student, activity, status and visible points/publication. Student name column and column headers are sticky inside the grid container; row totals remain available on narrow screens. Do not introduce spreadsheet keyboard editing or a heavy grid dependency.

```tsx
<TableCell>
  <Button variant="ghost" onClick={onOpen} aria-label={cellLabel}>
    <span className="flex flex-col items-start gap-1">
      <span>{cell.final_points === null ? cell.coursework_status : `${cell.final_points} / ${cell.points_possible}`}</span>
      {cell.publication === "draft" && <Badge variant="secondary">Draft</Badge>}
      {cell.points_override !== null && <span className="text-xs text-muted-foreground">Teacher override</span>}
    </span>
  </Button>
</TableCell>
```

Use the generated schema types; `cellLabel` is built from props, not a new score formula. For bands-only work use its permitted assessment_composite with existing getBandFromScore/BandBadge. “—” represents no overall denominator. The archived toggle says “Totals include archived activities” and only filters displayed columns, never recomputes totals.
- [ ] Build WorkGradeSheet with SheetTitle/description, automatic points, override input, Clear override, Assign 0, Excuse/Unexcuse and Release. Keep the selected cell's current grade_revision for release requests. Stale revision conflict refreshes and asks the teacher to review the changed grade; do not automatically release a newer revision after a conflict. Disable release for Excused/no numeric value, not merely for a missing submission. Keep visible mutation errors and pending states.
- [ ] Reuse existing Return, pin and due controls by extracting reusable named components if their current exports do not expose them. Do not copy their internal forms into a second implementation. Fetch attempts only after opening the panel, scoped to that student/activity, then offer valid completed pins and existing submission detail links. No upload means no Return/Pin controls, but due/grade actions remain usable.
- [ ] Build bulk confirmation around actual current eligible cells for the selected column. For release call the existing activity release route with its additive grade counts; zero/excuse use the new endpoints. Show selected/eligible counts before submit and changed/skipped counts afterward. Server eligibility remains authoritative if work changes while the dialog is open. Preserve selected student IDs when refreshing error state.
- [ ] Manual QA with two teachers and a parent: private draft, explicit zero without upload, release, grade revision after edits/new active attempt, override persistence/clear, pin/Return, excuse/unexcuse, bulk races, archive filter and CSV agreement. Run frontend lint/types/build; commit `feat: add teacher section gradebook and work grade controls`.

## Task 9: Parent Grades tab and result-shared work destinations

**Files:** Create `frontend/components/gradebook/parent-grades.tsx`; modify progress-content, notification presentation/data, parent portal provider and notification work destination. Retain main's newest parent layout.

**Interfaces:** `ParentGrades({userId,childId,enabled}:{userId:string,childId:string|null,enabled:boolean})` consumes useChildGradebook and generated ChildGradebook. No parent mutation controls. Existing notification parse supports exact UUID validation and account-safe selected-child behavior.

- [ ] Record before/after cases: selected sibling isolation, draft override over released rubric, released no-upload zero, no included denominator, multiple teachers, bands-only result, score/history link, loading/error/retry and 360px layout. Parents must never see a Draft badge or hidden point/revision data.
- [ ] Extend `ParentProgressTab` with `grades` and add a labelled Grades tab inside existing TabsList. Render ParentGrades lazily with enabled only when active; preserve Overview, Practice and Progress behavior and the existing child selector. A valid `tab=grades` URL chooses Grades initially; reject duplicate/unknown tab values without clearing accessible child data.

```tsx
<TabsTrigger value="grades">Grades</TabsTrigger>
<TabsContent value="grades">
  <ParentGrades userId={userId} childId={selectedChildId} enabled={activeTab === "grades"} />
</TabsContent>
```

- [ ] Render one teacher group at a time or stacked compact groups using existing Cards/Table. Show activity title, coursework state, points possible and released final points only. Show server-computed released totals and copy “Missing work changes this total after the teacher assigns and shares points.” Bands-only cells show their released band/status; pending cells show “Not shared yet” with no synthetic zero. Excused cells say Excused and do not contribute.
- [ ] Extend notificationHref: for parent score_released with null submission, return `/progress?child=<id>&activity=<id>&tab=grades`; keep other existing links. Parse an optional grade destination field on ParentNotificationTarget, defaulting existing targets to work. Preserve strict duplicate/UUID checks. When dismissing a grade destination remove child/activity/submission targeting parameters while retaining the Grades tab.
- [ ] In NotificationWorkDestination, a grade destination resolves the child's authorized gradebook and activity metadata; show only its released row with a return-to-grades action. A no-upload grade must not query an absent submission ID or offer a fabricated worksheet. Existing worksheet-targeted result notices can show a link to the Grades tab; retain their original history/diagnostic behavior. If a target becomes inaccessible, show the existing unavailable state rather than switching silently to another child.
- [ ] Test delayed child/account response isolation with the actual shared transport and manually follow bell links for a no-upload zero, a rubric result and a returned submission. Confirm unrelated portal layouts and settings from main/email remain intact. Run lint/types/production build; commit `feat: show released child grades and no-upload result destinations`.

## Task 10: Upgrade proof, final review, documentation and verification gates

**Files:** New `backend/tests/migrations/gradebook_upgrade_check.py`; modify CI and companion docs, proposal and tracker. Update this plan with actual dated evidence while executing.

**Interfaces:** `python tests/migrations/gradebook_upgrade_check.py prepare --manifest <path>` and `verify --manifest <path>` follow existing synthetic-upgrade programs. Consumes pre-Slice-5 email schema; verifies fresh upgraded schema without any hosted credentials.

- [ ] Write the upgrade fixture before finalizing migrations. Prepare after the actual last Slice 4 migration (`20261103132241` at planning), with two families, assigned/history-only activity visibility, released/draft scored attempts, manual midpoint rows, existing read/unread notification/receipt and pending email/preference values. Save only synthetic IDs and expected sets/counts in its temporary manifest; never credentials/names/images.
- [ ] Verify after applying new migrations: all old activities have null points and revision 0, old work excused=false, old rubric values/releases/visibility unchanged, no grades/notifications/emails invented for bands-only data, original notifications/preferences/queue identities unchanged, new post-upgrade points/zero follows draft release and cross-family denial, and no-upload historical grade metadata remains available after targeting changes. Add a deliberate absent-schema/red upgrade checkpoint before green evidence.
- [ ] Retain all four previous upgrade proofs and email network/owner provisioning/callback checks. Add a fifth CI upgrade step using this exact command pattern, replacing the baseline version only if the execution audit proves a newer pre-gradebook migration:

```bash
supabase db reset --local --version 20261103132241
cd backend
uv run python tests/migrations/gradebook_upgrade_check.py prepare --manifest /tmp/gradebook-upgrade.json
cd ..
supabase migration up --local
cd backend
uv run python tests/migrations/gradebook_upgrade_check.py verify --manifest /tmp/gradebook-upgrade.json
cd ..
supabase db reset --local
```

- [ ] Generate actual contracts after final schema/API changes, compare clean diffs and commit them with those changes. Never reconstruct DB types by hand. Discover CLI flags first. If CI is the only migrated stack, retrieve the generated database-types artifact for the exact tested commit and verify its SHA association before copying it.

```powershell
# From repository root, using the ephemeral local stack; write UTF-8 without BOM:
$generatedDbTypes = & supabase gen types typescript --local
if ($LASTEXITCODE -ne 0) { throw 'Database type generation failed.' }
$dbTypeTarget = Join-Path (Get-Location).Path 'frontend/types/database.ts'
[System.IO.File]::WriteAllText($dbTypeTarget,
  ([string]::Join("`n", $generatedDbTypes) + "`n"),
  [System.Text.UTF8Encoding]::new($false))
# From backend, under the explicit ephemeral/test environment:
uv run python -c "import json; from pathlib import Path; from app.main import app; Path('../frontend/gradebook-openapi.json').write_text(json.dumps(app.openapi()), encoding='utf-8')"
# From frontend:
npx --yes openapi-typescript@7.13.0 gradebook-openapi.json -o types/api.ts
Remove-Item -LiteralPath gradebook-openapi.json
```

- [ ] Run Ruff (`uv run ruff check .`), full frontend ESLint and `tsc --noEmit`, all relevant pure tests and the full ephemeral suite. Run security advisors with the existing fail-on-error gate and a production frontend build using dummy localhost public configuration. On this Windows host installed-tool equivalents are `backend/.venv/Scripts/ruff.exe check .`, `node node_modules/eslint/bin/eslint.js .`, `node node_modules/typescript/bin/tsc --noEmit --incremental false`. A worktree whose dependencies are a junction may require `next build --webpack` / `next dev --webpack`.
- [ ] Use requesting-code-review before completion. Review the actual final diff for auth/RLS/raw-column privacy, signature guard, coherent read snapshots, source completeness, mutation locks, rounding, notifications, CSV formula text, account switching and existing UI preservation. Follow skill-directed delegation only if execution mode permits it; the planning self-review is inline. Fix material findings and rerun the checks affected by the fixes.
- [ ] Promote final endpoints/errors/grants/schema/rounding/source/publication contracts into `docs/API_SPEC.md`, `DATABASE.md`, `ARCHITECTURE.md`, `DESIGN.md`, `TESTING.md`, `SECURITY.md`, and relevant `DEPLOYMENT.md` key/rollback instructions. Record the added SUPABASE_ANON_KEY requirement. Add a gradebook publication ADR if needed to explain the narrow private guard and caller-JWT business-read boundary. Update the Phase 3 proposal's Q-A as resolved to existing composites; never change research midpoint mappings.
- [ ] Update IMPLEMENTATION_STATUS with actual deliverables and evidence. Until all automated gates and manual flows pass, status is Implemented, verification pending (or Partial with exact remaining items), not Verified. Keep Phase 3 count at 3/6 until a new slice is fully verified. Do not close Slice 4's pending QA/activation or infer deployment from CI.
- [ ] Perform the manual acceptance matrix below, recording observer, date, source/role, result and screenshot/reference where available. If browser/manual access is unavailable, preserve that gate and provide the concrete checklist to the user. Do not claim an unobserved walkthrough.
- [ ] Commit documentation/evidence: `docs: document gradebook contracts and verification evidence`. Use finishing-a-development-branch after implementation/testing; leave integration/publication choices to the user's authorized workflow. No automatic merge or hosted rollout.

## Manual acceptance matrix

| Flow | Teacher expectation | Parent expectation |
|---|---|---|
| Calibrated 82, maximum 20 | 16.40 points; Excellent assessment | Same after release |
| Manual all Excellent, maximum 20 | 17.50 points; original 87.5 assessment | Same after release; no normalization |
| Missing without override | Missing; no numeric contribution | Missing; no penalty in overall |
| Assign 0 without upload | Draft zero enters teacher denominator | No points/contribution until release |
| Release zero | Missing status + 0.00/20; one bell event | 0.00/20 enters total; link opens Grades without worksheet |
| Draft override over released rubric | Override shown as draft | Existing released assessment remains accessible; draft points hidden, no derived fallback |
| Edit override/points maximum | Grade revision increments and needs release | Current gradebook value unavailable until re-release |
| New completed attempt with override | Override persists, grade returns to draft | No old-grade/old-attempt fallback |
| Return/pin/clear override | Counted source and grade match shared active selection | Only current released grade contributes |
| Excuse/Unexcuse | Excluded both sums; underlying work retained; unexcuse draft | Excused excluded; no automatic penalty/republication |
| Bulk zero/excuse/release | Current eligible cells changed; skipped count shown | Only released allowed values appear |
| Archive/hide archived | Totals retain archived contribution; filter explains it | Same released academic contribution |
| Section move/assignment removal | Current section roster; retained authorized history | Own historical explicit grade remains readable |
| Sibling/account switch | New user-scoped response, no stale previous data | Only selected child's data, even on delayed responses |
| CSV | Same teacher rows, status, precision and totals | No parent CSV route |
| Keyboard/360px/retry | Work controls/focus usable; grid scrolls independently | Grades usable; read failure is not an empty or 0% result |

## Self-review and execution handoff

Before handing off, check every spec section against the coverage table, scan for unfinished instructions, verify every identifier/route/type across tasks, and verify file paths against the current checkout. Application snippets in this plan are planning content; no red/green, SQL migration or manual acceptance is marked done by writing them.

| Spec section | Owning tasks |
|---|---|
| 1 approved scores and draft zero | 1, 3, 4, 6; manual matrix |
| 2 shared math and caller-RLS reads | 1, 2, 6 |
| 3 points limits/rounding/edit/remove | 1, 3, 7 |
| 4 separate storage/publication/revision | 2, 3, 4, 6 |
| 5 excused/status/totals/history/archive | 2, 3, 6, 7, 8, 9 |
| 6 teacher/parent controls and recovery | 7, 8, 9 |
| 7 notifications/email/integration | 0, 5, 9 |
| 8 routes/auth/CSV/transactions | 2, 3, 4, 6 |
| 9 verification/docs/manual QA | 0, all task checks, 10 |
| 10 approval/handoff | approved spec + this plan |

Execution options: inline using executing-plans, or user-selected subagent-driven execution if that skill is available in the execution environment. Do not assume an unavailable skill or dispatch agents from this planning session. Implementation starts only after the user's execution choice; writing this plan is complete independently of that later work.

## Primary documentation checked during planning

- [Supabase RLS and security-invoker views](https://supabase.com/docs/guides/database/postgres/row-level-security): caller rights apply to underlying relations only when the view/read boundary is configured accordingly.
- [Explicit table exposure/grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically): new relations need explicit grants; do not rely on hosted defaults.
- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api): grants, RLS and private schema exposure are separate boundaries.
- [Python get_user(token)](https://supabase.com/docs/reference/python/auth-getuser): server validation of the actual supplied access token.
- [Postgres 17 numeric types](https://www.postgresql.org/docs/17/datatype-numeric.html): exact decimal storage and declared-scale coercion; use explicit validation to reject excessive input precision.

Recheck the relevant changelog/docs and installed CLI help at execution; these links do not authorize hosted changes.

## Helper appendix — concrete SQL for the storage task

Use these bodies in the CLI-allocated storage migration. The SECURITY DEFINER exceptions are bounded metadata/boolean checks against the current caller and actual rows. They never accept candidate score values/signatures or return a hidden row/contact field. Keep all other new helpers SECURITY INVOKER. The facts RPCs must never select source_signature.

```sql
create function writewise_internal.grade_source_signature(work_activity uuid, work_student uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select md5(jsonb_build_array(
    a.points_possible::text, a.points_revision, active.id,
    m.letter_formation_score::text, m.size_consistency_score::text,
    m.spacing_score::text, m.slant_score::text, m.baseline_alignment_score::text,
    m.composite_score::text,
    ms.letter_formation_band, ms.size_consistency_band, ms.spacing_band,
    ms.slant_band, ms.baseline_alignment_band,
    g.points_override::text, coalesce(w.excused,false))::text)
  from public.activity a
  left join public.student_work w on w.activity_id=a.id and w.student_id=work_student
  left join public.student_work_grade g on g.activity_id=a.id and g.student_id=work_student
  left join public.active_submission active on active.activity_id=a.id and active.student_id=work_student
  left join public.measurement m on m.submission_id=active.id
  left join public.manual_score ms on ms.submission_id=active.id
  where a.id=work_activity;
$$;

create function writewise_internal.grade_publication_current(work_activity uuid, work_student uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then return false; end if;
  if not exists(select 1 from public.student_parent sp
      where sp.parent_id=caller and sp.student_id=work_student)
    and not exists(select 1 from public.activity a join public.teacher_student ts
      on ts.teacher_id=a.created_by where a.id=work_activity
      and a.created_by=caller and ts.student_id=work_student)
  then return false; end if;
  return exists (
    select 1 from public.student_work_grade g
    join public.activity a on a.id=g.activity_id
    join public.student_work w on w.activity_id=g.activity_id and w.student_id=g.student_id
    left join public.active_submission active
      on active.activity_id=g.activity_id and active.student_id=g.student_id
    where g.activity_id=work_activity and g.student_id=work_student
      and g.released_revision=g.revision and g.released_at is not null
      and a.points_possible is not null and not w.excused
      and g.source_submission_id is not distinct from active.id
      and g.source_signature=writewise_internal.grade_source_signature(work_activity,work_student)
      and (g.points_override is null or g.points_override <= a.points_possible)
      and (g.points_override is not null or (active.id is not null
        and active.released_at is not null and writewise_internal.is_graded(active.id)))
  );
end;
$$;

create function writewise_internal.has_grade_activity_history(work_activity uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.student_work_grade g
    join public.student_parent sp on sp.student_id=g.student_id
    where g.activity_id=work_activity and sp.parent_id=(select auth.uid()));
$$;

create function writewise_internal.gradebook_teacher_name(work_teacher uuid, work_student uuid)
returns text language sql stable security definer set search_path = '' as $$
  select t.full_name from public.teacher t where t.id=work_teacher and (
    t.id=(select auth.uid()) or (
      exists(select 1 from public.student_parent sp
        where sp.student_id=work_student and sp.parent_id=(select auth.uid()))
      and exists(select 1 from public.activity a where a.created_by=t.id and (
        public.is_assigned(a.id,work_student)
        or exists(select 1 from public.submission s
          where s.activity_id=a.id and s.student_id=work_student)
        or exists(select 1 from public.student_work_grade g
          where g.activity_id=a.id and g.student_id=work_student)
      ))
    )
  );
$$;

revoke all on function writewise_internal.grade_source_signature(uuid,uuid)
  from public,anon,authenticated;
grant execute on function writewise_internal.grade_source_signature(uuid,uuid) to service_role;
revoke all on function writewise_internal.grade_publication_current(uuid,uuid)
  from public,anon,authenticated;
revoke all on function writewise_internal.has_grade_activity_history(uuid)
  from public,anon,authenticated;
revoke all on function writewise_internal.gradebook_teacher_name(uuid,uuid)
  from public,anon,authenticated;
grant usage on schema writewise_internal to authenticated;
grant execute on function writewise_internal.grade_publication_current(uuid,uuid)
  to authenticated,service_role;
grant execute on function writewise_internal.has_grade_activity_history(uuid)
  to authenticated,service_role;
grant execute on function writewise_internal.gradebook_teacher_name(uuid,uuid)
  to authenticated,service_role;

create policy grade_owner_select on public.student_work_grade
for select to authenticated using (
  public.is_teacher_of_student(student_id) and exists (
    select 1 from public.activity a where a.id=activity_id and a.created_by=(select auth.uid()))
);
create policy grade_parent_select on public.student_work_grade
for select to authenticated using (
  public.is_parent_of_student(student_id)
  and writewise_internal.grade_publication_current(activity_id,student_id)
);
```

The activity history policy must add the private metadata predicate to its existing parent condition; do not replace assigned/submission-history visibility. Check actual grants to all existing private functions after granting schema usage, because schema usage is separate from function execution. No private relation or schema is added to PostgREST's exposed schemas.

## Planning self-review record

This inline review found and resolved these implementation dependencies before handoff:

- The null-submission notification constraint/emitter now ships with the lifecycle task, so no-upload publication is independently testable before reminder integration.
- The SQL skip result `work_excused` is paired with Python email model/dispatcher tests and its SkipCode extension.
- Existing exposed activity/work contract changes ship with their transactional SQL and generated types in Task 3, rather than exposing an unimplemented field in the pure-math task.
- Publication fingerprints include the actual maximum as well as its revision; raw column grants and API serialization both hide those fingerprints.
- An edited grade cannot fall back to already released assessment data for parent points; assessment history remains a separate permitted read.
- Coherent fact reads use a single root-authorization/aggregation SELECT, and deletion joins the activity-first mutation lock order while retaining Storage-first cleanup.
- Parent grouping accounts for the existing teacher-profile/roster RLS restrictions with a narrow label helper, without granting access to teacher email/profile rows.
- The coverage table assigns every approved spec section to concrete tasks. Execution steps remain unchecked; application verification is not claimed.
