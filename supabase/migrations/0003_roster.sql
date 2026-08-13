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
