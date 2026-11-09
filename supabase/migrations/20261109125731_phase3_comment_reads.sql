-- Caller-scoped snapshots. Reading an assigned empty thread never inserts work.
create function public.read_private_comment_thread(
  target_activity_id uuid,target_student_id uuid,
  before_cursor jsonb default null,page_size integer default 50
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; cursor_time timestamptz; cursor_id uuid; cursor_kind text;
begin
  if page_size is null or page_size not between 1 and 100 then
    raise exception using errcode='WW422',message='Invalid conversation window';
  end if;
  if before_cursor is not null then
    if jsonb_typeof(before_cursor)<>'object' then
      raise exception using errcode='WW422',message='Invalid conversation window';
    end if;
    if not (before_cursor ?& array['event_at','kind','id'])
      or before_cursor-array['event_at','kind','id']<>'{}'::jsonb
      or jsonb_typeof(before_cursor->'event_at')<>'string'
      or jsonb_typeof(before_cursor->'id')<>'string'
      or jsonb_typeof(before_cursor->'kind')<>'string'
      or before_cursor->>'kind' not in ('comment','return') then
      raise exception using errcode='WW422',message='Invalid conversation window';
    end if;
    begin
      cursor_time := (before_cursor->>'event_at')::timestamptz;
      cursor_id := (before_cursor->>'id')::uuid;
      cursor_kind := before_cursor->>'kind';
      if not isfinite(cursor_time) then
        raise exception using errcode='WW422',message='Invalid conversation window';
      end if;
    exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception using errcode='WW422',message='Invalid conversation window';
    end;
  end if;

  with scope as materialized (
    select a.title,a.created_by=(select auth.uid()) owner,a.is_archived,
      public.is_assigned(a.id,target_student_id) assigned,
      coalesce(w.comments_locked,false) comments_locked
    from public.activity a left join public.student_work w
      on w.activity_id=a.id and w.student_id=target_student_id
    where a.id=target_activity_id
      and writewise_internal.can_read_comment_work(a.id,target_student_id)
  ), events as (
    select c.created_at event_at,'comment'::text kind,c.id,c.comment_version,
      jsonb_build_object('kind','comment','id',c.id,'event_at',c.created_at,
        'author_role',c.author_role,'is_mine',coalesce(c.author_id=(select auth.uid()),false),
        'body',c.body,'deleted_at',c.deleted_at,'comment_version',c.comment_version) entry
    from public.private_comment c
    where c.activity_id=target_activity_id and c.student_id=target_student_id
      and exists(select 1 from scope)
    union all
    select s.returned_at,'return',s.id,null::integer,
      jsonb_build_object('kind','return','id',s.id,'event_at',s.returned_at,
        'return_reason',s.return_reason,'return_note',s.return_note)
    from public.submission s
    where s.activity_id=target_activity_id and s.student_id=target_student_id
      and s.status='returned' and s.returned_at is not null and exists(select 1 from scope)
  ), paged as materialized (
    select * from events where before_cursor is null or
      (event_at,kind,id)<(cursor_time,cursor_kind,cursor_id)
    order by event_at desc,kind desc,id desc limit page_size+1
  ), shown as materialized (
    select * from paged order by event_at desc,kind desc,id desc limit page_size
  )
  select jsonb_build_object(
    'activity_id',target_activity_id,'student_id',target_student_id,'activity_title',s.title,
    'actor_role',case when s.owner then 'teacher' else 'parent' end,
    'assigned',s.assigned,'is_archived',s.is_archived,'comments_locked',s.comments_locked,
    'can_post',s.assigned and not s.is_archived and not s.comments_locked,'can_lock',s.owner,
    'read_only_reasons',to_jsonb(array_remove(array[
      case when not s.assigned then 'unassigned' end,
      case when s.is_archived then 'archived' end,
      case when s.comments_locked then 'locked' end],null)),
    'entries',coalesce((select jsonb_agg(entry order by event_at desc,kind desc,id desc) from shown),'[]'::jsonb),
    'next_cursor',case when (select count(*) from paged)>page_size then
      (select jsonb_build_object('event_at',event_at,'kind',kind,'id',id) from shown
       order by event_at,kind,id limit 1) else null end,
    'seen_comment_version',(select max(comment_version) from shown),
    'unread_notice',(select jsonb_build_object('id',n.id,'comment_version',n.comment_version)
      from public.notification n where n.recipient_id=(select auth.uid())
        and n.activity_id=target_activity_id and n.student_id=target_student_id
        and n.type='comment_posted' and n.read_at is null)
  ) into result from scope s;
  if result is null then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  return result;
end;
$$;

create function public.list_private_comment_threads(
  target_activity_id uuid default null,target_student_id uuid default null,
  before_cursor jsonb default null,page_size integer default 50
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; cursor_time timestamptz; cursor_student uuid; cursor_activity uuid;
begin
  if num_nonnulls(target_activity_id,target_student_id)<>1
    or page_size is null or page_size not between 1 and 100 then
    raise exception using errcode='WW422',message='Invalid conversation window';
  end if;
  if before_cursor is not null then
    if jsonb_typeof(before_cursor)<>'object' then
      raise exception using errcode='WW422',message='Invalid conversation window';
    end if;
    if not (before_cursor ?& array['last_comment_at','student_id','activity_id'])
      or before_cursor-array['last_comment_at','student_id','activity_id']<>'{}'::jsonb
      or jsonb_typeof(before_cursor->'last_comment_at')<>'string'
      or jsonb_typeof(before_cursor->'student_id')<>'string'
      or jsonb_typeof(before_cursor->'activity_id')<>'string' then
      raise exception using errcode='WW422',message='Invalid conversation window';
    end if;
    begin
      cursor_time := (before_cursor->>'last_comment_at')::timestamptz;
      cursor_student := (before_cursor->>'student_id')::uuid;
      cursor_activity := (before_cursor->>'activity_id')::uuid;
      if not isfinite(cursor_time) then
        raise exception using errcode='WW422',message='Invalid conversation window';
      end if;
    exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception using errcode='WW422',message='Invalid conversation window';
    end;
  end if;

  with authorized as materialized (
    select 1 where (select auth.uid()) is not null and (
      (target_activity_id is not null and exists(select 1 from public.activity a
        where a.id=target_activity_id and a.created_by=(select auth.uid())))
      or (target_student_id is not null and public.is_parent_of_student(target_student_id))
    )
  ), pairs as (
    select c.activity_id,c.student_id,max(c.created_at) last_comment_at
    from public.private_comment c where exists(select 1 from authorized)
      and (target_activity_id is null or c.activity_id=target_activity_id)
      and (target_student_id is null or c.student_id=target_student_id)
    group by c.activity_id,c.student_id
  ), paged as materialized (
    select * from pairs where before_cursor is null or
      (last_comment_at,student_id,activity_id)<(cursor_time,cursor_student,cursor_activity)
    order by last_comment_at desc,student_id desc,activity_id desc limit page_size+1
  ), shown as materialized (
    select p.*,a.title activity_title,coalesce(s.full_name,'Student') student_label,
      public.is_assigned(p.activity_id,p.student_id) assigned,a.is_archived,
      coalesce(w.comments_locked,false) comments_locked
    from (select * from paged order by last_comment_at desc,student_id desc,activity_id desc
      limit page_size) p
    join public.activity a on a.id=p.activity_id
    left join public.student s on s.id=p.student_id
    left join public.student_work w on w.activity_id=p.activity_id and w.student_id=p.student_id
  )
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(s) order by last_comment_at desc,student_id desc,activity_id desc)
      from shown s),'[]'::jsonb),
    'next_cursor',case when (select count(*) from paged)>page_size then
      (select jsonb_build_object('last_comment_at',last_comment_at,'student_id',student_id,'activity_id',activity_id)
        from shown order by last_comment_at,student_id,activity_id limit 1) else null end
  ) into result from authorized;
  if result is null then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  return result;
end;
$$;

revoke all on function public.read_private_comment_thread(uuid,uuid,jsonb,integer) from public,anon,authenticated;
revoke all on function public.list_private_comment_threads(uuid,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.read_private_comment_thread(uuid,uuid,jsonb,integer) to authenticated,service_role;
grant execute on function public.list_private_comment_threads(uuid,uuid,jsonb,integer) to authenticated,service_role;

