import { describe, expect, it } from "vitest";
import {
  leadAnswer,
  leadDisplayInitial,
  leadMatchesQuery,
  leadSourceLabel,
  operationalTemperatureOf,
} from "./leadCommandCenterView";
import {
  NextBestActionService,
  SpeedToLeadService,
} from "./SpeedToLeadService";
import type { SimLead } from "@/application/growth/simulationStore";
import { mapDurableLead } from "@/application/growth/durableWorkspace";

function supabaseShapedLead(overrides: Record<string, unknown> = {}) {
  return mapDurableLead({
    id: "f7cb6243-9638-434c-992a-226c5cef04f4",
    organization_id: "8a052a6e-50f2-4392-b309-c774c92a1d9e",
    campaign_id: "2f3c71dc-0e03-417c-a9e6-661b446bf29c",
    temperature_key: "VERY_HOT",
    operational_temperature: "HOT",
    opportunity_score: 46,
    first_name: "Test",
    last_name: "Lead",
    email: "test@example.com",
    phone: "555-0100",
    // production table has no business_name
    assessment_answers: {
      repositionable_assets: "$750K–$999K",
      primary_objective: "BALANCE",
      decision_timeline: "Within 30 days",
    },
    attribution: { utm_source: "DIRECT_ASSESSMENT", source: "DIRECT_ASSESSMENT" },
    created_at: new Date().toISOString(),
    ...overrides,
  }) as unknown as SimLead;
}

describe("leadCommandCenterView", () => {
  it("maps fine-grained temperatures to operational HOT/MEDIUM/COLD", () => {
    expect(operationalTemperatureOf({ temperature_key: "VERY_HOT" })).toBe("HOT");
    expect(operationalTemperatureOf({ temperature_key: "READY_NOW" })).toBe("HOT");
    expect(operationalTemperatureOf({ temperature_key: "HOT" })).toBe("HOT");
    expect(operationalTemperatureOf({ temperature_key: "WARM" })).toBe("MEDIUM");
    expect(operationalTemperatureOf({ temperature_key: "COLD" })).toBe("COLD");
    expect(
      operationalTemperatureOf({ operational_temperature: "MEDIUM" }),
    ).toBe("MEDIUM");
  });

  it("tolerates missing optional lead fields without throwing", () => {
    const sparse = {
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      business_name: null,
      assessment_answers: null,
      attribution: null,
    };
    expect(leadDisplayInitial(sparse)).toBe("");
    expect(leadMatchesQuery(sparse, "test")).toBe(false);
    expect(leadMatchesQuery(sparse, "")).toBe(true);
    expect(leadAnswer(sparse, "repositionable_assets")).toBeNull();
    expect(leadSourceLabel(sparse)).toBe("—");
  });

  it("renders SpeedToLead and NextBestAction for Supabase-shaped leads", () => {
    const lead = supabaseShapedLead({ business_name: undefined });
    expect(() => new SpeedToLeadService().formatCountdown(lead)).not.toThrow();
    expect(() => new NextBestActionService().recommend(lead)).not.toThrow();
    const nba = new NextBestActionService().recommend(lead);
    expect(nba.headline.length).toBeGreaterThan(0);
  });

  it("does not throw when searching leads without business_name", () => {
    const lead = supabaseShapedLead();
    delete (lead as { business_name?: string }).business_name;
    expect(leadMatchesQuery(lead, "test")).toBe(true);
    expect(leadMatchesQuery(lead, "zzz-no-match")).toBe(false);
  });
});
