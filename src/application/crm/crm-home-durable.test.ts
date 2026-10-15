import { describe, expect, it } from "vitest";
import { RetirementCrmService } from "./RetirementCrmService";
import { mapDurableLead, isCrmHotTemperature } from "@/application/growth/durableWorkspace";
import type { SimLead } from "@/application/growth/simulationStore";

describe("CRM home with durable org-scoped leads", () => {
  it("counts HOT / VERY_HOT / READY_NOW in hot_leads metric", () => {
    const leads = [
      mapDurableLead({
        id: "1",
        organization_id: "org",
        campaign_id: "camp",
        temperature_key: "HOT",
        opportunity_score: 70,
        created_at: new Date().toISOString(),
      }),
      mapDurableLead({
        id: "2",
        organization_id: "org",
        campaign_id: "camp",
        temperature_key: "VERY_HOT",
        opportunity_score: 90,
        created_at: new Date().toISOString(),
      }),
      mapDurableLead({
        id: "3",
        organization_id: "org",
        campaign_id: "camp",
        temperature_key: "READY_NOW",
        opportunity_score: 95,
        created_at: new Date().toISOString(),
      }),
      mapDurableLead({
        id: "4",
        organization_id: "org",
        campaign_id: "camp",
        temperature_key: "COLD",
        opportunity_score: 20,
        created_at: new Date().toISOString(),
      }),
    ] as unknown as SimLead[];

    const home = new RetirementCrmService().buildAgentHome(leads, "Advisor");
    expect(home.metrics.hot_leads).toBe(3);
    expect(leads.filter((l) => isCrmHotTemperature(l.temperature_key)).length).toBe(
      3,
    );
    // Single greeting string — no duplicate prefix baked into consumers
    expect(home.greeting.startsWith("GOOD ")).toBe(true);
    expect(home.greeting).toContain("ADVISOR");
    expect(home.greeting.match(/GOOD /g)?.length).toBe(1);
  });

  it("scopes metrics to the provided lead set only (tenant isolation at data layer)", () => {
    const orgA = [
      mapDurableLead({
        id: "a1",
        organization_id: "org-a",
        campaign_id: "c1",
        temperature_key: "HOT",
        created_at: new Date().toISOString(),
      }),
    ] as unknown as SimLead[];
    const home = new RetirementCrmService().buildAgentHome(orgA, "Advisor");
    expect(home.metrics.hot_leads).toBe(1);
    expect(home.priority_opportunities.every((l) => l.organization_id === "org-a")).toBe(
      true,
    );
  });
});
