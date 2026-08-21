/** Social advertising channel domain types — normalized ALTUS shapes. */

import type { UUID } from "@/domain/types/base";
import type { CampaignChannelKey } from "@/domain/types/campaign-engine";

export const INTEGRATION_CONNECTION_STATUSES = [
  "NOT_CONNECTED",
  "CONNECTING",
  "CONNECTED",
  "ACTION_REQUIRED",
  "EXPIRED",
  "ERROR",
] as const;

export type IntegrationConnectionStatus =
  (typeof INTEGRATION_CONNECTION_STATUSES)[number];

export const PROVIDER_MODES = ["SIMULATION", "LIVE"] as const;
export type ProviderMode = (typeof PROVIDER_MODES)[number];

export const LIVE_AD_PROVIDERS = ["meta", "linkedin", "google"] as const;
export type LiveAdProvider = (typeof LIVE_AD_PROVIDERS)[number];

export type ChannelCapability = {
  supportsImages: boolean;
  supportsVideo: boolean;
  supportsLeadForms: boolean;
  supportsSearchKeywords: boolean;
  supportsCompanyTargeting: boolean;
  supportsJobTitleTargeting: boolean;
  supportsCustomAudience: boolean;
  supportsRetargeting: boolean;
  supportsBudgetOptimization: boolean;
  supportsNativeLeadCapture: boolean;
  supportsPlacements: boolean;
  supportsCampaignSubtypes: string[];
};

export type ProviderAccount = {
  id: string;
  name: string;
  currency?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderCampaignSummary = {
  externalId: string;
  name: string;
  status: string;
  spendCents?: number;
};

export type NormalizedCampaignMetrics = {
  impressions: number;
  reach: number;
  clicks: number;
  spend_cents: number;
  leads: number;
  qualified_leads: number;
  appointments: number;
  conversions: number;
  revenue_cents: number;
  raw?: Record<string, unknown>;
};

export type ProviderCredentialRecord = {
  id: UUID;
  organization_id: UUID;
  provider: LiveAdProvider;
  status: IntegrationConnectionStatus;
  mode: ProviderMode;
  provider_account_id: string | null;
  provider_business_id: string | null;
  scopes: string[];
  connected_by: UUID | null;
  connected_at: string | null;
  last_refreshed_at: string | null;
  last_synced_at: string | null;
  token_expires_at: string | null;
  /** Opaque encrypted blob reference — never send to browser. */
  credential_ref: string;
  last_error: string | null;
  permissions_summary: string[];
  display_account_name: string | null;
};

export type ExternalRecordMapping = {
  id: UUID;
  organization_id: UUID;
  provider: LiveAdProvider | CampaignChannelKey;
  internal_entity_type: string;
  internal_entity_id: UUID;
  external_entity_type: string;
  external_entity_id: string;
  account_id: string | null;
  created_at: string;
  last_synced_at: string | null;
};

export type ProviderError = {
  provider: LiveAdProvider | CampaignChannelKey;
  operation: string;
  external_code: string | null;
  internal_code: string;
  message: string;
  retryable: boolean;
  timestamp: string;
};

export type ProviderWebhookEvent = {
  id: UUID;
  organization_id: UUID | null;
  provider: LiveAdProvider;
  external_event_id: string;
  event_type: string;
  received_at: string;
  processing_status: "received" | "processed" | "duplicate" | "failed";
  payload_reference: string;
  processed_at: string | null;
  error: string | null;
};

export type MetaChannelConfig = {
  placements: Array<"facebook" | "instagram">;
  objective: string;
  daily_budget_cents: number | null;
  page_id?: string | null;
  instagram_account_id?: string | null;
  creative_asset_id?: string | null;
  cta: string;
};

export type LinkedInChannelConfig = {
  company_sizes?: string[];
  industries?: string[];
  job_seniority?: string[];
  locations?: string[];
  creative_asset_id?: string | null;
  daily_budget_cents: number | null;
};

export type GoogleChannelConfig = {
  subtype: "search" | "display" | "video" | "performance_max";
  keywords: Array<{ text: string; match_type: "exact" | "phrase" | "broad" }>;
  headlines: string[];
  descriptions: string[];
  geography: string[];
  daily_budget_cents: number | null;
  creative_asset_id?: string | null;
};

export type ChannelProviderConfig =
  | { provider: "meta"; config: MetaChannelConfig }
  | { provider: "linkedin"; config: LinkedInChannelConfig }
  | { provider: "google"; config: GoogleChannelConfig };

export type CreativeAsset = {
  id: UUID;
  organization_id: UUID;
  asset_type: "image" | "video" | "copy";
  file_reference: string | null;
  headline: string;
  body: string;
  cta: string;
  destination_url: string | null;
  status: "draft" | "active" | "archived";
  created_by: UUID | null;
  created_at: string;
};

export type CampaignPublishStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "publishing"
  | "active"
  | "publish_failed"
  | "paused";

export type PublishAuditEvent = {
  id: UUID;
  organization_id: UUID;
  actor_profile_id: UUID | null;
  action: string;
  entity_type: string;
  entity_id: UUID | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export const CHANNEL_CAPABILITIES: Record<LiveAdProvider, ChannelCapability> = {
  meta: {
    supportsImages: true,
    supportsVideo: true,
    supportsLeadForms: true,
    supportsSearchKeywords: false,
    supportsCompanyTargeting: false,
    supportsJobTitleTargeting: false,
    supportsCustomAudience: true,
    supportsRetargeting: true,
    supportsBudgetOptimization: true,
    supportsNativeLeadCapture: true,
    supportsPlacements: true,
    supportsCampaignSubtypes: ["traffic", "leads", "awareness"],
  },
  linkedin: {
    supportsImages: true,
    supportsVideo: true,
    supportsLeadForms: true,
    supportsSearchKeywords: false,
    supportsCompanyTargeting: true,
    supportsJobTitleTargeting: true,
    supportsCustomAudience: true,
    supportsRetargeting: true,
    supportsBudgetOptimization: true,
    supportsNativeLeadCapture: true,
    supportsPlacements: false,
    supportsCampaignSubtypes: ["sponsored_content", "message"],
  },
  google: {
    supportsImages: false,
    supportsVideo: false,
    supportsLeadForms: false,
    supportsSearchKeywords: true,
    supportsCompanyTargeting: false,
    supportsJobTitleTargeting: false,
    supportsCustomAudience: true,
    supportsRetargeting: true,
    supportsBudgetOptimization: true,
    supportsNativeLeadCapture: false,
    supportsPlacements: false,
    supportsCampaignSubtypes: ["search", "display", "video", "performance_max"],
  },
};
