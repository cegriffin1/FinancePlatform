/** Campaign growth-engine domain model — Phase 1. */

import type { AuditFields, UUID } from "@/domain/types/base";

export const CAMPAIGN_OWNER_TYPES = [
  "ALTUS_PLATFORM_CAMPAIGN",
  "SUBSCRIBER_CAMPAIGN",
] as const;

export type CampaignOwnerType = (typeof CAMPAIGN_OWNER_TYPES)[number];

export const CAMPAIGN_WORKFLOW_STATUSES = [
  "draft",
  "review",
  "approved",
  "scheduled",
  "active",
  "paused",
  "completed",
  "archived",
] as const;

export type CampaignWorkflowStatus = (typeof CAMPAIGN_WORKFLOW_STATUSES)[number];

export const CAMPAIGN_GOALS = [
  "generate_leads",
  "book_appointments",
  "promote_strategy",
  "build_awareness",
  "download_resource",
  "webinar_event",
  "retarget_existing_leads",
] as const;

export type CampaignGoal = (typeof CAMPAIGN_GOALS)[number];

export const CAMPAIGN_STRATEGIES = [
  "Business Growth",
  "Tax Strategy",
  "Succession",
  "Key Employee Strategy",
  "Executive Benefits",
  "Protection",
  "Retirement",
  "Premium Financing",
  "Other",
] as const;

export type CampaignStrategyKey = (typeof CAMPAIGN_STRATEGIES)[number] | (string & {});

export const CAMPAIGN_CHANNELS = [
  "meta",
  "linkedin",
  "google",
  "tiktok",
  "email",
  "sms",
] as const;

export type CampaignChannelKey = (typeof CAMPAIGN_CHANNELS)[number];

export const CAMPAIGN_DESTINATIONS = [
  "interactive_assessment",
  "landing_page",
  "appointment_page",
  "resource_download",
  "lead_form",
  "webinar_registration",
] as const;

export type CampaignDestination = (typeof CAMPAIGN_DESTINATIONS)[number];

export const SUBSCRIPTION_TIERS = [
  "STANDARD",
  "PRO",
  "PREMIER",
  "ENTERPRISE",
] as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const DISTRIBUTION_METHODS = [
  "priority_tier",
  "round_robin",
  "weighted_round_robin",
  "territory",
  "strategy_specialist",
  "lowest_workload",
  "highest_conversion",
  "campaign_owner",
  "manual",
  "marketplace_pool",
] as const;

export type DistributionMethod = (typeof DISTRIBUTION_METHODS)[number];

export type CampaignAudience = {
  personas?: Array<"business_owner" | "executive" | "professional">;
  industry?: string | null;
  company_size?: string | null;
  revenue_range?: string | null;
  geography?: string[];
  interests?: string[];
  relationship?: "existing_customer" | "prospect" | "any";
};

export type CampaignBranding = {
  logo_url?: string | null;
  primary_color?: string | null;
  advisor_photo_url?: string | null;
  advisor_name?: string | null;
  organization_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  custom_cta?: string | null;
  thank_you_message?: string | null;
};

export type GrowthCampaign = AuditFields & {
  id: UUID;
  /** Subscriber org for SUBSCRIBER_CAMPAIGN; null for ALTUS platform pool campaigns. */
  organization_id: UUID | null;
  owner_type: CampaignOwnerType;
  /** Org id (subscriber) or platform operator id (platform campaign). */
  owner_id: UUID;
  name: string;
  description: string | null;
  status: CampaignWorkflowStatus;
  goal: CampaignGoal;
  strategy: CampaignStrategyKey;
  audience: CampaignAudience;
  territories: string[];
  channels: CampaignChannelKey[];
  destination: CampaignDestination;
  budget_cents: number | null;
  currency: string;
  template_id: UUID | null;
  branding: CampaignBranding;
  qualification_template_key: string | null;
  distribution_config: Record<string, unknown>;
  launched_at: string | null;
};

export type CampaignTemplateRecord = AuditFields & {
  id: UUID;
  organization_id: UUID | null;
  module_key: string | null;
  key: string;
  name: string;
  strategy: CampaignStrategyKey;
  goal: CampaignGoal;
  description: string | null;
  default_destination: CampaignDestination;
  default_channels: CampaignChannelKey[];
  qualification_template_key: string | null;
  metadata: Record<string, unknown>;
};

export type ConnectedAccount = AuditFields & {
  id: UUID;
  organization_id: UUID;
  provider: CampaignChannelKey;
  external_account_id: string;
  external_business_id: string | null;
  account_name: string;
  connection_status: "disconnected" | "connected" | "error" | "pending";
  scopes: string[];
  /** Server-only reference to encrypted secret store — never a raw token. */
  encrypted_credentials_reference: string | null;
  last_sync_at: string | null;
};

export type CampaignChannelRun = AuditFields & {
  id: UUID;
  organization_id: UUID | null;
  campaign_id: UUID;
  provider: CampaignChannelKey;
  connected_account_id: UUID | null;
  external_campaign_id: string | null;
  status: "draft" | "pending" | "live" | "paused" | "error" | "completed";
  metrics: Record<string, number>;
};

export type LeadAttribution = {
  lead_id: UUID;
  organization_id: UUID | null;
  campaign_id: UUID | null;
  platform_campaign_id: UUID | null;
  owner_type: CampaignOwnerType | null;
  ad_provider: CampaignChannelKey | null;
  external_campaign_id: string | null;
  ad_set_id: string | null;
  creative_id: string | null;
  source: string | null;
  medium: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_page: string | null;
  territory: string | null;
  captured_at: string;
};

export type LeadScoreFactor = {
  key: string;
  category: "fit" | "intent" | "engagement";
  points: number;
  reason: string;
};

export type LeadScoreBreakdown = {
  total: number;
  fit: number;
  intent: number;
  engagement: number;
  classification: string;
  scoring_version: string;
  factors: LeadScoreFactor[];
  explanation: string;
};

export type LeadDistributionDecision = {
  id: UUID;
  lead_id: UUID;
  candidates_considered: UUID[];
  candidate_rejections: Array<{ organization_id: UUID; reason: string }>;
  selected_organization_id: UUID | null;
  selected_agent_id: UUID | null;
  distribution_method: DistributionMethod;
  rule_version: string;
  decided_at: string;
};

export type LeadAssignment = AuditFields & {
  id: UUID;
  organization_id: UUID;
  lead_id: UUID;
  assigned_to: UUID | null;
  team_id: UUID | null;
  assigned_at: string;
  first_viewed_at: string | null;
  first_contact_at: string | null;
  claim_locked_at: string | null;
  sla_status: "on_track" | "at_risk" | "breached" | "waived" | null;
};

export type OrganizationTerritory = AuditFields & {
  id: UUID;
  organization_id: UUID;
  region_code: string;
  country_code: string;
  status: "active" | "inactive";
};

export type CampaignBudget = AuditFields & {
  id: UUID;
  campaign_id: UUID;
  organization_id: UUID | null;
  amount_cents: number;
  currency: string;
  spent_cents: number;
};

export const BUILDER_STEPS = [
  "goal",
  "audience",
  "strategy",
  "territory",
  "channels",
  "budget",
  "lead_experience",
  "distribution",
  "review",
  "launch",
] as const;

export type BuilderStep = (typeof BUILDER_STEPS)[number];

export type CampaignDraftInput = {
  owner_type: CampaignOwnerType;
  owner_id: UUID;
  organization_id: UUID | null;
  name: string;
  description: string;
  goal: CampaignGoal;
  strategy: CampaignStrategyKey;
  audience: CampaignAudience;
  territories: string[];
  channels: CampaignChannelKey[];
  destination: CampaignDestination;
  budget_cents: number | null;
  template_id: UUID | null;
  branding: CampaignBranding;
  qualification_template_key: string | null;
  distribution_config: Record<string, unknown>;
};

/** Default temperature bands — configurable, not permanent hard-codes. */
export const DEFAULT_SCORE_TEMPERATURE_BANDS = [
  { key: "COLD", min_score: 0 },
  { key: "WARM", min_score: 40 },
  { key: "QUALIFIED", min_score: 60 },
  { key: "HOT", min_score: 80 },
  { key: "PRIORITY", min_score: 90 },
] as const;
