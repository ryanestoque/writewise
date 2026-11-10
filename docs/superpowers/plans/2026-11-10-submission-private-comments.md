# Private Comments per Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every worksheet submission its own private teacher–parent conversation, unread alerts, and lock, deleting that conversation when its submission is deleted.

**Architecture:** Replace the existing student/activity thread key with the submission UUID. A submission-owned thread table carries comment version and lock state; caller-scoped reads and service-only transactional writes retain current authorization, privacy, and version-aware notification semantics. Reuse the existing conversation components inside submission views and provide an explicit attempt picker for activity/gradebook shortcuts.

**Tech Stack:** Existing Next.js 16.2.12, React 19.2.4, strict TypeScript, TanStack Query, Zod, FastAPI/Pydantic v2, Supabase/Postgres SQL migrations and RLS, pytest/asyncpg, Ruff and ESLint. Supabase CLI 2.115.0 matches the checked-in local stack and CI. No new dependency or frontend test framework.

**Spec:** [Private comments per submission](../specs/2026-11-10-submission-private-comments-design.md), approved for implementation planning by the user's explicit writing-plans request on 2026-11-10. Read it and AGENTS.md before executing. This replaces the [old activity-thread plan](2026-11-09-phase3-private-comments.md); do not execute that plan for this redesign.

## Global Constraints

These exact requirements from the spec apply to every task:

- “One submission ID identifies one conversation.”
- “A resubmission starts with an empty conversation.”
- “There is no conversation before an upload.”
- “Preserve existing single and bulk submission-deletion permissions, including the parent's uploader, child-link, and grading checks.”
- “Posting requires a currently assigned activity, a non-archived activity, and an unlocked submission thread.”
- “Every participant sees new comments immediately, including before results are released.”
- “An empty thread read does not insert a state row.”
- “Do not broaden submission, image, measurement, grade, or profile SELECT policies to make comment history work.”
- “Every `comment_posted` notification has a non-null `submission_id` and matching activity/student identifiers derived from that submission.”
- “Coalesce at most one unread comment notice per `(recipient_id, submission_id)`, rather than per student/activity.”
- “No service key enters browser code; comment reads do not expose unreleased academic values.”
- “Use new CLI-allocated, versioned SQL migrations on top of the existing committed Slice 6 migrations.”
- “Do not rewrite applied migrations, reset a hosted project, alter academic history, or silently assign an activity-level message to the newest/only upload.”
- “Pending writes are not automatically retried.”
- Preserve 1–1000 trimmed Unicode characters, internal line breaks, plain escaped rendering, no editing, author-only body scrubbing, all currently linked parents, and current-link revocation.
- Preserve identifiers-only logs/notifications/receipts, no comment emails, no research/academic exports of comment text, no scoring changes, no grade redraft from comment actions, and the existing single-service/single-worker/image-hardening rules.
- “Comments are available after a worksheet is uploaded.” is the no-submission explanation in both portals.
- “This will permanently delete this submission and its comments.” is the representative deletion sentence; retain existing applicable photo/analysis/grade explanations.

## Baseline, isolation, and execution checks

**Execution start (2026-11-10):** The user selected inline execution. The existing feature worktree is clean at plan commit `4060c4b` before execution. Task 1 is in progress: the exact-upload storage regression and a branch-only disposable database checkpoint are written before implementation. Docker/Podman remain unavailable locally; the existing recorded authorization for this same feature branch and `https://github.com/ryanestoque/writewise.git` CI destination is retained. Database red/green results, regenerated schema types, and task completion are not yet claimed. No hosted Supabase project is used.

**Test-first checkpoint (2026-11-10):** Local database-free baseline: 338 passed (one upstream TestClient warning). [Storage red at `899687f`](https://github.com/ryanestoque/writewise/actions/runs/42815369719) failed only on missing `submission_comment_thread`, with fixture cleanup corrected. [Contract red at `260fcf5`](https://github.com/ryanestoque/writewise/actions/runs/42815585325) failed all ten exact-submission feed/write/picker/notification/deletion cases on missing new RPCs, without teardown errors. Independently, the mounted exact-submission API/result tests failed on the missing route and missing response source ID, then passed all 65 route/model cases after source-derived prechecks and new routes; real database/API verification remains pending. Three CLI-allocated forward migrations are prepared (`20261110122835`, `20261110123032`, `20261110123214`) for disposable CI. Actual database types will be paired from that exact schema-run artifact before migration tasks are complete, following the existing CI-only workflow. These checkpoints do not complete Tasks 1–4 or establish final regression/portal correctness.

Planning is in `C:/Users/Admin/Documents/CODING PROJECTS/writewise/.worktrees/phase3-private-comments`, branch `feat/phase3-private-comments`, starting at design commit `9b1723a`. Git confirms a linked worktree: its Git directory is `.git/worktrees/phase3-private-comments` and common directory is the main checkout's `.git`; it is not a submodule. Reuse it and preserve all env files and email/gradebook branches. The current code still implements activity-level comments. Prior CI's 1011 tests and controlled browser checks are historical evidence for that code, not for this redesign.

This document changes no application/schema/test files. All execution boxes start unchecked. Do not push, merge, migrate hosted projects, delete hosted test comments, deploy, or activate email as a planning step. Before execution, inspect status and preserve any changes since this plan. No agents are dispatched unless the user selects delegated execution; inline execution and self-review are supported.

The change is a coordinated breaking contract on an isolated feature branch. Tasks 1–4 produce independently testable database/API units; old pair-based tests/clients cannot keep working across the cutover. Port the affected tests as their contracts change, and record expected unported-contract failures precisely. Do not describe an intermediate failing full CI run as a passing checkpoint. Tasks 5–8 similarly port frontend consumers after the new types exist; require whole-frontend lint/type/build success after all consumers are moved. Nothing is deployed between these tasks.

Run AGENTS.md's canonical disposable-stack workflow from `docs/TESTING.md §3.1.1`: start → capture localhost credentials without printing them → reset `--local` → pytest → stop in `finally`. Reuse a running disposable stack for focused red/green iterations, resetting only that local stack. Test collection reads the database, so set explicit localhost test variables before invoking pytest. On Windows without a standalone CLI use the documented `npx.cmd --yes supabase@2.115.0` equivalent after checking its `--help`. If Docker remains absent, do not substitute hosted dev: use feature-branch CI only with confirmed destination/publication authorization. Keep exact schema SHA, CI run, and generated artifact correspondence.

Database-free route/model checks run from `backend/` with explicit dummy localhost Supabase settings and `ENVIRONMENT=test`:

```powershell
uv run pytest --confcutdir=tests/unit tests/unit/test_comment_contracts.py tests/unit/test_comment_routes.py
```

Use existing installed-tool equivalents when wrappers/caches are unavailable; do not change machine execution policy or global Git configuration. Required static commands remain `uv run ruff check .` in `backend/`, and `npx eslint .` / `npx tsc --noEmit` in `frontend/`. `node node_modules/typescript/bin/tsc --noEmit --incremental false` avoids generated incremental files during documentation checks.

## File and responsibility map

| Unit | Files | Responsibility |
|---|---|---|
| Forward store/access migration | CLI-created `phase3_submission_comment_store` in `supabase/migrations/` | Empty-legacy preflight, new thread/comment shape, RLS, minimal source context, obsolete pair contract removal |
| Caller reads | CLI-created `phase3_submission_comment_reads` in `supabase/migrations/` | Exact-submission feed, comment-history summaries, safe attempt picker metadata |
| Transactional writes | CLI-created `phase3_submission_comment_writes` in `supabase/migrations/` | Posting, deletion, locks, per-submission coalescing and preserved notification receipts |
| API boundary | `backend/app/comments/{access,contracts,repository,errors}.py`, `backend/app/api/comments.py` | Real source identity checks, strict payloads, safe errors, new routes |
| Database/API proofs | Existing `backend/tests/rls/comment_support.py`, `test_comment_*.py`; new `test_submission_comment_deletion.py`; existing unit/API deletion tests | Actual database/RLS/transactions, mounted routes, privacy, source deletion, observed races |
| Browser data contracts | Existing `frontend/lib/comments/{types,validation,data,query-keys,targets}.ts`, new `selection.ts`, `invalidation.ts`; existing `frontend/lib/hooks/use-comments.ts` | Submission identity, retained windows, picker data, exact URLs, account isolation, deletion cleanup |
| Shared UI | Rename `student-work-thread.tsx` / `student-work-thread-sheet.tsx` to `submission-comment-thread.tsx` / `submission-comment-thread-sheet.tsx`; new `submission-comment-picker.tsx` | Reusable submission-labelled thread and explicit attempt selection |
| Teacher entry points | `frontend/components/submissions/submission-detail-content.tsx`, `submission-detail-dialog.tsx`; teacher activity/submission pages; `frontend/components/gradebook/{work-grade-sheet,teacher-gradebook,gradebook-cell}.tsx`; `components/comments/activity-threads.tsx` | Direct attempt threads, picker, aggregate unread indicators, no-upload state |
| Parent and bell | `frontend/components/parent/{worksheet-view-dialog,pending-worksheet-dialog,submission-history-dialog,latest-submission-card,take-home-activities,notification-work-destination}.tsx`; parent progress content; `components/gradebook/parent-grades.tsx`; `components/comments/parent-activity-threads.tsx`; notification data/presentation and hooks | Exact parent attempt/thread, preserved sibling, safe destinations, no automatic bell acknowledgment |
| Source deletion integration | Existing `frontend/lib/hooks/use-submissions.ts`, all teacher/parent single/bulk confirmations | Clear private caches only on successful deletion and explain conversation removal |
| Upgrade/closeout | New `backend/tests/migrations/submission_comment_upgrade_check.py`; existing `comment_upgrade_check.py`, `.github/workflows/ci.yml`, generated `frontend/types/{database,api}.ts`, companion docs and tracker | Seventh upgrade proof, legacy-row failure proof, prior proofs preserved, exact generated contracts, manual acceptance |

## Shared interfaces fixed before task execution

### SQL and API

All write functions are service-only, security-invoker, with empty search paths; reads are caller-scoped security-invoker. The one minimal private context/enumeration boundary checks `auth.uid()` internally, exposes no bodies/grades/images/profiles, and has pinned empty search paths and explicit grants. No browser-supplied actor is accepted by a read helper.

| Function | Signature and result | Producer |
|---|---|---|
| `writewise_internal.submission_comment_context` | `(target_submission_id uuid) -> jsonb|null`: `submission_id,activity_id,student_id,submitted_at,submission_status,activity_owner_id,assigned,is_archived`; authorized owner/current parent only | 1 |
| `writewise_internal.submission_comment_candidates` | `(target_activity_id uuid,target_student_id uuid) -> SETOF jsonb`, each value has the same safe context fields; exact owner/child participation and assigned-or-existing-submission pair; no caller ID argument | 2 |
| `read_submission_comment_thread` | `(target_submission_id uuid,before_cursor jsonb DEFAULT NULL,page_size integer DEFAULT 50) -> jsonb` matching `CommentThread` below | 2 |
| `list_submission_comment_threads` | `(target_activity_id uuid DEFAULT NULL,target_student_id uuid DEFAULT NULL,before_cursor jsonb DEFAULT NULL,page_size integer DEFAULT 50) -> jsonb`; exactly one discovery scope, matching `ThreadSummaries` | 2 |
| `list_submission_comment_attempts` | `(target_activity_id uuid,target_student_id uuid,before_cursor jsonb DEFAULT NULL,page_size integer DEFAULT 50) -> jsonb` matching `CommentAttempts` | 2 |
| `writewise_internal.submission_comment_write_context` | `(actor_id uuid,target_submission_id uuid) -> jsonb`: actual source context plus `author_role,comments_locked,recipients`; service-only real-relationship gate after locks | 3 |
| `writewise_internal.put_submission_comment_notification` | `(recipient uuid,target_submission_id uuid,target_comment uuid,target_version integer,event_at timestamptz) -> uuid`; derives source pair, inserts receipt and coalesces exact-source alert | 3 |
| `post_submission_comment` | `(actor_id uuid,target_submission_id uuid,comment_body text) -> jsonb` matching `CommentPosted` | 3 |
| `set_submission_comment_lock` | `(actor_id uuid,target_submission_id uuid,locked boolean) -> jsonb` matching `CommentLockState` | 3 |
| `delete_private_comment` | `(actor_id uuid,target_comment_id uuid) -> jsonb` exactly `{deleted:true}`; signature retained, authorization derives submission | 3 |
| `mark_comment_notification_read` | Existing `(actor_id uuid,target_notification_id uuid,expected_comment_version integer) -> {id,read_at}` | Retain in 3 |

The context helper derives its actor from the caller session; it is not the service write precheck. Service-only writes derive context from the trusted `actor_id` and repeat actual source/owner/link checks inside the transaction. Do not call an `auth.uid()`-based helper under a service session and mistake its null result for actor authorization.

`CommentPosted` is `{id:UUID,submission_id:UUID,activity_id:UUID,student_id:UUID,author_role:Literal['teacher','parent'],created_at:AwareDatetime,comment_version:StrictInt[1..2147483647]}`. `CommentLockState` is `{submission_id:UUID,comments_locked:bool}`. Preserve existing strict post/lock request models and 204 deletion. New post/lock paths are `/api/submissions/{submission_id}/comments` and `/api/submissions/{submission_id}/comments/lock`; DELETE remains `/api/comments/{comment_id}`. Old pair-scoped routes return the existing enveloped not-found response and never guess an upload.

Retain fixed SQLSTATE mapping: `WW404→404 NOT_FOUND`, `WW412→404 ACTIVITY_NOT_ASSIGNED`, `WW422→422 VALIDATION_ERROR`, `WW440→409 COMMENTS_LOCKED`, `WW441→409 ACTIVITY_ARCHIVED`, `WW442→409 COMMENT_READ_CONFLICT`. Other private failures map to fixed 500 `INTERNAL_ERROR`, with no raw input/error details.

### Browser contracts

Retain current `CommentEntry`, `ReturnEntry`, `ThreadEntry`, and `(event_at,kind,id)` `ThreadCursor` shapes. Replace target, thread, summary, and picker types in `frontend/lib/comments/types.ts` with these shared definitions:

```typescript
import type { Database } from "@/types/database";

export type ThreadTarget = { submissionId: string };
export type CommentLocation = ThreadTarget & { activityId: string; studentId: string };
export type WorkCommentScope = { activityId: string; studentId: string };
export type SubmissionStatus = Database["public"]["Enums"]["submission_status"];
export type CommentThread = {
  submission_id: string; activity_id: string; student_id: string;
  submitted_at: string; submission_status: SubmissionStatus; activity_title: string;
  actor_role: "teacher" | "parent";
  assigned: boolean; is_archived: boolean; comments_locked: boolean;
  can_post: boolean; can_lock: boolean;
  read_only_reasons: ("unassigned" | "archived" | "locked")[];
  entries: ThreadEntry[]; next_cursor: ThreadCursor | null;
  seen_comment_version: number | null;
  unread_notice: { id: string; comment_version: number } | null;
};
export type CommentAttempt = {
  submission_id: string; activity_id: string; student_id: string;
  submitted_at: string; submission_status: SubmissionStatus; comments_locked: boolean;
};
export type AttemptCursor = { submitted_at: string; submission_id: string };
export type CommentAttempts = { rows: CommentAttempt[]; next_cursor: AttemptCursor | null };
export type ThreadSummary = CommentAttempt & {
  activity_title: string; student_label: string; last_comment_at: string;
  assigned: boolean; is_archived: boolean;
};
export type ThreadSummaryCursor = { last_comment_at: string; submission_id: string };
export type ThreadSummaries = { rows: ThreadSummary[]; next_cursor: ThreadSummaryCursor | null };
export type ThreadScope =
  { activityId: string; studentId?: never } | { studentId: string; activityId?: never };
export type UnreadCommentNotice = {
  id: string; submission_id: string; activity_id: string; student_id: string;
  comment_version: number;
};
export type UnreadCommentThreads = Map<string, UnreadCommentNotice>;
export const threadIdentity = (target: ThreadTarget) => target.submissionId;
```

`readThreadPage`, `readThreadWindow`, `readThreadSummaries`, `readUnreadCommentThreads`, `parseThread`, `parseSummaries`, `canAcknowledge`, and `useCommentThread/useCommentActions` retain their existing export names with the new target/result types. Add `readCommentAttempts(client,scope,before,signal?)`, `parseCommentAttempts(value,scope)`, `useCommentAttempts(userId,scope,open)`, `selectCommentAttempt`, `matchesCommentLocation`, and `clearDeletedSubmissionComments` in the tasks below. Cursor timestamps preserve six fractional digits; default page size 50, valid range 1–100. No hand-maintained generated schema interfaces.

---

### Task 1: Forward store cutover and exact-submission access

**Files:** Create the migration with `supabase migration new phase3_submission_comment_store`; modify `backend/tests/rls/comment_support.py`, `test_comment_storage.py`; regenerate `frontend/types/database.ts`; update schema-mode assertions in `backend/tests/migrations/comment_upgrade_check.py` so they recognize the new final store. Actual timestamped filename comes only from the CLI output and is recorded in the execution log.

**Interfaces:** Produces `submission_comment_thread`, submission-scoped `private_comment`, `submission_comment_context(uuid)` and rewritten `seed_comment(family,submission_id,*,actor_id=None,body='Synthetic private message') -> dict`. Reuse `stored_attempt(family,activity_id,*,released=False,created_at=None,measured=True) -> dict` from `tests.rls.gradebook_support`; it creates a real synthetic completed submission for `family['students'][0]`. The fixture activity is `assigned_activity['id']`; `family` and `second_parent` are the existing signed-in RLS fixtures.

- [ ] Write the database/schema red cases before changing the migration. Directly insert/query the proposed table and use real caller clients, not the service role, for visibility assertions:

```python
def test_two_uploads_have_distinct_comment_anchors(family, assigned_activity):
    from app.core.supabase import supabase_client as admin
    from tests.rls.comment_support import seed_comment
    from tests.rls.gradebook_support import stored_attempt

    first = stored_attempt(family, assigned_activity["id"], measured=False)
    second = stored_attempt(family, assigned_activity["id"], measured=False)
    assert admin.table("submission_comment_thread").select("submission_id").eq(
        "submission_id", first["id"]
    ).execute().data == []
    comment = seed_comment(family, first["id"])
    visible = family["parent_client"].table("private_comment").select(
        "id,submission_id,body"
    ).eq("submission_id", first["id"]).execute().data
    assert visible == [{"id": comment["id"], "submission_id": first["id"],
                        "body": "Synthetic private message"}]
    assert family["parent_client"].table("private_comment").select("id").eq(
        "submission_id", second["id"]
    ).execute().data == []
    assert admin.table("submission_comment_thread").select("submission_id").eq(
        "submission_id", second["id"]
    ).execute().data == []
```

- [ ] Run `uv run pytest tests/rls/test_comment_storage.py -k 'distinct_comment_anchors' -v` on the disposable stack. Expected RED is missing new thread/table/column behavior, not a fixture/Auth/connection failure. Capture it.
- [ ] Allocate the migration using the CLI, then put this preflight first in its transaction. Lock both legacy tables before the check so an old write cannot race the check; coordinated deployment stops old writes before cutover:

```sql
lock table public.private_comment, public.notification in access exclusive mode;
do $$
begin
  if exists(select 1 from public.private_comment)
     or exists(select 1 from public.notification where type='comment_posted') then
    raise exception using errcode='55000',
      message='Submission comment cutover requires empty legacy conversations';
  end if;
end;
$$;
```

- [ ] Remove old pair-specific policies/functions in dependency order, explicitly naming them. Retire `read_private_comment_thread(uuid,uuid,jsonb,integer)`, `list_private_comment_threads(uuid,uuid,jsonb,integer)`, `post_private_comment(uuid,uuid,uuid,text)`, `set_comment_thread_lock(uuid,uuid,uuid,boolean)` and old pair context/fanout helpers; replace `delete_private_comment` in Task 3. Remove `comment_participant_select` on comments, `comment_history_owner_work_select` on work, and comment-only terms in activity history policy before removing `has_comment_work_history`, `has_comment_activity_history`, and `can_read_comment_work`. Preserve assigned/submission/grade history policy terms. Use no unreviewed `DROP ... CASCADE` and do not alter applied migration files.
- [ ] Create the new state table, re-key the empty comment table, and remove obsolete work comment fields. The essential target shape is:

```sql
create table public.submission_comment_thread (
  submission_id uuid primary key references public.submission(id) on delete cascade,
  comments_locked boolean not null default false,
  comment_version integer not null default 0 check (comment_version >= 0)
);
alter table public.private_comment
  drop constraint private_comment_activity_id_student_id_fkey,
  drop constraint private_comment_activity_id_student_id_comment_version_key;
drop index public.private_comment_feed;
drop index public.private_comment_student;
alter table public.private_comment drop column activity_id, drop column student_id;
alter table public.private_comment add column submission_id uuid not null
  references public.submission_comment_thread(submission_id) on delete cascade;
alter table public.private_comment add unique (submission_id,comment_version);
create index private_comment_feed on public.private_comment
  (submission_id,created_at desc,id desc);
alter table public.student_work drop column comments_locked, drop column comment_version;
```

Keep existing body/deleted-shape checks and author FK/index. Before executing the ALTER statements, inspect the current migration's explicit and PostgreSQL-generated constraint names on the disposable baseline; use the actual existing names and do not suppress a missing dependency with broad `IF EXISTS`/CASCADE behavior.

- [ ] Implement `submission_comment_context` as a private SECURITY DEFINER read projection, empty search path, no actor argument, strict `auth.uid()` owner/current-parent predicate through the actual submission. Return only the eight safe fields defined above. It must work after roster removal without granting access to the worksheet/assessment. The authorization core is:

```sql
where s.id=target_submission_id and (select auth.uid()) is not null
  and (a.created_by=(select auth.uid()) or exists (
    select 1 from public.student_parent sp
    where sp.student_id=s.student_id and sp.parent_id=(select auth.uid())
  ))
```

- [ ] Enable RLS and deny authenticated writes on both exposed tables. Thread SELECT policy uses non-null exact-source context; comment SELECT uses the same context for its `submission_id`. Explicitly revoke default PUBLIC/anon helper execution; grant only the minimal authenticated helper invocation needed by RLS/caller reads. All context output remains safe even if directly invoked by an authorized caller. No service write helper is browser-callable.
- [ ] Rewrite `seed_comment` to read/create the target thread state, compute its next fixture version, insert a comment with only the submission identity, and update that same thread counter. It is synthetic sequential setup, not production transaction logic. Port storage tests to create submissions explicitly. Add direct RLS denial for foreign/sibling/unlinked users, another roster teacher, browser INSERT/UPDATE/DELETE, malformed source IDs/row shapes, author FK nulling, source cascade, and unchanged worksheet/profile access after roster removal. Replace old no-upload/comment-only-history tests with no-source denial, leaving no fake submission fixture.
- [ ] Run `uv run pytest tests/rls/test_comment_storage.py -v`; expected GREEN for this store unit. Run Ruff. Regenerate database types from this actual migrated disposable stack with `supabase gen types typescript --local > frontend/types/database.ts` and include them in the migration commit. Review migration diff and commit `feat: anchor private comment storage to submissions`. Record any explicitly unported read/write tests as transitional, not passing. Do not run a hosted cleanup if the legacy preflight blocks.

### Task 2: Caller-scoped thread feeds, history, and attempt selection

**Files:** CLI-create `phase3_submission_comment_reads` migration; modify `backend/tests/rls/test_comment_reads.py`, `comment_support.py`; regenerate `frontend/types/database.ts`; add read-authorization tests to `test_comment_storage.py` where needed.

**Interfaces:** Consumes Task 1's source context/store. Produces all three public read functions and private `submission_comment_candidates` in the shared interface table. Add test helper `read_thread(client,submission_id,**page) -> dict` that invokes `read_submission_comment_thread`. `list_submission_comment_attempts` is necessary for no-comment attempts and historical owners whose ordinary worksheet SELECT is unavailable; it exposes only picker metadata, not academic/image access.

- [ ] Add the test-only RPC helper to `comment_support.py` first, so RED diagnoses the missing database behavior rather than an import error:

```python
def read_thread(client, submission_id, **page):
    return client.rpc("read_submission_comment_thread", {
        "target_submission_id": submission_id, **page,
    }).execute().data
```

- [ ] Write this feed-isolation red case, then run `uv run pytest tests/rls/test_comment_reads.py -k 'read_is_scoped_to_exact_upload' -v` expecting the new RPC to be absent:

```python
def test_read_is_scoped_to_exact_upload(family, assigned_activity):
    from tests.rls.comment_support import read_thread, seed_comment
    from tests.rls.gradebook_support import stored_attempt

    first = stored_attempt(family, assigned_activity["id"], measured=False)
    second = stored_attempt(family, assigned_activity["id"], measured=False)
    posted = seed_comment(family, first["id"])
    first_thread = read_thread(family["parent_client"], first["id"])
    second_thread = read_thread(family["parent_client"], second["id"])
    assert first_thread["submission_id"] == first["id"]
    assert [entry["id"] for entry in first_thread["entries"]] == [posted["id"]]
    assert second_thread["entries"] == []
    assert second_thread["comments_locked"] is False
    assert second_thread["seen_comment_version"] is None
```

- [ ] Add the complete new RPC parameters and fixed-window validation. Keep `page_size` 1–100, exact cursor keys, finite timestamps, UUIDs and kind validation. Context absence raises fixed WW404. Read missing state as unlocked/zero; never insert thread/work/grade rows in a read.
- [ ] Restrict both feed branches to the target source. Build the visible Return branch through the existing caller-RLS submission projection; owner comment-history access must not automatically reveal a formerly hidden Return note. The feed's required source restrictions are:

```sql
-- Comment branch in read_submission_comment_thread:
where c.submission_id=target_submission_id
-- Return branch in the same RPC, under existing submission RLS:
where s.id=target_submission_id and s.status='returned' and s.returned_at is not null
```

Use `created_at` for comments, `returned_at` for Return, and the existing `(event_at,kind,id)` comparison and six-digit timestamp cursors. Derive watermark only from returned comment entries. Read `unread_notice` by caller plus this submission ID, never by pair. Populate the strict browser thread shape from the shared contracts.

- [ ] Implement retained-comment summaries from caller-visible comments/thread rows, grouping by submission, then attach minimal source context. Authorize exactly one teacher-owned activity or currently linked parent's child. Include tombstones; omit no-comment attempts from this summary list. Order by `(last_comment_at desc,submission_id desc)` with its complete cursor. Student labels use existing RLS and fall back to `Student`.
- [ ] Implement `submission_comment_candidates` in the private schema to enumerate safe exact-pair source metadata with the same internal caller predicate. Allow an assigned pair with no uploads to produce an empty list; deny a never-assigned, no-history pair. `list_submission_comment_attempts` is caller-rights and adds caller-visible thread lock metadata. It pages by `(submitted_at desc,submission_id desc)`, where `submitted_at` is source `created_at`; no synthetic rows, grades, scores, Return notes, or image paths are returned.
- [ ] Port microsecond/50-plus-entry/summary cursor tests. Add two returned attempts and prove each feed contains only its own Return. Test same-timestamp tie ordering, own newer-post watermark without loaded alerted entry, read after unassignment/archive, former-roster owner context with generic label, newly linked parent history, link revocation, missing/deleted source, no-source/points-only picker, mismatch/duplicate cursor keys, and sibling scope. Assert read-only reasons remain ordered `unassigned,archived,locked` and flags match the actual actor/gates.
- [ ] Run `uv run pytest tests/rls/test_comment_storage.py tests/rls/test_comment_reads.py -v`; expected GREEN for these units. Run Ruff, regenerate the actual migrated `frontend/types/database.ts` for this migration commit, review caller grants and metadata minimization, and commit `feat: read private conversations by submission`.

### Task 3: Transactional posting, per-submission notifications, and deletion races

**Files:** CLI-create `phase3_submission_comment_writes` migration; modify `backend/tests/rls/{comment_support,test_comment_mutations,test_comment_notifications,test_comment_races}.py`; create `backend/tests/rls/test_submission_comment_deletion.py`; regenerate `frontend/types/database.ts`. Preserve the existing `delete_student_submissions` transaction in `20261108060218_phase3_gradebook_lifecycle.sql` as an applied historical migration; change its behavior only with a new migration if a failing race test demonstrates a necessary fix.

**Interfaces:** Produces service-only post/lock functions, new private exact-source write gate and notification emitter, rewritten author deletion, unchanged version-aware single/all-read contracts. Add `post_comment(actor_id,submission_id,body='Synthetic reply') -> dict`, `lock_thread(actor_id,submission_id,locked) -> dict`, and `unread_notices(recipient_id,submission_id) -> list[dict]` to test support. Existing `db_value(query,*parameters)` and async `wait_for_database_lock(observer,pid)` come from `tests.rls.notification_support`.

- [ ] Adapt these test-only helpers before running new RPC tests. They wrap real database operations and cannot make an absent function pass:

```python
from app.core.supabase import supabase_client as admin

def post_comment(actor_id, submission_id, body="Synthetic reply"):
    return admin.rpc("post_submission_comment", {
        "actor_id": actor_id, "target_submission_id": submission_id, "comment_body": body,
    }).execute().data

def lock_thread(actor_id, submission_id, locked):
    return admin.rpc("set_submission_comment_lock", {
        "actor_id": actor_id, "target_submission_id": submission_id, "locked": locked,
    }).execute().data

def unread_notices(recipient_id, submission_id):
    return admin.table("notification").select(
        "id,submission_id,comment_version,read_at"
    ).eq("recipient_id", recipient_id).eq("submission_id", submission_id).eq(
        "type", "comment_posted"
    ).is_("read_at", "null").execute().data
```

- [ ] Write independent-thread lock/unread tests, then run their focused module before writing SQL. Expected RED is missing `post_submission_comment`/lock behavior:

```python
def test_lock_and_unread_are_independent_per_upload(family, assigned_activity):
    from tests.rls.comment_support import lock_thread, post_comment, unread_notices
    from tests.rls.gradebook_support import stored_attempt

    first = stored_attempt(family, assigned_activity["id"], measured=False)
    second = stored_attempt(family, assigned_activity["id"], measured=False)
    a = post_comment(family["teacher"], first["id"])
    lock_thread(family["teacher"], first["id"], True)
    b = post_comment(family["teacher"], second["id"])
    assert a["comment_version"] == b["comment_version"] == 1
    notices_a = unread_notices(family["parent"], first["id"])
    notices_b = unread_notices(family["parent"], second["id"])
    assert len(notices_a) == len(notices_b) == 1
    assert notices_a[0]["id"] != notices_b[0]["id"]
```

- [ ] Write source-deletion red cases using the real authorized service RPC, including the peer attempt that must survive:

```python
def test_source_deletion_cascades_only_its_conversation(family, assigned_activity):
    from app.core.supabase import supabase_client as admin
    from tests.rls.comment_support import post_comment
    from tests.rls.gradebook_support import stored_attempt

    first = stored_attempt(family, assigned_activity["id"], measured=False)
    second = stored_attempt(family, assigned_activity["id"], measured=False)
    first_comment = post_comment(family["teacher"], first["id"])
    second_comment = post_comment(family["parent"], second["id"])
    admin.rpc("delete_student_submissions", {
        "actor_id": family["teacher"], "target_submission_ids": [first["id"]]
    }).execute()
    assert admin.table("private_comment").select("id").eq(
        "id", first_comment["id"]
    ).execute().data == []
    assert admin.table("submission_comment_thread").select("submission_id").eq(
        "submission_id", first["id"]
    ).execute().data == []
    assert admin.table("notification").select("id").eq(
        "submission_id", first["id"]
    ).execute().data == []
    assert admin.table("private_comment").select("id").eq(
        "id", second_comment["id"]
    ).execute().data == [{"id": second_comment["id"]}]
```

- [ ] Implement source-derived service authorization and locking. First read source identity without locking, then lock activity → existing `lock_work(activity,student)` → source `FOR UPDATE` → thread. Recheck source identity/existence after waiting. Lock current membership rows at the established gate, recheck current parent/roster/assignment facts, and derive actor role/participants from real relationships. Post requires assigned, active, unlocked, but not release, current-counted status, successful analysis, or an open upload deadline. A missing source fails WW404 before any state-row creation.
- [ ] Preserve `normalize_comment_body` semantics. Create the state row under source serialization, increment only its version, insert the comment with a timestamp captured after locks, and insert/coalesce every other current participant's notice and private receipt in the same transaction. Make lock mutation only update thread state; author deletion only scrubs its own row after exact-source/current-participant validation. Retain no editing, author FK behavior, no retries, and grade isolation.

The post function's implementation shape is executable once the two private Task 3 helpers above are defined; their gates perform participant-link locking/current authorization and source-derived fanout as specified:

```sql
create function public.post_submission_comment(
  actor_id uuid,target_submission_id uuid,comment_body text
) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
  source_row public.submission;
  locked_row public.submission;
  posted public.private_comment;
  context jsonb;
  clean text;
  next_version integer;
  stamp timestamptz;
  recipient uuid;
begin
  select * into source_row from public.submission where id=target_submission_id;
  if not found then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  perform 1 from public.activity where id=source_row.activity_id for update;
  perform writewise_internal.lock_work(source_row.activity_id,source_row.student_id);
  select * into locked_row from public.submission where id=target_submission_id for update;
  if not found or locked_row.activity_id is distinct from source_row.activity_id
      or locked_row.student_id is distinct from source_row.student_id then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  context := writewise_internal.submission_comment_write_context(actor_id,target_submission_id);
  if not (context->>'assigned')::boolean then
    raise exception using errcode='WW412',message='Activity no longer assigned';
  end if;
  if (context->>'is_archived')::boolean then
    raise exception using errcode='WW441',message='Activity archived';
  end if;
  if (context->>'comments_locked')::boolean then
    raise exception using errcode='WW440',message='Conversation locked';
  end if;
  clean := writewise_internal.normalize_comment_body(comment_body);
  insert into public.submission_comment_thread(submission_id) values(target_submission_id)
    on conflict(submission_id) do nothing;
  update public.submission_comment_thread set comment_version=comment_version+1
    where submission_id=target_submission_id returning comment_version into next_version;
  stamp := clock_timestamp();
  insert into public.private_comment(
    submission_id,author_id,author_role,body,comment_version,created_at
  ) values(target_submission_id,actor_id,context->>'author_role',clean,next_version,stamp)
    returning * into posted;
  for recipient in select value::uuid
    from jsonb_array_elements_text(context->'recipients') order by value::uuid
  loop
    if recipient<>actor_id then
      perform writewise_internal.put_submission_comment_notification(
        recipient,target_submission_id,posted.id,next_version,stamp
      );
    end if;
  end loop;
  return jsonb_build_object(
    'id',posted.id,'submission_id',target_submission_id,
    'activity_id',source_row.activity_id,'student_id',source_row.student_id,
    'author_role',posted.author_role,'created_at',posted.created_at,'comment_version',next_version
  );
end;
$$;
revoke all on function public.post_submission_comment(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.post_submission_comment(uuid,uuid,text) to service_role;
```

`submission_comment_write_context` must raise WW404 on missing/unauthorized context rather than return null; return strict booleans and a deduplicated participant array. It derives both owner and parents from locked current database relationships, never request role claims. Lock mutation follows the same activity/work/source/thread order and does not call any grade-publication helper. The public result omits the body even on successful posting.
- [ ] Replace the notification shape constraint using the full current gradebook exception, preserving all ordinary types:

```sql
alter table public.notification drop constraint notification_submission_kind;
alter table public.notification add constraint notification_submission_kind check (
  (type in ('submission_returned','submission_rejected','resubmitted_after_return','comment_posted')
    and submission_id is not null)
  or type='score_released'
  or (type in ('activity_assigned','due_soon','activity_missing') and submission_id is null)
);
drop index public.notification_comment_unread_uniq;
create unique index notification_comment_unread_uniq
  on public.notification(recipient_id,submission_id)
  where type='comment_posted' and read_at is null;
```

The emitter validates source/activity/student consistency before insert and uses `ON CONFLICT(recipient_id,submission_id) WHERE type='comment_posted' AND read_at IS NULL` to update only that notice's time/version. Dedupe key is `comment:{submission}:{recipient}:{comment}`. Preserve durable receipt insertion and transactional rollback; ordinary receipts remain unchanged. No `comment_posted` event is eligible for outbox/email.

- [ ] Keep `mark_comment_notification_read`'s exact version comparison, first read timestamp, and WW442 conflict. Preserve the materialized `(id,comment_version)` snapshot in mark-all. Add A/version1 and B/version1 tests: marking A cannot clear B; posting B cannot coalesce into A; own replies do not acknowledge own received alerts; all other participants get separate notices. Validate direct notification constraint/RLS boundaries too.
- [ ] Port every existing mutation/race case to real source IDs. Replace before-upload success with absent-source denial/no created thread/work/grade; preserve in-class, past-due, closed-upload, excused, processing, rejected, returned, draft, and released cases. Test unchanged grade revision/source/release and active/pinned selection before/after comments, lock/unlock, and deletion. Inject notice/receipt failures and prove complete rollback including newly inserted thread state.
- [ ] Use asyncpg and observed PostgreSQL waits for both source deletion/post orders, first-post/first-lock races, same-source simultaneous version allocation, assignment/archive/link/roster revocation, recipient unlink, and existing single/all-read races. Reuse existing connection cleanup and transaction-local service JWT configuration. Do not replace lock observation with arbitrary sleeps. For delete-first, hold an activity/work/source deletion transaction, start the post, observe its wait, commit deletion, and assert WW404 plus no orphan thread/comment/alert/receipt. For post-first, commit the post before deletion proceeds and prove its resulting cascade. Cross-submission races may serialize at existing activity/work locks but must remain logically isolated; no performance redesign is in scope.
- [ ] Prove teacher and eligible parent single/bulk deletion permissions still hold, parent-on-graded denial still retains all rows, unrelated attempts survive, identifiers-only private receipts cannot resurrect a deleted thread, and a failed DB transaction retains comments. Use existing real route/Storage tests for the separate Storage failure contract; do not infer it from a bare FK test.
- [ ] Run `uv run pytest tests/rls/test_comment_mutations.py tests/rls/test_comment_notifications.py tests/rls/test_comment_races.py tests/rls/test_submission_comment_deletion.py -v`, plus Tasks 1–2 read/storage modules. Regenerate actual database types for the changed RPCs/constraints and include `frontend/types/database.ts` in this migration commit. Review transactions/RLS/fanout/receipt scope and commit `feat: isolate comment writes and unread alerts per submission`.

### Task 4: New API routes, strict results, privacy, and actual generated contracts

**Files:** Modify `backend/app/api/comments.py`, `backend/app/comments/{access,contracts,repository}.py`, `backend/tests/unit/{test_comment_contracts,test_comment_routes}.py`, `backend/tests/rls/test_comment_api.py`; extend `backend/tests/api/test_submission_deletion_failures.py`, `test_submissions.py`, and `test_submissions_parent.py` for real deletion-with-comments. Generate `frontend/types/api.ts` and `frontend/types/database.ts` from their actual sources.

**Interfaces:** `require_comment_submission(actor_id:str,submission_id:str,*,owner_only:bool=False) -> dict` returns only trusted source/pair metadata after source, owner/current-parent checks. `require_authored_comment` fetches `id,submission_id,author_id` then calls it. Post/lock results and parameter allowlists use the shared contracts. Preserve `safe_comment_operation` so even malformed SDK success results cannot escape private details during response validation.

- [ ] Port the mounted `comment_case` HTTP transport fixture to return a source row on an exact `submission.id` predicate, with its server-side activity/student identity. Introduce `SUBMISSION='77777777-7777-4777-8777-777777777777'`, `submission_exists`, and `POST_PATH=f'/api/submissions/{SUBMISSION}/comments'`. Return submission metadata in result payloads. Keep real FastAPI handlers and real Supabase SDK calls; control only external HTTP transport, not access functions.
- [ ] Write and run these red assertions before changing routes. In the existing fixture, `case.calls` records `(rpc_path,payload)` and `client` is its mounted TestClient:

```python
def test_post_derives_pair_from_exact_submission(comment_case):
    response = comment_case.client.post(POST_PATH, json={"body": "Synthetic reply"})
    assert response.status_code == 201
    assert response.json()["submission_id"] == SUBMISSION
    assert comment_case.calls[-1] == ("rpc/post_submission_comment", {
        "actor_id": comment_case.actor, "target_submission_id": SUBMISSION,
        "comment_body": "Synthetic reply",
    })
```

The existing fixture yields its `SimpleNamespace` state, whose `.client` is the mounted TestClient; preserve that fixture interface.

- [ ] Update route decorators, source prechecks, strict result models and repository `_PARAMETERS/_RESULTS`. Keep the body limited to `body` or `locked`, retain no-store headers and 204 body-free deletion. No client activity/student identity may override the source. Reject forged role metadata, nonexistent/deleted source, invalid UUID, unknown request fields, and parent lock attempts before RPC writes. SQL repeats authorization after the precheck, so do not replace the transactional checks with route-only validation.
- [ ] Retain exact SQLSTATE envelopes and privacy tests. Inject sentinel text into each SDK precheck, write failure, transport exception, extra-field validation, and malformed success response; assert it is absent from response and captured logs. Add old pair-route denial without executing any legacy RPC. Port the real-JWT API proof for owning teacher and both linked parents, foreign-family denial, current-link revocation, and author deletion while locked/unassigned.
- [ ] Extend real deletion-route cases to post comments, then exercise eligible parent/teacher single/bulk source deletion, denied graded deletion, Storage failure before DB removal, and DB failure after Storage success. Preserve existing transport stage/order assertions; verify comments remain on both failures while authorized successful deletion cascades. Keep comment bodies absent from the real gradebook CSV/log sentinel and offline research-export schema.
- [ ] Generate OpenAPI from the actual app into a temporary file and run the existing pinned generator. In a local stack generate DB types only after all three new migrations are applied:

```bash
cd backend
uv run python - <<'PY'
import json
from pathlib import Path
from app.main import app
Path('/tmp/submission-comment-openapi.json').write_text(json.dumps(app.openapi()), encoding='utf-8')
PY
cd ../frontend
npx --yes openapi-typescript@7.13.0 /tmp/submission-comment-openapi.json -o types/api.ts
cd ..
supabase gen types typescript --local > frontend/types/database.ts
```

This is the Linux/CI block; on Windows use a PowerShell literal here-string for the Python stdin code and a workspace/temp path returned by that shell, preserving exact JSON and actual newlines. Never hand-edit generated types. If relying on authorized CI, retrieve `database-types` from the exact schema SHA, pair it in a commit, and rerun the final paired head; a provisional drift failure is not success.

- [ ] Run database-free route/model tests, focused real-JWT/RLS/deletion tests and Ruff. Backend review checkpoint: new source contract, grants, route errors, privacy, cascades, and races must pass before frontend integration. Commit `feat: expose submission private comment APIs` with both generated contracts; identify any still-unported legacy upgrade verifier explicitly until Task 9 updates it.

### Task 5: Browser data, identity, destinations, and unread aggregation

**Files:** Modify `frontend/lib/comments/{types,validation,data,query-keys,targets}.ts`, `frontend/lib/hooks/use-comments.ts`, `frontend/lib/notifications/{data,presentation}.ts`; create `frontend/lib/comments/selection.ts`. The source-deletion invalidation utility is created with its deliverable in Task 8. Do not add a test runner or dependencies.

**Interfaces:** Produces the shared browser contracts, `compareCommentTimestamps(a:string,b:string):number` in `data.ts`, `selectCommentAttempt(rows:CommentAttempt[],activeSubmissionId:string|null,explicitSubmissionId?:string):CommentAttempt|null` in `selection.ts`, `matchesCommentLocation(thread:CommentThread,location:CommentLocation):boolean`, and new picker reads/hooks. URL builder consumes `CommentLocation`; canonical cache/read/mutation target remains `ThreadTarget` only. Invalid explicit IDs never fall back to another attempt.

- [ ] First exercise actual current target/query/read behavior in a temporary controlled harness using installed TypeScript tooling and SDK HTTP fixtures. Show the red mismatch: same pair/two IDs currently share `threadPair` and pair RPC arguments, and parent parsing rejects `view=comments` plus `submission`. Use temporary files that are removed at closeout; do not create a frontend automated suite or compare implementation text as a behavioral test.
- [ ] Implement the shared types, strict Zod response parsing and `parseCommentAttempts(value,scope)`. Every parsed thread must match its target submission; destination mounting also checks returned activity/student against `CommentLocation`. Validate duplicate attempts, mixed-pair picker rows, cursor shapes, source status enum, positive versions, actual watermark, tombstone shape, and read-only/role flag consistency. Retain safe generic read errors without raw provider data.
- [ ] Change data RPCs/allowlisted request bodies to the exact shared signatures. `readUnreadCommentThreads` selects `submission_id` with existing pair metadata; reject null source on comment notices and key its Map by submission ID. Preserve paging beyond 1000 notices, cancellation, exact timestamp comparisons, retained-window deduplication and alerted-entry acknowledgment. `readCommentAttempts` walks keyset pages without losing older attempts; cache it by account and exact work scope, not by active attempt.
- [ ] Replace key construction and selection behavior with these contracts:

```typescript
export const commentKeys = {
  root: ["comments"] as const,
  account: (userId: string) => ["comments", userId] as const,
  thread: (userId: string, target: ThreadTarget) =>
    ["comments", userId, "thread", target.submissionId] as const,
  window: (userId: string, target: ThreadTarget, through: ThreadCursor | null) =>
    ["comments", userId, "thread", target.submissionId, through] as const,
  attempts: (userId: string, scope: WorkCommentScope) =>
    ["comments", userId, "attempts", scope.activityId, scope.studentId] as const,
  summaries: (userId: string, scope: ThreadScope) =>
    ["comments", userId, "summaries", scope] as const,
  unread: (userId: string) => ["notifications", userId, "comment-threads"] as const,
};

export function selectCommentAttempt(
  rows: CommentAttempt[], activeSubmissionId: string | null, explicitSubmissionId?: string
): CommentAttempt | null {
  if (explicitSubmissionId)
    return rows.find(row => row.submission_id === explicitSubmissionId) ?? null;
  const active = rows.find(row => row.submission_id === activeSubmissionId);
  if (active) return active;
  return [...rows].sort((a, b) =>
    compareCommentTimestamps(b.submitted_at, a.submitted_at) ||
      b.submission_id.localeCompare(a.submission_id)
  )[0] ?? null;
}
```

Keep the existing six-fractional-digit `timestampKey` normalizer in `data.ts` and export its comparison for selection, importing it into `selection.ts`:

```typescript
export function compareCommentTimestamps(a: string, b: string): number {
  return timestampKey(a).localeCompare(timestampKey(b));
}
```

The normalizer uses UTC seconds and the preserved original fractional digits, so different offsets/fraction widths keep SQL's exact chronological order. Explicit source selection takes precedence over counted/newest defaults. Do not silently move an open picker from a chosen old attempt when a new upload arrives.

Validate an explicit navigation location against the loaded source before mounting its body:

```typescript
export function matchesCommentLocation(thread: CommentThread, location: CommentLocation): boolean {
  return thread.submission_id === location.submissionId &&
    thread.activity_id === location.activityId && thread.student_id === location.studentId;
}
```

- [ ] Build exact URLs: teacher `/activities/{activityId}/submissions/{submissionId}?view=comments`; parent `/progress?child={studentId}&activity={activityId}&submission={submissionId}&view=comments`. Require each UUID exactly once, reject mixed `tab=grades`/comment view and duplicate/unsupported target values, verify route activity against loaded context, and require selected linked child consistency. Return a distinct invalid/legacy pair-only state that asks the user to choose a submission; never choose the latest as a parser fallback. Preserve existing non-comment grades/worksheet behavior.
- [ ] Update actions to post/lock new routes and invalidate that submission's thread plus relevant attempts/summaries and the shared notification source after successful writes/read/deletion. Retain no mutation retry, account token/cancellation checks, body-free sentinel on revoked read, and safe draft lifecycle. Move old `commentKeys.pair` users together to `commentKeys.thread`; do not leave an alias that still conflates uploads.
- [ ] Exercise actual parsing, selection, data requests and query behavior in the temporary harness: A/B same pair, equivalent timestamp offsets/microseconds, active/newest/explicit/missing targets, delayed A response after switching B, loaded-window refresh, own newer post without exact alerted entry, null notification source, duplicate/foreign-child URLs, more-than-one unread page, and account revocation. Then run scoped ESLint and syntax checks. Global TypeScript may identify unported UI targets until Tasks 6–7; list those exact consumers and do not claim a full pass. Commit `refactor: key browser conversations by submission`.

### Task 6: Shared submission thread and teacher entry points

**Files:** Rename `frontend/components/comments/student-work-thread.tsx` and `student-work-thread-sheet.tsx` to `submission-comment-thread.tsx` and `submission-comment-thread-sheet.tsx`; create `submission-comment-picker.tsx`; modify `activity-threads.tsx`, `frontend/components/submissions/{submission-detail-content,submission-detail-dialog}.tsx`, `frontend/app/(teacher)/activities/[id]/page.tsx`, `frontend/app/(teacher)/activities/[id]/submissions/[submissionId]/page.tsx`, and `frontend/components/gradebook/{work-grade-sheet,teacher-gradebook,gradebook-cell}.tsx`.

**Interfaces:** `SubmissionCommentThread({userId,target,open}:{userId:string;target:ThreadTarget;open:boolean})`; existing sheet presentation accepts a `CommentLocation|null` and `onOpenChange`, while canonical child thread sees only `{submissionId}`. `SubmissionCommentPicker` takes `userId,scope,activeSubmissionId,explicitSubmissionId?,open` and mounts a selected thread from `useCommentAttempts`/`selectCommentAttempt`. Prop changes and React keys include account/submission ID.

- [ ] Before UI changes, use a controlled localhost fixture with two same-child uploads: open one teacher submission and demonstrate the absent submission Comments view / shared old thread target. Record the red behavior without changing hosted accounts. Use existing installed preview tooling; no new dependency or persistent fixture route.
- [ ] Rename and retarget the reusable thread, preserving message primitives, chronological retained history, older-page scroll, jump-to-latest, audience hint, 1000-code-point counter, bounded textarea, safe mutation states, deletion confirmation, author checks, and separate teacher lock/unlock. Add upload timestamp/status context from the loaded thread outside the message list; labels never require access to another parent's profile.
- [ ] In teacher page/dialog layouts, place Comments beside submission details, mounted independently of image/overlay/score loading and available for processing/rejected/returned uploads. Use existing tabs and one dialog/sheet surface. Representative integration inside an already-mounted submission view is:

```tsx
const [selectedView, setSelectedView] = useState<"details" | "comments">(initialView);

<Tabs value={selectedView} onValueChange={value => setSelectedView(value as "details" | "comments")}>
  <TabsList aria-label="Submission view">
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="comments">Comments</TabsTrigger>
  </TabsList>
  <TabsContent value="details">{details}</TabsContent>
  <TabsContent value="comments">
    <SubmissionCommentThread
      key={`${userId}:${submission.id}`}
      userId={userId}
      target={{ submissionId: submission.id }}
      open={open && selectedView === "comments"}
    />
  </TabsContent>
</Tabs>
```

Here `details` is the existing details subtree and `initialView` is validated `details|comments`. Pass the actual signed-in account ID and open state through the teacher page/dialog props; do not substitute the activity owner's ID for the authenticated viewer when constructing cache identity. Keep hooks before status-dependent returns and do not render two active copies of the same thread.

- [ ] Implement the attempt picker with a labelled select, upload time/status options and per-submission unread labels. Mount only its selected submission thread; show the exact no-upload explanation when no rows exist. Use counted attempt then newest as defaults only on initial opening. On a source deletion or denied read, clear private content and require a visible new selection rather than silently transferring a draft to another upload.
- [ ] Change activity submission-row actions/history to exact locations. Remove the old assigned-student no-upload Comment composer/action. Retained activity history lists per-submission summaries with upload times. In gradebook work sheet use the picker instead of a work-wide `StudentWorkThread`; its aggregate unread dot remains set while any source attempt is unread. Compute it from the batched notification Map's activity/student metadata, not only `active_submission_id`, and do not fetch one query per cell.
- [ ] Validate direct teacher URLs against route activity and submission context before mounting. A previous activity-only `?student=...&view=comments` link shows the choose-submission message; invalid/deleted/foreign targets show safe unavailable. For `view=comments`, load authorized thread context independently of the full `useSubmissions` worksheet query: its current unavailable/empty early return must not block former-roster comment history. Render the safe submission-labelled thread with Details unavailable when appropriate. Do not widen worksheet access or expose hidden Return notes.
- [ ] Manually exercise teacher direct page and dialog, same-child A/B selection/draft clearing, old returned attempt with unread while newest is read, rejected/processing/no-image state, no-upload grade cell, archived/unassigned history, old/deleted/foreign links, phone layout and keyboard/focus. Run scoped lint and changed-view browser checks; commit `feat: show private comments on teacher submission views`.

### Task 7: Parent submission views and exact comment notifications

**Files:** Modify `frontend/components/parent/{worksheet-view-dialog,pending-worksheet-dialog,submission-history-dialog,latest-submission-card,take-home-activities,notification-work-destination}.tsx`, `frontend/app/(parent)/progress/progress-content.tsx`, `frontend/components/gradebook/parent-grades.tsx`, `frontend/components/comments/parent-activity-threads.tsx`, `frontend/lib/hooks/use-parent-data.ts`, `frontend/lib/hooks/use-dashboard.ts` if source activity identity is missing, and `frontend/lib/notifications/{data,presentation}.ts` plus `frontend/components/notifications/notification-bell.tsx` only where activation needs adjustment. Preserve the existing notification-read API/hooks.

**Interfaces:** Consumes `CommentLocation`, picker and thread props, `matchesCommentLocation`, and shared `UnreadCommentThreads`. Parent target includes `childId,activityId,submissionId,view:'comments'`; exact metadata must match a loaded authorized source. When extending existing parent history/latest DTOs, add only required source IDs, not unreleased score data.

- [ ] Establish the red behavior with a controlled parent fixture: A and B same child/activity, A unread, open B and prove the existing pair target cannot distinguish them. Include a pending/rejected attempt without released feedback and an in-class attempt; a comments action must not require a released score/worksheet viewer.
- [ ] Integrate the shared Comments view inside `WorksheetViewDialog` and `PendingWorksheetDialog`; history/latest actions pass the exact source UUID and server-derived child/activity IDs. Reuse the existing parent viewer surface and selected-sibling state. Supply source activity identity through existing RLS reads where missing, keeping score release gates unchanged. Make direct comment deep links usable even when the worksheet detail itself is unavailable but retained comment access remains authorized.
- [ ] Update Practice/Grades shortcuts to use the explicit picker, with counted/newest default and historical attempts available. Remove no-upload activity-level conversations/composers. Parent retained history lists individual source threads, including returned/rejected uploads, with precise upload labels. A grades-only zero/excuse row with no upload shows the no-submission explanation and no thread.
- [ ] Replace the progress comment destination branch with an exact `CommentLocation` and validate child/activity/submission together before rendering. The URL builder in notification presentation must use all three identifiers:

```typescript
if (row.type === "comment_posted") {
  if (!row.submission_id) return "/progress";
  return commentThreadHref({
    submissionId: row.submission_id,
    activityId: row.activity_id,
    studentId: row.student_id,
  }, role);
}
```

Use role-appropriate safe unavailable navigation for malformed/null-source notices (teacher activity fallback, parent progress fallback), never a guessed attempt. Proper migrated comment rows cannot have null sources; test the malformed input path rather than assuming it cannot occur in a stale client.

- [ ] Preserve bell navigate-before-acknowledge. Its comment target must load/render the exact alerted submission and exact alerted version before automatic read. Explicit bell mark-read uses that row's version; all-read preserves snapshot semantics. Own replies do not clear unread. New comments on A while B is open update A's badge without marking A read or switching B. Ordinary Return/rejection/release notifications and points-only grade destinations retain their behavior.
- [ ] Exercise two linked parents and two siblings, same-child uploads, parent/teacher comments both directions, immediate draft visibility without score leakage, in-class/rejected/pending and no-upload paths, old attempts after Return/resubmit, foreign/mismatched/duplicate targets, selected-child preservation on close, revoked link/account while open, own-post/newer-version acknowledgment, and ordinary bell links. Check mobile and keyboard/focus. Run whole-frontend ESLint/TypeScript and production build; fix every remaining old pair-shaped caller/import rather than keeping a pair adapter. Commit `feat: connect parent and bell comments to exact uploads`.

### Task 8: Deletion confirmation and private cache cleanup

**Files:** Create `frontend/lib/comments/invalidation.ts`; modify `frontend/lib/hooks/use-submissions.ts`, teacher activity/submission single/bulk dialogs, `frontend/components/parent/{take-home-activities,worksheet-view-dialog}.tsx`, and any remaining submission deletion surface found by `rg -n 'useDeleteSubmission|useBatchDeleteSubmissions|batch-delete|Delete Attempt|Delete Photo' frontend`. Preserve backend deletion routes/permissions verified in Tasks 3–4.

**Interfaces:** `clearDeletedSubmissionComments(queryClient:QueryClient,submissionIds:readonly string[]):Promise<void>` cancels exact thread reads and retained windows, replaces cached private thread bodies with body-free null sentinels for mounted observers, invalidates picker/history/summaries and notifications, and leaves other submission threads intact. Existing `invalidateWorkQueries` continues updating academic/work queries. Query cancellation cannot undo a committed post; database serialization/cascade remains authoritative for an in-flight write.

- [ ] With actual TanStack Query/controlled fetch in the temporary harness, load A and B, begin a delayed A history read, then delete A. Demonstrate the red failure if A's stale body can reappear or B is accidentally cleared. Include partial bulk success via the response's `deleted_ids`, empty success, denied graded-parent response and a failed DB delete.
- [ ] Implement cleanup keyed by successful response source IDs. The callback boundaries are:

```typescript
// useDeleteSubmission onSuccess:
await clearDeletedSubmissionComments(queryClient, [result.id]);
invalidateWorkQueries(queryClient);

// useBatchDeleteSubmissions onSuccess:
await clearDeletedSubmissionComments(queryClient, result.deleted_ids);
invalidateWorkQueries(queryClient);
```

Use actual returned IDs, not all requested IDs. Do not clear bodies on a failed delete; invalidate academic eligibility on `SUBMISSION_ALREADY_GRADED` as today. In cleanup cancel each `[comments,userId,'thread',submissionId]` prefix, set matching observer data to null, and invalidate account-scoped attempts/summaries plus the notification root. Derive account IDs from matching comment query keys or pass them through the existing account-scope plumbing; do not read a new session after an awaited request and mutate another account's cache. Avoid importing hooks into plain invalidation utilities or creating a circular dependency.

- [ ] Update every single/bulk confirmation to name comments as permanently deleted. Teacher wording includes photo, CV analysis and manual rubric as appropriate; parent wording preserves existing eligibility/grade explanations. Bulk wording names that comments on the selected deleted submissions are removed. Do not add a new comment-based authorization rule or protection checkbox.
- [ ] Validate active dialog/thread closure or unavailable state after single/bulk deletion, B's unaffected discussion/unread, stale A URL safe response, canceled pagination, no draft transfer, graded-parent denial, and database/Storage failure retention. Repeat keyboard/focus and mobile deletion confirmation checks. Run whole-frontend lint/types and the controlled cache harness; commit `fix: remove submission conversations with deleted attempts`.

### Task 9: Seventh upgrade proof, final regression gates, and documentation

**Files:** Create `backend/tests/migrations/submission_comment_upgrade_check.py`; modify existing `comment_upgrade_check.py`, `.github/workflows/ci.yml`, generated types if schema/API changed after Task 4; update `docs/{DESIGN,DATABASE,API_SPEC,TESTING,DEPLOYMENT}.md`, `docs/next_steps/PHASE_3_CLASSROOM_ACTIVITIES.md`, `IMPLEMENTATION_STATUS.md`, the approved spec and this execution record. Preserve all previous evidence and applied migrations.

**Interfaces:** New localhost-only script accepts `prepare|schema|legacy-comment|legacy-notice|blocked|verify --manifest <path>`. Its manifest stores only synthetic IDs, counts and hashes. Require `ENVIRONMENT=test` and localhost for both API/DB URLs before creating clients. `prepare` starts from latest old comment migration `20261109131320` with no legacy comments/notices; `legacy-comment`/`legacy-notice` add a single synthetic old row and record its before-hash for an expected migration-failure proof; `blocked` checks that hash/schema/migration history remain unchanged. These failure modes run on isolated resets, never against hosted env values.

- [ ] Write the proof's schema red assertions before final CI wiring:

```python
def schema():
    assert db_value("select to_regclass('public.submission_comment_thread')") is not None
    assert db_value(
        "select exists(select 1 from information_schema.columns "
        "where table_schema='public' and table_name='private_comment' "
        "and column_name='submission_id' and is_nullable='NO')"
    )
    assert not db_value(
        "select exists(select 1 from information_schema.columns "
        "where table_schema='public' and table_name='student_work' "
        "and column_name in ('comments_locked','comment_version'))"
    )
```

Import the existing guarded `db_value` and fingerprint helpers from the migration scripts, not the application/pytest bootstrap. `prepare` fingerprints explicit pre-existing academic/source/assignment/grade/release fields, ordinary notification timestamps/read/dedupe rows, private receipts, outbox and preferences; excluded obsolete comment fields must not change unrelated business fingerprints. Include two same-child uploads, one returned, draft/released facts, no-upload points-only work, another child/family, and ordinary unread/read notices.

- [ ] Update the six existing upgrade proofs to verify the final schema/contract. In `comment_upgrade_check.py`, replace old work-column defaults/no-upload posting/pair RPC assertions with absent state rows, exact-source new reads/posting and unchanged pre-comment fingerprints; preserve its legacy baseline `20261108062937`. Keep the other five historical baseline versions and rollback/security assertions. Do not leave a verifier that posts a legacy activity-wide comment before a later cutover migration.
- [ ] Add a seventh CI step before network-guard replay. The successful path is:

```bash
supabase db reset --local --version 20261109131320
cd backend
ENVIRONMENT=test uv run python tests/migrations/submission_comment_upgrade_check.py prepare --manifest /tmp/submission-comment-upgrade.json
if ENVIRONMENT=test uv run python tests/migrations/submission_comment_upgrade_check.py schema --manifest /tmp/submission-comment-upgrade.json; then
  exit 1
fi
cd ..
supabase migration up --local
cd backend
ENVIRONMENT=test uv run python tests/migrations/submission_comment_upgrade_check.py verify --manifest /tmp/submission-comment-upgrade.json
cd ..
supabase db reset --local
```

- [ ] Add two separate failure-path resets to the old baseline. Run `prepare`, then `legacy-comment` or `legacy-notice`, whose manifest captures the hash of legacy rows, ordinary data, and migration history before `supabase migration up --local`. Require a nonzero migration result with the fixed preflight message, then run `blocked` to verify the exact hashes and schema remain unchanged. For the isolated old-notice case insert an old-format comment notification with a synthetic dedupe key and version even if no comment remains; it must independently block. No old text appears in stdout, fixtures' manifest, SQL exception text, or CI logs. The final reset clears only this disposable fixture environment.
- [ ] In successful `verify`, assert fingerprints unchanged, no fabricated threads/comments/notices, full obsolete RPC/grant retirement, RLS policies/helper security and indexes, and final type shapes. Then post to A and B, independently lock/read them, return/read only A's timeline, run post-read-post notification cycles, unlink/deny a parent, delete one source and prove B and ordinary email/grade facts remain. Use real caller sessions for access claims.
- [ ] Run all backend tests on the disposable stack plus all seven upgrade proofs, network guard, security-advisor error gate, generated API/DB comparisons and Ruff/ESLint/TypeScript. Run production `next build --webpack` using test-only localhost public settings when the worktree's shared dependencies require webpack. Keep exact artifact/source pairing and rerun final head after generated types are committed. Required tests include existing assignment/release/notifications/email/gradebook/deletion/research regressions, not only new comment modules.
- [ ] Perform the complete spec §9 portal acceptance matrix, recording observed controlled checks separately from signed-in user QA: teacher and two parents, two siblings, two same-child uploads, processing/rejected/draft/released/returned states, in-class/closed/past-due/excused work, no-upload grades, per-attempt lock/unread/Return isolation, counted/newest/explicit selection and pin changes, old/comment/history/bell links, source deletion/denial/failure, revoked access/account switch, 360px viewport, long Unicode text, keyboard dismissal and opener focus. Remove temporary controlled harness/routes/processes; leave dependencies and user env files unchanged.
- [ ] Promote exact storage, API/error/RPC shapes, helper grants, cursors, independent thread rules, deletion confirmations, preflight and coordinated rollout into companion docs. Replace Q21/Q25/Q26/Q27/Q28 and Slice 6 artifacts in the Phase 3 proposal with links to this approved design while preserving accepted unrelated decisions. Record the required empty-legacy preflight operational prerequisite without authorizing hosted deletion/reset. Keep email activation separate.
- [ ] Self-review source/spec coverage inline and request read-only review of migration/RLS, transactions/deletion ordering, source identity, private errors, notification read races, portal targets and grade isolation. Use a subagent only if the user selected delegation; otherwise review inline. Fix material findings and rerun affected checks plus the required final full gates. Update this plan's boxes/evidence with actual outcomes; do not mark execution tasks done on planning checks.
- [ ] Commit `docs: record submission comment verification` only with evidence actually obtained. Until redesigned automated and focused portal gates pass, retain Implemented/Partial with exact open work, not Verified. Phase 3 remains 4/6 verified until a slice qualifies; Slice 4's email manual/operational gates remain independent. Preserve the worktree and all local environment files. No merge/deploy/hosted migration follows implicitly.

## Review checkpoints and coverage

| Spec section | Delivering tasks and required evidence |
|---|---|
| §1 Separate submission, statuses, participants, no-upload | 1–4 source/RLS/absence proofs; 6–7 direct views/picker QA |
| §2 Submission vs author deletion, bulk/failures/cache | 1 cascade; 3 observed deletion races/permissions; 4 real route+Storage failures; 8 UI/cache |
| §3 Store, indexes, retained owner context, grants | 1 schema/RLS; 2 private context/enumeration; 9 upgrade/advisor proof |
| §4 Transaction ordering/revocation/grade isolation | 3 observed SQL races/rollback; 4 API prechecks/error privacy |
| §5 Feed/API/pagination/Return exact source | 2 feed/cursors; 4 real contracts/types; 5 runtime parse/window checks |
| §6 Source notifications/coalescing/read snapshots | 3 real notices/races; 5 Map identity; 7 bell and aggregate UI |
| §7 Both portals/picker/deep links/no-upload/accessibility | 5 targets/selection; 6 teacher; 7 parent; 8 deletion; 9 full manual matrix |
| §8 Forward empty-legacy cutover/old RPC retirement/types | 1 preflight; 4 paired types; 9 seventh proof and coordinated rollout docs |
| §9 All verification/privacy/export/regressions | 1–8 focused checks; 9 final full suite, seven proofs, sentinel, portal acceptance |

## Planning self-review and handoff

Self-review is inline, not a subagent dispatch. Check every spec row above against a producing task, run the missing-content marker scan, confirm SQL/API/browser names and field types agree, verify every referenced existing path/fixture, and parse Python/TypeScript/TSX examples with installed tools. Check the plan never treats `auth.uid()` under a service client as actor authority, conflates pair/submission notification identities, acknowledges B by opening A, moves drafts on picker defaults, or claims old CI verifies this redesign.

This is one coordinated subsystem, not independent projects: storage, reads, writes, notifications and portal entry points must agree on the source identity before rollout. No additional product design or separate inbox is introduced. All nine execution tasks remain unchecked at planning handoff. After the plan is saved, offer inline execution with checkpoints or explicitly selected delegated execution; no agent work or application changes start during planning.

**Planning verification (2026-11-10):** Backend Ruff, whole-frontend ESLint and TypeScript (`--noEmit --incremental false`) passed using the worktree's installed tools. Nine Python examples parsed with AST and seven TypeScript/TSX examples passed syntax parsing; none was executed as application code. Twenty-six local Markdown links resolved, all nine tasks were ordered, all 69 execution steps remained unchecked, and the required header/missing-content-marker checks passed. Inline spec review corrected fixture-state access, exact timestamp ordering, historical-owner navigation, service-versus-caller context, per-migration generated types and source-deletion cache behavior. `git diff --check` passed. These are planning/baseline checks, not migration, database, API, notification-race, or portal verification of the redesign.
