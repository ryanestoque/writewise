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
