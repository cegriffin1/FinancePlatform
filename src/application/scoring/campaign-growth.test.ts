import { describe, expect, it } from "vitest";
import { ConfigurableLeadScoringService } from "@/application/scoring/ConfigurableLeadScoringService";
import { ConfigurableLeadDistributionService } from "@/application/distribution/ConfigurableLeadDistributionService";
import { ConfigurableLeadClassificationService } from "@/application/classification/ConfigurableLeadClassificationService";
import { InMemorySubscriptionEntitlementService } from "@/application/entitlements/InMemorySubscriptionEntitlementService";
import { DEFAULT_SCORE_TEMPERATURE_BANDS } from "@/domain/types/campaign-engine";
import type { Lead, LeadEvent } from "@/domain/types";

const lead: Lead = {
  id: "00000000-0000-4000-8000-000000000001",
  organization_id: "00000000-0000-4000-8000-000000000002",
  campaign_id: null,
  contact_id: null,
  assigned_to: null,
  team_id: null,
  status: "new",
  score: null,
  source: null,
  temperature_key: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: null,
  updated_by: null,
};

function event(type: string): LeadEvent {
  return {
    id: crypto.randomUUID(),
    organization_id: lead.organization_id,
    lead_id: lead.id,
    event_type: type,
    occurred_at: new Date().toISOString(),
    actor_profile_id: null,
    payload: {},
    created_at: new Date().toISOString(),
  };
}

describe("ConfigurableLeadScoringService", () => {
  it("builds fit/intent/engagement scores and temperature from events", async () => {
    const service = new ConfigurableLeadScoringService();
    const result = await service.score(lead, {
      organizationId: lead.organization_id,
      events: [
        event("assessment.completed"),
        event("contact.submitted"),
        event("appointment.scheduled"),
        event("landing.viewed"),
      ],
      fitSignals: {
        business_owner: true,
        company_size: "25-100",
        strategy_fit: 0.8,
      },
      rulePack: {
        id: "00000000-0000-4000-8000-000000000010",
        organization_id: null,
        module_key: null,
        key: "default",
        version: "score-v1",
        rules: [],
      },
      thresholds: {
        id: "00000000-0000-4000-8000-000000000011",
        organization_id: null,
        version: "temp-v1",
        bands: [...DEFAULT_SCORE_TEMPERATURE_BANDS],
      },
    });

    expect(result.fitScore).toBeGreaterThan(0);
    expect(result.intentScore).toBeGreaterThan(0);
    expect(result.engagementScore).toBeGreaterThan(0);
    expect(result.score).toBe(result.fitScore + result.intentScore + result.engagementScore);
    expect(["WARM", "QUALIFIED", "HOT", "PRIORITY"]).toContain(result.temperatureKey);
    expect(result.scoringVersion).toBe("score-v1");
    expect(service.toBreakdown(result).explanation).toContain(result.temperatureKey);
  });
});

describe("ConfigurableLeadDistributionService", () => {
  it("rejects ineligible candidates and prefers Premier for priority leads", async () => {
    const service = new ConfigurableLeadDistributionService();
    const priorityLead = { ...lead, temperature_key: "PRIORITY", score: 93 };

    const decision = await service.distribute(priorityLead, {
      method: "priority_tier",
      ruleVersion: "dist-v1",
      leadTerritory: "FL",
      strategyCategories: ["Tax Strategy"],
      requiredLicenseTypes: ["life"],
      preferPremierForPriority: true,
      candidates: [
        {
          organizationId: "org-standard-fl",
          subscriptionTier: "STANDARD",
          territories: ["FL"],
          strategyKeys: ["Tax Strategy"],
          licenseTypes: ["life"],
          capacityRemaining: 5,
        },
        {
          organizationId: "org-premier-fl",
          subscriptionTier: "PREMIER",
          territories: ["FL"],
          strategyKeys: ["Tax Strategy"],
          licenseTypes: ["life"],
          capacityRemaining: 3,
        },
        {
          organizationId: "org-premier-tx",
          subscriptionTier: "PREMIER",
          territories: ["TX"],
          strategyKeys: ["Tax Strategy"],
          licenseTypes: ["life"],
          capacityRemaining: 10,
        },
      ],
    });

    expect(decision.selected_organization_id).toBe("org-premier-fl");
    expect(
      decision.candidate_rejections.some((r) => r.reason.includes("Territory")),
    ).toBe(true);
    expect(decision.distribution_method).toBe("priority_tier");
  });

  it("keeps subscriber-owned leads with campaign owner method", async () => {
    const service = new ConfigurableLeadDistributionService();
    const decision = await service.distribute(lead, {
      method: "campaign_owner",
      ruleVersion: "dist-v1",
      leadTerritory: null,
      strategyCategories: [],
      preferPremierForPriority: false,
      candidates: [
        {
          organizationId: lead.organization_id,
          subscriptionTier: "PRO",
          territories: ["FL"],
          strategyKeys: ["Business Growth"],
          licenseTypes: [],
          capacityRemaining: 2,
        },
        {
          organizationId: "other-org",
          subscriptionTier: "PREMIER",
          territories: ["FL"],
          strategyKeys: ["Business Growth"],
          licenseTypes: [],
          capacityRemaining: 9,
        },
      ],
    });

    expect(decision.selected_organization_id).toBe(lead.organization_id);
  });
});

describe("classification + entitlements", () => {
  it("classifies multiple strategy buckets from signals", async () => {
    const service = new ConfigurableLeadClassificationService();
    const result = await service.classify(lead, {
      organizationId: lead.organization_id,
      signals: { tax: 0.9, succession: 0.6 },
      classificationVersion: "class-v1",
    });
    expect(result.map((r) => r.strategy_category)).toEqual(
      expect.arrayContaining(["Tax Strategy", "Succession"]),
    );
  });

  it("grants Premier priority pool entitlement", async () => {
    const service = new InMemorySubscriptionEntitlementService({
      "org-1": "PREMIER",
      "org-2": "STANDARD",
    });
    expect(await service.hasEntitlement("org-1", "leads.priority_platform_pool")).toBe(
      true,
    );
    expect(await service.hasEntitlement("org-2", "leads.priority_platform_pool")).toBe(
      false,
    );
  });
});
