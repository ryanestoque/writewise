-- Ordinary callers retain their two-argument interface and first read timestamp.
create or replace function public.mark_notification_read(actor_id uuid,target_notification_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.notification;
begin
  select * into receipt from public.notification n
    where n.id=target_notification_id and n.recipient_id=actor_id for update;
  if not found then
    raise exception using errcode='WW404',message='Notification not found';
  end if;
  if receipt.type='comment_posted' then
    raise exception using errcode='WW422',message='Comment version required';
  end if;
  update public.notification set read_at=coalesce(read_at,statement_timestamp())
    where id=receipt.id returning * into receipt;
  return jsonb_build_object('id',receipt.id,'read_at',receipt.read_at);
end;
$$;

create function public.mark_comment_notification_read(
  actor_id uuid,target_notification_id uuid,expected_comment_version integer
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.notification;
begin
  select * into receipt from public.notification n where n.id=target_notification_id
    and n.recipient_id=actor_id and n.type='comment_posted' for update;
  if not found then
    raise exception using errcode='WW404',message='Notification not found';
  end if;
  if expected_comment_version is null or expected_comment_version<=0 then
    raise exception using errcode='WW422',message='Comment version required';
  end if;
  if receipt.comment_version<>expected_comment_version then
    raise exception using errcode='WW442',message='New comments arrived';
  end if;
  update public.notification set read_at=coalesce(read_at,statement_timestamp())
    where id=receipt.id returning * into receipt;
  return jsonb_build_object('id',receipt.id,'read_at',receipt.read_at);
end;
$$;

-- Materialize versions before waiting for a writer; EvalPlanQual must compare
-- the current row with this immutable snapshot, never acknowledge its successor.
create or replace function public.mark_all_notifications_read(actor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cutoff timestamptz:=statement_timestamp(); changed integer;
begin
  with snapshot as materialized (
    select n.id,n.comment_version from public.notification n
      where n.recipient_id=actor_id and n.read_at is null and n.created_at<=cutoff
  ), updated as (
    update public.notification n set read_at=cutoff from snapshot s
      where n.id=s.id and n.recipient_id=actor_id and n.read_at is null
        and n.comment_version is not distinct from s.comment_version
      returning n.id
  ) select count(*) into changed from updated;
  return jsonb_build_object('updated_count',changed,'read_at',cutoff);
end;
$$;

revoke all on function public.mark_notification_read(uuid,uuid) from public,anon,authenticated;
revoke all on function public.mark_comment_notification_read(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.mark_all_notifications_read(uuid) from public,anon,authenticated;
grant execute on function public.mark_notification_read(uuid,uuid) to service_role;
grant execute on function public.mark_comment_notification_read(uuid,uuid,integer) to service_role;
grant execute on function public.mark_all_notifications_read(uuid) to service_role;
