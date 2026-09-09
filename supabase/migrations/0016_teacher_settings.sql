-- migration: 0016_teacher_settings.sql
-- Description: Add school_name column to teacher table, allow teachers to update own profile,
-- and extend handle_new_user trigger function to persist school_name from raw_user_meta_data.

-- 1. Add school_name to public.teacher
alter table public.teacher
  add column if not exists school_name text;

-- 2. Add update policy for teacher on own profile
create policy "teacher can update own profile"
  on public.teacher for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 3. Extend handle_new_user trigger function to persist school_name
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  user_name text;
  user_school text;
  is_confirmed boolean;
begin
  user_role := new.raw_user_meta_data ->> 'role';
  user_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
  user_school := new.raw_user_meta_data ->> 'school_name';
  is_confirmed := (new.confirmed_at is not null or new.email_confirmed_at is not null);

  if user_role = 'teacher' then
    insert into public.teacher (id, full_name, email, school_name)
    values (new.id, user_name, new.email, user_school)
    on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        school_name = coalesce(excluded.school_name, public.teacher.school_name);
  elsif user_role = 'parent' then
    insert into public.parent (id, full_name, email)
    values (new.id, user_name, new.email)
    on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;

    if new.raw_user_meta_data ->> 'student_id' is not null then
      insert into public.student_parent (student_id, parent_id)
      values ((new.raw_user_meta_data ->> 'student_id')::uuid, new.id)
      on conflict do nothing;

      -- Update student parent_status on link
      update public.student
      set parent_status = case when is_confirmed then 'active' else 'pending' end
      where id = (new.raw_user_meta_data ->> 'student_id')::uuid;
    end if;

    -- If parent is confirmed, ensure all linked students reflect 'active' status
    if is_confirmed then
      update public.student
      set parent_status = 'active'
      where id in (
        select student_id from public.student_parent where parent_id = new.id
      );
    end if;
  end if;

  return new;
end;
$$;
