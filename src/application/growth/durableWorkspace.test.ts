import { describe, expect, it } from "vitest";
import {
  countActiveCampaigns,
  deriveCampaignAnalytics,
  enrichCampaignsWithLeadCounts,
  isActiveCampaignStatus,
  isCrmHotTemperature,
  mapDurableLead,
} from "./durableWorkspace";

describe("durableWorkspace", () => {
  it("treats published campaigns as active", () => {
    expect(isActiveCampaignStatus("published")).toBe(true);
    expect(isActiveCampaignStatus("draft")).toBe(false);
    expect(countActiveCampaigns([{ status: "published" }, { status: "draft" }])).toBe(
      1,
    );
  });

  it("categorizes HOT / VERY_HOT / READY_NOW as CRM hot", () => {
    expect(isCrmHotTemperature("HOT")).toBe(true);
    expect(isCrmHotTemperature("VERY_HOT")).toBe(true);
    expect(isCrmHotTemperature("READY_NOW")).toBe(true);
    expect(isCrmHotTemperature("COLD")).toBe(false);
  });

  it("maps durable leads with null-safe optional fields", () => {
    const mapped = mapDurableLead({
      id: "lead-1",
      campaign_id: "camp-1",
      organization_id: "org-1",
      temperature_key: "VERY_HOT",
      opportunity_score: 88,
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      assessment_answers: null,
      attribution: null,
    });
    expect(mapped.first_name).toBe("");
    expect(mapped.last_name).toBe("");
    expect(mapped.email).toBe("");
    expect(mapped.phone).toBe("");
    expect(mapped.assessment_answers).toEqual({});
    expect(mapped.attribution).toEqual({});
    expect(mapped.score).toBe(88);
    expect(mapped.temperature_key).toBe("VERY_HOT");
  });

  it("derives campaign lead counts from organization-scoped leads", () => {
    const camp = "2f3c71dc-0e03-417c-a9e6-661b446bf29c";
    const other = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const leads = [
      { campaign_id: camp, temperature_key: "HOT" },
      { campaign_id: camp, temperature_key: "VERY_HOT" },
      { campaign_id: camp, temperature_key: "READY_NOW" },
      { campaign_id: other, temperature_key: "HOT" },
    ];
    const analytics = deriveCampaignAnalytics(camp, leads, null);
    expect(analytics.leads).toBe(3);
    expect(analytics.hot_leads).toBe(3);
  });

  it("enriches campaigns without an analytics column", () => {
    const campaigns = [
      { id: "camp-a", status: "published", name: "Direct Retirement Assessment" },
    ];
    const leads = [
      { campaign_id: "camp-a", temperature_key: "HOT" },
      { campaign_id: "camp-a", temperature_key: "COLD" },
    ];
    const enriched = enrichCampaignsWithLeadCounts(campaigns, leads);
    expect(enriched[0]?.analytics.leads).toBe(2);
    expect(enriched[0]?.analytics.hot_leads).toBe(1);
  });
});
