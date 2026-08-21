import { describe, expect, it } from "vitest";
import {
  ADVANCED_MARKETS_DESCRIPTOR,
  ADVANCED_MARKETS_STRATEGY_CATEGORIES,
} from "@/domain/accelerators/advanced-markets";
import { DEFAULT_LEAD_TEMPERATURES } from "@/domain/types/growth-engine";
import { StubLeadScoringService } from "@/infrastructure/providers/StubLeadScoringService";
import type { Lead } from "@/domain/types";

describe("Advanced Markets accelerator boundary", () => {
  it("registers as a module without replacing core lead ownership", () => {
    expect(ADVANCED_MARKETS_DESCRIPTOR.key).toBe("advanced_markets");
    expect(ADVANCED_MARKETS_DESCRIPTOR.registers.qualificationTemplates).toBe(
      true,
    );
    expect(ADVANCED_MARKETS_STRATEGY_CATEGORIES.length).toBeGreaterThan(5);
  });

  it("keeps temperature vocabulary configurable via defaults list", () => {
    expect(DEFAULT_LEAD_TEMPERATURES).toContain("HOT");
    expect(DEFAULT_LEAD_TEMPERATURES).toContain("PRIORITY");
  });
});

describe("LeadScoringService stub", () => {
  it("derives temperature from threshold config, not UI hard-codes", async () => {
    const service = new StubLeadScoringService();
    const lead = {
      id: "00000000-0000-4000-8000-000000000001",
      organization_id: "00000000-0000-4000-8000-000000000002",
      campaign_id: null,
      contact_id: null,
      assigned_to: null,
      team_id: null,
      status: "new",
      score: 85,
      source: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: null,
      updated_by: null,
    } satisfies Lead;

    const result = await service.score(lead, {
      organizationId: lead.organization_id,
      events: [
        {
          id: "00000000-0000-4000-8000-000000000020",
          organization_id: lead.organization_id,
          lead_id: lead.id,
          event_type: "assessment.completed",
          occurred_at: new Date().toISOString(),
          actor_profile_id: null,
          payload: {},
          created_at: new Date().toISOString(),
        },
        {
          id: "00000000-0000-4000-8000-000000000021",
          organization_id: lead.organization_id,
          lead_id: lead.id,
          event_type: "contact.submitted",
          occurred_at: new Date().toISOString(),
          actor_profile_id: null,
          payload: {},
          created_at: new Date().toISOString(),
        },
        {
          id: "00000000-0000-4000-8000-000000000022",
          organization_id: lead.organization_id,
          lead_id: lead.id,
          event_type: "appointment.scheduled",
          occurred_at: new Date().toISOString(),
          actor_profile_id: null,
          payload: {},
          created_at: new Date().toISOString(),
        },
      ],
      fitSignals: {
        business_owner: true,
        company_size: "50-100",
        revenue_range: "$10M+",
        strategy_fit: 1,
      },
      rulePack: {
        id: "00000000-0000-4000-8000-000000000003",
        organization_id: null,
        module_key: "advanced_markets",
        key: "default",
        version: "v1",
        rules: [],
      },
      thresholds: {
        id: "00000000-0000-4000-8000-000000000004",
        organization_id: null,
        version: "v1",
        bands: [
          { key: "COLD", min_score: 0 },
          { key: "WARM", min_score: 40 },
          { key: "HOT", min_score: 70 },
          { key: "PRIORITY", min_score: 90 },
        ],
      },
    });

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.temperatureKey).toBe("HOT");
    expect(result.scoringVersion).toBe("v1");
  });
});
