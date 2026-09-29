-- Production Foundation Phase 2 — least-privilege Supabase API role grants
-- Additive / corrective. Does NOT weaken RLS. Does NOT touch auth/storage/realtime.
--
-- Root cause on Altus-Lead-Staging:
--   Tables owned by postgres inherit default ACL Dxtm (TRUNCATE/REFERENCES/TRIGGER)
--   for anon/authenticated/service_role, without SELECT/INSERT/UPDATE/DELETE.
--   RLS is enabled, but PostgREST cannot perform business DML.
--
-- Access model (HYBRID):
--   anon          → Auth/session only; NO public business-table DML
--   authenticated → GRANT + RLS for CURRENT JWT membership resolution only
--   service_role  → trusted server repositories/API paths (bypasses RLS; key server-only)
--
-- Public assessment path:
--   browser → Next.js /api/public/* → service_role repositories (not anon table CRUD)

-- ---------------------------------------------------------------------------
-- Schema usage
-- ---------------------------------------------------------------------------
-- authenticated/service_role need USAGE to resolve public relations via PostgREST.
-- anon does not need public business objects; revoke USAGE to harden the boundary.
grant usage on schema public to authenticated, service_role;
revoke usage on schema public from anon;

-- ---------------------------------------------------------------------------
-- ANON: strip all inherited public table / sequence privileges
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- ---------------------------------------------------------------------------
-- SERVICE_ROLE: trusted server DML on ALTUS public application tables
-- ---------------------------------------------------------------------------
-- Acceptable as ALL TABLES IN SCHEMA public because:
--   1) service_role is the intentional elevated server boundary
--   2) current repositories already require multi-table persistence/reads
--   3) credentials must never be exposed to the browser (NEXT_PUBLIC_* forbidden)
--   4) no CREATE/DROP/ownership is granted — only relation DML
-- TRUNCATE is revoked (no current ALTUS runtime path requires it).
grant select, insert, update, delete on all tables in schema public to service_role;
revoke truncate, references, trigger on all tables in schema public from service_role;

-- No serial/identity sequences in current ALTUS public schema (UUID defaults).
-- Grant sequence privileges only if/when serial paths appear; keep service_role ready.
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- AUTHENTICATED: current JWT-backed flows only (getOrgAuthContext)
-- ---------------------------------------------------------------------------
-- Traced table usage:
--   organization_members  SELECT  (membership lookup)
--   member_roles          SELECT  (role assignment lookup)
--   roles                 SELECT  (PostgREST embed roles(key) from member_roles)
-- Permissions are resolved in application code (DEFAULT_ROLE_PERMISSIONS), not SQL.
-- profiles / permissions / role_permissions / organizations / leads / CRM:
--   NOT queried by current authenticated JWT clients — intentionally NOT granted.
-- Command Center durable reads use service_role APIs in this phase.

grant select on table public.organization_members to authenticated;
grant select on table public.member_roles to authenticated;
grant select on table public.roles to authenticated;

-- Explicitly ensure authenticated has no DML on those tables beyond SELECT
revoke insert, update, delete, truncate on table public.organization_members from authenticated;
revoke insert, update, delete, truncate on table public.member_roles from authenticated;
revoke insert, update, delete, truncate on table public.roles from authenticated;

-- Strip inherited non-DML / dangerous privileges on ALL public tables for authenticated
-- (keeps the three SELECTs above; revokes TRUNCATE/REFERENCES/TRIGGER everywhere else)
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update, delete on all tables in schema public from authenticated;
-- Re-assert the intentional SELECTs after the broad revoke
grant select on table public.organization_members to authenticated;
grant select on table public.member_roles to authenticated;
grant select on table public.roles to authenticated;
revoke all on all sequences in schema public from authenticated;

-- ---------------------------------------------------------------------------
-- FUNCTIONS — least privilege EXECUTE
-- ---------------------------------------------------------------------------
-- is_org_member / has_org_permission: SECURITY DEFINER helpers used by RLS policies
-- for authenticated. Not needed as direct anon RPC entry points.
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.has_org_permission(uuid, text) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.has_org_permission(uuid, text) to authenticated, service_role;

-- current_profile_id: unused by current JWT table paths; keep available to
-- authenticated/service_role for policy compatibility, not anon.
revoke all on function public.current_profile_id() from public, anon;
grant execute on function public.current_profile_id() to authenticated, service_role;

-- set_updated_at: trigger helper — not a client API
revoke all on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;

-- rls_auto_enable: event-trigger helper — not a client API
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;

-- ---------------------------------------------------------------------------
-- DEFAULT PRIVILEGES FOR ROLE postgres (actual CLI migration table owner)
-- ---------------------------------------------------------------------------
-- Replace the broken postgres→public default that only granted Dxtm to API roles.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

-- authenticated does NOT automatically receive future-table DML.
-- Grant intentionally alongside the feature/RLS migration that needs it.

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from anon;

alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
