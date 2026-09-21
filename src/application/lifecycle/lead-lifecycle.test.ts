import { describe, expect, it, beforeEach } from "vitest";
import { resetSimStore, getSimStore } from "@/application/growth/simulationStore";
import { createSimCampaign, launchSimCampaign } from "@/application/growth/campaignService";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";
import {
  LeadInventoryService,
  LeadMarketplacePurchaseService,
  LeadComplianceService,
} from "@/application/inventory/LeadInventoryService";
import {
  LeadEngagementService,
  LeadLifecycleAgingService,
  LeadLifecycleJob,
  LeadOwnershipReleaseService,
  LeadRecyclingEligibilityService,
  LeadTemperatureTransitionService,
  getLifecycleConfig,
  updateLifecycleConfig,
} from "@/application/lifecycle/LeadLifecycleService";
import { CampaignHealthService } from "@/application/analytics/CampaignHealthService";
import { randomUUID } from "crypto";

beforeEach(() => {
  resetSimStore();
  updateLifecycleConfig({
    cold_after_days: 30,
    recycle_after_days: 45,
  });
});

const answers = {
  age_range: "60–64",
  state: "FL",
  employment: "Working",
  retirement_timing: "Within 2 years",
  total_retirement_assets: "$750K–$999K",
  repositionable_assets: "$750K–$999K",
  asset_location: "401(k)",
  employer_assets: "Former employer",
  existing_annuity: "None",
  liquidity_timeline: "1–3 years",
  primary_objective: "INCOME",
  income_start: "Within 1 year",
  desired_monthly_income: "$5,000–$7,500",
  lifetime_income_importance: "9",
  existing_guaranteed_income: "Neither",
  inflation_concern: "8",
  liquidity_importance: "7",
  current_advisor: "Not currently",
  decision_timeline: "Within 30 days",
};

async function seedHotLead(opts?: { channel?: string }) {
  const campaign = createSimCampaign({
    owner_type: "SUBSCRIBER_CAMPAIGN",
    owner_id: "20000000-0000-4000-8000-000000000003",
    organization_id: "20000000-0000-4000-8000-000000000003",
    organization_slug: "demo-org",
    name: "LinkedIn Retirement Lifecycle",
    description: "",
    goal: "generate_leads",
    strategy: "Retirement",
    audience: {},
    territories: ["FL"],
    channels: ["linkedin"],
    destination: "interactive_assessment",
    budget_cents: 50000,
    template_id: null,
    branding: { organization_name: "Demo Organization" },
    qualification_template_key: "retirement-opportunity-v1",
    distribution_config: { method: "campaign_owner" },
  });
  launchSimCampaign(campaign.id);
  const { lead } = await processPublicLeadSubmission({
    organizationSlug: "demo-org",
    campaignSlug: campaign.slug,
    answers,
    contact: {
      firstName: "Riley",
      lastName: "Morgan",
      businessName: "Morgan Household",
      email: `riley.morgan+${Date.now()}@example.com`,
      phone: "3055550199",
      state: "FL",
      preferredContact: "Phone",
      consent: true,
    },
    appointmentRequested: true,
    attribution: {
      ad_provider: opts?.channel ?? "linkedin",
      source_channel: opts?.channel ?? "linkedin",
    },
  });
  // Ensure ownership active for recycling path
  if (!lead.ownership) {
    new LeadInventoryService().markPurchasedAssigned(lead);
  }
  lead.inventory_status = "ACTIVE_OWNERSHIP";
  return { lead, campaign };
}

describe("HOT/MEDIUM/COLD operational buckets", () => {
  it("seeds operational temperature separately from opportunity score", async () => {
    const { lead } = await seedHotLead();
    expect(lead.operational_temperature).toBeTruthy();
    expect(lead.aging?.original_score).toBe(lead.score);
    expect(lead.temperature_snapshots?.length).toBeGreaterThan(0);
    expect(lead.last_meaningful_interaction_at).toBeTruthy();
  });
});

describe("meaningful engagement", () => {
  it("does not reset inactivity when agent only opens lead", async () => {
    const { lead } = await seedHotLead();
    const before = lead.last_meaningful_interaction_at;
    new LeadEngagementService().recordSystemActivity(lead, "agent_opened_lead");
    expect(lead.last_meaningful_interaction_at).toBe(before);
    expect(lead.last_activity_at).toBeTruthy();
  });

  it("updates last_meaningful_interaction_at on prospect reply", async () => {
    const { lead } = await seedHotLead();
    const past = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    lead.last_meaningful_interaction_at = past;
    new LeadEngagementService().record(lead, "prospect_replied_sms");
    expect(lead.last_meaningful_interaction_at).not.toBe(past);
  });
});

describe("30-day cold and 45-day recycling", () => {
  it("transitions HOT → MEDIUM → COLD without destroying opportunity score", async () => {
    const { lead } = await seedHotLead();
    const original = lead.aging!.original_score;
    const aging = new LeadLifecycleAgingService();
    const transitions = new LeadTemperatureTransitionService();

    transitions.transition(lead, "HOT", "Setter confirmed", "setter_verified");
    expect(lead.operational_temperature).toBe("HOT");

    // 16 days → MEDIUM
    const t16 = Date.now();
    lead.last_meaningful_interaction_at = new Date(
      t16 - 16 * 24 * 60 * 60 * 1000,
    ).toISOString();
    aging.run(lead, t16);
    expect(lead.operational_temperature).toBe("MEDIUM");
    expect(lead.score).toBe(original);

    // 32 days → COLD
    const t32 = Date.now();
    lead.last_meaningful_interaction_at = new Date(
      t32 - 32 * 24 * 60 * 60 * 1000,
    ).toISOString();
    aging.run(lead, t32);
    expect(lead.operational_temperature).toBe("COLD");
    expect(lead.score).toBe(original);

    // 46 days → RECYCLING_REVIEW
    const t46 = Date.now();
    lead.last_meaningful_interaction_at = new Date(
      t46 - 46 * 24 * 60 * 60 * 1000,
    ).toISOString();
    aging.run(lead, t46);
    expect(lead.inventory_status).toBe("RECYCLING_REVIEW");
    expect(lead.aging!.original_score).toBe(original);
  });
});

describe("re-engagement cancels recycling", () => {
  it("reheats COLD → MEDIUM/HOT and cancels marketplace path", async () => {
    const { lead } = await seedHotLead();
    const aging = new LeadLifecycleAgingService();
    const now = Date.now();
    lead.last_meaningful_interaction_at = new Date(
      now - 40 * 24 * 60 * 60 * 1000,
    ).toISOString();
    aging.run(lead, now);
    expect(lead.operational_temperature).toBe("COLD");

    aging.reheat(lead, "prospect_replied_sms", now + 1000);
    expect(["MEDIUM", "HOT"]).toContain(lead.operational_temperature);
    expect(lead.inventory_status).not.toBe("MARKETPLACE");
    expect(lead.inventory_status).not.toBe("RECYCLING_REVIEW");

    const elig = new LeadRecyclingEligibilityService().evaluate(lead, now + 1000);
    expect(elig.status).not.toBe("ELIGIBLE");
  });
});

describe("do not recycle active business", () => {
  it("blocks recycling when appointment is scheduled", async () => {
    const { lead } = await seedHotLead();
    const now = Date.now();
    lead.last_meaningful_interaction_at = new Date(
      now - 50 * 24 * 60 * 60 * 1000,
    ).toISOString();
    lead.operational_temperature = "COLD";
    lead.appointments = [
      {
        id: randomUUID(),
        lead_id: lead.id,
        organization_id: lead.assigned_organization_id!,
        agent_id: "30000000-0000-4000-8000-000000000003",
        agent_name: "Casey Morgan",
        scheduled_at: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
        preferred_contact_method: "Phone",
        notes: null,
        status: "scheduled",
        created_by: null,
        created_at: new Date().toISOString(),
      },
    ];
    const elig = new LeadRecyclingEligibilityService().evaluate(lead, now);
    expect(elig.status).toBe("NOT_ELIGIBLE");
    expect(elig.reasons.some((r) => /appointment/i.test(r))).toBe(true);
  });

  it("returns SUPPRESSED when suppressed", async () => {
    const { lead } = await seedHotLead();
    new LeadComplianceService().suppress(lead, "do_not_contact");
    const now = Date.now();
    lead.last_meaningful_interaction_at = new Date(
      now - 50 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const elig = new LeadRecyclingEligibilityService().evaluate(lead, now);
    expect(elig.status).toBe("SUPPRESSED");
  });

  it("blocks recycling when active opportunity exists", async () => {
    const { lead } = await seedHotLead();
    const now = Date.now();
    lead.last_meaningful_interaction_at = new Date(
      now - 50 * 24 * 60 * 60 * 1000,
    ).toISOString();
    lead.pipeline_stage = "OPPORTUNITY";
    lead.outcome = "Qualified Opportunity";
    const elig = new LeadRecyclingEligibilityService().evaluate(lead, now);
    expect(elig.status).toBe("NOT_ELIGIBLE");
  });
});

describe("E2E hot → recycled → resale", () => {
  it("releases, lists, sells, preserves original score and marks recycled", async () => {
    const { lead, campaign } = await seedHotLead({ channel: "linkedin" });
    const originalScore = lead.aging!.original_score;
    expect(originalScore).toBeGreaterThanOrEqual(60);

    // Clear protections that seed path may set
    lead.appointments = [];
    lead.pipeline_stage = "CONTACTED";
    lead.outcome = null;
    lead.follow_ups = [];

    const now = Date.now();
    lead.last_meaningful_interaction_at = new Date(
      now - 50 * 24 * 60 * 60 * 1000,
    ).toISOString();

    new LeadLifecycleAgingService().run(lead, now);
    expect(lead.operational_temperature).toBe("COLD");
    expect(lead.inventory_status).toBe("RECYCLING_REVIEW");

    const elig = new LeadRecyclingEligibilityService().evaluate(lead, now);
    // REQUIRES_REVIEW or ELIGIBLE depending on status
    expect(["REQUIRES_REVIEW", "ELIGIBLE"]).toContain(elig.status);

    const release = new LeadOwnershipReleaseService().releaseIfEligible(
      lead,
      "inactivity_recycle",
      now,
    );
    expect(release.released).toBe(true);
    expect(lead.inventory_status).toBe("MARKETPLACE_ELIGIBLE");
    expect(lead.ownership_history?.length).toBeGreaterThan(0);

    const inventory = new LeadInventoryService();
    inventory.listOnMarketplace(lead);
    expect(lead.inventory_status).toBe("MARKETPLACE");
    expect(lead.marketplace_listed).toBe(true);

    const buyer = "20000000-0000-4000-8000-000000000004";
    const purchase = new LeadMarketplacePurchaseService().attemptExclusivePurchase({
      leadId: lead.id,
      buyerOrganizationId: buyer,
      buyerLabel: "Standard Agency TX Advisor",
    });
    expect(purchase.buyer_organization_id).toBe(buyer);
    expect(lead.recycled).toBe(true);
    expect(lead.reengagement_plan?.suggested_actions.length).toBeGreaterThan(0);
    expect(lead.aging!.original_score).toBe(originalScore);
    expect(lead.score).toBe(originalScore);
    expect(lead.assigned_organization_id).toBe(buyer);

    const storeCampaign = getSimStore().campaigns.find((c) => c.id === campaign.id)!;
    expect(storeCampaign.analytics.resold_leads).toBeGreaterThanOrEqual(1);
    expect(storeCampaign.id).toBe(lead.campaign_id);
  });
});

describe("lifecycle config is not hardcoded", () => {
  it("uses admin-configurable cold_after_days / recycle_after_days", () => {
    updateLifecycleConfig({ cold_after_days: 10, recycle_after_days: 20 });
    const cfg = getLifecycleConfig();
    expect(cfg.cold_after_days).toBe(10);
    expect(cfg.recycle_after_days).toBe(20);
  });
});

describe("campaign health + cohort", () => {
  it("reports HOT/MEDIUM/COLD and channel comparison", async () => {
    const { lead, campaign } = await seedHotLead({ channel: "linkedin" });
    const health = new CampaignHealthService();
    const summary = health.campaignSummary(campaign, [lead]);
    expect(summary.lead_quality.hot + summary.lead_quality.medium + summary.lead_quality.cold).toBe(1);
    const channels = health.channelComparison(campaign.id);
    expect(channels.find((c) => c.channel === "linkedin")?.leads).toBeGreaterThanOrEqual(1);
    const traj = health.cohortTemperatureTrajectory([lead]);
    expect(traj.map((t) => t.day)).toEqual([0, 7, 14, 30, 45, 60]);
  });
});

describe("lifecycle job", () => {
  it("runs across inventory idempotently", async () => {
    await seedHotLead();
    const results = new LeadLifecycleJob().runAll(Date.now());
    expect(results.length).toBeGreaterThan(0);
    const again = new LeadLifecycleJob().runAll(Date.now());
    expect(again.length).toBe(results.length);
  });
});
