import type {
  CampaignChannelKey,
  CampaignChannelRun,
  GrowthCampaign,
} from "@/domain/types/campaign-engine";
import type { UUID } from "@/domain/types/base";

export type ChannelConnectionContext = {
  organizationId: UUID;
  connectedAccountId: UUID;
};

export type ChannelCampaignMetrics = {
  spend_cents: number;
  clicks: number;
  impressions: number;
  leads: number;
  qualified_leads: number;
  appointments: number;
  conversions: number;
  revenue_cents: number;
};

/**
 * Adapter boundary for social/ad/email/SMS publishers.
 * Live APIs are not required in Phase 1 — use mocked providers.
 */
export interface CampaignChannelProvider {
  readonly provider: CampaignChannelKey;
  validateConnection(ctx: ChannelConnectionContext): Promise<{ ok: boolean; message: string }>;
  createCampaign(
    campaign: GrowthCampaign,
    ctx: ChannelConnectionContext,
  ): Promise<CampaignChannelRun>;
  updateCampaign(
    run: CampaignChannelRun,
    campaign: GrowthCampaign,
  ): Promise<CampaignChannelRun>;
  pauseCampaign(run: CampaignChannelRun): Promise<CampaignChannelRun>;
  resumeCampaign(run: CampaignChannelRun): Promise<CampaignChannelRun>;
  getCampaignStatus(run: CampaignChannelRun): Promise<CampaignChannelRun["status"]>;
  getMetrics(run: CampaignChannelRun): Promise<ChannelCampaignMetrics>;
  syncLeadEvents(run: CampaignChannelRun): Promise<{ synced: number }>;
}
