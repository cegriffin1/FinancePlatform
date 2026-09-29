import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSimStore, getSimStore } from "@/application/growth/simulationStore";
import { AssessmentSessionService } from "@/application/growth/AssessmentSessionService";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";
import { ensureDirectRetirementCampaign } from "@/application/growth/campaignService";
import { getDataMode } from "@/lib/dataMode";

describe("Production Foundation — public golden path (simulation mode)", () => {
  beforeEach(() => {
    resetSimStore();
    vi.stubEnv("ALTUS_DATA_MODE", "simulation");
  });

  it("uses simulation data mode by default", () => {
    expect(getDataMode()).toBe("simulation");
  });

  it("creates session with opaque resume token and requires it for access", () => {
    const campaign = ensureDirectRetirementCampaign();
    const session = new AssessmentSessionService().create({
      campaign_id: campaign.id,
      organization_id: campaign.organization_id!,
      organization_slug: campaign.organization_slug,
      campaign_slug: campaign.slug,
      attribution: {
        utm_source: "meta",
        utm_medium: "paid",
        utm_campaign: "retire",
        utm_term: "income",
        altus_click_id: "click-abc",
      },
    });

    expect(session.resume_token.length).toBeGreaterThanOrEqual(32);
    expect(session.attribution.altus_campaign_id).toBe(campaign.id);
    expect(session.attribution.altus_click_id).toBe("click-abc");
    expect(session.attribution.utm_term).toBe("income");

    const svc = new AssessmentSessionService();
    expect(svc.getAuthorized(session.id, "wrong-token")).toBeNull();
    expect(svc.getAuthorized(session.id, session.resume_token)?.id).toBe(
      session.id,
    );
  });

  it("persists answers and resumes from token", () => {
    const campaign = ensureDirectRetirementCampaign();
    const svc = new AssessmentSessionService();
    const session = svc.create({
      campaign_id: campaign.id,
      organization_id: campaign.organization_id!,
      organization_slug: campaign.organization_slug,
      campaign_slug: campaign.slug,
      attribution: {},
    });
    svc.markStarted(session.id);
    svc.persistAnswer(session.id, "age_range", "55–64", "ABOUT_YOU");
    svc.persistAnswer(session.id, "primary_objective", "INCOME", "YOUR_GOAL");

    const resumed = svc.getByResumeToken(session.resume_token);
    expect(resumed?.answers.age_range).toBe("55–64");
    expect(resumed?.branch).toBe("INCOME");
    expect(resumed?.contactable).toBe(false);
  });

  it("creates exactly one lead on repeated contact submission", async () => {
    const store = getSimStore();
    const campaign = ensureDirectRetirementCampaign();
    const svc = new AssessmentSessionService();
    const session = svc.create({
      campaign_id: campaign.id,
      organization_id: campaign.organization_id!,
      organization_slug: campaign.organization_slug,
      campaign_slug: campaign.slug,
      attribution: { utm_source: "linkedin" },
    });
    svc.persistAnswer(session.id, "repositionable_assets", "$750K–$999K");
    svc.persistAnswer(session.id, "decision_timeline", "Within 30 days");

    const payload = {
      organizationSlug: campaign.organization_slug,
      campaignSlug: campaign.slug,
      answers: {
        repositionable_assets: "$750K–$999K",
        decision_timeline: "Within 30 days",
        primary_objective: "INCOME",
      },
      contact: {
        firstName: "Pat",
        lastName: "Pilot",
        businessName: "Pat Pilot",
        email: "pat.pilot@example.com",
        phone: "5551234567",
        state: "FL",
        preferredContact: "Phone",
        consent: true,
      },
      appointmentRequested: true,
      attribution: { utm_source: "linkedin", utm_term: "retire" },
      sessionId: session.id,
      resumeToken: session.resume_token,
    };

    const first = await processPublicLeadSubmission(payload);
    const second = await processPublicLeadSubmission(payload);

    expect(first.lead.id).toBeTruthy();
    expect(second.duplicate).toBe(true);
    expect(second.lead.id).toBe(first.lead.id);
    expect(
      store.leads.filter((l) => l.email === "pat.pilot@example.com"),
    ).toHaveLength(1);
    expect(first.lead.attribution.utm_term).toBe("retire");
    expect(first.lead.operational_temperature).toBeTruthy();
    expect(
      first.lead.qualification?.opportunity.opportunity_score,
    ).toBeGreaterThan(0);
  });

  it("does not expose contactable lead from incomplete session", () => {
    const campaign = ensureDirectRetirementCampaign();
    const session = new AssessmentSessionService().create({
      campaign_id: campaign.id,
      organization_id: campaign.organization_id!,
      organization_slug: campaign.organization_slug,
      campaign_slug: campaign.slug,
      attribution: {},
    });
    expect(session.contactable).toBe(false);
    expect(session.lead_id).toBeNull();
  });
});

describe("Production Foundation — authorization helpers", () => {
  it("allows simulation workspace without spoofable role headers", async () => {
    vi.stubEnv("ALTUS_DATA_MODE", "simulation");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ALTUS_ALLOW_UNAUTHENTICATED_SIM", "false");
    const { requireOrgAuth } = await import(
      "@/infrastructure/security/requireOrgAuth"
    );
    const result = await requireOrgAuth({ permission: "leads.view_own" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.userId).toBe("sim-user");
    }
  });
});
