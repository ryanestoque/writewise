-- migration: 0014_auto_teacher_role.sql
-- Description: Automatically assign 'teacher' role on user creation if omitted,
-- sync changes on update of raw_user_meta_data, and backfill existing accounts.

-- 1. Function and BEFORE INSERT trigger to auto-default role to 'teacher' in user metadata if missing
create or replace function public.ensure_user_role_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_name text;
begin
  -- If role is missing or empty, default to 'teacher'
  if new.raw_user_meta_data is null or (new.raw_user_meta_data ->> 'role') is null or (new.raw_user_meta_data ->> 'role') = '' then
    default_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'role', 'teacher',
      'full_name', default_name
    );
  end if;
  return new;
end;
$$;

drop trigger if exists before_auth_user_created on auth.users;

create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.ensure_user_role_metadata();

-- 2. Enhanced handle_new_user to UPSERT into teacher or parent on both INSERT and UPDATE
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  user_name text;
begin
  user_role := new.raw_user_meta_data ->> 'role';
  user_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));

  if user_role = 'teacher' then
    insert into public.teacher (id, full_name, email)
    values (new.id, user_name, new.email)
    on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;
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
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_or_updated on auth.users;

create trigger on_auth_user_created_or_updated
  after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function public.handle_new_user();

-- 3. One-time backfill for existing users missing a role
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role', 'teacher',
  'full_name', coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
)
where raw_user_meta_data is null or (raw_user_meta_data ->> 'role') is null or (raw_user_meta_data ->> 'role') = '';

-- Ensure public.teacher has records for all teacher auth users
insert into public.teacher (id, full_name, email)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)),
  email
from auth.users
where raw_user_meta_data ->> 'role' = 'teacher'
on conflict (id) do update
set full_name = excluded.full_name,
    email = excluded.email;
