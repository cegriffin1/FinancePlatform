import type { UUID } from "@/domain/types/base";
import type {
  CampaignOwnerType,
  CampaignWorkflowStatus,
  GrowthCampaign,
  LeadAttribution,
  LeadDistributionDecision,
  LeadScoreBreakdown,
  SubscriptionTier,
} from "@/domain/types/campaign-engine";
import type { LeadEvent, StrategyClassification } from "@/domain/types";
import type {
  LeadIntelligenceProfile,
  LeadSlaTimers,
  LeadOutcome,
  PipelineStage,
  LeadScoreSnapshotRecord,
  ReservationStatus,
} from "@/domain/types/lead-intelligence";
import type { LeadQualificationProfile } from "@/domain/types/retirement-qualification";
import type {
  AgentIntroductionProfile,
  EligibleAgent,
  LeadAppointment,
  SetterVerificationRecord,
  NotificationChannelKind,
} from "@/domain/types/setter-handoff";
import type {
  CrmContactAttempt,
  CrmFollowUp,
  CrmNote,
  LeadOwnership,
  OwnershipConfig,
} from "@/domain/types/retirement-crm";
import { DEFAULT_OWNERSHIP_CONFIG } from "@/domain/types/retirement-crm";
import type {
  InventoryConfig,
  InventoryExtension,
  InventoryLifecycleStatus,
  LeadComplianceProfile,
  LeadPricingConfig,
  LeadPurchaseRecord,
  LeadReservation,
  ScoreAgingSnapshot,
} from "@/domain/types/lead-inventory";
import {
  DEFAULT_INVENTORY_CONFIG,
  DEFAULT_PRICING_CONFIG,
} from "@/domain/types/lead-inventory";

export type QualificationSnapshotRecord = {
  id: UUID;
  lead_id: UUID;
  organization_id: UUID | null;
  profile: LeadQualificationProfile;
  created_at: string;
};

export type SimOrganization = {
  id: UUID;
  slug: string;
  name: string;
  tier: SubscriptionTier;
  territories: string[];
  strategies: string[];
  licenses: string[];
  capacityRemaining: number;
  status: "active" | "inactive";
};

export type SimCampaign = Omit<GrowthCampaign, "status"> & {
  status: GrowthCampaign["status"] | "active_simulation";
  slug: string;
  organization_slug: string;
  secondary_strategies: string[];
  budget_mode: "daily" | "total";
  start_date: string | null;
  end_date: string | null;
  target_lead_count: number | null;
  landing_headline: string;
  landing_support: string;
  assessment_template_key: string;
  analytics: {
    views: number;
    assessment_starts: number;
    assessment_completions: number;
    leads: number;
    qualified_leads: number;
    hot_leads: number;
    priority_leads: number;
    appointments: number;
    outcome_counts?: Record<string, number>;
    won?: number;
    lost?: number;
    qualified_opportunities?: number;
  };
};

export type SimLead = {
  id: UUID;
  organization_id: UUID | null;
  assigned_organization_id: UUID | null;
  assigned_agent_label: string | null;
  assigned_agent_id?: string | null;
  campaign_id: UUID;
  platform_campaign_id: UUID | null;
  owner_type: CampaignOwnerType;
  status:
    | "new"
    | "qualified"
    | "working"
    | "unassigned_pool"
    | "converted"
    | "review"
    | "rejected"
    | "nurture"
    | "scoring_pending"
    | "distribution_pending";
  temperature_key: string;
  score: number;
  fit_score: number;
  intent_score: number;
  engagement_score: number;
  score_version: string;
  scored_at: string;
  score_breakdown: LeadScoreBreakdown;
  first_name: string;
  last_name: string;
  business_name: string;
  email: string;
  phone: string;
  state: string;
  preferred_contact: string;
  consent: boolean;
  assessment_answers: Record<string, string>;
  assessment_template_version: string;
  attribution: LeadAttribution;
  classifications: StrategyClassification[];
  distribution: LeadDistributionDecision | null;
  distribution_status:
    | "pending"
    | "assigned"
    | "unassigned_pool"
    | "subscriber_owned"
    | "held"
    | "nurture";
  created_at: string;
  updated_at: string;
  intelligence?: LeadIntelligenceProfile;
  qualification?: LeadQualificationProfile;
  score_snapshots?: LeadScoreSnapshotRecord[];
  qualification_snapshots?: QualificationSnapshotRecord[];
  sla?: LeadSlaTimers;
  pipeline_stage?: PipelineStage;
  stage_history?: Array<{ stage: PipelineStage; at: string }>;
  outcome?: LeadOutcome | null;
  outcome_reason?: string | null;
  opportunity_value_cents?: number | null;
  closed_value_cents?: number | null;
  closed_at?: string | null;
  reservation_status?: ReservationStatus;
  reserved_until?: string | null;
  reserved_by_org_id?: string | null;
  parent_lead_id?: string | null;
  processing_flags?: {
    scoring_pending?: boolean;
    distribution_pending?: boolean;
    notification_pending?: boolean;
    crm_sync_pending?: boolean;
  };
  recovery?: {
    is_partial: boolean;
    last_completed_stage: string;
    recovery_eligible: boolean;
    saved_at: string;
  };
  ownership_history?: LeadOwnership[];
  preferred_communication?: string;
  setter_verification?: SetterVerificationRecord;
  appointments?: LeadAppointment[];
  ownership?: LeadOwnership | null;
  crm_notes?: CrmNote[];
  follow_ups?: CrmFollowUp[];
  contact_attempts?: CrmContactAttempt[];
  compliance?: LeadComplianceProfile;
  aging?: ScoreAgingSnapshot;
  inventory_status?: InventoryLifecycleStatus;
  marketplace_listed?: boolean;
  marketplace_price_cents?: number | null;
  lead_version?: number;
  active_reservation_id?: string | null;
  ownership_extensions?: InventoryExtension[];
  purchase_history?: LeadPurchaseRecord[];
};

export type CrmSyncLogEntry = {
  id: UUID;
  provider: string;
  organization_id: UUID;
  entity: string;
  external_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type SimNotification = {
  id: UUID;
  organization_id: UUID;
  lead_id: UUID;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  channel?: NotificationChannelKind;
  kind?: string;
  recipient_agent_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type SimStore = {
  organizations: SimOrganization[];
  campaigns: SimCampaign[];
  leads: SimLead[];
  events: LeadEvent[];
  notifications: SimNotification[];
  agents: EligibleAgent[];
  agent_introductions: AgentIntroductionProfile[];
  appointments: LeadAppointment[];
  follow_ups: CrmFollowUp[];
  ownership_config: OwnershipConfig;
  inventory_config: InventoryConfig;
  pricing_config: LeadPricingConfig;
  reservations: LeadReservation[];
  purchases: LeadPurchaseRecord[];
  ownership_extensions: InventoryExtension[];
  crm_sync_log: CrmSyncLogEntry[];
  roundRobinCursor: Record<string, number>;
};

const globalKey = "__altus_growth_sim_store__";

function seed(): SimStore {
  return {
    organizations: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        slug: "altus",
        name: "ALTUS Platform",
        tier: "ENTERPRISE",
        territories: ["US"],
        strategies: [
          "Business Growth",
          "Tax Strategy",
          "Succession",
          "Key Employee Strategy",
          "Executive Benefits",
          "Protection",
          "Retirement",
          "Premium Financing",
        ],
        licenses: ["life", "health"],
        capacityRemaining: 999,
        status: "active",
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        slug: "premier-advisors",
        name: "Premier Advisors FL",
        tier: "PREMIER",
        territories: ["FL", "GA"],
        strategies: ["Tax Strategy", "Business Growth", "Succession", "Protection"],
        licenses: ["life", "health"],
        capacityRemaining: 25,
        status: "active",
      },
      {
        id: "20000000-0000-4000-8000-000000000003",
        slug: "demo-org",
        name: "Demo Organization",
        tier: "PRO",
        territories: ["FL", "TX", "CA"],
        strategies: ["Business Growth", "Key Employee Strategy", "Retirement"],
        licenses: ["life"],
        capacityRemaining: 15,
        status: "active",
      },
      {
        id: "20000000-0000-4000-8000-000000000004",
        slug: "standard-agency",
        name: "Standard Agency TX",
        tier: "STANDARD",
        territories: ["TX"],
        strategies: ["Business Growth", "Protection"],
        licenses: ["life"],
        capacityRemaining: 8,
        status: "active",
      },
    ],
    campaigns: [],
    leads: [],
    events: [],
    notifications: [],
    agents: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        organization_id: "20000000-0000-4000-8000-000000000002",
        name: "Jordan Hale",
        title: "Retirement Planning Advisor",
        states: ["FL", "GA"],
        strategies: ["Retirement", "Protection", "Tax Strategy"],
        active: true,
      },
      {
        id: "30000000-0000-4000-8000-000000000002",
        organization_id: "20000000-0000-4000-8000-000000000002",
        name: "Alex Rivera",
        title: "Senior Wealth Advisor",
        states: ["FL"],
        strategies: ["Retirement", "Business Growth"],
        active: true,
      },
      {
        id: "30000000-0000-4000-8000-000000000003",
        organization_id: "20000000-0000-4000-8000-000000000003",
        name: "Casey Morgan",
        title: "Financial Advisor",
        states: ["FL", "TX", "CA"],
        strategies: ["Retirement", "Business Growth"],
        active: true,
      },
    ],
    agent_introductions: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        organization_id: "20000000-0000-4000-8000-000000000002",
        agent_id: "30000000-0000-4000-8000-000000000001",
        agent_name: "Jordan Hale",
        title: "Retirement Planning Advisor",
        experience_summary:
          "Helps pre-retirees organize income, protection, and distribution decisions.",
        specialties: ["Retirement income", "Principal protection", "401(k) rollovers"],
        states_licenses: ["FL", "GA"],
        organization_name: "Premier Advisors FL",
        approved_introduction_script:
          "I'd like to introduce you to Jordan Hale, a Retirement Planning Advisor with Premier Advisors FL. Jordan works with people approaching retirement on income planning and protecting what they've saved. Jordan is licensed in Florida and Georgia.",
        active: true,
      },
      {
        id: "40000000-0000-4000-8000-000000000002",
        organization_id: "20000000-0000-4000-8000-000000000002",
        agent_id: "30000000-0000-4000-8000-000000000002",
        agent_name: "Alex Rivera",
        title: "Senior Wealth Advisor",
        experience_summary:
          "Focuses on coordinated retirement and business-owner planning conversations.",
        specialties: ["Retirement", "Business growth planning"],
        states_licenses: ["FL"],
        organization_name: "Premier Advisors FL",
        approved_introduction_script:
          "I'd like to introduce you to Alex Rivera, a Senior Wealth Advisor with Premier Advisors FL. Alex helps clients organize retirement and business planning discussions and is licensed in Florida.",
        active: true,
      },
      {
        id: "40000000-0000-4000-8000-000000000003",
        organization_id: "20000000-0000-4000-8000-000000000003",
        agent_id: "30000000-0000-4000-8000-000000000003",
        agent_name: "Casey Morgan",
        title: "Financial Advisor",
        experience_summary:
          "Supports retirement opportunity conversations for Demo Organization clients.",
        specialties: ["Retirement", "Business Growth"],
        states_licenses: ["FL", "TX", "CA"],
        organization_name: "Demo Organization",
        approved_introduction_script:
          "I'd like to introduce you to Casey Morgan, a Financial Advisor with Demo Organization. Casey helps clients review retirement priorities and next steps and is licensed in Florida, Texas, and California.",
        active: true,
      },
    ],
    appointments: [],
    follow_ups: [],
    ownership_config: { ...DEFAULT_OWNERSHIP_CONFIG },
    inventory_config: { ...DEFAULT_INVENTORY_CONFIG },
    pricing_config: {
      ...DEFAULT_PRICING_CONFIG,
      bands: DEFAULT_PRICING_CONFIG.bands.map((b) => ({ ...b })),
      temperature_multipliers: { ...DEFAULT_PRICING_CONFIG.temperature_multipliers },
      territory_multipliers: { ...DEFAULT_PRICING_CONFIG.territory_multipliers },
    },
    reservations: [],
    purchases: [],
    ownership_extensions: [],
    crm_sync_log: [],
    roundRobinCursor: {},
  };
}

export function getSimStore(): SimStore {
  const g = globalThis as typeof globalThis & { [globalKey]?: SimStore };
  if (!g[globalKey]) g[globalKey] = seed();
  return g[globalKey];
}

export function resetSimStore() {
  const g = globalThis as typeof globalThis & { [globalKey]?: SimStore };
  g[globalKey] = seed();
  return g[globalKey];
}

export function isGrowthDevToolsEnabled() {
  return process.env.NODE_ENV !== "production";
}

export function findOrgBySlug(slug: string) {
  return getSimStore().organizations.find((o) => o.slug === slug) ?? null;
}

export function findCampaignBySlug(orgSlug: string, campaignSlug: string) {
  return (
    getSimStore().campaigns.find(
      (c) => c.organization_slug === orgSlug && c.slug === campaignSlug,
    ) ?? null
  );
}

export type CampaignStatusExtended =
  | CampaignWorkflowStatus
  | "active_simulation"
  | "published";
