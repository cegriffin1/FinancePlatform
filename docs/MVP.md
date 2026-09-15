# ALTUS MVP

Controlled production pilot guide for the ALTUS retirement lead platform.

## What the MVP includes

- Social campaign landing + interactive assessment
- Attribution capture
- Opportunity Score, Temperature, Asset Tier
- Setter verification + appointment + agent handoff
- ALTUS CRM (pipeline, follow-ups, outcomes)
- Lead ownership, aging, marketplace eligibility
- Executive analytics + MVP ops control center (`/admin/mvp`)

## What the MVP is not

- Full Dynamics 365 replacement
- Certified compliance product
- Live paid media optimization suite (provider adapters may be simulated)

## Pilot journey

Social Campaign → Landing → Assessment → Attribution → Score/Temperature/Tier → Setter → Appointment → Agent CRM → Follow-up → Outcome → Aging → Marketplace eligibility

## Key routes

| Route | Purpose |
|-------|---------|
| `/c/[org]/[campaign]` | Public assessment |
| `/setter` | Setter queue |
| `/app` | Agent home |
| `/app/pipeline` | CRM pipeline |
| `/app/leads/[id]` | Lead workspace |
| `/marketplace` | Compliant lead marketplace |
| `/admin/mvp` | Pilot control center |
| `/app/analytics/executive` | Executive funnel |

## Primary KPI

**Cost Per Qualified Opportunity** — not cheapest lead.

## Related docs

- [LEAD-LIFECYCLE.md](./LEAD-LIFECYCLE.md)
- [SCORING.md](./SCORING.md)
- [SETTER-WORKFLOW.md](./SETTER-WORKFLOW.md)
- [CAMPAIGN-FUNNEL.md](./CAMPAIGN-FUNNEL.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [KNOWN-LIMITATIONS.md](./KNOWN-LIMITATIONS.md)
