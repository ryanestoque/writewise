# Phase 3 Slice 6 — Private comments per submission

**Delivery tracking (2026-11-10):** Inline implementation and exact verification evidence are tracked in the [execution record](../plans/2026-11-10-submission-private-comments.md). Schema/backend/frontend changes implement this approved scope on the retained feature branch. Automated final gates and signed-in portal acceptance are distinct; this spec does not authorize hosted cleanup, migration, merge/deployment or email activation.


**Date:** 2026-11-10 (Asia/Singapore)

**Status:** Implemented and **Verified** after overall user portal QA sign-off on 2026-11-10 and green current-head CI (1,038 tests, seven upgrade proofs). This is user-reported acceptance, not an independently observed itemized portal walkthrough. See the [execution closeout](../plans/2026-11-10-submission-private-comments.md#verification-closeout--2026-11-10). Integration and hosted deployment remain separate.

**Design approval history:** Approved for implementation planning on 2026-11-10. After the written-spec handoff and clarification of current code versus the redesign, the user explicitly invoked writing-plans and requested the [replacement implementation plan](../plans/2026-11-10-submission-private-comments.md). The user selected a separate thread for every submission and approved preserving existing submission-deletion permissions, with its conversation deleted alongside the attempt. Current activity-level comments contain only test data or no data, per the user. This document specifies the redesign; it does not claim implementation, verification, integration, or hosted migration.

**Baseline:** `.worktrees/phase3-private-comments`, branch `feat/phase3-private-comments`, implementation closeout `70f617c` and redesign commit `9b1723a`. The existing student × activity implementation and its recorded automated evidence remain historical evidence for that implementation. They do not verify this redesign. The [previous spec](2026-11-09-phase3-private-comments-design.md) and [execution plan](../plans/2026-11-09-phase3-private-comments.md) describe the old scope. This approved spec supersedes their thread identity, storage, discovery, notification, and portal contracts for forthcoming implementation. Unchanged privacy and text-handling requirements carry forward as stated below.

## 1. User behavior

One submission ID identifies one conversation. Two uploads by the same child for the same activity have independent comments, lock state, versions, and unread alerts. A resubmission starts with an empty conversation. Nothing is copied or reassigned from an older attempt.

Comments are available once the submission record exists, including processing, rejected, completed, returned, and unreleased attempts. They do not require a released score, a point grade, or a currently counted attempt. Replacing the counted attempt or pinning another attempt does not move conversations or close an older thread.

The owning teacher and all currently linked parents share that submission's conversation. A newly linked parent can read its history; removing the child link revokes access. Another teacher does not gain comment access merely by teaching the same child. Every participant sees new comments immediately, including before results are released.

Posting requires a currently assigned activity, a non-archived activity, and an unlocked submission thread. Past-due and closed-upload rules do not close comments. Older attempts remain postable under the same gates until explicitly locked. After unassignment or archive, retained conversations remain readable and authors may delete their own comments while still authorized. Locking stops everyone from posting, including the teacher; unlocking restores posting only when the other gates permit it.

There is no conversation before an upload. Missing work, excused work without a submission, and points-only grades do not acquire synthetic submissions or threads.

### Example

1. Attempt A is uploaded; its conversation begins empty.
2. The teacher comments on A and returns A with a note. Both entries appear only in A's timeline.
3. Attempt B is uploaded; B has an empty conversation and independent unread and lock state.
4. Opening B does not acknowledge A's comments. A remains reachable from submission history.
5. An authorized deletion of A removes A's conversation and public submission-linked alerts. B is unaffected.

## 2. Submission deletion and comment deletion

Preserve existing single and bulk submission-deletion permissions, including the parent's uploader, child-link, and grading checks. Having comments does not create a new deletion prohibition or grant a new delete permission. The existing authorized deletion transaction must cascade through the submission's thread and comments. This intentionally removes all participants' messages when their submission is deleted.

Use the existing Storage-first deletion flow and its retry/failure contract. PostgreSQL deletion of the submission, thread, comments, public submission-linked notifications, and existing dependent academic records is atomic. Storage and PostgreSQL are still separate operations; do not claim a distributed transaction or introduce a cleanup worker.

Update every teacher/parent single and bulk confirmation that deletes submissions. The confirmation must explicitly include the associated comments among the permanently deleted records. Do not display a promise to preserve messages after deleting their submission. A representative sentence is: “This will permanently delete this submission and its comments.” Retain any existing explanations about photos, analysis, scores, and retained work-grade behavior that apply to that surface.

Deleting one comment is different: only its author may delete it while still a participant. Set its body to null and retain its tombstone and chronological position. No editing is added. Whole-submission deletion removes the thread, including tombstones, by the explicitly approved submission-deletion rule. Existing private notification-delivery receipts may remain as identifiers-only delivery evidence under their established retention contract; they never contain comment bodies or reopen a deleted thread.

After successful deletion, invalidate the affected submission, comment, history, notification, and gradebook queries. An open or stale link to a deleted submission shows the safe unavailable state and clears cached bodies and drafts. A failed database deletion retains the comments with their submission, even if Storage removal already succeeded.

## 3. Storage and access boundaries

### Thread state

Introduce `submission_comment_thread` with a primary key `submission_id` referencing `submission.id` with `ON DELETE CASCADE`, `comments_locked` default false, and a nonnegative integer `comment_version` default zero. This separates comment metadata from score publication and student-work selection. An empty thread read does not insert a state row. The first post or an authorized lock change may create its state row for an existing submission.

Re-anchor `private_comment` to `submission_id`, referencing its thread with cascade deletion. Preserve comment UUID, nullable Auth author FK with `ON DELETE SET NULL`, server-derived author role, text body, deletion timestamp, creation timestamp, and positive integer comment version. Versions are unique within one submission. Derive the student and activity from the submission; do not accept or independently maintain a conflicting student/activity identity on comments.

Index the comment feed by submission, time, and ID; cover the author FK. The thread primary key covers its submission FK. Retain body/tombstone consistency, strict role checks, Unicode trimming, and 1–1000 character validation at both API and database boundaries. Remove the old active use of `student_work.comments_locked` and `student_work.comment_version`; no work-wide lock or version may control a submission thread after cutover.

### Read authorization

Enable RLS on exposed thread/comment tables and grant authenticated clients scoped SELECT only. Reads use caller-scoped security-invoker RPCs. An existing submission must belong to the activity owner or to the child of a currently linked parent. Authorize the exact submission; another visible attempt, sibling, activity, grade, or pair does not substitute for it.

Preserve the old comment feature's history exception for the activity owner after roster changes and for currently linked parents after unassignment/archive, while the source submission still exists. Existing submission RLS may hide a former-roster owner's submission row, so a boolean policy alone cannot supply retained thread context. Use a narrowly scoped private SECURITY DEFINER context helper with an empty search path and an internal `auth.uid()` participation check. For an exact authorized submission it may return only submission/activity/student IDs, upload time, status, activity owner, and activity archive/assignment context; otherwise return no context. Its execution grants must be explicit and minimal. Do not accept a caller-selected actor identity or return a worksheet, score, profile, unrelated child's membership, or other submission fields. Caller-rights thread reads and table RLS use this limited context. Do not broaden submission, image, measurement, grade, or profile SELECT policies to make comment history work. Use a generic student label when the caller lacks current profile access.

Revoke browser writes and service mutation-RPC execution. FastAPI verifies the caller and checks real relationships before each write; service-only transactional functions repeat that authorization. The caller cannot select author identity, role, recipients, timestamps, versions, or work identity through request fields.

## 4. Transaction and race behavior

Preserve the existing activity-before-student-work serialization used by assignment, lifecycle, and gradebook code. For a comment mutation, derive the pair from the source submission, acquire activity/work locks in that established order, lock and recheck the exact submission, then lock/create its thread state. Coordinate participant-link changes at the authorization gate as the current implementation does. Never hold a submission lock and subsequently acquire an activity/work lock in the opposite order.

Recheck that the submission still exists and still has the derived activity/student identity after waiting. A concurrent submission deletion must serialize with posts, locks, and author deletion. If posting commits first, subsequent authorized submission deletion removes that post by cascade; if deletion wins, posting fails safely without recreating a submission, work pair, thread, notification, or receipt.

Posting validates the text, increments only this thread's version, inserts the trusted comment, captures current participants, and emits/coalesces their notifications in one transaction. Exclude the author. Any fanout failure rolls back the comment, version, receipts, and notifications. Capture the comment timestamp after acquiring locks so a waiting writer does not reorder committed posts.

Locking and comment deletion preserve grade revisions, release state, active-attempt selection, scoring, deadlines, and unrelated threads. Author deletion does not increment the posting version or notify again. A private-text failure uses a fixed safe error; raw database/SDK errors, request bodies, SQL parameters, and failing-row details must never enter logs or responses.

## 5. Thread feed and API contract

The canonical thread target is `{ submissionId }`; activity/student identifiers are derived response/navigation metadata, never an alternative thread key. Account and submission IDs scope query keys, draft state, pagination, and invalidation.

Read through `read_submission_comment_thread(target_submission_id, before_cursor?, page_size=50)`. Return submission/activity/student IDs, activity title, submission upload time and status, actor role, assigned/archive/lock flags, posting/locking eligibility, ordered read-only reasons, entries, next cursor, loaded-comment watermark, and the recipient's unread notice/version. Any display metadata must obey the caller's existing visibility rules. Do not include hidden academic results or image URLs.

The feed contains this submission's comments and this submission's Return event, if caller-visible under existing submission rules. Return entries remain projections of `returned_at`, reason, and note; do not store copies as comments. Order comments by `created_at`, Return entries by `returned_at`, with the existing total order `(event_at, kind, id)`, where `comment < return`. Retain exact timestamp precision, newest-page reads, chronological rendering, keyset pagination, retained older pages, and deleted placeholders. No other attempt's Return event can enter this feed.

Thread summaries, where used for retained history, list separate submissions within an owning teacher's activity or a currently linked parent's child. Include each submission ID and upload time so attempts are distinguishable. Sort comment-history summaries by `(last_comment_at, submission_id)` with a complete cursor. Tombstones count as history. Ordinary submission history supplies attempts with no comments or only a Return event; a separate inbox is not added.

| Surface | Contract |
|---|---|
| `POST /api/submissions/{submission_id}/comments` | Strict `{ body }`; returns committed comment identity, submission ID, server-derived pair metadata, role, time, and version with 201 |
| `PUT /api/submissions/{submission_id}/comments/lock` | Strict `{ locked: boolean }`; actual owning teacher only; returns submission ID and lock state |
| `DELETE /api/comments/{comment_id}` | Current participant and author; body scrubbing; idempotent own deletion with 204 |
| `POST /api/notifications/{notification_id}/read` | Retain expected comment version for comment alerts and ordinary notification behavior |

Replace the old activity/student posting/locking routes and old pair-scoped read contracts. Do not accept an old pair-only write by guessing a submission. Retire old RPC overloads/grants so an obsolete client cannot continue posting activity-wide comments. Invalid and unavailable targets retain the standard error envelope and fixed error codes. Reuse `NOT_FOUND`, `VALIDATION_ERROR`, `ACTIVITY_NOT_ASSIGNED`, `ACTIVITY_ARCHIVED`, `COMMENTS_LOCKED`, and `COMMENT_READ_CONFLICT` for their existing meanings. Catalog any additional implemented path in API_SPEC §2.4.

## 6. Notifications and unread state

Every `comment_posted` notification has a non-null `submission_id` and matching activity/student identifiers derived from that submission. Preserve the existing submission FK cascade. Adjust notification shape checks without narrowing the existing points-only `score_released` exception or changing other notification types.

Coalesce at most one unread comment notice per `(recipient_id, submission_id)`, rather than per student/activity. Include submission identity in dedupe keys and private receipt logic. Retain independent version counters: version 1 on A and version 1 on B represent different comments. Posting to B must never update A's alert.

Retain exact loaded-entry version acknowledgment, optimistic read conflict handling, materialized all-read snapshots, no self-notifications, and no comment emails/body previews. Bell activation navigates before acknowledgment; the exact notified submission/version must be rendered before automatic acknowledgment. Opening one attempt does not acknowledge another. Mark all read intentionally retains its existing caller-wide semantics.

One recipient-scoped batched unread query supplies per-submission badges and aggregate gradebook/activity indicators. An aggregate dot means at least one attempt is unread; it must not imply that the default/current attempt contains every unread message. Selecting or acknowledging one attempt leaves other unread attempts indicated. No per-row unread request or second read-receipt table is introduced.

## 7. Teacher and parent interfaces

Reuse the existing comment UI parts, body rendering, pagination, safe retries, author deletion, and lock controls. Change their target and labels to an exact submission and show its upload date/time and status so two attempts cannot be confused. Use labelled submission details/Comments views inside an existing page or viewer rather than stacking a comment modal over a worksheet modal. Comments remain reachable for rejected and processing uploads; access must not depend on an image, overlay, score, or released feedback loading successfully.

### Teacher

- Add Comments to submission detail pages/dialogs and actions for individual attempts. Switching between attempts switches the exact thread and clears the previous draft.
- Activity-level no-upload student rows no longer start a conversation. Activity history may list retained submission conversations, each labelled with its upload time.
- The gradebook Comments view selects an existing attempt. Initially select the counted attempt when available, otherwise the newest retained upload by `(created_at, id)`. Show a labelled attempt picker with per-attempt unread indicators so older returned/rejected attempts stay reachable. Explicit notification/submission links override that default.
- If no submission exists, show “Comments are available after a worksheet is uploaded.” Do not create a thread from a grade or work row.

### Parent

- Latest worksheet, pending/returned/rejected details, released feedback, and submission-history entries open Comments for their exact submission.
- Practice/Grades shortcuts select the counted attempt, otherwise the newest retained upload, with the same explicit attempt picker and unread context. Retain the selected child on entry/exit.
- A child/activity with no upload shows the same no-submission explanation and no composer. Comment-only activity conversations and their former before-upload entry points are removed.
- A currently linked parent can revisit retained authorized attempts after unassignment/archive; opening an older thread does not depend on the activity being currently assigned or its grade being published.

### Links and account state

Teacher comment links use `/activities/{activity_id}/submissions/{submission_id}?view=comments`. Parent links use `/progress?child={student_id}&activity={activity_id}&submission={submission_id}&view=comments`. Validate exact child/activity/submission consistency, UUIDs, duplicates, and conflicting grade/view targets. Preserve ordinary worksheet, grades, and non-comment notification links.

Old pair-only comment links show a safe message asking the user to choose a submission; they must not silently open the newest attempt and invite a reply to the wrong conversation. Clearing a destination preserves the selected sibling. Missing/deleted/foreign submissions show the established unavailable state.

Retain the composer audience hint, immediate visibility, Unicode code-point counting, plain escaped text with line breaks, no automatic links/attachments/markdown, phone-safe bounded textarea, keyboard dismissal, and restored opener focus. Pending writes are not automatically retried. Account/child/submission changes cancel reads, unmount drafts, and isolate cached bodies. Access revocation clears previously loaded private content. Preserve 60-second foreground polling, focus/open refresh, loaded history, and scroll position.

## 8. Forward migration and compatibility

Use new CLI-allocated, versioned SQL migrations on top of the existing committed Slice 6 migrations. Do not rewrite applied migrations, reset a hosted project, alter academic history, or silently assign an activity-level message to the newest/only upload.

The supported cutover baseline contains no legacy activity-level comments or `comment_posted` public notifications. A migration preflight must detect either and fail atomically with a fixed privacy-safe explanation, before removing or replacing old structures. Do not infer permission to delete hosted test data from the user's report that no real conversations exist. Fresh disposable test stacks need no data mapping; if a retained environment has old test rows, their cleanup is a separately scoped operational step before applying this cutover. Ordinary notifications and private delivery receipts remain intact.

With that empty legacy baseline, replace pair-based storage/RPCs/helpers, pair-only history policy extensions, the partial notification index, and obsolete work comment fields with the submission-scoped contracts. Keep activity visibility for genuine historical submissions and existing grades; comments can no longer establish no-upload history. Remove obsolete grants and overloads explicitly. New existing-submission threads are unlocked/zero-version by default and no historical comments or alerts are manufactured.

Document a coordinated backend/frontend cutover; do not run old pair writes and new submission writes concurrently. Regenerate database and OpenAPI types from the actual migrated database and FastAPI schema in the same implementation change. Update DESIGN, DATABASE, API_SPEC, the Phase 3 proposal, TESTING, DEPLOYMENT, the execution plan, and the implementation tracker when implementation lands. Preserve the old spec and verification history as historical records with a supersession link.

No hosted database changes, branch publication, merge, deployment, or email activation are authorized by this design-writing step. Keep the existing worktree, environment files, email/gradebook work, and unrelated pending work.

## 9. Required verification

Use existing test tools and synthetic fixtures; do not add a frontend test framework. Implementation begins with meaningful failing tests against the old pair-scoped behavior.

- **Attempt isolation:** two submissions for the same child/activity have different messages, Return entries, lock states, versions, and unread alerts. A new upload starts empty; pinning/counting changes do not move history. Empty reads create no thread/work/submission/grade.
- **Participation and visibility:** activity owner plus two linked parents; foreign teachers/families; siblings; malformed/mismatched navigation metadata; current-link revocation; owner history without widening worksheet/profile access; drafts and released scores; processing/rejected/returned uploads; archive/unassignment and author deletion while read-only.
- **Posting and locks:** strict text and Unicode limits; both-role posting; each posting gate; per-submission teacher locking; own-comment scrubbing; atomic fanout rollback; no grade revision/release, source, due-date, or work-selection changes.
- **Observed races:** post versus lock, archive, assignment/link change, and submission deletion; concurrent first posts and first lock; exact-alert single-read in both post/read lock orders; all-read snapshots; posting to different submissions without cross-acknowledgment. Verify transaction ordering rather than relying on sleeps.
- **Deletion:** permitted and denied teacher/parent single and bulk operations with comments; graded-parent denial; all-participant conversation cascade; unrelated attempts survive; public alerts disappear; receipt retention remains identifiers-only; Storage/database failures preserve the documented retry contract and required rows.
- **Migration:** preserve pre-comments academic/notification/email fingerprints; preserve upgrade from the current activity-comment schema when empty; prove a legacy comment or old comment notice blocks cutover without mutation or private-text disclosure. Retain the six prior upgrade proofs with their final-contract verification adapted where necessary; add a current-Slice-6-to-redesign proof. Confirm RLS/grants/indexes, obsolete API/RPC removal, defaults, and generated-type parity.
- **Privacy:** synthetic body sentinels stay out of errors, logs, notification/receipt/outbox rows, gradebook CSV, and research exports. No service key enters browser code; comment reads do not expose unreleased academic values.
- **Portal QA:** teacher and two parents; same-child multiple attempts; exact Return/thread context; unread older attempt with read newer attempt; picker/default behavior; no-upload work; bell and history links; stale/deleted/invalid destinations; single/bulk deletion copy; phone viewport, keyboard/focus, long text, account/child/submission switches, and access revocation while open.

Run backend Ruff, frontend ESLint/TypeScript, production build, generated-contract comparisons, the full backend suite and all upgrade/security/network gates against the disposable Supabase stack as required by AGENTS.md. If local Docker is still absent, record that limitation; use feature-branch CI only when publishing to its exact destination is authorized. Existing 1011-test results belong to the prior implementation and cannot verify this change. Distinguish controlled checks, real portal QA, and user sign-off. Do not mark the redesigned Slice 6 Verified until its own automated and manual gates close; Slice 4's existing gates remain separate.

## 10. Design review and next step

This spec records the chosen separate-submission approach and approved deletion semantics. Inline self-review covered thread identity, exact-attempt navigation, retained history, authorization boundaries, unread/version races, deletion behavior, legacy cutover, and unchanged academic/privacy contracts. It resolved a retained-owner-history ambiguity: a boolean predicate cannot recover metadata hidden by submission RLS, so the design specifies a minimal private caller-authorized context projection instead of widening worksheet access. The next step after written-spec approval is a replacement implementation plan using the writing-plans skill; the old activity-thread plan must not be executed for this redesign.

**Documentation verification (2026-11-10):** Backend Ruff, whole-frontend ESLint, and TypeScript (`--noEmit --incremental false`) passed using the worktree's installed tools. Local Markdown links, ten ordered design sections, explicit review status, placeholder scan, and `git diff --check` passed. These are documentation/baseline checks; no application code, migration, generated contract, database suite, or portal QA changed or ran for this redesign.
