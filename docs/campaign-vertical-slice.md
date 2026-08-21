# Campaign Growth Engine — Vertical Slice

## Journey

Create Campaign → Configure → Launch (`ACTIVE_SIMULATION`) → Public `/c/{org}/{slug}` → Assessment → Lead + immutable attribution → Score → Classify → Eligibility → Distribute → CRM lead detail → Event timeline

## Key routes

- `/app/campaigns` (alias `/campaigns`)
- `/app/campaigns/new` (alias `/campaigns/new`)
- `/c/[organizationSlug]/[campaignSlug]`
- `/app/leads` · `/app/leads/[id]`
- `/app/admin/lead-distribution` (alias `/admin/lead-distribution`)

## Dev-only

`POST /api/dev/generate-test-lead` — blocked in production.

## Ownership

- Platform campaigns → ALTUS pool → Premier preference after eligibility
- Subscriber campaigns → stay with subscriber org
