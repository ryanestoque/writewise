alter table public.teacher enable row level security;
create policy "teacher can view own profile"
  on public.teacher for select using (id = auth.uid());

alter table public.parent enable row level security;
create policy "parent can view own profile"
  on public.parent for select using (id = auth.uid());

alter table public.student enable row level security;
create policy "teacher can view own roster students"
  on public.student for select using (public.is_teacher_of_student(id));
create policy "parent can view own child"
  on public.student for select using (public.is_parent_of_student(id));

alter table public.teacher_student enable row level security;
create policy "teacher can view own roster links"
  on public.teacher_student for select using (teacher_id = auth.uid());

alter table public.student_parent enable row level security;
create policy "parent can view own links"
  on public.student_parent for select using (parent_id = auth.uid());

alter table public.activity enable row level security;
create policy "teacher can view own activities"
  on public.activity for select using (created_by = auth.uid());
create policy "parent can view assigned take-home activities"
  on public.activity for select using (
    is_take_home
    and exists (
      select 1 from public.teacher_student ts
      join public.student_parent sp on sp.student_id = ts.student_id
      where ts.teacher_id = activity.created_by and sp.parent_id = auth.uid()
    )
  );

alter table public.submission enable row level security;
create policy "teacher can view submissions for own roster"
  on public.submission for select using (public.is_teacher_of_student(student_id));
create policy "parent can view own child's submissions"
  on public.submission for select using (public.is_parent_of_student(student_id));

alter table public.measurement enable row level security;
create policy "teacher can view measurements for own roster"
  on public.measurement for select using (
    exists (
      select 1 from public.submission s
      where s.id = measurement.submission_id and public.is_teacher_of_student(s.student_id)
    )
  );
create policy "parent can view own child's measurements"
  on public.measurement for select using (
    exists (
      select 1 from public.submission s
      where s.id = measurement.submission_id and public.is_parent_of_student(s.student_id)
    )
  );

alter table public.manual_score enable row level security;
create policy "teacher can view own submitted manual scores"
  on public.manual_score for select using (graded_by = auth.uid());
