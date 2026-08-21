import { describe, expect, it, beforeEach } from "vitest";
import { LeadQualityGateService } from "@/application/intelligence/qualityGate";
import { LeadIdentityResolutionService } from "@/application/intelligence/identityResolution";
import {
  buildIntelligenceProfile,
  IntentDecayPolicy,
  NextBestActionService,
  gradeFromPriority,
} from "@/application/intelligence/scoring";
import { AssessmentDecisionEngine } from "@/application/intelligence/assessmentDecision";
import { IntentSurgeService } from "@/application/intelligence/intentSurge";
import { LeadSlaService } from "@/application/intelligence/lifecycle";
import { CampaignQualityService } from "@/application/intelligence/insights";
import { resetSimStore } from "@/application/growth/simulationStore";
import { createSimCampaign, launchSimCampaign } from "@/application/growth/campaignService";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";

beforeEach(() => {
  resetSimStore();
});

describe("LeadQualityGateService", () => {
  it("accepts complete valid submissions", async () => {
    const gate = new LeadQualityGateService();
    const result = await gate.evaluate({
      email: "owner@reedlogistics.example",
      phone: "3055550142",
      firstName: "Marcus",
      lastName: "Reed",
      businessName: "Reed Logistics",
      state: "FL",
      consent: true,
      answers: {},
      submissionStartedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(result.outcome).toBe("ACCEPT");
  });

  it("flags honeypot as suspected fraud", async () => {
    const gate = new LeadQualityGateService();
    const result = await gate.evaluate({
      email: "a@b.com",
      phone: "3055550142",
      firstName: "Marcus",
      lastName: "Reed",
      businessName: "Reed Logistics",
      state: "FL",
      consent: true,
      answers: {},
      honeypot: "http://spam.example",
      submissionStartedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(result.outcome).toBe("SUSPECTED_FRAUD");
  });

  it("rejects invalid phone", async () => {
    const gate = new LeadQualityGateService();
    const result = await gate.evaluate({
      email: "a@b.com",
      phone: "123",
      firstName: "Marcus",
      lastName: "Reed",
      businessName: "Reed Logistics",
      state: "FL",
      consent: true,
      answers: {},
      submissionStartedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(result.outcome).toBe("REJECT");
  });
});

describe("LeadIdentityResolutionService", () => {
  it("detects duplicate submissions", () => {
    const service = new LeadIdentityResolutionService();
    const result = service.resolve(
      {
        id: "new",
        email: "a@b.com",
        phone: "3055550142",
        firstName: "A",
        lastName: "B",
        businessName: "Co",
        campaignId: "camp1",
      },
      [
        {
          id: "old",
          email: "a@b.com",
          phone: "3055550142",
          firstName: "A",
          lastName: "B",
          businessName: "Co",
          campaignId: "camp1",
        },
      ],
    );
    expect(result.result).toBe("DUPLICATE_SUBMISSION");
  });
});

describe("multidimensional scoring", () => {
  it("builds intelligence profile with grade and next action", () => {
    const profile = buildIntelligenceProfile({
      answers: {
        business_stage: "Growing steadily",
        financial_priority: "Reduce tax exposure",
        team_size: "26–50",
        revenue_range: "$5M–$10M",
        timeline: "Within 30 days",
      },
      campaignStrategy: "Tax Strategy",
      campaignTerritories: ["FL"],
      state: "FL",
      consent: true,
      appointmentRequested: true,
      assessmentCompleted: true,
      contactSubmitted: true,
      emailStatus: "NOT_VERIFIED",
      phoneStatus: "NOT_VERIFIED",
      fraudRisk: "LOW",
      qualityGate: "ACCEPT",
      identityResult: "NEW_PERSON",
      createdAt: new Date().toISOString(),
    });
    expect(profile.overall_priority_score).toBeGreaterThan(70);
    expect(["A+", "A", "B"]).toContain(profile.quality_grade);
    expect(profile.conversion_model_label).toBe("RULE_BASED_ESTIMATE");
    expect(profile.recommended_action).toBe("BOOK_APPOINTMENT");
    expect(profile.explanation.length).toBeGreaterThan(20);
  });

  it("decays intent over time", () => {
    const decay = new IntentDecayPolicy();
    const fresh = decay.decay(20, new Date().toISOString());
    const old = decay.decay(
      20,
      new Date(Date.now() - 90 * 24 * 3600_000).toISOString(),
    );
    expect(fresh).toBeGreaterThan(old);
  });

  it("grades priority bands", () => {
    expect(gradeFromPriority(95)).toBe("A+");
    expect(gradeFromPriority(50)).toBe("C");
  });
});

describe("assessment decision engine", () => {
  it("adds succession follow-up when priority selected", () => {
    const engine = new AssessmentDecisionEngine();
    const ordered = engine.getOrderedQuestions({
      financial_priority: "Prepare for succession",
    });
    expect(ordered.some((q) => q.key === "transition_timeframe")).toBe(true);
  });
});

describe("intent surge + sla + campaign quality", () => {
  it("detects meaningful intent surge", () => {
    const now = new Date().toISOString();
    const result = new IntentSurgeService().detect([
      { type: "assessment_completed", occurred_at: now },
      { type: "appointment_requested", occurred_at: now },
    ]);
    expect(result.surged).toBe(true);
  });

  it("tracks sla timers", () => {
    const created = new Date(Date.now() - 2 * 60_000).toISOString();
    const timers = new LeadSlaService().buildTimers({
      createdAt: created,
      firstViewedAt: new Date().toISOString(),
      temperature: "PRIORITY",
    });
    expect(timers.time_to_first_view_ms).toBeGreaterThan(0);
    expect(timers.sla_minutes).toBe(5);
  });

  it("computes campaign quality score", () => {
    const metrics = new CampaignQualityService().compute({
      raw_leads: 100,
      accepted_leads: 80,
      qualified_leads: 40,
      hot_leads: 10,
      priority_leads: 5,
      appointments: 20,
      opportunities: 8,
      wins: 2,
      invalid: 5,
      duplicates: 3,
      contacted: 50,
    });
    expect(metrics.quality_score).toBeGreaterThan(0);
  });
});

describe("end-to-end intelligence pipeline", () => {
  it("scores and grades a premier-routable lead", async () => {
    const campaign = createSimCampaign({
      owner_type: "ALTUS_PLATFORM_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000001",
      organization_id: null,
      organization_slug: "altus",
      name: "Intel Tax FL",
      description: "",
      goal: "generate_leads",
      strategy: "Tax Strategy",
      audience: {},
      territories: ["FL"],
      channels: ["linkedin"],
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
        firstName: "Marcus",
        lastName: "Reed",
        businessName: "Reed Logistics LLC",
        email: "marcus.reed@reedlogistics.example",
        phone: "3055550199",
        state: "FL",
        preferredContact: "Phone",
        consent: true,
      },
      appointmentRequested: true,
      attribution: { utm_source: "linkedin", source_channel: "linkedin" },
      submissionStartedAt: new Date(Date.now() - 120_000).toISOString(),
    });

    expect(lead.intelligence).toBeTruthy();
    expect(lead.intelligence?.quality_gate).toBe("ACCEPT");
    expect(lead.score_snapshots?.length).toBeGreaterThan(0);
    expect(lead.distribution_status).toBe("assigned");
    expect(lead.assigned_organization_id).toBe(
      "20000000-0000-4000-8000-000000000002",
    );
  });
});

describe("next best action", () => {
  it("recommends manager review for fraud gate", () => {
    const action = new NextBestActionService().recommend({
      grade: "REVIEW",
      temperature: "WARM",
      phoneOk: true,
      emailOk: true,
      consent: true,
      appointmentRequested: false,
      qualityGate: "SUSPECTED_FRAUD",
    });
    expect(action).toBe("MANAGER_REVIEW");
  });
});
