-- Production Foundation Phase 2 — Supabase API role grants
-- Additive only. Does not alter RLS policies or weaken tenant isolation.
--
-- Symptom on Altus-Lead-Staging after migrations 1–11:
--   service_role / authenticated / anon had REFERENCES/TRIGGER/TRUNCATE
--   but NOT SELECT/INSERT/UPDATE/DELETE on public tables.
-- PostgREST therefore returned permission denied even with a valid JWT/service key.
--
-- Grants authorize the role to attempt access; RLS still enforces row visibility.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

grant execute on all functions in schema public
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant execute on functions
  to anon, authenticated, service_role;
