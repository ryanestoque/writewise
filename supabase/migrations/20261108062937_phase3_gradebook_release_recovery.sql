-- Reviewed release recovery and grade-only navigation; historical migrations remain unchanged.
create or replace function writewise_internal.publish_work_grade(
  actor_id uuid,work_activity uuid,work_student uuid,expected_revision bigint
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.activity; w public.student_work; g public.student_work_grade;
  previous_revision bigint;
  selected public.submission; grade_changed boolean; rubric_changed boolean := false;
begin
  a := writewise_internal.authorize_work(actor_id,work_activity,work_student);
  w := writewise_internal.lock_work(work_activity,work_student);
  select revision into previous_revision from public.student_work_grade
    where activity_id=work_activity and student_id=work_student for update;
  g := writewise_internal.sync_work_grade(work_activity,work_student);
  if a.points_possible is null or w.excused or g.id is null then
    raise exception using errcode='WW430',message='Grade cannot be released';
  end if;
  if expected_revision is null or expected_revision<=0 then
    raise exception using errcode='WW434',message='Invalid grade revision';
  end if;
  -- Commit reconciliation, then let FastAPI return 409 outside the RPC transaction.
  -- Raising here would roll it back and trap refresh/release in the old revision.
  if previous_revision is distinct from g.revision then
    return jsonb_build_object('error_code','WW431');
  end if;
  if expected_revision<>g.revision then
    raise exception using errcode='WW431',message='Grade changed';
  end if;
  select s.* into selected from public.submission s join public.active_submission active on active.id=s.id
    where active.activity_id=work_activity and active.student_id=work_student for update of s;
  if (g.points_override is null and (selected.id is null or not writewise_internal.is_graded(selected.id)))
    or g.points_override>a.points_possible then
    raise exception using errcode='WW430',message='Grade cannot be released';
  end if;
  if selected.id is not null and writewise_internal.is_graded(selected.id) and selected.released_at is null then
    update public.submission set released_at=now() where id=selected.id returning * into selected;
    rubric_changed := true;
  end if;
  grade_changed := g.released_at is null or g.released_revision is distinct from g.revision;
  if grade_changed then
    update public.student_work_grade set released_revision=revision,released_at=now()
      where id=g.id returning * into g;
    perform writewise_internal.notify_work_parents('score_released',work_activity,work_student,
      case when rubric_changed then selected.id else null end,
      'grade:' || g.id::text || ':' || g.revision::text);
  end if;
  return jsonb_build_object('activity_id',work_activity,'student_id',work_student,'revision',g.revision,
    'released_at',g.released_at,'submission_id',selected.id,'rubric_released',rubric_changed,
    'grade_released',grade_changed);
end;
$$;

-- Existing preparation and send authorization persist this fixed skip reason.
alter table public.email_outbox drop constraint email_outbox_last_error_check;
alter table public.email_outbox add constraint email_outbox_last_error_check check (last_error in (
  'preference_off','recipient_unavailable','relationship_revoked','activity_archived',
  'event_obsolete','deadline_changed','payload_changed','work_excused','provider_timeout',
  'provider_unavailable','provider_throttled','provider_rejected','provider_configuration',
  'idempotency_conflict','delivery_unknown','retry_window_expired'
));
