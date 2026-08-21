# Migration Plan — Growth Engine / Advanced Markets

## Policy

- Do **not** rewrite or break `20260812090000_platform_foundation.sql`
- Prefer **additive** tables and nullable extension columns
- All tenant tables require `organization_id` + RLS
- Do not apply production schema changes until a dedicated feature branch implements them
- This document is the planning source of truth for the next schema milestone

## Existing foundation (preserve)

organizations, organization_settings, profiles, organization_members, locations, departments, teams, reporting_relationships, roles/permissions, invitations, campaigns, leads, contacts, opportunities, activities, tasks, appointments, pipelines, pipeline_stages, audit_logs, integration_connections, external_record_mappings

## Proposed additive tables (planned)

### Qualification

| Table | Purpose |
| --- | --- |
| `qualification_templates` | Versioned question graphs (core + accelerator packs) |
| `qualification_questions` | Question definitions + interaction types |
| `qualification_branches` | Conditional edges |
| `qualification_sessions` | Prospect in-progress/completed sessions |
| `qualification_answers` | Captured answers |

### Lead intelligence

| Table | Purpose |
| --- | --- |
| `lead_events` | Append-only timeline |
| `lead_provenance` | Immutable acquisition source (1:1 lead) |
| `lead_score_snapshots` | Score history |
| `lead_temperature_states` | Current + history optional |
| `lead_strategy_classifications` | Many classifications per lead |
| `scoring_rule_packs` | Configurable scoring rules |
| `temperature_threshold_configs` | Org/platform configurable bands |

### Routing & territory

| Table | Purpose |
| --- | --- |
| `agent_territories` | Member ↔ regions/states |
| `agent_licenses` | Declared licenses (not regulatory determination) |
| `campaign_territories` | Campaign geo targeting |
| `routing_policies` | Configurable routing rules |

### Lifecycle / nurture

| Table | Purpose |
| --- | --- |
| `lead_lifecycle_states` | Current lifecycle status |
| `nurture_sequences` | Sequence definitions |
| `nurture_enrollments` | Lead enrollment |
| `lifecycle_policies` | Recycling / dormancy eligibility policies |

### Campaign catalog & monetization (abstractions)

| Table | Purpose |
| --- | --- |
| `campaign_templates` | Reusable catalog entries |
| `subscription_plans` | Plan definitions |
| `subscription_entitlements` | Feature/capacity grants |
| `organization_subscriptions` | Org plan assignments |
| `campaign_packages` / `lead_packages` | Package definitions (no payment processing yet) |

### Accelerator registry

| Table | Purpose |
| --- | --- |
| `accelerator_modules` | Registered modules (`advanced_markets`, …) |
| `organization_accelerators` | Enabled modules per org |

## Proposed additive columns (carefully)

On `leads` (nullable, non-breaking):

- `temperature_key` (text, configurable vocabulary)
- `lifecycle_status` (text)
- `qualification_session_id` (uuid, nullable FK)
- `score_version` (text)

On `appointments` (nullable):

- `requested_at`, `status` expansion, `attended_at`, `cancelled_at`, `rescheduled_from_id`, `no_show_at`

**Do not** add insurance-specific columns to `leads`.

## Advanced Markets extension approach

Store vertical-specific payload in:

- template/content tables keyed by `module_key = 'advanced_markets'`
- optional `am_lead_profiles` extension table (1:1) only if needed later — **not required for this architecture milestone**

## RLS baseline for new tables

Same pattern as foundation:

- `is_org_member(organization_id)` for read
- permission-aware writes where needed
- append-only `lead_events` / `lead_provenance` (update restricted)

## Suggested migration file naming (future apply)

```text
supabase/migrations/YYYYMMDDHHMMSS_growth_engine_intelligence.sql
supabase/migrations/YYYYMMDDHHMMSS_advanced_markets_packs.sql
```

Draft SQL for this architecture branch is intentionally **not** applied as a reckless production change; see companion draft if present under `supabase/migrations/` with a clear header comment.
