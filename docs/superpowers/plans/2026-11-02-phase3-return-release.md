# Phase 3 Slice 2 — Return and release implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the current session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Return, resubmission, pin, deadline override, and result-release lifecycle across both portals without leaking draft scores or losing research evidence.

**Architecture:** FastAPI authorizes writes and invokes service-only transactional Postgres functions. RLS protects browser reads; `active_submission` owns attempt selection and `activity_work_state` owns per-student status. Existing results are backfilled as released, while new results start as drafts.

**Tech Stack:** Existing FastAPI/Pydantic v2, Supabase Postgres 17/PostgREST, Next.js/React/TanStack Query, shadcn components; Supabase CLI 2.115.0.

**Spec:** [Approved design](../specs/2026-11-02-phase3-return-release-design.md). User approved on 2026-11-02 after separately confirming that Return blocks automatic fallback to older attempts.

## Global constraints

- Browser reads use RLS; all application writes use authorized FastAPI paths.
- New results are drafts; parent upload responses contain `measurement: null`.
- A Return prevents older-attempt fallback until a newer completed upload or valid explicit pin.
- Retain old images, measurements, independent rubrics, and previously released historical results.
- Dates use offset-aware timestamps and Asia/Manila controls; exact due remains open.
- No notifications, email, points, excused work, gradebook, or private comments in this slice.
- Pipeline/image security, ScoreProvider calculations, one in-process service, and one worker retain their existing contracts.
- Generated database/API contracts come from the migrated database/FastAPI schema.
- Database resets and automated integration tests use an ephemeral localhost stack only.
- Inline execution is selected by the user's request to proceed in this session. Request an independent code review before completion.

## Task 1: Request/response contracts and release-safe upload response

**Files:** Create `backend/app/api/submission_contracts.py` and `backend/tests/unit/test_submission_contracts.py`; modify `backend/app/api/submissions.py`.

**Interfaces:** `ReturnSubmissionRequest(reason, note=None, resubmit_due_at=None)`, `StudentWorkUpdate(due_at_override=None, pinned_submission_id=None)`, typed return/release/work responses, and `SubmissionCreateResponse(submission_id, status, released_at, measurement)`.

- [ ] Write contract tests that reject unknown reasons, naive deadlines, unknown/empty work updates, and invalid pin UUIDs; verify trimmed/blank note normalization and omission versus explicit null.

```python
def test_return_deadline_omission_is_distinct_from_reset():
    assert 'resubmit_due_at' not in ReturnSubmissionRequest(reason='incomplete').model_fields_set
    assert 'resubmit_due_at' in ReturnSubmissionRequest(
        reason='incomplete', resubmit_due_at=None
    ).model_fields_set
```

- [ ] Run the new unit module with `--confcutdir=tests/unit`; observe the missing-contract failure.
- [ ] Implement strict Pydantic contracts, offset-aware dates, 2,000-character trimmed notes, required nonempty updates, and nullable upload measurements.
- [ ] Add a real-route parent-upload assertion that a successful upload exposes neither measurements nor diagnostics, while teacher responses retain the payload.
- [ ] Redact at the route response boundary, rerun contract/transport tests, and commit the deliverable.

## Task 2: Transactional data model, authoritative views, and release policies

**Files:** New CLI-created enum and lifecycle migrations; new `backend/tests/rls/test_submission_lifecycle.py` using existing `tests/rls/conftest.py`; new `tests/migrations/release_upgrade_check.py`.

**Interfaces:** `active_submission` returns selected submission rows; `activity_work_state` returns `activity_id`, `student_id`, `active_submission_id`, `effective_due_at`, `work_status`, `late`, latest-attempt metadata, and return metadata. Service RPCs accept `actor_id` and explicit target IDs and return JSON; public execution is revoked.

- [ ] Add signed-in tests for an unreleased manual/calibrated result, direct and embedded reads, foreign-family denial, and denied browser mutation/RPC calls. Run against the pre-feature stack and observe the missing view/fields or visible draft failure.
- [ ] Generate two migration names with `supabase migration new`: first the enum addition, then fields/table/views/functions/policies.
- [ ] Backfill release timestamps, create checked return metadata and `student_work`, and index selection/foreign-key paths.
- [ ] Implement the active selector using deterministic upload order and a return barrier; a valid pin wins, rejected/processing attempts do not qualify.

```sql
-- Candidate selection must use this ordering and eligibility:
order by (s.id = w.pinned_submission_id) desc, s.created_at desc, s.id desc
-- An unpinned completed candidate must be newer than the latest returned upload.
```

- [ ] Implement role-appropriate work status using effective due and RLS-visible score rows. Protect both score-table parent policies with the release predicate; preserve submission/photo/history reads.
- [ ] Implement atomic Return, single/bulk release, partial work update, upload begin/finalize, and manual-score save. Serialize mutations with a consistent work lock; do not hold locks during image/model/Storage calls. Recheck ownership, roster, active state, grade presence, and pin validity in transactions.
- [ ] Test Return on inactive/pinned/historical attempts, rejected resubmission, equal timestamps, delete-pin cleanup, bulk release eligibility, repeated release, and rollback on invalid overrides/pins.
- [ ] Add a synthetic upgrade fixture proving pre-feature visibility and post-feature draft creation. Wire it beside the existing legacy assignment upgrade exercise.
- [ ] Reset/replay migrations and run signed-in RLS/API tests on an ephemeral stack; generate database types and commit migrations/tests/types together.

## Task 3: Authorized lifecycle API and upload/manual-score integration

**Files:** Create `backend/app/api/submission_lifecycle.py`, `backend/tests/api/test_submission_lifecycle.py`, and unit transport cases; modify `main.py`, `submissions.py`, `assignment_access.py`, and `docs/API_SPEC.md`.

**Interfaces:** Public routes are POST submission Return, POST submission release, POST activity release, and PUT activity/student work, exactly as specified. Add `SUBMISSION_NOT_RETURNABLE`, `SUBMISSION_NOT_RELEASABLE`, and `INVALID_WORK_SELECTION` to the code catalog.

- [ ] Write route tests with literal expected HTTP/status/error codes for owner versus foreign teacher, parent denial, malformed values, invalid states, and valid transitions.

```python
response = client.post(f'/api/submissions/{submission_id}/return', json={'reason': 'incomplete'})
assert response.status_code == 200
assert response.json()['status'] == 'returned'
```

- [ ] Observe absent-route failures, then implement Python authorization before invoking the transactional RPC. Map SQLSTATE codes to the standard error envelope without exposing exception prose.
- [ ] Route upload begin/finalize through the work lock protocol, fetch effective due before image decode, and preserve rejected-row persistence.
- [ ] Move manual-score save into the transaction and clear release on changed rubrics. Require activity ownership plus roster membership.
- [ ] Cover upload/Return/pin/release races and exact-boundary closure. Run affected tests, regenerate OpenAPI types from `app.openapi()`, and commit.

## Task 4: Browser data contracts and shared active-work consumers

**Files:** Create `frontend/lib/hooks/use-activity-work.ts`; modify `use-submissions.ts`, `use-dashboard.ts`, `use-parent-data.ts`, and `activity-work.ts`.

**Interfaces:** `useActivityWork(activityId)` reads shared work states; `useReturnSubmission`, `useReleaseSubmission`, `useReleaseActivity`, and `useUpdateStudentWork` invoke generated request/response contracts. Score queries select through `active_submission`; full attempt history continues to use `submission`.

- [ ] Extend submission types with returned/release metadata, and use generated lifecycle payload types.
- [ ] Add authenticated mutation hooks that share all affected query invalidations and branch only on API error codes.
- [ ] Replace per-consumer attempt selection in teacher/parent latest scores, dashboard, trends, and activity status. Remove the parent 20-attempt cutoff and batch related fetches.
- [ ] Preserve full history separately from active-only chart points; parent consumers require a released result and never fall back to an inactive released attempt for the same activity.
- [ ] Use the effective due in both parent eligibility controls and teacher status; keep processing/rejection feedback separate.
- [ ] Run ESLint and TypeScript, verify the PostgREST nested relationships against the migrated stack, and commit.

## Task 5: Teacher and parent lifecycle interfaces

**Files:** New focused lifecycle dialog/control components under `frontend/components/submissions/`; update submission detail, teacher activity page, parent activity/upload/history components, and `docs/DESIGN.md`.

**Interfaces:** Return accepts a reason, optional note, and deadline; lifecycle controls consume a submission and its shared work state. Per-student controls accept activity/student IDs and current override/pin.

- [ ] Read installed dialog/select/field component APIs and current portal layouts before composing controls.
- [ ] Add Return with reason, optional plain-text note, and offset-correct resubmission deadline. Provide clear submit errors and pending states.
- [ ] Add single/bulk Release, active/pin indicators, pin/unpin, and deadline/reset controls with counts and confirmation where specified.
- [ ] Show Return metadata, effective due, and eligible resubmission in the parent portal. Unreleased results say Turned in and render no score/overlay panels; keep photos and history available.
- [ ] Restore focus on dialog completion, keep form labels/invalid states accessible, and check phone-width behavior.
- [ ] Run ESLint, TypeScript, a production build, and the signed-in manual QA matrix from the approved spec. Commit the UI and documentation.

## Task 6: Research export and calibration compatibility

**Files:** Modify `research/export_dataset.py`, `research/analyze_correlations.py`, `training/stage2_calibrate.py`, their READMEs, and backend research tests.

**Interfaces:** Exported measurement/crop records add `return_reason` and `is_active_attempt`. Analysis and Stage 2 loaders exclude wrong worksheet, blurry/cropped, and wrong target text returns by default; an explicit offline opt-in includes them. Missing flags preserve old-export behavior.

- [ ] Write failing exporter tests that retain scored returns, exclude incomplete pairs, and independently flag an inactive pair when its active successor lacks manual scoring.
- [ ] Write loader/filter tests for the three excluded reasons, included incomplete/other returns, old CSVs, and explicit opt-in.
- [ ] Fetch completed/returned submissions and active IDs through the authorized exporter; keep names/notes/points out of output. Apply flags to both measurement and crop records.
- [ ] Filter analysis/training inputs before calibration while retaining source export rows. Do not execute exports against hosted data or run training as part of implementation.
- [ ] Run research tests, Ruff, and CLI-help smoke checks; commit the deliverable.

## Task 7: Review, verification, and release evidence

**Files:** Update `.github/workflows/ci.yml`, generated contracts, promoted docs, the Phase 3 proposal, and `IMPLEMENTATION_STATUS.md`.

- [ ] Request independent review using the approved spec and the feature diff. Fix material authorization, migration, concurrency, contract, and UI findings.
- [ ] Run Ruff, ESLint, TypeScript, affected unit/research tests, production frontend build, and the full backend suite on the ephemeral migrated stack.
- [ ] Generate database types from that stack and OpenAPI types from the final schema; verify no generated drift.
- [ ] If local containers remain unavailable, obtain migration/RLS/full-suite/type evidence in CI on this feature branch. Record any missing verification accurately; never point resets at hosted dev/prod.
- [ ] Complete signed-in manual QA for teacher Return/release/pin/due and parent draft/resubmit/released/history flows, including siblings and mobile controls.
- [ ] Update promoted docs and tracker with dated test/manual evidence; count the slice only after all verification gates pass. Keep merge/deployment separate from local completion.

## Plan review

The tasks cover the approved design's lifecycle, selection, backfill, release privacy, deadline, concurrency, portal, research, and verification contracts. The Return barrier and parent upload response are explicitly tested. No later-slice data fields or notifications are introduced. Follow the actual generated-type paths under `frontend/types/`.
