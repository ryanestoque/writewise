# Phase 3 — Classroom-Style Activities (Deadlines, Returns, Notifications, Gradebook)

**As of:** October 20, 2026
**Status:** 📐 Design agreed — **not scheduled before the defense.** Build starts after the October 2026 technical defense.
**Origin:** Design-tree grill session, 2026-10-19 (19 decisions, all accepted).
**Supersedes (when promoted):** PRD §13 "Notifications" deferred item, PRODUCT.md "Push notifications" deferred item.

---

## 1. Why

WriteWise already handles *assessment* well (CV pipeline, rubric scoring, diagnostics, trends). What it doesn't handle is the *coursework loop* teachers and parents expect from Google Classroom:

- **Who** an activity is for (today every take-home activity is visible to every parent of the teacher's roster, across all sections).
- **When** it's due, and who is late or missing.
- **Sending work back** when a photo is wrong, blurry, or incomplete, after the quality gate has already passed it.
- **Telling people** something happened (no notifications exist today).
- **Rolling scores up** into something resembling a class record.

Phase 3 adds that loop without touching the CV/CNN pipeline or the calibration study.

> [!IMPORTANT]
> **Defense framing:** present this document as *Future Work*. Nothing here is built before the defense — calibration data collection (`9-20-2026.md` §1) remains the critical path.

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
| Q9 | Email sender | FastAPI `POST /api/internal/dispatch-emails` (shared-secret header), called by `pg_cron` through `pg_net`, sending via **Resend**. Emails have no scores, images or teacher notes: child's first name + login link only |
| Q10 | Preferences | One global **Email me** toggle (default on) + **Mark all read**. In-app notifications always on |
| Q11 | Activity score | Optional **points** per activity (no points = shows bands only). Score = composite scaled to points. Teacher can override the final points |
| Q12 | Release | **Draft → Released** (`released_at`), enforced in RLS. Release per submission or in bulk per activity. Fires *score released* |
| Q13 | Gradebook | Per-section grid of students × activities with status chips. Overall % = points earned ÷ points possible. CSV export. Parent sees own child's row |
| Q14 | Active attempt | Latest **completed, non-returned** submission counts. Teacher may **pin** a different attempt. Exposed as the `active_submission` view |
| Q15 | Missing / Excused | Missing doesn't affect the % until the teacher clicks **Assign 0** or **Excuse** (per cell or bulk per activity). Excused work is removed from both earned and possible points |
| Q16 | Extra fields | `title` and `instructions` only. **Out:** PDF attachments, scheduled publish, activity drafts, comment threads |
| Q17 | Calibration | Export keeps returned submissions that have a score, flagged with `return_reason` and `is_active_attempt`. Analysis excludes blur/crop/wrong-worksheet returns by default. Gradebook points are **never** exported |
| Q18 | Migration | Backfill: existing activities assigned to **all** of the teacher's sections, no due date, no points; existing submissions marked **Released**. Parents see no change |
| Q19 | Build order | Five slices, §8 |

---

## 3. Core Concepts

### 3.1 Student work (one per student × activity)

Classroom's key idea is a per-student record for each assignment, which exists even before anything is submitted. WriteWise adopts it as `student_work`. It holds everything that belongs to *the student's relationship with the activity* rather than to a single photo:

- per-student due-date override (from a Return, Q5)
- pinned attempt (Q14)
- points override / Assign 0 (Q11, Q15)
- excused flag (Q15)

Rows are created on demand (on the first teacher action or upload), not up front for every assigned student.

### 3.2 Derived status

Status is **computed, never stored**, so it can't drift. Effective due = `coalesce(student_work.due_at_override, activity.due_at)`.

| Status | Condition (first match wins) |
|---|---|
| **Excused** | `student_work.excused` |
| **Returned** | Latest submission is `returned` and no newer upload exists, and effective due not passed |
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
               else latest submission where status = 'completed'
```

`rejected` (quality gate) and `returned` (teacher) never count. All attempts stay visible in submission history.

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
- **Content rules (RA 10173 minimization):** child's **first name only**, activity title, a fixed template sentence, and a login link. No scores, bands, images, measurements or teacher notes.
  - e.g. *"Juan's handwriting activity needs a retake. Open WriteWise to see the teacher's note."*
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
| `PATCH /api/me/settings` | + `email_notifications` | ④ |
| `POST /api/internal/dispatch-emails` | Shared-secret, excluded from public OpenAPI tags | ④ |
| `GET /api/sections/{id}/gradebook.csv` | CSV export | ⑤ |

**New error codes** (add to API_SPEC §2.4 catalog, Rule 2):

| Code | HTTP | When |
|---|---|---|
| `ACTIVITY_NOT_ASSIGNED` | 404 | Upload for a student the activity isn't assigned to (404 per §2.2 ownership rule) |
| `SUBMISSIONS_CLOSED` | 409 | Past effective due and `close_after_due` is on |
| `INVALID_ASSIGNMENT_TARGET` | 422 | Section/student not owned by the teacher, or empty assignment list |
| `SUBMISSION_NOT_RETURNABLE` | 409 | Status is `processing`, `rejected`, or already `returned` |
| `SUBMISSION_NOT_RELEASABLE` | 409 | Not graded, or not the active attempt |
| `INVALID_DISPATCH_SECRET` | 401 | Missing or incorrect `X-Dispatch-Secret` header |

The existing parent-delete rule (`SUBMISSION_ALREADY_GRADED`) is unchanged.

---

## 8. Build Order

Each slice can ship on its own and unblocks the next.

| Slice | Scope | Key risk | Tests |
|---|---|---|---|
| **① Assignment & deadlines** | `activity` columns, `activity_assignment`, `is_assigned`, parent RLS swap, backfill, due/Late/Missing chips, create/edit dialog | Backfill must leave parent visibility exactly as before | Full pytest on ephemeral stack (migration + `app/api/`); RLS tests for cross-section leakage |
| **② Return & release** | `returned` status, return columns, `student_work`, `active_submission`, release gate in RLS, Return dialog | Release RLS hiding existing results if backfill is wrong | Full suite; RLS: parent cannot read unreleased measurement |
| **③ In-app notifications** | `notification` table, FastAPI emitters, `pg_cron` time-based function, header bell | Duplicate notifications | SQL-function tests for idempotency and due-date re-arming |
| **④ Email** | `email_outbox`, dispatcher endpoint, Resend, Vault secret, email toggle | PII in email or in logs | Dispatcher unit tests with stubbed Resend; template snapshot test asserting no score/note fields |
| **⑤ Points & gradebook** | `points_possible`, overrides, excused, gradebook grid, CSV | Composite-to-points scaling (§9 Q-A) | Pure-function tests for overall % edge cases |

---

## 9. Open Details (settle at the start of the relevant slice)

| # | Question | Recommended default |
|---|---|---|
| **Q-A** ⚠️ | Under manual scoring, each band maps to a midpoint (12.5 / 37.5 / 62.5 / **87.5**), so a perfect worksheet only reaches **87.5 %** of the points. Should points scale from the raw composite, or from a normalized band ladder? | Scale from the **band ladder** (Excellent = 100 %, Satisfactory = 75 %, Developing = 50 %, NI = 25 %) while manual; switch to the raw calibrated composite once `SCORING_ENGINE=calibrated`, behind the ScoreProvider |
| Q-B | Student joins a section after an activity was assigned: send `activity_assigned`? | No. It still appears in their list; avoids a burst of notifications when a roster is imported |
| Q-C | Student moves sections: do old assignments follow? | Section-based assignments follow the *current* section; existing submissions are kept regardless |
| Q-D | Should a returned submission's teacher note be visible in the parent's submission history? | Yes, in-app only |
| Q-E | Bell refresh: Realtime vs polling? | TanStack Query polling every 60 s; Realtime only if the bell feels slow |
| Q-F | Who can upload in-class activities after the due date when `close_after_due` is on? | Teachers can always upload; the close only applies to parents |

---

## 10. Hard-Rule Checklist (AGENTS.md §6)

- [ ] **R1:** bell and gradebook read through RLS; the service-role key stays in FastAPI and the dispatcher.
- [ ] **R2:** all six new error codes added to API_SPEC §2.4; frontend branches on `error.code`.
- [ ] **R4:** notifications store IDs only; dispatcher logs `notification_id` only; emails use first name only.
- [ ] **R6:** every table, enum, policy and `pg_cron` job is a versioned migration; types regenerated.
- [ ] **R7:** points derived from ScoreProvider output; no phase branch in the gradebook.
- [ ] **R9:** returned submissions persisted, never deleted.
- [ ] **R11:** `return_reason` / `is_active_attempt` flags added only through `research/export_dataset.py`.
- [ ] **R12:** no rate limiting added to the dispatcher; the shared secret is the only gate.
- [ ] **R14/R15:** no new microservice for notifications; dispatcher stays in the single-worker FastAPI app.

---

## 11. Docs to Update When Promoted

PRD §7 + §13 · PRODUCT.md (deferred list) · DATABASE.md (tables, view, RLS, `pg_cron`) · API_SPEC.md (endpoints + §2.4 codes) · ARCHITECTURE.md (scheduled jobs, outbox, Resend; amends the "synchronous only" stance for *notifications*, not for the CV pipeline) · SECURITY.md (email channel, Vault secret) · DESIGN.md (bell, gradebook, Return dialog, status chips) · DEPLOYMENT.md (`RESEND_API_KEY`, `EMAIL_DISPATCH_SECRET`, Vault setup) · TESTING.md (RLS release tests) · IMPLEMENTATION_STATUS.md (new Phase 3 section). Consider an **ADR 0005** for the scheduler + outbox decision.
