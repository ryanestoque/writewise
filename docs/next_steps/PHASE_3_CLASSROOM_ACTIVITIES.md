# Phase 3 — Classroom-Style Activities (Deadlines, Returns, Notifications, Gradebook)

**As of:** November 9, 2026
**Status:** Slices ①–③ and ⑤ are Verified: Phase 3 is 4/6 verified. Slice ④ email retains its pending signed-in portal QA and operational gates. Slice ⑥'s conversational design is approved and its written spec awaits review before implementation planning; application work is not started. See IMPLEMENTATION_STATUS.md and the slice execution records. Verification, PR integration and hosted activation remain separate; superseded sketches below are historical proposals.
**Origin:** Design-tree grill session, 2026-10-19 (19 decisions, all accepted). **Amended 2026-10-22:** private comments (Q20–Q28, Slice ⑥); Q16 revised.
**Supersedes (when promoted):** PRD §13 "Notifications" deferred item, PRODUCT.md "Push notifications" deferred item.

**Repository audit (2026-11-01):** Implementation progress is tracked in [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md#phase-3--classroom-style-activities). See the [Slice ① implementation plan](../superpowers/plans/2026-11-01-phase3-assignment-deadlines.md) for the proposed assignment/deadline contract and audit findings requiring review. This design document is not evidence that a feature is implemented.

**Slice ④ implementation (2026-11-03):** The approved [email design](../superpowers/specs/2026-11-03-phase3-email-notifications-design.md) is implemented and automated checks pass on the email feature branch; signed-in portal QA remains open. See its [execution record](../superpowers/plans/2026-11-03-phase3-email-notifications.md), API_SPEC §3.7 and DATABASE §17. Those contracts supersede email sketches below. Slice ④ remains unverified; the later Slice ⑤ closeout independently brings Phase 3 to 4/6 verified. Hosted activation additionally requires sender details and Supabase-owner permission provisioning; no hosted change or live delivery is claimed.

---

## 1. Why

WriteWise already handles *assessment* well (CV pipeline, rubric scoring, diagnostics, trends). What it doesn't handle is the *coursework loop* teachers and parents expect from Google Classroom:

- **Who** an activity is for (today every take-home activity is visible to every parent of the teacher's roster, across all sections).
- **When** it's due, and who is late or missing.
- **Sending work back** when a photo is wrong, blurry, or incomplete, after the quality gate has already passed it.
- **Telling people** something happened (Slice ③ implements in-app notifications; email remains Slice ④).
- **Rolling scores up** into something resembling a class record.

Phase 3 adds that loop without touching the CV/CNN pipeline or the calibration study.

> [!IMPORTANT]
> **Defense framing:** present this document as *Future Work*. The original timing decision was to build after the defense — calibration data collection (`9-20-2026.md` §1) remains the critical path.

---

## 2. Decision Record

| # | Topic | Decision |
|---|---|---|
| Q1 | Timing | Plan now, build after the defense |
| Q2 | Assignment | Activities are assigned to **one or more sections**, plus optional **individual students** (e.g. makeup work) |
| Q3 | Deadlines | Optional `due_at` (Asia/Manila). Late uploads accepted with a **Late** badge; **Missing** after due. Per-activity **close submissions after due** toggle. Applies to take-home and in-class |
| Q4 | Resubmission | Teacher **Return** action on a submission: reason picked from a list + optional note. The old row is kept with status `returned`; the next upload becomes the active attempt |
| Q5 | Return edge cases | Graded submissions can be returned. Their `manual_score` is kept (calibration) but excluded from trends and the gradebook. Optional **per-student resubmission due date** overrides the activity's |
| Q6 | Channels | In-app `notification` table + header bell (source of truth). **Email** only for *Returned* and *Due in 24h* |
| Q7 | Events | See §5.1 |
| Q8 | Scheduler | `pg_cron` every 15 min → SQL function inserts *due-soon* / *missing* notifications (idempotent through a dedupe key). Emails queued in an outbox |
| Q9 | Email sender | FastAPI `POST /api/internal/dispatch-emails` (shared-secret header), called by private `pg_cron`/`pg_net`, sending via **Resend**. Fixed generic wording and login/settings links; no child/activity names, scores, images or notes |
| Q10 | Preferences | One global **Email me** toggle (default on) + **Mark all read**. In-app notifications always on |
| Q11 | Activity score | Optional **points** per activity (no points = shows bands only). Score = composite scaled to points. Teacher can override the final points |
| Q12 | Release | **Draft → Released** (`released_at`), enforced in RLS. Release per submission or in bulk per activity. Fires *score released* |
| Q13 | Gradebook | Per-section grid of students × activities with status chips. Overall % = points earned ÷ points possible. CSV export. Parent sees own child's row |
| Q14 | Active attempt | Latest **completed, non-returned** submission counts. Teacher may **pin** a different attempt. Exposed as the `active_submission` view |
| Q15 | Missing / Excused | Missing doesn't affect the % until the teacher clicks **Assign 0** or **Excuse** (per cell or bulk per activity). Excused work is removed from both earned and possible points |
| Q16 | Extra fields | `title` and `instructions` only. **Out:** PDF attachments, scheduled publish, activity drafts, public/class-wide comment streams. *(Amended 2026-10-22: private per-student comments are **in**, see Q20–Q28)* |
| Q17 | Calibration | Export keeps returned submissions that have a score, flagged with `return_reason` and `is_active_attempt`. Analysis excludes blur/crop/wrong-worksheet returns by default. Gradebook points are **never** exported |
| Q18 | Migration | Backfill: existing activities assigned to **all** of the teacher's sections, no due date, no points; existing submissions marked **Released**. Legacy take-home visibility is preserved, including null/foreign-section fallback; assigned in-class metadata is additionally visible. Parent uploads stay take-home only |
| Q19 | Build order | Six slices, §8 *(Slice ⑥ added 2026-10-22)* |
| Q20 | Private comments: scope | Added as **Slice ⑥**, built after Slice ③ (needs the bell). Post-defense like the rest of Phase 3 |
| Q21 | Thread anchor | One thread per **student × activity** (keyed on `student_work`). Exists before any upload; survives returns and resubmissions |
| Q22 | Participants | The activity's owning teacher + **all** parents linked to the student (`student_parent`). One shared thread; everyone sees every message |
| Q23 | Content | Plain text only, 1–1000 chars. No attachments, no markdown, no auto-linking |
| Q24 | Edit / delete | No editing. Author may delete own comment → **body scrubbed to NULL**, `deleted_at` stamped, "Comment deleted" placeholder keeps thread order |
| Q25 | Return note | `submission.return_note` stays as-is. The thread renders return events **inline as read-only entries** derived from submission rows (not stored as comments) so parents can reply in context |
| Q26 | Notifications | New in-app type `comment_posted` → all participants except the author, **coalesced** to one unread notification per thread per recipient. **No email** (Q6 unchanged) |
| Q27 | Write path & gating | Writes via FastAPI (participation check + insert + notifications in one transaction); reads via RLS. Approved clarification 2026-11-09: posting requires current assignment, an active activity and an unlocked thread, including in-class and past due / `close_after_due`. Teacher locking stops posts from everyone. Unassignment/archive retain readable history; authors with access can still delete their own comments. Unarchive/reassignment preserve explicit locks |
| Q28 | Privacy & UI | Bodies never logged, never exported, cascade-deleted with the student. Score-leak-before-release accepted (composer hint only). UI: student-work side panel (teacher) + unread dot on gradebook cell; child's activity details (parent); exact child/activity bell deep-links. Opening a thread acknowledges loaded comment versions without swallowing concurrently newer posts |

---

## 3. Core Concepts

### 3.1 Student work (one per student × activity)

Classroom's key idea is a per-student record for each assignment, which exists even before anything is submitted. WriteWise adopts it as `student_work`. It holds everything that belongs to *the student's relationship with the activity* rather than to a single photo:

- per-student due-date override (from a Return, Q5)
- pinned attempt (Q14)
- points override / Assign 0 (Q11, Q15)
- excused flag (Q15)
- private comment thread + lock flag (Q21, Q27; Slice ⑥)

Rows are created on demand (on the first teacher action or upload), not up front for every assigned student.

### 3.2 Derived status

Status is **computed, never stored**, so it can't drift. Effective due = `coalesce(student_work.due_at_override, activity.due_at)`.

| Status | Condition (first match wins) |
|---|---|
| **Excused** | `student_work.excused` |
| **Returned** | No active attempt after Return and effective due not passed; newer processing/rejected uploads retain separate feedback |
| **Missing** | No active submission, and effective due has passed |
| **Assigned** | No active submission, and not yet due (or no due date) |
| **Draft** | Active submission is graded but `released_at is null` |
| **Released** | Active submission `released_at is not null` |
| **Turned in** | Active submission is completed but ungraded |
| + **Late** badge | Active submission `created_at > effective due` (badge on top of Turned in / Draft / Released) |

The parent's view replaces **Draft** with **Turned in**, since they must not learn a score exists before release.

### 3.3 Active attempt

```
active attempt = pinned submission (if pinned and still completed)
               else latest completed upload newer than the newest returned upload
```

`rejected` (quality gate) and `returned` (teacher) never count. All attempts stay visible in submission history.

**Accepted Slice 2 clarification (2026-11-02):** The user chose to keep work Returned/Missing until a new completed upload; only an explicit valid teacher pin can count an older completed attempt. Upload order is `(created_at, id)`, with deterministic ID tie-breaking. Returning a historical attempt does not displace a newer completed one. Both portals use the shared `active_submission` view; full history remains separate from counted trends. The [approved Slice 2 design](../superpowers/specs/2026-11-02-phase3-return-release-design.md) and promoted API/database docs define the implemented contract.

---

## 4. Data Model (proposed — migrations `0022+`)

> [!NOTE]
> These are design sketches, not final DDL. Each slice's migration must follow `supabase-postgres-best-practices` and ship with regenerated types (AGENTS.md §6 Rule 6).

### 4.1 `activity` — new columns (Slice ①, ⑤)

```sql
alter table public.activity
  add column title text,                         -- backfill: left(target_text, 60)
  add column instructions text,
  add column due_at timestamptz,                 -- null = no deadline
  add column close_after_due boolean not null default false,
  add column points_possible numeric(6,2)        -- null = ungraded (bands only); Slice ⑤
    check (points_possible is null or points_possible > 0);
```

### 4.2 `activity_assignment` (Slice ①)

```sql
create table public.activity_assignment (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activity(id) on delete cascade,
  section_id  uuid references public.section(id) on delete cascade,
  student_id  uuid references public.student(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint assignment_target_xor check ((section_id is null) <> (student_id is null)),
  unique nulls not distinct (activity_id, section_id, student_id)
);
-- helper: public.is_assigned(activity_id, student_id) → true if the student is targeted
-- directly OR the student's current section_id is targeted.
```

Section-based assignment is **live**: a student who joins a section later automatically has the activity assigned (no "new assignment" notification is sent for this; see §9).

### 4.3 `submission` — status + return + release (Slice ②)

```sql
alter type public.submission_status add value 'returned';   -- own migration: enum values
                                                            -- can't be used in the same txn
create type public.return_reason as enum
  ('wrong_worksheet', 'blurry_or_cropped', 'wrong_target_text', 'incomplete', 'other');

alter table public.submission
  add column returned_at   timestamptz,
  add column returned_by   uuid references public.teacher(id) on delete restrict,
  add column return_reason public.return_reason,
  add column return_note   text,            -- in-app only; never emailed (Q9)
  add column released_at   timestamptz;     -- backfill: = updated_at for existing rows (Q18)
```

### 4.4 `student_work` (Slice ②, extended in ⑤)

```sql
create table public.student_work (
  activity_id uuid not null references public.activity(id) on delete cascade,
  student_id  uuid not null references public.student(id) on delete cascade,
  due_at_override        timestamptz,                          -- Slice ②
  pinned_submission_id   uuid references public.submission(id) on delete set null,
  points_override        numeric(6,2) check (points_override >= 0),  -- Slice ⑤; 0 = "Assign 0"
  excused                boolean not null default false,       -- Slice ⑤
  comments_locked        boolean not null default false,       -- Slice ⑥
  updated_at timestamptz not null default now(),
  primary key (activity_id, student_id)
);
```

### 4.5 `active_submission` view (Slice ②)

`create view ... with (security_invoker = true)` so existing submission RLS applies unchanged. One row per `(activity_id, student_id)` per §3.3. The frontend reads from the view and never works out the active attempt on its own.

### 4.6 Notifications (Slice ③, ④)

```sql
create type public.notification_type as enum (
  'activity_assigned', 'due_soon', 'submission_returned', 'submission_rejected',
  'score_released', 'activity_missing', 'resubmitted_after_return');
-- Slice ⑥ (own migration — enum values can't be used in the same txn):
-- alter type public.notification_type add value 'comment_posted';

create table public.notification (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type public.notification_type not null,
  activity_id   uuid references public.activity(id) on delete cascade,
  student_id    uuid references public.student(id) on delete cascade,
  submission_id uuid references public.submission(id) on delete cascade,
  dedupe_key text not null unique,     -- e.g. 'due_soon:{activity}:{student}:{recipient}:{due_epoch}'
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notification (recipient_id, created_at desc);
create index on public.notification (recipient_id) where read_at is null;

create table public.email_outbox (              -- Slice ④; RLS on, no policies (service-only)
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notification(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts int not null default 0,
  last_error text,                              -- provider error code only, no recipient PII
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.teacher add column email_notifications boolean not null default true;
alter table public.parent  add column email_notifications boolean not null default true;
```

Notifications store **IDs only**. The bell UI resolves the child name and activity title through existing RLS-gated reads, so no PII is copied into notification rows.

### 4.7 RLS changes

| Table | Change |
|---|---|
| `activity` | Replace *"parent can view assigned take-home activities"* with: parent can view activities where `is_assigned(activity.id, child)` for one of their children. In-class activities become visible too (needed for the parent gradebook row); the upload button stays take-home only |
| `activity_assignment`, `student_work` | Teacher: own activities. Parent: rows for own children |
| `submission` | Unchanged (parents still see that a submission exists and its status) |
| `measurement`, score-bearing reads, diagnostics | Parent policies gain `and s.released_at is not null` |
| `notification` | Select own (`recipient_id = auth.uid()`). No client writes; marking read goes through FastAPI |
| `email_outbox` | RLS enabled, no policies |
| `private_comment` | Approved 2026-11-09: owning teacher or currently linked parent may read existing thread history after unassignment/archive. Posting has separate current-assignment/archive/lock gates. Preserve current child-link revocation and deny unrelated teachers/parents. **No client writes** (FastAPI only, Q27); see the Slice 6 spec for comment-only historical discovery |

### 4.8 `private_comment` (Slice ⑥)

**Approved conversational design (2026-11-09):** [Private-comments spec](../superpowers/specs/2026-11-09-phase3-private-comments-design.md), awaiting written-spec review before implementation planning. It supersedes the historical sketch below for read-only history after unassignment/archive, author deletion while read-only, Return ordering, dedicated comment-lock writes and version-aware notification acknowledgment. The implementation must add the required thread/comment/notification versions and caller-scoped history discovery; the sketch is not final DDL.

```sql
create table public.private_comment (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  student_id  uuid not null,
  author_id   uuid references auth.users(id) on delete set null,   -- null if account removed
  author_role text not null check (author_role in ('teacher', 'parent')),
  body        text check (char_length(body) between 1 and 1000),   -- NULL once deleted (Q24)
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint comment_body_xor_deleted check ((body is null) = (deleted_at is not null)),
  foreign key (activity_id, student_id)
    references public.student_work(activity_id, student_id) on delete cascade
);
create index on public.private_comment (activity_id, student_id, created_at);

-- Coalescing for comment_posted (Q26): at most one UNREAD comment notification
-- per (recipient, activity, student). FastAPI inserts with
--   on conflict (recipient_id, activity_id, student_id)
--   where type = 'comment_posted' and read_at is null
--   do update set created_at = now()
-- dedupe_key = 'comment:{activity}:{student}:{recipient}:{first_comment_id}' keeps the
-- global unique constraint satisfied once the previous one has been read.
create unique index notification_comment_unread_uniq
  on public.notification (recipient_id, activity_id, student_id)
  where type = 'comment_posted' and read_at is null;
```

- Posting upserts the `student_work` row first (rows are on-demand, §3.1).
- The thread view merges comments with caller-visible **Return events** derived from `submission`. Sort comments by `created_at` and Return events by `returned_at`, with fixed kind/ID tie-breaking. Return events are never copied into comment rows.
- The unread `comment_posted` notification **is** the per-thread unread state and drives the gradebook-cell dot. Opening the thread acknowledges only the loaded comment version; explicit single/all-read operations also preserve concurrently newer versions. No separate read-receipt table.

---

## 5. Notifications

### 5.1 Event catalog

| Type | Recipient | Trigger | Emitted by | Email? |
|---|---|---|---|---|
| `activity_assigned` | Parents of assigned students | Activity created / new assignment target added | FastAPI | No |
| `due_soon` | Parents | ≤ 24 h to effective due, no active submission, not excused | `pg_cron` | **Yes** |
| `submission_returned` | Parents | Teacher Return | FastAPI | **Yes** |
| `submission_rejected` | Parent who uploaded | Quality gate / post-segmentation rejection on a parent upload | FastAPI | No |
| `score_released` | Parents | Release (single or bulk) | FastAPI | No |
| `activity_missing` | Parents | Effective due passed, no active submission, not excused | `pg_cron` | No |
| `resubmitted_after_return` | Activity's teacher | Parent upload where the previous latest submission was `returned` | FastAPI | No |
| `comment_posted` | All thread participants except the author | New private comment (coalesced per thread, §4.8) | FastAPI | No |

Dedupe keys include the effective due epoch, so **moving a due date re-arms** `due_soon`/`activity_missing` instead of silently suppressing them.

### 5.2 Scheduled job

```
pg_cron  */15 * * * *  → select public.enqueue_time_based_notifications();
                        → inserts due_soon / activity_missing rows (on conflict (dedupe_key) do nothing)
                        → inserts email_outbox rows for email-eligible types
pg_cron  */5  * * * *  → pg_net POST {BACKEND_URL}/api/internal/dispatch-emails
                          header X-Dispatch-Secret: <from Supabase Vault>
```

- The dispatch secret and backend URL live in **Supabase Vault**, never in a migration file.
- FastAPI-emitted email types (`submission_returned`) also just insert an outbox row; **only the dispatcher sends**. One code path, retries for free.

### 5.3 Email dispatcher (FastAPI)

- Claims up to *N* pending rows (`for update skip locked`), sends via Resend, marks `sent` / `failed` (max 3 attempts) / `skipped` (recipient has `email_notifications = false`).
- Kept short and bounded: the single Uvicorn worker (Rule 15) also serves CV requests.
- **Content rules (approved Slice 4 refinement):** fixed generic wording and login/settings links only. No child/activity names, scores, bands, images, measurements or teacher notes. Exact templates live in `backend/app/email/templates.py`.
- Logs: `notification_id` + outcome only (Rule 4).

---

## 6. Scores & Gradebook

### 6.1 Activity points

```
derived_points = points_possible × composite / 100        (composite from the active ScoreProvider)
final_points   = coalesce(student_work.points_override, derived_points)
```

- Computed from whatever the active `ScoreProvider` exposes (Rule 7). The gradebook never branches on `SCORING_ENGINE`.
- Points are a **gradebook number only**. Rubric bands stay system-owned; this is *not* the PRD §13 "permanent manual-score override".
- Points/overrides are never written to `manual_score` and never exported (Q17).

### 6.2 Overall %

```
overall % = Σ final_points / Σ points_possible
  over activities with points_possible, where:
    - Excused                         → excluded from both sums
    - Missing / Assigned / Returned   → excluded until the teacher clicks "Assign 0" (points_override = 0)
    - Draft (unreleased)              → included for teacher, excluded from the parent's view
```

### 6.3 Gradebook screen (teacher)

Per-section tab: rows = students, columns = activities (newest first), cells = points or status chip. Cell actions: Release, Return, Assign 0, Excuse, Pin attempt, Extend due date. Column actions: Release all, Assign 0 to all Missing. **CSV export** (teacher's own section only, generated by FastAPI, never written to Storage).

Parent: their own child's row only, released scores only.

---

## 7. API Surface (sketch)

| Method & path | Purpose | Slice |
|---|---|---|
| `POST/PATCH /api/activities` | + `title`, `instructions`, `due_at`, `close_after_due`, `assignments[]`, `points_possible` | ①/⑤ |
| `POST /api/submissions` | Now checks `is_assigned` and `close_after_due` | ① |
| `POST /api/submissions/{id}/return` | `{ reason, note?, resubmit_due_at? }` | ② |
| `POST /api/submissions/{id}/release` · `POST /api/activities/{id}/release` | Single / bulk release | ② |
| `PUT /api/activities/{id}/students/{student_id}/work` | `due_at_override`, `pinned_submission_id`, `points_override`, `excused` | ②/⑤ |
| `POST /api/activities/{id}/assign-zero-missing` | Bulk Assign 0 | ⑤ |
| `POST /api/notifications/{id}/read` · `POST /api/notifications/read-all` | Mark read | ③ |
| Owner-RLS teacher/parent preference PATCH | Exact verified account token; explicit saved value | ④ |
| `POST /api/internal/dispatch-emails` | Shared-secret internal API; typed OpenAPI security contract | ④ |
| `GET /api/sections/{id}/gradebook.csv` | CSV export | ⑤ |
| `POST /api/activities/{id}/students/{student_id}/comments` | `{ body }` — participant check, upsert `student_work`, insert, emit `comment_posted` | ⑥ |
| `DELETE /api/comments/{id}` | Author only; scrubs body. Non-author → `NOT_FOUND`; already deleted → 204 (idempotent) | ⑥ |
| `PUT /api/activities/{id}/students/{student_id}/comments/lock` | Teacher-only comment lock transaction; preserve grade revision/publication (2026-11-09 spec supersedes the mixed-work patch sketch) | ⑥ |

**New error codes** (add to API_SPEC §2.4 catalog, Rule 2):

| Code | HTTP | When |
|---|---|---|
| `ACTIVITY_NOT_ASSIGNED` | 404 | Upload for a student the activity isn't assigned to (404 per §2.2 ownership rule) |
| `SUBMISSIONS_CLOSED` | 409 | Past effective due and `close_after_due` is on |
| `INVALID_ASSIGNMENT_TARGET` | 422 | Section/student not owned by the teacher, or empty assignment list |
| `SUBMISSION_NOT_RETURNABLE` | 409 | Status is `processing`, `rejected`, or already `returned` |
| `SUBMISSION_NOT_RELEASABLE` | 409 | Not graded, or not the active attempt |
| `INVALID_DISPATCH_SECRET` | 401 | Missing or incorrect `X-Dispatch-Secret` header |
| `COMMENTS_LOCKED` | 409 | Posting to a thread whose `student_work.comments_locked` is true |

Comment body length violations reuse `VALIDATION_ERROR`; non-participants get `NOT_FOUND` (§2.2 ownership rule).

The existing parent-delete rule (`SUBMISSION_ALREADY_GRADED`) is unchanged.

---

## 8. Build Order

**Slice ⑤ closeout (2026-11-09):** Points and gradebook is **Verified** following [final implementation-head CI](https://github.com/ryanestoque/writewise/actions/runs/42474197080) on `4044746` and the user's overall manual QA sign-off and explicit closeout request. Phase 3 is **4/6 verified**. Slice ④ email manual/operational gates remain pending; Slice ⑥ private comments is not started. See `IMPLEMENTATION_STATUS.md` and the [Slice 5 execution record](../superpowers/plans/2026-11-07-phase3-points-gradebook.md) for the evidence and distinction from merge/hosted deployment.

Each slice can ship on its own and unblocks the next.

| Slice | Scope | Key risk | Tests |
|---|---|---|---|
| **① Assignment & deadlines** | `activity` columns, `activity_assignment`, `is_assigned`, parent RLS swap, backfill, due/Late/Missing chips, create/edit dialog | Backfill must leave parent visibility exactly as before | Full pytest on ephemeral stack (migration + `app/api/`); RLS tests for cross-section leakage |
| **② Return & release** | `returned` status, return columns, `student_work`, `active_submission`, release gate in RLS, Return dialog | Release RLS hiding existing results if backfill is wrong | Full suite; RLS: parent cannot read unreleased measurement |
| **③ In-app notifications** | `notification` table, FastAPI emitters, `pg_cron` time-based function, header bell | Duplicate notifications | SQL-function tests for idempotency and due-date re-arming |
| **④ Email** | `email_outbox`, dispatcher endpoint, Resend, Vault secret, email toggle | PII in email or in logs | Dispatcher unit tests with stubbed Resend; template snapshot test asserting no score/note fields |
| **⑤ Points & gradebook** | `points_possible`, overrides, excused, gradebook grid, CSV | Composite-to-points scaling (§9 Q-A) | Pure-function tests for overall % edge cases |
| **⑥ Private comments** | `private_comment`, `comment_posted` enum value, coalescing index, `comments_locked`, thread panel (teacher + parent), gradebook unread dot | Cross-family leakage; comment bodies in logs | Full suite; RLS: parent of another child / unassigned student cannot read; coalescing test (N comments → 1 unread); delete scrubs body; log-capture test asserting no body text |

---

## 9. Open Details (settle at the start of the relevant slice)

| # | Question | Recommended default |
|---|---|---|
| **Q-A — resolved 2026-11-07** | Should gradebook points use the existing composite or a normalized manual band ladder? | **User-approved:** existing recorded composites for both sources; no 25/50/75/100 normalization. Preserve shared portal cutoffs and manual midpoint values (all-Excellent manual work earns 87.5% of activity points). See the [approved Slice 5 design](../superpowers/specs/2026-11-07-phase3-points-gradebook-design.md) and [execution plan](../superpowers/plans/2026-11-07-phase3-points-gradebook.md). |
| Q-B | Student joins a section after an activity was assigned: send `activity_assigned`? | No. It still appears in their list; avoids a burst of notifications when a roster is imported |
| Q-C | Student moves sections: do old assignments follow? | Section-based assignments follow the *current* section; existing submissions are kept regardless |
| Q-D | Should a returned submission's teacher note be visible in the parent's submission history? | Yes, in-app only |
| Q-E | Bell refresh: Realtime vs polling? | TanStack Query polling every 60 s; Realtime only if the bell feels slow |
| Q-F | Who can upload in-class activities after the due date when `close_after_due` is on? | Teachers can always upload; the close only applies to parents |

---

## 10. Hard-Rule Checklist (AGENTS.md §6)

- [ ] **R1:** bell and gradebook read through RLS; the service-role key stays in FastAPI and the dispatcher.
- [ ] **R2:** all seven new error codes added to API_SPEC §2.4; frontend branches on `error.code`.
- [ ] **R4:** notifications store IDs only; email messages use fixed generic wording with no names/educational content; dispatcher never logs addresses/bodies; future comment bodies must never be logged.
- [ ] **R1 (⑥):** comments read through RLS; writes only via FastAPI.
- [ ] **R3/R5 (⑥):** N/A by design — comments are text-only, no new image path (Q23).
- [ ] **R11 (⑥):** `private_comment` is never included by `research/export_dataset.py`.
- [ ] **R6:** every table, enum, policy and `pg_cron` job is a versioned migration; types regenerated.
- [ ] **R7:** points derived from ScoreProvider output; no phase branch in the gradebook.
- [ ] **R9:** returned submissions persisted, never deleted.
- [ ] **R11:** `return_reason` / `is_active_attempt` flags added only through `research/export_dataset.py`.
- [ ] **R12:** no rate limiting added to the dispatcher; the shared secret is the only gate.
- [ ] **R14/R15:** no new microservice for notifications; dispatcher stays in the single-worker FastAPI app.

---

## 11. Docs to Update When Promoted

PRD §7 + §13 · PRODUCT.md (deferred list) · DATABASE.md (tables, view, RLS, `pg_cron`) · API_SPEC.md (endpoints + §2.4 codes) · ARCHITECTURE.md (scheduled jobs, outbox, Resend; amends the "synchronous only" stance for *notifications*, not for the CV pipeline) · SECURITY.md (email channel, Vault secret) · DESIGN.md (bell, gradebook, Return dialog, status chips, private-comment panel) · DEPLOYMENT.md (`RESEND_API_KEY`, `EMAIL_DISPATCH_SECRET`, Vault setup) · TESTING.md (RLS release tests) · IMPLEMENTATION_STATUS.md (new Phase 3 section). Consider an **ADR 0005** for the scheduler + outbox decision.
