-- ALTUS — harden FUTURE default privileges for role supabase_admin in public
-- After: 20260929090000_rls_null_org_hardening.sql
--
-- Scope:
--   ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public ONLY
--
-- Does NOT:
--   change privileges on EXISTING tables/sequences/functions
--   alter schema USAGE
--   modify RLS / GRANTs on current objects
--   touch auth, storage, realtime, extensions, graphql, vault
--
-- Why:
--   Live pg_default_acl shows supabase_admin → public defaults grant anon
--   (and authenticated) full table/sequence privileges and function EXECUTE
--   on FUTURE objects. postgres defaults were already hardened in 080000.
--   CLI migrations currently create as postgres; dashboard/SQL as
--   supabase_admin would still auto-expose anon without this.
--
-- Target future defaults (mirror hardened postgres pattern):
--   tables:     service_role SELECT/INSERT/UPDATE/DELETE only
--   sequences:  service_role USAGE/SELECT only
--   functions:  service_role EXECUTE only; PUBLIC/anon/authenticated NONE

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------
alter default privileges for role supabase_admin in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role supabase_admin in schema public
  grant select, insert, update, delete on tables to service_role;

-- ---------------------------------------------------------------------------
-- SEQUENCES
-- ---------------------------------------------------------------------------
alter default privileges for role supabase_admin in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role supabase_admin in schema public
  grant usage, select on sequences to service_role;

-- ---------------------------------------------------------------------------
-- FUNCTIONS (critical: remove PUBLIC + anon automatic EXECUTE)
-- ---------------------------------------------------------------------------
alter default privileges for role supabase_admin in schema public
  revoke all on functions from public, anon, authenticated, service_role;

alter default privileges for role supabase_admin in schema public
  grant execute on functions to service_role;
