-- Text-only student-work history; no scores, submissions or emails are created.
alter table public.student_work
  add column comments_locked boolean not null default false,
  add column comment_version integer not null default 0 check (comment_version >= 0);

create table public.private_comment (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  student_id uuid not null,
  author_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('teacher','parent')),
  body text,
  deleted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  comment_version integer not null check (comment_version > 0),
  foreign key (activity_id,student_id)
    references public.student_work(activity_id,student_id) on delete cascade,
  unique (activity_id,student_id,comment_version),
  constraint comment_body_deleted_shape check ((body is null) = (deleted_at is not null)),
  constraint comment_live_body check (
    body is null or (char_length(body) between 1 and 1000 and btrim(body) <> '')
  )
);
create index private_comment_feed on public.private_comment
  (activity_id,student_id,created_at desc,id desc);
create index private_comment_student on public.private_comment(student_id,activity_id);
create index private_comment_author on public.private_comment(author_id);

alter table public.private_comment enable row level security;
revoke all on public.private_comment from public,anon,authenticated;
grant select on public.private_comment to authenticated;
grant select,insert,update,delete on public.private_comment to service_role;

alter table public.notification add column comment_version integer;
alter table public.notification add constraint notification_comment_version_kind check (
  (type='comment_posted' and comment_version is not null and comment_version>0)
  or (type<>'comment_posted' and comment_version is null)
);
create unique index notification_comment_unread_uniq
  on public.notification(recipient_id,activity_id,student_id)
  where type='comment_posted' and read_at is null;

-- These two small definer predicates avoid activity/comment policy recursion.
-- They expose only the caller's authorized history, never text or membership lists.
create function writewise_internal.has_comment_work_history(work_activity uuid,work_student uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.private_comment c join public.activity a on a.id=c.activity_id
    where c.activity_id=work_activity and c.student_id=work_student and (
      a.created_by=(select auth.uid()) or exists (
        select 1 from public.student_parent sp where sp.student_id=work_student
          and sp.parent_id=(select auth.uid())
      )
    )
  );
$$;

create function writewise_internal.has_comment_activity_history(work_activity uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.private_comment c join public.activity a on a.id=c.activity_id
    where c.activity_id=work_activity and (
      a.created_by=(select auth.uid()) or exists (
        select 1 from public.student_parent sp where sp.student_id=c.student_id
          and sp.parent_id=(select auth.uid())
      )
    )
  );
$$;

revoke all on function writewise_internal.has_comment_work_history(uuid,uuid)
  from public,anon,authenticated;
revoke all on function writewise_internal.has_comment_activity_history(uuid)
  from public,anon,authenticated;
grant execute on function writewise_internal.has_comment_work_history(uuid,uuid)
  to authenticated,service_role;
grant execute on function writewise_internal.has_comment_activity_history(uuid)
  to authenticated,service_role;

create policy comment_participant_select on public.private_comment
  for select to authenticated using (
    public.is_parent_of_student(student_id)
    or exists(select 1 from public.activity a
      where a.id=activity_id and a.created_by=(select auth.uid()))
  );

-- Existing comment-only work remains discoverable after its current assignment ends.
drop policy "parent reads assigned or historical child activities" on public.activity;
create policy "parent reads assigned or historical child activities" on public.activity
  for select to authenticated using (
    exists(select 1 from public.student_parent sp where sp.parent_id=(select auth.uid())
      and public.is_assigned(activity.id,sp.student_id))
    or exists(select 1 from public.submission s where s.activity_id=activity.id
      and public.is_parent_of_student(s.student_id))
    or writewise_internal.has_grade_activity_history(activity.id)
    or writewise_internal.has_comment_activity_history(activity.id)
  );

-- Only retained non-score work metadata is added for a former roster's activity owner.
create policy comment_history_owner_work_select on public.student_work
  for select to authenticated using (
    exists(select 1 from public.activity a where a.id=activity_id
      and a.created_by=(select auth.uid()))
    and writewise_internal.has_comment_work_history(activity_id,student_id)
  );

create function writewise_internal.can_read_comment_work(work_activity uuid,work_student uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.activity a where a.id=work_activity
    and (a.created_by=(select auth.uid()) or public.is_parent_of_student(work_student))
    and (
      public.is_assigned(a.id,work_student)
      or writewise_internal.has_comment_work_history(a.id,work_student)
      or exists(select 1 from public.submission s
        where s.activity_id=a.id and s.student_id=work_student)
      or writewise_internal.has_grade_work_history(a.id,work_student)
    )
  );
$$;
revoke all on function writewise_internal.can_read_comment_work(uuid,uuid)
  from public,anon,authenticated;
grant execute on function writewise_internal.can_read_comment_work(uuid,uuid)
  to authenticated,service_role;
