-- =============================================================================
-- ALTUS — DESIRED INFRASTRUCTURE CONTROL (NOT AN EXECUTABLE MIGRATION)
-- =============================================================================
--
-- 1. This SQL represents desired defense-in-depth infrastructure hardening for
--    FUTURE default privileges of role supabase_admin in schema public.
-- 2. It was NEVER applied to staging (remote migration history never recorded it).
-- 3. Hosted Supabase tenant roles cannot currently execute:
--      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ...
--    (SQLSTATE 42501 — requires supabase_admin/superuser semantics).
-- 4. It was removed from supabase/migrations/ because leaving an impossible
--    migration in the executable chain blocks legitimate future migrations
--    (including 20260929110000 campaign media).
-- 5. Removal MUST NOT be interpreted as this control having been applied.
--    Live pg_default_acl for supabase_admin may still grant anon/authenticated
--    defaults on FUTURE objects created as that role.
-- 6. Git history retains the original migration file at commit bf750b7
--    (path: supabase/migrations/20260929100000_supabase_admin_default_privilege_hardening.sql).
-- 7. If Supabase later exposes a supported privileged mechanism, reevaluate
--    applying this control through a supported path — do not fake migration history.
--
-- Related operational rule: see docs/security-model.md
--   "ALTUS FUTURE OBJECT CREATOR RULE"
-- =============================================================================

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
