create table public.activity (
  id uuid primary key default gen_random_uuid(),
  target_text text not null,
  is_take_home boolean not null default false,
  created_by uuid not null references public.teacher(id) on delete restrict,
  created_at timestamptz not null default now()
);
