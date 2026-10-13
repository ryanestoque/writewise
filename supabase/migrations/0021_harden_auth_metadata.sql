-- migration: 0021_harden_auth_metadata.sql
-- Description: Harden auth user metadata handling for public self-registration.
-- 1. Whitelist allowed roles ('teacher', 'parent') on user creation; default to 'teacher'.
-- 2. Strip client-supplied 'student_id' on user creation and updates to prevent unauthorized linking.
-- 3. Lock user 'role' on update so users cannot escalate role via auth.updateUser().
-- 4. Remove metadata-driven student linking in handle_new_user while keeping teacher/parent sync.

-- 1. BEFORE INSERT: whitelist role and strip student_id
create or replace function public.ensure_user_role_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  if coalesce(new.raw_user_meta_data ->> 'role', '') not in ('teacher', 'parent') then
    new.raw_user_meta_data := new.raw_user_meta_data || jsonb_build_object(
      'role', 'teacher',
      'full_name', coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
    );
  end if;
  new.raw_user_meta_data := new.raw_user_meta_data - 'student_id';
  return new;
end;
$$;

-- 2. BEFORE UPDATE: lock role once assigned and prevent student_id injection
create or replace function public.lock_user_role_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  if old.raw_user_meta_data is not null and old.raw_user_meta_data ? 'role' then
    new.raw_user_meta_data := new.raw_user_meta_data
      || jsonb_build_object('role', old.raw_user_meta_data -> 'role');
  end if;
  new.raw_user_meta_data := new.raw_user_meta_data - 'student_id';
  return new;
end;
$$;

drop trigger if exists before_auth_user_updated on auth.users;
create trigger before_auth_user_updated
  before update of raw_user_meta_data on auth.users
  for each row execute function public.lock_user_role_metadata();

-- 3. Update handle_new_user: remove client metadata-driven student_id linking
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
