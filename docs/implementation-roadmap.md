# Implementation Roadmap

## Milestone 0 — Platform foundation (this branch)

`feature/platform-foundation`

- Documentation suite + Mermaid diagrams
- Next.js / TypeScript / Tailwind scaffolding
- Domain interfaces and permission model
- Supabase client abstractions
- Initial schema migrations + RLS baseline
- Auth architecture
- App shell, navigation, shared UI, placeholder dashboard
- Vitest unit tests for permissions / pure domain logic
- Playwright harness scaffolding

## Milestone 1 — Organization onboarding

Recommended branch: `feature/org-onboarding`

- Organization signup and setup wizard
- Branding settings
- Invitation create/accept flows
- Member list and deactivate user

## Milestone 2 — Team hierarchy

Recommended branch: `feature/team-hierarchy`

- Locations, departments, teams CRUD
- Reporting relationships
- Manager-scoped views

## Milestone 3 — Campaigns & landing pages

Recommended branch: `feature/campaigns-landing`

- Campaign CRUD
- Landing page publish pipeline
- Assessment form → lead creation

## Milestone 4 — Lead scoring, routing, workspace

Recommended branch: `feature/lead-workspace`

- Scoring rules implementation
- Routing rules implementation
- Lead detail, notes, tasks, assignment

## Milestone 5 — Pipeline

Recommended branch: `feature/pipeline`

- Pipeline/stage management
- Opportunity board / list
- Stage transition activities

## Milestone 6 — Integrations & analytics

Recommended branch: `feature/integrations-analytics`

- Integration connection UI
- External mapping tooling
- Reports foundation
- Dynamics adapter spike (read-only)

## Sequencing rationale

Foundation first ensures tenancy, authz, and adapter boundaries are correct before UX depth. The first end-to-end journey (org → invite → campaign → lead → assign → work) spans milestones 1–4.
