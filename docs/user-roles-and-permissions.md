# User Roles and Permissions

## Built-in user types

| User type | Typical access |
| --- | --- |
| Platform Administrator | Cross-tenant platform operations (separate from org roles) |
| Organization Owner | Full org governance |
| Organization Administrator | Org configuration without ownership transfer |
| Manager | Team-scoped leads, pipeline, reports |
| Marketing User | Campaigns create/update/publish |
| Sales User | Assigned leads and pipeline movement |
| Employee | Task execution within granted permissions |
| Contractor | Scoped membership; same permission engine |

Platform Administrator is a **platform-level** concept. All others are **organization-level** memberships.

## Permission keys (initial)

```text
organization.view
organization.update
users.view
users.invite
users.update
users.remove
teams.view
teams.manage
campaigns.view
campaigns.create
campaigns.update
campaigns.publish
leads.view_own
leads.view_team
leads.view_all
leads.assign
leads.update
pipeline.view
pipeline.manage
reports.view_own
reports.view_team
reports.view_all
```

## Design principles

1. Authorize on **permission keys**, not hard-coded role names in feature code.
2. Roles are bundles of permissions; custom roles can be added later without schema redesign.
3. A member may hold multiple roles; effective permissions are the union.
4. Scope modifiers (`own` / `team` / `all`) apply after tenant isolation.

## Suggested default role maps

| Role | Permissions (illustrative) |
| --- | --- |
| Owner | All org permission keys |
| Admin | All except irreversible ownership/billing transfers (future) |
| Manager | `teams.view`, `leads.view_team`, `leads.assign`, `leads.update`, `pipeline.view`, `reports.view_team`, … |
| Marketing | `campaigns.*`, `leads.view_team` (optional), `reports.view_team` |
| Sales | `leads.view_own`, `leads.update`, `pipeline.view`, `reports.view_own` |
| Employee | Minimal task/lead update set as assigned |
| Contractor | Explicit grants only |

Exact seed maps live in migrations / domain seed data and can evolve without UI rewrites.

## Owner capabilities (product checklist)

- Create organization
- Add company branding
- Invite employees / contractors
- Create departments and teams
- Assign managers and reporting relationships
- Assign roles and manage permissions
- Deactivate users
- View team performance
