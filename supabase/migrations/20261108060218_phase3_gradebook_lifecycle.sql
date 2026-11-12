
-- Numeric publication is independent of an optional worksheet.
alter table public.notification drop constraint notification_submission_kind;
alter table public.notification add constraint notification_submission_kind check (
  (type='score_released') or ((submission_id is not null)=(type in (
    'submission_returned','submission_rejected','resubmitted_after_return')))
);

create function writewise_internal.publish_work_grade(
  actor_id uuid,work_activity uuid,work_student uuid,expected_revision bigint
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.activity; w public.student_work; g public.student_work_grade;
  selected public.submission; grade_changed boolean; rubric_changed boolean := false;
begin
  a := writewise_internal.authorize_work(actor_id,work_activity,work_student);
  w := writewise_internal.lock_work(work_activity,work_student);
  g := writewise_internal.sync_work_grade(work_activity,work_student);
  if a.points_possible is null or w.excused or g.id is null then
    raise exception using errcode='WW430',message='Grade cannot be released';
  end if;
  if expected_revision is null or expected_revision<=0 then
    raise exception using errcode='WW434',message='Invalid grade revision';
  end if;
  if expected_revision<>g.revision then
    raise exception using errcode='WW431',message='Grade changed';
  end if;
  select s.* into selected from public.submission s join public.active_submission active on active.id=s.id
    where active.activity_id=work_activity and active.student_id=work_student for update of s;
  if (g.points_override is null and (selected.id is null or not writewise_internal.is_graded(selected.id)))
    or g.points_override>a.points_possible then
    raise exception using errcode='WW430',message='Grade cannot be released';
  end if;
  if selected.id is not null and writewise_internal.is_graded(selected.id) and selected.released_at is null then
    update public.submission set released_at=now() where id=selected.id returning * into selected;
    rubric_changed := true;
  end if;
  grade_changed := g.released_at is null or g.released_revision is distinct from g.revision;
  if grade_changed then
    update public.student_work_grade set released_revision=revision,released_at=now()
      where id=g.id returning * into g;
    perform writewise_internal.notify_work_parents('score_released',work_activity,work_student,selected.id,
      'grade:' || g.id::text || ':' || g.revision::text);
  end if;
  return jsonb_build_object('activity_id',work_activity,'student_id',work_student,'revision',g.revision,
    'released_at',g.released_at,'submission_id',selected.id,'rubric_released',rubric_changed,
    'grade_released',grade_changed);
end;
$$;
revoke all on function writewise_internal.publish_work_grade(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function writewise_internal.publish_work_grade(uuid,uuid,uuid,bigint) to service_role;

create function public.release_student_work_grade(
  actor_id uuid,target_activity_id uuid,target_student_id uuid,expected_revision bigint
) returns jsonb language sql security invoker set search_path = '' as $$
  select writewise_internal.publish_work_grade(actor_id,target_activity_id,target_student_id,expected_revision);
$$;
revoke all on function public.release_student_work_grade(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.release_student_work_grade(uuid,uuid,uuid,bigint) to service_role;
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
    perform writewise_internal.sync_work_grade(target_activity_id,target_student_id);
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
    if a.points_possible is not null then
      g := writewise_internal.sync_work_grade(target_activity_id,target_student_id);
      perform writewise_internal.publish_work_grade(actor_id,target_activity_id,target_student_id,g.revision);
      select source.* into s from public.submission source where source.id=(payload->>'submission_id')::uuid;
      return jsonb_build_object('submission_id',s.id,'released_at',s.released_at);
    end if;
    if w.excused then raise exception using errcode='WW430',message='Excused work cannot be released'; end if;
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


create or replace function public.complete_student_submission(actor_id uuid, target_submission_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.submission; a public.activity;
  previous_active uuid; return_barrier uuid; current_active uuid;
begin
  select * into s from public.submission where id = target_submission_id and uploader_id = actor_id;
  if not found then raise exception using errcode = 'WW404', message = 'Work not found'; end if;
  select * into a from public.activity where id = s.activity_id for update;
  if not found or not exists (select 1 from public.teacher_student ts
    where ts.teacher_id = a.created_by and ts.student_id = s.student_id) then
    raise exception using errcode = 'WW404', message = 'Work not found';
  end if;
  if (s.uploader_role = 'teacher' and a.created_by <> actor_id)
    or (s.uploader_role = 'parent' and not exists (select 1 from public.student_parent sp
        where sp.parent_id = actor_id and sp.student_id = s.student_id)) then
    raise exception using errcode = 'WW404', message = 'Work not found';
  end if;
  perform writewise_internal.lock_work(s.activity_id, s.student_id);
  select * into s from public.submission where id = target_submission_id for update;
  if not found or s.status <> 'processing' then
    raise exception using errcode = 'WW413', message = 'Invalid submission status';
  end if;
  select active.id into previous_active from public.active_submission active
    where active.activity_id = s.activity_id and active.student_id = s.student_id;
  select returned.id into return_barrier from public.submission returned
    where returned.activity_id = s.activity_id and returned.student_id = s.student_id
      and returned.status = 'returned'
    order by returned.created_at desc, returned.id desc limit 1;
  update public.submission set status = 'completed', released_at = null
    where id = target_submission_id returning * into s;
  if s.uploader_role = 'parent' and previous_active is null and return_barrier is not null then
    select active.id into current_active from public.active_submission active
      where active.activity_id = s.activity_id and active.student_id = s.student_id;
    if current_active = s.id then
      perform writewise_internal.put_notification(a.created_by, 'resubmitted_after_return',
        s.activity_id, s.student_id, s.id, 'resubmitted_after_return:' || s.activity_id::text
        || ':' || s.student_id::text || ':' || a.created_by::text || ':' || return_barrier::text);
    end if;
  end if;
  perform writewise_internal.sync_work_grade(s.activity_id,s.student_id);
  return to_jsonb(s);
end;
$$;
create or replace function public.save_manual_submission_score(
  actor_id uuid, target_submission_id uuid, payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.submission; previous public.manual_score; saved public.manual_score;
begin
  select * into s from public.submission where id = target_submission_id;
  if not found then raise exception using errcode = 'WW404', message = 'Work not found'; end if;
  perform writewise_internal.authorize_work(actor_id, s.activity_id, s.student_id);
  perform writewise_internal.lock_work(s.activity_id, s.student_id);
  select * into s from public.submission where id = target_submission_id for update;
  if s.status <> 'completed' then
    raise exception using errcode = 'WW413', message = 'Invalid submission status';
  end if;
  select * into previous from public.manual_score where submission_id = s.id;
  insert into public.manual_score(submission_id, graded_by, letter_formation_band,
    size_consistency_band, spacing_band, slant_band, baseline_alignment_band)
  values (s.id, actor_id, (payload->>'letter_formation_band')::public.score_band,
    (payload->>'size_consistency_band')::public.score_band, (payload->>'spacing_band')::public.score_band,
    (payload->>'slant_band')::public.score_band, (payload->>'baseline_alignment_band')::public.score_band)
  on conflict (submission_id) do update set graded_by = excluded.graded_by,
    letter_formation_band = excluded.letter_formation_band,
    size_consistency_band = excluded.size_consistency_band, spacing_band = excluded.spacing_band,
    slant_band = excluded.slant_band, baseline_alignment_band = excluded.baseline_alignment_band
  returning * into saved;
  if previous.id is null or
    (previous.letter_formation_band, previous.size_consistency_band, previous.spacing_band,
      previous.slant_band, previous.baseline_alignment_band) is distinct from
    (saved.letter_formation_band, saved.size_consistency_band, saved.spacing_band,
      saved.slant_band, saved.baseline_alignment_band) then
    update public.submission set released_at = null where id = s.id;
  end if;
  perform writewise_internal.sync_work_grade(s.activity_id,s.student_id);
  return to_jsonb(saved);
end;
$$;


create or replace function public.release_activity_results(actor_id uuid,target_activity_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.activity; w public.student_work; g public.student_work_grade; candidate uuid;
  selected public.submission; result jsonb; released jsonb := '[]'; grade_students jsonb := '[]';
begin
  select * into a from public.activity where id=target_activity_id and created_by=actor_id for update;
  if not found then raise exception using errcode='WW404',message='Activity not found'; end if;
  for candidate in
    select candidates.student_id from (
      select student_id from public.active_submission where activity_id=target_activity_id
      union select student_id from public.student_work_grade where activity_id=target_activity_id
    ) candidates join public.teacher_student ts on ts.student_id=candidates.student_id
      and ts.teacher_id=actor_id order by candidates.student_id
  loop
    w := writewise_internal.lock_work(target_activity_id,candidate);
    if w.excused then continue; end if;
    select * into selected from public.active_submission where activity_id=target_activity_id and student_id=candidate;
    if a.points_possible is null then
      if selected.id is not null and selected.released_at is null and writewise_internal.is_graded(selected.id) then
        perform public.mutate_student_work(actor_id,target_activity_id,candidate,'release',jsonb_build_object('submission_id',selected.id));
        released := released || jsonb_build_array(selected.id);
      end if;
    else
      g := writewise_internal.sync_work_grade(target_activity_id,candidate);
      if g.id is null or (g.points_override is null and (selected.id is null or not writewise_internal.is_graded(selected.id))) then continue; end if;
      result := writewise_internal.publish_work_grade(actor_id,target_activity_id,candidate,g.revision);
      if (result->>'rubric_released')::boolean then released := released || jsonb_build_array(selected.id); end if;
      if (result->>'grade_released')::boolean then grade_students := grade_students || jsonb_build_array(candidate); end if;
    end if;
  end loop;
  return jsonb_build_object('released_count',jsonb_array_length(released),'submission_ids',released,
    'released_grade_count',jsonb_array_length(grade_students),'grade_student_ids',grade_students);
end;
$$;

create function public.delete_student_submissions(actor_id uuid,target_submission_ids uuid[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare work_activity uuid; pair record; source public.submission; pairs jsonb; deleted jsonb;
begin
  if coalesce(cardinality(target_submission_ids),0)=0 or cardinality(target_submission_ids)>100
    or array_position(target_submission_ids,null) is not null then
    raise exception using errcode='WW434',message='Invalid deletion selection';
  end if;
  -- Acquire all activity locks before any work/grade/attempt locks.
  for work_activity in select distinct activity_id from public.submission
    where id=any(target_submission_ids) order by activity_id loop
    perform 1 from public.activity where id=work_activity for update;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('activity_id',activity_id,'student_id',student_id)
    order by activity_id,student_id),'[]') into pairs from (
    select distinct activity_id,student_id from public.submission where id=any(target_submission_ids)
  ) affected;
  for pair in select * from jsonb_to_recordset(pairs) as p(activity_id uuid,student_id uuid) loop
    perform writewise_internal.lock_work(pair.activity_id,pair.student_id);
    perform 1 from public.student_work_grade where activity_id=pair.activity_id and student_id=pair.student_id for update;
  end loop;
  for source in select * from public.submission where id=any(target_submission_ids) order by id for update loop
    if exists(select 1 from public.teacher t where t.id=actor_id) then
      if not exists(select 1 from public.teacher_student ts where ts.teacher_id=actor_id and ts.student_id=source.student_id) then
        raise exception using errcode='WW404',message='Work not found';
      end if;
    elsif exists(select 1 from public.parent p where p.id=actor_id) then
      if source.uploader_id<>actor_id or source.uploader_role<>'parent' or not exists(
        select 1 from public.student_parent sp where sp.parent_id=actor_id and sp.student_id=source.student_id
      ) then raise exception using errcode='WW404',message='Work not found'; end if;
      if exists(select 1 from public.manual_score where submission_id=source.id) then
        raise exception using errcode='WW435',message='Worksheet already graded';
      end if;
    else raise exception using errcode='WW404',message='Work not found'; end if;
  end loop;
  with removed as (delete from public.submission where id=any(target_submission_ids) returning id)
  select coalesce(jsonb_agg(id order by id),'[]') into deleted from removed;
  for pair in select * from jsonb_to_recordset(pairs) as p(activity_id uuid,student_id uuid) loop
    perform writewise_internal.sync_work_grade(pair.activity_id,pair.student_id);
  end loop;
  return jsonb_build_object('deleted_ids',deleted);
end;
$$;
revoke all on function public.delete_student_submissions(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.delete_student_submissions(uuid,uuid[]) to service_role;
