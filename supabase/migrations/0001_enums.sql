create type public.user_role as enum ('teacher', 'parent');

create type public.submission_status as enum ('processing', 'completed', 'rejected');

create type public.score_band as enum ('needs_improvement', 'developing', 'satisfactory', 'excellent');
