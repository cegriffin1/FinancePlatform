# Product Vision — Growth Operating System

## Purpose

Build a multi-tenant, AI-powered **Growth + Distribution Operating System** that helps organizations manage the full commercial journey — from marketing through retention and referrals — while bringing employees, contractors, managers, and teams under one organization.

This is **not** “a website that sells leads.” The product orchestrates:

```text
Campaign → Qualification → Intelligence → Distribution → CRM → Follow-Up → Conversion → Analytics
```

## Two-layer product model

```text
CORE PLATFORM (industry-neutral)
+
INDUSTRY ACCELERATORS (pluggable vertical modules)
```

| Layer | Responsibility |
| --- | --- |
| **Core Platform** | Multi-tenant org/auth/teams, CRM primitives, campaigns, leads, pipeline, events, scoring/routing engines, communications, analytics boundaries |
| **Industry Accelerators** | Vertical templates, qualification content, strategy classifications, licensing/distribution rules, entitlements overlays |
| **First accelerator** | **Advanced Markets** — insurance and financial professionals serving business owners and high-value prospects |
| **Future accelerators** | Additional industries without rebuilding core |

Advanced Markets must **extend** the platform — never redefine the core `Lead` into an insurance-only entity.

## Journey the platform owns

```text
Marketing
→ Campaign
→ Interactive Qualification
→ Lead Capture
→ Lead Intelligence
→ Lead Scoring
→ Lead Classification
→ Appointment
→ Lead Routing
→ Agent/Advisor
→ CRM
→ Follow-Up
→ Opportunity
→ Closing
→ Retention
→ Referral
```

The platform captures the **entire customer journey**, not merely contact information.

## Who it serves

| Persona | Intent |
| --- | --- |
| Platform Administrator | Operate the SaaS platform across tenants |
| Organization Owner | Create and govern the organization |
| Organization Administrator | Run day-to-day org configuration |
| Manager | Lead teams, review pipeline and performance |
| Marketing User | Plan and publish campaigns |
| Sales User / Agent / Advisor | Work assigned leads and opportunities |
| Employee | Execute assigned work within permissions |
| Contractor | Participate with scoped access |

## Organization hierarchy

```text
Platform
→ Organization
→ Location
→ Department
→ Team
→ Manager
→ Employee / Agent / Contractor
```

## Product principles

1. **Multi-tenant by default** — every protected record belongs to an organization; cross-tenant access is impossible by design.
2. **Industry-neutral core** — accelerators plug in; they do not redefine the product.
3. **Permission-based authorization** — roles compose permissions; custom roles are first-class.
4. **Configurable intelligence** — scoring, temperature, routing, recycling, and qualification are policy-driven — not hard-coded in UI.
5. **Immutable provenance** — acquisition source survives ownership and status changes.
6. **Adapter-first integrations** — Supabase first; Dynamics 365 / Dataverse later without UI rewrites.
7. **Compliance-aware** — consent, opt-out, audit, licensing/territory controls, versioned qualification — without claiming the software determines regulatory eligibility.
8. **Clarity over clutter** — premium enterprise SaaS UX with strong typography, generous spacing, and honest empty/loading/error states.

## Initial navigation surface

Home · Campaigns · Leads · Pipeline · Tasks · Calendar · Team · Reports · Settings

Agent and organization dashboards deepen later (see architecture docs).

## Near-term vertical slice

Organization signup → setup → invite employee → employee joins → create campaign (from catalog/template) → publish qualification experience → Stage 1 engagement → lead + events + score + classification → route (eligibility-aware) → agent works lead → nurture/recycle policies → pipeline.
