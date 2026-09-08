-- migration: 0015_parent_invite_status.sql
-- Description: Track parent invitation and confirmation status on student record,
-- synchronize with auth.users confirmation lifecycle, and backfill existing records.

-- 1. Add parent_status column to student
alter table public.student 
add column if not exists parent_status text check (parent_status in ('pending', 'active'));

-- 2. Enhanced handle_new_user to update parent_status on student when parent is confirmed
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  user_name text;
  is_confirmed boolean;
begin
  user_role := new.raw_user_meta_data ->> 'role';
  user_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
  is_confirmed := (new.confirmed_at is not null or new.email_confirmed_at is not null);

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

drop trigger if exists on_auth_user_created_or_updated on auth.users;

create trigger on_auth_user_created_or_updated
  after insert or update of raw_user_meta_data, email, confirmed_at, email_confirmed_at on auth.users
  for each row execute function public.handle_new_user();

-- 3. Backfill parent_status on existing students
update public.student s
set parent_status = case
  when exists (
    select 1 from public.student_parent sp
    join auth.users u on u.id = sp.parent_id
    where sp.student_id = s.id
      and (u.confirmed_at is not null or u.email_confirmed_at is not null)
  ) then 'active'
  when s.parent_email is not null and s.parent_email != '' then 'pending'
  else null
end;
