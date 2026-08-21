# Data Model

## Design rules

- UUID primary keys
- `organization_id` on every tenant-scoped table
- `created_at` / `updated_at` timestamps
- `created_by` / `updated_by` where actor attribution matters
- Soft deactivation preferred over hard deletes for people and org structure

## Core ERD

```mermaid
erDiagram
  organizations ||--o| organization_settings : has
  organizations ||--o{ organization_members : includes
  organizations ||--o{ locations : has
  organizations ||--o{ departments : has
  organizations ||--o{ teams : has
  organizations ||--o{ invitations : issues
  organizations ||--o{ campaigns : runs
  organizations ||--o{ leads : owns
  organizations ||--o{ contacts : owns
  organizations ||--o{ opportunities : owns
  organizations ||--o{ activities : logs
  organizations ||--o{ tasks : tracks
  organizations ||--o{ appointments : schedules
  organizations ||--o{ pipelines : defines
  organizations ||--o{ audit_logs : records
  organizations ||--o{ integration_connections : connects

  profiles ||--o{ organization_members : "is"
  roles ||--o{ role_permissions : grants
  permissions ||--o{ role_permissions : "used by"
  roles ||--o{ member_roles : assigned
  organization_members ||--o{ member_roles : has
  organization_members ||--o{ reporting_relationships : reports
  teams ||--o{ organization_members : "members belong"
  pipelines ||--o{ pipeline_stages : contains
  leads ||--o{ opportunities : converts
  contacts ||--o{ leads : related
  campaigns ||--o{ leads : generates
  integration_connections ||--o{ external_record_mappings : maps
```

## Tables (initial)

| Table | Purpose |
| --- | --- |
| `organizations` | Tenant root |
| `organization_settings` | Branding, defaults, feature flags |
| `profiles` | Auth-linked user profile (global identity) |
| `organization_members` | Membership of a profile in an org |
| `locations` | Physical/virtual sites |
| `departments` | Org departments |
| `teams` | Working teams under departments/locations |
| `reporting_relationships` | Manager ↔ report edges |
| `roles` | Named role containers (system + custom-ready) |
| `permissions` | Permission keys |
| `role_permissions` | Role → permission grants |
| `member_roles` | Member → role assignments |
| `invitations` | Pending invites |
| `campaigns` | Marketing campaigns |
| `leads` | Inbound/qualified leads |
| `contacts` | People/accounts in CRM sense |
| `opportunities` | Pipeline deals |
| `activities` | Notes, calls, emails, system events |
| `tasks` | Actionable work items |
| `appointments` | Calendar events |
| `pipelines` | Pipeline definitions |
| `pipeline_stages` | Ordered stages |
| `audit_logs` | Security/compliance trail |
| `integration_connections` | External system connections |
| `external_record_mappings` | Local UUID ↔ external IDs |

## Organization hierarchy

```mermaid
flowchart TD
  Platform[Platform]
  Org[Organization]
  Loc[Location]
  Dept[Department]
  Team[Team]
  Mgr[Manager]
  Emp[Employee / Contractor]

  Platform --> Org
  Org --> Loc
  Org --> Dept
  Dept --> Team
  Loc --> Team
  Team --> Mgr
  Mgr --> Emp
```

## Notable relationships

- A `profile` can belong to multiple organizations via `organization_members`.
- Permissions are evaluated from the member’s roles within the **active** organization context.
- `external_record_mappings` enables dual-write / sync with Dynamics without coupling UI to Dataverse IDs.
- Campaign → Lead → Opportunity is the primary growth path; contacts may exist before or after lead creation.

## Indexing guidance

- Unique `(organization_id, slug)` or similar natural keys where needed
- Indexes on `organization_id` for all tenant tables
- Indexes on foreign keys used in list/filter screens (`assigned_to`, `team_id`, `campaign_id`, `stage_id`)

## Growth engine extensions (planned — additive)

See [migration-plan-growth-engine.md](./migration-plan-growth-engine.md).

```mermaid
erDiagram
  leads ||--o| lead_provenance : has
  leads ||--o{ lead_events : timeline
  leads ||--o{ lead_strategy_classifications : classified
  leads ||--o{ lead_score_snapshots : scored
  leads ||--o| qualification_sessions : from
  qualification_templates ||--o{ qualification_questions : contains
  qualification_questions ||--o{ qualification_branches : branches
  organization_members ||--o{ agent_territories : covers
  organization_members ||--o{ agent_licenses : declares
  campaigns ||--o{ campaign_territories : targets
  campaign_templates ||--o{ campaigns : instantiates
  accelerator_modules ||--o{ organization_accelerators : enabled
```

**Rule:** do not add insurance-specific columns to core `leads`. Accelerators use templates, rule packs, and optional extension tables keyed by `module_key`.
