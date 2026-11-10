-- Shared cursor validation returns only fixed messages, never provider input.
begin;
create function writewise_internal.submission_comment_cursor(value jsonb,window_kind text)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare fields text[]; time_field text; stamp timestamptz; identity uuid;
begin
  if value is null then return null; end if;
  if window_kind='feed' then fields:=array['event_at','kind','id']; time_field:='event_at';
  elsif window_kind='history' then fields:=array['last_comment_at','submission_id']; time_field:='last_comment_at';
  elsif window_kind='attempts' then fields:=array['submitted_at','submission_id']; time_field:='submitted_at';
  else raise exception using errcode='WW422',message='Invalid conversation window'; end if;
  if jsonb_typeof(value)<>'object' or not (value ?& fields) or value-fields<>'{}'::jsonb
    or jsonb_typeof(value->time_field)<>'string'
    or jsonb_typeof(value->case when window_kind='feed' then 'id' else 'submission_id' end)<>'string'
    or (window_kind='feed' and (jsonb_typeof(value->'kind')<>'string'
      or value->>'kind' not in ('comment','return'))) then
    raise exception using errcode='WW422',message='Invalid conversation window';
  end if;
  begin
    stamp:=(value->>time_field)::timestamptz;
    identity:=(value->>case when window_kind='feed' then 'id' else 'submission_id' end)::uuid;
    if not isfinite(stamp) then
      raise exception using errcode='WW422',message='Invalid conversation window';
    end if;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise exception using errcode='WW422',message='Invalid conversation window';
  end;
  return value;
end;
$$;
revoke all on function writewise_internal.submission_comment_cursor(jsonb,text) from public,anon,authenticated;
grant execute on function writewise_internal.submission_comment_cursor(jsonb,text) to authenticated,service_role;

create function public.read_submission_comment_thread(
  target_submission_id uuid,before_cursor jsonb default null,page_size integer default 50
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare context jsonb; checked jsonb; result jsonb; cursor_time timestamptz; cursor_id uuid; cursor_kind text;
begin
  if page_size is null or page_size not between 1 and 100 then
    raise exception using errcode='WW422',message='Invalid conversation window';
  end if;
  checked:=writewise_internal.submission_comment_cursor(before_cursor,'feed');
  cursor_time:=(checked->>'event_at')::timestamptz;
  cursor_id:=(checked->>'id')::uuid;
  cursor_kind:=checked->>'kind';
  context:=writewise_internal.submission_comment_context(target_submission_id);
  if context is null then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  with state as (
    select coalesce((select t.comments_locked from public.submission_comment_thread t
      where t.submission_id=target_submission_id),false) locked
  ), events as (
    select c.created_at event_at,'comment'::text kind,c.id,c.comment_version,
      jsonb_build_object('kind','comment','id',c.id,'event_at',c.created_at,
        'author_role',c.author_role,'is_mine',coalesce(c.author_id=(select auth.uid()),false),
        'body',c.body,'deleted_at',c.deleted_at,'comment_version',c.comment_version) entry
    from public.private_comment c where c.submission_id=target_submission_id
    union all
    select s.returned_at,'return',s.id,null::integer,
      jsonb_build_object('kind','return','id',s.id,'event_at',s.returned_at,
        'return_reason',s.return_reason,'return_note',s.return_note)
    from public.submission s where s.id=target_submission_id
      and s.status='returned' and s.returned_at is not null
  ), paged as materialized (
    select * from events where checked is null or
      (event_at,kind,id)<(cursor_time,cursor_kind,cursor_id)
    order by event_at desc,kind desc,id desc limit page_size+1
  ), shown as materialized (
    select * from paged order by event_at desc,kind desc,id desc limit page_size
  )
  select (context-'activity_owner_id') || jsonb_build_object(
    'activity_title',coalesce((select a.title from public.activity a
      where a.id=(context->>'activity_id')::uuid),'Activity'),
    'actor_role',case when (context->>'activity_owner_id')::uuid=(select auth.uid()) then 'teacher' else 'parent' end,
    'comments_locked',state.locked,
    'can_post',(context->>'assigned')::boolean and not (context->>'is_archived')::boolean and not state.locked,
    'can_lock',(context->>'activity_owner_id')::uuid=(select auth.uid()),
    'read_only_reasons',to_jsonb(array_remove(array[
      case when not (context->>'assigned')::boolean then 'unassigned' end,
      case when (context->>'is_archived')::boolean then 'archived' end,
      case when state.locked then 'locked' end],null)),
    'entries',coalesce((select jsonb_agg(entry order by event_at desc,kind desc,id desc) from shown),'[]'::jsonb),
    'next_cursor',case when (select count(*) from paged)>page_size then
      (select jsonb_build_object('event_at',event_at,'kind',kind,'id',id) from shown
       order by event_at,kind,id limit 1) else null end,
    'seen_comment_version',(select max(comment_version) from shown),
    'unread_notice',(select jsonb_build_object('id',n.id,'comment_version',n.comment_version)
      from public.notification n where n.recipient_id=(select auth.uid())
        and n.submission_id=target_submission_id and n.type='comment_posted' and n.read_at is null)
  ) into result from state;
  return result;
end;
$$;

-- Enumerate only exact-pair source metadata. This does not expose worksheet rows.
create function writewise_internal.submission_comment_candidates(target_activity_id uuid,target_student_id uuid)
returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.activity a where a.id=target_activity_id
      and (a.created_by=(select auth.uid()) or exists (
        select 1 from public.student_parent sp where sp.student_id=target_student_id
          and sp.parent_id=(select auth.uid())))
      and (public.is_assigned(a.id,target_student_id) or exists (
        select 1 from public.submission s where s.activity_id=a.id and s.student_id=target_student_id))
  ) then raise exception using errcode='WW404',message='Conversation not found'; end if;
  return query select jsonb_build_object(
    'submission_id',s.id,'activity_id',s.activity_id,'student_id',s.student_id,
    'submitted_at',s.created_at,'submission_status',s.status,'activity_owner_id',a.created_by,
    'assigned',public.is_assigned(s.activity_id,s.student_id),'is_archived',a.is_archived
  ) from public.submission s join public.activity a on a.id=s.activity_id
  where s.activity_id=target_activity_id and s.student_id=target_student_id;
end;
$$;

create function public.list_submission_comment_attempts(
  target_activity_id uuid,target_student_id uuid,before_cursor jsonb default null,page_size integer default 50
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare checked jsonb; result jsonb; cursor_time timestamptz; cursor_id uuid;
begin
  if page_size is null or page_size not between 1 and 100 then
    raise exception using errcode='WW422',message='Invalid conversation window';
  end if;
  checked:=writewise_internal.submission_comment_cursor(before_cursor,'attempts');
  cursor_time:=(checked->>'submitted_at')::timestamptz;
  cursor_id:=(checked->>'submission_id')::uuid;
  with candidates as materialized (
    select value meta,(value->>'submission_id')::uuid id,(value->>'submitted_at')::timestamptz event_at
    from writewise_internal.submission_comment_candidates(target_activity_id,target_student_id) as candidates(value)
  ), paged as materialized (
    select * from candidates where checked is null or (event_at,id)<(cursor_time,cursor_id)
    order by event_at desc,id desc limit page_size+1
  ), shown as materialized (
    select * from paged order by event_at desc,id desc limit page_size
  )
  select jsonb_build_object('rows',coalesce((select jsonb_agg(
    (s.meta-array['activity_owner_id','assigned','is_archived']) || jsonb_build_object(
      'comments_locked',coalesce(t.comments_locked,false)) order by s.event_at desc,s.id desc)
    from shown s left join public.submission_comment_thread t on t.submission_id=s.id),'[]'::jsonb),
    'next_cursor',case when (select count(*) from paged)>page_size then
      (select jsonb_build_object('submitted_at',event_at,'submission_id',id) from shown
       order by event_at,id limit 1) else null end) into result;
  return result;
end;
$$;

create function public.list_submission_comment_threads(
  target_activity_id uuid default null,target_student_id uuid default null,
  before_cursor jsonb default null,page_size integer default 50
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare checked jsonb; result jsonb; cursor_time timestamptz; cursor_id uuid;
begin
  if num_nonnulls(target_activity_id,target_student_id)<>1 or page_size is null or page_size not between 1 and 100 then
    raise exception using errcode='WW422',message='Invalid conversation window';
  end if;
  checked:=writewise_internal.submission_comment_cursor(before_cursor,'history');
  cursor_time:=(checked->>'last_comment_at')::timestamptz;
  cursor_id:=(checked->>'submission_id')::uuid;
  if (select auth.uid()) is null or
    (target_activity_id is not null and not exists(select 1 from public.activity a
      where a.id=target_activity_id and a.created_by=(select auth.uid()))) or
    (target_student_id is not null and not public.is_parent_of_student(target_student_id)) then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  with history as materialized (
    select c.submission_id id,max(c.created_at) event_at from public.private_comment c group by c.submission_id
  ), sources as materialized (
    select h.*,writewise_internal.submission_comment_context(h.id) meta from history h
  ), scoped as (
    select * from sources where meta is not null
      and (target_activity_id is null or (meta->>'activity_id')::uuid=target_activity_id)
      and (target_student_id is null or (meta->>'student_id')::uuid=target_student_id)
  ), paged as materialized (
    select * from scoped where checked is null or (event_at,id)<(cursor_time,cursor_id)
    order by event_at desc,id desc limit page_size+1
  ), shown as materialized (
    select * from paged order by event_at desc,id desc limit page_size
  )
  select jsonb_build_object('rows',coalesce((select jsonb_agg(
    (s.meta-'activity_owner_id') || jsonb_build_object(
      'activity_title',coalesce((select a.title from public.activity a where a.id=(s.meta->>'activity_id')::uuid),'Activity'),
      'student_label',coalesce((select st.full_name from public.student st where st.id=(s.meta->>'student_id')::uuid),'Student'),
      'comments_locked',coalesce(t.comments_locked,false),'last_comment_at',s.event_at
    ) order by s.event_at desc,s.id desc)
    from shown s left join public.submission_comment_thread t on t.submission_id=s.id),'[]'::jsonb),
    'next_cursor',case when (select count(*) from paged)>page_size then
      (select jsonb_build_object('last_comment_at',event_at,'submission_id',id) from shown
       order by event_at,id limit 1) else null end) into result;
  return result;
end;
$$;

revoke all on function writewise_internal.submission_comment_candidates(uuid,uuid) from public,anon,authenticated;
revoke all on function public.read_submission_comment_thread(uuid,jsonb,integer) from public,anon,authenticated;
revoke all on function public.list_submission_comment_attempts(uuid,uuid,jsonb,integer) from public,anon,authenticated;
revoke all on function public.list_submission_comment_threads(uuid,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function writewise_internal.submission_comment_candidates(uuid,uuid) to authenticated,service_role;
grant execute on function public.read_submission_comment_thread(uuid,jsonb,integer) to authenticated,service_role;
grant execute on function public.list_submission_comment_attempts(uuid,uuid,jsonb,integer) to authenticated,service_role;
grant execute on function public.list_submission_comment_threads(uuid,uuid,jsonb,integer) to authenticated,service_role;
commit;
