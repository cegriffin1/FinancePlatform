import type {
  CampaignChannelKey,
  CampaignChannelRun,
  GrowthCampaign,
} from "@/domain/types/campaign-engine";
import type { UUID } from "@/domain/types/base";
import type {
  ChannelCapability,
  ChannelProviderConfig,
  NormalizedCampaignMetrics,
  ProviderAccount,
  ProviderCampaignSummary,
  ProviderMode,
} from "@/domain/types/social-integrations";

export type ChannelConnectionContext = {
  organizationId: UUID;
  connectedAccountId: UUID;
  mode?: ProviderMode;
};

/**
 * Adapter boundary for social/ad publishers.
 * Vendor responses must be normalized before leaving the provider.
 */
export interface CampaignChannelProvider {
  readonly provider: CampaignChannelKey;
  readonly capabilities: ChannelCapability;

  connectAccount(
    organizationId: UUID,
    authCode: string,
  ): Promise<{ connectionId: UUID; accounts: ProviderAccount[] }>;
  disconnectAccount(organizationId: UUID, connectionId: UUID): Promise<void>;
  validateConnection(
    ctx: ChannelConnectionContext,
  ): Promise<{ ok: boolean; message: string }>;
  refreshCredentials(organizationId: UUID, connectionId: UUID): Promise<void>;
  getAccounts(organizationId: UUID): Promise<ProviderAccount[]>;
  getCampaigns(
    organizationId: UUID,
    accountId: string,
  ): Promise<ProviderCampaignSummary[]>;
  createCampaign(
    campaign: GrowthCampaign,
    ctx: ChannelConnectionContext,
    channelConfig?: ChannelProviderConfig,
  ): Promise<CampaignChannelRun>;
  updateCampaign(
    run: CampaignChannelRun,
    campaign: GrowthCampaign,
  ): Promise<CampaignChannelRun>;
  pauseCampaign(run: CampaignChannelRun): Promise<CampaignChannelRun>;
  resumeCampaign(run: CampaignChannelRun): Promise<CampaignChannelRun>;
  archiveCampaign(run: CampaignChannelRun): Promise<CampaignChannelRun>;
  getCampaignStatus(run: CampaignChannelRun): Promise<CampaignChannelRun["status"]>;
  getCampaignMetrics(run: CampaignChannelRun): Promise<NormalizedCampaignMetrics>;
  /** @deprecated Prefer getCampaignMetrics */
  getMetrics(run: CampaignChannelRun): Promise<NormalizedCampaignMetrics>;
  getLeadForms(
    organizationId: UUID,
    accountId: string,
  ): Promise<Array<{ id: string; name: string }>>;
  syncLeads(run: CampaignChannelRun): Promise<{ synced: number; leadExternalIds: string[] }>;
  /** @deprecated Prefer syncLeads */
  syncLeadEvents(run: CampaignChannelRun): Promise<{ synced: number }>;
}
