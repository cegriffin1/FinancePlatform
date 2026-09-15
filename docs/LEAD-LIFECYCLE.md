# Lead Lifecycle

## Inventory statuses

`NEW` → `QUALIFIED` → `PURCHASED_ASSIGNED` / `ACTIVE_OWNERSHIP` → `EXPIRING` → `RELEASED` → `MARKETPLACE_ELIGIBLE` → `MARKETPLACE` → `REPURCHASED`

Also: `SUPPRESSED`, `NOT_ELIGIBLE_FOR_RESALE`, `SOLD`

## Ownership

- Configurable period (default **60 days** via `ownership_config` / `inventory_config`)
- Fields: owner, organization, assigned_at, ownership_started_at, ownership_expires_at, source
- Append-only `ownership_history` on each assign

## Compliance gate before marketplace

A lead is **never** purchasable unless:

- contact consent
- data sharing permitted
- resale permitted
- not suppressed
- jurisdiction not restricted
- within retention policy
- valid consent basis on file

## Aging

- `original_score` / `original_temperature` are immutable once set
- `current_score` / `current_temperature` may decay
- Assessment answers and score history are not rewritten

## Partial recovery

- Client session restore for in-progress assessments
- Server draft (`/api/public/assessment-progress`) only when consensual contact exists
- Unanswered questions are never fabricated
