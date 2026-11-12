-- Private text normalization mirrors Python str.strip(), preserving internal lines.
create function writewise_internal.normalize_comment_body(raw_body text)
returns text language plpgsql immutable security invoker set search_path='' as $$
declare clean text; whitespace text;
begin
  select string_agg(chr(cp),'') into whitespace from unnest(array[
    9,10,11,12,13,28,29,30,31,32,133,160,5760,8192,8193,8194,8195,8196,
    8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288
  ]) cp;
  clean := btrim(raw_body,whitespace);
  if clean is null or char_length(clean) not between 1 and 1000 then
    raise exception using errcode='WW422',message='Check the comment request';
  end if;
  return clean;
end;
$$;

-- VOLATILE: this gate takes a fresh snapshot after waiting for activity/work locks.
-- Membership changes after the gate do not retroactively cancel the transaction.
create function writewise_internal.comment_write_context(actor_id uuid,work_activity uuid,work_student uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare result jsonb;
begin
  with context as (
    select a.created_by,a.is_archived,w.comments_locked,
      public.is_assigned(a.id,work_student) assigned,
      exists(select 1 from public.student_parent sp
        where sp.student_id=work_student and sp.parent_id=actor_id) parent,
      exists(select 1 from public.private_comment c
        where c.activity_id=a.id and c.student_id=work_student) comment_history,
      exists(select 1 from public.teacher_student ts
        where ts.student_id=work_student and ts.teacher_id=a.created_by) roster,
      (exists(select 1 from public.submission s where s.activity_id=a.id and s.student_id=work_student)
       or exists(select 1 from public.student_work_grade g where g.activity_id=a.id and g.student_id=work_student)) work_history
    from public.activity a join public.student st on st.id=work_student
    join public.student_work w on w.activity_id=a.id and w.student_id=work_student
    where a.id=work_activity
  )
  select jsonb_build_object(
    'author_role',case when c.created_by=actor_id then 'teacher' else 'parent' end,
    'assigned',c.assigned,'is_archived',c.is_archived,'comments_locked',c.comments_locked,
    'recipients',(select jsonb_agg(p.id order by p.id) from (
      select c.created_by id union select sp.parent_id from public.student_parent sp
        where sp.student_id=work_student
    ) p)
  ) into result from context c
  where actor_id is not null and (c.created_by=actor_id or c.parent)
    and (c.assigned or c.comment_history or (c.work_history and (c.parent or c.roster)));
  if result is null then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  return result;
end;
$$;

create function writewise_internal.put_comment_notification(
  recipient uuid,work_activity uuid,work_student uuid,target_comment uuid,
  target_version integer,event_at timestamptz
) returns uuid language plpgsql security invoker set search_path='' as $$
declare event_key text; notice_id uuid;
begin
  event_key := 'comment:'||work_activity::text||':'||work_student::text||':'||
    recipient::text||':'||target_comment::text;
  insert into writewise_internal.notification_delivery(dedupe_key,recipient_id,activity_id,student_id)
    values(event_key,recipient,work_activity,work_student) on conflict(dedupe_key) do nothing;
  if not found then return null; end if;
  insert into public.notification(recipient_id,type,activity_id,student_id,dedupe_key,comment_version,created_at)
    values(recipient,'comment_posted',work_activity,work_student,event_key,target_version,event_at)
  on conflict(recipient_id,activity_id,student_id) where type='comment_posted' and read_at is null
    do update set comment_version=excluded.comment_version,created_at=excluded.created_at
    returning id into notice_id;
  return notice_id;
end;
$$;

create function public.post_private_comment(
  actor_id uuid,target_activity_id uuid,target_student_id uuid,comment_body text
) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare a public.activity; w public.student_work; c public.private_comment;
  context jsonb; recipient uuid; stamp timestamptz; clean text;
begin
  select * into a from public.activity where id=target_activity_id for update;
  if not found or not exists(select 1 from public.student where id=target_student_id) then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  w := writewise_internal.lock_work(target_activity_id,target_student_id);
  context := writewise_internal.comment_write_context(actor_id,target_activity_id,target_student_id);
  if not (context->>'assigned')::boolean then
    raise exception using errcode='WW412',message='Activity not assigned';
  end if;
  if (context->>'is_archived')::boolean then
    raise exception using errcode='WW441',message='Activity archived';
  end if;
  if (context->>'comments_locked')::boolean then
    raise exception using errcode='WW440',message='Conversation locked';
  end if;
  clean := writewise_internal.normalize_comment_body(comment_body);
  stamp := clock_timestamp();
  update public.student_work set comment_version=comment_version+1
    where activity_id=target_activity_id and student_id=target_student_id returning * into w;
  insert into public.private_comment(activity_id,student_id,author_id,author_role,body,comment_version,created_at)
    values(target_activity_id,target_student_id,actor_id,context->>'author_role',clean,w.comment_version,stamp)
    returning * into c;
  for recipient in select value::uuid from jsonb_array_elements_text(context->'recipients') order by value
  loop
    if recipient<>actor_id then
      perform writewise_internal.put_comment_notification(recipient,c.activity_id,c.student_id,c.id,c.comment_version,stamp);
    end if;
  end loop;
  return jsonb_build_object('id',c.id,'activity_id',c.activity_id,'student_id',c.student_id,
    'author_role',c.author_role,'created_at',c.created_at,'comment_version',c.comment_version);
end;
$$;

create function public.delete_private_comment(actor_id uuid,target_comment_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare work_activity uuid; work_student uuid; original_author uuid;
begin
  select c.activity_id,c.student_id,c.author_id into work_activity,work_student,original_author
    from public.private_comment c where c.id=target_comment_id;
  if not found or original_author is distinct from actor_id or actor_id is null then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  perform 1 from public.activity where id=work_activity for update;
  perform 1 from public.student_work where activity_id=work_activity and student_id=work_student for update;
  perform writewise_internal.comment_write_context(actor_id,work_activity,work_student);
  perform 1 from public.private_comment where id=target_comment_id and author_id=actor_id for update;
  if not found then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  update public.private_comment set body=null,deleted_at=coalesce(deleted_at,clock_timestamp())
    where id=target_comment_id;
  return jsonb_build_object('deleted',true);
end;
$$;

create function public.set_comment_thread_lock(
  actor_id uuid,target_activity_id uuid,target_student_id uuid,locked boolean
) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare a public.activity; context jsonb;
begin
  select * into a from public.activity where id=target_activity_id for update;
  if not found or a.created_by is distinct from actor_id or actor_id is null
    or not exists(select 1 from public.student where id=target_student_id) then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  perform writewise_internal.lock_work(target_activity_id,target_student_id);
  context := writewise_internal.comment_write_context(actor_id,target_activity_id,target_student_id);
  if context->>'author_role'<>'teacher' then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  if locked is null then
    raise exception using errcode='WW422',message='Check the comment request';
  end if;
  update public.student_work set comments_locked=locked
    where activity_id=target_activity_id and student_id=target_student_id;
  return jsonb_build_object('activity_id',target_activity_id,'student_id',target_student_id,'comments_locked',locked);
end;
$$;

revoke all on function writewise_internal.normalize_comment_body(text) from public,anon,authenticated;
revoke all on function writewise_internal.comment_write_context(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function writewise_internal.put_comment_notification(uuid,uuid,uuid,uuid,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.post_private_comment(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.delete_private_comment(uuid,uuid) from public,anon,authenticated;
revoke all on function public.set_comment_thread_lock(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function writewise_internal.normalize_comment_body(text) to service_role;
grant execute on function writewise_internal.comment_write_context(uuid,uuid,uuid) to service_role;
grant execute on function writewise_internal.put_comment_notification(uuid,uuid,uuid,uuid,integer,timestamptz) to service_role;
grant execute on function public.post_private_comment(uuid,uuid,uuid,text) to service_role;
grant execute on function public.delete_private_comment(uuid,uuid) to service_role;
grant execute on function public.set_comment_thread_lock(uuid,uuid,uuid,boolean) to service_role;
