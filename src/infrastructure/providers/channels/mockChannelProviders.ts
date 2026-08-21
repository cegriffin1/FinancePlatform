import type { CampaignChannelProvider } from "@/domain/interfaces/CampaignChannelProvider";
import type {
  CampaignChannelKey,
  CampaignChannelRun,
  GrowthCampaign,
} from "@/domain/types/campaign-engine";
import type { UUID } from "@/domain/types/base";
import {
  CHANNEL_CAPABILITIES,
  type ChannelCapability,
  type ChannelProviderConfig,
  type LiveAdProvider,
  type NormalizedCampaignMetrics,
} from "@/domain/types/social-integrations";
import {
  getIntegrationStore,
  upsertSimConnection,
} from "@/application/integrations/integrationStore";
import { getProviderMode } from "@/infrastructure/security/credentialVault";

function emptyMetrics(): NormalizedCampaignMetrics {
  return {
    impressions: 0,
    reach: 0,
    clicks: 0,
    spend_cents: 0,
    leads: 0,
    qualified_leads: 0,
    appointments: 0,
    conversions: 0,
    revenue_cents: 0,
  };
}

function createRun(
  campaign: GrowthCampaign,
  provider: CampaignChannelKey,
  connectedAccountId: UUID,
  externalId: string,
  status: CampaignChannelRun["status"] = "pending",
): CampaignChannelRun {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    organization_id: campaign.organization_id,
    campaign_id: campaign.id,
    provider,
    connected_account_id: connectedAccountId,
    external_campaign_id: externalId,
    status,
    metrics: {},
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
  };
}

function assertLiveReady(provider: LiveAdProvider) {
  if (getProviderMode() === "LIVE") {
    const required: Record<LiveAdProvider, string[]> = {
      meta: ["META_APP_ID", "META_APP_SECRET"],
      linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
      google: [
        "GOOGLE_ADS_CLIENT_ID",
        "GOOGLE_ADS_CLIENT_SECRET",
        "GOOGLE_ADS_DEVELOPER_TOKEN",
      ],
    };
    const missing = required[provider].filter((k) => !process.env[k]);
    if (missing.length) {
      throw new Error(
        `${provider} LIVE mode requires env: ${missing.join(", ")}. Use SIMULATION until configured.`,
      );
    }
  }
}

export function createAdsProvider(
  provider: LiveAdProvider,
): CampaignChannelProvider {
  const capabilities: ChannelCapability = CHANNEL_CAPABILITIES[provider];

  return {
    provider,
    capabilities,

    async connectAccount(organizationId, authCode) {
      assertLiveReady(provider);
      // LIVE path would exchange authCode for tokens; SIMULATION ignores code shape.
      const connection = upsertSimConnection({
        organizationId,
        provider,
        accountName:
          provider === "meta"
            ? "ALTUS Financial Group Ads"
            : provider === "linkedin"
              ? "ALTUS LinkedIn Ads"
              : "ALTUS Google Ads",
        accountId: `${provider}_${authCode.slice(0, 8) || "sim"}`,
      });
      return {
        connectionId: connection.id,
        accounts: [
          {
            id: connection.provider_account_id!,
            name: connection.display_account_name!,
            currency: "USD",
            status: "active",
          },
        ],
      };
    },

    async disconnectAccount(organizationId, connectionId) {
      const store = getIntegrationStore();
      const conn = store.connections.find(
        (c) =>
          c.id === connectionId &&
          c.organization_id === organizationId &&
          c.provider === provider,
      );
      if (!conn) throw new Error("Connection not found");
      conn.status = "NOT_CONNECTED";
      conn.credential_ref = "";
      conn.last_synced_at = null;
    },

    async validateConnection(ctx) {
      const store = getIntegrationStore();
      const conn = store.connections.find(
        (c) =>
          c.id === ctx.connectedAccountId &&
          c.organization_id === ctx.organizationId &&
          c.provider === provider,
      );
      if (!conn || conn.status !== "CONNECTED") {
        return { ok: false, message: `${provider} account not connected` };
      }
      return { ok: true, message: `${provider} connection valid (${conn.mode})` };
    },

    async refreshCredentials(organizationId, connectionId) {
      const store = getIntegrationStore();
      const conn = store.connections.find(
        (c) =>
          c.id === connectionId &&
          c.organization_id === organizationId &&
          c.provider === provider,
      );
      if (!conn) throw new Error("Connection not found");
      conn.last_refreshed_at = new Date().toISOString();
      conn.token_expires_at = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
      conn.status = "CONNECTED";
    },

    async getAccounts(organizationId) {
      const store = getIntegrationStore();
      return store.connections
        .filter(
          (c) =>
            c.organization_id === organizationId &&
            c.provider === provider &&
            c.status === "CONNECTED",
        )
        .map((c) => ({
          id: c.provider_account_id ?? c.id,
          name: c.display_account_name ?? provider,
          currency: "USD",
          status: "active",
        }));
    },

    async getCampaigns(organizationId, accountId) {
      const store = getIntegrationStore();
      return store.mappings
        .filter(
          (m) =>
            m.organization_id === organizationId &&
            m.provider === provider &&
            m.external_entity_type === "campaign" &&
            m.account_id === accountId,
        )
        .map((m) => ({
          externalId: m.external_entity_id,
          name: `External ${m.external_entity_id}`,
          status: "ACTIVE",
        }));
    },

    async createCampaign(campaign, ctx, channelConfig?: ChannelProviderConfig) {
      assertLiveReady(provider);
      const validation = await this.validateConnection(ctx);
      if (!validation.ok) throw new Error(validation.message);

      const externalId = `${provider}_camp_${campaign.id.slice(0, 8)}_${Date.now().toString(36)}`;
      const run = createRun(
        campaign,
        provider,
        ctx.connectedAccountId,
        externalId,
        "live",
      );

      const store = getIntegrationStore();
      store.mappings.push({
        id: crypto.randomUUID(),
        organization_id: ctx.organizationId,
        provider,
        internal_entity_type: "campaign",
        internal_entity_id: campaign.id,
        external_entity_type: "campaign",
        external_entity_id: externalId,
        account_id:
          store.connections.find((c) => c.id === ctx.connectedAccountId)
            ?.provider_account_id ?? null,
        created_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      });

      if (provider === "meta" && channelConfig?.provider === "meta") {
        store.mappings.push({
          id: crypto.randomUUID(),
          organization_id: ctx.organizationId,
          provider,
          internal_entity_type: "campaign_channel",
          internal_entity_id: campaign.id,
          external_entity_type: "ad_set",
          external_entity_id: `${externalId}_adset`,
          account_id: store.mappings.at(-1)?.account_id ?? null,
          created_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        });
      }

      return run;
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

    async archiveCampaign(run) {
      return { ...run, status: "completed", updated_at: new Date().toISOString() };
    },

    async getCampaignStatus(run) {
      return run.status;
    },

    async getCampaignMetrics(run) {
      const store = getIntegrationStore();
      const snaps = store.metrics.filter(
        (m) => m.campaign_id === run.campaign_id && m.provider === provider,
      );
      if (snaps.length === 0) {
        // simulation defaults
        return {
          impressions: 1200,
          reach: 980,
          clicks: 84,
          spend_cents: 18500,
          leads: 6,
          qualified_leads: 3,
          appointments: 1,
          conversions: 1,
          revenue_cents: 0,
          raw: { simulated: true },
        };
      }
      return snaps.reduce(
        (acc, s) => ({
          impressions: acc.impressions + s.metrics.impressions,
          reach: acc.reach + s.metrics.reach,
          clicks: acc.clicks + s.metrics.clicks,
          spend_cents: acc.spend_cents + s.metrics.spend_cents,
          leads: acc.leads + s.metrics.leads,
          qualified_leads: acc.qualified_leads + s.metrics.qualified_leads,
          appointments: acc.appointments + s.metrics.appointments,
          conversions: acc.conversions + s.metrics.conversions,
          revenue_cents: acc.revenue_cents + s.metrics.revenue_cents,
        }),
        emptyMetrics(),
      );
    },

    async getMetrics(run) {
      return this.getCampaignMetrics(run);
    },

    async getLeadForms() {
      if (!capabilities.supportsLeadForms) return [];
      return [{ id: `${provider}_form_1`, name: `${provider} Lead Form` }];
    },

    async syncLeads() {
      return { synced: 0, leadExternalIds: [] };
    },

    async syncLeadEvents() {
      return { synced: 0 };
    },
  };
}

export const MetaAdsProvider = createAdsProvider("meta");
export const LinkedInAdsProvider = createAdsProvider("linkedin");
export const GoogleAdsProvider = createAdsProvider("google");

/** Coming-soon stubs retain prior mock behavior without live publish path. */
function comingSoon(provider: CampaignChannelKey): CampaignChannelProvider {
  const base = createAdsProvider("meta");
  return {
    ...base,
    provider,
    capabilities: {
      ...CHANNEL_CAPABILITIES.meta,
      supportsLeadForms: false,
      supportsNativeLeadCapture: false,
      supportsCampaignSubtypes: [],
    },
    async connectAccount() {
      throw new Error(`${provider} is not enabled in this milestone`);
    },
    async createCampaign() {
      throw new Error(`${provider} publishing is not enabled`);
    },
  };
}

export const TikTokAdsProvider = comingSoon("tiktok");
export const EmailCampaignProvider = comingSoon("email");
export const SmsCampaignProvider = comingSoon("sms");

export const SOCIAL_CHANNEL_PROVIDERS: CampaignChannelProvider[] = [
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
  const found = SOCIAL_CHANNEL_PROVIDERS.find((p) => p.provider === key);
  if (!found) throw new Error(`Unknown channel provider: ${key}`);
  return found;
}
