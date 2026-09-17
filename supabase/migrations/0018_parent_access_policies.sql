-- migration: 0018_parent_access_policies.sql
-- Description:
-- 1. Allow parents to view teacher_student links for their own children (enables scoping take-home activities to the child's teacher).
-- 2. Allow parents to view manual rubric scores for their own children's submissions (enables Phase 2 UI to display stand-in manual scores before calibration ships).

create policy "parent can view teacher links for own child"
  on public.teacher_student for select
  using (public.is_parent_of_student(student_id));

create policy "parent can view manual scores for own child"
  on public.manual_score for select
  using (
    exists (
      select 1 from public.submission s
      where s.id = manual_score.submission_id
        and public.is_parent_of_student(s.student_id)
    )
  );
