-- Phase 3 Slice 2: all browser score reads obey explicit release.
create type public.return_reason as enum
  ('wrong_worksheet', 'blurry_or_cropped', 'wrong_target_text', 'incomplete', 'other');

alter table public.submission
  add column returned_at timestamptz,
  add column returned_by uuid references public.teacher(id) on delete restrict,
  add column return_reason public.return_reason,
  add column return_note text check (length(return_note) <= 2000),
  add column released_at timestamptz,
  add constraint submission_return_metadata check (
    (status = 'returned' and returned_at is not null and returned_by is not null
     and return_reason is not null)
    or (status <> 'returned' and returned_at is null and returned_by is null
        and return_reason is null and return_note is null)
  );

-- Preserve every pre-upgrade result's visibility. Never recalculate old rubric data.
update public.submission set released_at = updated_at;

create table public.student_work (
  activity_id uuid not null references public.activity(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  due_at_override timestamptz,
  pinned_submission_id uuid references public.submission(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (activity_id, student_id)
);
create index student_work_student_lookup on public.student_work(student_id, activity_id);
create index student_work_pin_lookup on public.student_work(pinned_submission_id)
  where pinned_submission_id is not null;
create index submission_work_order on public.submission
  (activity_id, student_id, created_at desc, id desc);
create trigger set_student_work_updated_at before update on public.student_work
  for each row execute function public.set_updated_at();

alter table public.student_work enable row level security;
revoke all on public.student_work from public, anon, authenticated;
grant select on public.student_work to authenticated;
grant select, insert, update, delete on public.student_work to service_role;
create policy "teacher reads owned student work" on public.student_work
  for select to authenticated using (
    public.is_teacher_of_student(student_id)
    and exists (select 1 from public.activity a
                where a.id = activity_id and a.created_by = (select auth.uid()))
  );
create policy "parent reads child student work" on public.student_work
  for select to authenticated using (public.is_parent_of_student(student_id));

-- Historical work keeps its metadata/deadline after section or targeting changes.
drop policy "parent can view assigned child activities" on public.activity;
create policy "parent reads assigned or historical child activities" on public.activity
  for select to authenticated using (
    exists (select 1 from public.student_parent sp
      where sp.parent_id = (select auth.uid()) and public.is_assigned(activity.id, sp.student_id))
    or exists (select 1 from public.submission s
      where s.activity_id = activity.id and public.is_parent_of_student(s.student_id))
  );

drop policy "parent can view own child's measurements" on public.measurement;
create policy "parent reads released child measurements" on public.measurement
  for select to authenticated using (exists (
    select 1 from public.submission s where s.id = measurement.submission_id
      and s.released_at is not null and public.is_parent_of_student(s.student_id)
  ));
drop policy "parent can view manual scores for own child" on public.manual_score;
create policy "parent reads released child rubric" on public.manual_score
  for select to authenticated using (exists (
    select 1 from public.submission s where s.id = manual_score.submission_id
      and s.released_at is not null and public.is_parent_of_student(s.student_id)
  ));
create policy "activity owner reads retained rubric" on public.manual_score
  for select to authenticated using (exists (
    select 1 from public.submission s join public.activity a on a.id = s.activity_id
    where s.id = manual_score.submission_id and a.created_by = (select auth.uid())
      and public.is_teacher_of_student(s.student_id)
  ));

-- No score-dependent predicate: both roles select exactly the same active ID.
create view public.active_submission with (security_invoker = true) as
select distinct on (s.activity_id, s.student_id) s.*
from public.submission s
left join public.student_work w
  on w.activity_id = s.activity_id and w.student_id = s.student_id
where s.status = 'completed' and (
  s.id = w.pinned_submission_id
  or not exists (
    select 1 from public.submission r
    where r.activity_id = s.activity_id and r.student_id = s.student_id
      and r.status = 'returned' and (r.created_at, r.id) >= (s.created_at, s.id)
  )
)
order by s.activity_id, s.student_id,
  (s.id = w.pinned_submission_id) desc nulls last, s.created_at desc, s.id desc;
revoke all on public.active_submission from public, anon, authenticated;
grant select on public.active_submission to authenticated, service_role;

create view public.activity_work_state with (security_invoker = true) as
with pairs as (
  select a.id as activity_id, st.id as student_id
  from public.activity a
  join public.teacher_student ts on ts.teacher_id = a.created_by
  join public.student st on st.id = ts.student_id
  where public.is_assigned(a.id, st.id)
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
    when active.id is null then case
      when due.effective_due_at is not null and now() > due.effective_due_at then 'Missing'
      when returned.id is not null then 'Returned'
      else 'Assigned' end
    when (m.composite_score is not null or ms.id is not null) then case
      when active.released_at is null then 'Draft' else 'Released' end
    else 'Turned in'
  end as work_status,
  coalesce(active.created_at > due.effective_due_at, false) as late
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

-- Private helpers never expose privileged lookups through PostgREST.
create schema writewise_internal;
revoke all on schema writewise_internal from public, anon, authenticated;
grant usage on schema writewise_internal to service_role;

create function writewise_internal.authorize_work(actor_id uuid, work_activity uuid, work_student uuid)
returns public.activity language plpgsql security invoker set search_path = '' as $$
declare a public.activity;
begin
  -- Every lifecycle path locks activity first, then student work. Bulk uses the same order.
  select * into a from public.activity where id = work_activity and created_by = actor_id for update;
  if not found or not exists (select 1 from public.teacher_student ts
                             where ts.teacher_id = actor_id and ts.student_id = work_student) then
    raise exception using errcode = 'WW404', message = 'Work not found';
  end if;
  if not public.is_assigned(work_activity, work_student) and not exists (
    select 1 from public.submission s
    where s.activity_id = work_activity and s.student_id = work_student
  ) then raise exception using errcode = 'WW404', message = 'Work not found'; end if;
  return a;
end;
$$;

create function writewise_internal.lock_work(work_activity uuid, work_student uuid)
returns public.student_work language plpgsql security invoker set search_path = '' as $$
declare w public.student_work;
begin
  insert into public.student_work(activity_id, student_id) values (work_activity, work_student)
    on conflict (activity_id, student_id) do nothing;
  select * into w from public.student_work
    where activity_id = work_activity and student_id = work_student for update;
  return w;
end;
$$;

create function writewise_internal.is_graded(target_submission uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.manual_score where submission_id = target_submission)
    or exists (select 1 from public.measurement
               where submission_id = target_submission and composite_score is not null);
$$;

create function writewise_internal.validate_pin()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.pinned_submission_id is not null and not exists (
    select 1 from public.submission s where s.id = new.pinned_submission_id
      and s.activity_id = new.activity_id and s.student_id = new.student_id and s.status = 'completed'
  ) then raise exception using errcode = 'WW422', message = 'Invalid attempt selection'; end if;
  return new;
end;
$$;
create trigger validate_student_work_pin before insert or update on public.student_work
  for each row execute function writewise_internal.validate_pin();

create function public.mutate_student_work(
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

create function public.release_activity_results(actor_id uuid, target_activity_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s record; released jsonb := '[]'::jsonb;
begin
  perform 1 from public.activity where id = target_activity_id and created_by = actor_id for update;
  if not found then raise exception using errcode = 'WW404', message = 'Activity not found'; end if;
  for s in select active.id, active.student_id from public.active_submission active
    join public.teacher_student ts on ts.student_id = active.student_id and ts.teacher_id = actor_id
    where active.activity_id = target_activity_id and active.released_at is null
      and writewise_internal.is_graded(active.id)
    order by active.student_id
  loop
    perform public.mutate_student_work(actor_id, target_activity_id, s.student_id, 'release',
      jsonb_build_object('submission_id', s.id));
    released := released || jsonb_build_array(s.id);
  end loop;
  return jsonb_build_object('released_count', jsonb_array_length(released), 'submission_ids', released);
end;
$$;

create function public.record_student_submission(
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
  return to_jsonb(s);
end;
$$;

create function public.complete_student_submission(actor_id uuid, target_submission_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.submission; a public.activity;
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
  update public.submission set status = 'completed', released_at = null
    where id = target_submission_id returning * into s;
  return to_jsonb(s);
end;
$$;

create function public.save_manual_submission_score(
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
  return to_jsonb(saved);
end;
$$;

revoke all on all functions in schema writewise_internal from public, anon, authenticated;
grant execute on all functions in schema writewise_internal to service_role;
revoke all on function public.mutate_student_work(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.release_activity_results(uuid,uuid) from public,anon,authenticated;
revoke all on function public.record_student_submission(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.complete_student_submission(uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_manual_submission_score(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_student_work(uuid,uuid,uuid,text,jsonb) to service_role;
grant execute on function public.release_activity_results(uuid,uuid) to service_role;
grant execute on function public.record_student_submission(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.complete_student_submission(uuid,uuid) to service_role;
grant execute on function public.save_manual_submission_score(uuid,uuid,jsonb) to service_role;
