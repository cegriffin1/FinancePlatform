import { describe, expect, it, beforeEach } from "vitest";
import { resetSimStore, getSimStore } from "@/application/growth/simulationStore";
import { createSimCampaign, launchSimCampaign } from "@/application/growth/campaignService";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";
import {
  SpeedToLeadService,
  NextBestActionService,
  issueHotLeadAlert,
  getSpeedToLeadConfig,
  updateSpeedToLeadConfig,
} from "@/application/crm/SpeedToLeadService";
import { PreCallBriefService } from "@/application/crm/preCallBrief";
import { RetirementCrmService } from "@/application/crm/RetirementCrmService";
import { LeadLifecycleAgingService } from "@/application/lifecycle/LeadLifecycleService";
import { LeadRecyclingEligibilityService } from "@/application/lifecycle/LeadLifecycleService";
import { randomUUID } from "crypto";

beforeEach(() => {
  resetSimStore();
  updateSpeedToLeadConfig({
    hot_minutes: 15,
    medium_minutes: 60,
    cold_minutes: 1440,
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

async function seedLead() {
  const campaign = createSimCampaign({
    owner_type: "SUBSCRIBER_CAMPAIGN",
    owner_id: "20000000-0000-4000-8000-000000000003",
    organization_id: "20000000-0000-4000-8000-000000000003",
    organization_slug: "demo-org",
    name: "Retirement Confidence",
    description: "",
    goal: "generate_leads",
    strategy: "Retirement",
    audience: { personas: ["professional"] },
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
      firstName: "James",
      lastName: "Rivera",
      businessName: "Rivera Household",
      email: `james.rivera+${Date.now()}@example.com`,
      phone: "3055550144",
      state: "FL",
      preferredContact: "Phone",
      consent: true,
    },
    appointmentRequested: true,
    attribution: { ad_provider: "linkedin", source_channel: "linkedin" },
  });
  return { lead, campaign };
}

describe("SpeedToLeadService", () => {
  it("tracks SLA with configurable HOT window and completes on meaningful contact", async () => {
    const { lead } = await seedLead();
    const speed = new SpeedToLeadService();
    const snap = speed.ensure(lead);
    expect(snap.sla_minutes).toBe(getSpeedToLeadConfig().hot_minutes);
    expect(["ON_TRACK", "DUE_SOON", "BREACHED"]).toContain(snap.sla_state);

    speed.markContactAttempt(lead);
    speed.markMeaningfulContact(lead);
    expect(speed.refresh(lead).sla_state).toBe("COMPLETED");
    expect(speed.refresh(lead).time_to_first_contact_ms).not.toBeNull();
  });

  it("does not destroy SLA history when completing", async () => {
    const { lead } = await seedLead();
    const speed = new SpeedToLeadService();
    speed.ensure(lead);
    speed.markMeaningfulContact(lead);
    const histLen = lead.speed_to_lead!.history.length;
    speed.refresh(lead);
    expect(lead.speed_to_lead!.history.length).toBeGreaterThanOrEqual(histLen);
    expect(lead.speed_to_lead!.qualified_at).toBeTruthy();
  });
});

describe("NextBestAction + PreCallBrief", () => {
  it("returns deterministic reasons without inventing advice", async () => {
    const { lead } = await seedLead();
    const nba = new NextBestActionService().recommend(lead);
    expect(nba.headline.length).toBeGreaterThan(5);
    expect(nba.reasons.length).toBeGreaterThan(0);
    const brief = new PreCallBriefService().build(lead);
    expect(brief).toMatch(/not individualized financial advice/i);
    expect(brief).toMatch(/Recommended conversation topics/i);
  });
});

describe("Hot lead alert", () => {
  it("creates NEW HOT OPPORTUNITY notification for HOT leads", async () => {
    const { lead } = await seedLead();
    lead.operational_temperature = "HOT";
    issueHotLeadAlert(lead);
    const store = getSimStore();
    expect(
      store.notifications.some((n) => n.kind === "NEW_HOT_OPPORTUNITY"),
    ).toBe(true);
  });
});

describe("Contact attempt updates speed-to-lead", () => {
  it("Connected disposition marks meaningful contact", async () => {
    const { lead } = await seedLead();
    new RetirementCrmService().recordContactAttempt(
      lead,
      "call",
      "Connected",
      "setter",
    );
    expect(lead.speed_to_lead?.sla_state).toBe("COMPLETED");
    expect(lead.last_meaningful_interaction_at).toBeTruthy();
  });
});

describe("Routing failure visibility", () => {
  it("platform lead with no eligible org stays unassigned with attention", async () => {
    const campaign = createSimCampaign({
      owner_type: "ALTUS_PLATFORM_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000001",
      organization_id: null,
      organization_slug: "altus",
      name: "Platform No Match",
      description: "",
      goal: "generate_leads",
      strategy: "Retirement",
      audience: { personas: ["professional"] },
      territories: ["AK"],
      channels: ["linkedin"],
      destination: "interactive_assessment",
      budget_cents: 10000,
      template_id: null,
      branding: { organization_name: "ALTUS" },
      qualification_template_key: "retirement-opportunity-v1",
      distribution_config: { method: "priority_tier" },
    });
    launchSimCampaign(campaign.id);
    // Force no capacity / no territory by emptying org territories temporarily
    const store = getSimStore();
    for (const o of store.organizations) {
      if (o.slug !== "altus") {
        o.territories = ["HI"];
        o.capacityRemaining = 0;
      }
    }
    const { lead } = await processPublicLeadSubmission({
      organizationSlug: "altus",
      campaignSlug: campaign.slug,
      answers: { ...answers, state: "AK" },
      contact: {
        firstName: "Una",
        lastName: "Signed",
        businessName: "Una Household",
        email: `una+${Date.now()}@example.com`,
        phone: "9075550101",
        state: "AK",
        preferredContact: "Phone",
        consent: true,
      },
      appointmentRequested: false,
      attribution: { ad_provider: "linkedin", source_channel: "linkedin" },
    });
    expect(
      lead.distribution_status === "unassigned_pool" ||
        Boolean(lead.routing_attention),
    ).toBe(true);
  });
});

describe("Appointment protects recycling", () => {
  it("cold lead with scheduled appointment is NOT_ELIGIBLE", async () => {
    const { lead } = await seedLead();
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
        agent_name: "Casey",
        scheduled_at: new Date(now + 86400000).toISOString(),
        preferred_contact_method: "Phone",
        notes: null,
        status: "scheduled",
        created_by: null,
        created_at: new Date().toISOString(),
      },
    ];
    new LeadLifecycleAgingService().run(lead, now);
    const elig = new LeadRecyclingEligibilityService().evaluate(lead, now);
    expect(elig.status).toBe("NOT_ELIGIBLE");
  });
});
