# Lead Ingestion

## Paths

1. **ALTUS landing page** — `/c/{org}/{slug}` with UTM + provider click IDs
2. **Native lead forms** — Meta / LinkedIn webhooks → normalized ingestion

## Native flow

1. Verify webhook signature
2. Deduplicate `provider + external_event_id`
3. Resolve external campaign → ALTUS campaign via `external_record_mappings`
4. Normalize contact
5. Create lead + immutable attribution (includes `ad_provider`, `external_campaign_id`)
6. Score → classify → distribute (existing growth engine)
7. Notify assignee
8. Audit `provider.lead_ingested`

## Endpoints

- `/api/webhooks/meta`
- `/api/webhooks/linkedin`
- `/api/webhooks/google`
