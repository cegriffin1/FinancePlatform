import { randomUUID } from "crypto";
import {
  appendAudit,
  getIntegrationStore,
} from "@/application/integrations/integrationStore";
import { getChannelProvider } from "@/infrastructure/providers/channels/mockChannelProviders";
import { enqueueJob } from "@/infrastructure/jobs/jobQueue";
import { getProviderMode } from "@/infrastructure/security/credentialVault";
import type { GrowthCampaign } from "@/domain/types/campaign-engine";
import type {
  ChannelProviderConfig,
  LiveAdProvider,
  ProviderError,
} from "@/domain/types/social-integrations";
import { LIVE_AD_PROVIDERS } from "@/domain/types/social-integrations";

export type PublishInput = {
  organizationId: string;
  campaign: Omit<GrowthCampaign, "status"> & { status: string };
  channelConfigs: ChannelProviderConfig[];
  approvedBy: string | null;
  confirmationAccepted: boolean;
  permissions: string[];
};

export type PublishResult = {
  status: "publishing" | "active" | "publish_failed";
  runs: Array<{
    provider: LiveAdProvider;
    external_campaign_id: string | null;
    status: string;
    error?: string;
  }>;
  errors: ProviderError[];
};

function humanError(provider: LiveAdProvider, message: string): ProviderError {
  return {
    provider,
    operation: "publish",
    external_code: null,
    internal_code: "PUBLISH_FAILED",
    message,
    retryable: false,
    timestamp: new Date().toISOString(),
  };
}

export class CampaignPublishingService {
  validate(input: PublishInput): string[] {
    const errors: string[] = [];
    if (!input.confirmationAccepted) {
      errors.push("Explicit publish confirmation is required.");
    }
    if (!input.permissions.includes("campaigns.publish")) {
      errors.push("Missing permission: campaigns.publish");
    }
    if (!input.permissions.includes("campaigns.approve")) {
      errors.push("Missing permission: campaigns.approve");
    }
    if (!input.campaign.budget_cents || input.campaign.budget_cents <= 0) {
      errors.push("Campaign budget is required before publishing.");
    }
    if (!input.campaign.territories.length) {
      errors.push("Territory is required.");
    }
    if (!input.campaign.destination) {
      errors.push("Destination is required.");
    }
    if (!input.channelConfigs.length) {
      errors.push("At least one channel configuration is required.");
    }
    return errors;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const validationErrors = this.validate(input);
    if (validationErrors.length) {
      return {
        status: "publish_failed",
        runs: [],
        errors: validationErrors.map((message) =>
          humanError("meta", message),
        ),
      };
    }

    // Guard: automated tests / non-LIVE never hit real APIs
    if (getProviderMode() === "LIVE" && process.env.ALLOW_LIVE_AD_PUBLISH !== "true") {
      return {
        status: "publish_failed",
        runs: [],
        errors: [
          humanError(
            "meta",
            "LIVE publishing is disabled until ALLOW_LIVE_AD_PUBLISH=true is set.",
          ),
        ],
      };
    }

    const store = getIntegrationStore();
    const runs: PublishResult["runs"] = [];
    const errors: ProviderError[] = [];

    for (const channel of input.channelConfigs) {
      if (!LIVE_AD_PROVIDERS.includes(channel.provider)) continue;
      const provider = channel.provider;
      const connection = store.connections.find(
        (c) =>
          c.organization_id === input.organizationId &&
          c.provider === provider &&
          c.status === "CONNECTED",
      );
      if (!connection) {
        errors.push(
          humanError(provider, `Connect ${provider} before publishing.`),
        );
        runs.push({
          provider,
          external_campaign_id: null,
          status: "failed",
          error: "Not connected",
        });
        continue;
      }

      const idempotencyKey = `publish:${input.campaign.id}:${provider}`;
      const existing = store.publishes.find(
        (p) =>
          p.idempotency_key === idempotencyKey && p.status === "published",
      );
      if (existing) {
        runs.push({
          provider,
          external_campaign_id: existing.external_campaign_id,
          status: "active",
        });
        continue;
      }

      try {
        const adapter = getChannelProvider(provider);
        const run = await adapter.createCampaign(
          input.campaign as GrowthCampaign,
          {
            organizationId: input.organizationId,
            connectedAccountId: connection.id,
            mode: connection.mode,
          },
          channel,
        );

        store.publishes.push({
          id: randomUUID(),
          organization_id: input.organizationId,
          campaign_id: input.campaign.id,
          provider,
          idempotency_key: idempotencyKey,
          status: "published",
          external_campaign_id: run.external_campaign_id,
          error: null,
          created_at: new Date().toISOString(),
        });

        appendAudit({
          organization_id: input.organizationId,
          actor_profile_id: input.approvedBy,
          action: "campaign.published",
          entity_type: "campaign",
          entity_id: input.campaign.id,
          metadata: {
            provider,
            external_campaign_id: run.external_campaign_id,
            mode: getProviderMode(),
          },
        });

        enqueueJob({
          type: "sync_metrics",
          organization_id: input.organizationId,
          payload: {
            campaignId: input.campaign.id,
            provider,
            runId: run.id,
            connectionId: connection.id,
          },
          idempotency_key: `metrics:${input.campaign.id}:${provider}`,
        });

        runs.push({
          provider,
          external_campaign_id: run.external_campaign_id,
          status: "active",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to publish to this channel.";
        errors.push(humanError(provider, message));
        store.publishes.push({
          id: randomUUID(),
          organization_id: input.organizationId,
          campaign_id: input.campaign.id,
          provider,
          idempotency_key: idempotencyKey,
          status: "failed",
          external_campaign_id: null,
          error: message,
          created_at: new Date().toISOString(),
        });
        appendAudit({
          organization_id: input.organizationId,
          actor_profile_id: input.approvedBy,
          action: "provider.error",
          entity_type: "campaign",
          entity_id: input.campaign.id,
          metadata: { provider, message },
        });
        runs.push({
          provider,
          external_campaign_id: null,
          status: "failed",
          error: message,
        });
      }
    }

    const status =
      errors.length === 0
        ? "active"
        : runs.some((r) => r.status === "active")
          ? "publishing"
          : "publish_failed";

    return { status, runs, errors };
  }
}
