insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'teacher.santos@example.com',
        '{"role": "teacher", "full_name": "Ms. Santos"}');

-- Parent seed user — triggers handle_new_user which inserts the public.parent profile row.
-- The UUID here matches the fallback constant in tests/api/test_submissions_parent.py so
-- the test's limit(1) query finds a real row and never needs the hardcoded fallback.
insert into auth.users (id, email, raw_user_meta_data)
values ('b6b6f61b-6445-4ed3-b278-27218ba0255b', 'parent.seed@example.com',
        '{"role": "parent", "full_name": "Seed Parent"}');

insert into public.student (id, full_name, section)
values ('22222222-2222-2222-2222-222222222222', 'Juan Dela Cruz', 'Grade 3 - Sampaguita');

insert into public.teacher_student (teacher_id, student_id)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');