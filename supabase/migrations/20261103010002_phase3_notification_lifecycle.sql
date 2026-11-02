-- Existing service-only signatures/grants and lifecycle locks are preserved.
create or replace function public.mutate_student_work(
  actor_id uuid, target_activity_id uuid, target_student_id uuid, operation text, payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  a public.activity;
  w public.student_work;
  s public.submission;
  selected uuid;
begin
  a := writewise_internal.authorize_work(actor_id, target_activity_id, target_student_id);
  w := writewise_internal.lock_work(target_activity_id, target_student_id);
  if jsonb_typeof(payload) <> 'object' then
    raise exception using errcode = 'WW422', message = 'Invalid work request';
  end if;
  if operation = 'update' then
    if payload = '{}'::jsonb or exists (
      select 1 from jsonb_object_keys(payload) as key
      where key not in ('due_at_override', 'pinned_submission_id')
    ) then raise exception using errcode = 'WW422', message = 'Invalid work request'; end if;
    update public.student_work set
      due_at_override = case when payload ? 'due_at_override'
        then (payload->>'due_at_override')::timestamptz else due_at_override end,
      pinned_submission_id = case when payload ? 'pinned_submission_id'
        then (payload->>'pinned_submission_id')::uuid else pinned_submission_id end
      where activity_id = target_activity_id and student_id = target_student_id returning * into w;
    return to_jsonb(w) || jsonb_build_object('effective_due_at', coalesce(w.due_at_override, a.due_at));
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
    update public.submission set released_at = coalesce(released_at, now())
      where id = s.id returning * into s;
    return jsonb_build_object('submission_id', s.id, 'released_at', s.released_at);
  end if;
  raise exception using errcode = 'WW422', message = 'Invalid work operation';
end;
$$;

create or replace function public.record_student_submission(
  actor_id uuid, target_activity_id uuid, target_student_id uuid, payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.activity; w public.student_work; s public.submission; due timestamptz;
  accepted timestamptz;
begin
  select * into a from public.activity where id = target_activity_id for update;
  if not found or not exists (select 1 from public.teacher_student ts
    where ts.teacher_id = a.created_by and ts.student_id = target_student_id) then
    raise exception using errcode = 'WW404', message = 'Work not found';
  end if;
  if payload->>'uploader_role' = 'teacher' then
    if a.created_by <> actor_id then
      raise exception using errcode = 'WW404', message = 'Work not found';
    end if;
  elsif payload->>'uploader_role' = 'parent' then
    if not a.is_take_home or not exists (select 1 from public.student_parent sp
      where sp.parent_id = actor_id and sp.student_id = target_student_id) then
      raise exception using errcode = 'WW404', message = 'Work not found';
    end if;
  else raise exception using errcode = 'WW404', message = 'Work not found'; end if;
  if not public.is_assigned(target_activity_id, target_student_id) then
    raise exception using errcode = 'WW412', message = 'Activity not assigned';
  end if;
  w := writewise_internal.lock_work(target_activity_id, target_student_id);
  due := coalesce(w.due_at_override, a.due_at);
  -- Only the backend service can supply this timestamp, captured before CV/Storage work.
  accepted := coalesce((payload->>'accepted_at')::timestamptz, now());
  if payload->>'uploader_role' = 'parent' and a.close_after_due and accepted > due then
    raise exception using errcode = 'WW411', message = 'Submissions closed';
  end if;
  if payload->>'status' not in ('processing', 'rejected') then
    raise exception using errcode = 'WW422', message = 'Invalid initial status';
  end if;
  insert into public.submission(id, activity_id, student_id, image_path, status,
    uploader_id, uploader_role, rejection_code, rejection_details, created_at)
  values ((payload->>'id')::uuid, target_activity_id, target_student_id, payload->>'image_path',
    (payload->>'status')::public.submission_status, actor_id,
    (payload->>'uploader_role')::public.user_role, payload->>'rejection_code', payload->'rejection_details',
    accepted)
  returning * into s;
  if s.status = 'rejected' and s.uploader_role = 'parent' then
    perform writewise_internal.put_notification(actor_id, 'submission_rejected',
      s.activity_id, s.student_id, s.id, 'submission_rejected:' || s.activity_id::text
      || ':' || s.student_id::text || ':' || actor_id::text || ':' || s.id::text);
  end if;
  return to_jsonb(s);
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
  return to_jsonb(s);
end;
$$;
