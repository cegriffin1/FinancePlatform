# Architecture Impact Report — Advanced Markets Growth Engine

**Branch:** `feature/advanced-markets-architecture`  
**Mode:** Architecture + domain contracts only (no full feature implementation)

## Summary

The existing FinancePlatform foundation remains intact. The product expands into a two-layer model: **industry-neutral core** + **pluggable accelerators**, with **Advanced Markets** as the first accelerator. Core engines gain event-driven scoring, classification, routing eligibility, lifecycle/nurture, provenance, and monetization abstractions. Advanced Markets supplies templates, catalogs, and rule packs — it does not redefine `Lead`.

## What stays unchanged

- Multi-tenant org / auth / team / RBAC / RLS foundation migration
- Existing repository & provider interface surface (extended, not removed)
- Dynamics 365 future-state adapter strategy
- Auth/organization/team implementation roadmap sequencing (still next product work)
- App shell navigation placeholders

## What changes conceptually

| Area | Impact |
| --- | --- |
| Product identity | Growth + Distribution OS (not lead-selling site) |
| Lead model | Remains core; gains events, provenance, temperature, lifecycle links |
| Qualification | New engine + two-stage model; AM content packs |
| Scoring | Event-driven configurable packs replace single stub score mindset |
| Routing | Adds territory/licensing/subscription/capacity dimensions |
| Monetization | Abstract plans/packages/billing provider — no payments yet |
| Marketplace | Documented future module only |
| Compliance | Explicit consent/audit/versioning expectations |

## Domain contracts added/expanded

- Expanded `LeadScoringService`, `LeadRoutingService`
- New: `LeadEventRepository`, `LeadClassificationService`, `LeadLifecyclePolicyService`, `LeadNurtureService`, `TerritoryEligibilityService`, `QualificationTemplateRepository`, `CampaignTemplateRepository`, `BillingProvider`, `AdvancedMarketsModule` registry types

## Schema impact

- Additive migration **planned** (see [migration-plan-growth-engine.md](./migration-plan-growth-engine.md))
- Foundation migration **not** modified
- No insurance-specific columns on core `leads`

## Risk register

| Risk | Mitigation |
| --- | --- |
| Vertical coupling creep | Platform-layers ownership rules + extension tables |
| Hard-coded scores in UI | Service + rule packs only |
| Premature recycling/marketplace harm | Policy engine; marketplace deferred |
| Compliance overclaim | Explicit “no regulatory determination” stance |
| Scope explosion | This branch stops at architecture + contracts |

## Recommended next implementation branches

1. Continue `feature/auth-organization-team` / org onboarding (preserve)
2. `feature/lead-events-scoring` — events, provenance, scoring packs, temperature
3. `feature/qualification-engine` — Stage 1 runtime + AM question pack
4. `feature/routing-territory` — eligibility-aware routing
5. Later: nurture/lifecycle, campaign catalog, billing abstractions UI, marketplace spike

## Explicit non-goals of this milestone

- Full Advanced Markets UX
- Payments
- Marketplace implementation
- Dynamics adapters
- Autonomous financial/AI recommendations
- Rewriting the Next.js app or deleting foundation files
