# Open Decisions

Decisions deferred intentionally during platform foundation.

| ID | Topic | Options | Notes |
| --- | --- | --- | --- |
| OD-1 | Auth methods for v1 | Magic link vs password vs both | Supabase supports both; product preference TBD |
| OD-2 | Single vs multi-org users in UI | Force one active org vs org switcher | Schema already allows multi-membership |
| OD-3 | Soft delete vs status flags | `deleted_at` vs `status=inactive` | Prefer status for people; TBD for campaigns |
| OD-4 | Custom roles timing | Milestone 2 vs later | Schema supports it; admin UX not built |
| OD-5 | Lead vs contact canonical model | Lead-first vs contact-first | Both tables exist; assessment flow will decide |
| OD-6 | Scoring model | Rule-based vs ML-assisted | Interface only for now |
| OD-7 | Routing model | Round-robin, territory, load-based | Interface only for now |
| OD-8 | Primary CRM system of record long-term | Supabase vs Dataverse | Adapter pattern keeps this reversible |
| OD-9 | File storage conventions | Bucket-per-org vs path prefix | Path prefix proposed |
| OD-10 | Platform admin tenancy | Separate schema vs `is_platform_admin` | Needs explicit design before platform console |
| OD-11 | Email/SMS provider for invites | Supabase native vs ACS | ACS behind CommunicationProvider later |
| OD-12 | Monorepo vs single app | Keep single Next app | Revisit if packages grow |

Update this file when decisions are made; move resolved items into architecture/security docs.
