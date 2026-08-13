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
