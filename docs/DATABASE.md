# WriteWise — Database Schema

**A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and Progress Monitoring System**

- **Document type:** Internal engineering build guide (companion to PRD.md, ARCHITECTURE.md, DESIGN.md, CV_PIPELINE.md, ML_PIPELINE.md, API_SPEC.md, TECH_STACK.md)
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
  - **Research data** (`teacher`/`student` → `activity`/`submission`/`measurement`/`manual_score`): `RESTRICT`. Deleting a teacher or student account must be *blocked* while calibration data still references them — this is a thesis's actual dataset, and an account cleanup action should never be able to silently take part of it out.
- **Indexing philosophy:** minimal. Primary key and `unique` constraints (which Postgres indexes automatically) are all this schema gets up front — no proactive indexes for dashboard/trend query patterns. At pilot scale (5 teachers, 30 students), a full scan of any table here is scanning a few hundred rows at absolute worst. Add indexes reactively if Railway's structured logs (ARCHITECTURE §15) ever show a real slowdown — see §11.
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

Nine tables total, matching ARCHITECTURE §6 exactly: `teacher`, `parent`, `student`, `teacher_student`, `student_parent`, `activity`, `submission`, `measurement`, `manual_score`.

---

## 3. Enum Types

```sql
-- migration: 0001_enums.sql

create type public.user_role as enum ('teacher', 'parent');

create type public.submission_status as enum ('processing', 'completed', 'rejected');

create type public.score_band as enum ('needs_improvement', 'developing', 'satisfactory', 'excellent');
```

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
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Whoever sets up the pilot's first teacher accounts just needs to set `role: teacher` in metadata at creation time (Supabase dashboard supports this directly) — no separate manual `insert` step to remember or get wrong.

---

## 5. Roster — `student`, `teacher_student`, `student_parent`

```sql
-- migration: 0003_roster.sql

create table public.student (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  section text not null,
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

Deliberately minimal — `full_name` + `section`, matching PRD §8's data model exactly. No LRN/external ID: the PRD never scopes one, the paper consent forms don't collect one, and disambiguating duplicate names within a class is a roster-UI concern the teacher already handles by construction (they added the student), not a schema one.

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

Implicitly class-wide — any student linked to `created_by` via `teacher_student` is eligible for a submission against it. `is_take_home` is the only thing distinguishing PRD §6's parent-upload flow: the parent portal's "assigned activities" list is just activities where `is_take_home = true` and the creating teacher is linked to the parent's child. No per-student assignment table — the PRD's activity-creation flow never describes picking a subset of students, so that would be unscoped complexity.

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
  submission_id uuid not null unique references public.submission(id) on delete restrict,

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
  submission_id uuid not null unique references public.submission(id) on delete restrict,

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

### 9.1 Removal migration (post-calibration)

PRD §5 and ARCHITECTURE §6 both call for this table to be "removed from the schema" once Phase 2 ships. Given what's inside it is the literal raw input to the thesis's Spearman's Rho validation — something a defense panel could reasonably ask to see again — this is a rename, not a drop:

```sql
-- migration: 00XX_archive_manual_score.sql (illustrative filename —
-- run once CalibratedScoreProvider is confirmed stable in production)

alter table public.manual_score rename to manual_score_archived;

drop policy if exists "teacher can view own submitted manual scores" on public.manual_score_archived;
-- (no new policy added — the archived table is intentionally off the live
-- app/RLS surface entirely; access afterward is direct SQL by a team member,
-- same access model as the research export script in ARCHITECTURE §16)
```

A straight `drop table` is irreversible; the cost of keeping a renamed, inert table around is effectively zero, and needing this data again mid-defense-prep with no clean recovery path would be a real problem a rename entirely avoids.

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

-- activity: creator teacher sees their own; a parent sees take-home activities
-- from any teacher linked to their child.
alter table public.activity enable row level security;
create policy "teacher can view own activities"
  on public.activity for select
  using (created_by = auth.uid());
create policy "parent can view assigned take-home activities"
  on public.activity for select
  using (
    is_take_home
    and exists (
      select 1
      from public.teacher_student ts
      join public.student_parent sp on sp.student_id = ts.student_id
      where ts.teacher_id = activity.created_by
        and sp.parent_id = auth.uid()
    )
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

At 30 students total, none of this is expected to matter during the pilot.

---

## 13. Local Development — Seed Data

PRD §5 explicitly calls for Phase 2 UI (dashboard, diagnostic feedback panel) to be built *now*, in parallel with Phase 1, "against placeholder/manual scores as stand-in data so the UI doesn't block on calibration finishing." `supabase/seed.sql` (Supabase's standard convention — runs automatically on `supabase db reset`) is what supplies that data locally.

It should include a handful of fake teachers, students, activities, and `submission`/`measurement` rows — with `measurement` scores spread across the full 0–100 range per criterion (some weak, some strong, not uniform placeholder numbers), specifically so dashboard trend charts and the class-wide "sortable by weakest criterion" roster view have visually meaningful variation to build against from day one.

```sql
-- supabase/seed.sql (illustrative excerpt — full version has ~5 teachers,
-- ~10-15 students, several activities, and a spread of submissions/measurements)

insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'teacher.santos@example.com',
        '{"role": "teacher", "full_name": "Ms. Santos"}');
-- handle_new_user() trigger fires automatically, creating the matching
-- public.teacher row.

insert into public.student (id, full_name, section)
values ('22222222-2222-2222-2222-222222222222', 'Juan Dela Cruz', 'Grade 3 - Sampaguita');

insert into public.teacher_student (teacher_id, student_id)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- ...activities, submissions, and measurement rows with varied scores follow.
```

---

## 14. Known Risks & Open Items

- **`uploader_role` isn't DB-enforced against the matching profile table** (§7) — a deliberate trade for RLS simplicity. If this ever proves too loose in practice (e.g. a bug lets a teacher-flagged upload actually come from a parent), the fallback is the two-nullable-FK-with-`check` pattern considered and set aside during design.
- **Reactive indexing (§12) is unvalidated** — the "30 students, don't bother" call is based on the pilot's stated scale, not a benchmark. If Phase 2's dashboard queries come in slow once real data is flowing, `submission(student_id)`/`submission(activity_id)` are the first candidates, not a deeper redesign.
- **`manual_score_archived` (§9.1) has no defined long-term retention policy** — it's kept indefinitely as of this document. Worth a decision once the thesis defense (and any panel follow-up) is fully behind the team, but not before.
- **This document assumes CV_PIPELINE.md §8's output schema is stable enough to hardcode into `measurement`'s raw columns.** CV_PIPELINE §12 flags several of its own constants (word-gap multiplier, quality-gate thresholds) as unvalidated starting defaults — if the *shape* of the aggregate output changes (not just its threshold values), `measurement`'s 6 raw column pairs would need a migration to match. The values, not the shape, are what's expected to move during calibration.
