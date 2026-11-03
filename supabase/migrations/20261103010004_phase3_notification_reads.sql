-- FastAPI supplies verified identity; browser execution is expressly denied.
create function public.mark_notification_read(actor_id uuid, target_notification_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare receipt public.notification;
begin
  update public.notification n set read_at = coalesce(n.read_at, statement_timestamp())
    where n.id = target_notification_id and n.recipient_id = actor_id
    returning n.* into receipt;
  if not found then raise exception using errcode = 'WW404', message = 'Notification not found'; end if;
  return jsonb_build_object('id', receipt.id, 'read_at', receipt.read_at);
end;
$$;

create function public.mark_all_notifications_read(actor_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare cutoff timestamptz := statement_timestamp(); changed integer;
begin
  with updated as (
    update public.notification n set read_at = cutoff
    where n.recipient_id = actor_id and n.read_at is null and n.created_at <= cutoff
    returning n.id
  ) select count(*) into changed from updated;
  return jsonb_build_object('updated_count', changed, 'read_at', cutoff);
end;
$$;
revoke all on function public.mark_notification_read(uuid,uuid) from public,anon,authenticated;
revoke all on function public.mark_all_notifications_read(uuid) from public,anon,authenticated;
grant execute on function public.mark_notification_read(uuid,uuid) to service_role;
grant execute on function public.mark_all_notifications_read(uuid) to service_role;
