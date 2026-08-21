# Campaign Publishing

`CampaignPublishingService` validates and publishes ALTUS campaigns through provider adapters.

## Flow

DRAFT → READY_FOR_REVIEW → APPROVED → PUBLISHING → ACTIVE  
On failure: PUBLISH_FAILED

## Validations

- Explicit confirmation checkbox
- `campaigns.publish` + `campaigns.approve`
- Connected provider account for org
- Budget, territory, destination, channel config
- Idempotency key `publish:{campaignId}:{provider}` prevents duplicate external campaigns

## Jobs

Publishing enqueues `sync_metrics` jobs (dev queue with exponential backoff).

## UI

Campaign detail `/app/campaigns/[id]` shows preview tabs and a charged-language confirmation before Publish.
