-- Reject SQL NULL explicitly: NOT IN alone yields unknown and otherwise falls through.
-- Preserve the existing function signature and service-only grants.
create or replace function writewise_internal.finish_email_delivery_at(
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
  if delivery_outcome is null or delivery_outcome not in ('retry','failed')
    or provider_id is not null
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
