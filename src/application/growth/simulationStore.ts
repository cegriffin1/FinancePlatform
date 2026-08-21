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
  };
};

export type SimLead = {
  id: UUID;
  organization_id: UUID | null;
  assigned_organization_id: UUID | null;
  assigned_agent_label: string | null;
  campaign_id: UUID;
  platform_campaign_id: UUID | null;
  owner_type: CampaignOwnerType;
  status: "new" | "qualified" | "working" | "unassigned_pool" | "converted";
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
  distribution_status: "pending" | "assigned" | "unassigned_pool" | "subscriber_owned";
  created_at: string;
  updated_at: string;
};

export type SimNotification = {
  id: UUID;
  organization_id: UUID;
  lead_id: UUID;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
};

export type SimStore = {
  organizations: SimOrganization[];
  campaigns: SimCampaign[];
  leads: SimLead[];
  events: LeadEvent[];
  notifications: SimNotification[];
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
