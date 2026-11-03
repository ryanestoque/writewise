# Phase 3 Slice 3 — In-app notifications implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the linked spec and this entire plan before execution.

**Goal:** Give teachers and parents private, durable in-app notifications for coursework events and deadlines, with a shared bell and links to the correct child, activity, and attempt.

**Architecture:** Existing authorized FastAPI writes call service-only Postgres RPCs; those transactions also insert deduplicated notifications. A private SQL sweep scheduled by pg_cron emits deadline events. Browser reads remain RLS-protected; TanStack Query polls every 60 seconds, and FastAPI owns read-state mutations.

**Tech Stack:** Existing FastAPI/Pydantic v2, Supabase Postgres 17/PostgREST/pg_cron, Next.js 16/React 19, TanStack Query 5, installed Base UI shadcn primitives, Supabase CLI 2.115.0, pytest/asyncpg, Ruff/ESLint/TypeScript. No new application dependency or frontend test framework is planned.

**Spec:** [Slice 3 notification design](../specs/2026-11-02-phase3-in-app-notifications-design.md). The user requested this planning pass on 2026-11-03. The detailed design is the working basis; this document does not claim separate design sign-off or authorize application implementation.

**Baseline:** `d67576f` on `feat/phase3-in-app-notifications`, based on `13cea31` (`main`, merged Slice 2). All task boxes below start unchecked. Only planning documents are changed by this planning pass.

**Execution record (2026-11-03):** The user requested execution with the executing-plans skill. Work starts from the published plan commit `e15df4c`, isolated in `.worktrees/phase3-in-app-notifications` on `feat/phase3-notifications-implementation`; the original planning checkout is preserved. Existing database-free unit baseline: 66 passed with one upstream Starlette/TestClient deprecation warning; backend Ruff, frontend ESLint, and TypeScript passed. Installed dependencies are reused through local directory junctions. Docker/Podman commands, the Docker engine pipe, and the standard Docker Desktop executable are absent. The Supabase CLI bootstrap through npm was denied network/cache access in the sandbox; no hosted database was contacted. Task 1 tests and its CI branch trigger are prepared, but no new database test has run and no migration or application implementation has been written. The user has been asked whether to authorize GitHub CI pushes for the ephemeral database verification or supply a local container runtime. This prerequisite remains open; no execution checkbox is complete.

**Execution update (2026-11-03):** The user authorized GitHub CI's ephemeral stack and feature-commit pushes to `ryanestoque/writewise`. [Initial CI run](https://github.com/ryanestoque/writewise/actions/runs/41486464310) on `dafc89e` proves the initial red state: 429 existing tests passed and all 9 new storage tests failed on the absent notification relation/private helpers. Task 1 schema implementation follows this evidence. While CI provisioned the stack, independent Task 5 real-route/SDK tests were run red locally before implementing routes; the database-free suite then passed 73 tests. One fixture was corrected to include PostgREST's required `hint` error field. A missing-authentication regression proved the existing bearer failure was incorrectly normalized as `INTERNAL_ERROR`; the shared bearer now emits `UNAUTHORIZED`, preserving the HTTP challenge header. Database receipt RPCs and full Task 5 verification remain pending.

**Implementation checkpoint (2026-11-03):** Tasks 1–8 are implemented on `feat/phase3-notifications-implementation`; Task 9's upgrade proof, contracts and review are prepared. [Storage/event red run](https://github.com/ryanestoque/writewise/actions/runs/41488226329): 448 passed, 16 failed on missing later RPC/emission behavior (plus a corrected generated-score fixture). [Release red run](https://github.com/ryanestoque/writewise/actions/runs/41490582078): 463 passed, one absent-release-emitter failure. [Race run](https://github.com/ryanestoque/writewise/actions/runs/41494149833): 473 passed, two reproduced concurrent-roster failures. The reviewed correction skips metadata fanout and compares explicit target edits against one frozen roster snapshot; final CI is pending. Generated DB types were downloaded from CI and included with the schema commits; the final workflow checks both API and DB drift, three upgrade proofs, security advisors and the full suite.

**Review and local evidence (2026-11-03):** Focused database and frontend reviewers found no remaining blocking issue after corrections. Controlled SDK/source checks first reproduced, then passed fixes for exact-token account switching and pagination racing a poll. Feed checks covered 20 → 40 retained rows, 25 new arrivals, ties/microseconds/timezone offsets, deletion and read changes. Whole backend Ruff, whole frontend ESLint/TypeScript and 73 database-free tests passed. The production webpack build passed with dummy localhost settings. These are controlled checks, not a signed-in portal walkthrough; browser discovery returned no connected browser. Manual role/sibling/mobile/keyboard/network QA remains open and Slice 3 stays **Implemented, verification pending (2/6 verified)**.

**Execution refinements:** Real route tests exercise response contracts directly; no separate model-mirroring `test_notification_contracts.py` was added. The private `assigned_activity_students(target_activity uuid, roster jsonb default null)` helper uses a frozen roster only for target edits and the live roster for cron. The public JWT-scoped `is_assigned` helper is unchanged. Read requests verify the exact bearer token they send and abort on account changes. Pagination cancels the competing feed fetch, reconciles the whole new coverage window, then resumes polling. Fault-injection tests cover assignment and each lifecycle mutation; they await final CI. Related commits were grouped by dependency rather than the illustrative per-task commit subjects below. Historical execution paragraphs above describe their checkpoints, not current pending work.

**Automated verification closeout (2026-11-03):** [PR CI on `a13098a`](https://github.com/ryanestoque/writewise/actions/runs/41500638054) completed successfully: **481 passed**, three upgrade proofs, generated API/database drift checks, Ruff/ESLint/TypeScript and security advisors. This includes all five event rollback paths, both roster race corrections, activity-deadline/override edits committed before the sweep lock, and a second parent's retry in the same Return cycle. An earlier final run had 478 passed and one rejection fault-test setup failure: its raw owner session lacked the service JWT context expected by `is_assigned`; transaction-local claims now match the real SDK request. Review also caught and fixed fixture teardown ordering so second-parent uploads are deleted before Auth cleanup. Both reviewers' final focused rechecks found no remaining blocking issue. No application change was needed for these fixture corrections.

**Remaining gate:** Signed-in teacher/parent, sibling, desktop/mobile, keyboard/focus, network/polling and exact-destination QA is unperformed because no connected browser was available. The unchecked manual items below remain open; controlled SDK checks are explicitly distinguished from that walkthrough. [Draft PR #6](https://github.com/ryanestoque/writewise/pull/6) contains the implementation and verification report. The worktree/branch are preserved, hosted migrations/deployment are untouched, and the tracker remains **2/6 verified**.

**User-reported verification closeout (2026-11-03):** After receiving local env/setup instructions and the manual portal checklist, the user reported the slice was all good. That overall sign-off closes the manual gate and supersedes the pending-gate record above; no itemized or independently observed browser walkthrough is claimed. [CI on final documentation head `d578116`](https://github.com/ryanestoque/writewise/actions/runs/41502563699) completed successfully. Slice 3 is **Verified**, Phase 3 is **3/6 verified**, and Slice 4 email notifications is next. PR #6 remains open/draft and unmerged; retain the worktree and local env files. Integration and hosted deployment are separate steps.

**Assignment lookup adjustment:** Inspection shows `public.is_assigned` deliberately requires JWT identity/service context; a cron-owner SQL connection has no JWT and would receive false. Tasks 2/4 therefore share a private security-invoker assignment lookup using the existing roster/section/direct-target rules, with no browser grants. The public auth-scoped helper and browser policies remain unchanged. Fixed-clock tests run directly as database owner without JWT to cover this distinction.

## Global Constraints

- “Browser reads use Supabase RLS; FastAPI authorizes read-state writes.”
- “Parents receive notifications across all linked children; the selected child does not filter the bell.”
- “Notification rows contain identifiers and event/read timestamps, with a deduplication key, rather than copied names, titles, scores, notes, or image paths.”
- “No notification email is sent by Slice 3.” Email outbox/preferences/Resend/Vault/pg_net, points/excused work, gradebook, and comments stay in later slices.
- “Use opaque IDs and UTC epoch microseconds for timestamp components, preserving PostgreSQL timestamp precision.”
- “Notification insertion failure rolls back the containing activity/lifecycle mutation.”
- “Repeated release of an already released result emits nothing and retains its original timestamp.” Redraft and genuine re-release can notify again.
- “A rejected retry must not tell the teacher that a resubmission has succeeded.”
- “A generic history dialog without selecting the targeted attempt does not satisfy the link.”
- “Mark Slice 3 Verified only with actual check results and portal sign-off; track deployment separately.”
- Preserve `active_submission` selection, draft-result RLS, persisted rejections, image hardening, research exports, ScoreProvider calculations, one FastAPI service, and one Uvicorn worker.
- SQL migrations are the schema source of truth. Never edit applied historical migrations. Regenerate actual `frontend/types/database.ts` after every migration and `frontend/types/api.ts` after API changes; commit generated contracts with their changes.
- Run resets/integration/security tests only against an ephemeral localhost stack. Preserve both existing legacy upgrade proofs and the test bootstrap's localhost guard. Do not print credentials or reset hosted dev/prod.
- During execution, apply the Supabase/Postgres, TDD, React, shadcn, review, and verification skills where applicable. The planning pass itself does not start implementation, install dependencies, run migrations, publish, or deploy.

## File map and contracts

Planned migration versions below are reserved for this branch. Before implementation, confirm they remain later than the repository's migration head and unused; if the branch baseline has advanced, allocate new increasing versions and update this plan's paths. Existing migration SQL stays untouched.

| Unit | Files | Responsibility |
|---|---|---|
| Storage and shared emitters | `supabase/migrations/20261103010000_phase3_notification_store.sql` | Enum/table/RLS/indexes, private delivery records, and insert/fan-out helpers |
| Assignment events | `supabase/migrations/20261103010001_phase3_notification_assignments.sql` | Replace `update_assigned_activity` with before/after assignment-set comparison; retain `create_assigned_activity` delegation |
| Submission events | `supabase/migrations/20261103010002_phase3_notification_lifecycle.sql` | Extend Return/release/record/complete RPCs without changing signatures |
| Deadlines | `supabase/migrations/20261103010003_phase3_notification_deadlines.sql` | Fixed-time sweep, production entry, pg_cron registration |
| Read-state transactions | `supabase/migrations/20261103010004_phase3_notification_reads.sql` | Service-only recipient-scoped single/all-read RPCs |
| Public API | `backend/app/api/notification_contracts.py`, `notifications.py`; `app/main.py` | Typed responses, verified identity, ownership precheck, error mapping, router |
| Database proofs | `backend/tests/rls/test_notifications.py`, `test_notification_events.py`, `test_notification_deadlines.py`; `tests/rls/conftest.py`; `tests/conftest.py` | Real authenticated reads, denied writes, atomicity, scheduler concurrency, paused wall-clock job |
| Route proofs | `backend/tests/unit/test_notification_contracts.py`, `test_notification_routes.py` | Real routes/SDK with controlled HTTP transport; no database bootstrap |
| Upgrade proof | `backend/tests/migrations/notification_upgrade_check.py`; `.github/workflows/ci.yml` | Synthetic pre-Slice-3 data, no historical replay, preserved results, one cron job |
| Browser data | `frontend/lib/notifications/data.ts`, `presentation.ts`, `query-keys.ts`; `frontend/lib/hooks/use-notifications.ts` | Generated row types, keyset/window reads, batched labels, destinations/copy, polling/read mutations |
| Shared UI | `frontend/components/notifications/notification-bell.tsx`, `notification-list.tsx`, `notification-row.tsx` | Focusable bell, account count, feed, pending/read/error states |
| Portal wiring | Teacher/parent `layout.tsx`; `teacher-header.tsx`, `parent-nav.tsx`, `parent-portal-provider.tsx`, `teacher-sidebar.tsx`; `use-activities.ts`, `use-activity-work.ts`, `use-submissions.ts` | Verified account ID, immediate invalidation, sign-out cleanup |
| Parent destination | `frontend/components/parent/notification-work-destination.tsx`; parent `progress/page.tsx`, `progress-content.tsx`; `parent-portal-provider.tsx`; `frontend/lib/hooks/use-parent-data.ts` | Validated URL, sibling selection, historical activity/exact attempt, current release rules |
| Contracts and docs | `frontend/types/database.ts`, `api.ts`; promoted docs, proposal, tracker | Generated contracts and evidence-based feature documentation |

Private SQL interfaces shared by Tasks 1–4:

```sql
writewise_internal.put_notification(
  recipient uuid, event_type public.notification_type,
  work_activity uuid, work_student uuid, target_submission uuid,
  event_key text
) returns uuid;
-- Returns inserted ID, or NULL on dedupe conflict. Validates submission/work consistency.

writewise_internal.notify_work_parents(
  event_type public.notification_type, work_activity uuid, work_student uuid,
  target_submission uuid, event_identity text
) returns integer;
-- DISTINCT current linked parents; key = type:activity:student:recipient:event_identity.

writewise_internal.notification_epoch_us(value timestamptz) returns text;
-- Exact numeric epoch microseconds, independent of session timezone.

writewise_internal.enqueue_time_based_notifications_at(as_of timestamptz) returns integer;
writewise_internal.enqueue_time_based_notifications() returns integer;
-- Private testable sweep and zero-argument cron entry; inserted-row count.
```

Public read-state RPCs produced by Task 5:

```sql
public.mark_notification_read(actor_id uuid, target_notification_id uuid) returns jsonb;
-- {id, read_at}; WW404 if absent/foreign, including a deletion race.
public.mark_all_notifications_read(actor_id uuid) returns jsonb;
-- {updated_count, read_at}; one database cutoff, no recipient supplied by client.
```

## Task 1: Notification storage, private helpers, and recipient-only reads

**Files:** Create the store migration and `backend/tests/rls/test_notifications.py`; extend `backend/tests/rls/conftest.py` to expose existing `parent`/`other_parent` identity IDs and a `second_parent` fixture. Regenerate `frontend/types/database.ts`.

**Interfaces:** Consumes existing `family` and `assigned_activity` fixtures. Produces the enum/public table/private delivery table and all three shared insertion/key helpers above. `second_parent` yields `{id, client}` for another authenticated parent linked to `family['students'][0]`, and removes that link/account on teardown. New test data is scoped to the function's activity.

- [x] Inspect branch/worktree state before execution; use the git-worktree skill if isolation is needed, preserving the existing checkout and user files. Discover CLI commands with `supabase --help`, `supabase db --help`, and `supabase migration --help`. Use `docs/TESTING.md` §3.1.1 for localhost setup and baseline checks. If no container runtime is available, record that limitation and arrange an authorized CI execution path before claiming database verification.
- [x] Write a failing RLS test that inserts two notices with the service fixture, then reads with signed-in anon-key clients. Add negative SELECT-count, INSERT/UPDATE/DELETE, foreign embedded relation, and private/public helper EXECUTE cases. Example assertion:

```python
def test_parent_sees_only_own_notifications(family, assigned_activity):
    from uuid import uuid4
    from app.core.supabase import supabase_client as admin

    activity = assigned_activity['id']
    rows = []
    for recipient in (family['parent'], family['other_parent']):
        rows.append({
            'recipient_id': recipient, 'type': 'activity_assigned',
            'activity_id': activity, 'student_id': family['students'][0],
            'dedupe_key': f'fixture:{uuid4()}',
        })
    inserted = admin.table('notification').insert(rows).execute().data
    own = family['parent_client'].table('notification').select('id').in_(
        'id', [row['id'] for row in inserted]
    ).execute().data
    own_id = next(row['id'] for row in inserted if row['recipient_id'] == family['parent'])
    assert own == [{'id': own_id}]
```

- [x] Run `uv run pytest tests/rls/test_notifications.py -q` on the pre-feature ephemeral stack and record the missing-relation failure.
- [x] Create the enum/table with required recipient/activity/student references, nullable submission reference, `read_at`, `created_at`, and unique `dedupe_key`. Add cascade FKs and the submission-kind constraint:

```sql
check ((submission_id is not null) = (type in (
  'submission_returned', 'submission_rejected',
  'score_released', 'resubmitted_after_return'
)))
```

  Add `(recipient_id, created_at desc, id desc)`, unread-recipient partial, and activity/student/submission lookup indexes. Revoke PUBLIC/anon/authenticated privileges; grant authenticated SELECT and explicit service SELECT/INSERT/UPDATE/DELETE. Enable RLS with recipient SELECT only:

```sql
create policy notification_recipient_select on public.notification
for select to authenticated
using (recipient_id = (select auth.uid()));
```

- [x] Create private `writewise_internal.notification_delivery(dedupe_key text primary key, recipient_id uuid not null, activity_id uuid not null, student_id uuid not null, created_at timestamptz not null default now())`, with cascading FKs to auth user/activity/student and lookup indexes for those FK paths. Revoke PUBLIC/anon/authenticated access, enable RLS with no browser policies, and explicitly grant service_role the required privileges. It has no submission FK: delivery evidence survives attempt deletion, while deleting its recipient/activity/student removes it. This resolves the design's deletion/retry conflict without changing public notification cascade behavior.
- [x] Implement the shared helpers as security-invoker functions with `set search_path = ''` and qualified names. `put_notification` rejects a mismatched submission/activity/student before claiming a delivery key. Fan-out calls it for distinct current `student_parent.parent_id` values in ID order. Revoke helper EXECUTE from PUBLIC/anon/authenticated; grant only service_role, retaining schema isolation. Claim delivery and insert the notice in one transaction; a notice failure must roll back the claim. The critical insert/key expressions are:

```sql
insert into writewise_internal.notification_delivery(dedupe_key, recipient_id,
  activity_id, student_id)
values (event_key, recipient, work_activity, work_student)
on conflict (dedupe_key) do nothing;
-- In PL/pgSQL, return NULL immediately when this INSERT did not set FOUND.

insert into public.notification(recipient_id, type, activity_id, student_id,
  submission_id, dedupe_key)
values (recipient, event_type, work_activity, work_student,
  target_submission, event_key)
on conflict (dedupe_key) do nothing
returning id;

-- notification_epoch_us uses NUMERIC arithmetic, not float/rounded seconds:
select trunc(extract(epoch from value) * 1000000)::text;
```

- [x] Add real-SQL assertions for duplicate insertion, claim rollback on notice failure, mismatched submission rejection, distinct microsecond keys/equivalent timezone instants, multi-parent fan-out, and cascade cleanup. Prove a submission deletion removes its public notice but preserves the private delivery key; deleting the recipient/activity/student removes both. Use `asyncpg` via `SUPABASE_DB_URL` for private helper calls, not a new browser-exposed RPC.
- [x] Replay migrations; rerun the RLS module, required lint/type checks, and full ephemeral backend suite. Generate database types with `supabase gen types typescript --local` into `frontend/types/database.ts` using UTF-8 output. Commit migration/tests/generated types together: `feat: add private notification storage`.

## Task 2: Assignment-change events in the existing transaction

**Files:** Create `20261103010001_phase3_notification_assignments.sql` and `backend/tests/rls/test_notification_events.py`; extend existing assignment rollback tests as needed; regenerate database types.

**Interfaces:** Consumes `notify_work_parents` and the existing `update_assigned_activity(actor_id, target_activity_id, payload)` signature/JSON response. Produces assignment notifications without changing API payloads or adding a roster/link emitter.

- [x] Add a failing assignment test using existing fixtures and a second linked parent. Filter counts by activity/student/type so notifications from fixture creation do not corrupt lifecycle assertions:

```python
def test_equivalent_target_edit_does_not_repeat_assignment(family, assigned_activity):
    from app.core.supabase import supabase_client as admin

    activity = assigned_activity['id']
    before = admin.table('notification').select('id').eq(
        'activity_id', activity
    ).eq('type', 'activity_assigned').execute().data
    admin.rpc('update_assigned_activity', {
        'actor_id': family['teacher'], 'target_activity_id': activity,
        'payload': {'assignments': assigned_activity['assignments']},
    }).execute()
    after = admin.table('notification').select('id').eq(
        'activity_id', activity
    ).eq('type', 'activity_assigned').execute().data
    assert before
    assert {row['id'] for row in after} == {row['id'] for row in before}
```

- [x] Run `uv run pytest tests/rls/test_notification_events.py -q`; before emitters, the nonempty assertion must fail.
- [x] Replace only the current update RPC in the new migration, preserving validation, authorization, lock acquisition, field omission/null semantics, response shape, and grants. For an explicit target edit, capture one owned roster snapshot after the activity lock, then compare both target sets using `writewise_internal.assigned_activity_students(target_activity_id, roster_snapshot)`. Skip fanout when assignments are omitted. Creation delegates with an empty pre-set. Do not use the JWT-scoped public helper in a service/cron session. The original browser-context set-selection sketch was:

```sql
select coalesce(array_agg(st.id order by st.id), '{}'::uuid[])
from public.teacher_student ts
join public.student st on st.id = ts.student_id
where ts.teacher_id = actor_id
  and public.is_assigned(target_activity_id, st.id);
```

- [x] For post-set IDs absent from the pre-set, call `notify_work_parents('activity_assigned', activity, student, null, transition_id::text)`. Generate one `gen_random_uuid()` transition ID only when the difference is nonempty. Keep inserts in the same transaction; no exception suppression or Python post-write side effect.
- [x] Add and run cases for creation, siblings, second parent, overlapping section/direct targets, metadata-only edits, empty/foreign target validation, remove/re-add, and retrying the same PATCH. Verify section joining/moving and parent linking change visibility without creating `activity_assigned` events.
- [x] Prove rollback by using a temporary test-transaction trigger on `notification` that raises SQLSTATE `XX000`; call the update/create function inside a nested transaction and confirm both targets/activity and notification rows remain unchanged afterward. Remove fault injection with transaction rollback, never leave a permanent test trigger in migrations.
- [x] Run assignment/RLS regressions plus the full ephemeral suite, regenerate types, and commit: `feat: notify parents of new activity assignments`.

## Task 3: Return, rejection, release, and successful-resubmission events

**Files:** Create `20261103010002_phase3_notification_lifecycle.sql`; extend `test_notification_events.py`, `test_submission_lifecycle.py`, and existing upload API tests; regenerate database types.

**Interfaces:** Consume the Task 1 helpers. Preserve signatures/JSON/SQLSTATE contracts of `mutate_student_work`, `record_student_submission`, and `complete_student_submission`. `release_activity_results` continues delegating to the single-release branch, so it needs no parallel emitter.

- [x] Write failing cases for each event using existing lifecycle fixtures/RPCs. A duplicate-release case must count events, rather than infer success from an unchanged release timestamp:

```python
def test_release_retry_emits_once(family, assigned_activity, attempts):
    from app.core.supabase import supabase_client as admin

    parameters = {
        'actor_id': family['teacher'], 'target_activity_id': assigned_activity['id'],
        'target_student_id': family['students'][0], 'operation': 'release',
        'payload': {'submission_id': attempts[-1]['id']},
    }
    admin.rpc('mutate_student_work', parameters).execute()
    admin.rpc('mutate_student_work', parameters).execute()
    rows = admin.table('notification').select('recipient_id').eq(
        'submission_id', attempts[-1]['id']
    ).eq('type', 'score_released').execute().data
    assert rows == [{'recipient_id': family['parent']}]
```

  The existing `attempts` fixture currently lives in `test_submission_lifecycle.py`; move it verbatim into `tests/rls/conftest.py` when sharing it, removing its old definition. Do not import one test module from another.
- [x] Run the new event cases and observe absent-event failures before editing RPC definitions.
- [x] In the Return branch, call parent fan-out after the successful status update using the returned submission ID as event identity. Preserve all current Return metadata and historical/pin behavior. A failed Return emits nothing.
- [x] In `record_student_submission`, after inserting a rejected row, emit `submission_rejected` only when the trusted stored `uploader_role` is parent, targeting only `actor_id`. Use the inserted submission ID in the key. Processing rows and teacher rejections emit nothing. Preserve upload hardening order, accepted timestamp, persisted rejected row, and 422 API envelope.
- [x] In the release branch, capture whether `released_at` was null before the update; only that transition fans out. Use `submission_id || ':' || notification_epoch_us(released_at)` as identity. Identical release retries keep their stamp; manual-score changes still redraft. Test genuine re-release in a separate committed transaction so its timestamp can differ.
- [x] In completion, keep activity-before-work locks and all reauthorization. Capture pre-completion active ID and newest returned upload ID ordered by `(created_at desc, id desc)`. Complete the row; reread `active_submission`. Emit to `activity.created_by` only when the stored uploader is parent, the pre-active ID is null, the Return barrier exists, and the post-active ID equals the completed row. Key by that Return barrier and teacher; `submission_id` points to this successful attempt.
- [x] Cover rejected/abandoned retries then success, ordinary first upload, teacher upload, explicit pin, newer active work, equal upload timestamps, repeated completion, deletion/retry within the same Return cycle, and a later Return cycle. Verify dedupe even when a retry arrives under a different parent account.
- [x] Add atomic rollback fault-injection cases for Return/release/rejection/completion. Add real-route parent rejection and successful parent response regressions, plus a stale-release-notification case proving redrafting still hides both score tables/diagnostics.
- [x] Run `uv run pytest tests/rls/test_notification_events.py tests/rls/test_submission_lifecycle.py tests/api/test_submissions_parent.py -q`, then the full ephemeral suite; regenerate types and commit: `feat: notify coursework lifecycle events`.

## Task 4: Deterministic deadline sweep and one scheduled job

**Files:** Create `20261103010003_phase3_notification_deadlines.sql`, `backend/tests/rls/test_notification_deadlines.py`; modify `backend/tests/conftest.py`; regenerate database types.

**Interfaces:** Produce both private sweep signatures in the file-map contract. Consume exact effective due, `active_submission`, current roster/assignment, and the shared key helper. Return actual inserted-row count, not candidate count.

- [x] Write a failing fixed-clock test. Use direct `asyncpg` connections from the existing localhost-only `SUPABASE_DB_URL`; private functions stay outside PostgREST:

```python
def test_repeated_due_sweep_is_idempotent(family, assigned_activity):
    import asyncio
    import os
    from datetime import datetime, timezone
    import asyncpg
    from app.core.supabase import supabase_client as admin

    admin.table('activity').update({'due_at': '2030-01-02T12:00:00Z'}).eq(
        'id', assigned_activity['id']
    ).execute()

    async def exercise():
        connection = await asyncpg.connect(os.environ['SUPABASE_DB_URL'])
        try:
            stamp = datetime(2030, 1, 2, 0, tzinfo=timezone.utc)
            query = 'select writewise_internal.enqueue_time_based_notifications_at($1)'
            await connection.fetchval(query, stamp)
            await connection.fetchval(query, stamp)
        finally:
            await connection.close()

    asyncio.run(exercise())
    notices = admin.table('notification').select('id').eq(
        'activity_id', assigned_activity['id']
    ).eq('student_id', family['students'][0]).eq('type', 'due_soon').execute().data
    assert len(notices) == 1
```

- [x] Run the module before migration; observe missing-function failure. Provision pg_cron in the new migration using current installed extension/CLI capabilities, with failure propagated rather than hidden. Keep browser roles without cron/helper execution privileges.
- [x] Implement the fixed-time sweep with ordered per-activity locking, followed by a fresh eligibility query after the lock. Recheck unarchived state, current teacher roster, and `is_assigned`; exclude null due and any existing active attempt. Do not select historical-only pairs from `activity_work_state`. Do not create `student_work` rows for reminders.
- [x] Implement exact event boundaries and keys:

```sql
-- effective_due = coalesce(w.due_at_override, a.due_at)
-- due_soon: effective_due >= as_of AND effective_due <= as_of + interval '24 hours'
-- activity_missing: effective_due < as_of
-- identity: writewise_internal.notification_epoch_us(effective_due)
-- both activity modes; processing/rejected rows do not suppress reminders.
```

  Call parent fan-out inside the same sweep transaction. The zero-argument wrapper calls the fixed-time function with one captured database `now()`. No wall-clock parameter is exposed to a browser.
- [x] Register exactly one migration-owned job. Use a named schedule and test its name, command, frequency, and active state:

```sql
select cron.schedule(
  'writewise-deadline-notifications', '*/15 * * * *',
  'select writewise_internal.enqueue_time_based_notifications();'
);
```

  Verify re-registering the name replaces rather than multiplies it. Do not provision email/HTTP dispatch.
- [x] Add a session-autouse test fixture that checks `to_regclass('cron.job')`, captures this named job's original `jobid/active` state, pauses just that job using `cron.alter_job`, and restores the captured state in `finally`. Use `select cron.alter_job($1, active := false)` and restore its original boolean through the same API, as documented in the [upstream pg_cron reference](https://github.com/citusdata/pg_cron#altering-a-cron-job). Preserve other jobs and support earlier-schema upgrade phases where the table/job is absent. Tests assert registration while allowing the harness pause; restore-and-inspect proves the deployed active setting. Never disable the extension.
- [x] Add boundary/null/override tests, equivalent timezone/microsecond keys, changed/restored deadlines, completed/draft/released/pinned work, pending/rejected work, archive, section/target/roster changes, both modes, no stored work row, multiple recipients, and two concurrent sweeps. Coordinate separate asyncpg transactions to prove completion/deadline edits committed before the sweep lock affect its result; avoid sleeps as race synchronization.
- [x] Run scheduler/assignment/lifecycle modules and the full ephemeral suite, regenerate types, and commit: `feat: schedule deduplicated deadline notifications`. Explicitly record that excused suppression belongs to Slice 5, since no such field exists yet.

## Task 5: Authorized individual/all-read APIs and generated API contract

**Files:** Create `20261103010004_phase3_notification_reads.sql`, `backend/app/api/notification_contracts.py`, `notifications.py`, `backend/tests/unit/test_notification_contracts.py`, `test_notification_routes.py`; modify `app/main.py`; extend `test_notifications.py`; regenerate both frontend contracts.

**Interfaces:** Produce the two public service-only RPCs above and `NotificationReadResponse(id: UUID, read_at: AwareDatetime)`, `NotificationsReadAllResponse(updated_count: int >= 0, read_at: AwareDatetime)`. Routes are POST `/{notification_id}/read` and POST `/read-all` under `/api/notifications`.

- [x] Follow the existing real-route/SDK `httpx.MockTransport` pattern. Write failing route cases with controlled notification SELECT/RPC responses and the real `get_current_user` dependency overridden only for identity. Register the fixture as `notification_route_case` with fields `client`, `calls`, `owned`, `db_error`, and `actor_id` so tests remain independent of lifecycle fixtures. The transport asserts the actor and recipient filter before accepting any mutation.

```python
def test_foreign_read_never_starts_mutation(notification_route_case):
    case = notification_route_case
    case.owned = False
    response = case.client.post(
        '/api/notifications/44444444-4444-4444-4444-444444444444/read'
    )
    assert response.status_code == 404
    assert response.json()['error']['code'] == 'NOT_FOUND'
    assert not [call for call in case.calls if '/rpc/' in call['path']]
```

- [x] Run `uv run pytest --confcutdir=tests/unit tests/unit/test_notification_routes.py -q` with explicit dummy localhost test settings; observe missing contracts/routes. Contracts are covered through real responses rather than a separate mirrored declaration test. Keep imports from triggering root `tests/conftest.py`.
- [x] Implement typed responses and routes using `Depends(get_current_user)` and its verified `sub`, independent of role metadata. Individual precheck selects by both ID and recipient. The RPC repeats recipient restriction and raises `WW404` on a race; map it to 404 `NOT_FOUND`, all other database errors to generic 500 `INTERNAL_ERROR`. Do not expose DB prose or require a new role branch. Register `/read-all` before the UUID route and include the router in `main.py`.
- [x] Implement single-read with `read_at = coalesce(read_at, statement_timestamp())` and one-row return. Implement all-read with one captured cutoff, restricting `recipient_id = actor_id`, unread rows, and `created_at <= cutoff`; return changed-row count and cutoff. Preserve preexisting read timestamps. Revoke browser EXECUTE on both functions and explicitly grant service_role.
- [x] Add route cases for valid parent/teacher identities, missing/invalid token behavior, malformed UUID, empty all-read, spoofed recipient body/query being unused, already-read stability, foreign/missing/deleted rows, and raw database errors. Add real database cases for recipient scoping, replay no-op, one shared all-read timestamp, and an insert after the statement snapshot remaining unread.
- [x] Generate OpenAPI JSON from the final FastAPI app in explicit test/stub mode, then generate `frontend/types/api.ts` with the installed openapi-typescript runner; generate database types from the migrated local stack. Standard command shapes:

```powershell
# Backend cwd; test environment configured as documented in TESTING.md.
uv run python -c 'import json; from pathlib import Path; from app.main import app; target = Path("../.tmp/notifications-openapi.json"); target.parent.mkdir(parents=True, exist_ok=True); target.write_text(json.dumps(app.openapi()), encoding="utf-8")'
# Frontend cwd.
npx.cmd openapi-typescript ../.tmp/notifications-openapi.json -o types/api.ts
```

  Keep scratch output ignored; never edit generated schemas manually.
- [x] Run route/unit, notification RLS, whole frontend type/lint checks, and the full ephemeral backend suite. Commit migrations/API/tests/generated types together: `feat: add notification read-state endpoints`.

## Task 6: RLS feed queries, durable pagination, labels, and cache lifecycle

**Files:** Create `frontend/lib/notifications/data.ts`, `presentation.ts`, `query-keys.ts`, and `frontend/lib/hooks/use-notifications.ts`.

**Interfaces:** All application row fields come from generated types; no handwritten enum or API response duplicate. Define these exact shared names:

```ts
import type { Database } from "@/types/database";
export type NotificationRow = Database["public"]["Tables"]["notification"]["Row"];
export type NotificationCursor = Pick<NotificationRow, "created_at" | "id">;
export type NotificationLabels = {
  students: Record<string, string>;
  activities: Record<string, string>;
};
export type NotificationWindow = {
  rows: NotificationRow[];
  oldest: NotificationCursor | null;
  hasMore: boolean;
};
// data.ts, using the existing browser Supabase client type:
// readNotificationPage(client, userId, before: NotificationCursor | null)
//   -> Promise<NotificationWindow>
// readNotificationWindow(client, userId, through: NotificationCursor | null)
//   -> Promise<NotificationWindow>
// readNotificationLabels(client, rows: NotificationRow[]) -> Promise<NotificationLabels>
// query-keys.ts: notificationKeys.root = ["notifications"] as const;
// useNotificationCount(userId: string)
// useNotificationFeed(userId: string, open: boolean)
// useNotificationRead(userId: string), useNotificationReadAll(userId: string)
// invalidateNotifications(queryClient: QueryClient): Promise<void>
// presentation.ts: notificationHref(row, role: "teacher" | "parent"): string
// notificationCopy(type: NotificationRow["type"]): string
```

- [x] Adapt the feed fixture to controlled SDK HTTP responses with 45 synthetic notices, including tied timestamps, then 25 arrivals. Database RLS cases separately verify second-account isolation. This respects the no-frontend-suite convention and does not count as signed-in browser seeding/QA. No hosted production data was seeded.
- [x] Implement count as `.select('id', { count: 'exact', head: true }).eq('recipient_id', userId).is('read_at', null)` and throw on error. Unknown count stays unknown. Select feed by recipient, ordered by `created_at DESC, id DESC`; read 21 rows, return 20, and derive `hasMore` from the extra row.
- [x] Build keyset predicates from validated UUID/timestamp cursors only. Before-cursor means `(created_at < cursor.created_at) OR (created_at = cursor.created_at AND id < cursor.id)`. Include account ID, page size, coverage cursor, and any filter in query keys. No offset pagination or sibling filter.
- [x] Implement anchored refresh: remember the oldest loaded tuple as coverage. Poll from the newest page through that inclusive tuple using 20-row keyset pages; normalize unique IDs and order, update read states, and drop rows actually deleted/inaccessible. New notices expand the window rather than pushing previously loaded rows out. More than 20 arrivals must be bridged by additional pages. Load more advances coverage to the next page's oldest tuple. Keep the previous visible window while a new coverage query resolves, and preserve the old window on error. Initial load establishes its coverage once without a refetch loop.
- [x] Batch unique student IDs and activity IDs across visible rows, fetch both label sets concurrently via current browser RLS, and key label caches by account and sorted ID sets. Missing related data uses generic labels; a real fetch error gets a retry state. Do not add per-row requests, service hydration, or notification payload copies.
- [x] Implement read hooks with `getAuthToken(createClient())`, `handleApiResponse`, generated response types, and `error.code`. Invalidate count/feed after successful single/all reads. Use server-confirmed timestamps; do not silently retain an optimistic success after failure. Count polls every 60 seconds in foreground; feed refreshes while loaded, on focus, and when the bell opens. Cancel notification queries and remove their cache on auth sign-out/account change; ignore results from canceled old-account work.
- [x] Accept user-reported overall QA sign-off (2026-11-03) for this manual gate; individual observations were not independently recorded. Original acceptance checklist: Manually prove 20 → 40 loaded rows, then 25 new arrivals, a timestamp tie, one deleted loaded notice, and one read change in another tab: no lost retained row, duplicate ID, missing arrival, or wrong count. Sign out/in as another account and verify no prior cached row/label appears. Use browser network inspection to verify batched labels and foreground polling. Run ESLint/TypeScript and commit: `feat: add recipient-scoped notification queries`.

## Task 7: Shared accessible bell and portal integration

**Files:** Create the three `frontend/components/notifications/` files from the file map. Modify teacher/parent layouts, `teacher-header.tsx`, `parent-nav.tsx`, `parent-portal-provider.tsx`, `teacher-sidebar.tsx`, and mutation hooks listed in the map.

**Interfaces:** `NotificationBell({ userId, role }: { userId: string; role: 'teacher' | 'parent' })`; `NotificationList` consumes the Task 6 window/labels and read/load/retry actions; `NotificationRowItem` renders a real destination Link plus a separate mark-read button, avoiding a name collision with the generated row type. Header identity comes from the verified server Auth user.

- [x] Before composing UI, inspect installed `components.json` and primitives; run the project shadcn runner's `info` and `docs popover button badge scroll-area` commands and fetch returned documentation. Use the installed Base UI `render` API rather than assuming Radix `asChild`. Apply React guidance for parallel label reads, narrowly scoped subscriptions, and lazy loading of heavy attempt viewers.
- [x] Add the bell trigger, actual unread count in its accessible label, `99+` visual cap, PopoverTitle, Mark all read, semantic list, Load more, and explicit loading/empty/error/retry states. Keep widths safe at 320px; use existing semantic tokens and UI variants. The trigger composition must follow this installed API shape:

```tsx
<PopoverTrigger
  render={<Button variant="ghost" size="icon" aria-label={accessibleLabel} />}
>
  <Bell aria-hidden="true" />
</PopoverTrigger>
```

  `accessibleLabel` is built from count state, e.g. `Notifications, 7 unread`, or `Notifications, unread count unavailable`. Show unread text/indicator in addition to color; use exact timestamp labels and no scores, images, notes, or rejection details.
- [x] On row activation, close the popover and attempt the read mutation while allowing normal link navigation, including modified-click/new-tab behavior. A failed mutation shows neutral feedback and does not cancel navigation. Opening the popover alone marks nothing read. Disable only the pending read/all/load action; retain focus targets and keyboard close/return behavior.
- [x] Pass `user.id` from teacher layout to `TeacherHeader` and from parent layout through `ParentPortalProvider`/`ParentNav`; render one account-keyed bell per portal. Never derive notification authorization from the selected child or user metadata role. Auth-change cleanup from Task 6 covers successful sign-out; keep existing sign-out error behavior.
- [x] Add `invalidateNotifications` to successful assignment, upload/rejection, Return, and release paths. Rejected uploads return 422 after persistence, so upload `onError` must also invalidate when a structured rejection includes a `submission_id`; unrelated failures should not simulate a created notification. A teacher browser cannot invalidate a parent's separate cache: the 60-second poll is the cross-account refresh mechanism.
- [x] Accept user-reported overall QA sign-off (2026-11-03) for this manual gate; individual observations were not independently recorded. Original acceptance checklist: Do a manual desktop/mobile/keyboard pass for both roles, count above 99, empty data, list/read errors, read-all with unseen pages, scrolling/focus during polling, and unrelated account isolation. Run Ruff/ESLint/TypeScript and the production frontend build, then commit: `feat: add teacher and parent notification bells`.

## Task 8: Parent links to the exact child, activity, and attempt

**Files:** Create `frontend/components/parent/notification-work-destination.tsx`; modify parent `progress/page.tsx`, `progress-content.tsx`, `parent-portal-provider.tsx`, `use-parent-data.ts`, and `presentation.ts`. Reuse `pending-worksheet-dialog.tsx` and `worksheet-view-dialog.tsx` without weakening their release rules.

**Interfaces:** `ParentNotificationTarget = { childId: string; activityId: string; submissionId: string | null }`; `NotificationWorkDestination({ target, onClose })` consumes a validated target. Add `useParentNotificationWork(target)` in `use-parent-data.ts`, returning a discriminated loading/error/unavailable/ready result with RLS-visible activity, work state, and exact attempt. Use existing `StudentScoreHistoryItem` for a resolved attempt rather than a second score model.

- [x] Extend `notificationHref` with literal route outcomes, and use these as manual acceptance examples:

```text
teacher resubmission:
/activities/{activity UUID}/submissions/{successful submission UUID}
parent assignment/reminder:
/progress?child={student UUID}&activity={activity UUID}
parent Return/rejection/release:
/progress?child={student UUID}&activity={activity UUID}&submission={submission UUID}
```

  Parse all supplied IDs as UUIDs. A malformed supplied `submission` is invalid, not equivalent to an omitted submission. Construct only same-origin application paths.
- [x] Read URL intent through the existing server `progress/page.tsx` searchParams and pass serialized UUID strings to the client, or put a small `useSearchParams` reader under Suspense if needed. Keep URL updates/back/forward reactive; confirm with a production build. Do not spread search parameters into Supabase queries.
- [x] After `useLinkedChildren` resolves, verify the URL child belongs to the account before selecting it. If selection changes from a previous child, discard old destination data/actions immediately. Do not display the provider's default child while a different requested child's membership is unresolved. Unknown/unlinked targets show neutral unavailability and never fall back to a different child.
- [x] Query the exact activity and attempt with the browser client, filtering attempt by all three IDs. Query current assignment for upload eligibility separately from historical read permission. Use currently RLS-visible score rows and `released_at`; do not infer result access from notification type, a stale feed row, or a past release timestamp alone.
- [x] Implement a compact activity-work destination showing permitted title/instructions/effective due/Return metadata, then focus/open the exact requested attempt. Reuse the pending viewer when current score access is absent and the released viewer only with current RLS-visible released scores. Include in-class activities and historical submissions after reassignment. No implicit upload dialog; an explicit eligible take-home upload action may use the existing provider.
- [x] Keep the destination reachable even when the normal activity list is collapsed, the activity is outside its first two cards, or mobile Tasks is not active. Activity-only links reveal that work; submission links select the specific historical attempt, even if another result is latest. Closing removes only destination parameters and returns focus sensibly; reload/back/forward must reproduce the target.
- [x] Accept user-reported overall QA sign-off (2026-11-03) for this manual gate; individual observations were not independently recorded. Original acceptance checklist: Manually verify two siblings with the same teacher, direct reload, modified-click link, target older than the latest result, returned/rejected/unreleased/in-class/historical work, deleted submission, unlinked child, invalid/mismatched IDs, transient fetch error, and a previously released result redrafted before click. Confirm no cross-child flash or unreleased score/overlay appears.
- [x] Run ESLint/TypeScript/production build and backend release-privacy regressions. Commit: `feat: deep link parent coursework notifications`.

## Task 9: Upgrade proof, promoted contracts, review, and completion evidence

**Files:** Create `backend/tests/migrations/notification_upgrade_check.py` and `docs/adr/0005-transactional-notifications-and-scheduling.md`; modify CI, generated contracts, `docs/API_SPEC.md`, `DATABASE.md`, `DESIGN.md`, `PRD.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DEPLOYMENT.md`, `TESTING.md`, the Phase 3 proposal, and `IMPLEMENTATION_STATUS.md`. The ADR path follows the inspected `docs/adr/0001`–`0004` convention.

**Interfaces:** Upgrade script matches existing `prepare|verify --manifest PATH` CLI and localhost-only guard. It preserves a synthetic manifest of IDs, submission states, release timestamps, measurements/rubrics, and assignment visibility; contains no real user data.

- [x] Add prepare/verify code and a CI step following the existing two upgrade proofs. Prepare on the last Slice 2 migration with a parent-linked assigned activity and graded/released/returned historical work; migrate; verify zero replayed assignment/Return/release rows, unchanged result/visibility state, declared notification privileges, and one named scheduled job. After invoking new events, verify the first notices appear. Remove fixtures during cleanup and keep manifest files outside committed paths.

```bash
supabase db reset --local --version 20261102112156
# backend cwd, with test env captured from this local stack:
uv run python tests/migrations/notification_upgrade_check.py prepare --manifest /tmp/notification-upgrade.json
# repo cwd:
supabase migration up --local
# backend cwd:
uv run python tests/migrations/notification_upgrade_check.py verify --manifest /tmp/notification-upgrade.json
# repo cwd:
supabase db reset --local
```

  The bash paths above are CI commands; use a temporary directory under the workspace or OS temp directory in PowerShell. Retain the existing assignment and release upgrade steps. The reset baseline has no notification migration, so the sweep/cron pause harness must also tolerate its absence.
- [x] Extend CI branch triggers for the isolated implementation branch `feat/phase3-notifications-implementation`, the user-authorized verification route. Keep generated-type comparison/artifact, full pytest, security-advisor error gate, and `always()` stack teardown. Do not reinterpret CI as deployment.
- [x] Promote exact event/API/table/RLS/scheduler/copy/deep-link contracts to the docs. Record no new error codes unless a distinct final API contract requires one. Add `API_SPEC` endpoint descriptions and module wiring, an ADR for explicit transactional insertion/private scheduling/polling, and deployment instructions for inspecting/pausing the one named job. Document reminder first-sweep catch-up, archived exclusion, same-deadline dedupe, and the later Slice 5 excused predicate.
- [x] Capture controlled API-error logs and assert private database detail is absent from both logs and responses. Review SQL/event paths for copied child content and new logging: notification rows contain identifiers/timestamps only, no notification-specific logs were added, and research export contracts are unchanged. This combines a real error-boundary check with static privacy review; it does not claim a separate logged-event fixture for each content category.
- [x] Request a focused code review against the spec and feature diff using the available code-review skill. Cover recipient authorization/grants, rollback, concurrency, exact time boundaries, event semantics, feed preservation/cache cleanup, sibling routing, accessibility, generated types, and release privacy. Fix material findings and rerun their affected checks.
- [x] Run final Ruff, whole-frontend ESLint/TypeScript, production build, both existing upgrade proofs plus the new proof, generated-contract comparison, security advisors, and the full backend pytest suite on the ephemeral migrated stack. Use the installed-tool equivalents recorded in `TESTING.md` if wrappers hit existing PowerShell/cache restrictions. Missing local containers require recorded CI evidence; do not convert transport tests or lint into a database/RLS success claim.
- [x] Regenerate `frontend/types/database.ts` from the final migrated stack and `frontend/types/api.ts` from the final FastAPI schema, then verify regeneration produces no drift. Keep the generation in the same changeset as migrations/API work.
- [x] Accept user-reported overall QA sign-off (2026-11-03) for this manual gate; individual observations were not independently recorded. Original acceptance checklist: Complete and record manual QA: teacher, both linked parents, two siblings, desktop/320px mobile, keyboard/focus, exact/deleted/revoked targets, all read actions, foreground polling/retry, pagination under new arrivals, and stale release notifications. Record observed evidence separately from user-reported sign-off. A build/type check does not close the manual portal gate.
- [x] Update `IMPLEMENTATION_STATUS.md` with actual evidence. Keep Slice 3 at Implemented, verification pending until all required checks and portal QA pass; only then change Phase 3 from 2/6 to 3/6 verified. Keep deployment/hosted scheduler verification separate. Commit final docs/evidence with a Conventional Commit, and prepare a PR description naming Phase 3 proposal §8 Slice ③ and tests actually run when PR creation is authorized.

## Plan self-review and execution checkpoints

| Design requirement | Implementation owner | Required proof |
|---|---|---|
| IDs-only rows, recipient RLS, grants, cascade, durable dedupe | Task 1 | Signed-in SELECT/DML/helper-denial, atomic delivery-claim and schema tests |
| Assignment set differences/current participants | Task 2 | Creation, overlap, equivalent edit, re-add, roster/link no-event, rollback |
| Return/rejection/release/resubmission semantics | Task 3 | Event matrix, exact release identity, Return barrier/pin/retry and transaction proofs |
| Effective due/idempotency/re-arming/locks | Task 4 | Fixed-time, boundary, concurrency, assignment/archive and single-job proofs |
| Verified-identity mark read/all | Task 5 | Real routes/SDK, recipient DB predicates, timestamp/replay/snapshot cases |
| Account feed/count/labels/polling/cache | Task 6 | Tied timestamps, 25 arrivals, retained pages, cross-account/manual network checks |
| Accessible shared bell and immediate local refresh | Task 7 | Both role flows, errors/keyboard/mobile, persisted-rejection invalidation |
| Exact parent child/activity/attempt links | Task 8 | Siblings, historical/revoked/mismatched work and current release RLS |
| Upgrade compatibility/privacy/contracts/docs | Task 9 | Three upgrade proofs, generated types, advisors, full suite, portal evidence |

Review checkpoints occur after Tasks 1–3 (data/event semantics), Tasks 4–5 (time/API authorization), and Tasks 6–8 (portal behavior), before final closeout. No checkbox is completion evidence by itself. The planned helper/API/type names above are shared contracts; update consumers and this plan together if a name changes during implementation.

Planning self-review completed on 2026-11-03: every design section maps to tasks above and later-slice fields are excluded. Execution was subsequently requested; its dated evidence and remaining manual gates are recorded above.
