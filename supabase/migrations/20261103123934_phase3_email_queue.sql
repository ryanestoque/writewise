-- Capturing the reservation count at claim time distinguishes an unused retry
-- lease from a newly authorized send, without storing any payload or recipient.
alter table public.email_outbox add column claim_attempts integer;
update public.email_outbox set claim_attempts = attempts where status = 'processing';
alter table public.email_outbox add constraint email_outbox_claim_attempts check (
  (status = 'processing' and claim_attempts is not null and claim_attempts between 0 and 2
    and attempts between claim_attempts and claim_attempts + 1)
  or (status <> 'processing' and claim_attempts is null)
);

create function writewise_internal.claim_email_delivery_at(as_of timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  check_time timestamptz := coalesce(as_of, clock_timestamp());
  claimed public.email_outbox;
  event_kind public.notification_type;
begin
  with expired as (
    select q.id from public.email_outbox q
    where q.status = 'processing' and q.lease_expires_at <= check_time
    order by q.lease_expires_at, q.id for update skip locked limit 10
  )
  update public.email_outbox q set
    status = case when q.attempts >= 3
      or q.first_attempt_at + interval '1 hour' <= check_time then 'failed' else 'pending' end,
    last_error = case when q.attempts >= 3
      or q.first_attempt_at + interval '1 hour' <= check_time then 'delivery_unknown' else q.last_error end,
    next_attempt_at = check_time, claim_token = null, lease_expires_at = null, claim_attempts = null
  from expired e where q.id = e.id;

  with exhausted as (
    select q.id from public.email_outbox q
    where q.status = 'pending' and q.next_attempt_at <= check_time
      and (q.attempts >= 3 or q.first_attempt_at + interval '1 hour' <= check_time)
    order by q.next_attempt_at, q.created_at, q.id for update skip locked limit 10
  )
  update public.email_outbox q set status = 'failed',
    last_error = case when q.attempts >= 3 then 'delivery_unknown' else 'retry_window_expired' end,
    claim_token = null, lease_expires_at = null, claim_attempts = null
  from exhausted e where q.id = e.id;

  with candidate as (
    select q.id from public.email_outbox q
    where q.status = 'pending' and q.next_attempt_at <= check_time and q.attempts < 3
      and (q.first_attempt_at is null or q.first_attempt_at + interval '1 hour' > check_time)
    order by q.next_attempt_at, q.created_at, q.id for update skip locked limit 1
  )
  update public.email_outbox q set status = 'processing', claim_token = gen_random_uuid(),
    lease_expires_at = check_time + interval '2 minutes', claim_attempts = q.attempts
  from candidate c where q.id = c.id returning q.* into claimed;
  if not found then return null; end if;
  select n.type into event_kind from public.notification n where n.id = claimed.notification_id;
  return jsonb_build_object('outbox_id',claimed.id,'notification_id',claimed.notification_id,
    'event_type',event_kind,'claim_token',claimed.claim_token,
    'lease_expires_at',claimed.lease_expires_at,'attempts',claimed.attempts);
end;
$$;

-- The original preparation transaction now also clears the lease reservation marker.
create or replace function writewise_internal.prepare_email_delivery_at(
  target_outbox_id uuid, expected_claim_token uuid, as_of timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  work_activity uuid;
  queue_row public.email_outbox;
  check_time timestamptz;
  eligibility jsonb;
begin
  select n.activity_id into work_activity
  from public.email_outbox q join public.notification n on n.id = q.notification_id
  where q.id = target_outbox_id;
  if not found then return jsonb_build_object('state','lost'); end if;
  perform 1 from public.activity a where a.id = work_activity for update;
  if not found then return jsonb_build_object('state','lost'); end if;
  select * into queue_row from public.email_outbox q where q.id = target_outbox_id for update;
  check_time := coalesce(as_of, clock_timestamp());
  if not found or queue_row.status <> 'processing'
    or queue_row.claim_token is distinct from expected_claim_token
    or queue_row.lease_expires_at <= check_time then
    return jsonb_build_object('state','lost');
  end if;
  eligibility := writewise_internal.email_eligibility(target_outbox_id, check_time);
  if eligibility->>'state' = 'skipped' then
    update public.email_outbox q set status = 'skipped', last_error = eligibility->>'code',
      claim_token = null, lease_expires_at = null, claim_attempts = null where q.id = target_outbox_id;
  end if;
  return eligibility;
end;
$$;

create function writewise_internal.authorize_email_delivery_at(
  target_outbox_id uuid, expected_claim_token uuid, requested_recipient text,
  requested_digest text, as_of timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  work_activity uuid;
  queue_row public.email_outbox;
  check_time timestamptz;
  eligibility jsonb;
begin
  select n.activity_id into work_activity
  from public.email_outbox q join public.notification n on n.id = q.notification_id
  where q.id = target_outbox_id;
  if not found then return jsonb_build_object('state','lost'); end if;
  perform 1 from public.activity a where a.id = work_activity for update;
  if not found then return jsonb_build_object('state','lost'); end if;
  select * into queue_row from public.email_outbox q where q.id = target_outbox_id for update;
  check_time := coalesce(as_of, clock_timestamp());
  if not found or queue_row.status <> 'processing'
    or queue_row.claim_token is distinct from expected_claim_token
    or queue_row.lease_expires_at <= check_time
    or queue_row.attempts is distinct from queue_row.claim_attempts then
    return jsonb_build_object('state','lost');
  end if;
  if queue_row.attempts >= 3 or queue_row.first_attempt_at + interval '1 hour' <= check_time then
    update public.email_outbox q set status = 'failed',
      last_error = case when q.attempts >= 3 then 'delivery_unknown' else 'retry_window_expired' end,
      claim_token = null, lease_expires_at = null, claim_attempts = null where q.id = target_outbox_id;
    return jsonb_build_object('state','lost');
  end if;
  eligibility := writewise_internal.email_eligibility(target_outbox_id, check_time);
  if eligibility->>'state' = 'skipped' then
    update public.email_outbox q set status = 'skipped', last_error = eligibility->>'code',
      claim_token = null, lease_expires_at = null, claim_attempts = null where q.id = target_outbox_id;
    return eligibility;
  end if;
  if requested_digest is null or requested_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '23514', message = 'Invalid email payload fingerprint';
  end if;
  if requested_recipient is distinct from eligibility->>'recipient'
    or (queue_row.payload_sha256 is not null and queue_row.payload_sha256 <> requested_digest) then
    update public.email_outbox q set status = 'skipped', last_error = 'payload_changed',
      claim_token = null, lease_expires_at = null, claim_attempts = null where q.id = target_outbox_id;
    return jsonb_build_object('state','skipped','code','payload_changed');
  end if;
  update public.email_outbox q set attempts = q.attempts + 1,
    first_attempt_at = coalesce(q.first_attempt_at,check_time),
    payload_sha256 = coalesce(q.payload_sha256,requested_digest),
    claim_token = gen_random_uuid(), last_error = null
  where q.id = target_outbox_id returning q.* into queue_row;
  return jsonb_build_object('state','authorized','claim_token',queue_row.claim_token,
    'attempts',queue_row.attempts,'first_attempt_at',queue_row.first_attempt_at,
    'authorized_at',check_time);
end;
$$;

create function writewise_internal.finish_email_delivery_at(
  target_outbox_id uuid, expected_claim_token uuid, delivery_outcome text,
  provider_id text, error_code text, retry_at timestamptz, as_of timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  queue_row public.email_outbox;
  check_time timestamptz;
begin
  select * into queue_row from public.email_outbox q where q.id = target_outbox_id for update;
  check_time := coalesce(as_of, clock_timestamp());
  if not found or queue_row.status <> 'processing'
    or queue_row.claim_token is distinct from expected_claim_token
    or queue_row.lease_expires_at <= check_time then return false; end if;
  if delivery_outcome = 'released' then
    if queue_row.attempts is distinct from queue_row.claim_attempts then return false; end if;
    update public.email_outbox q set status = 'pending', next_attempt_at = check_time,
      claim_token = null, lease_expires_at = null, claim_attempts = null where q.id = target_outbox_id;
    return true;
  end if;
  if queue_row.attempts is distinct from queue_row.claim_attempts + 1 then return false; end if;
  if delivery_outcome = 'sent' then
    if provider_id is null or char_length(provider_id) not between 1 and 128
      or error_code is not null or retry_at is not null then
      raise exception using errcode = '23514', message = 'Invalid email acceptance outcome';
    end if;
    update public.email_outbox q set status = 'sent', provider_message_id = provider_id,
      sent_at = check_time, last_error = null,
      claim_token = null, lease_expires_at = null, claim_attempts = null where q.id = target_outbox_id;
    return true;
  end if;
  if delivery_outcome not in ('retry','failed') or provider_id is not null
    or error_code is null or error_code not in (
      'provider_timeout','provider_unavailable','provider_throttled','provider_rejected',
      'provider_configuration','idempotency_conflict','delivery_unknown','retry_window_expired'
    ) then
    raise exception using errcode = '23514', message = 'Invalid email failure outcome';
  end if;
  if delivery_outcome = 'retry' then
    if queue_row.attempts >= 3 or retry_at is null or retry_at <= check_time
      or retry_at >= queue_row.first_attempt_at + interval '1 hour'
      or error_code not in ('provider_timeout','provider_unavailable','provider_throttled') then
      raise exception using errcode = '23514', message = 'Invalid email retry outcome';
    end if;
    update public.email_outbox q set status = 'pending', next_attempt_at = retry_at,
      last_error = error_code, claim_token = null, lease_expires_at = null, claim_attempts = null
    where q.id = target_outbox_id;
  else
    if retry_at is not null then
      raise exception using errcode = '23514', message = 'Invalid email terminal outcome';
    end if;
    update public.email_outbox q set status = 'failed', last_error = error_code,
      claim_token = null, lease_expires_at = null, claim_attempts = null where q.id = target_outbox_id;
  end if;
  return true;
end;
$$;

create function public.claim_email_delivery()
returns jsonb language sql security invoker set search_path = '' as $$
  select writewise_internal.claim_email_delivery_at(null);
$$;
create function public.authorize_email_delivery(
  target_outbox_id uuid, expected_claim_token uuid, payload_recipient text, payload_sha256 text
) returns jsonb language sql security invoker set search_path = '' as $$
  select writewise_internal.authorize_email_delivery_at($1,$2,$3,$4,null);
$$;
create function public.finish_email_delivery(
  target_outbox_id uuid, expected_claim_token uuid, delivery_outcome text,
  provider_id text, error_code text, retry_at timestamptz
) returns boolean language sql security invoker set search_path = '' as $$
  select writewise_internal.finish_email_delivery_at($1,$2,$3,$4,$5,$6,null);
$$;

revoke all on function writewise_internal.claim_email_delivery_at(timestamptz)
  from public,anon,authenticated;
revoke all on function writewise_internal.authorize_email_delivery_at(uuid,uuid,text,text,timestamptz)
  from public,anon,authenticated;
revoke all on function writewise_internal.finish_email_delivery_at(uuid,uuid,text,text,text,timestamptz,timestamptz)
  from public,anon,authenticated;
revoke all on function public.claim_email_delivery() from public,anon,authenticated;
revoke all on function public.authorize_email_delivery(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.finish_email_delivery(uuid,uuid,text,text,text,timestamptz)
  from public,anon,authenticated;
grant execute on function writewise_internal.claim_email_delivery_at(timestamptz) to service_role;
grant execute on function writewise_internal.authorize_email_delivery_at(uuid,uuid,text,text,timestamptz)
  to service_role;
grant execute on function writewise_internal.finish_email_delivery_at(uuid,uuid,text,text,text,timestamptz,timestamptz)
  to service_role;
grant execute on function public.claim_email_delivery() to service_role;
grant execute on function public.authorize_email_delivery(uuid,uuid,text,text) to service_role;
grant execute on function public.finish_email_delivery(uuid,uuid,text,text,text,timestamptz) to service_role;
