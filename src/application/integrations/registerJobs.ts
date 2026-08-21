import { CampaignMetricsSyncService } from "@/application/integrations/CampaignMetricsSyncService";
import { registerJobHandler, drainJobs } from "@/infrastructure/jobs/jobQueue";
import type { LiveAdProvider } from "@/domain/types/social-integrations";

let registered = false;

export function ensureIntegrationJobHandlers() {
  if (registered) return;
  registered = true;

  const metrics = new CampaignMetricsSyncService();

  registerJobHandler("sync_metrics", async (job) => {
    const { campaignId, provider, connectionId } = job.payload as {
      campaignId: string;
      provider: LiveAdProvider;
      connectionId: string;
    };
    if (!job.organization_id) throw new Error("organization_id required");
    await metrics.syncCampaignChannel({
      organizationId: job.organization_id,
      campaignId,
      provider,
      connectionId,
    });
  });

  registerJobHandler("publish_campaign", async () => {
    // Publishing is synchronous via CampaignPublishingService; job reserved for retries.
  });

  registerJobHandler("refresh_credentials", async () => {
    // Handled by provider.refreshCredentials in API routes.
  });

  registerJobHandler("process_lead_webhook", async () => {
    // Webhooks process inline with durable event records; job reserved for retries.
  });

  registerJobHandler("sync_campaign_status", async () => {});
  registerJobHandler("retry_failed_sync", async () => {});
}

export async function runQueuedIntegrationJobs(limit = 10) {
  ensureIntegrationJobHandlers();
  return drainJobs(limit);
}
