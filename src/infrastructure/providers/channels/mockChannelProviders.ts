import type { CampaignChannelProvider } from "@/domain/interfaces/CampaignChannelProvider";
import type {
  CampaignChannelKey,
  CampaignChannelRun,
  GrowthCampaign,
} from "@/domain/types/campaign-engine";
import type { UUID } from "@/domain/types/base";

function mockRun(
  campaign: GrowthCampaign,
  provider: CampaignChannelKey,
  connectedAccountId: UUID,
  status: CampaignChannelRun["status"] = "pending",
): CampaignChannelRun {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    organization_id: campaign.organization_id,
    campaign_id: campaign.id,
    provider,
    connected_account_id: connectedAccountId,
    external_campaign_id: `mock_${provider}_${campaign.id.slice(0, 8)}`,
    status,
    metrics: {},
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
  };
}

function createMockProvider(provider: CampaignChannelKey): CampaignChannelProvider {
  return {
    provider,
    async validateConnection() {
      return { ok: true, message: `${provider} mock connection valid` };
    },
    async createCampaign(campaign, ctx) {
      return mockRun(campaign, provider, ctx.connectedAccountId, "pending");
    },
    async updateCampaign(run) {
      return { ...run, updated_at: new Date().toISOString() };
    },
    async pauseCampaign(run) {
      return { ...run, status: "paused", updated_at: new Date().toISOString() };
    },
    async resumeCampaign(run) {
      return { ...run, status: "live", updated_at: new Date().toISOString() };
    },
    async getCampaignStatus(run) {
      return run.status;
    },
    async getMetrics() {
      return {
        spend_cents: 0,
        clicks: 0,
        impressions: 0,
        leads: 0,
        qualified_leads: 0,
        appointments: 0,
        conversions: 0,
        revenue_cents: 0,
      };
    },
    async syncLeadEvents() {
      return { synced: 0 };
    },
  };
}

export const MetaAdsProvider = createMockProvider("meta");
export const LinkedInAdsProvider = createMockProvider("linkedin");
export const GoogleAdsProvider = createMockProvider("google");
export const TikTokAdsProvider = createMockProvider("tiktok");
export const EmailCampaignProvider = createMockProvider("email");
export const SmsCampaignProvider = createMockProvider("sms");

export const MOCK_CHANNEL_PROVIDERS: CampaignChannelProvider[] = [
  MetaAdsProvider,
  LinkedInAdsProvider,
  GoogleAdsProvider,
  TikTokAdsProvider,
  EmailCampaignProvider,
  SmsCampaignProvider,
];

export function getChannelProvider(
  key: CampaignChannelKey,
): CampaignChannelProvider {
  const found = MOCK_CHANNEL_PROVIDERS.find((p) => p.provider === key);
  if (!found) throw new Error(`Unknown channel provider: ${key}`);
  return found;
}
