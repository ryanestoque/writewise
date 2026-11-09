# Phase 3 Slice 6 — Private Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (when explicitly selected by the user) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the approved spec and this entire plan first. Default to inline execution; this planning pass dispatches no agents.

**Goal:** Add private student-work conversations shared by the owning teacher and linked parents, with retained read-only history, author deletion, teacher locking and race-safe in-app unread alerts.

**Architecture:** Store comments against the existing activity/student work pair. Caller-scoped security-invoker functions read an RLS-filtered chronological feed; FastAPI-authorized service-only functions post, scrub and lock transactionally. Reuse the notification table as unread state and integrate one thread component into existing work screens.

**Tech Stack:** Existing Python 3.13, FastAPI/Pydantic v2, Supabase PostgreSQL 17/PostgREST, pytest/asyncpg, Next.js 16.2.12/React 19.2.4, TanStack Query and Base UI shadcn components. The installed `@shadcn/react@0.2.1` already provides the scroller primitive. Keep lockfiles and dependencies unchanged.

**Spec:** [Approved private-comments design](../specs/2026-11-09-phase3-private-comments-design.md). On 2026-11-09 the user accepted the conversational design, reviewed the written-spec handoff, and explicitly requested this writing-plans pass.

## Execution record

**Execution start (2026-11-09):** The user selected inline execution. The existing isolated worktree now uses `feat/phase3-private-comments`, based on plan commit `90a2fa3`; the documentation branch and other worktrees remain intact. Task 1 is in progress: real signed-in storage/RLS/history cases and the new branch's CI trigger are prepared. Tasks 2–10 are not started, and no execution checkbox is complete.

**Baseline and runner:** The existing locked Python environment was reused without copying a hosted `.env`. The first database-free baseline exposed three required settings missing from this plan's dummy setup (`SUPABASE_JWT_SECRET`, `SUPABASE_DB_URL`, `CORS_ALLOWED_ORIGINS`); the setup below is corrected. With explicit dummy localhost settings, **274 unit cases passed**, with one upstream Starlette/TestClient deprecation warning. Backend Ruff and whole-frontend ESLint/TypeScript passed. Supabase CLI 2.115.0 is cached and available; local startup failed with `LegacyDockerLifecycleInspectError` because Docker and Podman are absent. No hosted database was contacted. The new database tests have not run; their absent-schema red proof requires the disposable CI runner and authorization to publish this new branch. No migration or application implementation has been written at this checkpoint.

**Runner authorization and independent API work:** The user explicitly authorized publishing `feat/phase3-private-comments` and subsequent implementation/test checkpoints to public `ryanestoque/writewise` for disposable CI and actual generated types. Initial test commit `ca8e158` is published as [CI 42614843992](https://github.com/ryanestoque/writewise/actions/runs/42614843992); the database red proof is pending. While that runs, Task 5's independent contracts/API boundary advanced: forty request/metadata cases first failed on absent models, and twenty-one mounted-route/privacy cases failed on absent/old behavior (three existing negative behaviors already passed). Contracts, relationship prechecks, fixed errors, author deletion/owner lock routes and version-aware notification reads now pass **71 focused cases**; all **338 database-free unit cases** pass with the same upstream warning. API types were regenerated from the actual app using the pinned 7.13.0 generator. SQL transactions, real-JWT API integration and portal work remain pending; Task 5 is not complete and no schema implementation is claimed by this checkpoint.

## Global Constraints

The following requirements are copied verbatim from the spec; every task includes them:

- “One thread belongs to a **student × activity**, anchored by `student_work`.”
- “A newly linked parent sees its existing history.”
- “Removing a parent link revokes that parent's thread access.”
- “There is no editing.”
- “Posting requires current assignment, a non-archived activity, and an unlocked thread.”
- “Upload closure is not comment closure.”
- “Teacher locking stops new posts from everyone, including the teacher, until unlocked.”
- “Changing a comment lock must not redraft a grade or reconcile an unrelated score source.”
- “Return events are read-only projections of existing submission records.”
- “All browser mutation grants are denied.”
- “Add no dependency, queue, worker, Realtime subscription or frontend test framework.”
- “Opening an assigned empty thread is a read, not an upsert.”
- “Use the existing activity-before-work lock order.”
- “The existing unread notification remains the sole per-recipient/thread unread state.”
- “Never enqueue email for this type or add comment text to notifications or receipts.”
- “Do not persist drafts in local storage or across account/child changes.”

Also preserve all AGENTS.md hard rules, SQL-first migrations, actual generated contracts, the standard error envelope, code-based frontend error branches, image checks/EXIF stripping/persisted rejections, research export boundaries, ScoreProvider, model startup rules, the single in-process pipeline and one Uvicorn worker.

## Planning baseline and execution prerequisites

- The plan is prepared in `.worktrees/phase3-private-comments` on `docs/phase3-private-comments`, after spec commit `b2fff03`, based on gradebook closeout `cb23d5c`. Main `6c77b06` and the separate email worktree `0208549` were preserved.
- Slices 1–3 and 5 are recorded Verified; Phase 3 remains **4/6 verified**. Slice 4's manual/operational gates remain open. This plan supplies no new implementation or test evidence.
- At execution, inspect branch heads and worktree status again. Use using-git-worktrees to establish `feat/phase3-private-comments` with this spec/plan and the gradebook foundation. If an external harness already provides isolation, use it. Do not start against older main, move source branches, or discard user files.
- Local records show Docker/Podman unavailable. Probe the current runtime before relying on that record. A container-capable local stack is preferred; otherwise publish only this new feature branch to the existing repository's disposable CI after obtaining authorization for that branch. Do not infer publishing permission from authorization for an earlier slice.
- Keep migrations and regenerated DB types together in delivery commits. For a CI-only runner, publish explicitly provisional schema checkpoints, retrieve the real `database-types` artifact for the exact head, verify its source SHA/migration contents, pair the byte-for-byte artifact into the feature branch, and run final-head CI. Never invent generated types, suppress drift gates, or claim an intentionally failing provisional run is green.
- Existing CI checks API drift before pytest. Regenerate API types locally before a route/schema delivery. DB types are generated/uploaded before pytest and compared at the end; an expected provisional DB comparison failure is distinct from feature-test failures.
- Use the approved localhost test setup in docs/TESTING.md §3.1.1. Before importing test fixtures, require `ENVIRONMENT=test`, explicit localhost Supabase API/DB URLs, and keys obtained from the ephemeral stack. Never reset hosted dev/prod. Never print keys or load hosted defaults into tests.

Execution setup, from the selected isolated checkout:

~~~powershell
git status --short
git log -1 --oneline
git merge-base --is-ancestor cb23d5c HEAD
supabase --version
supabase start --help
supabase db reset --help
supabase migration new --help
supabase gen types --help
~~~

Use the existing installed CLI/locked tools. If the CLI is not on PATH, the repository's previous execution used `npx.cmd --yes supabase@2.115.0`; inspect that version's help rather than assuming flags. Start/reset/test/stop uses only the disposable local stack. On Windows use `npm.cmd`/`npx.cmd` if PowerShell blocks the script shim; do not change execution policy.

For database-free cases from `backend/`:

~~~powershell
$env:ENVIRONMENT = 'test'
$env:SUPABASE_URL = 'http://127.0.0.1:54321'
$env:SUPABASE_SERVICE_ROLE_KEY = 'unit-test-service-key'
$env:SUPABASE_ANON_KEY = 'unit-test-public-key'
$env:SUPABASE_JWT_SECRET = 'unit-test-jwt-secret'
$env:SUPABASE_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
$env:CORS_ALLOWED_ORIGINS = 'http://localhost:3000'
$env:MODEL_ARTIFACT_PATH = ''
$env:HTR_MODEL_ARTIFACT_PATH = ''
uv run --frozen python -m pytest tests/unit --confcutdir=tests/unit -q
~~~

These dummy keys are only for database-free controlled transports. Integration commands must instead use real disposable-stack settings. Do not run integration tests with these values.

## File map and task boundaries

| Task | Create | Modify |
|---|---|---|
| 1 Storage, RLS and historical scope | CLI migrations `phase3_comment_kind`, `phase3_comment_store`; `backend/tests/rls/comment_support.py`, `test_comment_storage.py` | CI feature trigger, old upgrade fingerprints where new nullable columns affect comparison, generated DB types, notification copy enum map |
| 2 Feed and discovery | CLI migration `phase3_comment_reads`; `backend/tests/rls/test_comment_reads.py` | Generated DB types |
| 3 Atomic mutations and emission | CLI migration `phase3_comment_mutations`; `backend/tests/rls/test_comment_mutations.py`, `test_comment_notifications.py` | Comment test support, generated DB types |
| 4 Read snapshots and concurrency | CLI migration `phase3_comment_receipts`; `backend/tests/rls/test_comment_races.py` | Existing notification read tests, generated DB types |
| 5 FastAPI and privacy | `backend/app/comments/__init__.py`, `contracts.py`, `access.py`, `repository.py`, `errors.py`; `backend/app/api/comments.py`; `backend/tests/unit/test_comment_contracts.py`, `test_comment_routes.py`, `test_comment_privacy.py`; `backend/tests/rls/test_comment_api.py` | `backend/app/main.py`, API notification contracts/routes and their unit cases; generated API types |
| 6 Browser data and account lifetime | `frontend/lib/comments/types.ts`, `data.ts`, `transport.ts`, `targets.ts`, `query-keys.ts`; `frontend/lib/supabase/account-scope.ts`; `frontend/lib/hooks/use-comments.ts` | Notification account cleanup/read transport/hooks/query keys |
| 7 Shared thread UI | `frontend/components/comments/student-work-thread.tsx`, `comment-composer.tsx`, `thread-entry.tsx`, `student-work-thread-sheet.tsx`; missing local UI wrappers `message-scroller.tsx`, `message.tsx`, `marker.tsx` | No package or lockfile changes |
| 8 Teacher integration | `frontend/components/comments/activity-threads.tsx` | Teacher activity detail page, gradebook cell/grid/work sheet |
| 9 Parent and bell destinations | `frontend/components/comments/parent-activity-threads.tsx` | Parent progress, activity/grade actions, parent provider, notification target/parser/presentation/row/list/bell |
| 10 Upgrade, regressions, docs and closeout | `backend/tests/migrations/comment_upgrade_check.py` | CI; actual generated contracts; API_SPEC, DATABASE, DESIGN, ARCHITECTURE, SECURITY, TESTING, DEPLOYMENT where required, proposal/tracker, this execution record |

Migration labels above are CLI arguments, not filenames. Record each actual returned path at execution and leave applied historical SQL unchanged. Avoid splitting the existing large activity or progress page beyond extracting these focused components.

After allocation, verify the new migration versions are unique and strictly ordered, with kind before store before reads before mutations before receipts. If CLI calls occur within one timestamp tick, resolve the allocation through the CLI before applying anything; do not invent a timestamp or reorder an already-applied migration.

## Shared interfaces

### Database names, grants and shapes

Use `integer` for the thread/comment/notice versions: positive posted versions, zero only on an empty work counter, with the PostgreSQL integer upper bound also enforced in HTTP validation. This preserves exact JavaScript integers without a new wire representation.

All public write RPCs are SECURITY INVOKER, empty search path, service-role-only. Reads are SECURITY INVOKER, empty search path, authenticated/service execution, and derive the caller from `auth.uid()`. Private helpers remain in `writewise_internal`; revoke PUBLIC/anon defaults explicitly.

| Name | Exact signature/result | Task |
|---|---|---|
| `has_comment_work_history`, private | `(work_activity uuid, work_student uuid) -> boolean`; narrowly scoped definer history predicate checking current owner/parent, no caller actor parameter | 1 |
| `has_comment_activity_history`, private | `(work_activity uuid) -> boolean`; authorized history across the caller's linked children or owned activity | 1 |
| `can_read_comment_work`, private | `(work_activity uuid, work_student uuid) -> boolean`; invoker scope, owner/current parent AND assigned/comment/submission/grade history | 1 |
| `read_private_comment_thread`, public | `(target_activity_id uuid, target_student_id uuid, before_cursor jsonb DEFAULT NULL, page_size integer DEFAULT 50) -> jsonb` | 2 |
| `list_private_comment_threads`, public | `(target_activity_id uuid DEFAULT NULL, target_student_id uuid DEFAULT NULL, before_cursor jsonb DEFAULT NULL, page_size integer DEFAULT 50) -> jsonb`; exactly one target, teacher-owned activity or parent's linked child | 2 |
| `normalize_comment_body`, private | `(raw_body text) -> text`; trimmed valid text or WW422 | 3 |
| `comment_write_context`, private | `(actor_id uuid, work_activity uuid, work_student uuid) -> jsonb`; after activity/work locks, one fresh authorization/assignment/participant snapshot | 3 |
| `put_comment_notification`, private | `(recipient uuid, work_activity uuid, work_student uuid, target_comment uuid, target_version integer, event_at timestamptz) -> uuid` | 3 |
| `post_private_comment`, public | `(actor_id uuid, target_activity_id uuid, target_student_id uuid, comment_body text) -> jsonb`; CommentPosted | 3 |
| `delete_private_comment`, public | `(actor_id uuid, target_comment_id uuid) -> jsonb`; `{deleted: true}` after body scrub, idempotent own tombstone | 3 |
| `set_comment_thread_lock`, public | `(actor_id uuid, target_activity_id uuid, target_student_id uuid, locked boolean) -> jsonb`; CommentLockState | 3 |
| `mark_comment_notification_read`, public | `(actor_id uuid, target_notification_id uuid, expected_comment_version integer) -> jsonb`; unchanged NotificationReadResponse on success | 4 |

Preserve the two-argument `mark_notification_read(uuid,uuid)` signature, but make it reject comment rows without a version. Preserve `mark_all_notifications_read(uuid)` signature and response. Do not extend `mutate_student_work` for locks.

The RPC thread JSON is a browser read model, validated in `comments/data.ts`; it is not a hand-maintained substitute for generated HTTP types:

~~~typescript
export type ThreadCursor = { event_at: string; kind: "comment" | "return"; id: string };
export type ThreadTarget = { activityId: string; studentId: string };
export type CommentEntry = {
  kind: "comment"; id: string; event_at: string; author_role: "teacher" | "parent";
  is_mine: boolean; body: string | null; deleted_at: string | null; comment_version: number;
};
export type ReturnEntry = {
  kind: "return"; id: string; event_at: string;
  return_reason: "wrong_worksheet" | "blurry_or_cropped" | "wrong_target_text" | "incomplete" | "other";
  return_note: string | null;
};
export type ThreadEntry = CommentEntry | ReturnEntry;
export type CommentThread = {
  activity_id: string; student_id: string; activity_title: string;
  actor_role: "teacher" | "parent"; assigned: boolean; is_archived: boolean;
  comments_locked: boolean; can_post: boolean; can_lock: boolean;
  read_only_reasons: ("unassigned" | "archived" | "locked")[];
  entries: ThreadEntry[]; next_cursor: ThreadCursor | null;
  seen_comment_version: number | null;
  unread_notice: { id: string; comment_version: number } | null;
};
export type ThreadSummaryCursor = {
  last_comment_at: string; student_id: string; activity_id: string;
};
export type ThreadSummary = {
  activity_id: string; student_id: string; activity_title: string; student_label: string;
  last_comment_at: string; assigned: boolean; is_archived: boolean; comments_locked: boolean;
};
export type ThreadSummaries = { rows: ThreadSummary[]; next_cursor: ThreadSummaryCursor | null };
~~~

Feed order is `(event_at, kind, id)` with `comment < return`. Return IDs are submission IDs. SQL pages are newest-first; render the retained union oldest-first. Summary order is `(last_comment_at, student_id, activity_id)` descending. Validate complete cursor objects and page sizes 1–100; malformed cursors raise WW422. Keep microseconds rather than round-tripping cursors through JavaScript Date.

### HTTP contracts and safe errors

| Route | Request | Success |
|---|---|---|
| POST `/api/activities/{activity_id}/students/{student_id}/comments` | CommentPostRequest `{body: string}`, no other fields | 201 CommentPosted: UUID `id/activity_id/student_id`, actual `author_role`, aware `created_at`, positive `comment_version`; no echoed body |
| DELETE `/api/comments/{comment_id}` | No body | 204, including repeated deletion by an authorized author |
| PUT `/api/activities/{activity_id}/students/{student_id}/comments/lock` | CommentLockRequest `{locked: strict boolean}` | 200 CommentLockState `{activity_id,student_id,comments_locked}` |
| POST `/api/notifications/{notification_id}/read` | Optional NotificationReadRequest `{expected_comment_version?: positive strict integer}`; required for comment rows | Existing `{id,read_at}` |

New Python contracts live in `app/comments/contracts.py`. Existing notification request/response models stay in `app/api/notification_contracts.py`. Generate HTTP TS types from OpenAPI; use `components["schemas"]["CommentPostRequest"]` and the other generated names in browser mutations.

| SQLSTATE | HTTP/public code | Fixed message |
|---|---|---|
| WW404 | 404 NOT_FOUND | Conversation not found. |
| WW412 | 404 ACTIVITY_NOT_ASSIGNED | This activity is no longer assigned. |
| WW422 | 422 VALIDATION_ERROR | Check the comment request. |
| WW440 | 409 COMMENTS_LOCKED | This conversation is locked. |
| WW441 | 409 ACTIVITY_ARCHIVED | This activity is archived. |
| WW442 | 409 COMMENT_READ_CONFLICT | New comments arrived. Refresh the conversation. |
| Other SDK/transport/internal failure in comment boundaries | 500 INTERNAL_ERROR | Could not update the conversation. Try again. |

WW440–WW442 were unused in the inspected baseline; recheck before execution. Missing/foreign actor, pair or comment takes precedence over state disclosure. For a readable participant, post checks unassigned, then archived, then locked. Authentication and UUID validation retain existing 401/422 envelopes. Never expose raw SDK details or body-containing exception chains.

### Browser functions used across tasks

| File | Export |
|---|---|
| `comments/data.ts` | `readThreadPage(client,target,before,signal): Promise<CommentThread>`; `readThreadWindow(client,target,through,signal): Promise<CommentThread>`; `readThreadSummaries(client,scope,before,signal): Promise<ThreadSummaries>`; `readUnreadCommentThreads(client,userId,signal): Promise<Map<string,{id:string;comment_version:number}>>` |
| `comments/transport.ts` | `commentMutation<T>(userId,path,method:"POST"|"PUT"|"DELETE",body?:object,signal?:AbortSignal): Promise<T>`; verify exact submitted token before/after fetch and response parsing |
| `supabase/account-scope.ts` | `withAccountScope<T>(userId:string,signal:AbortSignal\|undefined,operation:(caller:SupabaseClient<Database>,token:string,assertCurrent:()=>Promise<void>)=>Promise<T>):Promise<T>`; caller is request-scoped with that fixed Authorization header |
| `comments/targets.ts` | `commentThreadHref(target,role): string`; `parseTeacherCommentTarget(params): {kind:"none"}|{kind:"invalid"}|{kind:"valid";target:ThreadTarget}` |
| `hooks/use-comments.ts` | `useCommentThread(userId,target,open)`; `useCommentActions(userId,target)` returning `post/deleteComment/setLocked` mutations; `useCommentSummaries(userId,scope,open)`; `useUnreadCommentThreads(userId,enabled)` |
| `notifications/read.ts` | `readNotificationState<T>(userId:string,path:string,signal?:AbortSignal,body?:components["schemas"]["NotificationReadRequest"]):Promise<T>`; both notification hooks adopt this signature and account scope |

The thread hook returns React Query state plus `isAccountActive`, `loadMore`, `isLoadingMore`, `loadMoreError` and `retry`. Scope type is `{activityId:string;studentId?:never}|{studentId:string;activityId?:never}`. Pair keys use `activityId + ":" + studentId`. Notification actions accept `{id:string;expectedCommentVersion?:number}` instead of an ID alone.

---

## Task 1: Comment storage, RLS and historical scope

**Files:** Create the kind/store migrations and `backend/tests/rls/comment_support.py`, `test_comment_storage.py`. Modify CI trigger, `frontend/lib/notifications/presentation.ts`, actual DB types, and legacy upgrade fingerprint projections affected by the new notification column.

**Interfaces:** Produces comment tables/version fields, the three private access helpers, and test helper `seed_comment(family,activity_id,*,actor_id=None,body="Synthetic private message",student_id=None) -> dict`. It uses the existing `family`, `second_parent` and `assigned_activity` fixtures; no invented fixture keys.

- [ ] Inspect a clean isolated execution baseline and establish the approved disposable-stack runner. Add `feat/phase3-private-comments` to the existing CI push allowlist without deleting branch entries or altering main PR gating.
- [ ] Write the storage red case using the existing admin fixture only to seed data; assertions use real signed-in clients:

~~~python
from tests.rls.comment_support import seed_comment

def test_only_owner_and_linked_parents_read_comment(family, assigned_activity, second_parent):
    row = seed_comment(family, assigned_activity["id"])
    for key in ("teacher_client", "parent_client"):
        got = family[key].table("private_comment").select("id,body").eq("id", row["id"]).execute().data
        assert got == [{"id": row["id"], "body": "Synthetic private message"}]
    assert second_parent["client"].table("private_comment").select("id").eq(
        "id", row["id"]
    ).execute().data == [{"id": row["id"]}]
    for key in ("other_teacher_client", "other_parent_client"):
        assert family[key].table("private_comment").select("id").eq(
            "id", row["id"]
        ).execute().data == []
~~~

- [ ] Implement the seed helper with a work upsert, next integer version from the seeded work row, explicit teacher/parent role from the supplied fixture actor, comment insert, and work-counter update. Tests using an existing seeded version must advance the counter; do not use this helper as posting/auth proof.

~~~python
from app.core.supabase import supabase_client as admin

def seed_comment(family, activity_id, *, actor_id=None,
                 body="Synthetic private message", student_id=None):
    student_id = student_id or family["students"][0]
    actor_id = actor_id or family["teacher"]
    pair = {"activity_id": activity_id, "student_id": student_id}
    admin.table("student_work").upsert(pair, on_conflict="activity_id,student_id").execute()
    work = admin.table("student_work").select("comment_version").eq(
        "activity_id", activity_id
    ).eq("student_id", student_id).single().execute().data
    version = work["comment_version"] + 1
    row = admin.table("private_comment").insert({
        **pair, "author_id": actor_id,
        "author_role": "teacher" if actor_id == family["teacher"] else "parent",
        "body": body, "comment_version": version,
    }).execute().data[0]
    admin.table("student_work").update({"comment_version": version}).eq(
        "activity_id", activity_id
    ).eq("student_id", student_id).execute()
    return row
~~~
- [ ] Add tests for denied browser table writes and helper/public write execution, sibling denial, author FK nulling, student/activity cascades, invalid body/deletion pairs, and comment-only history after unassignment. Use isolated activity/child rows for destructive cases so module-scoped `family` remains valid.
- [ ] Run `uv run python -m pytest tests/rls/test_comment_storage.py -q`. Expected red boundary: absent comments relation/columns/helpers, not hosted credentials or collection failure.
- [ ] Allocate the two migrations, in this order:

~~~powershell
supabase migration new phase3_comment_kind
supabase migration new phase3_comment_store
~~~

The kind migration contains only:

~~~sql
alter type public.notification_type add value 'comment_posted';
~~~

The later store migration contains this schema core:

~~~sql
alter table public.student_work
  add column comments_locked boolean not null default false,
  add column comment_version integer not null default 0 check (comment_version >= 0);
create table public.private_comment (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  student_id uuid not null,
  author_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('teacher','parent')),
  body text,
  deleted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  comment_version integer not null check (comment_version > 0),
  foreign key (activity_id,student_id)
    references public.student_work(activity_id,student_id) on delete cascade,
  unique (activity_id,student_id,comment_version),
  check ((body is null) = (deleted_at is not null)),
  check (body is null or (char_length(body) between 1 and 1000 and btrim(body) <> ''))
);
create index private_comment_feed on public.private_comment
  (activity_id,student_id,created_at desc,id desc);
create index private_comment_student on public.private_comment(student_id,activity_id);
create index private_comment_author on public.private_comment(author_id);
alter table public.private_comment enable row level security;
revoke all on public.private_comment from public,anon,authenticated;
grant select on public.private_comment to authenticated;
grant select,insert,update,delete on public.private_comment to service_role;
alter table public.notification add column comment_version integer;
alter table public.notification add constraint notification_comment_version_kind
  check ((type='comment_posted' and comment_version is not null and comment_version > 0)
    or (type<>'comment_posted' and comment_version is null));
create unique index notification_comment_unread_uniq
  on public.notification(recipient_id,activity_id,student_id)
  where type='comment_posted' and read_at is null;
~~~

- [ ] Define the two history helpers as narrowly authorized private SECURITY DEFINER boolean functions. `has_comment_work_history` requires an existing comment for that exact pair AND either activity ownership or a current `student_parent` link for `auth.uid()`. `has_comment_activity_history` applies the same check over that activity's pairs. Set empty search paths, revoke PUBLIC/anon execution, grant authenticated/service usage only, and require non-null caller identity. Never return bodies, labels or parent lists.
- [ ] Add comment SELECT policy for owner or current parent. Extend parent activity metadata SELECT with `has_comment_activity_history(activity.id)`, preserving all existing assignment/submission/grade alternatives. Add a student-work SELECT policy for an activity owner with actual comment history, enabling non-score lock metadata for retained comments without broadening student/submission/score policies.
- [ ] Define `can_read_comment_work` under caller RLS: visible activity, actual owner/current parent, and assigned OR comment history OR visible pair-specific submission history OR existing authorized grade history. All pair checks include both IDs. Test a parent probing the sibling's unassigned pair and a teacher teaching the child but not owning the activity.
- [ ] Keep existing notification shape constraints intact: comments already belong to the null-submission group; do not replace Slice 5's points-only release exception. Add `comment_posted: "New private comment"` to the exhaustive notification copy map so generated enum changes still type-check.
- [ ] Inspect `backend/tests/migrations/*_upgrade_check.py` using `rg -g '*_upgrade_check.py'`. Where a legacy fingerprint selects all notification fields, project its original nine columns explicitly, excluding only the newly added version column; never remove old values from preservation checks. The new upgrade proof will assert that version is null for old notices.
- [ ] Reset/replay locally, run storage cases and existing RLS tests, then the full suite on the disposable stack. Generate actual DB types. Run Ruff/ESLint/TypeScript and the existing upgrade/advisor gates. Commit schema+types+focused cases with `feat: add private comment storage and access policies`.

## Task 2: One RLS-scoped thread feed and historical discovery

**Files:** CLI migration `phase3_comment_reads`; `backend/tests/rls/test_comment_reads.py`; generated DB types.

**Interfaces:** Consumes Task 1 access helpers. Produces both public read RPCs and the exact CommentThread/ThreadSummaries JSON described above. Neither RPC creates work rows.

- [ ] Write the empty-read and history red cases:

~~~python
from app.core.supabase import supabase_client as admin

def test_empty_read_has_no_write_side_effect(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    result = family["parent_client"].rpc("read_private_comment_thread", {
        "target_activity_id": activity, "target_student_id": student
    }).execute().data
    assert result["entries"] == [] and result["can_post"] is True
    assert result["seen_comment_version"] is None and result["unread_notice"] is None
    assert admin.table("student_work").select("activity_id").eq(
        "activity_id", activity
    ).execute().data == []
~~~

A separate test seeds a comment, changes assignment targets to `family["students"][1]` with `update_assigned_activity`, and verifies child 0 still sees the activity/thread while child 1's empty thread has no child 0 comments.
- [ ] Add cursor tests: 51 comments plus Return entries; equal event timestamps with distinct kinds/UUIDs; microseconds; malformed/mixed cursors; page size 0/101; foreign/missing pairs; deleted placeholders; private metadata omissions; no-upload history discovery; former-owner generic student label.
- [ ] Run `uv run python -m pytest tests/rls/test_comment_reads.py -q` and observe the absent-RPC boundary.
- [ ] Allocate `phase3_comment_reads`. Implement a stable security-invoker SQL wrapper over a one-statement CTE projection; validate scope/cursor before returning rows. This is the feed core after the scope predicate succeeds:

~~~sql
with events as (
  select c.created_at event_at,'comment'::text kind,c.id,
    jsonb_build_object('kind','comment','id',c.id,'event_at',c.created_at,
      'author_role',c.author_role,'is_mine',coalesce(c.author_id=(select auth.uid()),false),
      'body',c.body,'deleted_at',c.deleted_at,'comment_version',c.comment_version) entry,
    c.comment_version
  from public.private_comment c
  where c.activity_id=target_activity_id and c.student_id=target_student_id
  union all
  select s.returned_at,'return',s.id,
    jsonb_build_object('kind','return','id',s.id,'event_at',s.returned_at,
      'return_reason',s.return_reason,'return_note',s.return_note),null::integer
  from public.submission s
  where s.activity_id=target_activity_id and s.student_id=target_student_id
    and s.status='returned' and s.returned_at is not null
)
select * from events
where before_cursor is null or (event_at,kind,id) <
  ((before_cursor->>'event_at')::timestamptz,before_cursor->>'kind',
   (before_cursor->>'id')::uuid)
order by event_at desc,kind desc,id desc
limit page_size + 1;
~~~

- [ ] In that same statement, obtain visible activity/work state, caller role, current assignment, current recipient's unread comment notice and the paged events. Aggregate only the first `page_size` entries. Compute the watermark from those returned comment entries; compute the next cursor from the last returned row only when the extra row exists. Use `coalesce(c.author_id=auth.uid(),false)` for deleted accounts so `is_mine` is never null.
- [ ] Build reasons in fixed order unassigned/archived/locked. `can_post` is their empty conjunction; `can_lock` is actual activity ownership for a readable pair. Do not join the student profile as an inner join: a historical owner may lack that profile under current RLS.
- [ ] Implement summary discovery from caller-visible comments grouped by exact pair, including tombstones. Activity scope requires its actual owning teacher; student scope requires the caller's current parent link. Return title, RLS-visible student label or “Student,” last comment time and state. Page by the complete summary cursor; never return other children merely because the activity metadata is visible.
- [ ] Seed returned submissions with different upload and return dates using `stored_attempt` from existing gradebook support, update the row's returned fields with the synthetic teacher, and clean them before fixture teardown. Verify the feed orders by Return time and contains no scores/image paths even when the parent has released results.
- [ ] Run read/storage/full backend checks, original upgrade proofs and advisors; pair regenerated DB types. Commit `feat: add private comment thread reads and history discovery`.

## Task 3: Atomic posting, notifications, author deletion and locks

**Files:** CLI migration `phase3_comment_mutations`; `backend/tests/rls/test_comment_mutations.py`, `test_comment_notifications.py`; extend `comment_support.py`; actual DB types.

**Interfaces:** Produces the public mutation RPCs, `normalize_comment_body`, `comment_write_context` and `put_comment_notification`. Add test helper `post_comment(actor_id,activity_id,student_id,body="Synthetic reply") -> dict` that calls the real service RPC.

~~~python
def post_comment(actor_id, activity_id, student_id, body="Synthetic reply"):
    return admin.rpc("post_private_comment", {
        "actor_id": actor_id, "target_activity_id": activity_id,
        "target_student_id": student_id, "comment_body": body,
    }).execute().data
~~~

This helper lives with `seed_comment` and its existing admin import. Test modules import `post_comment` explicitly; it is not a new pytest fixture.

- [ ] Start with this absent-post RPC red case:

~~~python
from app.core.supabase import supabase_client as admin
from tests.rls.comment_support import post_comment

def test_post_before_upload_notifies_every_other_participant(
    family, assigned_activity, second_parent
):
    activity, student = assigned_activity["id"], family["students"][0]
    posted = post_comment(family["parent"], activity, student)
    assert posted["author_role"] == "parent" and posted["comment_version"] == 1
    rows = admin.table("notification").select("recipient_id,submission_id,comment_version").eq(
        "activity_id", activity
    ).eq("type", "comment_posted").execute().data
    assert {r["recipient_id"] for r in rows} == {family["teacher"], second_parent["id"]}
    assert all(r["submission_id"] is None and r["comment_version"] == 1 for r in rows)
    assert admin.table("submission").select("id").eq("activity_id", activity).execute().data == []
    assert admin.table("student_work_grade").select("id").eq("activity_id", activity).execute().data == []
~~~

- [ ] Add cases for in-class/closed/due/excused posting, unassigned/archive/lock denial for both roles, wrong owner/parent, Unicode trim/length, one unread row after repeated posts, no self-alert and no email with both email gates enabled. Test deletion by author while locked/archived/unassigned; non-author/missing equivalence; twice-delete; no new notices on delete/lock.
- [ ] Observe red with `uv run python -m pytest tests/rls/test_comment_mutations.py tests/rls/test_comment_notifications.py -q`. Allocate `phase3_comment_mutations`.
- [ ] Implement Unicode trimming in SQL with the same whitespace set used by Python `str.strip()`: code points 9–13, 28–32, 133, 160, 5760, 8192–8202, 8232–8233, 8239, 8287 and 12288. Build the trim set with `string_agg(chr(codepoint),'')` over those numbers; reject null, blank and lengths outside 1–1000 with WW422 and a fixed message. Do not include the rejected value in an exception.
- [ ] Define the posting authorization gate after the activity/work locks. The write RPC/context helper are VOLATILE so post-lock SPI statements obtain a fresh READ COMMITTED snapshot. In one fresh query capture actual activity owner, current parent membership for the actor, live roster/section assignment, work lock, archive flag, and the sorted participant UUID set. Owner/current-parent membership and a legitimate assigned/history pair are required before state errors. Do not call existing `authorize_work`, which is teacher-only and rejects comment-only history.
- [ ] Define this gate as the operation's authorization snapshot. A link/section/roster revocation committed while the request waited for activity/work locks must be observed. Changes after that snapshot do not retroactively cancel a committed post; later reads still enforce current RLS. Avoid introducing parent/Auth row lock cycles; lock additional membership rows only if a stricter invariant actually requires it and include those rows in observed-lock tests.
- [ ] Implement the post transaction using these exact existing/new interfaces:

~~~sql
-- Inside public.post_private_comment; local variables a,w,context,c,recipient,stamp.
select * into a from public.activity where id=target_activity_id for update;
if not found then
  raise exception using errcode='WW404',message='Conversation not found';
end if;
w := writewise_internal.lock_work(target_activity_id,target_student_id);
context := writewise_internal.comment_write_context(actor_id,target_activity_id,target_student_id);
if not (context->>'assigned')::boolean then
  raise exception using errcode='WW412',message='Activity not assigned';
end if;
if a.is_archived then
  raise exception using errcode='WW441',message='Activity archived';
end if;
if w.comments_locked then
  raise exception using errcode='WW440',message='Conversation locked';
end if;
stamp := clock_timestamp();
update public.student_work set comment_version=comment_version+1
where activity_id=target_activity_id and student_id=target_student_id returning * into w;
insert into public.private_comment(activity_id,student_id,author_id,author_role,body,
  comment_version,created_at)
values(target_activity_id,target_student_id,actor_id,context->>'author_role',
  writewise_internal.normalize_comment_body(comment_body),w.comment_version,stamp)
returning * into c;
for recipient in
  select value::uuid from jsonb_array_elements_text(context->'recipients') order by value
loop
  if recipient<>actor_id then
    perform writewise_internal.put_comment_notification(recipient,c.activity_id,c.student_id,
      c.id,c.comment_version,stamp);
  end if;
end loop;
return jsonb_build_object('id',c.id,'activity_id',c.activity_id,'student_id',c.student_id,
  'author_role',c.author_role,'created_at',c.created_at,'comment_version',c.comment_version);
~~~

Guard invalid/missing student FKs with WW404 before `lock_work`. A failed authorization rolls back any on-demand work insertion. Counter overflow must roll back the entire post rather than wrap.
- [ ] Implement coalescing with one private delivery key per posted comment/recipient. Keep the unread public row's original dedupe key when coalescing; set only version/time on conflict:

~~~sql
event_key := 'comment:'||work_activity::text||':'||work_student::text||':'||
  recipient::text||':'||target_comment::text;
insert into writewise_internal.notification_delivery(dedupe_key,recipient_id,activity_id,student_id)
values(event_key,recipient,work_activity,work_student)
on conflict(dedupe_key) do nothing;
if not found then return null; end if;
insert into public.notification(recipient_id,type,activity_id,student_id,dedupe_key,
  comment_version,created_at)
values(recipient,'comment_posted',work_activity,work_student,event_key,target_version,event_at)
on conflict(recipient_id,activity_id,student_id)
where type='comment_posted' and read_at is null
do update set comment_version=excluded.comment_version,created_at=excluded.created_at
returning id into notice_id;
return notice_id;
~~~

Do not call an email-enqueue path for comments. If a duplicated private delivery key is observed, return null without mutating a notice, matching existing emitter dedupe semantics.
- [ ] Implement deletion by first looking up only ID/pair/author, then locking activity, existing work and comment in that order. Recheck ownership and current readable relationship after waiting. Update only `body=null,deleted_at=coalesce(deleted_at,clock_timestamp())`. The counter, ordering timestamp and unrelated unread rows stay unchanged.
- [ ] Implement lock with activity then work locks, actual owner check, current assignment or retained authorized history, and strict non-null boolean. Only update `comments_locked`; return its scoped fields. Never invoke grade synchronization/publication or create an arbitrary unassigned pair.
- [ ] Fault-inject failures in both the private receipt and public notice insert, using transaction-scoped temporary triggers as existing notification rollback tests do. Assert comment count, counter, receipts, notices and new work creation all revert. Capture grade/score/queue snapshots before and after successful comment-only changes.
- [ ] Run mutation/notification/storage/read modules, full suite, original upgrade proofs, advisors and actual type generation. Commit `feat: add transactional private comment mutations`.

## Task 4: Version-checked read state and observed concurrency

**Files:** CLI migration `phase3_comment_receipts`; `backend/tests/rls/test_comment_races.py`; extend `test_notifications.py`; regenerate DB types.

**Interfaces:** Produces `mark_comment_notification_read`; preserves ordinary read RPC interfaces. Tests use existing `wait_for_database_lock(observer,pid)`, not sleeps as evidence.

- [ ] Write the version red case:

~~~python
import asyncio
import json
import os
import asyncpg
import pytest
from postgrest.exceptions import APIError
from app.core.supabase import supabase_client as admin
from tests.rls.comment_support import post_comment
from tests.rls.notification_support import wait_for_database_lock

def test_stale_read_cannot_clear_a_coalesced_newer_comment(family, assigned_activity):
    activity, student = assigned_activity["id"], family["students"][0]
    post_comment(family["teacher"], activity, student)
    notice = admin.table("notification").select("id,comment_version").eq(
        "activity_id", activity
    ).eq("recipient_id", family["parent"]).eq("type", "comment_posted").single().execute().data
    post_comment(family["teacher"], activity, student, "Another reply")
    with pytest.raises(APIError) as failure:
        admin.rpc("mark_comment_notification_read", {
            "actor_id": family["parent"], "target_notification_id": notice["id"],
            "expected_comment_version": notice["comment_version"]
        }).execute()
    assert failure.value.code == "WW442"
    assert admin.table("notification").select("read_at").eq(
        "id", notice["id"]
    ).single().execute().data["read_at"] is None
~~~

- [ ] Add ordinary-first-read timestamp/idempotency regressions, missing expected version, foreign recipient denial, read-then-post new notice, both coalescing/single-read orders, and a loaded feed whose notice version exceeds its returned comment watermark.
- [ ] Run red cases, then allocate `phase3_comment_receipts`. In the old two-argument read RPC, preserve ordinary behavior but reject own comment rows with WW422. In the new RPC validate a positive version and lock only the recipient's exact comment notice; if already read, preserve the first timestamp for an equal version; if its version differs, raise WW442; otherwise set first read time and return the existing response.
- [ ] Replace all-read using a materialized snapshot of IDs and versions, not a mutable timestamp predicate alone:

~~~sql
with snapshot as materialized (
  select n.id,n.comment_version from public.notification n
  where n.recipient_id=actor_id and n.read_at is null and n.created_at<=cutoff
), changed as (
  update public.notification n set read_at=cutoff from snapshot s
  where n.id=s.id and n.recipient_id=actor_id and n.read_at is null
    and n.comment_version is not distinct from s.comment_version
  returning n.id
)
select count(*) into changed_count from changed;
~~~

Capture `cutoff := statement_timestamp()` once. Return `{updated_count:changed_count,read_at:cutoff}` even when zero. Keep the existing grant revocations.
- [ ] Add an observed-lock race that exercises the real public all-read function while a post coalesces the same row:

~~~python
async def all_read_waiting_on_post(activity, student, teacher, parent):
    locker = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
    waiter = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
    task = None
    try:
        await locker.execute("select set_config('request.jwt.claims',$1,false)",
                             json.dumps({"role": "service_role"}))
        async with locker.transaction():
            await locker.fetchval("select id from public.activity where id=$1 for update", activity)
            await locker.fetchval(
                "select public.post_private_comment($1,$2,$3,$4)",
                teacher, activity, student, "Posted inside the held transaction"
            )
            task = asyncio.create_task(waiter.fetchval(
                "select public.mark_all_notifications_read($1)", parent
            ))
            await wait_for_database_lock(locker, waiter.get_server_pid())
        return await task
    finally:
        if task and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        await locker.close()
        await waiter.close()
~~~

Create an older committed unread row first. The uncommitted post holds its notice lock; all-read snapshots the older version and waits. After commit, assert the newer row remains unread and is not counted as changed. Wrap with `asyncio.run`; set service JWT context on any raw connection invoking assignment-dependent service functions.
- [ ] Add an activity-lock observer matrix: hold activity, launch post, observe its wait, commit lock/archive/section move/target removal/parent unlink/roster removal in the owner session, then assert the fresh gate denies or excludes the revoked recipient. Add simultaneous-post monotonic version/coalescing checks and comment-versus-grade lifecycle regression checks. Clean canceled tasks, raw transactions, temporary triggers and created submissions deterministically.
- [ ] For every revocation/section case, snapshot and restore the module-scoped family's original student section, roster and parent links in a `finally` block. A denial test must not poison the next case's family fixture.
- [ ] Run races repeatedly only to investigate an actual unresolved failure; observed locks establish ordering without arbitrary timing loops. Run full backend checks and existing read tests, pair real DB types, commit `fix: preserve unread private comments across read races`.

## Task 5: FastAPI writes, strict contracts and body-safe failures

**Files:** New `app/comments/` modules and `app/api/comments.py`; `app/main.py` router registration; existing notification routes/contracts; unit and real-route RLS modules from the file map; generated API types.

**Interfaces:** Consumes Task 3/4 RPCs. Produces the exact HTTP schemas/routes in Shared interfaces. No service-role read endpoint for threads.

- [ ] Write contract red cases that import models inside test functions, following current database-free unit patterns:

~~~python
import pytest
from pydantic import ValidationError

@pytest.mark.parametrize("body", ["", " \u2003 ", "x" * 1001, "\x00", "\ud800", 7, True])
def test_comment_rejects_unusable_text(body):
    from app.comments.contracts import CommentPostRequest
    with pytest.raises(ValidationError):
        CommentPostRequest(body=body)

def test_comment_normalizes_unicode_edges_and_preserves_lines():
    from app.comments.contracts import CommentPostRequest
    assert CommentPostRequest(body="\u2003 hello\nagain \u00a0").body == "hello\nagain"
~~~

- [ ] Run `uv run python -m pytest tests/unit/test_comment_contracts.py --confcutdir=tests/unit -q`. Then implement:

~~~python
from typing import Literal
from uuid import UUID
from pydantic import (
    AwareDatetime, BaseModel, ConfigDict, Field, StrictBool, StrictInt, StrictStr, field_validator,
)

class CommentPostRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    body: StrictStr

    @field_validator("body")
    @classmethod
    def clean_body(cls, value: str) -> str:
        value = value.strip()
        try:
            value.encode("utf-8")
        except UnicodeEncodeError:
            raise ValueError("Check the comment text.") from None
        if "\x00" in value or not 1 <= len(value) <= 1000:
            raise ValueError("Check the comment text.")
        return value

class CommentLockRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    locked: StrictBool

class CommentPosted(BaseModel):
    id: UUID
    activity_id: UUID
    student_id: UUID
    author_role: Literal["teacher", "parent"]
    created_at: AwareDatetime
    comment_version: StrictInt = Field(gt=0, le=2147483647)

class CommentLockState(BaseModel):
    activity_id: UUID
    student_id: UUID
    comments_locked: bool
~~~

Add an aware-time model test. NotificationReadRequest uses `extra="forbid"` and `expected_comment_version: StrictInt | None = Field(default=None,gt=0,le=2147483647)`.
- [ ] Build the mounted-route test fixture with the real app and SDK, replacing only external SDK HTTP transport as `test_notification_routes.py` does. Override only verified `get_current_user` identity; give a forged role in that payload and prove actual owner/link checks decide authorship and lock permission.
- [ ] In `comments/access.py` precheck actual activity ownership/current parent link, and pair assignment or retained comment/submission/grade history. Select IDs only; deletion prechecks ID/pair/author without reading the body. Lock requires actual activity owner. Never use `get_current_teacher` metadata as the sole authority.
- [ ] In `comments/repository.py` allowlist the three mutation RPCs and exact payload fields. Normalize SDK APIError, HTTPX failures, malformed response bodies and unexpected SDK boundary errors into fixed envelopes with `from None`. Validate successful SDK results against CommentPosted/CommentLockState (and the exact deleted boolean) inside this safe boundary, so a body-bearing invalid result cannot reach FastAPI's generic ResponseValidationError logger. The error mapping lives once in `comments/errors.py`. Do not log an exception containing text or rethrow it to the generic logger.
- [ ] Define route functions named `post_comment_route`, `delete_comment_route` and `set_comment_lock_route`. Route POST through precheck and service RPC, DELETE through author/access precheck and scrub RPC with an empty `Response(status_code=204)`, and lock through owner precheck/RPC. Register the router once under `/api`. Set no-store response headers on returned comment metadata.
- [ ] Extend notification POST read with an optional request body. Precheck own notification ID/type, require expected version for comment rows, call `mark_comment_notification_read` only for them, and translate WW442 to COMMENT_READ_CONFLICT. Ordinary/no-body reads still call the original RPC with precisely its two parameters.
- [ ] Add privacy/error cases with unique body sentinel in SQL message/details/hint, transport exception text, invalid JSON, malformed successful SDK results and validation input. Assert it is absent from response/log capture; response schemas and HTTP codes remain fixed. Use fixed messages for extra-field failures, since user-supplied JSON keys can appear in the existing generic validation handler's `loc`: for `post_comment_route` and `set_comment_lock_route`, return a fixed VALIDATION_ERROR envelope without raw locations or input keys. Match the server's route name, not a user-controlled error location.
- [ ] Add real-JWT API cases for both roles/two parents, wrong owner, wrong child, role metadata spoofing, denied delete/lock and unread conflict. Do not leave global dependency overrides enabled in these cases.
- [ ] Regenerate OpenAPI types with the CI-pinned `openapi-typescript@7.13.0` from the real app's exported OpenAPI JSON, using a temporary file; never edit `frontend/types/api.ts` by hand. Run unit, real-route/full suite and lint/type gates. Commit `feat: expose private comment writes with safe errors`.

## Task 6: Account-scoped browser transport and retained thread data

**Files:** New `frontend/lib/comments/`, `frontend/lib/supabase/account-scope.ts` and `use-comments.ts`; notification read/query/account-lifetime files from the file map.

**Interfaces:** Implements the exact browser exports and view models above. Uses generated HTTP types and generated database RPC definitions; runtime-validates JSON feed shapes.

- [ ] Before code, prepare controlled browser probes for account switch during fetch and JSON parsing, expired token, read denial, page loading and a new comment after the fetched watermark. These are temporary ignored/local fixtures against actual transport modules, not a committed frontend suite. Record the failing observations.
- [ ] Define query keys under `["comments",userId]`, with pair/window or summary scope beneath it. Unread dots use `["notifications",userId,"comment-threads"]`. Extend the always-mounted notification account cleanup to cancel/remove comments for old accounts and abort shared mutation signals.
- [ ] Implement `withAccountScope` using the exact-token checks from gradebook transport: obtain the browser session token, verify it with `getUser(token)`, check the requested user ID, and compare current user/token/abort state before operation, after transport and in `finally` after success/error parsing. Create a request-scoped typed Supabase client for reads with `persistSession:false`, `autoRefreshToken:false`, `detectSessionInUrl:false` and `global.headers.Authorization = "Bearer " + token`, using only the public URL/anon key. Do not mutate the shared browser client's auth state or rely on its automatically changing token during a thread read.

~~~typescript
import { createClient as createCaller, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowser } from "@/lib/supabase/client";
import { getAuthToken } from "@/lib/supabase/auth-helper";
import { ApiError } from "@/lib/utils/api-error";
import type { Database } from "@/types/database";

export async function withAccountScope<T>(
  userId: string,
  signal: AbortSignal | undefined,
  operation: (
    caller: SupabaseClient<Database>, token: string, assertCurrent: () => Promise<void>
  ) => Promise<T>,
): Promise<T> {
  signal?.throwIfAborted();
  const browser = createBrowser();
  const token = await getAuthToken(browser);
  const verified = await browser.auth.getUser(token);
  if (verified.error || verified.data.user?.id !== userId) {
    throw new ApiError({ code: "UNAUTHORIZED", message: "Sign in again to view comments." });
  }
  const assertCurrent = async () => {
    signal?.throwIfAborted();
    const current = await browser.auth.getSession();
    if (current.error || current.data.session?.user.id !== userId ||
        current.data.session.access_token !== token) {
      throw new DOMException("The account changed.", "AbortError");
    }
  };
  await assertCurrent();
  const caller = createCaller<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: "Bearer " + token } },
    },
  );
  try {
    return await operation(caller, token, assertCurrent);
  } finally {
    await assertCurrent();
  }
}
~~~

Call `assertCurrent` immediately after each fetch/RPC await. Its final check also covers failures during JSON parsing; no late old-account exception/result can replace the active target's state.
- [ ] Implement `commentMutation` through that account scope and a fixed `/api/` path guard. Add DELETE and 204 handling explicitly; do not try to parse successful empty responses. Discard late errors/results for a changed account, even if a response body is still parsing. Upgrade `readNotificationState` to use the same scope around its version-aware write, preserving ordinary requests.
- [ ] For direct RPC reads pass the fixed-token request client into the shared data functions; account-scope checks surround the entire read/window operation and each await checks its abort signal. Convert raw PostgREST errors to fixed ApiError codes/messages rather than exposing body-bearing provider errors in a dev overlay.
- [ ] Implement and validate the two read RPC requests, using complete cursor objects and explicit page size 50. For loaded thread history follow head pages until the previously retained oldest cursor is covered, merge by `kind+":"+id`, keep newest row payloads so scrubbing updates visible history, and render in total chronological order. Only the head response supplies current flags/notice metadata; compute acknowledgment from entries actually present.
- [ ] Preserve pagination state with a window query rather than replacing all pages with the latest head. Load-more starts from the oldest retained cursor, then refreshes that enlarged window. Abort per target/account; never use keepPreviousData across different child/activity pairs.
- [ ] Read unread dots in recipient-scoped batches, paginating by stable notice ID if needed; filter to `comment_posted` and null read time. Return a map by pair, not a query per cell. Both the bell and dots invalidate on single/all-read.
- [ ] Expose post/delete/lock hooks with `retry:false` and no automatic write retries. On success, clear/scrub relevant local data and refresh the pair, summaries and notification queries. Lock/post must not trigger grade mutations. A denied-access read removes prior cached bodies for that pair; generic network errors offer recovery without displaying another target's cache.
- [ ] Implement the acknowledgment condition in the open-thread hook/component:

~~~typescript
const notice = thread.unread_notice;
const seen = thread.seen_comment_version;
const alertedEntryLoaded = notice && thread.entries.some((entry) =>
  entry.kind === "comment" && entry.comment_version === notice.comment_version
);
if (notice && seen !== null && notice.comment_version <= seen && alertedEntryLoaded) {
  await read.mutateAsync({
    id: notice.id,
    expectedCommentVersion: notice.comment_version,
  });
}
~~~

Only execute after the matching target's content has committed to the open UI. Exact entry presence matters: the reader's own newer posts can raise the loaded watermark while an older received comment remains outside the loaded page. Deduplicate attempts by notice ID/version; on conflict refresh without marking optimistically read or repeating the stale acknowledgment indefinitely.
- [ ] Verify the controlled probes, 51+ mixed entries, scrubbed older pages, summary pagination, account changes while errors parse, stale acknowledgment and all-read dot invalidation. Specifically, receive version 1 then post 51 own comments: a newest-only page must not auto-ack unseen version 1 merely because its watermark is higher; loading that actual entry enables acknowledgment. Run frontend lint/TypeScript. Commit `feat: add account-scoped private comment data hooks`.

## Task 7: Shared accessible conversation component

**Files:** The four new comment UI components and missing message primitives listed in the map.

**Interfaces:** `StudentWorkThread({userId,target,open})` uses Task 6 hooks; `StudentWorkThreadSheet({userId,target,open,onOpenChange,studentName?})` supplies the accessible container. `CommentComposer({disabled,pending,onSend})` owns only the current mounted target's draft; the parent keys it by account/pair.

- [ ] Create controlled before-upload and read-only fixtures and observe the missing view. Inspect installed components and CLI docs first. The planning CLI lookup was network-blocked; primary [Message Scroller](https://ui.shadcn.com/docs/components/base/message-scroller) and [Message](https://ui.shadcn.com/docs/components/base/message) docs plus the installed primitive declarations were inspected instead.
- [ ] Use the existing `@shadcn/react/message-scroller` module. The local wrapper can alias its installed primitive without adding or upgrading a dependency:

~~~typescript
"use client";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
export const MessageScrollerProvider = Primitive.Provider;
export const MessageScroller = Primitive.Root;
export const MessageScrollerViewport = Primitive.Viewport;
export const MessageScrollerContent = Primitive.Content;
export const MessageScrollerItem = Primitive.Item;
export const MessageScrollerButton = Primitive.Button;
~~~

Use CLI dry-run/diff to inspect missing Message/Marker source before adding only those source wrappers; reject package/lockfile changes. If registry access stays unavailable, compose the documented Message/Marker parts locally from installed React/Base UI utilities, preserving their documented part names and this project's semantic tokens. Do not replace the scroller with custom scroll/ResizeObserver logic.

The dependency-free fallback wrappers are small source components. Put the first four functions in `ui/message.tsx` and the last two in `ui/marker.tsx`, importing React and cn separately in each file:

~~~tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function Message({ align = "start", className, ...props }:
  React.ComponentProps<"article"> & { align?: "start" | "end" }) {
  return <article data-slot="message" data-align={align}
    className={cn("group/message flex min-w-0 flex-col gap-1", className)} {...props} />;
}
export function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="message-content"
    className={cn("flex min-w-0 flex-col gap-1", className)} {...props} />;
}
export function MessageHeader(props: React.ComponentProps<"header">) {
  return <header data-slot="message-header" {...props} />;
}
export function MessageFooter(props: React.ComponentProps<"footer">) {
  return <footer data-slot="message-footer" {...props} />;
}
export function Marker({ className, ...props }: React.ComponentProps<"aside">) {
  return <aside data-slot="marker"
    className={cn("text-muted-foreground flex min-w-0 flex-col gap-1 text-sm", className)}
    {...props} />;
}
export function MarkerContent(props: React.ComponentProps<"div">) {
  return <div data-slot="marker-content" {...props} />;
}
~~~

These wrappers provide layout only; keep Bubble as the comment surface and render all body/note strings as escaped children.
- [ ] Render comment surfaces with installed Bubble/BubbleContent and the author role/“You” label; Return events use Marker with a fixed reason label and escaped note. A deleted entry renders only the fixed placeholder and timestamp; no hidden copy of its old body remains in a title, data attribute or accessible label.
- [ ] Assemble the transcript using stable entry keys:

~~~tsx
<MessageScrollerProvider autoScroll defaultScrollPosition="end">
  <MessageScroller className="flex min-h-0 flex-1 flex-col">
    <MessageScrollerViewport aria-label="Private conversation" preserveScrollOnPrepend>
      <MessageScrollerContent className="flex flex-col gap-4 p-4">
        {entries.map((entry) => (
          <MessageScrollerItem key={entry.kind + ":" + entry.id}
            messageId={entry.kind + ":" + entry.id}>
            <ThreadEntryView entry={entry} onDelete={deleteComment} />
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
    <MessageScrollerButton direction="end">Jump to latest</MessageScrollerButton>
  </MessageScroller>
</MessageScrollerProvider>
~~~

Define `ThreadEntryView({entry,onDelete})` in `thread-entry.tsx`. `onDelete(commentId:string):void` opens the author confirmation. Put the older-history control outside the transcript or wrap it as a stable scroller item. Match the installed provider's documented focus/anchoring behavior; no inline script or streaming/AI library.
- [ ] Build the composer with FieldGroup/Field/FieldLabel/Textarea, a Unicode code-point counter, fixed validation text and pending-disabled submit. Use `Array.from(value.trim()).length` rather than UTF-16 `value.length` for the displayed limit. Don't set a native 1000 UTF-16-unit maxlength that rejects valid emoji sooner than Python/SQL. Normal typing may exceed the limit; disable send and explain the actual count.
- [ ] Show “Visible to the teacher and all linked parents immediately, even before results are released.” Present every active read-only reason. Teacher-only lock/unlock and author-only deletion remain separate from post eligibility. Do not close the sheet after a post or lock update.
- [ ] Use existing Sheet/AlertDialog titles/descriptions, safe unavailable/error/retry/empty states, reduced-motion-safe loading, focus restoration and no nested modal stack. Unmount by account/pair so drafts cannot cross children. Verify 360px layout, long text, line breaks, keyboard-only actions, prepend anchoring and new-message positioning.
- [ ] Run lint/TypeScript and a production webpack build with synthetic localhost configuration. Record controlled UI observations; commit `feat: add shared private conversation panel`.

## Task 8: Teacher work, history and gradebook unread indicators

**Files:** New `activity-threads.tsx`; modify `frontend/app/(teacher)/activities/[id]/page.tsx`, `gradebook/work-grade-sheet.tsx`, `teacher-gradebook.tsx`, `gradebook-cell.tsx`.

**Interfaces:** `ActivityThreads({userId,activityId,onOpen(target,studentName?)})` lists retained activity conversations using Task 6 summaries. WorkGradeSheet takes optional `initialView:"work"|"comments"`, default work; existing props and grade actions remain compatible.

- [ ] Before implementation, verify that the existing assigned-student row and gradebook cell cannot open comments for a no-upload pair. Capture this missing behavior with controlled browser data.
- [ ] Add a Comments action to every assigned-student activity row. Add a “Conversation history” section backed by paginated summaries for retained pairs no longer in that list. Keep roster names subject to RLS; use the returned generic label when absent. Open the same shared sheet without manufacturing a GradebookCell or submission.
- [ ] In the gradebook grid call `useUnreadCommentThreads(userId,true)` once. Pass `hasUnreadComments:boolean` into GradebookCellButton and append readable context to its accessible name:

~~~tsx
<GradebookCellButton cell={cell} onOpen={() => setCell(cell)}
  hasUnreadComments={unread.has(cell.activity_id + ":" + cell.student_id)}
  label={studentName + ", " + activityTitle} />
~~~

The cell component keeps its existing grading semantics. Render an indicator with accessible “Unread comments” text; dot state is never exported or counted as a grade.
- [ ] Add Work/Comments tabs to the work sheet, keeping existing work controls and focus behavior. Mount the thread only in its open Comments view; leave drafts untouched when the user saves a comment. Do not auto-ack merely because a gradebook cell was opened on its Work tab.
- [ ] Parse teacher `/activities/{activity}?student={student}&view=comments` with a strict UUID/unique-parameter parser. Activity ownership and thread RPC authorize the target; URL parsing alone grants nothing. Direct links work for historical and before-upload pairs. Closing removes only this target and restores focus to the initiating row/cell where present.
- [ ] Manually verify no-upload, in-class, unassigned, archived, former-roster generic label, unread dot after parent post, all-read clearing, and that opening only Work preserves unread state. Confirm no change to CSV/totals/release revisions. Run lint/TypeScript and commit `feat: connect teacher work conversations and unread dots`.

## Task 9: Parent activity access and version-aware notification navigation

**Files:** New `parent-activity-threads.tsx`; modify `frontend/app/(parent)/progress/progress-content.tsx`, `components/parent-portal-provider.tsx`, `parent/take-home-activities.tsx`, `parent/notification-work-destination.tsx`, `gradebook/parent-grades.tsx`; notification data/presentation/read/hooks/row/list/bell.

**Interfaces:** ParentNotificationTarget's optional view becomes `"grades"|"comments"`; a comments target has no submission ID. URLs are `/progress?child={student}&activity={activity}&view=comments`. Existing `tab=grades` destinations retain their meaning. `ParentActivityThreads({userId,studentId,onOpen})` lists retained history in the selected child's activity context.

- [ ] Prepare probes for sibling B notification entry/exit, malformed duplicate parameters, child switch with an open composer, in-class no-upload work, and comment-only history. Observe missing comment destinations before adding code.
- [ ] Extend the parent parser with a single optional `view=comments`. Reject duplicate/unknown view values, comments combined with a submission, and conflicting grade/comment targets. A grade-tab query alone must still work. Extend provider cleanup to remove `view` when dismissing targets or switching children, and preserve the current target child before clearing its URL.
- [ ] Route comments directly to the shared thread sheet instead of the worksheet/grade destination. Mount only when the requested child is in the current linked-child set and matches the selected child; otherwise show the safe unavailable state and no prior body.
- [ ] Add Comments actions to take-home activity details and parent grade activity rows, including assigned in-class/no-upload work. Show paginated retained conversation history in that child's activity context, including archived/comment-only pairs. This is a contextual history section, not a separate inbox or academic row. Fetching it must not mark messages read.
- [ ] In notification presentation add comment-specific URLs for each role. Keep content generic (“New private comment”), resolving child/activity labels through existing RLS. Do not attach a body snippet.
- [ ] Change notification callback signatures consistently across row/list/bell/hooks: pass `{id,expectedCommentVersion}` for an explicit comment read; ordinary notices pass only ID. Extend `readNotificationState` to accept an optional request body while preserving its signal and exact-token protection.

Keep camelCase in hook arguments and snake_case on the wire. The single-read hook's mutation function becomes:

~~~typescript
const mutation = useMutation({
  mutationFn: ({ id, expectedCommentVersion }: {
    id: string; expectedCommentVersion?: number;
  }) => readNotificationState<components["schemas"]["NotificationReadResponse"]>(
    userId,
    "/api/notifications/" + id + "/read",
    sessionSignal,
    expectedCommentVersion === undefined ? undefined :
      { expected_comment_version: expectedCommentVersion },
  ),
  onSettled: () => invalidateNotifications(client),
});
~~~

The all-read hook calls the same new transport signature with user ID, path and signal only. Remove the old browser-client argument from these two callers; do not change the ordinary HTTP body or SQL parameters.
- [ ] Bell activation for a comment closes the bell and navigates without marking read. Ordinary activation retains its behavior. Thread load then uses Task 6's watermark guard; middle-click/navigation failure cannot clear a comment alert. On COMMENT_READ_CONFLICT refresh silently and preserve unread, rather than displaying private backend data or marking optimistically.
- [ ] Exercise two linked parents, own-post exclusion, recipient-specific unread dot/count, new post during single/all-read, parent unlink while open, account sign-out during transport, and both no-upload/history deep links. Verify ordinary notifications, points-only grade links, worksheet destinations and sibling preservation still work.
- [ ] Run lint/TypeScript and production build. Record actual controlled/manual evidence, commit `feat: connect parent conversations and comment notifications`.

## Task 10: Upgrade proof, regression coverage and feature closeout

**Files:** New `backend/tests/migrations/comment_upgrade_check.py`; CI; final generated contracts; promoted docs/proposal/tracker and this execution record.

**Interfaces:** Upgrade script accepts `prepare|schema|verify --manifest <path>`, requires test+localhost for both URLs before creating clients, and writes a manifest containing only opaque IDs and hashes. It starts from complete pre-comments schema version `20261108062937`.

- [ ] Implement the pre-upgrade fixture with an owned activity, two families, active/returned submissions, draft/released grade states, a no-upload zero, existing ordinary unread/read notifications, private receipts and queued/skipped email rows. Reuse existing fixture helpers only where their required schema exists; preserve cleanup order student/submission before Auth users.
- [ ] Fingerprint explicit old columns before upgrade, including student-work due/pin/excused state, grade revisions/releases/source records, existing notification timestamps/dedupe/read state, receipts/outbox/preferences and parent-visible activity/score sets. Do not hash future column defaults as changes to old data.
- [ ] Add schema-mode red assertions:

~~~python
def check_comment_schema(db_value):
    assert db_value("select to_regclass('public.private_comment')") is not None
    assert db_value("select exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid "
                    "where t.typname='notification_type' and e.enumlabel='comment_posted')")
    assert db_value("select exists(select 1 from information_schema.columns "
                    "where table_schema='public' and table_name='student_work' "
                    "and column_name='comments_locked')")
~~~

In `verify` compare the old fingerprint, unlocked/zero counters, null versions on old notices, empty comments and no historical new notifications/emails. Then post, unassign, discover/read history with a real parent session, delete, and prove foreign-family denial. Exercise both the post-read-post notification cycle and preservation of an existing released grade.
- [ ] Add a sixth upgrade job before the existing network guard replay, keeping all five original proofs and always-teardown:

~~~bash
supabase db reset --local --version 20261108062937
cd backend
ENVIRONMENT=test uv run python tests/migrations/comment_upgrade_check.py prepare --manifest /tmp/comment-upgrade.json
if ENVIRONMENT=test uv run python tests/migrations/comment_upgrade_check.py schema --manifest /tmp/comment-upgrade.json; then
  exit 1
fi
cd ..
supabase migration up --local
cd backend
ENVIRONMENT=test uv run python tests/migrations/comment_upgrade_check.py verify --manifest /tmp/comment-upgrade.json
cd ..
supabase db reset --local
~~~

- [ ] Run all new modules plus existing notification, assignment, lifecycle, gradebook, email eligibility/dispatcher and deletion cases on the disposable stack. Verify a body sentinel appears only in the authorized thread/comment storage, never in notification/receipt/outbox, app logs, errors, gradebook CSV or offline research exports. Use synthetic exports, not an ad hoc real dataset export.
- [ ] Regenerate both actual contracts, run full pytest and all six upgrade proofs, Ruff/ESLint/TypeScript, security advisors/network checks and the production build. With a local stack use the canonical start → reset → pytest → stop flow, ensuring teardown on failure. With authorized CI, record exact head/run/artifact correspondence and rerun the final paired head; no success claim from a provisional type-drift failure.
- [ ] Promote the exact routes, errors, author/current-participant rules, body handling, helper grants, read snapshots, cursor shapes, history discovery and UI copy into the companion docs. DEPLOYMENT notes must describe enum-before-use migration ordering and compatible backend/frontend rollout; do not activate or reconfigure email.
- [ ] Record manual acceptance against the spec: teacher plus two linked parents, both siblings, before-upload/in-class/past-due/closed/excused comments, Return/retry timeline, read-only archive/unassignment/teacher lock, author deletion, no grade redraft, deep links, dot/bell reads, 360px/keyboard/focus/long text, and account/link revocation with the panel open. Distinguish independently observed evidence from user-reported sign-off.
- [ ] Obtain focused read-only code review of RLS/history predicates, actor derivation, body-safe failures, lock/snapshot behavior, no-email/no-grade regressions and portal destinations. Execute review inline unless the user has selected delegation. Fix material findings and rerun only affected checks plus any required final full gates.
- [ ] Update IMPLEMENTATION_STATUS with actual deliverables/evidence. Before all automated and manual gates pass, use Implemented, verification pending (or Partial with exact remaining items), never Verified. Keep Phase 3 at 4/6 until a slice qualifies; a verified Slice 6 would make 5/6 only while Slice 4 remains open. Preserve all branches/worktrees/env files. Do not merge, migrate hosted projects, deploy or enable email as an inferred closeout step.
- [ ] Commit verified docs/evidence with `docs: record private comments verification`. If PR publication is authorized, cite the Phase 3 proposal §8 Slice ⑥, this spec and checks actually run; prepare the exact description in a file or structured argument.

## Review checkpoints and spec coverage

| Spec requirement | Delivering tasks/review checkpoint |
|---|---|
| Participants, text, deletion, current links, read-only history | 1, 2, 3, 5; review storage/read scope before mutations |
| No-upload work; historical comment-only discovery; sibling safety | 1, 2, 8, 9; independently exercise retained history before UI closeout |
| Atomic post/fanout; grade-isolated locks; revocation gate | 3, 4, 5; review transaction/race evidence before portal integration |
| Return chronology, safe projection, exact cursors and retained pages | 2, 6, 7, 10 |
| Coalescing, no self/no email, single/all-read concurrent posts | 3, 4, 6, 9; require observed-lock tests |
| Safe APIs/logs/validation; direct caller-RLS reads | 1–6, 10 |
| Teacher/parent panels, deep links, unread dot, phone/keyboard/account changes | 6–9; manual portal gate |
| Existing grade/source/release/export/image/model boundaries | 3, 5, 8–10 |
| Migration/type pairing, prior upgrade proofs and independent Slice 4 status | 1–5, 10; final exact-head CI gate |

## Planning verification and handoff

All execution checkboxes start unchecked. This document contains intended implementation/test code, not executed application changes. The conversational/written design is approved; implementation execution is a separate next step using the selected execution skill. The plan self-review checks spec coverage, missing-content markers, file names, shared signatures, JSON fields, cursor order, migration dependencies, generated-type pairing and verification gates inline.

**Planning verification (2026-11-09):** Backend Ruff, whole-frontend ESLint and TypeScript (`--noEmit --incremental false`) passed against this isolated checkout using its existing installed tools. The plan's ten Python examples parsed with Python AST; its TypeScript/TSX examples parsed with the installed TypeScript compiler. Local Markdown links, balanced fences, ten numbered tasks, unchecked execution boxes and missing-content-marker scans passed. Inline self-review checked every spec section against the coverage table, shared names/types, exact alerted-entry acknowledgment, token lifetime, migration ordering and independent Slice 4 status.

These are documentation and example-syntax checks, not execution of the planned SQL, APIs, browser flows or tests. No application/API/migration file changed, and no backend database suite or portal QA was run by this planning pass. Existing earlier-slice evidence is not a new run of this plan; record implementation evidence as tasks actually execute.
