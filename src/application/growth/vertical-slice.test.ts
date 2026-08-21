import { describe, expect, it, beforeEach } from "vitest";
import { resetSimStore, getSimStore } from "@/application/growth/simulationStore";
import { createSimCampaign, launchSimCampaign } from "@/application/growth/campaignService";
import { processPublicLeadSubmission, generateTestLead } from "@/application/growth/leadPipeline";
import { applyScoringRules } from "@/application/growth/scoringRules";
import { PRIORITY_TO_STRATEGY } from "@/application/growth/assessmentTemplate";

beforeEach(() => {
  resetSimStore();
});

describe("vertical slice scoring rules", () => {
  it("scores fit/intent/engagement and temperature from configurable rules", () => {
    const result = applyScoringRules(
      {
        team_size: "26–50",
        revenue_range: "$5M–$10M",
        financial_priority: "Reduce tax exposure",
        timeline: "Within 30 days",
      },
      {
        assessmentCompleted: true,
        contactSubmitted: true,
        appointmentRequested: true,
      },
    );
    expect(result.fit).toBeGreaterThanOrEqual(40);
    expect(result.intent).toBeGreaterThanOrEqual(20);
    expect(result.engagement).toBe(20);
    expect(result.total).toBeGreaterThanOrEqual(80);
    expect(["HOT", "PRIORITY"]).toContain(result.temperature);
  });
});

describe("strategy classification mapping", () => {
  it("maps priorities to internal strategy buckets", () => {
    expect(PRIORITY_TO_STRATEGY["Reduce tax exposure"]).toContain("Tax Strategy");
    expect(PRIORITY_TO_STRATEGY["Retain key employees"]).toEqual(
      expect.arrayContaining(["Key Employee Strategy", "Executive Benefits"]),
    );
  });
});

describe("platform vs subscriber ownership", () => {
  it("distributes ALTUS platform leads to Premier when eligible", async () => {
    const campaign = createSimCampaign({
      owner_type: "ALTUS_PLATFORM_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000001",
      organization_id: null,
      organization_slug: "altus",
      name: "Platform Tax FL",
      description: "",
      goal: "generate_leads",
      strategy: "Tax Strategy",
      audience: {},
      territories: ["FL"],
      channels: ["meta"],
      destination: "interactive_assessment",
      budget_cents: 100000,
      template_id: null,
      branding: { organization_name: "ALTUS" },
      qualification_template_key: "business-growth-assessment-v1",
      distribution_config: { method: "priority_tier" },
    });
    launchSimCampaign(campaign.id);

    const { lead } = await processPublicLeadSubmission({
      organizationSlug: "altus",
      campaignSlug: campaign.slug,
      answers: {
        business_stage: "Growing steadily",
        financial_priority: "Reduce tax exposure",
        team_size: "26–50",
        revenue_range: "$5M–$10M",
        timeline: "Immediately",
      },
      contact: {
        firstName: "Sam",
        lastName: "Lee",
        businessName: "Lee Manufacturing",
        email: "sam.lee@example.com",
        phone: "3055550100",
        state: "FL",
        preferredContact: "Email",
        consent: true,
      },
      appointmentRequested: true,
      attribution: { utm_source: "test", source_channel: "meta" },
    });

    expect(lead.owner_type).toBe("ALTUS_PLATFORM_CAMPAIGN");
    expect(lead.distribution_status).toBe("assigned");
    expect(lead.assigned_organization_id).toBe(
      "20000000-0000-4000-8000-000000000002",
    );
    expect(lead.attribution.campaign_id).toBe(campaign.id);
    expect(Object.isFrozen(lead.attribution)).toBe(true);
  });

  it("keeps subscriber campaign leads with the subscriber org", async () => {
    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000003",
      organization_id: "20000000-0000-4000-8000-000000000003",
      organization_slug: "demo-org",
      name: "Demo Growth",
      description: "",
      goal: "generate_leads",
      strategy: "Business Growth",
      audience: {},
      territories: ["FL"],
      channels: ["linkedin"],
      destination: "interactive_assessment",
      budget_cents: 50000,
      template_id: null,
      branding: { organization_name: "Demo Organization" },
      qualification_template_key: "business-growth-assessment-v1",
      distribution_config: { method: "campaign_owner" },
    });
    launchSimCampaign(campaign.id);

    const { lead } = await generateTestLead(campaign.id);
    expect(lead.owner_type).toBe("SUBSCRIBER_CAMPAIGN");
    expect(lead.distribution_status).toBe("subscriber_owned");
    expect(lead.assigned_organization_id).toBe(
      "20000000-0000-4000-8000-000000000003",
    );
    expect(getSimStore().notifications.some((n) => n.lead_id === lead.id)).toBe(
      true,
    );
  });
});
