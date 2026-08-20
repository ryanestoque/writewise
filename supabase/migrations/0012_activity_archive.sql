-- Add is_archived column to activity table
alter table public.activity
  add column if not exists is_archived boolean not null default false;

-- Index to speed up the common filter "active activities for this teacher"
create index if not exists activity_teacher_active_idx
  on public.activity (created_by, is_archived)
  where is_archived = false;

-- RLS: allow teacher to toggle archive state only on own activities
create policy "teacher can update own activity archive flag"
  on public.activity for update
  to authenticated
  using  ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);