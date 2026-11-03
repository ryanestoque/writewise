-- Canonical email is read narrowly, without opening Auth tables to application roles.
create function writewise_internal.email_recipient_address(recipient uuid, as_of timestamptz)
returns text language sql stable security definer set search_path = '' as $$
  select u.email from auth.users u
  where u.id = recipient and u.email_confirmed_at is not null
    and nullif(btrim(u.email), '') is not null and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= as_of);
$$;

create function writewise_internal.email_eligibility(target_outbox_id uuid, as_of timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  context record;
  target_return public.submission;
  check_time timestamptz := coalesce(as_of, clock_timestamp());
begin
  -- One fresh statement captures preference, relationships and Auth state together.
  select n.type, n.recipient_id, n.activity_id, n.student_id, n.submission_id,
    q.due_at as queued_due, a.is_archived,
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

create function writewise_internal.prepare_email_delivery_at(
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
  -- Match coursework lock order. No outbox lock is taken before the activity lock.
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
      claim_token = null, lease_expires_at = null where q.id = target_outbox_id;
  end if;
  return eligibility;
end;
$$;

create function public.prepare_email_delivery(target_outbox_id uuid, expected_claim_token uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select writewise_internal.prepare_email_delivery_at(target_outbox_id,expected_claim_token,null);
$$;

revoke all on function writewise_internal.email_recipient_address(uuid,timestamptz)
  from public,anon,authenticated;
revoke all on function writewise_internal.email_eligibility(uuid,timestamptz)
  from public,anon,authenticated;
revoke all on function writewise_internal.prepare_email_delivery_at(uuid,uuid,timestamptz)
  from public,anon,authenticated;
revoke all on function public.prepare_email_delivery(uuid,uuid) from public,anon,authenticated;
grant execute on function writewise_internal.email_recipient_address(uuid,timestamptz) to service_role;
grant execute on function writewise_internal.email_eligibility(uuid,timestamptz) to service_role;
grant execute on function writewise_internal.prepare_email_delivery_at(uuid,uuid,timestamptz)
  to service_role;
grant execute on function public.prepare_email_delivery(uuid,uuid) to service_role;
