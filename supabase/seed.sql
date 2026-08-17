insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'teacher.santos@example.com',
        '{"role": "teacher", "full_name": "Ms. Santos"}');

insert into public.student (id, full_name, section)
values ('22222222-2222-2222-2222-222222222222', 'Juan Dela Cruz', 'Grade 3 - Sampaguita');

insert into public.teacher_student (teacher_id, student_id)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');