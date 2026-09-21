import { describe, expect, it, beforeEach } from "vitest";
import { resetSimStore, getSimStore } from "@/application/growth/simulationStore";
import {
  ensureDirectRetirementCampaign,
  DIRECT_RETIREMENT_CAMPAIGN_SLUG,
  DIRECT_RETIREMENT_ORG_SLUG,
} from "@/application/growth/campaignService";
import { AssessmentSessionService } from "@/application/growth/AssessmentSessionService";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";

beforeEach(() => {
  resetSimStore();
});

describe("Direct homepage assessment entry", () => {
  it("ensureDirectRetirementCampaign creates a stable active retirement campaign", () => {
    const a = ensureDirectRetirementCampaign();
    const b = ensureDirectRetirementCampaign();
    expect(a.slug).toBe(DIRECT_RETIREMENT_CAMPAIGN_SLUG);
    expect(a.organization_slug).toBe(DIRECT_RETIREMENT_ORG_SLUG);
    expect(a.qualification_template_key).toBe("retirement-opportunity-v1");
    expect(a.id).toBe(b.id);
    expect(["active", "active_simulation", "published"]).toContain(String(a.status));
  });

  it("DIRECT_ASSESSMENT session completes to a scored lead", async () => {
    const campaign = ensureDirectRetirementCampaign();
    const sessions = new AssessmentSessionService();
    const session = sessions.create({
      campaign_id: campaign.id,
      organization_id: campaign.organization_id!,
      organization_slug: campaign.organization_slug,
      campaign_slug: campaign.slug,
      attribution: {
        provider: "direct",
        utm_source: "DIRECT_ASSESSMENT",
        source_channel: "DIRECT_ASSESSMENT",
        landing_page: "/assessment/retirement",
      },
    });
    sessions.markStarted(session.id);
    sessions.persistAnswer(session.id, "age_range", "60–64");
    sessions.persistAnswer(session.id, "state", "FL");
    sessions.persistAnswer(session.id, "employment", "Working");
    sessions.persistAnswer(session.id, "retirement_timing", "Within 2 years");
    sessions.persistAnswer(session.id, "marital_status", "Married");
    sessions.persistAnswer(session.id, "total_retirement_assets", "$1M–$1.99M");
    sessions.persistAnswer(session.id, "repositionable_assets", "$750K–$999K");
    sessions.persistAnswer(session.id, "asset_location", "401(k)");
    sessions.persistAnswer(session.id, "employer_assets", "Former employer");
    sessions.persistAnswer(session.id, "existing_annuity", "None");
    sessions.persistAnswer(session.id, "liquidity_timeline", "1–3 years");
    sessions.persistAnswer(session.id, "primary_objective", "BALANCE");
    sessions.persistAnswer(session.id, "principal_protection", "8");
    sessions.persistAnswer(session.id, "growth_participation", "7");
    sessions.persistAnswer(session.id, "income_start", "Within 1 year");
    sessions.persistAnswer(session.id, "lifetime_income_importance", "9");
    sessions.persistAnswer(session.id, "inflation_concern", "8");
    sessions.persistAnswer(session.id, "liquidity_importance", "7");
    sessions.persistAnswer(session.id, "legacy_importance", "5");
    sessions.persistAnswer(session.id, "healthcare_concern", "6");
    sessions.persistAnswer(session.id, "carrier_strength_importance", "8");
    sessions.persistAnswer(session.id, "advisor_team_importance", "7");
    sessions.persistAnswer(session.id, "current_advisor", "Not currently");
    sessions.persistAnswer(session.id, "decision_timeline", "Within 30 days");

    const { lead, consumerProfile } = await processPublicLeadSubmission({
      organizationSlug: DIRECT_RETIREMENT_ORG_SLUG,
      campaignSlug: DIRECT_RETIREMENT_CAMPAIGN_SLUG,
      sessionId: session.id,
      answers: sessions.get(session.id)!.answers,
      contact: {
        firstName: "Taylor",
        lastName: "Nguyen",
        businessName: "",
        email: "taylor.direct@example.com",
        phone: "3055550177",
        state: "FL",
        preferredContact: "Phone",
        consent: true,
      },
      appointmentRequested: true,
      attribution: {
        utm_source: "DIRECT_ASSESSMENT",
        source_channel: "DIRECT_ASSESSMENT",
        ad_provider: "direct",
      },
    });

    expect(getSimStore().leads.some((l) => l.id === lead.id)).toBe(true);
    expect(lead.attribution.utm_source).toBe("DIRECT_ASSESSMENT");
    expect(lead.assessment_answers.repositionable_assets).toBe("$750K–$999K");
    expect(lead.score).toBeGreaterThan(0);
    expect(lead.temperature_key).toBeTruthy();
    expect(consumerProfile.repositionable_band).toBe("$750K–$999K");
    expect(JSON.stringify(consumerProfile)).not.toMatch(/Opportunity Score|GOLD|DIAMOND/i);
  });
});
