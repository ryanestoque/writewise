# WriteWise — Database Schema

**A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and Progress Monitoring System**

- **Document type:** Internal engineering build guide (companion to PRD.md, ARCHITECTURE.md, DESIGN.md, CV_PIPELINE.md, ML_PIPELINE.md, API_SPEC.md, TECH_STACK.md, SECURITY.md, TESTING.md, DEPLOYMENT.md)
- **Scope:** the full Postgres schema — tables, enums, constraints, RLS policies, Storage policies, and indexes — that everything else in this system reads from and writes to. Picks up from ARCHITECTURE.md §6's entity summary and goes all the way to literal, runnable DDL.
- **Status:** Draft v1

---

## 1. Conventions

Established once here so individual table sections below don't repeat them.

- **Primary keys:** `uuid`, `default gen_random_uuid()`, on every table — no `bigint`/`identity` PKs anywhere. Chosen for consistency with `auth.users.id` (also `uuid`), avoiding any FK type mismatch across the schema.
- **Identity tables:** `teacher.id` and `parent.id` **are** `auth.users.id` directly (`primary key references auth.users(id)`) — not a separately generated PK plus a link column. One identity, one ID, everywhere it's referenced.
- **Naming:** `snake_case`, singular table names (`teacher`, not `teachers`), matching ARCHITECTURE.md §6's entity table.
- **Timestamps:** `timestamptz`, never bare `timestamp`. `created_at default now()` on every table. `updated_at` **only** on tables with an actual described mutation path post-creation — that's `student` (roster edits, PRD §7.1) and `submission` (status transitions) — via one shared trigger function, not bespoke triggers per table.
- **Enums:** native Postgres `enum` types for every genuinely fixed, closed set (`submission_status`, `user_role`, `score_band`). This isn't just style — `supabase gen types typescript` (ARCHITECTURE §6) maps Postgres enums straight to TypeScript string-literal unions, which is exactly the "frontend and backend never drift on shape" guarantee that tool exists for. A `text` + `check` column would just generate as `string`, losing that.
- **`ON DELETE` behavior:**
  - **Identity/roster cleanup** (`auth.users` → `teacher`/`parent`; `teacher`/`student`/`parent` → their join-table rows): `CASCADE`. If the identity or roster entry is gone, its own link rows should disappear with it — no orphans.
  - **Account deletion vs. research data** (`teacher`/`student` → `activity`/`submission`): `RESTRICT`. Deleting a teacher or student account must be *blocked* while calibration data still references them — this is a thesis's actual dataset, and an account cleanup action should never be able to silently take part of it out.
  - **Submission attempt deletion** (`submission` → `measurement`/`manual_score`): `CASCADE` (updated via migration `0019_submission_cascade_delete.sql`). When an authorized user (teacher, or parent on an un-graded take-home attempt) deletes a submission attempt, its dependent `measurement` and `manual_score` records cascade delete cleanly, in lockstep with Storage object cleanup in FastAPI.
- **Indexing philosophy:** minimal. Primary key and `unique` constraints (which Postgres indexes automatically) are all this schema gets up front — no proactive indexes for dashboard/trend query patterns. At pilot scale (small cohort, size TBD), a full scan of any table here is scanning a few hundred rows at absolute worst. Add indexes reactively if Railway's structured logs (ARCHITECTURE §15) ever show a real slowdown — see §11.
- **Access pattern reminder (from ARCHITECTURE §4):** RLS policies below are effectively **read policies**. Writes (roster changes, activity creation, submission upload) go through FastAPI using the service-role key, which bypasses RLS by design — FastAPI does its own authorization in Python. Don't go looking for `insert`/`update`/`delete` policies on most tables; they're intentionally not here.
- **Migrations:** SQL-first via Supabase CLI (`supabase/migrations/*.sql`, timestamp-prefixed), per ARCHITECTURE §2/§6 — this document's SQL is written in the grouping it would actually ship as migration files (see §12), not as one monolithic script.

---

## 2. Entity Overview

```
auth.users ──1:1──► teacher ──┐
                                ├──M:N──► teacher_student ◄──M:N──┐
auth.users ──1:1──► parent ────┼──M:N──► student_parent ◄────────┤
                                │                                 │
                                │                              student
                                │                                 │
                          activity (created_by: teacher)          │
                                │                                 │
                                └───────────► submission ◄────────┘
                                              (activity_id, student_id, uploader)
                                                    │
                                        ┌───────────┴───────────┐
                                        ▼                       ▼
                                  measurement            manual_score
                              (always, once           (Phase 1 only —
                               processing completes)    renamed away post-calibration)
```

The original core has nine tables: `teacher`, `parent`, `student`, `teacher_student`, `student_parent`, `activity`, `submission`, `measurement`, `manual_score`. Current migrations also add `section`, `activity_assignment`, and `student_work` (Slice 2, §15).

---

## 3. Enum Types

```sql
-- migration: 0001_enums.sql

create type public.user_role as enum ('teacher', 'parent');

create type public.submission_status as enum ('processing', 'completed', 'rejected');

create type public.score_band as enum ('needs_improvement', 'developing', 'satisfactory', 'excellent');
```

Migration `20261102112153_phase3_returned_status.sql` subsequently adds `returned`; its separate transaction allows the following migration to use the enum value.

`score_band` encodes exactly the four qualitative bands ML_PIPELINE.md §6.4 defines for both the Phase 1 manual rubric entry and Phase 2's diagnostic feedback — one enum, reused for both purposes rather than inventing two.

---

## 4. Identity — `teacher`, `parent`

```sql
-- migration: 0002_identity.sql

create table public.teacher (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.parent (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);
```

`full_name` and `email` are denormalized off `auth.users` (which isn't safely queryable from `supabase-js` direct reads — it's a protected schema, not meant for client-side joins). Any screen that needs to show "uploaded by Ms. Santos" reads it straight off these rows instead.

### 4.1 Auto-provisioning trigger

Resolves ARCHITECTURE §17's open item ("Teacher account creation: not yet fully specified") with a single mechanism that covers *both* provisioning flows — a teacher provisioned via Supabase CLI/dashboard with `role: teacher` set in `raw_user_meta_data`, and a parent who completes ARCHITECTURE §5's invite-email flow with `role: parent` set at invite time.

**Also resolves API_SPEC.md §3.1's dependency:** the parent branch below inserts into `student_parent` too, atomically in the same trigger, whenever the invite's `raw_user_meta_data` includes a `student_id` — which API_SPEC.md's `POST /students` / `PATCH /students/{id}` invite mechanism already passes at invite time. Previously this trigger only created the `parent` row and never linked it to a child; a parent who accepted an invite got a working account that was never actually connected to their student's records.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ->> 'role' = 'teacher' then
    insert into public.teacher (id, full_name, email)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  elsif new.raw_user_meta_data ->> 'role' = 'parent' then
    insert into public.parent (id, full_name, email)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
    if new.raw_user_meta_data ->> 'student_id' is not null then
      insert into public.student_parent (student_id, parent_id)
      values ((new.raw_user_meta_data ->> 'student_id')::uuid, new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Whoever sets up the pilot's first teacher accounts just needs to set `role: teacher` in metadata at creation time (Supabase dashboard supports this directly) — no separate manual `insert` step to remember or get wrong. Same for parents: the invite call (API_SPEC §3.1) sets `role: parent` plus `student_id`, and this trigger handles both the account creation and the roster link in one atomic step — no window where a parent account exists but isn't linked yet.

---

## 5. Roster — `section`, `student`, `teacher_student`, `student_parent`

```sql
-- migration: 0020_class_sections.sql (ADR 0004)
create table public.section (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_teacher_section_name unique (teacher_id, name)
);

create trigger set_section_updated_at
  before update on public.section
  for each row execute function public.set_updated_at();

-- migrations: 0003_roster.sql, 0011_add_parent_email_to_student.sql, 0020_class_sections.sql
create table public.student (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  section text not null, -- denormalized string kept in sync with section.name (ADR 0004)
  section_id uuid references public.section(id) on delete restrict, -- relational FK
  parent_email text, -- optional parent contact/invite email
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_student_updated_at
  before update on public.student
  for each row execute function public.set_updated_at();
```

Stores the core roster entity (`full_name` + `section` / `section_id`, plus optional `parent_email` for immediate contact tracking and portal invitations). Per ADR 0004, `section_id` establishes referential integrity to `public.section`, while `student.section` is preserved as a synchronized denormalized string to prevent breaking client queries and exports. No LRN/external ID: the PRD never scopes one, the paper consent forms don't collect one, and disambiguating duplicate names within a class is a roster-UI concern the teacher already handles by construction (they added the student), not a schema one.

```sql
create table public.teacher_student (
  teacher_id uuid not null references public.teacher(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, student_id)
);

create table public.student_parent (
  student_id uuid not null references public.student(id) on delete cascade,
  parent_id uuid not null references public.parent(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, parent_id)
);
```

Plain many-to-many join tables, no `active`/`removed_at` soft-delete columns. A mid-year roster change (ARCHITECTURE §6's "supports co-taught sections, mid-year class changes") is just a row delete + insert — this is a single 9-week pilot, not a system that needs "who taught whom, when" history, and `submission` rows keep their own `student_id` independently of current roster state either way, so Phase 1 data integrity was never at risk from keeping this simple.

---

## 6. `activity`

```sql
-- migration: 0004_activity.sql

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  target_text text not null,
  is_take_home boolean not null default false,
  created_by uuid not null references public.teacher(id) on delete restrict,
  created_at timestamptz not null default now()
);
```

**Slice 1 schema (migration `20261101132822_phase3_assignments.sql`):** adds nonblank required `title`, nullable `instructions`/`due_at timestamptz`, and `close_after_due boolean default false`. Closure requires a due date. Existing titles use the first 60 trimmed target-text characters (blank legacy text falls back to Handwriting practice). Browser displays use Asia/Manila; storage uses timestamptz.

`activity_assignment` has UUID primary key, cascading activity/section/student foreign keys, a timestamp, and exactly one section/student target per row. Partial unique indexes prevent repeated targets, and target-first indexes support child lookups. Section membership remains live: a student must still belong to the activity owner's roster, and a section target applies to that child's current owned section. A direct target does not survive roster removal as upload authorization.

Backfill targets all of the owning teacher's sections and adds direct targets for legacy roster students not covered by those sections (null/foreign section included). Empty-roster teachers keep zero targets. No submission history is rewritten. New creation/replacement requires nonempty targets; unrelated legacy edits may omit them.

`is_assigned(activity_id, student_id)` is a scoped SECURITY DEFINER lookup with an empty search path, fully qualified references, and no PUBLIC/anon execution. It checks caller ownership/parent link/service-role claims and current roster membership before returning a result, avoiding recursive activity/assignment RLS. Authenticated callers receive SELECT-only target access under RLS: teachers see their activity targets; parents see only target rows matching their own children. Parent activity metadata now includes assigned in-class work; uploads remain take-home only. UI queries must additionally filter for the selected child because parent RLS covers all linked siblings.

Service-only SECURITY INVOKER `create_assigned_activity` and `update_assigned_activity` RPCs accept the authenticated teacher ID supplied by FastAPI, independently validate ownership, lock updates, and persist fields/target replacement in one transaction. SQLSTATE `22023` maps to INVALID_ASSIGNMENT_TARGET; `P0002` maps to NOT_FOUND. All other database failures remain INTERNAL_ERROR without exposing provider details.

---

## 7. `submission`

```sql
-- migration: 0005_submission.sql

create table public.submission (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activity(id) on delete restrict,
  student_id uuid not null references public.student(id) on delete restrict,
  image_path text not null,
  status public.submission_status not null default 'processing',
  uploader_id uuid not null references auth.users(id) on delete restrict,
  uploader_role public.user_role not null,
  rejection_code text,
  rejection_details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_submission_updated_at
  before update on public.submission
  for each row execute function public.set_updated_at();
```

**`uploader_id` + `uploader_role`, not two nullable FKs.** A teacher or a parent can both upload (PRD §6's take-home flow). `uploader_id` FKs to `auth.users` directly — since §4.1's identity convention means `teacher.id`/`parent.id` *are* `auth.users.id`, this one column correctly points at "whichever profile row has this ID" without needing a polymorphic-FK workaround. This does mean the DB alone doesn't guarantee `uploader_role` matches a real row in that role's table (app/RLS write-checks cover that gap) — an acceptable trade given every other RLS policy in this schema is already doing exactly this kind of role-aware access-control work, per ARCHITECTURE §4's whole hybrid-access rationale.

**`rejection_code` + `rejection_details`, mirroring ARCHITECTURE §12's API error envelope** (`{ error: { code, message, details } }`) rather than inventing a separate shape — `rejection_code` holds the same string as `error.code` (e.g. `QUALITY_GATE_BLUR`, `SEGMENTATION_COUNT_MISMATCH` from CV_PIPELINE §5.3), `rejection_details` the same structured data (e.g. measured blur variance vs. threshold). This is deliberately `text`, not an enum — CV_PIPELINE §12 flags the quality-gate checks themselves as still-tunable, so new codes can appear on the Python side without a schema migration. It's also exactly the data ARCHITECTURE §6 wants for the citable usability stat ("X% of Phase 1 uploads rejected for blur").

**`image_path`** follows the convention `{student_id}/{submission_id}.jpg` — see §9 for why.

No `unique` constraint on `(activity_id, student_id)` — nothing in the PRD rules out a re-upload/retry against the same activity, and multiple submissions per activity per student is a reasonable thing to allow rather than block.

---

## 8. `measurement`

```sql
-- migration: 0006_measurement.sql

create table public.measurement (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submission(id) on delete cascade,

  -- Raw CV/CNN aggregates — 6 pairs, matching CV_PIPELINE.md §8 / ML_PIPELINE.md §11's
  -- `aggregate` block shape exactly (not collapsed to the PRD's 5 criteria — see note below).
  slant_mean numeric,
  slant_std numeric,
  word_spacing_mean numeric,
  word_spacing_std numeric,
  letter_spacing_mean numeric,
  letter_spacing_std numeric,
  baseline_deviation_mean numeric,
  baseline_deviation_std numeric,
  size_consistency_mean numeric,
  size_consistency_std numeric,
  letter_formation_mean numeric,
  letter_formation_std numeric,

  -- Computed scores — 5 columns, matching the PRD's 5 scored criteria exactly.
  -- Nullable: NULL for every Phase 1 submission (see note below), populated
  -- by CalibratedScoreProvider once Phase 2 is the active scoring engine.
  letter_formation_score numeric(5,2) check (letter_formation_score between 0 and 100),
  size_consistency_score numeric(5,2) check (size_consistency_score between 0 and 100),
  spacing_score numeric(5,2) check (spacing_score between 0 and 100),
  slant_score numeric(5,2) check (slant_score between 0 and 100),
  baseline_alignment_score numeric(5,2) check (baseline_alignment_score between 0 and 100),

  composite_score numeric(5,2) generated always as (
    (letter_formation_score + size_consistency_score + spacing_score
     + slant_score + baseline_alignment_score) / 5
  ) stored,

  -- Full CV_PIPELINE.md §8 output verbatim (guide_lines, per-line/per-word arrays,
  -- aggregate block) — needed for anything that doesn't reduce to a single number,
  -- e.g. the diagnostic overlay renderer's per-word bbox data.
  raw_output jsonb not null,

  -- Diagnostic Engine output (PRD §7.4): baseline drift line, spacing/size highlight
  -- box coordinates. NULL until Phase 2's Diagnostic Engine runs — a different
  -- producer, on a different (later) timeline, than raw_output.
  overlay jsonb,

  created_at timestamptz not null default now()
);
```

**Why 6 raw column pairs but only 5 score columns:** the CV pipeline's own output isn't a clean 1:1 with the PRD's criteria — `spacing` is one PRD criterion but two raw aggregates (`word_spacing`, `letter_spacing`). Keeping the raw columns in the CV pipeline's actual 6-group shape, and the score columns in the PRD's actual 5-criterion shape, is more honest than forcing a lossy merge at the raw-data layer — `spacing_score` is simply whatever the `ScoreProvider` derives from *both* raw aggregates together.

**Why score columns are nullable and stay `NULL` for Phase 1 forever:** ARCHITECTURE §10 describes `compute_score()` running synchronously as step 7 of the upload pipeline. But PRD §6's Phase 1 flow is two separate steps — upload (raw measurements computed), then *later*, the teacher manually types in a rubric score. That score doesn't exist yet at pipeline-processing time in Phase 1, so it can't be written then. It turns out this doesn't matter: Phase 1 has no dashboard, no parent portal, no diagnostic feedback UI (PRD §5) — nothing reads `measurement`'s score columns during Phase 1. The offline calibration script (PRD's "Between Phases" step) reads raw values here joined against `manual_score` directly instead. Once `CalibratedScoreProvider` becomes the active provider, scores start getting written at processing time exactly as ARCHITECTURE §10 describes — this is a Phase 2 behavior in practice, not a Phase 1 one, even though the columns exist from day one.

**Why `composite_score` is a generated column:** no weighting scheme exists anywhere in the docs — it's a plain average — so a stored generated column keeps it always in sync with the 5 scores it's built from, with zero drift risk and zero app-code duplication. It's naturally `NULL` during Phase 1, exactly like the columns it depends on.

**Lifecycle note:** a `measurement` row only ever gets created once the CV/CNN pipeline actually completes (submission processing step 8, alongside setting `submission.status = 'completed'`) — a rejected submission never reaches feature extraction (the quality gate is step 2, well before it), so rejected submissions have no `measurement` row at all. This invariant is enforced by application logic within the same request/transaction, not a DB constraint — adding one would mean cross-table trigger machinery for a guarantee the single synchronous write path already provides by construction.

---

## 9. `manual_score` (Phase 1 only)

```sql
-- migration: 0007_manual_score.sql

create table public.manual_score (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submission(id) on delete cascade,

  letter_formation_band public.score_band not null,
  letter_formation_score numeric(5,2) generated always as (
    case letter_formation_band
      when 'needs_improvement' then 12.5
      when 'developing' then 37.5
      when 'satisfactory' then 62.5
      when 'excellent' then 87.5
    end
  ) stored,

  size_consistency_band public.score_band not null,
  size_consistency_score numeric(5,2) generated always as (
    case size_consistency_band
      when 'needs_improvement' then 12.5
      when 'developing' then 37.5
      when 'satisfactory' then 62.5
      when 'excellent' then 87.5
    end
  ) stored,

  spacing_band public.score_band not null,
  spacing_score numeric(5,2) generated always as (
    case spacing_band
      when 'needs_improvement' then 12.5
      when 'developing' then 37.5
      when 'satisfactory' then 62.5
      when 'excellent' then 87.5
    end
  ) stored,

  slant_band public.score_band not null,
  slant_score numeric(5,2) generated always as (
    case slant_band
      when 'needs_improvement' then 12.5
      when 'developing' then 37.5
      when 'satisfactory' then 62.5
      when 'excellent' then 87.5
    end
  ) stored,

  baseline_alignment_band public.score_band not null,
  baseline_alignment_score numeric(5,2) generated always as (
    case baseline_alignment_band
      when 'needs_improvement' then 12.5
      when 'developing' then 37.5
      when 'satisfactory' then 62.5
      when 'excellent' then 87.5
    end
  ) stored,

  graded_by uuid not null references public.teacher(id) on delete restrict,
  created_at timestamptz not null default now()
);
```

Wide, mirroring `measurement`'s shape exactly (band-enum + generated-numeric column pair per criterion) — deliberate, since the whole point of this table is to sit side-by-side with `measurement` for the calibration join, and structural symmetry makes that join trivial to write and reason about.

The band, not a raw number, is the thing of record — ML_PIPELINE.md §6.4 confirms the Phase 1 UI is a segmented-button-group over 4 qualitative bands, not a free numeric input. The generated numeric column (12.5 / 37.5 / 62.5 / 87.5, same anchors ML_PIPELINE.md §6.4 defines) is what the Spearman's Rho calibration script and Stage 2's regression-head training actually consume — same "generated column, single source of truth" pattern as `composite_score` above, so the mapping can never drift between what's stored and what's computed from it.

### 9.1 Retained rubric history

Independent rubric rows remain in `manual_score` across scoring-engine changes. The approved Slice 2 contract supersedes the earlier illustrative archive/rename proposal: historical rubric evidence supports calibration export and returned-attempt history. Calibrated mode disables manual rubric writes through the existing backend configuration gate; it does not rename or discard old scores.

Return preserves the rubric. Completed-only manual scoring prevents editing returned evidence, and changing a released completed rubric resets its release timestamp in the same transaction. Parents may read it only after release. Offline dataset export remains exclusively through `research/export_dataset.py`; gradebook values and return notes are excluded.

---

## 10. Row-Level Security

### 10.1 Helper functions

The same "is this user a teacher/parent linked to this student" check is needed across `student`, `activity`, `submission`, `measurement`, `manual_score`, and the Storage policy in §11 — five-plus places. Shared `stable` SQL functions instead of repeating the same `exists (...)` subquery in every policy, so the roster-check logic has exactly one place to update if it's ever revisited:

```sql
-- migration: 0008_rls_helpers.sql

create or replace function public.is_teacher_of_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_student
    where teacher_id = auth.uid() and student_id = target_student_id
  );
$$;

create or replace function public.is_parent_of_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.student_parent
    where parent_id = auth.uid() and student_id = target_student_id
  );
$$;
```

### 10.2 Policies

```sql
-- migration: 0009_rls_policies.sql

-- teacher / parent: each role can read their own profile row.
alter table public.teacher enable row level security;
create policy "teacher can view own profile"
  on public.teacher for select
  using (id = auth.uid());

alter table public.parent enable row level security;
create policy "parent can view own profile"
  on public.parent for select
  using (id = auth.uid());

-- student: visible to a linked teacher or a linked parent.
alter table public.student enable row level security;
create policy "teacher can view own roster students"
  on public.student for select
  using (public.is_teacher_of_student(id));
create policy "parent can view own child"
  on public.student for select
  using (public.is_parent_of_student(id));

-- teacher_student / student_parent: each role sees its own links.
alter table public.teacher_student enable row level security;
create policy "teacher can view own roster links"
  on public.teacher_student for select
  using (teacher_id = auth.uid());

alter table public.student_parent enable row level security;
create policy "parent can view own links"
  on public.student_parent for select
  using (parent_id = auth.uid());

-- section: teacher can view own created sections (migration 0020_class_sections.sql).
alter table public.section enable row level security;
create policy "teacher can view own sections"
  on public.section for select
  using (teacher_id = auth.uid());

-- activity (Slice 1): teacher ownership policy is retained.
-- The previous teacher-wide parent policy is replaced by assigned-child access:
create policy "parent can view assigned child activities"
  on public.activity for select to authenticated using (
    exists (select 1 from public.student_parent sp
            where sp.parent_id = (select auth.uid())
              and public.is_assigned(activity.id, sp.student_id))
  );

-- submission: visible to the student's teacher or parent.
alter table public.submission enable row level security;
create policy "teacher can view submissions for own roster"
  on public.submission for select
  using (public.is_teacher_of_student(student_id));
create policy "parent can view own child's submissions"
  on public.submission for select
  using (public.is_parent_of_student(student_id));

-- measurement: same visibility as its parent submission.
alter table public.measurement enable row level security;
create policy "teacher can view measurements for own roster"
  on public.measurement for select
  using (
    exists (
      select 1 from public.submission s
      where s.id = measurement.submission_id
        and public.is_teacher_of_student(s.student_id)
    )
  );
create policy "parent can view own child's measurements"
  on public.measurement for select
  using (
    exists (
      select 1 from public.submission s
      where s.id = measurement.submission_id
        and public.is_parent_of_student(s.student_id)
    )
  );

-- manual_score: Phase 1 only has a teacher portal, so only the grading
-- teacher can see what they entered — no parent policy exists for this table.
alter table public.manual_score enable row level security;
create policy "teacher can view own submitted manual scores"
  on public.manual_score for select
  using (graded_by = auth.uid());
```

---

## 11. File Storage

Two private buckets, per ARCHITECTURE §7/§9: `submission-images` and a separate one for the CNN model artifact. Only `submission-images` needs user-facing RLS — the model artifact is only ever touched by FastAPI's service-role key at container startup.

**Path convention:** `{student_id}/{submission_id}.jpg`. This is what makes the RLS policy below self-contained — `storage.foldername(name)` parses the first path segment straight into the same `student_id` the §10.1 helper functions already key off, with no extra join back through `submission` needed inside a security-critical policy. (A flat `{submission_id}.jpg` path was the alternative; it would need `storage.objects` → `submission` → roster as an extra join per check. Since a submission's `student_id` never changes after creation, there's no real "two sources of truth" risk to the path-based approach either.)

```sql
-- migration: 0010_storage.sql

insert into storage.buckets (id, name, public)
values ('submission-images', 'submission-images', false);

insert into storage.buckets (id, name, public)
values ('model-artifacts', 'model-artifacts', false);

create policy "teacher can read submission images for own roster"
  on storage.objects for select
  using (
    bucket_id = 'submission-images'
    and public.is_teacher_of_student((storage.foldername(name))[1]::uuid)
  );

create policy "parent can read own child's submission images"
  on storage.objects for select
  using (
    bucket_id = 'submission-images'
    and public.is_parent_of_student((storage.foldername(name))[1]::uuid)
  );

-- No insert/update/delete policies: FastAPI writes the original photo to
-- Storage using the service-role key as part of the synchronous upload
-- request (ARCHITECTURE §8 step 1), bypassing RLS entirely — same hybrid
-- access pattern as every write path in this schema.
```

No signed URLs, no public bucket — ARCHITECTURE §7's explicit RA 10173 call: these are real children's names and handwriting, and an unguessable URL is not access control.

---

## 12. Indexing

Per §1's stated philosophy: nothing beyond what `primary key` and `unique` constraints already provide automatically. That covers every join this schema actually needs today —

- `measurement.submission_id` and `manual_score.submission_id` are both `unique`, so the 1:1 join back to `submission` is already indexed.
- `teacher_student` and `student_parent`'s composite primary keys cover roster lookups in their leading-column direction (`teacher_id` / `student_id` first).

**Reactive candidates, if the pilot's Railway logs ever show a real slowdown** (none of these are added now):
- `submission(student_id)`, `submission(activity_id)` — for the class-wide roster and per-student drill-down dashboard queries (§7.5 of the PRD).
- A reverse-direction index on `teacher_student(student_id)` / `student_parent(student_id)` if "who teaches/parents this student" lookups (rather than "this teacher/parent's roster") turn out to be common.

At pilot scale (small cohort), none of this is expected to matter during the pilot.

---

## 13. Local Development — Seed Data

PRD §5 explicitly calls for Phase 2 UI (dashboard, diagnostic feedback panel) to be built *now*, in parallel with Phase 1, "against placeholder/manual scores as stand-in data so the UI doesn't block on calibration finishing." `supabase/seed.sql` (Supabase's standard convention — runs automatically on `supabase db reset`) is what supplies that data locally.

It should include a handful of fake teachers, students, activities, and `submission`/`measurement` rows — with `measurement` scores spread across the full 0–100 range per criterion (some weak, some strong, not uniform placeholder numbers), specifically so dashboard trend charts and the class-wide "sortable by weakest criterion" roster view have visually meaningful variation to build against from day one.

```sql
-- supabase/seed.sql (illustrative excerpt — full version has a few teachers,
-- ~10-15 students, several activities, and a spread of submissions/measurements)

insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'teacher.santos@example.com',
        '{"role": "teacher", "full_name": "Ms. Santos"}');
-- handle_new_user() trigger fires automatically, creating the matching
-- public.teacher row.

insert into public.student (id, full_name, section)
values ('22222222-2222-2222-2222-222222222222', 'Juan Dela Cruz', 'Sampaguita');

insert into public.teacher_student (teacher_id, student_id)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- ...activities, submissions, and measurement rows with varied scores follow.
```

---

## 14. Known Risks & Open Items

- **`uploader_role` isn't DB-enforced against the matching profile table** (§7) — a deliberate trade for RLS simplicity. If this ever proves too loose in practice (e.g. a bug lets a teacher-flagged upload actually come from a parent), the fallback is the two-nullable-FK-with-`check` pattern considered and set aside during design.
- **Reactive indexing (§12) is unvalidated** — the "small cohort, don't bother" call is based on the pilot's stated scale, not a benchmark. If Phase 2's dashboard queries come in slow once real data is flowing, `submission(student_id)`/`submission(activity_id)` are the first candidates, not a deeper redesign.
- **Retained `manual_score` evidence (§9.1) has no defined long-term retirement date** — the live table supports calibration export and returned-attempt history; any later retention change needs an explicit project decision.
- **This document assumes CV_PIPELINE.md §8's output schema is stable enough to hardcode into `measurement`'s raw columns.** CV_PIPELINE §12 flags several of its own constants (word-gap multiplier, quality-gate thresholds) as unvalidated starting defaults — if the *shape* of the aggregate output changes (not just its threshold values), `measurement`'s 6 raw column pairs would need a migration to match. The values, not the shape, are what's expected to move during calibration.

## 15. Phase 3 Slice 2 — Return, active work, and release

Migrations `20261102112153_phase3_returned_status.sql` and `20261102112156_phase3_return_release.sql` introduce the returned enum value separately, followed by return/release columns, `student_work`, views, policies, and service-only transactions. Migrations remain the executable source of truth.

`submission` gains `returned_at`, `returned_by` (teacher FK), `return_reason`, `return_note` (at most 2,000 characters), and `released_at`. Returned rows require complete return metadata; other states cannot carry return metadata. Existing submissions receive their old `updated_at` as release time. New uploads default to unreleased; a Return preserves old release timestamps and independent rubric/measurement history.

`student_work` has primary key `(activity_id, student_id)`, nullable `due_at_override`, nullable `pinned_submission_id`, and `updated_at`. Activity/student deletion cascades; deleting the pinned submission clears the pin. A trigger rejects pins outside the exact pair or to non-completed attempts. Rows are created on demand. Effective due is the override or activity deadline. Student and pin lookup indexes complement the primary key; submissions are indexed by activity/student/upload order.

`active_submission` is a security-invoker view: a valid completed pin wins; otherwise select the newest completed upload after the newest returned upload, ordered by `(created_at, id)`. No older attempt automatically returns to the totals after Return. Rejected/processing attempts remain history/feedback. `activity_work_state` computes effective due, active/latest IDs, return metadata, role-appropriate status, and Late. Parents see Turned in for drafts because score rows remain hidden. Historical work and activity metadata survive section/target changes for the child's linked parents.

Parent SELECT on both `measurement` and `manual_score` requires the child's submission to have `released_at`. Submission metadata and Storage image access retain their existing family boundaries. Teacher rubric reads also allow the owning roster teacher to inspect retained rubric evidence. `student_work` is readable by the owning roster teacher or linked parent; browser mutations are denied.

FastAPI invokes only service-granted RPCs: `mutate_student_work`, `release_activity_results`, `record_student_submission`, `complete_student_submission`, and `save_manual_submission_score`. Private security-invoker helpers use an empty search path and are not exposed through PostgREST. All operations lock activity before work and recheck actor/eligibility. Bulk release skips ineligible work. A changed rubric atomically clears release; identical band saves preserve it. No points, excused flags, notifications, email, or comment columns are introduced in this slice.

The backend captures `accepted_at` before image processing and passes it only through the service-only upload record payload. The record transaction compares that time with effective due and persists it as `created_at`; accepted uploads, including quality rejections, survive processing past the deadline and retain their correct lateness. Existing internal callers without this payload field default to transaction time. Current authorization and assignment are rechecked inside the transaction.

## 16. Phase 3 Slice 3 — Notification records and scheduling

Migrations `20261103010000`–`20261103010004` add the seven-value `notification_type` enum, public notification table, private delivery receipts, transactional emitters, deadline sweep, and service-only read RPCs. This migration creates no historical notifications and does not rewrite submissions, scores, visibility, assignments, or active-attempt selection.

`notification` has UUID `id`, required `recipient_id`/`activity_id`/`student_id`, event `type`, nullable `submission_id`, unique `dedupe_key`, nullable `read_at`, and database `created_at`. Submission events require the submission reference; assignment/deadline events require it to be absent. The helper validates that a supplied submission belongs to the same activity/student. Foreign keys cascade with referenced rows. Feed, unread, and FK lookup paths are indexed.

Authenticated clients receive SELECT only, with `recipient_id = (SELECT auth.uid())`. Browser INSERT/UPDATE/DELETE and emitter/read-RPC EXECUTE are revoked. Labels are fetched separately under current child/activity RLS. Historical notification ownership does not transfer when a parent is unlinked; related content can become unavailable.

`writewise_internal.notification_delivery` contains the unique key, recipient/activity/student IDs, and creation time. Its private-schema grants and RLS allow service-only use. It survives submission deletion, preventing another resubmission alert for the same Return cycle; deleting its recipient/activity/student cascades the receipt. Claim and public notice insert share one transaction.

Assignment RPCs compare explicit target changes against one frozen roster ID/section snapshot; metadata/roster/link edits emit no assignment alert. Return/rejection/release/completion emit within their existing transactions. Repeated release is silent; redraft/re-release uses a new exact release timestamp. Successful parent completion must become active and resolve an outstanding Return before notifying the owning teacher. Rejected and teacher-uploaded retries do not emit that teacher alert.

Private `assigned_activity_students(uuid, jsonb DEFAULT NULL)` supports the frozen assignment snapshot and live JWT-free cron lookup. Private deadline functions capture one sweep time, lock activities in ascending ID order, and use current assignments, effective due overrides, and `active_submission`. Archived/null-deadline/unassigned work and any active attempt are excluded; processing/rejected work remains eligible. Due-soon includes the exact due instant through 24 hours ahead; missing is strictly past due. Keys use epoch microseconds. A distinct deadline re-arms delivery; restoring a previously notified instant does not repeat it.

One migration-owned pg_cron job, `writewise-deadline-notifications`, runs `*/15 * * * *`. The first sweep evaluates current overdue work. No student-work rows are created just for reminders. `mark_notification_read(uuid,uuid)` and `mark_all_notifications_read(uuid)` preserve first read times and restrict updates to the verified recipient supplied by FastAPI. All-read uses a statement cutoff and counts changed rows. No email, excused, points, or comments schema is added. See [ADR 0005](adr/0005-transactional-notifications-and-scheduling.md).

## 17. Phase 3 Slice 4 — Optional email delivery

The `phase3_email_store`, `phase3_email_context` and `phase3_email_queue` migrations add teacher/parent `email_notifications` (non-null boolean, default true) and service-only `email_outbox`. Existing owner profile RLS governs preferences. In-app notifications always remain on. Migrations create no historical emails and do not rewrite coursework, scores, receipts or read states.

The unique `notification_id` cascades with its notification. The existing `put_notification` transaction enqueues only `submission_returned` and `due_soon`; an off preference inserts a terminal skipped row. Due-soon retains the exact effective deadline used in its event identity. Outbox data is identifiers, timestamps, state, attempt count, lease/token, per-claim attempt snapshot, SHA-256 fingerprint, provider message ID and finite error code. It stores no address/body. Pending-ready and processing-expired partial indexes support bounded claims. RLS has no browser policies/grants; service CRUD is explicit.

States are pending, processing, sent, failed and skipped. Constraints pair processing with a token/lease and `claim_attempts`, reservations with first-attempt time/fingerprint, accepted sends with provider ID/time, and terminal failures/skips with finite codes. Claims use SKIP LOCKED, a two-minute lease and bounded recovery scans. The attempt snapshot distinguishes an unused retry lease from a new reservation. Reservation rotates the token once; only its current token can finalize the newly reserved send. Unused claims consume no attempt.

Service-only public RPCs: `claim_email_delivery()`, `prepare_email_delivery(uuid,uuid)`, `authorize_email_delivery(uuid,uuid,text,text)`, `finish_email_delivery(uuid,uuid,text,text,text,timestamptz)`. Private fixed-time variants are for deterministic tests and are outside the Data API. Preparation/reservation lock activity before outbox and recheck current link/roster, archive state, parent preference, confirmed/non-deleted/non-banned canonical Auth address and event relevance. Only the narrow Auth-address lookup uses SECURITY DEFINER, with an empty search path. Due-soon requires the exact current deadline within 0–24 hours, current assignment and no active attempt. Return requires the latest outstanding Return and no newer completed attempt; historical Return can remain eligible after assignment removal while link/roster access remains valid.

Reservation records the first body digest and increments attempts immediately before external I/O. A changed address/body is terminal `payload_changed`. Known transient failures retry after five then fifteen minutes; provider hints only postpone. At most three sends may be reserved, strictly within one hour of the first. Uncertain expired leases terminate when exhausted/old. No row lock spans external I/O. Sent means provider acceptance, not inbox delivery or exactly-once sending. Terminal skipped/failed rows never replay after preference changes.

The original `phase3_email_dispatch` migration installed a pg_net/Vault HTTP helper and five-minute email cron job. That migration remains historical source. `20261112094548_retire_database_email_dispatch.sql` unschedules only jobs named `writewise-email-dispatch` and drops only `writewise_internal.request_email_dispatch()` without CASCADE. Unexpected dependencies fail instead of being removed implicitly. The 15-minute deadline job, unrelated jobs, extensions, managed grants, Vault entries and all business/outbox data remain unchanged. Hosted rollout is recorded separately from repository implementation.

Supabase-managed pg_net grants cannot be customized per hosted project; owner replay is not the activation procedure. The obsolete guard is retired together with its entire secret-bearing HTTP path. A dependency-free external Node 24 timer calls FastAPI using a secret held outside the database network queue. Browser Data API schema profiles cannot reach net/Vault; browser roles are NOLOGIN, and existing Vault protections and service-only queue RPCs remain. This does not assert direct net object privilege denial where platform-default grants exist. `20261103131659_phase3_email_outcome_validation.sql` still rejects SQL-null outcomes. Public queue signatures and generated API/database contracts are unchanged by timer retirement.
