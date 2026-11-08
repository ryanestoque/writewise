-- Delivery is optional; in-app events and queue insertion commit together.
alter table public.teacher add column email_notifications boolean not null default true;
alter table public.parent add column email_notifications boolean not null default true;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notification(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed','skipped')),
  due_at timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  lease_expires_at timestamptz,
  first_attempt_at timestamptz,
  payload_sha256 text check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  provider_message_id text check (char_length(provider_message_id) between 1 and 128),
  last_error text check (last_error in (
    'preference_off','recipient_unavailable','relationship_revoked','activity_archived',
    'event_obsolete','deadline_changed','payload_changed','provider_timeout',
    'provider_unavailable','provider_throttled','provider_rejected','provider_configuration',
    'idempotency_conflict','delivery_unknown','retry_window_expired'
  )),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint email_outbox_lease_state check (
    (status = 'processing' and claim_token is not null and lease_expires_at is not null)
    or (status <> 'processing' and claim_token is null and lease_expires_at is null)
  ),
  constraint email_outbox_attempt_state check (
    (attempts = 0 and first_attempt_at is null and payload_sha256 is null)
    or (attempts > 0 and first_attempt_at is not null and payload_sha256 is not null)
  ),
  constraint email_outbox_sent_state check (
    (status = 'sent' and sent_at is not null and provider_message_id is not null
      and attempts > 0 and last_error is null)
    or (status <> 'sent' and sent_at is null and provider_message_id is null)
  ),
  constraint email_outbox_terminal_error check (
    status not in ('failed','skipped') or last_error is not null
  )
);
create index email_outbox_ready on public.email_outbox(next_attempt_at, created_at, id)
  where status = 'pending';
create index email_outbox_expired on public.email_outbox(lease_expires_at, id)
  where status = 'processing';
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.email_outbox to service_role;

-- Preserve the six-argument helper and every pre-existing event identity.
-- There is deliberately no historical backfill or network operation here.
create or replace function writewise_internal.put_notification(
  recipient uuid, event_type public.notification_type,
  work_activity uuid, work_student uuid, target_submission uuid, event_key text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  notice_id uuid;
  event_due_at timestamptz;
  expected_key text;
  email_enabled boolean;
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

  if event_type in ('due_soon','submission_returned') then
    select p.email_notifications into email_enabled from public.parent p where p.id = recipient;
    if not found then
      raise exception using errcode = '23514', message = 'Email recipient profile unavailable';
    end if;
    if event_type = 'due_soon' then
      -- The sweep holds the activity lock; work mutations use that same lock first.
      select coalesce(w.due_at_override, a.due_at) into event_due_at
      from public.activity a left join public.student_work w
        on w.activity_id = a.id and w.student_id = work_student
      where a.id = work_activity;
      expected_key := 'due_soon:' || work_activity::text || ':' || work_student::text
        || ':' || recipient::text || ':'
        || writewise_internal.notification_epoch_us(event_due_at);
      if event_due_at is null or event_key is distinct from expected_key then
        raise exception using errcode = '23514', message = 'Email event deadline mismatch';
      end if;
    end if;
    insert into public.email_outbox(notification_id, status, due_at, last_error)
    values (
      notice_id, case when email_enabled then 'pending' else 'skipped' end,
      event_due_at, case when email_enabled then null else 'preference_off' end
    );
  end if;
  return notice_id;
end;
$$;
revoke all on function writewise_internal.put_notification(
  uuid,public.notification_type,uuid,uuid,uuid,text
) from public,anon,authenticated;
grant execute on function writewise_internal.put_notification(
  uuid,public.notification_type,uuid,uuid,uuid,text
) to service_role;
