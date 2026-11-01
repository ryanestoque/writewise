-- Phase 3, Slice 1: assignments and deadlines. No submission history is rewritten.
alter table public.activity
  add column title text,
  add column instructions text,
  add column due_at timestamptz,
  add column close_after_due boolean not null default false;
update public.activity set title = coalesce(nullif(left(btrim(target_text), 60), ''), 'Handwriting practice');
alter table public.activity
  alter column title set not null,
  add constraint activity_title_nonblank check (length(btrim(title)) > 0),
  add constraint activity_closure_requires_due check (not close_after_due or due_at is not null);

create table public.activity_assignment (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activity(id) on delete cascade,
  section_id uuid references public.section(id) on delete cascade,
  student_id uuid references public.student(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint activity_assignment_one_target check (num_nonnulls(section_id, student_id) = 1)
);
create unique index activity_assignment_section_unique
  on public.activity_assignment(activity_id, section_id) where section_id is not null;
create unique index activity_assignment_student_unique
  on public.activity_assignment(activity_id, student_id) where student_id is not null;
create index activity_assignment_section_lookup on public.activity_assignment(section_id, activity_id);
create index activity_assignment_student_lookup on public.activity_assignment(student_id, activity_id);

-- Preserve legacy take-home visibility, including students with null/foreign sections.
insert into public.activity_assignment(activity_id, section_id)
select a.id, sec.id from public.activity a join public.section sec on sec.teacher_id = a.created_by;
insert into public.activity_assignment(activity_id, student_id)
select a.id, ts.student_id
from public.activity a
join public.teacher_student ts on ts.teacher_id = a.created_by
join public.student s on s.id = ts.student_id
where not exists (
  select 1 from public.section sec where sec.id = s.section_id and sec.teacher_id = a.created_by
);

-- Definer lookup avoids activity/assignment policy recursion. Every caller is scoped
-- before looking up targets; arbitrary users cannot probe another family's assignments.
create function public.is_assigned(target_activity_id uuid, target_student_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.activity a
    join public.teacher_student ts on ts.teacher_id = a.created_by
    join public.student s on s.id = ts.student_id
    join public.activity_assignment aa on aa.activity_id = a.id
    where a.id = target_activity_id and s.id = target_student_id
      and (aa.student_id = s.id or (aa.section_id = s.section_id and exists (
        select 1 from public.section sec where sec.id = aa.section_id and sec.teacher_id = a.created_by
      )))
      and (
        (select auth.jwt() ->> 'role') = 'service_role'
        or a.created_by = (select auth.uid())
        or exists (select 1 from public.student_parent sp
                   where sp.student_id = s.id and sp.parent_id = (select auth.uid()))
      )
  );
$$;
revoke all on function public.is_assigned(uuid, uuid) from public, anon;
grant execute on function public.is_assigned(uuid, uuid) to authenticated, service_role;

alter table public.activity_assignment enable row level security;
revoke all on public.activity_assignment from anon, authenticated;
grant select on public.activity_assignment to authenticated;
grant select, insert, update, delete on public.activity_assignment to service_role;
create policy "teacher reads owned assignment targets"
  on public.activity_assignment for select to authenticated using (
    exists (select 1 from public.activity a
            where a.id = activity_id and a.created_by = (select auth.uid()))
  );
create policy "parent reads only own child targets"
  on public.activity_assignment for select to authenticated using (
    exists (
      select 1 from public.student_parent sp
      join public.student s on s.id = sp.student_id
      join public.activity a on a.id = activity_id
      join public.teacher_student ts on ts.student_id = s.id and ts.teacher_id = a.created_by
      where sp.parent_id = (select auth.uid())
        and (activity_assignment.student_id = s.id
             or activity_assignment.section_id = s.section_id)
        and public.is_assigned(activity_id, s.id)
    )
  );
drop policy "parent can view assigned take-home activities" on public.activity;
create policy "parent can view assigned child activities"
  on public.activity for select to authenticated using (
    exists (select 1 from public.student_parent sp
            where sp.parent_id = (select auth.uid()) and public.is_assigned(activity.id, sp.student_id))
  );

-- One transaction validates, updates fields and replaces targets. The invoker is
-- exclusively service_role; FastAPI also authorizes every write before this call.
create function public.update_assigned_activity(actor_id uuid, target_activity_id uuid, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  current_activity public.activity;
  target jsonb;
  chosen_section uuid;
  chosen_student uuid;
begin
  select * into current_activity from public.activity
    where id = target_activity_id and created_by = actor_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Activity not found';
  end if;

  if payload ? 'assignments' then
    if jsonb_typeof(payload -> 'assignments') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'Invalid assignment targets';
    end if;
    if jsonb_array_length(payload -> 'assignments') = 0 then
      raise exception using errcode = '22023', message = 'Assignment targets required';
    end if;
    for target in select value from jsonb_array_elements(payload -> 'assignments') loop
      begin
        chosen_section := (target ->> 'section_id')::uuid;
        chosen_student := (target ->> 'student_id')::uuid;
      exception when invalid_text_representation then
        raise exception using errcode = '22023', message = 'Invalid assignment target';
      end;
      if num_nonnulls(chosen_section, chosen_student) <> 1
        or (chosen_section is not null and not exists (
          select 1 from public.section where id = chosen_section and teacher_id = actor_id
        )) or (chosen_student is not null and not exists (
          select 1 from public.teacher_student where teacher_id = actor_id and student_id = chosen_student
        )) then
        raise exception using errcode = '22023', message = 'Invalid assignment target';
      end if;
    end loop;
  end if;

  update public.activity set
    title = case when payload ? 'title' then payload ->> 'title' else title end,
    target_text = case when payload ? 'target_text' then payload ->> 'target_text' else target_text end,
    instructions = case when payload ? 'instructions' then payload ->> 'instructions' else instructions end,
    is_take_home = case when payload ? 'is_take_home' then (payload ->> 'is_take_home')::boolean else is_take_home end,
    due_at = case when payload ? 'due_at' then (payload ->> 'due_at')::timestamptz else due_at end,
    close_after_due = case when payload ? 'close_after_due' then (payload ->> 'close_after_due')::boolean else close_after_due end
  where id = target_activity_id returning * into current_activity;

  if payload ? 'assignments' then
    delete from public.activity_assignment where activity_id = target_activity_id;
    insert into public.activity_assignment(activity_id, section_id, student_id)
    select distinct target_activity_id, (value ->> 'section_id')::uuid, (value ->> 'student_id')::uuid
    from jsonb_array_elements(payload -> 'assignments');
  end if;
  return to_jsonb(current_activity) || jsonb_build_object('assignments', coalesce((
    select jsonb_agg(jsonb_build_object('section_id', aa.section_id, 'student_id', aa.student_id)
                     order by aa.section_id, aa.student_id)
    from public.activity_assignment aa where aa.activity_id = target_activity_id
  ), '[]'::jsonb));
end;
$$;
revoke all on function public.update_assigned_activity(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_assigned_activity(uuid, uuid, jsonb) to service_role;

create function public.create_assigned_activity(actor_id uuid, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare new_id uuid;
begin
  if not exists (select 1 from public.teacher where id = actor_id) then
    raise exception using errcode = 'P0002', message = 'Teacher not found';
  end if;
  if not (payload ? 'assignments') then
    raise exception using errcode = '22023', message = 'Assignment targets required';
  end if;
  insert into public.activity(created_by, title, target_text)
  values (actor_id, payload ->> 'title', payload ->> 'target_text') returning id into new_id;
  -- A failure below rolls the inserted row back with the function call.
  return public.update_assigned_activity(actor_id, new_id, payload);
end;
$$;
revoke all on function public.create_assigned_activity(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_assigned_activity(uuid, jsonb) to service_role;
