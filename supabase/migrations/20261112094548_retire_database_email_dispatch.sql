-- Retire only WriteWise's obsolete database-to-HTTP email trigger. The external
-- caller keeps its secret outside pg_net. Preserve deadline/unrelated jobs,
-- extension-owned objects, queue state, preferences and unused Vault entries.
do $$
declare target_job bigint;
begin
  for target_job in
    select jobid from cron.job where jobname = 'writewise-email-dispatch'
  loop
    perform cron.unschedule(target_job);
  end loop;
end;
$$;

-- No CASCADE: unexpected dependencies must fail for inspection.
drop function if exists writewise_internal.request_email_dispatch();
