-- Internal assignment lookup works for service RPCs and JWT-free cron sessions.
create function writewise_internal.assigned_activity_students(target_activity uuid, roster jsonb default null)
returns table(student_id uuid) language sql stable security invoker set search_path = '' as $$
  with members as (
    select st.id as student_id, st.section_id
    from public.activity a
    join public.teacher_student ts on ts.teacher_id = a.created_by
    join public.student st on st.id = ts.student_id
    where a.id = target_activity and roster is null
    union all
    select snapshot.student_id, snapshot.section_id
    from jsonb_to_recordset(coalesce(roster, '[]'::jsonb))
      as snapshot(student_id uuid, section_id uuid)
    where roster is not null
  )
  select distinct member.student_id
  from public.activity a
  cross join members member
  join public.activity_assignment aa on aa.activity_id = a.id
  where a.id = target_activity and (
    aa.student_id = member.student_id or (aa.section_id = member.section_id and exists (
      select 1 from public.section sec where sec.id = aa.section_id and sec.teacher_id = a.created_by
    ))
  );
$$;
revoke all on function writewise_internal.assigned_activity_students(uuid,jsonb) from public,anon,authenticated;
grant execute on function writewise_internal.assigned_activity_students(uuid,jsonb) to service_role;

create or replace function public.update_assigned_activity(actor_id uuid, target_activity_id uuid, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  current_activity public.activity;
  target jsonb;
  chosen_section uuid;
  chosen_student uuid;
  before_ids uuid[];
  changed_student uuid;
  transition_id uuid;
  roster_snapshot jsonb;
begin
  select * into current_activity from public.activity
    where id = target_activity_id and created_by = actor_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Activity not found';
  end if;

  if payload ? 'assignments' then
    -- Freeze just roster IDs/sections once: an unrelated concurrent roster move
    -- must not become an assignment event between before/after target reads.
    select coalesce(jsonb_agg(jsonb_build_object('student_id', st.id, 'section_id', st.section_id)), '[]'::jsonb)
      into roster_snapshot
    from public.teacher_student ts join public.student st on st.id = ts.student_id
    where ts.teacher_id = actor_id;
    before_ids := array(select member.student_id
      from writewise_internal.assigned_activity_students(target_activity_id, roster_snapshot) member);
  end if;

  if payload ? 'assignments' then
    if jsonb_typeof(payload -> 'assignments') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'Invalid assignment targets';
    end if;
    if jsonb_array_length(payload -> 'assignments') = 0 then
      raise exception using errcode = '22023', message = 'Assignment targets required';
    end if;
    for target in select value from jsonb_array_elements(payload -> 'assignments') loop
      begin
        chosen_section := (target ->> 'section_id')::uuid;
        chosen_student := (target ->> 'student_id')::uuid;
      exception when invalid_text_representation then
        raise exception using errcode = '22023', message = 'Invalid assignment target';
      end;
      if num_nonnulls(chosen_section, chosen_student) <> 1
        or (chosen_section is not null and not exists (
          select 1 from public.section where id = chosen_section and teacher_id = actor_id
        )) or (chosen_student is not null and not exists (
          select 1 from public.teacher_student where teacher_id = actor_id and student_id = chosen_student
        )) then
        raise exception using errcode = '22023', message = 'Invalid assignment target';
      end if;
    end loop;
  end if;

  update public.activity set
    title = case when payload ? 'title' then payload ->> 'title' else title end,
    target_text = case when payload ? 'target_text' then payload ->> 'target_text' else target_text end,
    instructions = case when payload ? 'instructions' then payload ->> 'instructions' else instructions end,
    is_take_home = case when payload ? 'is_take_home' then (payload ->> 'is_take_home')::boolean else is_take_home end,
    due_at = case when payload ? 'due_at' then (payload ->> 'due_at')::timestamptz else due_at end,
    close_after_due = case when payload ? 'close_after_due' then (payload ->> 'close_after_due')::boolean else close_after_due end
  where id = target_activity_id returning * into current_activity;

  if payload ? 'assignments' then
    delete from public.activity_assignment where activity_id = target_activity_id;
    insert into public.activity_assignment(activity_id, section_id, student_id)
    select distinct target_activity_id, (value ->> 'section_id')::uuid, (value ->> 'student_id')::uuid
    from jsonb_array_elements(payload -> 'assignments');
  end if;
  if payload ? 'assignments' then
    for changed_student in
      select member.student_id
      from writewise_internal.assigned_activity_students(target_activity_id, roster_snapshot) member
      where not (member.student_id = any(before_ids))
      order by member.student_id
    loop
      if transition_id is null then transition_id := gen_random_uuid(); end if;
      perform writewise_internal.notify_work_parents('activity_assigned', target_activity_id,
        changed_student, null, transition_id::text);
    end loop;
  end if;
  return to_jsonb(current_activity) || jsonb_build_object('assignments', coalesce((
    select jsonb_agg(jsonb_build_object('section_id', aa.section_id, 'student_id', aa.student_id)
                     order by aa.section_id, aa.student_id)
    from public.activity_assignment aa where aa.activity_id = target_activity_id
  ), '[]'::jsonb));
end;
$$;
