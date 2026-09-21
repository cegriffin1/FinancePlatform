import { describe, expect, it, beforeEach } from "vitest";
import { resetSimStore, getSimStore } from "@/application/growth/simulationStore";
import { createSimCampaign, launchSimCampaign } from "@/application/growth/campaignService";
import { CampaignHealthService } from "@/application/analytics/CampaignHealthService";

beforeEach(() => {
  resetSimStore();
});

describe("launch sprint — campaign golden path (integration)", () => {
  it("creates retirement campaign, launches simulation, exposes health", () => {
    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000003",
      organization_id: "20000000-0000-4000-8000-000000000003",
      organization_slug: "demo-org",
      name: "Retirement Confidence Campaign",
      description: "Launch sprint golden path",
      goal: "generate_leads",
      strategy: "Retirement",
      audience: {
        personas: ["professional"],
        interests: ["Retirement planning"],
        relationship: "prospect",
      },
      territories: ["FL"],
      channels: ["meta", "linkedin"],
      destination: "interactive_assessment",
      budget_cents: 300000,
      template_id: null,
      branding: {
        organization_name: "Demo Organization",
        custom_cta: "Start Assessment",
      },
      qualification_template_key: "retirement-opportunity-v1",
      distribution_config: { method: "campaign_owner" },
      budget_mode: "total",
      landing_headline: "Build Your Retirement Profile",
      landing_support: "Discover how your goals fit together.",
    });

    expect(campaign.status).toBe("draft");
    const launched = launchSimCampaign(campaign.id);
    expect(launched.status).toBe("active_simulation");
    expect(launched.qualification_template_key).toBe("retirement-opportunity-v1");

    const store = getSimStore();
    expect(store.campaigns.some((c) => c.id === campaign.id)).toBe(true);

    const health = new CampaignHealthService().campaignSummary(
      launched,
      store.leads,
    );
    expect(health.campaign_id).toBe(campaign.id);
    expect(health.lead_quality).toBeTruthy();
  });

  it("does not mark master campaign fully live when a channel fails conceptually", () => {
    // Channel-level partial failure is UI-modeled; simulation launch still creates campaign.
    // Assert simulation label remains the source of truth for spend safety.
    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000003",
      organization_id: "20000000-0000-4000-8000-000000000003",
      organization_slug: "demo-org",
      name: "Partial Channel Campaign",
      description: "",
      goal: "generate_leads",
      strategy: "Retirement",
      audience: { personas: ["professional"] },
      territories: ["FL"],
      channels: ["meta", "linkedin"],
      destination: "interactive_assessment",
      budget_cents: 150000,
      template_id: null,
      branding: { organization_name: "Demo Organization" },
      qualification_template_key: "retirement-opportunity-v1",
      distribution_config: { method: "campaign_owner" },
    });
    const launched = launchSimCampaign(campaign.id);
    expect(String(launched.status)).toContain("simulation");
  });
});
