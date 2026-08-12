# Product Vision — Growth Operating System

## Purpose

Build a multi-tenant, AI-powered Growth Operating System that helps business owners manage the full commercial journey — from marketing through retention and referrals — while bringing employees, contractors, managers, and teams under one organization.

Advanced Markets and financial services are the first industry accelerator. The core platform remains industry-neutral and must not become an insurance-only CRM.

## Journey the platform owns

```text
Marketing
→ Campaigns
→ Lead Generation
→ Qualification
→ Lead Scoring
→ Lead Routing
→ Sales Pipeline
→ Closing
→ Retention
→ Referrals
```

## Who it serves

| Persona | Intent |
| --- | --- |
| Platform Administrator | Operate the SaaS platform across tenants |
| Organization Owner | Create and govern the organization |
| Organization Administrator | Run day-to-day org configuration |
| Manager | Lead teams, review pipeline and performance |
| Marketing User | Plan and publish campaigns |
| Sales User | Work assigned leads and opportunities |
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
→ Employee
```

Organization owners must be able to create the org, apply branding, invite people, structure departments/teams, assign managers and roles, manage permissions, deactivate users, and view team performance.

## Product principles

1. **Multi-tenant by default** — every protected record belongs to an organization; cross-tenant access is impossible by design.
2. **Industry-neutral core** — vertical accelerators plug in; they do not redefine the product.
3. **Permission-based authorization** — roles compose permissions; custom roles are a first-class future.
4. **Adapter-first integrations** — Supabase is the first implementation; Dynamics 365 / Dataverse can replace or complement persistence and CRM without rewriting the UI.
5. **Clarity over clutter** — premium enterprise SaaS UX with strong typography, generous spacing, and honest empty/loading/error states.

## Initial navigation surface

Home · Campaigns · Leads · Pipeline · Tasks · Calendar · Team · Reports · Settings

Screens are scaffolded first; depth comes with vertical slices.

## First complete vertical slice (target journey)

Organization signup → setup → invite employee → employee joins → create campaign → publish landing page → interactive assessment → lead created → scored → assigned → employee works lead (notes/tasks) → pipeline progression.

**This milestone builds only the foundation required to support that journey.**
