# Phase 3 Slice 6 — Private comments design

**Redesign note (2026-11-10):** This is the historical student × activity design. The user has selected separate threads per submission and approved deleting the associated thread when an authorized submission deletion occurs. The [replacement submission-thread spec](2026-11-10-submission-private-comments-design.md) is approved for the requested [replacement implementation plan](../plans/2026-11-10-submission-private-comments.md). The existing implementation/evidence below does not implement or verify that redesign.

**Date:** 2026-11-09 (Asia/Singapore)
**Status:** Approved for implementation planning on 2026-11-09. After the conversational design and written-spec review handoff, the user explicitly invoked writing-plans and requested the [implementation plan](../plans/2026-11-09-phase3-private-comments.md). This includes read-only history after unassignment, read-only archived activities, and author deletion in read-only threads. No Slice 6 application implementation, verification, integration, hosted migration, deployment or email activation is claimed.

**Scope source:** [Phase 3 proposal](../../next_steps/PHASE_3_CLASSROOM_ACTIVITIES.md), Q20–Q28, §4.8 and Slice ⑥. This spec supersedes its comment sketches where they differ. Existing assignment, submission, release, scoring and email contracts remain authoritative outside these extensions.

## 1. Baseline and boundaries

- Planning starts from local gradebook closeout `cb23d5c08b1092c9e1f18f5f57f52662ee9f3c88` on `feat/phase3-points-gradebook`. The documentation worktree is `.worktrees/phase3-private-comments`, branch `docs/phase3-private-comments`.
- That baseline combines main `6c77b06` with email foundation `0208549` and the completed gradebook work. Its tracker records Slices 1–3 and 5 Verified: Phase 3 is **4/6 verified**. These are existing records, not checks rerun by this design pass.
- Slice 4 retains its pending manual and operational gates. Comments have no email event and do not depend on live email activation. A future implementation must preserve the existing two-event email allowlist.
- Main has separate pending planning files. Preserve them, the email and gradebook branches, and all local environments. This spec does not authorize pushing a new branch, merging, or changing a hosted environment.
- Reconcile the execution baseline before implementation. If the gradebook branch is still unmerged, explicitly carry its foundation into the isolated Slice 6 implementation branch; do not implement against older main contracts or merge source branches as part of this planning pass.

## 2. Approved behavior

1. One thread belongs to a **student × activity**, anchored by `student_work`. It is available before an upload, persists across Return and resubmission, and is independent of points and score release.
2. The activity's owning teacher and **all currently linked parents** share the conversation. A newly linked parent sees its existing history. A different teacher does not inherit thread access by teaching the same child. Removing a parent link revokes that parent's thread access.
3. Comments are plain text, 1–1000 Unicode characters after trimming surrounding whitespace. Preserve internal line breaks. Reject whitespace-only text and characters PostgreSQL text cannot store. Render escaped text without markdown, HTML interpretation, attachments or automatic links.
4. There is no editing. An author may delete their own comment while they still have thread access, including when posting is disabled. Deletion sets the body to null and stamps `deleted_at`; a fixed “Comment deleted” entry preserves position. Another participant, including the teacher, cannot delete that author's message.
5. Posting requires current assignment, a non-archived activity, and an unlocked thread. In-class work, past-due work, closed uploads, excused work and draft results can still receive comments when those three conditions hold. Upload closure is not comment closure.
6. After unassignment, existing conversation history stays readable. Reassignment restores posting if the activity is active and the teacher has not locked the thread. Archiving also makes threads read-only; unarchiving does not clear an explicit teacher lock.
7. Teacher locking stops new posts from everyone, including the teacher, until unlocked. Reading and author deletion remain available. Changing a comment lock must not redraft a grade or reconcile an unrelated score source.
8. Return events are read-only projections of existing submission records. They are not comment rows. Sort them by `returned_at`, and comments by `created_at`, with deterministic tie-breaking.
9. A new comment notifies every other current participant through one coalesced unread in-app alert per recipient/thread. There is no email, body preview in notifications, separate inbox, per-message read receipt, or typing indicator.
10. The composer explains that everyone in the thread can read messages immediately, even before results are released. Preserve the accepted possibility that a participant types a score into a comment; do not add content filtering or couple comments to grade publication.

### Access matrix

| State | Read existing thread | Post | Delete own comment |
|---|---|---|---|
| Current participant, assigned, active, unlocked | Yes | Yes | Yes |
| Current participant, activity no longer assigned | Yes | No | Yes |
| Current participant, archived or teacher-locked | Yes | No | Yes |
| Parent no longer linked, unrelated parent, or non-owning teacher | No | No | No |

The history exception applies to an existing authorized student/activity relationship. It does not permit opening arbitrary never-assigned pairs. Assignment permits opening an empty thread without creating database rows. Existing comments, including deleted placeholders, establish comment history after unassignment. Existing submission or grade history may establish the same work relationship under their existing authorization rules.

The teacher retains comment history as the activity owner. Existing RLS still controls student labels, submission rows and Return projections; retaining comment history must not grant broader access to a former roster student's worksheets, scores, measurements or profile. Use a generic student label when current profile access is absent. Parents remain independently authorized through their current child link.

## 3. Architecture and alternatives

Extend existing student-work screens with a reusable thread component. Teacher activity rows, the gradebook work panel and parent activity details all address the same activity/student pair. This keeps communication in the context of the work and supports pairs without uploads or grades.

A separate messages area would require cross-activity navigation and inbox state beyond the accepted scope. Separate threads per submission would fragment Return/resubmission conversations and violate the student-work anchor. Neither is part of this slice.

For reads, prefer a caller-scoped, **security-invoker** database function that returns thread state and a paginated union of comments and visible Return events in one statement. Underlying table RLS remains authoritative; browser reads use the caller's session, never the service key. Compared with independently fetching and merging two browser lists, one feed gives a coherent read watermark and a single pagination order.

Writes go through FastAPI identity and application authorization checks, followed by service-only transactional database functions that repeat authorization. Derive the author's identity and role from verified identity plus actual ownership/parent relationships, never from request fields or user-editable metadata. All browser mutation grants are denied.

Keep comment code in focused API, contract, thread-read and notification helpers. Reuse the existing work-lock protocol, notification account cleanup and UI primitives. Add no dependency, queue, worker, Realtime subscription or frontend test framework.

## 4. Storage and RLS

The implementation will allocate migration files with the Supabase CLI. This design contains no final DDL or invented migration filenames.

### Comment records

`private_comment` contains the UUID identity, activity/student pair, nullable author ID, server-derived teacher/parent role, body, deletion timestamp, creation timestamp and a monotonically increasing per-thread comment version. The pair references `student_work` with cascade deletion. Preserve the proposed author-account deletion behavior: null the author reference without losing the conversation entry or stored role.

Enforce live-body/deleted-placeholder consistency, valid role, body length, and uniqueness of the comment version within the pair. Index the foreign-key access paths and pair/feed ordering, including an author index where needed for account deletion. Never store names, email addresses, copied scores or image references in the comment record.

Add `student_work.comments_locked`, default false, and a nonnegative comment-version counter, default zero. These are non-score metadata. Creating work to post a comment does not create a submission, grade, override or release record.

### Read policies and historical discovery

Enable RLS on comments; authenticated clients have SELECT only. A comment row is visible only to its activity owner or a currently linked parent of its student. Client INSERT/UPDATE/DELETE and mutation-RPC execution remain denied. Services repeat pair validation before mutations.

History requires more than retaining rows: the current activity RLS and selected-child hooks must also permit reopening a **comment-only** thread after unassignment, including one with no upload or grade. Add a narrow, caller-authorized history predicate for that purpose. It may expose only whether this caller has comment history for the pair/activity, never a body or another child's membership. If a private SECURITY DEFINER predicate is necessary to avoid RLS recursion, keep it in the unexposed schema, pin an empty search path, check `auth.uid()` against current ownership/link records, and grant only its required boolean use.

Apply pair-specific filtering in parent discovery. An activity visible through one sibling's history must not make another sibling's thread available. No new broad SELECT policy on submissions, measurements, scores, teacher profiles or parent profiles is justified by this feature.

Do not treat comment history as an academic contribution. Existing points, totals, grade applicability and CSV cell inclusion retain their own rules. Read historical conversations through the activity/thread path when a gradebook cell is not applicable.

## 5. Thread feed

The read returns scoped work metadata, posting eligibility/read-only reasons, current lock state, feed entries, an older-page cursor, and the maximum comment version actually represented in the returned entries. Opening an assigned empty thread is a read, not an upsert.

- A comment entry carries only its safe display fields, author role, whether it belongs to the caller, creation time, deletion state and comment version. Labels can be “You,” “Teacher,” and “Parent”; do not expand profile access to obtain another parent's name.
- A Return entry carries its submission identity, `returned_at`, reason and note from the caller-visible submission projection. It never carries unreleased scores, measurements, image references or a copied comment body.
- Use a total order `(event_at, entry_kind, entry_id)`, with a fixed documented order for the two kinds. Comments use `created_at`; Return entries use `returned_at`. Preserve timestamp precision in cursors.
- Fetch the newest 50 entries initially, capped at 100 per request; render chronologically and support loading older entries with keyset pagination. Refresh the loaded window without dropping pages or duplicating entries. A deleted comment remains at its original position.
- The read watermark comes from returned comment entries, not a later independent read of the work counter. A later comment must not be acknowledged as content already loaded.
- Return entries remain derived. If their source submission is legitimately removed, no duplicate Return audit row is manufactured in the comment table.

## 6. Posting, deletion and locking

Posting performs the following as one short transaction:

1. Lock the activity, establish/upsert and lock the work row, and recheck the actual actor, current assignment, archive state, participant links and thread lock.
2. Validate the text again at the database boundary; increment the thread's comment version and insert the comment with trusted identity/role and a server timestamp captured after acquiring the work lock. A transaction's earlier start time must not reorder a post that waited behind another post.
3. Capture the authorized participant set, exclude the author, and insert or coalesce each recipient's notification in deterministic recipient order.
4. Commit the comment, counter, private delivery evidence and public notifications together. Any failure rolls them all back.

Use the existing activity-before-work lock order. Coordinate assignment/section/roster/link changes at the authorization boundary, including membership-row locking where required; an earlier Python precheck is insufficient. Participants added after the posting snapshot can read history but receive no retroactive alert. Revocation committed before the transaction's authorization gate must prevent a post by that actor or fanout to that removed participant.

Author deletion rechecks current thread access and exact ownership transactionally, scrubs the body, and is idempotent for an already-deleted own row. Foreign, unavailable and missing IDs return the same not-found response. It does not increment the posting version, notify again, remove the placeholder or erase unrelated thread notifications.

Expose teacher lock control through a dedicated comment-lock mutation so its transaction can preserve grade state. It uses the same activity/work serialization as posting and rechecks actual activity ownership; a mixed grade/comment patch is unnecessary. Locking an existing historical or archived thread is allowed. Do not create an arbitrary unassigned work pair merely to set a lock.

A post that commits before a lock takes effect remains in history. If the lock or archive change wins first, the post fails with the relevant fixed conflict code. No provider I/O, image processing or score calculation belongs in these transactions.

## 7. Notifications and read races

Add `comment_posted` to the notification enum in its own committed migration before later migrations use it. Comment notifications have no submission ID and contain identifiers only. Preserve the existing constraints for all other event kinds, including Slice 5's points-only score notices.

The existing unread notification remains the sole per-recipient/thread unread state. Add comment-version metadata to the notification and enforce at most one unread comment notification per recipient/activity/student with a partial unique index. Comment rows use a positive version; ordinary notification types keep their existing behavior without a comment version.

On another post, update the existing unread row's version and feed timestamp; after that row is read, a later post creates a new notification. Keep the global dedupe key unique and private delivery receipts consistent with the existing emitter design. All of this belongs to the posting transaction. Never enqueue email for this type or add comment text to notifications or receipts.

### Acknowledging a thread

- Navigating from a comment alert opens the target thread first. Do not use the existing bell's unconditional mark-read-on-click behavior for comments.
- After successfully loading and rendering the thread, acknowledge the recipient's comment notification only through the comment version represented in that loaded content. A concurrent coalesced update with a newer version must remain unread.
- This is acknowledgment of a coalesced thread alert, not per-message or scroll-position tracking. Once the latest comment represented by that alert has loaded, older history pagination is not a prerequisite for clearing the alert. If the newest alerted comment is not in the loaded entries, leave the alert unread until it is loaded or the user explicitly marks it read.
- Check exact presence of the alerted comment version in the loaded entries, as well as the read watermark. The recipient's own newer posts can raise that watermark without loading an older received comment; that must not automatically acknowledge the unseen alert.
- Extend single-notification read requests with an expected comment version for comment rows; ordinary rows retain their existing request/response behavior. Reject a comment acknowledgment without the required version. A stale version returns a fixed conflict code and refreshes state; it must not falsely report a read timestamp.
- An explicit bell “Mark read” uses the version displayed in that bell row. It is allowed without opening content, but still cannot swallow a concurrently newer version.
- “Mark all read” intentionally acknowledges the caller's unread snapshot. Capture both row IDs and comment versions; do not select by timestamp alone. If a post updates an unread row while that operation waits, the version comparison leaves the new alert unread. Ordinary notification read timestamps and existing cutoff behavior are preserved.

After successful post/read/delete/lock actions, refresh relevant thread and notification queries. The bell count and gradebook dots share the recipient-scoped notification source and invalidation. An explicit all-read clears the dots too; no second read-receipt table is introduced.

Coalescing moves notification timestamps. Extend the existing retained-window feed checks to prove ordering, pagination, deduplication and load-more behavior when an already-loaded row moves to the head.

## 8. API and error contract

Public write routes for the implementation plan and promoted API documentation:

| Method/path | Contract |
|---|---|
| `POST /api/activities/{activity_id}/students/{student_id}/comments` | Verified participant; body text only; returns the committed comment identity/version with HTTP 201 |
| `DELETE /api/comments/{comment_id}` | Current participant and author only; body scrubbing; HTTP 204, including repeat deletion |
| `PUT /api/activities/{activity_id}/students/{student_id}/comments/lock` | Actual owning teacher; strict boolean `locked`; returns current thread lock state |
| `POST /api/notifications/{notification_id}/read` | Existing route; an expected comment version is required only for the new type |

Reads use the caller-scoped database thread function and table RLS, not a service-role GET that returns a manually filtered conversation. Browser-supplied identity/role/recipient/creation fields are rejected or ignored as authority; request contracts forbid extra posting/locking fields.

Preserve the standard `{ error: { code, message, details } }` envelope. Use `NOT_FOUND` for foreign or unavailable work/comments, `VALIDATION_ERROR` for malformed text/cursors/versions, and fixed 409 codes for `COMMENTS_LOCKED`, `ACTIVITY_ARCHIVED` and `COMMENT_READ_CONFLICT`. Preserve assignment denial conventions through `ACTIVITY_NOT_ASSIGNED` for a participant's readable but currently unassigned work. Invalid UUIDs remain validation errors. Catalog all introduced paths/codes in API_SPEC §2.4 at implementation.

Catch and normalize comment SDK/database failures before they can reach the current generic exception logger with private details. SQL constraint errors can contain failing-row text: never log their raw exception, message, details, hint, request body or SQL parameters. Validation errors use fixed messages and omit input values. Tests must inject private body text into both SDK errors and unexpected transport failures, not just successful requests.

## 9. Portal integration

Use one reusable `StudentWorkThread` UI and actor/pair-scoped hooks, mounted only when the target conversation is open.

- **Teacher:** integrate a Comments view into the existing student-work panel; add entry points on activity student rows, including no-upload work. Gradebook cells show an accessible unread indicator backed by a batched recipient notification query, without changing gradebook calculations or issuing one unread query per cell. A historical comment-only pair remains reachable from the activity history path even if it has no applicable grade cell.
- **Parent:** open comments from the selected child's activity details and preserve the selected child on entry and exit. Include historical conversation access in that activity context, including comment-only work after unassignment. Show a readable reason when posting is disabled. Do not add a separate inbox or make conversations depend on a released grade or worksheet viewer.
- **Deep links:** include both student and activity, plus an explicit comments target. The teacher activity route and parent `/progress` target parser must open that exact pair without requiring a submission ID. Reject malformed/duplicate parameters and foreign child IDs. An unavailable target shows the existing safe unavailable state.
- **Composer:** identify the shared audience and immediate visibility, show the text limit, disable repeat submission while pending, retain the draft on a recoverable failure, and clear it after success. Do not persist drafts in local storage or across account/child changes.
- **Deletion and locking:** use accessible controls, an author deletion confirmation, and fixed placeholders. Keep the thread open after posting or lock changes. Restore focus to the initiating control when closing; support keyboard use, phone layouts, long unbroken text and internal line breaks.
- **Refresh:** reuse 60-second foreground polling and refresh on focus/open; invalidate immediately after local actions. Preserve loaded history and the user's scroll position. Account changes cancel requests and remove thread bodies, drafts and notification/gradebook state; a revoked-access response clears previously cached content for that pair.

Keep comments separate from the academic CSV and research export schemas. All existing teacher/parent worksheet, grading and upload flows remain usable without opening a thread.

## 10. Verification and promotion

Implementation must provide evidence for these boundaries, not just checked task boxes:

1. **RLS and roles:** real signed-in teacher/parent tests for owner/all-linked-parent access, no-upload reads, sibling and cross-family denial, non-owning teachers, revoked links, current role/relationship derivation, and denied browser mutation/RPC execution.
2. **Historical discovery:** post before any upload; unassign or move sections; reopen the exact child's read-only conversation; reassign and resume. Deleted placeholders preserve history. An unrelated sibling does not inherit it. Keep archived history readable and preserve explicit locks on unarchive.
3. **Text and deletion:** Unicode/length/blank/null/extra-field cases, escaped HTML/markdown-like strings, author-only scrubbing, idempotency, account deletion's author-null behavior, student/activity cascade behavior, and no editing path.
4. **Transactions and races:** force notification/receipt failures to prove rollback; observe lock waits for post-versus-lock/archive/assignment/link changes, simultaneous posts, and every read/coalescing ordering. Prove N posts produce one unread alert per other participant, no self alert, and a later post after reading creates a new alert.
5. **Timeline and pagination:** Return time differs from upload time; equal timestamps across entry kinds; microsecond cursors, deleted entries, retained pages, concurrent posts and moved notification rows. Verify the loaded comment watermark, single-read conflict and mark-all snapshot with real database coordination.
6. **Grading and privacy:** compare grade revisions/releases, active attempts, point totals, reminder eligibility and both email gates before/after comment and lock actions. Capture logs and errors with a unique body sentinel; verify it never appears in logs, notifications, outbox, CSV or research outputs. Return notes are not copied into comments.
7. **Upgrade proof:** replay the pre-comments baseline and all new migrations on a disposable local stack. Preserve existing assignments, submissions, grades, publication, notification/read/delivery and email state; defaults are unlocked/zero version, comments start empty, and no historical notifications/emails are synthesized. Extend, rather than discard, existing upgrade and generated-contract checks.
8. **Required checks:** Ruff, whole-frontend ESLint and TypeScript; relevant unit cases plus the full backend suite on the ephemeral Supabase stack because API/migrations change; actual regenerated `frontend/types/database.ts` and `frontend/types/api.ts`; security-advisor gate and a production frontend build for the new route/panel integration.
9. **Manual acceptance:** both portals, two linked parents, siblings, before-upload posting, Return/retry context, gradebook dot and bell, deletion, lock/archive/unassignment recovery, phone/keyboard use and sign-out with an open conversation. Record what was independently observed versus user-reported.

Promote final contracts into API_SPEC, DATABASE, DESIGN, ARCHITECTURE, SECURITY and TESTING, with deployment notes only where the migration/rollout order requires them. Update this proposal/tracker with actual evidence. Slice 6 remains Not started in application terms during design/planning, then Implemented, verification pending until all required gates pass. Phase 3 stays **4/6 verified** until another slice independently qualifies; Slice 4's pending QA/activation remains separate.

No scoring formula, ScoreProvider selection, calibration/export behavior, image hardening, model loading, in-process pipeline, single Uvicorn worker, retention policy, dependency automation or app-level rate-limiting policy changes belong to this slice.

## 11. Source checks and next gate

The repository audit inspected the verified gradebook worktree's actual `student_work` policies, gradebook history helpers, lifecycle mutations, notification storage/read functions, bell activation/read hooks, parent target parser, work-grade sheet and error handlers. Their current behavior motivates the comment-only history path, narrow lock mutation and version-checked read acknowledgment above.

Primary documentation checked during design: [Supabase RLS and security-invoker views](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL 17 enum migration transaction rule](https://www.postgresql.org/docs/17/sql-altertype.html), and the [Supabase changelog](https://supabase.com/changelog). Current package and database choices remain the repository's pinned baseline; no upgrade is proposed.

**Documentation verification (2026-11-09):** Backend Ruff, whole-frontend ESLint and TypeScript (`--noEmit --incremental false`) passed using the existing installed tools against this isolated checkout. Relative Markdown links, whitespace and the new spec's incomplete-marker scan passed. Inline self-review checked the approved decisions, historical discovery, unread races, grade isolation and status consistency. No application/API/migration file changed; the backend database suite and portal QA were not run by this documentation pass. These checks establish documentation delivery only, not Slice 6 feature verification.

The user approved progressing to implementation planning by invoking writing-plans on 2026-11-09. The [implementation plan](../plans/2026-11-09-phase3-private-comments.md) supplies file boundaries, shared interfaces, migration ordering, red/green verification steps and closeout gates. Execute inline unless the user explicitly selects delegation. Design/planning does not dispatch agents or start application implementation.
