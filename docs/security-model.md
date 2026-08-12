# Security Model

## Threat model (foundation)

Primary risk: **cross-tenant data exposure**. Secondary risks: privilege escalation within a tenant, invitation abuse, and secret leakage.

## Defense layers

1. **Authentication** — Supabase Auth sessions validated on the server.
2. **Membership** — Access requires an active `organization_members` row.
3. **Permissions** — Actions check permission keys (not role names alone).
4. **Row-Level Security** — PostgreSQL RLS policies enforce `organization_id` isolation.
5. **Server-side authorization** — UI hiding is never sufficient.
6. **Audit logging** — Sensitive mutations write `audit_logs`.

## Tenant isolation rule

Organization A must never access Organization B’s:

Users · Employees · Teams · Campaigns · Leads · Customers · Tasks · Documents · Reports · Settings

Every protected query path must be organization-scoped at **both** application and database layers.

## RLS baseline approach

- Enable RLS on all tenant-scoped tables.
- Policies use the authenticated user’s org memberships (via a secure helper such as `auth.uid()` → profile → member → organization_id).
- Service role bypasses RLS for controlled admin/jobs only; never expose service role to the browser.
- Storage paths include `organization_id` prefixes; storage policies mirror table isolation.

## Permission evaluation

```text
session → profile → organization_member → member_roles → roles → role_permissions → permission keys
```

Scoped permissions (`*_own`, `*_team`, `*_all`) further constrain row visibility after org isolation.

## Secrets

| Variable | Exposure |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `.env*` | Never committed |

## Invitation security

- Invitations are single-use or time-bounded tokens.
- Accepting an invite creates membership in the inviting organization only.
- Invites cannot escalate beyond the inviter’s grantable roles (enforced in application service).

## Future identity

Microsoft Entra ID may become an alternate IdP. Application authorization remains permission-based and org-scoped regardless of IdP.
