# Phase 3 Slice ① — Assignment and Deadlines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Subagent-driven execution is an alternative only if the user explicitly chooses it.

**Goal:** Teachers assign activities to owned sections or roster students, set optional deadlines, and see assignment-aware coursework status; parents see work for the selected child and upload only when eligible.

**Architecture:** Keep browser reads in Supabase under RLS and writes in the existing FastAPI service. Introduce assignment rows and one authoritative assignment predicate; create/update the activity and its targets in a single service-only database transaction. Derive deadline status without adding submission lifecycle states; student-work overrides, Return, release, and the full active-attempt view arrive in Slice ②.

**Tech Stack:** Existing Next.js 16 / React 19 / strict TypeScript / TanStack Query / shadcn frontend; Python 3.13 / FastAPI / Pydantic v2 backend; Supabase Postgres, Auth, Storage, SQL migrations, pytest, Ruff, ESLint, and TypeScript compiler. Use installed dependencies; this slice needs no new service or package.

**Spec:** [Phase 3 design](../../next_steps/PHASE_3_CLASSROOM_ACTIVITIES.md), §2 Q2–Q3/Q18, §3, §4.1–4.2/4.7, §7, §8 Slice ①, and §9 Q-B/Q-C/Q-F. [Repository audit](../../../IMPLEMENTATION_STATUS.md#phase-3--classroom-style-activities).

**Prepared:** 2026-11-01 against local HEAD `3377875`. **State:** Contract accepted for implementation on 2026-11-01; user confirmed the defense milestone and authorized Slice ①. Work is isolated in `.worktrees/phase3-assignment-deadlines` on `feat/phase3-assignment-deadlines`. Schema, API, upload checks, forms, selected-child reads, status UI and generated contracts are implemented. CI integration verification passed at `116818b` (363 tests); signed-in portal QA remains pending. Initial implementation commit: `c4efd0a`. A passing implementation does not by itself authorize deployment.

**User-approved verification exception (2026-11-01):** Local Docker is unavailable. User explicitly approved coding locally and running the full disposable Supabase migration/backfill/RLS/backend suite in GitHub Actions instead of requiring that suite locally. The same tests remain mandatory. Database-dependent red/green and upgrade evidence is deferred to CI; 14 request-contract cases were observed failing against the old contracts before implementation and 28 database-free contract/HTTP-transport checks now pass locally. Do not classify connection errors as intended red tests. The user separately approved publishing this source to the public `ryanestoque/writewise` feature branch. Initial run: https://github.com/ryanestoque/writewise/actions/runs/41313276573 .

## Global constraints

- `AGENTS.md` governs conflicts with historical plans. In this repository the service-role key belongs in FastAPI; it must never reach the frontend. Browser reads use RLS; FastAPI authorizes each write before using its service-role client.
- "Schema changes are versioned SQL migrations only." Do not change hosted schemas through the dashboard or ad hoc SQL. Generate new migration filenames with the CLI; do not edit `0001`–`0021`.
- "Frontend branches on `error.code`, never on `error.message` text." Preserve `{ error: { code, message, details } }` and add new codes to `docs/API_SPEC.md` §2.4.
- "TypeScript: `strict: true`, kept strict — don't relax it." Generated contracts live at `frontend/types/database.ts` and `frontend/types/api.ts` in this checkout, not `frontend/src/types/`.
- Preserve unconditional image hardening/EXIF removal, decode limits, rejected-submission persistence, the in-process pipeline, and the single worker. Assignment/deadline rejection happens before image processing or Storage writes.
- Logs must not contain child names, raw images, scores associated with an identifiable child, activity instructions, or comment bodies. New eligibility logging is unnecessary.
- No rate limiting, dependency bots, notification jobs, email integration, points, gradebook, comments, or scoring-engine changes in this slice.
- Use the disposable Supabase stack in CI for integration tests under the user-approved exception above. Never run test resets against hosted dev/prod. The full suite is required because API and migrations change.
- Generated database/API types and related documentation ship in the same change as their contracts. Do not hand-edit generated files.

## Proposed resolutions and exact Slice ① contract

These resolve audit findings A1–A6. Confirm them together during contract review, then copy the accepted decisions into the Phase 3 proposal and promoted API/database/design docs.

| Topic | Proposed contract |
|---|---|
| Legacy visibility | Preserve all previously visible take-home activities for existing roster children. Additionally allow assigned in-class activity metadata as an explicit visibility expansion (§4.7). Parent upload remains take-home only. This replaces Q18's overly broad "parents see no change" wording. |
| Sectionless legacy students | Backfill a target for every owned section for every existing activity; add direct student targets wherever that activity's owning teacher's existing roster students are not covered by those sections. Handle null and mismatched section IDs. Empty-roster teachers keep existing activities without inventing assignment targets. Require nonempty targets on new creation or explicit replacement, not on unrelated edits of a legacy activity with no targets. |
| Ownership | A target section must belong to the activity's owner; a directly targeted student must be on that teacher's roster. A section target applies only to current members who are also on that teacher's roster. Both teacher and parent uploads require assignment. Teachers may add the student as a target before uploading. |
| Selected child | Filter targets for that child's ID/current section before fetching activities. The union of RLS-visible activities across siblings is insufficient for the selected-child screen. |
| Parent in-class display | Show assigned in-class work as read-only items in the child's activity list with an In class label. Never show a parent upload action for them. Preserve the current exclusion of archived activities from this list. |
| New fields | Creation requires trimmed, nonblank `title`, existing nonblank `target_text`, and nonempty `assignments`. `instructions` and `due_at` are nullable; defaults are null, `close_after_due` defaults false. No points field yet. Backfill title with the first 60 characters of target text. |
| PATCH semantics | Omitted fields stay unchanged. `instructions: null` and `due_at: null` clear values; null title/target text/assignments are invalid. A present assignments array replaces the whole set and cannot be empty. Deduplicate exact targets; permit overlapping section/direct targets without duplicate work rows. Reject close-after-due when the resulting due date is null; clear the toggle in the UI when clearing the due date. |
| Target JSON | Each target has exactly one non-null UUID: `section_id` or `student_id`. Unknown fields, malformed UUIDs, and XOR violations use Pydantic's `VALIDATION_ERROR` (422); an empty target list or non-owned target uses `INVALID_ASSIGNMENT_TARGET` (422). Validate the latter in the route/domain layer rather than using a Pydantic minimum-list-length error. |
| Deadlines | Accept only timestamps with a UTC offset (`AwareDatetime`); store `timestamptz`. Inputs and display use `Asia/Manila`, independent of the browser's zone. No due date means open. A parent is blocked only when `close_after_due` is true and server time is strictly greater than due. Teachers bypass closure, not assignment. |
| Slice-local status | Latest completed attempt per student/activity (stable `created_at desc, id desc`) supplies Turned in and Late. With no completed attempt: Assigned before/at due or without due, Missing after due. Processing/rejected attempt feedback remains visible separately and does not erase a completed attempt. No Draft/Released/Returned/Excused claims in ①. Replace this temporary selection with Slice ②'s shared view when it lands. |
| Time anchor | Check closure at server authorization time before pipeline work. Late follows the persisted submission's `created_at > due_at`, per the design; processing across the deadline can therefore create an accepted Late attempt. |
| New errors | `ACTIVITY_NOT_ASSIGNED` (404) only after resource relationships are authorized; `SUBMISSIONS_CLOSED` (409) only for an authorized parent/child/assigned take-home activity after closure; `INVALID_ASSIGNMENT_TARGET` (422) on target validation. Existing unrelated/missing-resource errors remain `NOT_FOUND` (404). |

Creation example:

```json
{
  "title": "Loop practice",
  "target_text": "one two three four five six",
  "instructions": "Write each word on the ruled worksheet.",
  "is_take_home": true,
  "due_at": "2026-11-15T09:00:00+08:00",
  "close_after_due": false,
  "assignments": [{ "section_id": "11111111-1111-4111-8111-111111111111" }]
}
```

## File boundaries

| Responsibility | Existing files to modify / new files to create |
|---|---|
| Local test configuration | Create `supabase/config.toml` through `supabase init`; review generated local-only settings. Modify `.github/workflows/ci.yml` for explicit local test credentials and the upgrade check. |
| Schema, backfill, helper, atomic mutation | Create the CLI-generated `phase3_assignments` migration under `supabase/migrations/`; its exact timestamped filename is captured when the CLI creates it. No migration is created by this planning change. |
| Assignment API models and backend eligibility | Create `backend/app/api/activity_contracts.py`, `backend/app/api/assignment_access.py`; modify `backend/app/api/activities.py` and `submissions.py`. |
| API and RLS verification | Modify `backend/tests/api/test_activities.py`, `test_submissions.py`, `test_submissions_parent.py`; create `backend/tests/api/test_activity_assignments.py`, `backend/tests/rls/conftest.py`, `backend/tests/rls/test_activity_assignments.py`, `backend/tests/migrations/assignment_upgrade_check.py`. |
| Teacher forms/reads | Modify `frontend/lib/hooks/use-activities.ts`, `frontend/components/activities/create-activity-dialog.tsx`, `edit-activity-dialog.tsx`, `activity-card.tsx`, `activity-detail-hero.tsx`, `frontend/app/(teacher)/activities/page.tsx`, `frontend/app/(teacher)/activities/[id]/page.tsx`, and `frontend/components/quick-upload-dialog.tsx`. |
| Focused UI/helpers | Create `frontend/components/activities/activity-assignment-fields.tsx`, `frontend/components/activities/activity-work-status.tsx`, `frontend/lib/utils/activity-deadlines.ts`, `frontend/lib/utils/activity-work.ts`. Reuse existing section/student hooks; do not restructure the portals. |
| Parent child-specific reads/UI | Modify `frontend/lib/hooks/use-parent-data.ts`, `frontend/components/parent/take-home-activities.tsx`, `parent-upload-dialog.tsx`. The current component filename may stay; update user-facing labels to include assigned in-class work. |
| Contracts and docs | Regenerate `frontend/types/database.ts`, `frontend/types/api.ts`; modify `docs/API_SPEC.md`, `docs/DATABASE.md`, `docs/DESIGN.md`, `docs/PRD.md`, `docs/TESTING.md`, the Phase 3 proposal, and `IMPLEMENTATION_STATUS.md`. |

Only add a new file when its task needs it. Preserve existing archive/delete behavior, scoring, student CRUD, and historical results. New forms use the existing visual system; apply the frontend/shadcn skills when implementing UI.

## Task 1: Establish a reproducible local test stack

**Interfaces:** Produces a local Supabase stack seeded with synthetic test identities and the environment needed by `backend/tests/conftest.py`; does not change deployed settings.

- [x] Confirm the contract review above is recorded. Check `git status`, current branch/worktree, and apply the using-git-worktrees skill before implementation. Preserve unrelated local files. User confirmed proceeding; original checkout changes remain untouched.
- [x] Reproduce the missing configuration check from repository root: `Test-Path -LiteralPath 'supabase/config.toml'` returned False. Run `supabase --version`; use the CI-pinned CLI version as the reproducibility baseline and verify current CLI documentation before changing commands. CLI 2.115.0 was invoked with npx; official CLI initialization, local setup, and configuration references were checked. The changelog markdown endpoint was unavailable.
- [ ] Run `supabase init`, inspect the created configuration, retain local seed execution, and verify migrations `0001`–`0021` apply with `supabase start` then `supabase db reset`. Inspect `supabase/seed.sql` for the teacher/parent records required by current tests; add only synthetic fixture setup if needed. Do not print credentials or load hosted `.env` values into tests.
- [ ] Set test-process variables from `supabase status -o json` in PowerShell without printing them:

```powershell
$localStack = supabase status -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Cannot read local Supabase status' }
$env:SUPABASE_URL = $localStack.API_URL
$env:SUPABASE_SERVICE_ROLE_KEY = $localStack.SERVICE_ROLE_KEY
$env:SUPABASE_ANON_KEY = $localStack.ANON_KEY
$env:SUPABASE_JWT_SECRET = $localStack.JWT_SECRET
$env:SUPABASE_DB_URL = $localStack.DB_URL
$env:ENVIRONMENT = 'test'
$env:SCORING_ENGINE = 'manual'
$env:MODEL_ARTIFACT_PATH = 'test/model.keras'
$env:CORS_ALLOWED_ORIGINS = 'http://localhost:3000'
```

- [ ] Run `uv run pytest tests/api/test_activities.py tests/api/test_submissions_parent.py` from `backend/` to establish the baseline. Diagnose failures before changing features. Add the same local anon-key capture to CI for the new RLS tests.
- [ ] Commit the verified local configuration/CI setup as `chore: make local Supabase test setup reproducible`.

**Task 1 evidence (2026-11-01):** `npx.cmd --yes supabase@2.115.0 init --yes` succeeded. Configuration uses local project ID `writewise-test`, enables migrations, and preserves `./seed.sql`. Existing seed includes the synthetic teacher and parent expected during collection. CI now captures `SUPABASE_ANON_KEY`, explicitly resets with `--local`, and pins manual scoring/empty HTR artifact for the test process. `npx.cmd --yes supabase@2.115.0 start` failed before migrations with `LegacyDockerLifecycleInspectError`: Docker and Podman commands were unavailable. Baseline/full suites, database types, and the upgrade proof remain pending. The complete startup/reset/cleanup commands are in `docs/TESTING.md` §3.1.1. Do not count Task 1 or Slice ① as complete until the stack and baseline pass.

## Task 2: Add assignment schema, atomic persistence, and an upgrade proof

**Interfaces:** Produces `public.activity_assignment`, `public.is_assigned(target_activity_id uuid, target_student_id uuid) -> boolean`, and service-only RPCs `public.create_assigned_activity(actor_id uuid, payload jsonb) -> jsonb` and `public.update_assigned_activity(actor_id uuid, target_activity_id uuid, payload jsonb) -> jsonb`. RPC responses are an activity object with its target array, matching Task 3's response model.

- [x] Write `backend/tests/migrations/assignment_upgrade_check.py` with `prepare --manifest PATH` and `verify --manifest PATH` subcommands. Guard every execution to require `ENVIRONMENT=test` and a localhost/127.0.0.1 Supabase URL before importing clients that read settings. Before the new migration, prepare synthetic Auth identities with test-only passwords, sections, roster/parent links, and take-home/in-class activities, including a sectionless child and a child with a section owned by another teacher. Save only synthetic IDs and the prior visible `(parent_id, child_id, activity_id)` set in the manifest; derive test-only sign-in credentials from those synthetic identities, never from a real user. Verify every old take-home tuple remains accessible after upgrade, title backfill matches, deadlines remain null, no points columns are added, and new in-class visibility matches the accepted contract. Use authenticated user sessions for visibility assertions, not the service-role client.
- [x] Add real database constraint/helper tests in `backend/tests/rls/test_activity_assignments.py`. Assert XOR, duplicate-target handling, section/direct assignment union, current-section changes, roster removal, ownership, and unauthorized helper calls. Create isolated Auth users in `backend/tests/rls/conftest.py`; use the service-role client only for setup/cleanup. Sign in separate clients using `SUPABASE_ANON_KEY` and each synthetic user's password for all authorization assertions.
- [ ] Run the new tests and upgrade verify mode before implementation to confirm missing schema/helper failures. Do not accept a setup/connection failure as the intended red test.
- [x] Run `supabase migration new phase3_assignments` and put the new schema in the path printed by the CLI. Add title/instructions/due/closure fields, title backfill and nonblank constraint, and the assignment table with XOR/FKs/uniqueness from proposal §4.2. Add indexes for target lookups and policy predicates. Backfill all owned sections plus direct targets for every uncovered existing roster student. Do not delete or rewrite submission history.
- [x] Implement the helper with a fixed empty search path, fully qualified objects, and explicit caller authorization. If SECURITY DEFINER is needed to avoid recursive activity/assignment policies, permit only the owning teacher, a parent linked to the target child, or the service-role request; return false for other callers. Independently require the activity-owner/roster relationship and the exact section/direct match. Revoke default PUBLIC/anon execution and grant only the required roles. Do not expose a helper that can probe arbitrary families' assignments.
- [x] In the same migration, replace the parent activity policy with assigned-child visibility. Give authenticated users SELECT-only access to the new assignment table under RLS. A section target row is visible only if it targets a linked child's current section and owner roster; a direct target row only if it names that parent's own child. Do not use merely "activity visible" as the assignment-row predicate, which would reveal other children targeted by the same activity. Revoke inherited anon access and authenticated write privileges on the new table; grant service-role writes explicitly. Retain the teacher's own-activity and own-assignment SELECT policies.
- [x] Implement both mutation RPCs as one transaction each. FastAPI will authorize in Python first; the RPC must also verify `actor_id` is the activity owner, validate all target ownership, and lock the existing activity for update before replacement. Missing update owner/resource returns the existing NOT_FOUND contract through the backend. Reject bad targets without reflecting the foreign owner's details. Limit execution to service_role; revoke PUBLIC/anon/authenticated execution. Use SQLSTATE `22023` for invalid assignment targets and have Task 3 map that code, not exception prose. Preserve unknown database failures as INTERNAL_ERROR with empty details.
- [x] Test rollback after a database-side validation failure: activity title, due date, and old assignment set remain identical; failed creation leaves no activity row. Testing only Python pre-validation does not prove this transaction boundary.
- [x] Wire the upgrade exercise into CI after the seed baseline and before the normal full-suite run. On the disposable stack, `supabase db reset --version 0021` prepares the old schema, the script's prepare mode writes fixtures, `supabase migration up --local` applies the new migration, and verify mode compares visibility sets. Confirm those flags against the pinned CLI before execution. Do not use reset against a linked hosted project.
- [x] Run the upgrade exercise and database tests, then regenerate `frontend/types/database.ts` from this migrated local stack with `supabase gen types typescript --local` (redirect to the real file path from repo root). This migration, backend, frontend, and type changes form one feature PR; do not release a halfway schema/RLS transition.

## Task 3: Add typed activity contracts and assignment-aware reads

**Interfaces:** `AssignmentTarget` represents a UUID section/student XOR; `ActivityCreate`/`ActivityUpdate`/`ActivityResponse` carry the accepted fields. `backend/app/api/assignment_access.py` produces `is_assigned(activity_id: str, student_id: str) -> bool`, backed by the RPC from Task 2. Existing `POST /api/activities` and `PATCH /api/activities/{activity_id}` paths remain.

- [x] Add integration cases to `test_activity_assignments.py` for valid section/direct/mixed targets, empty/foreign/XOR-invalid targets, a parent calling teacher routes, another teacher's PATCH, duplicate targets, omitted PATCH targets, explicit empty replacement, nullable clearing, and rollback. Update all existing activity-creation fixtures to include a valid title/owned assignment; do not silently auto-assign omitted targets for new clients.
- [ ] Include this concrete failure assertion after creating an owned section fixture:

```python
def test_create_rejects_empty_assignment_targets(client):
    response = client.post('/api/activities', json={
        'title': 'Loop practice',
        'target_text': 'one two three four five six',
        'is_take_home': True,
        'assignments': [],
    })
    assert response.status_code == 422
    assert response.json()['error']['code'] == 'INVALID_ASSIGNMENT_TARGET'
```

- [ ] Run `uv run pytest tests/api/test_activity_assignments.py -v` and confirm intended contract failures. Implement the Pydantic v2 models in `activity_contracts.py`; use `model_fields_set`/`model_dump(exclude_unset=True)` for PATCH and aware datetimes for due dates. Register `response_model=ActivityResponse` on create/update so OpenAPI carries actual success contracts.
- [x] Validate activity ownership and each target in Python before calling the service-only RPC. Serialize timestamps in JSON mode. Map SQLSTATE `22023` only to `INVALID_ASSIGNMENT_TARGET`; preserve NOT_FOUND ownership handling and the error envelope. Retain archive/bulk archive/delete behavior.
- [x] Complete RLS tests for parent A/parent B, sibling sections, unassigned children, unrelated teachers, anonymous access, and denied browser mutation/RPC calls. Confirm read behavior with authenticated sessions through the Data API. Service-role FastAPI tests alone cannot prove these policies.
- [ ] Run the activity/API and RLS modules; verify archive/delete regression cases. Document API fields and the three new error codes in `docs/API_SPEC.md` §2.4 and the activity/submission sections, and the schema/policies in `docs/DATABASE.md`.

## Task 4: Enforce upload eligibility without changing image/scoring behavior

**Interfaces:** Extend `assignment_access.py` with `assert_upload_allowed(activity: dict, student_id: str, caller_role: str, now: datetime) -> None`; callers perform existing parent/teacher ownership checks first. The function raises `ACTIVITY_NOT_ASSIGNED` or `SUBMISSIONS_CLOSED` with the agreed envelope.

- [ ] Add cases to `test_submissions.py` and `test_submissions_parent.py`: assigned teacher/parent, unassigned teacher/parent, past-due open upload, closed parent upload, closed teacher upload, exactly-at-due, no due, another family, and parent in-class upload. Patch pipeline/Storage calls to assert they are untouched on eligibility denial. Keep existing persisted-quality-rejection/EXIF/deletion tests.
- [ ] Run the affected tests to confirm the new authorization cases fail for missing checks. Fetch title/deadline/closure fields with the current activity lookup and insert assignment/closure checks after existing resource authorization but before `validate_and_harden_image` and pipeline/Storage work. Use UTC-aware server time; never compare localized text.
- [x] Keep deadline arithmetic explicit:

```python
if not is_assigned(activity['id'], student_id):
    raise HTTPException(status_code=404, detail={
        'code': 'ACTIVITY_NOT_ASSIGNED',
        'message': 'Activity is not assigned to this student.',
        'details': {},
    })
# due_at is parsed to an aware datetime before comparison.
if (caller_role == 'parent' and activity['close_after_due']
        and due_at is not None and now > due_at):
    raise HTTPException(status_code=409, detail={
        'code': 'SUBMISSIONS_CLOSED',
        'message': 'Submissions are closed for this activity.',
        'details': {},
    })
```

- [x] Update existing test activities/sectionless student fixtures with explicit assignment targets. Run `uv run pytest tests/api/test_submissions.py tests/api/test_submissions_parent.py tests/api/test_activity_assignments.py -v`. Do not relax authorization to make old fixtures pass.
- [x] Regenerate `frontend/types/api.ts` from the running local backend's OpenAPI using `npx openapi-typescript http://localhost:8000/openapi.json -o frontend/types/api.ts` from repository root. Start that backend with the same local test environment so no real artifacts are downloaded.

## Task 5: Build teacher assignment/deadline controls and roster status

**Interfaces:** Activity hooks use generated request/response types. `activity-assignment-fields.tsx` edits the same `assignments` payload consumed by Task 3. `toActivityDueAt(value: string) -> string | null` and `formatActivityDueAt(value: string) -> string` live in `activity-deadlines.ts`. `deriveActivityWorkStatus` in `activity-work.ts` accepts a due date, an explicit current instant, and completed-attempt metadata, returning Assigned/Missing/Turned in plus a Late boolean.

- [x] Update hook projections to include fields and visible assignment rows. Use `components['schemas']['ActivityCreate']`, `ActivityUpdate`, and `ActivityResponse` from generated API types for writes/responses; extend database-derived read shapes without maintaining a second handwritten API contract. Keep Supabase reads RLS-gated.
- [x] Add the shared form fields to create/edit dialogs: title, plain instructions, section multi-select, optional individual-student targets, optional Manila due date/time, closure toggle. Use existing section/student hooks. Display a useful empty state that links to section/student management when no targets exist. Do not submit a fabricated target.
- [ ] Preserve form state on server validation errors and branch on `ApiError.code`. Use inline target feedback for INVALID_ASSIGNMENT_TARGET; keep messages presentational. When duplicating an activity, copy its target text/title/instructions/mode/targets but clear due date and closure to avoid duplicating expired deadlines. Include this behavior in the manual QA record.
- [x] Convert a minute-precision datetime-local input using an explicit offset and render with an explicit zone:

```typescript
export function toActivityDueAt(value: string): string | null {
  return value ? new Date(`${value}:00+08:00`).toISOString() : null;
}

export function formatActivityDueAt(value: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
}
```

- [x] Add the inverse conversion for editing using `Intl.DateTimeFormat(..., { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(...)`; construct `YYYY-MM-DDTHH:mm`. Do not use browser-local date getters. Invalid input stays a form validation error.
- [x] Use activity title as the primary card/detail heading, with target text and instructions still accessible. Filter upload student choices by assignment for the selected activity, and clear incompatible student/activity selections. Keep a backend check even when the UI disables an action.
- [x] Render status for every assigned roster student, including those with no attempts; do not build the roster solely from submission groups. Use the same pure status derivation in teacher/parent views, preserving processing/rejection feedback separately. Reselect on timestamp changes/refetch so Missing updates while a page is open; avoid storing derived status in the database.
- [ ] Manually verify create/edit/duplicate/archive/upload with section-only, student-only, mixed, overlapping, and empty targets; keyboard access, narrow screens, and visible text status labels. No automated frontend test suite is introduced (`docs/TESTING.md` §7).

## Task 6: Add selected-child parent listing and deadline feedback

**Interfaces:** The existing `useTakeHomeActivities(childId)` hook may keep its export name for compatibility, but returns assigned activity title/instructions/mode/deadline/status metadata for that child. Its consumers show both modes; `ParentUploadDialog` accepts only an assigned take-home activity.

- [x] In `use-parent-data.ts`, read the selected child's `section_id` through the existing RLS-gated student query. Fetch direct/section assignment rows matching that child/current section, deduplicate their activity IDs, then fetch those activities under activity RLS. Do not fetch the union of teacher activities or the union of sibling assignments. Keep query keys child-specific and handle zero targets without an unfiltered fallback.
- [x] Batch-fetch attempt metadata for those activity IDs and the selected child. Pick latest completed attempts with the stable ordering from the contract; show processing/rejection attempts separately. Do not implement pinning, per-student due overrides, or release state here.
- [x] Show title, instructions, due date in Manila, Assigned/Missing/Turned in, optional Late, and In class/Take home mode. For a closed take-home activity disable upload with an explanatory message; read-only historical results remain accessible. Treat browser time as display feedback only—the server remains authoritative.
- [x] Handle ACTIVITY_NOT_ASSIGNED by refreshing the child list and closing an invalid upload selection. Handle SUBMISSIONS_CLOSED by refreshing deadline data and showing the closed state. Never parse exception prose or treat these as photo-quality errors.
- [ ] Manually verify sibling A in section A and sibling B in section B under the same teacher; an activity targeted to A must disappear when switching to B. Verify another parent's data is invisible, parent in-class work has no upload button, late-open work uploads, closed work fails, and a browser set to a different timezone still displays/edits Manila time correctly.

## Task 7: Verify the complete slice and promote documentation

**Interfaces:** Produces verification evidence and promoted contracts; only then can the tracker move Slice ① to Verified. A missing check keeps it Implemented, verification pending.

- [x] Update the proposal with the accepted audit resolutions and mark only Slice ① promoted. Update `docs/PRD.md`, `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/DESIGN.md`, and `docs/TESTING.md` to describe the shipped fields, policies, status subset, teacher/parent workflows, and test cases. Do not promote Slice ②–⑥ sketches as current behavior.
- [x] Check regenerated API/database types are present in the same diff and that frontend hooks use the real paths. Verify no new secret is included in source, generated output, config, or logs. Use current Supabase guidance for explicit grants/RLS and narrowly scoped functions; do not copy historical plan claims about client/server keys.
- [x] Run from `backend/`: `uv run ruff check .`. Run from `frontend/`: `npx eslint .` and `npx tsc --noEmit`. On PowerShell installations that block npx.ps1, use `npx.cmd`; if uv's cache is inaccessible, use the installed `.venv/Scripts/ruff.exe` and record that equivalent command.
- [x] Run the synthetic old-schema upgrade proof from Task 2, then `supabase db reset` and `uv run pytest` with local test environment values, followed by `supabase stop` in cleanup even on failure. Preserve failure output and fix failures before claiming Verified. Do not run the full suite using hosted `.env` defaults.
- [ ] Complete teacher/parent QA in Tasks 5–6 and record date, build/commit, roles, cases, and outcomes in the PR description and tracker. Check legacy take-home visibility, sectionless fallback, multi-child separation, latest-completed status, deadline boundary, server denial before image work, and archive/delete regressions explicitly.
- [x] Request a focused code review covering authorization, RLS, transactional rollback, backfill, generated contracts, and status/date behavior. Fix material findings, rerun affected checks, and then update `IMPLEMENTATION_STATUS.md` with evidence. Suggested feature commit: `feat: add activity assignments and deadlines`. PR description cites Phase 3 §8 Slice ① and the promoted doc sections.

## Coverage and handoff

| Requirement | Owning tasks |
|---|---|
| Targets, live section membership, owned roster, atomic replacement | 2–3 |
| Legacy visibility and sectionless/mismatched section fallback | 2–3; manual verification in 7 |
| Due dates, closure, parent-only closure restriction, no due default | 3–6 |
| Child-specific parent reads and in-class read-only expansion | 3, 6 |
| Slice-local Missing/Late display; processing/rejection retained | 5–6 |
| Error catalog, generated types, docs, RLS/integration/QA evidence | 2–4, 7 |

Execute inline with executing-plans after contract review. Stop after Slice ①; audit/update the tracker before planning Slice ②. Q-A (manual points scaling), email scheduling, and comment-thread details do not block this slice.

Official references checked during planning: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Data API grants and function access](https://supabase.com/docs/guides/api/securing-your-api). These support the separate grants/RLS controls and service-role boundaries; refresh version-specific CLI/function guidance before implementation. The changelog markdown endpoint could not be read by the browsing tool, so no changelog compatibility review is claimed.

## Execution evidence and remaining handoff

- User approved the Docker-free local workflow with full database verification in CI. Local preimplementation database red/baseline steps were deferred, not falsely counted as executed. Fourteen request-contract tests were observed failing before the new models, then the database-free checks passed.
- `116818b`: [CI run](https://github.com/ryanestoque/writewise/actions/runs/41313820267) passed migration replay, synthetic legacy upgrade, and all 363 backend tests (15 dependency warnings). CI-generated database types were downloaded from the earlier successful migration/type-generation artifact and committed in the same branch. OpenAPI types came from the local app's actual `app.openapi()` output using openapi-typescript, without requiring an HTTP server/database.
- Local Ruff, ESLint, tsc and production build passed; timezone/status smoke checks passed under New York and UTC. Review findings on stale targets and invalid upload prefills were fixed and re-reviewed. A final parent-dialog unavailable-selection guard passed lint/type checks and is included in the final CI rerun.
- Teacher/parent browser QA, narrow-screen/keyboard flow checks and deployment remain pending. Computer Use stopped on a Windows browser-URL policy check; the temporary preview route/server were cleaned up. Do not claim Verified or deployed. Checkbox items that explicitly require manual QA remain open; historical preimplementation DB commands are superseded by this recorded exception.
