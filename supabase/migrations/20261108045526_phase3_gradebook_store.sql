-- Points and publication facts; derived scores/totals remain in ScoreProvider.
alter table public.activity
  add column points_possible numeric,
  add column points_revision bigint not null default 0,
  add constraint activity_points_valid check (points_possible is null or (
    points_possible > 0 and points_possible <= 9999.99
    and points_possible = round(points_possible, 2))),
  add constraint activity_points_revision_valid check (points_revision >= 0);
alter table public.student_work add column excused boolean not null default false;

create table public.student_work_grade (
  id uuid not null default gen_random_uuid() unique,
  activity_id uuid not null,
  student_id uuid not null,
  points_override numeric check (points_override is null or (
    points_override >= 0 and points_override <= 9999.99
    and points_override = round(points_override, 2))),
  source_submission_id uuid references public.submission(id) on delete set null,
  source_signature text not null,
  revision bigint not null default 1 check (revision > 0),
  released_revision bigint,
  released_at timestamptz,
  primary key (activity_id, student_id),
  foreign key (activity_id, student_id)
    references public.student_work(activity_id, student_id) on delete cascade,
  check (released_revision is null or released_revision = revision),
  check ((released_at is null) = (released_revision is null))
);
create index student_work_grade_student on public.student_work_grade(student_id, activity_id);
create index student_work_grade_source on public.student_work_grade(source_submission_id)
  where source_submission_id is not null;
alter table public.student_work_grade enable row level security;
revoke all on public.student_work_grade from public, anon, authenticated;
grant select (id, activity_id, student_id, points_override, source_submission_id,
  revision, released_revision, released_at) on public.student_work_grade to authenticated;
grant select, insert, update, delete on public.student_work_grade to service_role;

create function writewise_internal.grade_source_signature(work_activity uuid, work_student uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select md5(jsonb_build_array(
    a.points_possible::text, a.points_revision, active.id,
    m.letter_formation_score::text, m.size_consistency_score::text,
    m.spacing_score::text, m.slant_score::text, m.baseline_alignment_score::text,
    m.composite_score::text,
    ms.letter_formation_band, ms.size_consistency_band, ms.spacing_band,
    ms.slant_band, ms.baseline_alignment_band,
    g.points_override::text, coalesce(w.excused,false))::text)
  from public.activity a
  left join public.student_work w on w.activity_id=a.id and w.student_id=work_student
  left join public.student_work_grade g on g.activity_id=a.id and g.student_id=work_student
  left join public.active_submission active on active.activity_id=a.id and active.student_id=work_student
  left join public.measurement m on m.submission_id=active.id
  left join public.manual_score ms on ms.submission_id=active.id
  where a.id=work_activity;
$$;

create function writewise_internal.grade_publication_current(work_activity uuid, work_student uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then return false; end if;
  if not exists(select 1 from public.student_parent sp
      where sp.parent_id=caller and sp.student_id=work_student)
    and not exists(select 1 from public.activity a join public.teacher_student ts
      on ts.teacher_id=a.created_by where a.id=work_activity
      and a.created_by=caller and ts.student_id=work_student)
  then return false; end if;
  return exists (
    select 1 from public.student_work_grade g
    join public.activity a on a.id=g.activity_id
    join public.student_work w on w.activity_id=g.activity_id and w.student_id=g.student_id
    left join public.active_submission active
      on active.activity_id=g.activity_id and active.student_id=g.student_id
    where g.activity_id=work_activity and g.student_id=work_student
      and g.released_revision=g.revision and g.released_at is not null
      and a.points_possible is not null and not w.excused
      and g.source_submission_id is not distinct from active.id
      and g.source_signature=writewise_internal.grade_source_signature(work_activity,work_student)
      and (g.points_override is null or g.points_override <= a.points_possible)
      and (g.points_override is not null or (active.id is not null
        and active.released_at is not null and writewise_internal.is_graded(active.id)))
  );
end;
$$;

create function writewise_internal.has_grade_activity_history(work_activity uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.student_work_grade g
    join public.student_parent sp on sp.student_id=g.student_id
    where g.activity_id=work_activity and sp.parent_id=(select auth.uid()));
$$;

create function writewise_internal.gradebook_teacher_name(work_teacher uuid, work_student uuid)
returns text language sql stable security definer set search_path = '' as $$
  select t.full_name from public.teacher t where t.id=work_teacher and (
    t.id=(select auth.uid()) or (
      exists(select 1 from public.student_parent sp
        where sp.student_id=work_student and sp.parent_id=(select auth.uid()))
      and exists(select 1 from public.activity a where a.created_by=t.id and (
        public.is_assigned(a.id,work_student)
        or exists(select 1 from public.submission s
          where s.activity_id=a.id and s.student_id=work_student)
        or exists(select 1 from public.student_work_grade g
          where g.activity_id=a.id and g.student_id=work_student)
      ))
    )
  );
$$;

revoke all on function writewise_internal.grade_source_signature(uuid,uuid)
  from public,anon,authenticated;
grant execute on function writewise_internal.grade_source_signature(uuid,uuid) to service_role;
revoke all on function writewise_internal.grade_publication_current(uuid,uuid)
  from public,anon,authenticated;
revoke all on function writewise_internal.has_grade_activity_history(uuid)
  from public,anon,authenticated;
revoke all on function writewise_internal.gradebook_teacher_name(uuid,uuid)
  from public,anon,authenticated;
grant usage on schema writewise_internal to authenticated;
grant execute on function writewise_internal.grade_publication_current(uuid,uuid)
  to authenticated,service_role;
grant execute on function writewise_internal.has_grade_activity_history(uuid)
  to authenticated,service_role;
grant execute on function writewise_internal.gradebook_teacher_name(uuid,uuid)
  to authenticated,service_role;

create policy grade_owner_select on public.student_work_grade
for select to authenticated using (
  public.is_teacher_of_student(student_id) and exists (
    select 1 from public.activity a where a.id=activity_id and a.created_by=(select auth.uid()))
);
create policy grade_parent_select on public.student_work_grade
for select to authenticated using (
  public.is_parent_of_student(student_id)
  and writewise_internal.grade_publication_current(activity_id,student_id)
);

-- Pair-specific metadata history prevents siblings inheriting each other's columns.
create function writewise_internal.has_grade_work_history(work_activity uuid, work_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.student_work_grade g
    where g.activity_id=work_activity and g.student_id=work_student and (
      exists(select 1 from public.student_parent sp
        where sp.student_id=work_student and sp.parent_id=(select auth.uid()))
      or exists(select 1 from public.activity a join public.teacher_student ts
        on ts.teacher_id=a.created_by where a.id=work_activity
        and a.created_by=(select auth.uid()) and ts.student_id=work_student)
    ));
$$;
revoke all on function writewise_internal.has_grade_work_history(uuid,uuid)
  from public,anon,authenticated;
grant execute on function writewise_internal.has_grade_work_history(uuid,uuid)
  to authenticated,service_role;

drop policy "parent reads assigned or historical child activities" on public.activity;
create policy "parent reads assigned or historical child activities" on public.activity
  for select to authenticated using (
    exists(select 1 from public.student_parent sp where sp.parent_id=(select auth.uid())
      and public.is_assigned(activity.id,sp.student_id))
    or exists(select 1 from public.submission s where s.activity_id=activity.id
      and public.is_parent_of_student(s.student_id))
    or writewise_internal.has_grade_activity_history(activity.id)
  );

-- This function runs with caller rights. No private signature or raw diagnostic is selected.
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
  left join public.student_work w on w.activity_id=a.id and w.student_id=st.id
  left join public.student_work_grade g on g.activity_id=a.id and g.student_id=st.id
  left join public.activity_work_state state on state.activity_id=a.id and state.student_id=st.id
  left join public.active_submission active on active.activity_id=a.id and active.student_id=st.id
  left join public.measurement m on m.submission_id=active.id
  left join public.manual_score ms on ms.submission_id=active.id
  where a.id=work_activity;
$$;
revoke all on function writewise_internal.gradebook_cell_fact(uuid,uuid)
  from public,anon,authenticated;
grant execute on function writewise_internal.gradebook_cell_fact(uuid,uuid)
  to authenticated,service_role;

create function public.read_section_gradebook(target_section_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  with scope as (
    select sec.id,sec.name,sec.teacher_id from public.section sec
    where sec.id=target_section_id and sec.teacher_id=(select auth.uid())
  ), roster as (
    select st.id,st.full_name from public.student st
    join public.teacher_student ts on ts.student_id=st.id
    join scope sec on sec.teacher_id=ts.teacher_id and st.section_id=sec.id
  ), relevant as (
    select a.* from public.activity a join scope sec on sec.teacher_id=a.created_by
    where exists(select 1 from roster st where public.is_assigned(a.id,st.id)
      or exists(select 1 from public.submission s where s.activity_id=a.id and s.student_id=st.id)
      or writewise_internal.has_grade_work_history(a.id,st.id))
  )
  select jsonb_build_object(
    'section_id',sec.id,'section_name',sec.name,'teacher_id',sec.teacher_id,
    'activities',coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'title',a.title,'created_at',a.created_at,
      'is_archived',a.is_archived,'points_possible',a.points_possible::text)
      order by a.created_at desc,a.id desc) from relevant a),'[]'::jsonb),
    'rows',coalesce((select jsonb_agg(jsonb_build_object(
      'student_id',st.id,'student_name',st.full_name,
      'cells',coalesce((select jsonb_agg(writewise_internal.gradebook_cell_fact(a.id,st.id)
        order by a.created_at desc,a.id desc) from relevant a),'[]'::jsonb))
      order by lower(st.full_name),st.id) from roster st),'[]'::jsonb)
  ) into result from scope sec;
  if result is null then
    raise exception using errcode='WW404',message='Gradebook not found';
  end if;
  return result;
end;
$$;

create function public.read_child_gradebook(target_student_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  with scope as (
    select st.id,st.full_name from public.student st where st.id=target_student_id
      and exists(select 1 from public.student_parent sp
        where sp.student_id=st.id and sp.parent_id=(select auth.uid()))
  ), relevant as (
    select a.* from public.activity a cross join scope st
    where public.is_assigned(a.id,st.id)
      or exists(select 1 from public.submission s where s.activity_id=a.id and s.student_id=st.id)
      or writewise_internal.has_grade_work_history(a.id,st.id)
  ), teachers as (
    select ids.teacher_id,coalesce(nullif(btrim(writewise_internal.gradebook_teacher_name(
      ids.teacher_id,target_student_id)),''),'Teacher') as teacher_name
    from (select distinct a.created_by as teacher_id from relevant a) ids
  )
  select jsonb_build_object('student_id',st.id,
    'groups',coalesce((select jsonb_agg(jsonb_build_object(
      'teacher_id',t.teacher_id,'teacher_name',t.teacher_name,
      'activities',coalesce((select jsonb_agg(jsonb_build_object(
        'id',a.id,'title',a.title,'created_at',a.created_at,
        'is_archived',a.is_archived,'points_possible',a.points_possible::text)
        order by a.created_at desc,a.id desc)
        from relevant a where a.created_by=t.teacher_id),'[]'::jsonb),
      'row',jsonb_build_object('student_id',st.id,'student_name',st.full_name,
        'cells',coalesce((select jsonb_agg(writewise_internal.gradebook_cell_fact(a.id,st.id)
          order by a.created_at desc,a.id desc)
          from relevant a where a.created_by=t.teacher_id),'[]'::jsonb)))
      order by lower(t.teacher_name),t.teacher_id) from teachers t),'[]'::jsonb)
  ) into result from scope st;
  if result is null then
    raise exception using errcode='WW404',message='Gradebook not found';
  end if;
  return result;
end;
$$;
revoke all on function public.read_section_gradebook(uuid) from public,anon,authenticated;
revoke all on function public.read_child_gradebook(uuid) from public,anon,authenticated;
grant execute on function public.read_section_gradebook(uuid) to authenticated,service_role;
grant execute on function public.read_child_gradebook(uuid) to authenticated,service_role;
