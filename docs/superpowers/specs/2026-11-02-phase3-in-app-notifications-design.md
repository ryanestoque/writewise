# Phase 3 Slice 3 — In-app notifications design

**Date:** 2026-11-02

**Status:** Execution requested by the user on 2026-11-03 through the executing-plans skill, using the published implementation plan and this design. Implementation/verification progress is recorded in that plan; this status does not claim the feature is implemented.

**Baseline:** `13cea31` on `main`, including merged Slice 2 PR #4. `IMPLEMENTATION_STATUS.md` records Slices 1–2 as verified and Slice 3 as not started.

**Scope source:** [Phase 3 proposal](../../next_steps/PHASE_3_CLASSROOM_ACTIVITIES.md), §2 Q6–Q8/Q10/Q19, §4.6–4.7, §5.1–5.2, §7, §8 Slice ③, and §9 Q-B/Q-C/Q-E. This specification resolves the Slice 3 details without promoting later-slice sketches into implemented contracts.

## 1. Outcome and scope

Teachers and parents have a header bell with an account-wide unread count, recent notifications, pagination, individual read actions, Mark all read, and links to the relevant activity or attempt. Parents receive notifications across all linked children; the selected child does not filter the bell.

The seven events in §4 are included. A database job checks deadlines every 15 minutes. Browser reads use Supabase RLS; FastAPI authorizes read-state writes. Notification rows contain identifiers and event/read timestamps, with a deduplication key, rather than copied names, titles, scores, notes, or image paths.

Email delivery, preferences, email outbox, Resend, Vault/pg_net dispatch, points, excused work, gradebook, and comments remain later slices. No notification email is sent by Slice 3. No CV/CNN algorithm, upload hardening, scoring formula, research export, worker count, or deployment topology changes are required.

## 2. Repository findings

1. `create_assigned_activity` delegates to `update_assigned_activity`, which locks the activity and replaces targets in one transaction. Notifications must compare effective assigned student sets around this mutation; per-target insert triggers would duplicate overlapping section/direct assignments and mistake unchanged target replacement for a new assignment.
2. `mutate_student_work`, `release_activity_results`, `record_student_submission`, and `complete_student_submission` are service-only RPCs. Extend those explicit mutation paths so event state and notification inserts commit together. A separate HTTP/REST insert after a successful mutation would lose notifications on a partial failure.
3. `record_student_submission` records both persisted rejections and processing attempts. Completion is separate, after measurement persistence. A rejected retry must not tell the teacher that a resubmission has succeeded.
4. `released_at` is preserved on repeated release, but corrected manual scores redraft the result. Deduplication must allow a new notification when that same attempt is genuinely released again.
5. `activity_work_state` includes both current assignments and historical submissions. Historical membership is useful for portals, but is insufficient for scheduler eligibility; reminders require a current assignment and current roster relationship.
6. `student_work` has deadline overrides and pins, but no `excused` column. Slice 3 uses existing fields. Slice 5 must add excused suppression when it introduces excused work.
7. Parent `/progress` currently uses provider-owned child selection and does not consume activity/attempt URLs. Deep links need explicit sibling selection and an activity/attempt destination; landing on the default child or only opening the upload composer is insufficient.
8. Both portal layouts already obtain a verified Auth user. Pass its opaque ID to notification hooks for account-scoped query keys. The read API needs verified identity only, not authorization based on user-editable role metadata.
9. CI already replays migrations, exercises both legacy upgrades, generates database types, runs the full backend suite, and gates security-advisor errors. Extend that coverage; preserve its localhost-only test guard.

## 3. Architecture and alternatives

**Recommended:** explicit event insertion inside the existing service-only RPCs, a small private SQL insertion helper, an SQL deadline sweep scheduled by pg_cron, and TanStack Query polling. FastAPI remains the only application write entry point; the RPC is the transaction boundary. Shared insertion logic centralizes deduplication and lets Slice 4 add email-outbox insertion later without sending email inside a mutation.

**Alternative: Python inserts after each existing RPC.** This keeps SQL smaller, but commits the event before the alert and introduces partial success and repair/retry requirements. Reject for this slice.

**Alternative: generic table triggers plus Realtime.** This catches low-level writes, but obscures business intent during target replacement, migration backfills, release retries, and incomplete uploads, and adds a second live-update mechanism. Prefer explicit emitters and 60-second polling (Q-E). Reconsider Realtime only after actual latency feedback.

## 4. Events, recipients, and deduplication

Resolve recipients from current database relationships inside the transaction. Fan out to every currently linked parent where specified. Each child has its own notification even when siblings share an activity. A parent linked after an event does not receive a historical replay.

| Event | Recipient | Emission rule | Stable event identity |
|---|---|---|---|
| `activity_assigned` | All linked parents of newly assigned students | On activity creation or an explicit target edit, compare distinct currently owned/assigned students before and after; notify only newly covered students | Activity + student + recipient + assignment-transition UUID |
| `submission_returned` | All linked parents of the submission's student | After a completed attempt successfully transitions to returned, including a permitted historical Return | Returned submission + recipient |
| `submission_rejected` | The parent uploader only | In the transaction that persists a quality-gate or post-segmentation rejection | Rejected submission + recipient |
| `score_released` | All linked parents of the submission's student | Only a null-to-non-null release transition; both single and bulk release use the same path | Submission + recipient + exact release timestamp |
| `resubmitted_after_return` | Activity owner | A parent attempt successfully completes, becomes active, and resolves an outstanding Return as defined below | Return barrier + teacher |
| `due_soon` | All linked parents of currently assigned students | Deadline sweep; no active attempt; effective deadline is between the sweep time and 24 hours ahead, inclusive | Activity + student + recipient + exact effective deadline |
| `activity_missing` | All linked parents of currently assigned students | Deadline sweep; no active attempt; effective deadline is strictly before sweep time | Activity + student + recipient + exact effective deadline |

Prefix every deduplication key with the event type. Use opaque IDs and UTC epoch microseconds for timestamp components, preserving PostgreSQL timestamp precision. A unique delivery-record claim plus `ON CONFLICT (dedupe_key) DO NOTHING` is authoritative under concurrent execution; the public notification also retains its unique key.

### 4.1 Assignment changes

Capture the pre-mutation set after acquiring the activity lock; compare it with the post-mutation set before returning. Creating an activity starts with an empty set. Overlapping section/direct targets yield one notification per recipient/student. Metadata-only edits and equivalent target replacement emit nothing. Removing then explicitly re-adding a student may notify again: one fresh transition UUID is generated only for an operation with newly covered students. Retrying an unchanged PATCH has an empty set difference and emits nothing.

Roster imports, joining/moving sections, and parent-link creation do not emit `activity_assigned` (Q-B). Assignment visibility still follows current sections (Q-C). These operations can affect future deadline sweeps. Existing activities/returns/releases are not replayed during migration.

### 4.2 Successful resubmission after Return

Use Slice 2's existing deterministic upload-order Return barrier and `active_submission`; do not invent a second active-attempt algorithm. Immediately before changing processing to completed, capture whether there is an active attempt and the latest Return barrier. After completion, notify only if there was no active attempt, there was a Return barrier, and this parent attempt is now active. A retained explicit pin or a newer active attempt prevents a false resubmission alert.

Rejected or abandoned processing retries do not satisfy the Return. A later successful retry can still trigger the event. Deduplication is per Return barrier and teacher, so multiple successful attempts or deletion/retry within that Return cycle do not repeat the alert. A later Return starts another cycle. Teacher uploads do not emit this parent-resubmission event. This clarifies the proposal's ambiguous phrase “previous latest submission was returned.”

### 4.3 Release and transaction behavior

Repeated release of an already released result emits nothing and retains its original timestamp. Redraft followed by a new release produces a new event using the new timestamp. The notification is a historical statement that a release occurred; it grants no access to results that have since been redrafted or returned. Current result RLS remains authoritative at the destination.

Notification insertion failure rolls back the containing activity/lifecycle mutation. Do not catch and suppress it or expose raw database errors to the client. Existing API error-envelope behavior remains in place. This does not turn image Storage and database processing into a distributed transaction; existing image persistence/cleanup boundaries remain unchanged.

## 5. Data and authorization contract

### 5.1 Notification table

Create `public.notification_type` with the seven Slice 3 values, and `public.notification`:

| Column | Contract |
|---|---|
| `id` | UUID primary key, generated by the database |
| `recipient_id` | Required UUID FK to `auth.users`, cascade delete |
| `type` | Required notification enum |
| `activity_id` | Required UUID FK to activity, cascade delete |
| `student_id` | Required UUID FK to student, cascade delete |
| `submission_id` | Nullable UUID FK to submission, cascade delete; required for submission-specific events, absent for assignment/deadline events |
| `dedupe_key` | Required unique text assembled by trusted database code |
| `read_at` | Nullable timestamptz; first read time |
| `created_at` | Required database timestamptz, default now |

All current event types have an activity and child, so those references are required rather than inheriting nullable sketch fields. Internal insertion validates that any referenced submission belongs to that same activity/student. Add a check constraint for which types require a submission.

Indexes: `(recipient_id, created_at DESC, id DESC)` for deterministic feed order; a partial index on unread `recipient_id`; and indexes on activity/student/submission FKs where not already covered by an index prefix, supporting cascade cleanup. Do not add a JSON payload or duplicate business data.

**Planning refinement (2026-11-03):** A successful-attempt deletion cascades its notification, so a key stored only on that notification cannot preserve §4.2's no-repeat rule for deletion/retry in one Return cycle. Add a private `writewise_internal.notification_delivery` record containing the unique dedupe key, recipient/activity/student IDs, and creation time. It cascades with those three owners, but has no submission FK, so delivery evidence survives attempt deletion. The insertion helper claims this key and inserts the public notification in one transaction; either both commit or both roll back. The private record has no browser privileges, no copied content, and no separate retention/job subsystem. Test deletion/retry against this record rather than assuming a vanished public row still enforces uniqueness.

### 5.2 Browser reads and trusted writers

Enable RLS. Revoke all table privileges from PUBLIC, anon, and authenticated, then grant authenticated SELECT only and grant the service role the explicit privileges its paths need. The SELECT policy is `TO authenticated USING (recipient_id = (SELECT auth.uid()))`. No browser INSERT/UPDATE/DELETE, including read state, and no unrestricted browser-callable emitter or scheduler RPC.

Place implementation helpers in the existing non-exposed `writewise_internal` schema; use `SECURITY INVOKER`, empty search paths, qualified names, and explicit EXECUTE grants. Public service-only wrappers retain the repository's pattern, with EXECUTE revoked from PUBLIC/anon/authenticated and granted only to service_role where needed. The cron owner executes the private scheduler directly. Do not add SECURITY DEFINER to work around missing grants.

Notification ownership is historical: unlinking a parent does not transfer or expose their rows to another account. Any remaining old row contains only the event identifiers. Resolve names/titles/attempt content separately through current RLS-protected reads; when access is gone, show generic copy and an unavailable destination. No service-role hydration endpoint is added. Deleting a referenced student/activity/submission or recipient cascades the corresponding notifications.

## 6. Deadline scheduler

Create `writewise_internal.enqueue_time_based_notifications()` as an atomic SQL/PLpgSQL sweep with a private implementation accepting an explicit `as_of timestamptz` for deterministic tests. The zero-argument production entry captures one database time for the entire sweep; neither function is browser callable.

For each unarchived activity in ascending activity-ID order, acquire the existing activity-row lock, then evaluate its current teacher roster and current assignments. Use `coalesce(student_work.due_at_override, activity.due_at)` and the existing active-attempt view. Do not materialize `student_work` rows just to send reminders. Exclude unassigned/historical-only work, missing roster relationships, null deadlines, and any active attempt, regardless of grading/release. Both in-class and take-home activities are eligible, matching the existing assignment/deadline scope. Parent-only upload closure does not suppress a missing notification.

Use the boundaries in §4: at the exact due instant work is due-soon, and becomes missing strictly afterward, consistent with Slice 2's status/acceptance boundary. Processing/rejected attempts do not count as completed work and therefore do not suppress reminders. At most one event of each deadline type is inserted per recipient/student/activity/deadline. Changing an override or activity deadline to a distinct instant permits a new pair; restoring an already-notified instant does not repeat it. Equivalent timestamps with different timezone offsets produce the same key.

Use the same activity-before-work lock order as existing lifecycle RPCs; deadline sweeps only need activity locks because application work mutations already acquire those locks first. Multiple sweeps use ascending activity order. Unique dedupe keys remain the final concurrency guard. A committed completion/deadline edit before a sweep's activity lock must be reflected in that activity's evaluation.

Install/enable pg_cron through a versioned migration and register one named job, `writewise-deadline-notifications`, with `*/15 * * * *`. Reapplying scheduling setup must replace that named job rather than create extras. Failure to provision pg_cron is a migration/test failure, not a silent fallback to an in-process timer. The first sweep evaluates current work, including overdue assigned work; only historical event backfill is excluded.

Migration and CI tests run the SQL function directly with fixed times and verify the job registration without waiting 15 minutes. Keep integration-test fixtures isolated from wall-clock cron runs (pause this job during deterministic tests and restore its state during cleanup). Document hosted-dev scheduling checks separately from local/CI proof. Slice 5 must extend eligibility to exclude excused work and test that exclusion when it adds the field.

## 7. Read-state API

Register a typed notification router under `/api/notifications`. Both endpoints use the existing verified Auth identity (`get_current_user`) and derive the actor from its `sub`; no body/query parameter can select another recipient, and neither route needs the user-metadata role claim.

| Endpoint | Success | Ownership and semantics |
|---|---|---|
| `POST /api/notifications/{notification_id}/read` | 200 `{ id, read_at }` | UUID path validation; application precheck by ID **and** recipient; transactional update rechecks recipient; nonexistent/foreign row yields the same 404 `NOT_FOUND`; preserve an existing `read_at` |
| `POST /api/notifications/read-all` | 200 `{ updated_count, read_at }` | Actor fixed to verified caller; mark their unread rows visible to this statement, with `created_at` no later than its database cutoff; preserve earlier read timestamps; count only changed rows |

Register the static `read-all` path before the parameterized path. Missing/invalid tokens follow `UNAUTHORIZED`; malformed identifiers use `VALIDATION_ERROR`; unexpected failures use `INTERNAL_ERROR`. Do not add new error codes unless implementation discovers a distinct contract requirement. Frontend branches on `error.code` only. No public notification-list API is needed because reads stay in Supabase under RLS.

## 8. Bell, feed, and destinations

### 8.1 Shared header component

Add a shared `NotificationBell` in the existing teacher header and parent navigation. Pass the verified opaque account ID from the server layouts through the existing provider/header props. Query keys include that ID and all feed filters/cursors; stop polling and clear notification-specific cached data on sign-out/account change. Switching children does not reset or filter the bell.

Use existing UI primitives and tokens: icon button, capped visual badge (`99+`) with the actual unread count in its accessible name, a bounded scrollable popover, and full-width mobile-safe sizing. The feed is newest first by `(created_at DESC, id DESC)`, loads 20 rows at a time using a matching keyset cursor, and has a Load more action. Query the exact unread count separately so the badge is not limited to the loaded page.

Poll the unread count and loaded feed every 60 seconds while the authenticated portal is foregrounded; refresh on focus and when opening the bell. Local event mutations and successful read writes invalidate relevant queries immediately. Do not reset pagination or duplicate previously loaded rows when polling inserts newer items. Resolve distinct child/activity labels in batched RLS-protected queries rather than one request per row.

Opening the bell does not mark everything read. Provide a per-row read action and Mark all read, with pending states and mutation errors. Activating a destination attempts to mark that notification read, but a failed mark-read request must not prevent navigation; show neutral error feedback and keep the count consistent with the server. Preserve cached content on polling failure, show a retry state, and never represent an unknown count as a confirmed zero.

Keyboard users can open/close the popover, move through ordinary links/buttons, and return focus to the bell. Use real links for destinations, semantic list markup, readable timestamps with exact-date labels, explicit loading/error/empty states, sufficient contrast and touch targets, and no meaning conveyed by unread color alone. Background polls must not steal focus or announce every feed refresh.

### 8.2 Deep links

Teacher resubmission alerts use the existing `/activities/{activity_id}/submissions/{submission_id}` route, which retains current authorization and missing-work handling.

Parent alerts use `/progress?child={student_id}&activity={activity_id}` plus `submission={submission_id}` for submission-specific events. Validate UUIDs and membership using RLS-visible data before selecting anything. After linked children load, select the specified linked child, then load that child's activity/history. Reveal the exact activity, including a card normally hidden by the collapsed list or mobile tab. For a submission event, open/focus the exact attempt in a small activity-work destination using existing pending/released worksheet viewers and current release gating. Activity metadata and permitted attempt history remain accessible for historical work after reassignment as in Slice 2; parent upload remains take-home/current-assignment only.

A generic history dialog without selecting the targeted attempt does not satisfy the link. Bad, deleted, unlinked, or inaccessible targets show a neutral “This work is no longer available” state without falling back to another child/attempt, automatically opening an upload, or retrieving protected data with the service role. Back/forward and direct/reloaded URLs work. Account for `useSearchParams`/Suspense requirements during the production build if that API is used.

### 8.3 Copy

Compose concise in-app text from event type and currently permitted labels: “New activity assigned,” “Activity due soon,” “Another attempt requested,” “Photo needs another upload,” “Result shared,” “Activity is missing,” and “New attempt after Return.” Use a generic child/activity label if the related RLS lookup returns nothing. No result values, teacher notes, rejection detail bodies, or worksheet thumbnails appear in bell rows or logs.

## 9. Implementation boundaries and documentation

| Area | Intended files |
|---|---|
| Schema/events/scheduler | New timestamped migrations in `supabase/migrations/`, extending existing activity and lifecycle functions; private notification helpers; enum, table, policies, indexes, and named job |
| FastAPI | New `backend/app/api/notifications.py` with typed request/response contracts; router registration in `app/main.py`; reuse verified identity and standard error mapping |
| Backend proofs | New notification route/unit, RLS/event/scheduler and upgrade tests; additions to existing assignment/lifecycle rollback cases |
| Frontend | New notification bell/hooks/helpers; teacher/parent layouts, header/nav/provider wiring; parent progress activity/attempt destination and URL handling; relevant mutation invalidation |
| Generated contracts | Regenerate actual `frontend/types/database.ts` and `frontend/types/api.ts` from migrated schema/OpenAPI, without hand-editing generated output |
| Promoted documentation | `docs/API_SPEC.md`, `DATABASE.md`, `DESIGN.md`, `PRD.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DEPLOYMENT.md`, `TESTING.md`; proposal and implementation tracker. Add an ADR for transactional notifications and scheduling if needed |

Build in dependency order: schema/private helpers and event tests; transactional emitters and deadline sweep; read-state API/contracts; bell and destinations; full verification and manual QA. This is the design boundary, not the detailed implementation task list.

## 10. Acceptance and verification

1. **Recipient isolation:** sign in with anon-key clients as the teacher, a linked parent, another linked parent, and an unrelated family. Prove recipient-only direct/embedded SELECT, unread count isolation, denied browser DML, denied helper/scheduler RPC execution, foreign mark-read 404, and no spoofable recipient selection.
2. **Assignment fan-out:** creation; multiple parents/children; overlapping targets; unchanged/metadata-only edits; add/remove/re-add; no roster-join notification; rollback emits neither activity changes nor notifications.
3. **Lifecycle events:** Return; parent-only persisted rejection; teacher rejection; initial successful upload; successful retry after rejected/processing attempts following Return; explicit pin/newer active attempt; deletion/retry; new Return cycle; single/bulk release; duplicate release; redraft/re-release; failures roll back event and notification together. Preserve the existing persisted-rejection 422 response.
4. **Deadline sweep:** no stored work row; null deadlines; exact 24-hour/due boundaries; overrides; repeated/concurrent sweeps; unchanged/equivalent timestamps; new deadlines and restored old deadlines; active completed/draft/released/pinned attempts; pending/rejected work; archived activities; current versus historical assignment and roster; both activity modes; concurrent deadline edits/completion using established locks. Add excused cases in Slice 5 when its schema exists.
5. **Read state and pagination:** preserve first read time; repeat/read-all no-op count; stable feed ordering at timestamp ties; exact unread count beyond the first page; inserts arriving during read-all/pagination; deletion between application precheck and update; account-scoped cache behavior.
6. **Upgrade and privacy:** migrate synthetic pre-Slice-3 data without replaying historical events or changing work/results; verify one named cron job and expected grants; event table has no copied PII/result payload; log capture excludes names, emails, notes, scores, and image data; research exports remain unchanged. Retain both prior upgrade proofs.
7. **Required checks:** backend Ruff, frontend ESLint/TypeScript, production frontend build, generated database/OpenAPI contract checks, security advisors, and the full backend pytest suite against an ephemeral Supabase stack. Discover available CLI commands through help before use. Never reset a hosted database for tests. Existing records of absent Docker and CI-only approval are historical evidence, not proof that the current session has a running stack or fresh publishing authorization.
8. **Manual portal QA:** teacher and parent bells; two siblings under one account; second linked parent; read states; target attempt and activity destinations; mobile/desktop; keyboard/focus; unavailable/revoked targets; polling/retry; draft score gating after a release notification becomes stale. Mark Slice 3 Verified only with actual check results and portal sign-off; track deployment separately.

## 11. References checked during design

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): explicit grants and recipient policies are separate requirements; RLS protects browser reads.
- [Supabase API grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically): new objects must have explicit intended grants rather than depending on historical defaults.
- [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart): named job scheduling, database-function invocation, and job inspection.
- [Supabase Cron installation](https://supabase.com/docs/guides/cron/install): pg_cron provisioning is a prerequisite. Do not disable the extension to pause one test job because disabling it removes all jobs.

Reviewed on 2026-11-02. These sources inform the design; no hosted database, deployment, or scheduler was inspected or changed during this design pass.
