import { randomUUID } from "crypto";
import {
  getSimStore,
  findOrgBySlug,
  type SimCampaign,
} from "@/application/growth/simulationStore";
import type {
  CampaignDraftInput,
  CampaignOwnerType,
} from "@/domain/types/campaign-engine";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export type VerticalCampaignDraft = CampaignDraftInput & {
  secondary_strategies?: string[];
  budget_mode?: "daily" | "total";
  start_date?: string | null;
  end_date?: string | null;
  target_lead_count?: number | null;
  landing_headline?: string;
  landing_support?: string;
  assessment_template_key?: string;
  organization_slug?: string;
};

export function createSimCampaign(input: VerticalCampaignDraft): SimCampaign {
  const store = getSimStore();
  const now = new Date().toISOString();
  const orgSlug =
    input.organization_slug ??
    (input.owner_type === "ALTUS_PLATFORM_CAMPAIGN"
      ? "altus"
      : findOrgBySlug("demo-org")?.slug ?? "demo-org");

  const baseSlug = slugify(input.name) || "campaign";
  let slug = baseSlug;
  let i = 1;
  while (
    store.campaigns.some(
      (c) => c.organization_slug === orgSlug && c.slug === slug,
    )
  ) {
    slug = `${baseSlug}-${i++}`;
  }

  const campaign: SimCampaign = {
    id: randomUUID(),
    organization_id: input.organization_id,
    owner_type: input.owner_type,
    owner_id: input.owner_id,
    name: input.name,
    description: input.description,
    status: "draft",
    goal: input.goal,
    strategy: input.strategy,
    audience: input.audience,
    territories: input.territories,
    channels: input.channels,
    destination: input.destination,
    budget_cents: input.budget_cents,
    currency: "USD",
    template_id: input.template_id,
    branding: input.branding,
    qualification_template_key: input.qualification_template_key,
    distribution_config: input.distribution_config,
    launched_at: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    slug,
    organization_slug: orgSlug,
    secondary_strategies: input.secondary_strategies ?? [],
    budget_mode: input.budget_mode ?? "total",
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    target_lead_count: input.target_lead_count ?? null,
    landing_headline:
      input.landing_headline ??
      "Discover opportunities to strengthen your business.",
    landing_support:
      input.landing_support ??
      "A short assessment helps us understand your priorities and connect you with relevant next steps.",
    assessment_template_key:
      input.assessment_template_key ?? "business-growth-assessment-v1",
    analytics: {
      views: 0,
      assessment_starts: 0,
      assessment_completions: 0,
      leads: 0,
      qualified_leads: 0,
      hot_leads: 0,
      medium_leads: 0,
      cold_leads: 0,
      priority_leads: 0,
      appointments: 0,
      recycled_leads: 0,
      marketplace_eligible: 0,
      resold_leads: 0,
      original_lead_revenue_cents: 0,
      recycled_lead_revenue_cents: 0,
    },
  };

  store.campaigns.unshift(campaign);
  return campaign;
}

export function launchSimCampaign(campaignId: string) {
  const store = getSimStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error("Campaign not found");
  campaign.status = "active_simulation";
  campaign.launched_at = new Date().toISOString();
  campaign.updated_at = campaign.launched_at;
  return campaign;
}

export function updateCampaignStatus(
  campaignId: string,
  status: SimCampaign["status"],
) {
  const store = getSimStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error("Campaign not found");
  campaign.status = status;
  campaign.updated_at = new Date().toISOString();
  return campaign;
}

export function duplicateCampaign(campaignId: string) {
  const store = getSimStore();
  const existing = store.campaigns.find((c) => c.id === campaignId);
  if (!existing) throw new Error("Campaign not found");
  return createSimCampaign({
    owner_type: existing.owner_type as CampaignOwnerType,
    owner_id: existing.owner_id,
    organization_id: existing.organization_id,
    organization_slug: existing.organization_slug,
    name: `${existing.name} (Copy)`,
    description: existing.description ?? "",
    goal: existing.goal,
    strategy: existing.strategy,
    audience: existing.audience,
    territories: existing.territories,
    channels: existing.channels,
    destination: existing.destination,
    budget_cents: existing.budget_cents,
    template_id: existing.template_id,
    branding: existing.branding,
    qualification_template_key: existing.qualification_template_key,
    distribution_config: existing.distribution_config,
    secondary_strategies: existing.secondary_strategies,
    budget_mode: existing.budget_mode,
    landing_headline: existing.landing_headline,
    landing_support: existing.landing_support,
    assessment_template_key: existing.assessment_template_key,
  });
}

export function recordCampaignView(orgSlug: string, campaignSlug: string) {
  const store = getSimStore();
  const campaign = store.campaigns.find(
    (c) => c.organization_slug === orgSlug && c.slug === campaignSlug,
  );
  if (!campaign) return null;
  campaign.analytics.views += 1;
  return campaign;
}

export function recordAssessmentStart(orgSlug: string, campaignSlug: string) {
  const store = getSimStore();
  const campaign = store.campaigns.find(
    (c) => c.organization_slug === orgSlug && c.slug === campaignSlug,
  );
  if (!campaign) return null;
  campaign.analytics.assessment_starts += 1;
  return campaign;
}

export function listCampaignsForOrg(orgSlug: string) {
  return getSimStore().campaigns.filter((c) => c.organization_slug === orgSlug);
}

export function listAllCampaigns() {
  return getSimStore().campaigns;
}

export function getCampaignPublicPath(campaign: SimCampaign) {
  return `/c/${campaign.organization_slug}/${campaign.slug}`;
}

/** Stable direct-entry campaign for homepage → /assessment/retirement */
export const DIRECT_RETIREMENT_ORG_SLUG = "altus";
export const DIRECT_RETIREMENT_CAMPAIGN_SLUG = "retirement-opportunity";

export function ensureDirectRetirementCampaign(): SimCampaign {
  const store = getSimStore();
  const existing = store.campaigns.find(
    (c) =>
      c.organization_slug === DIRECT_RETIREMENT_ORG_SLUG &&
      c.slug === DIRECT_RETIREMENT_CAMPAIGN_SLUG,
  );
  if (existing) {
    if (!["active", "active_simulation", "published"].includes(String(existing.status))) {
      existing.status = "active_simulation";
      existing.launched_at = existing.launched_at ?? new Date().toISOString();
    }
    existing.qualification_template_key = "retirement-opportunity-v1";
    existing.assessment_template_key = "retirement-opportunity-v1";
    existing.strategy = "Retirement";
    return existing;
  }

  const org = findOrgBySlug(DIRECT_RETIREMENT_ORG_SLUG);
  const campaign = createSimCampaign({
    owner_type: "ALTUS_PLATFORM_CAMPAIGN",
    owner_id: org?.id ?? "20000000-0000-4000-8000-000000000001",
    organization_id: org?.id ?? "20000000-0000-4000-8000-000000000001",
    organization_slug: DIRECT_RETIREMENT_ORG_SLUG,
    name: "Retirement Opportunity Assessment",
    description: "Direct homepage entry to the Retirement Opportunity Assessment",
    goal: "generate_leads",
    strategy: "Retirement",
    audience: {},
    territories: ["US"],
    channels: ["email"],
    destination: "interactive_assessment",
    budget_cents: null,
    template_id: null,
    branding: {
      organization_name: "ALTUS",
      custom_cta: "Start Assessment",
      thank_you_message:
        "Thanks — your retirement profile is ready. An ALTUS specialist can follow up when you choose.",
    },
    qualification_template_key: "retirement-opportunity-v1",
    assessment_template_key: "retirement-opportunity-v1",
    distribution_config: { method: "priority_tier", preferPremierForPriority: true },
    landing_headline: "Build Your Retirement Profile",
    landing_support:
      "Answer a few questions about your retirement, financial priorities and goals.",
  });
  // Force stable slug for the direct assessment entry
  campaign.slug = DIRECT_RETIREMENT_CAMPAIGN_SLUG;
  return launchSimCampaign(campaign.id);
}
