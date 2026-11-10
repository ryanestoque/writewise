-- Empty-legacy cutover: never guess which worksheet an activity-level message meant.
lock table public.private_comment, public.notification in access exclusive mode;
do $$
begin
  if exists(select 1 from public.private_comment)
     or exists(select 1 from public.notification where type='comment_posted') then
    raise exception using errcode='55000',
      message='Submission comment cutover requires empty legacy conversations';
  end if;
end;
$$;

drop policy comment_participant_select on public.private_comment;
drop policy comment_history_owner_work_select on public.student_work;
drop policy "parent reads assigned or historical child activities" on public.activity;
create policy "parent reads assigned or historical child activities" on public.activity
  for select to authenticated using (
    exists(select 1 from public.student_parent sp where sp.parent_id=(select auth.uid())
      and public.is_assigned(activity.id,sp.student_id))
    or exists(select 1 from public.submission s where s.activity_id=activity.id
      and public.is_parent_of_student(s.student_id))
    or writewise_internal.has_grade_activity_history(activity.id)
  );

drop function public.read_private_comment_thread(uuid,uuid,jsonb,integer);
drop function public.list_private_comment_threads(uuid,uuid,jsonb,integer);
drop function public.post_private_comment(uuid,uuid,uuid,text);
drop function public.set_comment_thread_lock(uuid,uuid,uuid,boolean);
drop function public.delete_private_comment(uuid,uuid);
drop function writewise_internal.can_read_comment_work(uuid,uuid);
drop function writewise_internal.has_comment_work_history(uuid,uuid);
drop function writewise_internal.has_comment_activity_history(uuid);
drop function writewise_internal.comment_write_context(uuid,uuid,uuid);
drop function writewise_internal.put_comment_notification(uuid,uuid,uuid,uuid,integer,timestamptz);

create table public.submission_comment_thread (
  submission_id uuid primary key references public.submission(id) on delete cascade,
  comments_locked boolean not null default false,
  comment_version integer not null default 0 check (comment_version>=0)
);
alter table public.submission_comment_thread enable row level security;
revoke all on public.submission_comment_thread from public,anon,authenticated;
grant select on public.submission_comment_thread to authenticated;
grant select,insert,update,delete on public.submission_comment_thread to service_role;

alter table public.private_comment
  drop constraint private_comment_activity_id_student_id_fkey,
  drop constraint private_comment_activity_id_student_id_comment_version_key;
drop index public.private_comment_feed;
drop index public.private_comment_student;
alter table public.private_comment drop column activity_id, drop column student_id;
alter table public.private_comment add column submission_id uuid not null
  references public.submission_comment_thread(submission_id) on delete cascade;
alter table public.private_comment add unique (submission_id,comment_version);
create index private_comment_feed on public.private_comment
  (submission_id,created_at desc,id desc);
alter table public.student_work drop column comments_locked, drop column comment_version;

-- Minimal source context preserves owning-teacher comment history without granting
-- worksheet/profile/score access after a roster change. No caller-supplied actor.
create function writewise_internal.submission_comment_context(target_submission_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'submission_id',s.id,'activity_id',s.activity_id,'student_id',s.student_id,
    'submitted_at',s.created_at,'submission_status',s.status,'activity_owner_id',a.created_by,
    'assigned',public.is_assigned(s.activity_id,s.student_id),'is_archived',a.is_archived
  ) from public.submission s join public.activity a on a.id=s.activity_id
  where s.id=target_submission_id and (select auth.uid()) is not null
    and (a.created_by=(select auth.uid()) or exists (
      select 1 from public.student_parent sp where sp.student_id=s.student_id
        and sp.parent_id=(select auth.uid())
    ));
$$;
revoke all on function writewise_internal.submission_comment_context(uuid)
  from public,anon,authenticated;
grant execute on function writewise_internal.submission_comment_context(uuid)
  to authenticated,service_role;

create policy submission_comment_thread_participant_select on public.submission_comment_thread
  for select to authenticated using (
    writewise_internal.submission_comment_context(submission_id) is not null
  );
create policy comment_participant_select on public.private_comment
  for select to authenticated using (
    writewise_internal.submission_comment_context(submission_id) is not null
  );
