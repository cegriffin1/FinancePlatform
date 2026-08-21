# Open Decisions

Decisions deferred intentionally. Update when resolved.

| ID | Topic | Options | Notes |
| --- | --- | --- | --- |
| OD-1 | Auth methods for v1 | Magic link vs password vs both | Supabase supports both |
| OD-2 | Single vs multi-org users in UI | Force one active org vs org switcher | Schema allows multi-membership |
| OD-3 | Soft delete vs status flags | `deleted_at` vs `status=inactive` | Prefer status for people |
| OD-4 | Custom roles timing | With team hierarchy vs later | Schema supports it |
| OD-5 | Lead vs contact canonical model | Lead-first vs contact-first | Assessment flow will decide |
| OD-6 | Scoring model | Rule-based vs ML-assisted | Event-driven rules first; AI later |
| OD-7 | Routing model | Round-robin, territory, load-based | Configurable policy engine |
| OD-8 | Primary CRM system of record long-term | Supabase vs Dataverse | Adapter pattern keeps reversible |
| OD-9 | File storage conventions | Bucket-per-org vs path prefix | Path prefix proposed |
| OD-10 | Platform admin tenancy | Separate schema vs `is_platform_admin` | Needs design before platform console |
| OD-11 | Email/SMS provider for invites | Supabase native vs ACS | ACS behind CommunicationProvider later |
| OD-12 | Monorepo vs single app | Keep single Next app | Revisit if packages grow |
| OD-13 | Temperature vocabulary | Global defaults vs per-org keys | Defaults COLD/WARM/HOT/PRIORITY; configurable |
| OD-14 | Stage 2 qualification timing | After appointment vs optional deep link | Must not block Stage 1 |
| OD-15 | Lead extension table for AM | None vs `am_lead_profiles` | Prefer none until required |
| OD-16 | Recycle ownership defaults | Platform vs org policy packs | Never timer-only |
| OD-17 | Marketplace operator | Platform-operated vs org exchange | Future module |
| OD-18 | Billing provider | Stripe vs other | Interface only for now |
| OD-19 | Agent license verification | Self-attested vs third-party | No regulatory determination in code |
| OD-20 | AI feature gating | Org entitlement vs platform flag | Explain/next-action only; no autonomous advice |
