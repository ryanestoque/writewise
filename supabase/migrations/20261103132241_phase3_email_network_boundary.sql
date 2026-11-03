-- Owner provisioning: Supabase-managed objects require supabase_admin or an
-- equivalent platform owner. Normal postgres migrations may leave these grants
-- unchanged. Replay this exact versioned file as the authorized owner before
-- activation; the helper below fails closed until the resulting ACLs are safe.
revoke all on schema net, vault from public, anon, authenticated, service_role;
revoke all on all tables in schema net, vault from public, anon, authenticated, service_role;
revoke all on all sequences in schema net, vault from public, anon, authenticated, service_role;
revoke all on all functions in schema net from public, anon, authenticated, service_role;
-- Preserve the trusted cron/migration operator and worker access.
do $$
begin
  if current_user = (select pg_get_userbyid(n.nspowner) from pg_namespace n where n.nspname='net')
    or (select r.rolsuper from pg_roles r where r.rolname=current_user) then
    grant usage on schema net to postgres;
    grant select, insert, update, delete on all tables in schema net to postgres;
    grant usage, select on all sequences in schema net to postgres;
    grant execute on all functions in schema net to postgres;
  end if;
end;
$$;
-- Do not revoke Supabase-owned Vault crypto routines.
create or replace function writewise_internal.request_email_dispatch()
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
  -- Supabase owns these ACLs; a normal migration may be unable to revoke them.
  -- Never place the secret into pg_net until owner provisioning is proved.
  if exists (
    select 1 from unnest(array['anon','authenticated']) role_name
    where has_schema_privilege(role_name,'net','USAGE')
      or has_table_privilege(role_name,'net.http_request_queue','SELECT')
      or has_table_privilege(role_name,'net._http_response','SELECT')
      or has_table_privilege(role_name,'vault.decrypted_secrets','SELECT')
      or exists (
        select 1 from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid=p.pronamespace
        where n.nspname='net' and has_function_privilege(role_name,p.oid,'EXECUTE')
      )
  ) then
    raise exception using errcode = '42501',
      message = 'Email dispatch network permissions require owner provisioning';
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
