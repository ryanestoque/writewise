-- Both existing send gates call this live eligibility check after the activity lock.
create or replace function writewise_internal.enqueue_time_based_notifications_at(as_of timestamptz)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  work_id uuid;
  activity_row public.activity;
  candidate record;
  event_kind public.notification_type;
  inserted integer := 0;
begin
  if as_of is null then raise exception 'Notification sweep time is required'; end if;
  -- Same activity-first order as application writes; no locks span CV/Storage work.
  for work_id in select a.id from public.activity a where not a.is_archived order by a.id
  loop
    select * into activity_row from public.activity a where a.id = work_id for update;
    if not found or activity_row.is_archived then continue; end if;
    -- This statement runs after the row lock: a previously committed completion or
    -- deadline edit must be reflected even when the sweep waited for that lock.
    for candidate in
      select member.student_id, coalesce(w.due_at_override, activity_row.due_at) as due_at
      from writewise_internal.assigned_activity_students(work_id) member
      left join public.student_work w
        on w.activity_id = work_id and w.student_id = member.student_id
      where not coalesce(w.excused,false) and not exists (
        select 1 from public.active_submission active
        where active.activity_id = work_id and active.student_id = member.student_id
      )
      order by member.student_id
    loop
      if candidate.due_at is null then continue; end if;
      if candidate.due_at < as_of then event_kind := 'activity_missing';
      elsif candidate.due_at <= as_of + interval '24 hours' then event_kind := 'due_soon';
      else continue;
      end if;
      inserted := inserted + writewise_internal.notify_work_parents(event_kind, work_id,
        candidate.student_id, null, writewise_internal.notification_epoch_us(candidate.due_at));
    end loop;
  end loop;
  return inserted;
end;
$$;

create or replace function writewise_internal.email_eligibility(target_outbox_id uuid, as_of timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  context record;
  target_return public.submission;
  check_time timestamptz := coalesce(as_of, clock_timestamp());
begin
  -- One fresh statement captures preference, relationships and Auth state together.
  select n.type, n.recipient_id, n.activity_id, n.student_id, n.submission_id,
    q.due_at as queued_due, a.is_archived, coalesce(w.excused,false) as excused,
    coalesce(w.due_at_override, a.due_at) as effective_due,
    p.email_notifications,
    exists(select 1 from public.student_parent sp
      where sp.student_id = n.student_id and sp.parent_id = n.recipient_id) as linked,
    exists(select 1 from public.teacher_student ts
      where ts.teacher_id = a.created_by and ts.student_id = n.student_id) as rostered,
    writewise_internal.email_recipient_address(n.recipient_id, check_time) as address
  into context
  from public.email_outbox q
  join public.notification n on n.id = q.notification_id
  join public.activity a on a.id = n.activity_id
  left join public.student_work w on w.activity_id = n.activity_id and w.student_id = n.student_id
  left join public.parent p on p.id = n.recipient_id
  where q.id = target_outbox_id;
  if not found or context.type not in ('due_soon','submission_returned') then
    return jsonb_build_object('state','skipped','code','event_obsolete');
  end if;
  if context.excused then
    return jsonb_build_object('state','skipped','code','work_excused');
  end if;
  if context.is_archived then
    return jsonb_build_object('state','skipped','code','activity_archived');
  end if;
  if not context.linked or not context.rostered then
    return jsonb_build_object('state','skipped','code','relationship_revoked');
  end if;
  if context.email_notifications is null or context.address is null then
    return jsonb_build_object('state','skipped','code','recipient_unavailable');
  end if;
  if not context.email_notifications then
    return jsonb_build_object('state','skipped','code','preference_off');
  end if;
  if context.type = 'due_soon' then
    if context.effective_due is distinct from context.queued_due then
      return jsonb_build_object('state','skipped','code','deadline_changed');
    end if;
    if context.effective_due is null or context.effective_due < check_time
      or context.effective_due > check_time + interval '24 hours'
      or not exists (
        select 1 from writewise_internal.assigned_activity_students(context.activity_id) member
        where member.student_id = context.student_id
      ) then
      return jsonb_build_object('state','skipped','code','event_obsolete');
    end if;
  else
    select * into target_return from public.submission s
    where s.id = context.submission_id and s.student_id = context.student_id
      and s.activity_id = context.activity_id and s.status = 'returned';
    if not found then
      return jsonb_build_object('state','skipped','code','event_obsolete');
    end if;
    if exists (
      select 1 from public.submission s
      where s.activity_id = context.activity_id and s.student_id = context.student_id
        and (
          (s.status = 'returned' and (s.returned_at,s.id) > (target_return.returned_at,target_return.id))
          or (s.status = 'completed' and (s.created_at,s.id) > (target_return.created_at,target_return.id))
        )
    ) then
      return jsonb_build_object('state','skipped','code','event_obsolete');
    end if;
  end if;
  if exists(select 1 from public.active_submission s
    where s.activity_id = context.activity_id and s.student_id = context.student_id) then
    return jsonb_build_object('state','skipped','code','event_obsolete');
  end if;
  return jsonb_build_object('state','ready','recipient',context.address,'event_type',context.type);
end;
$$;

