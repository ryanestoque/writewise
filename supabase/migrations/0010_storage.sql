insert into storage.buckets (id, name, public)
values ('submission-images', 'submission-images', false);

insert into storage.buckets (id, name, public)
values ('model-artifacts', 'model-artifacts', false);

create policy "teacher can read submission images for own roster"
  on storage.objects for select
  using (
    bucket_id = 'submission-images'
    and public.is_teacher_of_student((storage.foldername(name))[1]::uuid)
  );

create policy "parent can read own child's submission images"
  on storage.objects for select
  using (
    bucket_id = 'submission-images'
    and public.is_parent_of_student((storage.foldername(name))[1]::uuid)
  );
