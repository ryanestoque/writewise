-- Disposable stack only; all synthetic Vault data rolls back and no HTTP commits.
begin;
select vault.create_secret('http://127.0.0.1:8765', 'writewise_backend_url');
select vault.create_secret('synthetic-email-dispatch-secret-00000001',
  'writewise_email_dispatch_secret');
do $$
begin
  begin
    perform writewise_internal.request_email_dispatch();
    raise exception 'Unsafe network dispatch was not blocked';
  exception when insufficient_privilege then
    if sqlerrm <> 'Email dispatch network permissions require owner provisioning' then
      raise;
    end if;
  end;
end;
$$;
rollback;
