-- Activity/work/source order matches the existing authorized deletion transaction.
begin;
create function writewise_internal.lock_submission_comment_source(target_submission_id uuid)
returns public.submission language plpgsql volatile security invoker set search_path='' as $$
declare original public.submission; locked public.submission;
begin
  select * into original from public.submission where id=target_submission_id;
  if not found then raise exception using errcode='WW404',message='Conversation not found'; end if;
  perform 1 from public.activity where id=original.activity_id for update;
  perform writewise_internal.lock_work(original.activity_id,original.student_id);
  select * into locked from public.submission where id=target_submission_id for update;
  if not found or locked.activity_id is distinct from original.activity_id
      or locked.student_id is distinct from original.student_id then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  return locked;
end;
$$;

create function writewise_internal.submission_comment_write_context(actor_id uuid,target_submission_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare source public.submission; owner_id uuid; archived boolean; locked boolean; result jsonb;
begin
  select * into source from public.submission where id=target_submission_id;
  if not found or actor_id is null then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  select a.created_by,a.is_archived into owner_id,archived from public.activity a where a.id=source.activity_id;
  -- Link removal committed before this gate must be visible. Later removal waits
  -- until this post/deletion finishes; recipient selection uses this same gate.
  perform 1 from public.student_parent sp where sp.student_id=source.student_id
    order by sp.parent_id for key share;
  perform 1 from public.teacher_student ts where ts.student_id=source.student_id
    and ts.teacher_id=owner_id for key share;
  if owner_id is distinct from actor_id and not exists(
    select 1 from public.student_parent sp where sp.student_id=source.student_id and sp.parent_id=actor_id
  ) then raise exception using errcode='WW404',message='Conversation not found'; end if;
  select coalesce(t.comments_locked,false) into locked from public.submission_comment_thread t
    where t.submission_id=source.id;
  result:=jsonb_build_object(
    'submission_id',source.id,'activity_id',source.activity_id,'student_id',source.student_id,
    'author_role',case when owner_id=actor_id then 'teacher' else 'parent' end,
    'assigned',public.is_assigned(source.activity_id,source.student_id),
    'is_archived',archived,'comments_locked',coalesce(locked,false),
    'recipients',(select jsonb_agg(p.id order by p.id) from (
      select owner_id id union select sp.parent_id from public.student_parent sp where sp.student_id=source.student_id
    ) p)
  );
  return result;
end;
$$;

alter table public.notification drop constraint notification_submission_kind;
alter table public.notification add constraint notification_submission_kind check (
  (type in ('submission_returned','submission_rejected','resubmitted_after_return','comment_posted')
    and submission_id is not null)
  or type='score_released'
  or (type in ('activity_assigned','due_soon','activity_missing') and submission_id is null)
);
drop index public.notification_comment_unread_uniq;
create unique index notification_comment_unread_uniq
  on public.notification(recipient_id,submission_id) where type='comment_posted' and read_at is null;

create function writewise_internal.put_submission_comment_notification(
  recipient uuid,target_submission_id uuid,target_comment uuid,target_version integer,event_at timestamptz
) returns uuid language plpgsql security invoker set search_path='' as $$
declare source public.submission; event_key text; notice_id uuid;
begin
  select * into source from public.submission where id=target_submission_id;
  if not found or not exists(select 1 from public.private_comment c where c.id=target_comment
    and c.submission_id=target_submission_id and c.comment_version=target_version) then
    raise exception using errcode='WW422',message='Invalid conversation event';
  end if;
  event_key:='comment:'||source.id::text||':'||recipient::text||':'||target_comment::text;
  insert into writewise_internal.notification_delivery(dedupe_key,recipient_id,activity_id,student_id)
    values(event_key,recipient,source.activity_id,source.student_id) on conflict(dedupe_key) do nothing;
  if not found then return null; end if;
  insert into public.notification(
    recipient_id,type,activity_id,student_id,submission_id,dedupe_key,comment_version,created_at
  ) values(recipient,'comment_posted',source.activity_id,source.student_id,source.id,event_key,target_version,event_at)
  on conflict(recipient_id,submission_id) where type='comment_posted' and read_at is null
    do update set comment_version=excluded.comment_version,created_at=excluded.created_at
  returning id into notice_id;
  return notice_id;
end;
$$;

create function public.post_submission_comment(actor_id uuid,target_submission_id uuid,comment_body text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare source public.submission; context jsonb; clean text; version integer; posted public.private_comment; recipient uuid;
begin
  source:=writewise_internal.lock_submission_comment_source(target_submission_id);
  context:=writewise_internal.submission_comment_write_context(actor_id,target_submission_id);
  if not (context->>'assigned')::boolean then
    raise exception using errcode='WW412',message='Activity no longer assigned';
  end if;
  if (context->>'is_archived')::boolean then
    raise exception using errcode='WW441',message='Activity archived';
  end if;
  if (context->>'comments_locked')::boolean then
    raise exception using errcode='WW440',message='Conversation locked';
  end if;
  clean:=writewise_internal.normalize_comment_body(comment_body);
  insert into public.submission_comment_thread(submission_id) values(target_submission_id)
    on conflict(submission_id) do nothing;
  update public.submission_comment_thread set comment_version=comment_version+1
    where submission_id=target_submission_id returning comment_version into version;
  insert into public.private_comment(submission_id,author_id,author_role,body,comment_version,created_at)
    values(target_submission_id,actor_id,context->>'author_role',clean,version,clock_timestamp()) returning * into posted;
  for recipient in select value::uuid from jsonb_array_elements_text(context->'recipients') order by value::uuid loop
    if recipient<>actor_id then
      perform writewise_internal.put_submission_comment_notification(
        recipient,target_submission_id,posted.id,version,posted.created_at);
    end if;
  end loop;
  return jsonb_build_object('id',posted.id,'submission_id',source.id,'activity_id',source.activity_id,
    'student_id',source.student_id,'author_role',posted.author_role,'created_at',posted.created_at,'comment_version',version);
end;
$$;

create function public.set_submission_comment_lock(actor_id uuid,target_submission_id uuid,locked boolean)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare source public.submission; context jsonb;
begin
  source:=writewise_internal.lock_submission_comment_source(target_submission_id);
  context:=writewise_internal.submission_comment_write_context(actor_id,target_submission_id);
  if context->>'author_role'<>'teacher' then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  if locked is null then raise exception using errcode='WW422',message='Check the comment request'; end if;
  insert into public.submission_comment_thread(submission_id,comments_locked) values(target_submission_id,locked)
    on conflict(submission_id) do update set comments_locked=excluded.comments_locked;
  return jsonb_build_object('submission_id',source.id,'comments_locked',locked);
end;
$$;

create function public.delete_private_comment(actor_id uuid,target_comment_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare comment_row public.private_comment; source public.submission;
begin
  select * into comment_row from public.private_comment where id=target_comment_id;
  if not found or actor_id is null or comment_row.author_id is distinct from actor_id then
    raise exception using errcode='WW404',message='Conversation not found';
  end if;
  source:=writewise_internal.lock_submission_comment_source(comment_row.submission_id);
  perform writewise_internal.submission_comment_write_context(actor_id,source.id);
  select * into comment_row from public.private_comment where id=target_comment_id and author_id=actor_id for update;
  if not found then raise exception using errcode='WW404',message='Conversation not found'; end if;
  update public.private_comment set body=null,deleted_at=coalesce(deleted_at,clock_timestamp()) where id=target_comment_id;
  return jsonb_build_object('deleted',true);
end;
$$;

revoke all on function writewise_internal.lock_submission_comment_source(uuid) from public,anon,authenticated;
revoke all on function writewise_internal.submission_comment_write_context(uuid,uuid) from public,anon,authenticated;
revoke all on function writewise_internal.put_submission_comment_notification(uuid,uuid,uuid,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.post_submission_comment(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.set_submission_comment_lock(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.delete_private_comment(uuid,uuid) from public,anon,authenticated;
grant execute on function writewise_internal.lock_submission_comment_source(uuid) to service_role;
grant execute on function writewise_internal.submission_comment_write_context(uuid,uuid) to service_role;
grant execute on function writewise_internal.put_submission_comment_notification(uuid,uuid,uuid,integer,timestamptz) to service_role;
grant execute on function public.post_submission_comment(uuid,uuid,text) to service_role;
grant execute on function public.set_submission_comment_lock(uuid,uuid,boolean) to service_role;
grant execute on function public.delete_private_comment(uuid,uuid) to service_role;
commit;
