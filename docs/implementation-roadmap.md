# Implementation Roadmap

## Milestone 0 — Platform foundation ✅

`feature/platform-foundation`

Documentation, Next.js foundation, domain interfaces baseline, Supabase abstractions, schema + RLS, app shell, tests.

## Milestone 0.5 — Growth engine architecture (this branch)

`feature/advanced-markets-architecture`

- Two-layer product model docs (Core + Accelerators)
- Advanced Markets module boundary
- Qualification / intelligence / monetization architecture
- Expanded domain types + service interfaces
- Additive migration **plan** (not reckless production schema rewrite)
- Architecture impact report

**Stops before** full Advanced Markets feature implementation.

## Milestone 0.75 — Campaign growth engine (Phase 1)

Branch: `feature/campaign-growth-engine`

- Dual campaign ownership model (platform vs subscriber)
- Campaign builder + template library UI
- Attribution / events / scoring / classification / distribution interfaces + engines
- Subscription entitlements
- Mock channel providers
- Additive migration with RLS

See [campaign-growth-engine.md](./campaign-growth-engine.md).

## Milestone 1 — Organization onboarding

Branch: `feature/auth-organization-team` (or `feature/org-onboarding`)

- Organization signup and setup wizard
- Branding settings
- Invitation create/accept flows
- Member list and deactivate user

*Preserved — do not displace this work with accelerator UI.*

## Milestone 2 — Team hierarchy

- Locations, departments, teams CRUD
- Reporting relationships
- Manager-scoped views
- Agent territory/license profile hooks (schema-ready)

## Milestone 3 — Campaigns & qualification Stage 1

- Campaign CRUD + campaign template catalog
- Qualification engine runtime + branching
- Advanced Markets Stage 1 question pack
- Lead + provenance + events on capture
- Abandoned / qualified-not-scheduled states

## Milestone 4 — Lead intelligence & workspace

- Event timeline UI
- Scoring rule packs + temperature configs
- Strategy classification
- Routing with territory eligibility
- Agent lead workspace (notes/tasks/appointment intent)

## Milestone 5 — Nurture, lifecycle, pipeline

- Nurture sequences + CommunicationProvider triggers
- Lifecycle policy / recycle eligibility (no blind timers)
- Pipeline/opportunity board

## Milestone 6 — Analytics, entitlements, Dynamics spike

- Attribution metrics foundation
- Subscription/entitlement UI (no payments processor required initially)
- Dynamics adapter read-only spike
- Marketplace design spike only

## Future

- Lead marketplace module
- Payments via `BillingProvider`
- AI assist (explain score, next action) — no autonomous financial advice
- Additional industry accelerators

## Sequencing rationale

Auth/org/team first keeps tenancy correct. Qualification + events unlock scoring/routing. Accelerators configure engines after core runtime exists. Marketplace and Dynamics remain downstream.
