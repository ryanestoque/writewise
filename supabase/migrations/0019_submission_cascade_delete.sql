-- migration: 0019_submission_cascade_delete.sql

-- 1. Alter measurement table foreign key to CASCADE
alter table public.measurement
  drop constraint if exists measurement_submission_id_fkey,
  add constraint measurement_submission_id_fkey
    foreign key (submission_id)
    references public.submission(id)
    on delete cascade;

-- 2. Alter manual_score table foreign key to CASCADE
alter table public.manual_score
  drop constraint if exists manual_score_submission_id_fkey,
  add constraint manual_score_submission_id_fkey
    foreign key (submission_id)
    references public.submission(id)
    on delete cascade;
