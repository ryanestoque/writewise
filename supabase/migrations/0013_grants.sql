-- Grant table-level privileges to Supabase roles.
--
-- On hosted Supabase projects these grants are applied automatically by the
-- platform when a table is created in the public schema (via the "default
-- privileges" that Supabase sets on the postgres role).  The local ephemeral
-- stack used by CI starts from a clean Postgres install and does NOT have
-- those default privileges, so we need to add them explicitly.
--
-- service_role: bypasses RLS — used by the FastAPI service and tests.
-- authenticated: Supabase-issued JWTs; covered by RLS policies.
-- anon: unauthenticated requests; no policies grant access, so this is
--       effectively a no-op for security but keeps the role list consistent.

grant usage on schema public to service_role, authenticated, anon;

grant select, insert, update, delete
  on all tables in schema public
  to service_role;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

grant select
  on all tables in schema public
  to anon;

-- Cover any sequences (e.g. serial PKs) that may be added in future.
grant usage, select
  on all sequences in schema public
  to service_role, authenticated, anon;

-- Ensure future tables created in this schema inherit the same defaults.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant select on tables to anon;

alter default privileges in schema public
  grant usage, select on sequences to service_role, authenticated, anon;
