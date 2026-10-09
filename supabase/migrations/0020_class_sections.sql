-- 1. Create public.section table
create table if not exists public.section (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_teacher_section_name unique (teacher_id, name)
);

-- Trigger for updated_at
drop trigger if exists set_section_updated_at on public.section;
create trigger set_section_updated_at
  before update on public.section
  for each row execute function public.set_updated_at();

-- 2. Link student to section
alter table public.student
  add column if not exists section_id uuid references public.section(id) on delete restrict;

-- 3. Backfill existing sections from current roster
insert into public.section (teacher_id, name)
select distinct ts.teacher_id, trim(s.section)
from public.teacher_student ts
join public.student s on s.id = ts.student_id
where s.section is not null and trim(s.section) <> ''
on conflict (teacher_id, name) do nothing;

-- 4. Backfill student.section_id
update public.student s
set section_id = sec.id
from public.teacher_student ts
join public.section sec on sec.teacher_id = ts.teacher_id
where ts.student_id = s.id
  and sec.name = trim(s.section)
  and s.section_id is null;

-- 5. Row Level Security
alter table public.section enable row level security;

drop policy if exists "teacher can view own sections" on public.section;
create policy "teacher can view own sections"
  on public.section for select
  using (teacher_id = auth.uid());
