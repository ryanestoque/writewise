-- migration: 0017_parent_settings.sql
-- Description: Allow parents to update their own profile row (full_name).
-- Mirrors the teacher update policy added in 0016_teacher_settings.sql.

create policy "parent can update own profile"
  on public.parent for update
  using (id = auth.uid())
  with check (id = auth.uid());
