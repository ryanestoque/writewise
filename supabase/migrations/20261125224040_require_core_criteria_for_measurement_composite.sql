-- Require the three core criteria (letter_formation, size_consistency,
-- baseline_alignment) before computing measurement.composite_score so incomplete
-- measurements remain ungraded/unreleasable while optional criteria (spacing,
-- slant) may still be NULL (N/A) and excluded from the denominator.

-- Drop dependent SQL view/functions that reference measurement.composite_score,
-- replace the generated column, and recreate them identically in the same transaction.
drop function if exists writewise_internal.gradebook_cell_fact(uuid, uuid);
drop view if exists public.activity_work_state;
drop function if exists writewise_internal.grade_source_signature(uuid, uuid);
drop function if exists writewise_internal.is_graded(uuid);

alter table public.measurement
  drop column composite_score;

alter table public.measurement
  add column composite_score numeric(5,2) generated always as (
    case
      when letter_formation_score is null
        or size_consistency_score is null
        or baseline_alignment_score is null
      then null
      else round(
        (
          letter_formation_score
          + size_consistency_score
          + coalesce(spacing_score, 0)
          + coalesce(slant_score, 0)
          + baseline_alignment_score
        ) / (
          3
          + (case when spacing_score is not null then 1 else 0 end)
          + (case when slant_score is not null then 1 else 0 end)
        ),
        2
      )
    end
  ) stored;

create function writewise_internal.is_graded(target_submission uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.manual_score where submission_id = target_submission)
    or exists (select 1 from public.measurement
               where submission_id = target_submission and composite_score is not null);
$$;
revoke all on function writewise_internal.is_graded(uuid) from public, anon, authenticated;
grant execute on function writewise_internal.is_graded(uuid) to service_role;

create function writewise_internal.grade_source_signature(work_activity uuid, work_student uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select md5(jsonb_build_array(
    round(a.points_possible,2)::text, a.points_revision, active.id,
    m.letter_formation_score::text, m.size_consistency_score::text,
    m.spacing_score::text, m.slant_score::text, m.baseline_alignment_score::text,
    m.composite_score::text,
    ms.letter_formation_band, ms.size_consistency_band, ms.spacing_band,
    ms.slant_band, ms.baseline_alignment_band,
    round(g.points_override,2)::text, coalesce(w.excused,false))::text)
  from public.activity a
  left join public.student_work w on w.activity_id=a.id and w.student_id=work_student
  left join public.student_work_grade g on g.activity_id=a.id and g.student_id=work_student
  left join public.active_submission active on active.activity_id=a.id and active.student_id=work_student
  left join public.measurement m on m.submission_id=active.id
  left join public.manual_score ms on ms.submission_id=active.id
  where a.id=work_activity;
$$;
revoke all on function writewise_internal.grade_source_signature(uuid,uuid) from public, anon, authenticated;
grant execute on function writewise_internal.grade_source_signature(uuid,uuid) to service_role;

create view public.activity_work_state with (security_invoker = true) as
with pairs as (
  select a.id as activity_id, st.id as student_id
  from public.activity a
  cross join public.student st
  where public.is_assigned(a.id, st.id)
    or writewise_internal.has_grade_work_history(a.id,st.id)
  union
  select s.activity_id, s.student_id from public.submission s
)
select p.activity_id, p.student_id, active.id as active_submission_id,
  active.created_at as active_created_at, active.released_at,
  w.due_at_override, w.pinned_submission_id, due.effective_due_at,
  latest.id as latest_submission_id, latest.status as latest_status,
  latest.rejection_code as latest_rejection_code,
  returned.returned_at, returned.return_reason, returned.return_note,
  case
    when coalesce(w.excused,false) then 'Excused'
    when active.id is null then case
      when due.effective_due_at is not null and now() > due.effective_due_at then 'Missing'
      when returned.id is not null then 'Returned'
      else 'Assigned' end
    when (m.composite_score is not null or ms.id is not null) then case
      when active.released_at is null then 'Draft' else 'Released' end
    else 'Turned in'
  end as work_status,
  case when coalesce(w.excused,false) then false
    else coalesce(active.created_at > due.effective_due_at, false) end as late,
  coalesce(w.excused,false) as excused
from pairs p
left join public.activity a on a.id = p.activity_id
join public.student st on st.id = p.student_id
left join public.student_work w on w.activity_id = p.activity_id and w.student_id = p.student_id
left join public.active_submission active
  on active.activity_id = p.activity_id and active.student_id = p.student_id
left join public.measurement m on m.submission_id = active.id
left join public.manual_score ms on ms.submission_id = active.id
cross join lateral (values (coalesce(w.due_at_override, a.due_at))) due(effective_due_at)
left join lateral (
  select s.id, s.status, s.rejection_code from public.submission s
  where s.activity_id = p.activity_id and s.student_id = p.student_id
  order by s.created_at desc, s.id desc limit 1
) latest on true
left join lateral (
  select s.id, s.returned_at, s.return_reason, s.return_note from public.submission s
  where s.activity_id = p.activity_id and s.student_id = p.student_id and s.status = 'returned'
  order by s.returned_at desc, s.id desc limit 1
) returned on true;
revoke all on public.activity_work_state from public, anon, authenticated;
grant select on public.activity_work_state to authenticated, service_role;

create function writewise_internal.gradebook_cell_fact(work_activity uuid, work_student uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'activity_id',a.id,'student_id',st.id,
    'applicable',public.is_assigned(a.id,st.id)
      or exists(select 1 from public.submission s where s.activity_id=a.id and s.student_id=st.id)
      or writewise_internal.has_grade_work_history(a.id,st.id),
    'coursework_status',case when coalesce(w.excused,false) then 'Excused'
      else coalesce(state.work_status,case
        when coalesce(w.due_at_override,a.due_at) < now() then 'Missing' else 'Assigned' end) end,
    'late',not coalesce(w.excused,false)
      and coalesce(state.late,active.created_at > coalesce(w.due_at_override,a.due_at),false),
    'excused',coalesce(w.excused,false),'points_possible',a.points_possible::text,
    'active_submission_id',active.id,'grade_visible',g.id is not null,
    'publication_current',g.id is not null
      and writewise_internal.grade_publication_current(a.id,st.id),
    'grade_revision',g.revision,'points_override',g.points_override::text,
    'measurement',case when m.id is null then null else jsonb_build_object(
      'letter_formation_score',m.letter_formation_score::text,
      'size_consistency_score',m.size_consistency_score::text,
      'spacing_score',m.spacing_score::text,'slant_score',m.slant_score::text,
      'baseline_alignment_score',m.baseline_alignment_score::text,
      'composite_score',m.composite_score::text) end,
    'manual_score',case when ms.id is null then null else jsonb_build_object(
      'letter_formation_score',ms.letter_formation_score::text,
      'size_consistency_score',ms.size_consistency_score::text,
      'spacing_score',ms.spacing_score::text,'slant_score',ms.slant_score::text,
      'baseline_alignment_score',ms.baseline_alignment_score::text) end
  )
  from public.activity a join public.student st on st.id=work_student
  left join public.student_work w on w.activity_id=a.id and w.student_id=work_student
  left join public.student_work_grade g on g.activity_id=a.id and g.student_id=work_student
  left join public.activity_work_state state on state.activity_id=a.id and state.student_id=work_student
  left join public.active_submission active on active.activity_id=a.id and active.student_id=work_student
  left join public.measurement m on m.submission_id=active.id
  left join public.manual_score ms on ms.submission_id=active.id
  where a.id=work_activity;
$$;
revoke all on function writewise_internal.gradebook_cell_fact(uuid,uuid)
  from public,anon,authenticated;
grant execute on function writewise_internal.gradebook_cell_fact(uuid,uuid)
  to authenticated,service_role;
