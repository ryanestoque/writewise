-- The disposable stack already supplies Vault; only install supported extensions
-- when absent. Never drop/recreate extension-owned queues or secrets.
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Schema exclusion alone is insufficient: deny browser direct object privileges.
-- Existing extension/worker owners retain their grants and ownership.
revoke all on schema net, vault from public, anon, authenticated, service_role;
revoke all on all tables in schema net, vault from public, anon, authenticated, service_role;
revoke all on all sequences in schema net, vault from public, anon, authenticated, service_role;
revoke all on all functions in schema net, vault from public, anon, authenticated, service_role;

create function writewise_internal.request_email_dispatch()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  origin_count integer;
  secret_count integer;
  backend_origin text;
  dispatch_secret text;
  port_text text;
begin
  select count(*), min(s.decrypted_secret) into origin_count, backend_origin
  from vault.decrypted_secrets s where s.name = 'writewise_backend_url';
  select count(*), min(s.decrypted_secret) into secret_count, dispatch_secret
  from vault.decrypted_secrets s where s.name = 'writewise_email_dispatch_secret';
  if origin_count > 1 or secret_count > 1 then
    raise exception using errcode = '22023', message = 'Invalid email dispatch configuration';
  end if;
  if origin_count = 0 or secret_count = 0 or btrim(backend_origin) = ''
    or btrim(dispatch_secret) = '' then return null; end if;
  if char_length(dispatch_secret) < 32 or dispatch_secret !~ '^[ -~]+$'
    or not (
      backend_origin ~ '^https://([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?/?$'
      or backend_origin ~ '^http://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]{1,5})?/?$'
    ) then
    raise exception using errcode = '22023', message = 'Invalid email dispatch configuration';
  end if;
  port_text := substring(backend_origin from ':([0-9]+)/?$');
  if port_text is not null and port_text::integer not between 1 and 65535 then
    raise exception using errcode = '22023', message = 'Invalid email dispatch configuration';
  end if;
  return net.http_post(
    url := rtrim(backend_origin,'/') || '/api/internal/dispatch-emails',
    headers := jsonb_build_object('Content-Type','application/json','X-Dispatch-Secret',dispatch_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
revoke all on function writewise_internal.request_email_dispatch()
  from public, anon, authenticated, service_role;

-- Named replacement is idempotent; job text never contains origin or credentials.
select cron.schedule('writewise-email-dispatch', '*/5 * * * *',
  'select writewise_internal.request_email_dispatch();');
