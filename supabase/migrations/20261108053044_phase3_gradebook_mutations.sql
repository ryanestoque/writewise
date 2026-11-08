-- Activity/work grade edits use the existing activity -> work -> grade lock order.
create or replace function writewise_internal.grade_source_signature(work_activity uuid, work_student uuid)
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


-- Caller holds activity, then work. Grade math remains in ScoreProvider.
create function writewise_internal.sync_work_grade(
  work_activity uuid, work_student uuid, force_redraft boolean default false,
  allow_initial_publish boolean default false
) returns public.student_work_grade language plpgsql security invoker set search_path = '' as $$
declare a public.activity; w public.student_work; g public.student_work_grade;
  selected uuid; source_release timestamptz; signature text; initialized boolean := false;
begin
  select * into a from public.activity where id=work_activity;
  select * into w from public.student_work where activity_id=work_activity and student_id=work_student;
  select * into g from public.student_work_grade
    where activity_id=work_activity and student_id=work_student for update;
  select id,released_at into selected,source_release from public.active_submission
    where activity_id=work_activity and student_id=work_student;
  if g.id is null then
    if a.points_possible is null or selected is null then return null; end if;
    insert into public.student_work_grade(activity_id,student_id,source_signature)
      values(work_activity,work_student,'') returning * into g;
  end if;
  initialized := g.source_signature='';
  if a.points_possible is null then
    selected := null;
    update public.student_work_grade set points_override=null
      where id=g.id returning * into g;
  end if;
  signature := writewise_internal.grade_source_signature(work_activity,work_student);
  if initialized or force_redraft or signature is distinct from g.source_signature
    or selected is distinct from g.source_submission_id then
    update public.student_work_grade set
      source_submission_id=selected, source_signature=signature,
      revision=case when initialized then revision else revision+1 end,
      released_at=null,released_revision=null
      where id=g.id returning * into g;
    if initialized and allow_initial_publish and a.points_possible is not null
      and not w.excused and g.points_override is null and selected is not null
      and source_release is not null and writewise_internal.is_graded(selected) then
      update public.student_work_grade set released_revision=revision,released_at=source_release
        where id=g.id returning * into g;
    end if;
  end if;
  return g;
end;
$$;
revoke all on function writewise_internal.sync_work_grade(uuid,uuid,boolean,boolean)
  from public,anon,authenticated;
grant execute on function writewise_internal.sync_work_grade(uuid,uuid,boolean,boolean) to service_role;

create or replace function writewise_internal.authorize_work(actor_id uuid,work_activity uuid,work_student uuid)
returns public.activity language plpgsql security invoker set search_path = '' as $$
declare a public.activity;
begin
  select * into a from public.activity where id=work_activity and created_by=actor_id for update;
  if not found or not exists(select 1 from public.teacher_student ts
    where ts.teacher_id=actor_id and ts.student_id=work_student) then
    raise exception using errcode='WW404',message='Work not found';
  end if;
  if not public.is_assigned(work_activity,work_student) and not exists(
    select 1 from public.submission s where s.activity_id=work_activity and s.student_id=work_student
  ) and not exists(select 1 from public.student_work_grade g
    where g.activity_id=work_activity and g.student_id=work_student) then
    raise exception using errcode='WW404',message='Work not found';
  end if;
  return a;
end;
$$;
create or replace view public.activity_work_state with (security_invoker = true) as
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
  chosen_points numeric; previous_points numeric; initial_enable boolean;
  grade_student uuid;
begin
  select * into current_activity from public.activity
    where id = target_activity_id and created_by = actor_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Activity not found';
  end if;

  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception using errcode='WW434',message='Invalid activity request';
  end if;
  previous_points := current_activity.points_possible;
  chosen_points := previous_points;
  if payload ? 'points_possible' then
    begin
      if jsonb_typeof(payload->'points_possible') not in ('null','number','string') then
        raise exception using errcode='WW434',message='Invalid points';
      end if;
      chosen_points := (payload->>'points_possible')::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode='WW434',message='Invalid points';
    end;
    if chosen_points is not null and (chosen_points::text in ('NaN','Infinity','-Infinity')
      or chosen_points<=0 or chosen_points>9999.99 or scale(chosen_points)>2) then
      raise exception using errcode='WW434',message='Invalid points';
    end if;
    if chosen_points is null and previous_points is not null
      and exists(select 1 from public.student_work_grade where activity_id=target_activity_id)
      and payload->'confirm_remove_points' is distinct from 'true'::jsonb then
      raise exception using errcode='WW433',message='Confirm points removal';
    end if;
    if chosen_points is not null and exists(select 1 from public.student_work_grade
      where activity_id=target_activity_id and points_override>chosen_points) then
      raise exception using errcode='WW432',message='Override exceeds maximum';
    end if;
  end if;
  initial_enable := current_activity.points_revision=0 and previous_points is null
    and chosen_points is not null;

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
    points_possible=chosen_points,
    points_revision=points_revision + case when chosen_points is distinct from previous_points then 1 else 0 end,
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
  if chosen_points is distinct from previous_points then
    for grade_student in
      select candidates.student_id from (
        select student_id from public.student_work_grade where activity_id=target_activity_id
        union select student_id from public.active_submission where activity_id=target_activity_id
      ) candidates order by candidates.student_id
    loop
      perform writewise_internal.lock_work(target_activity_id,grade_student);
      perform writewise_internal.sync_work_grade(target_activity_id,grade_student,false,initial_enable);
    end loop;
  end if;
  return to_jsonb(current_activity) || jsonb_build_object('assignments', coalesce((
    select jsonb_agg(jsonb_build_object('section_id', aa.section_id, 'student_id', aa.student_id)
                     order by aa.section_id, aa.student_id)
    from public.activity_assignment aa where aa.activity_id = target_activity_id
  ), '[]'::jsonb));
end;
$$;
create or replace function public.mutate_student_work(
  actor_id uuid, target_activity_id uuid, target_student_id uuid, operation text, payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  a public.activity;
  w public.student_work;
  s public.submission;
  selected uuid;
  new_release boolean;
  chosen_override numeric; g public.student_work_grade;
begin
  a := writewise_internal.authorize_work(actor_id, target_activity_id, target_student_id);
  w := writewise_internal.lock_work(target_activity_id, target_student_id);
  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception using errcode = 'WW422', message = 'Invalid work request';
  end if;
  if operation = 'update' then
    if payload = '{}'::jsonb or exists (
      select 1 from jsonb_object_keys(payload) as key
      where key not in ('due_at_override', 'pinned_submission_id','points_override','excused')
    ) then raise exception using errcode = 'WW422', message = 'Invalid work request'; end if;
    if payload ? 'excused' and jsonb_typeof(payload->'excused') is distinct from 'boolean' then
      raise exception using errcode='WW434',message='Invalid excused state';
    end if;
    if payload ? 'points_override' then
      begin
        if jsonb_typeof(payload->'points_override') not in ('null','number','string') then
          raise exception using errcode='WW434',message='Invalid override';
        end if;
        chosen_override := (payload->>'points_override')::numeric;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode='WW434',message='Invalid override';
      end;
      if a.points_possible is null or (chosen_override is not null and (
        chosen_override::text in ('NaN','Infinity','-Infinity') or chosen_override<0
        or chosen_override>a.points_possible or scale(chosen_override)>2)) then
        raise exception using errcode='WW434',message='Invalid override';
      end if;
      if chosen_override is not null then
        insert into public.student_work_grade(activity_id,student_id,source_signature)
          values(target_activity_id,target_student_id,'') on conflict(activity_id,student_id) do nothing;
      end if;
      update public.student_work_grade set points_override=chosen_override
        where activity_id=target_activity_id and student_id=target_student_id;
    end if;
    update public.student_work set
      excused=case when payload ? 'excused' then (payload->>'excused')::boolean else excused end,
      due_at_override = case when payload ? 'due_at_override'
        then (payload->>'due_at_override')::timestamptz else due_at_override end,
      pinned_submission_id = case when payload ? 'pinned_submission_id'
        then (payload->>'pinned_submission_id')::uuid else pinned_submission_id end
      where activity_id = target_activity_id and student_id = target_student_id returning * into w;
    g := writewise_internal.sync_work_grade(target_activity_id,target_student_id);
    return to_jsonb(w) || jsonb_build_object('effective_due_at',coalesce(w.due_at_override,a.due_at),
      'grade',case when g.id is null then null else to_jsonb(g)-'source_signature' end);
  end if;

  select * into s from public.submission where id = (payload->>'submission_id')::uuid
    and activity_id = target_activity_id and student_id = target_student_id for update;
  if not found then raise exception using errcode = 'WW404', message = 'Work not found'; end if;
  if operation = 'return' then
    if s.status <> 'completed' then
      raise exception using errcode = 'WW409', message = 'Attempt cannot be returned';
    end if;
    if payload->>'reason' is null or payload->>'reason' not in
      ('wrong_worksheet', 'blurry_or_cropped', 'wrong_target_text', 'incomplete', 'other') then
      raise exception using errcode = 'WW422', message = 'Invalid return reason';
    end if;
    update public.student_work set
      pinned_submission_id = case when pinned_submission_id = s.id then null
        else pinned_submission_id end,
      due_at_override = case when payload ? 'resubmit_due_at'
        then (payload->>'resubmit_due_at')::timestamptz else due_at_override end
      where activity_id = target_activity_id and student_id = target_student_id returning * into w;
    update public.submission set status = 'returned', returned_at = now(), returned_by = actor_id,
      return_reason = (payload->>'reason')::public.return_reason,
      return_note = nullif(btrim(payload->>'note'), '') where id = s.id returning * into s;
    perform writewise_internal.notify_work_parents('submission_returned', s.activity_id,
      s.student_id, s.id, s.id::text);
    return jsonb_build_object(
      'submission_id', s.id, 'status', s.status, 'returned_at', s.returned_at,
      'returned_by', s.returned_by, 'return_reason', s.return_reason, 'return_note', s.return_note,
      'released_at', s.released_at, 'effective_due_at', coalesce(w.due_at_override, a.due_at)
    );
  elsif operation = 'release' then
    select id into selected from public.active_submission
      where activity_id = target_activity_id and student_id = target_student_id;
    if s.status <> 'completed' or selected is distinct from s.id
      or not writewise_internal.is_graded(s.id) then
      raise exception using errcode = 'WW410', message = 'Attempt cannot be released';
    end if;
    new_release := s.released_at is null;
    update public.submission set released_at = coalesce(released_at, now())
      where id = s.id returning * into s;
    if new_release then
      perform writewise_internal.notify_work_parents('score_released', s.activity_id,
        s.student_id, s.id, s.id::text || ':' || writewise_internal.notification_epoch_us(s.released_at));
    end if;
    return jsonb_build_object('submission_id', s.id, 'released_at', s.released_at);
  end if;
  raise exception using errcode = 'WW422', message = 'Invalid work operation';
end;
$$;


create function public.assign_zero_missing(actor_id uuid,target_activity_id uuid,target_student_ids uuid[] default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.activity; w public.student_work; candidate uuid;
  candidates uuid[]; changed uuid[] := '{}'; skipped uuid[] := '{}';
begin
  select * into a from public.activity where id=target_activity_id and created_by=actor_id for update;
  if not found then raise exception using errcode='WW404',message='Work not found'; end if;
  if a.points_possible is null or (target_student_ids is not null and cardinality(target_student_ids)=0)
    or array_position(target_student_ids,null) is not null then
    raise exception using errcode='WW434',message='Invalid zero selection';
  end if;
  candidates := coalesce(target_student_ids,array(select student_id
    from writewise_internal.assigned_activity_students(target_activity_id)));
  for candidate in select distinct value from unnest(candidates) value order by value loop
    if not exists(select 1 from public.teacher_student ts
      where ts.teacher_id=actor_id and ts.student_id=candidate)
      or not public.is_assigned(target_activity_id,candidate) then
      skipped := array_append(skipped,candidate); continue;
    end if;
    w := writewise_internal.lock_work(target_activity_id,candidate);
    if w.excused or coalesce(w.due_at_override,a.due_at) is null
      or now()<=coalesce(w.due_at_override,a.due_at)
      or exists(select 1 from public.active_submission where activity_id=target_activity_id and student_id=candidate)
      or exists(select 1 from public.student_work_grade where activity_id=target_activity_id
        and student_id=candidate and points_override is not null) then
      skipped := array_append(skipped,candidate); continue;
    end if;
    perform public.mutate_student_work(actor_id,target_activity_id,candidate,'update','{"points_override":"0"}'::jsonb);
    changed := array_append(changed,candidate);
  end loop;
  return jsonb_build_object('changed_student_ids',changed,'skipped_student_ids',skipped);
end;
$$;

create function public.excuse_activity_students(actor_id uuid,target_activity_id uuid,target_student_ids uuid[],excused boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.activity; w public.student_work; candidate uuid; requested boolean := $4;
  changed uuid[] := '{}'; skipped uuid[] := '{}';
begin
  select * into a from public.activity where id=target_activity_id and created_by=actor_id for update;
  if not found then raise exception using errcode='WW404',message='Work not found'; end if;
  if coalesce(cardinality(target_student_ids),0)=0 or array_position(target_student_ids,null) is not null
    or requested is null then raise exception using errcode='WW434',message='Invalid excuse selection'; end if;
  for candidate in select distinct value from unnest(target_student_ids) value order by value loop
    if not exists(select 1 from public.teacher_student ts where ts.teacher_id=actor_id and ts.student_id=candidate)
      or (not public.is_assigned(target_activity_id,candidate) and not exists(
        select 1 from public.submission where activity_id=target_activity_id and student_id=candidate
      ) and not exists(select 1 from public.student_work_grade where activity_id=target_activity_id and student_id=candidate)) then
      skipped := array_append(skipped,candidate); continue;
    end if;
    w := writewise_internal.lock_work(target_activity_id,candidate);
    if w.excused=requested then skipped := array_append(skipped,candidate); continue; end if;
    perform public.mutate_student_work(actor_id,target_activity_id,candidate,'update',jsonb_build_object('excused',requested));
    changed := array_append(changed,candidate);
  end loop;
  return jsonb_build_object('changed_student_ids',changed,'skipped_student_ids',skipped);
end;
$$;
revoke all on function public.assign_zero_missing(uuid,uuid,uuid[]) from public,anon,authenticated;
revoke all on function public.excuse_activity_students(uuid,uuid,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.assign_zero_missing(uuid,uuid,uuid[]) to service_role;
grant execute on function public.excuse_activity_students(uuid,uuid,uuid[],boolean) to service_role;
