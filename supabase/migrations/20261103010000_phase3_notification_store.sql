-- Notifications contain identifiers only; browser writes are never granted.
create type public.notification_type as enum (
  'activity_assigned', 'due_soon', 'submission_returned', 'submission_rejected',
  'score_released', 'activity_missing', 'resubmitted_after_return'
);

create table public.notification (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type public.notification_type not null,
  activity_id uuid not null references public.activity(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  submission_id uuid references public.submission(id) on delete cascade,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_submission_kind check (
    (submission_id is not null) = (type in (
      'submission_returned', 'submission_rejected', 'score_released', 'resubmitted_after_return'
    ))
  )
);
create index notification_feed on public.notification(recipient_id, created_at desc, id desc);
create index notification_unread on public.notification(recipient_id) where read_at is null;
create index notification_activity on public.notification(activity_id);
create index notification_student on public.notification(student_id);
create index notification_submission on public.notification(submission_id);
alter table public.notification enable row level security;
revoke all on public.notification from public, anon, authenticated;
grant select on public.notification to authenticated;
grant select, insert, update, delete on public.notification to service_role;
create policy notification_recipient_select on public.notification
  for select to authenticated using (recipient_id = (select auth.uid()));

-- Retain delivery evidence after an attempt (and its public notification) is deleted.
create table writewise_internal.notification_delivery (
  dedupe_key text primary key,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.activity(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index notification_delivery_recipient on writewise_internal.notification_delivery(recipient_id);
create index notification_delivery_activity on writewise_internal.notification_delivery(activity_id);
create index notification_delivery_student on writewise_internal.notification_delivery(student_id);
alter table writewise_internal.notification_delivery enable row level security;
revoke all on writewise_internal.notification_delivery from public, anon, authenticated;
grant select, insert, update, delete on writewise_internal.notification_delivery to service_role;

create function writewise_internal.notification_epoch_us(value timestamptz)
returns text language sql immutable strict security invoker set search_path = '' as $$
  select trunc(extract(epoch from value) * 1000000)::text;
$$;

create function writewise_internal.put_notification(
  recipient uuid, event_type public.notification_type,
  work_activity uuid, work_student uuid, target_submission uuid, event_key text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare notice_id uuid;
begin
  if target_submission is not null and not exists (
    select 1 from public.submission s where s.id = target_submission
      and s.activity_id = work_activity and s.student_id = work_student
  ) then
    raise exception using errcode = '23514', message = 'Notification work mismatch';
  end if;
  insert into writewise_internal.notification_delivery(dedupe_key, recipient_id, activity_id, student_id)
  values (event_key, recipient, work_activity, work_student)
  on conflict (dedupe_key) do nothing;
  if not found then return null; end if;
  insert into public.notification(recipient_id, type, activity_id, student_id, submission_id, dedupe_key)
  values (recipient, event_type, work_activity, work_student, target_submission, event_key)
  returning id into notice_id;
  return notice_id;
end;
$$;

create function writewise_internal.notify_work_parents(
  event_type public.notification_type, work_activity uuid, work_student uuid,
  target_submission uuid, event_identity text
) returns integer language plpgsql security invoker set search_path = '' as $$
declare recipient uuid; inserted integer := 0;
begin
  for recipient in select distinct sp.parent_id from public.student_parent sp
    where sp.student_id = work_student order by sp.parent_id
  loop
    if writewise_internal.put_notification(recipient, event_type, work_activity, work_student,
      target_submission, event_type::text || ':' || work_activity::text || ':' || work_student::text
        || ':' || recipient::text || ':' || event_identity) is not null then
      inserted := inserted + 1;
    end if;
  end loop;
  return inserted;
end;
$$;

revoke all on function writewise_internal.notification_epoch_us(timestamptz) from public,anon,authenticated;
revoke all on function writewise_internal.put_notification(uuid,public.notification_type,uuid,uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function writewise_internal.notify_work_parents(public.notification_type,uuid,uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function writewise_internal.notification_epoch_us(timestamptz) to service_role;
grant execute on function writewise_internal.put_notification(uuid,public.notification_type,uuid,uuid,uuid,text)
  to service_role;
grant execute on function writewise_internal.notify_work_parents(public.notification_type,uuid,uuid,uuid,text)
  to service_role;
