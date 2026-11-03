create extension if not exists pg_cron;

create function writewise_internal.enqueue_time_based_notifications_at(as_of timestamptz)
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
      where not exists (
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

create function writewise_internal.enqueue_time_based_notifications()
returns integer language sql security invoker set search_path = '' as $$
  select writewise_internal.enqueue_time_based_notifications_at(now());
$$;
revoke all on function writewise_internal.enqueue_time_based_notifications_at(timestamptz)
  from public,anon,authenticated;
revoke all on function writewise_internal.enqueue_time_based_notifications()
  from public,anon,authenticated;
grant execute on function writewise_internal.enqueue_time_based_notifications_at(timestamptz)
  to service_role;
grant execute on function writewise_internal.enqueue_time_based_notifications() to service_role;

-- cron.schedule replaces a job with this same name instead of duplicating it.
select cron.schedule('writewise-deadline-notifications', '*/15 * * * *',
  'select writewise_internal.enqueue_time_based_notifications();');
