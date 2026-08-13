create table public.measurement (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submission(id) on delete restrict,

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

  letter_formation_score numeric(5,2) check (letter_formation_score between 0 and 100),
  size_consistency_score numeric(5,2) check (size_consistency_score between 0 and 100),
  spacing_score numeric(5,2) check (spacing_score between 0 and 100),
  slant_score numeric(5,2) check (slant_score between 0 and 100),
  baseline_alignment_score numeric(5,2) check (baseline_alignment_score between 0 and 100),

  composite_score numeric(5,2) generated always as (
    (letter_formation_score + size_consistency_score + spacing_score
     + slant_score + baseline_alignment_score) / 5
  ) stored,

  raw_output jsonb not null,
  overlay jsonb,
  created_at timestamptz not null default now()
);
