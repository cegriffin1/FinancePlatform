# Product Requirements

## Milestone A — Platform foundation (complete)

Deliver the architectural and operational foundation for the Growth OS. Do **not** ship the full campaign builder or lead assessment in that milestone.

## Milestone B — Growth engine architecture (current)

Expand product vision and domain contracts for Core + Advanced Markets accelerator. **Do not** implement the full Advanced Markets feature set in this milestone.

### Milestone B in scope

- Documentation for two-layer model, qualification, intelligence, monetization, compliance
- Domain types/interfaces for events, scoring, classification, routing, territory, lifecycle, nurture, templates, billing abstractions
- Additive migration plan
- Architecture impact report

### Milestone B out of scope

- Full qualification UI / AM question copy finalization
- Payments / marketplace implementation
- Dynamics adapters
- Autonomous AI recommendations

### In scope

- Base application shell and navigation
- Authentication architecture (Supabase Auth)
- Organization model and membership
- Roles and permissions architecture
- Team hierarchy model (location → department → team → reporting)
- Domain repository/service interfaces
- Supabase client/server abstractions
- Database migrations and RLS baseline
- Shared UI system and placeholder dashboard
- Development setup documentation

### Out of scope (deferred)

- Campaign builder and landing page publisher
- Interactive assessment / lead capture forms
- Automated lead scoring and routing engines (interfaces only)
- Full CRM pipeline UX
- Microsoft Dynamics / Dataverse integrations
- Billing / subscription management
- Mobile native apps

## Functional requirements

### FR-1 Multi-tenancy

Every protected business record must include `organization_id`. Organization A must never read or write Organization B’s users, teams, campaigns, leads, customers, tasks, documents, reports, or settings.

### FR-2 Authentication

Users authenticate via Supabase Auth. Server components and route handlers validate session before accessing protected data. Client UI never is the sole authorization boundary.

### FR-3 Organization lifecycle

Owners can create an organization and become its founding member with owner privileges. Subsequent invitations create memberships with assigned roles.

### FR-4 Roles & permissions

Authorization is permission-key based (e.g. `leads.view_team`). Built-in roles map to permission sets. Schema supports future custom roles.

### FR-5 Hierarchy

Organizations may define locations, departments, teams, and reporting relationships. Managers see scoped data according to permissions (`*_own`, `*_team`, `*_all`).

### FR-6 Application shell

Authenticated users land in a responsive app shell with the initial navigation destinations as placeholder routes with empty states.

### FR-7 Provider boundaries

Domain interfaces abstract persistence and external systems so Supabase can be swapped or supplemented with Dynamics 365 / Dataverse later.

## Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | TypeScript strict mode |
| NFR-2 | No core business logic embedded in React components |
| NFR-3 | RLS + server-side authorization |
| NFR-4 | Accessible, responsive UI |
| NFR-5 | Lint, typecheck, and unit tests must pass for the milestone |
| NFR-6 | Secrets never committed; `.env.example` contains names only |

## Acceptance criteria

- [ ] Docs exist for vision, requirements, architecture, data model, security, roles, campaign/lead flow, D365 future state, roadmap, and open decisions
- [ ] Mermaid diagrams cover architecture, org hierarchy, campaign→lead journey, lead routing, core ERD, and future D365 architecture
- [ ] Next.js App Router app runs with auth architecture and org-aware shell
- [ ] Migrations define the initial schema with UUIDs and audit columns where appropriate
- [ ] RLS policies enforce organization isolation as a baseline
- [ ] Domain interfaces exist for repositories and providers listed in architecture
- [ ] Quality checks (lint, tsc, unit tests) pass
