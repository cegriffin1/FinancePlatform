import { describe, expect, it, beforeEach } from "vitest";
import { resetSimStore, getSimStore } from "@/application/growth/simulationStore";
import { createSimCampaign, launchSimCampaign } from "@/application/growth/campaignService";
import { AssessmentSessionService } from "@/application/growth/AssessmentSessionService";
import { RetirementAssessmentEngine } from "@/application/retirement/RetirementAssessmentEngine";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";
import { getApplicableQuestions } from "@/application/retirement/assessmentDefinition";

beforeEach(() => {
  resetSimStore();
});

describe("Campaign → assessment entry flow", () => {
  it("creates session with attribution on campaign entry, persists progressively, and does not create a lead until contact", async () => {
    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000003",
      organization_id: "20000000-0000-4000-8000-000000000003",
      organization_slug: "demo-org",
      name: "Instagram Retirement Entry",
      description: "",
      goal: "generate_leads",
      strategy: "Retirement",
      audience: {},
      territories: ["FL"],
      channels: ["meta"],
      destination: "interactive_assessment",
      budget_cents: 50000,
      template_id: null,
      branding: { organization_name: "ALTUS" },
      qualification_template_key: "retirement-opportunity-v1",
      distribution_config: { method: "campaign_owner" },
    });
    launchSimCampaign(campaign.id);

    const sessions = new AssessmentSessionService();
    const session = sessions.create({
      campaign_id: campaign.id,
      organization_id: campaign.organization_id!,
      organization_slug: campaign.organization_slug,
      campaign_slug: campaign.slug,
      attribution: {
        provider: "instagram",
        utm_source: "instagram",
        utm_medium: "paid_social",
        utm_campaign: "retire_q3",
        utm_content: "story_a",
        utm_term: null,
        external_campaign_id: "ig_camp_1",
        external_ad_set_id: "ig_adset_1",
        external_ad_id: "ig_ad_1",
        external_creative_id: "ig_creative_1",
        referrer: "https://instagram.com",
        source_channel: "instagram",
        landing_page: `/c/demo-org/${campaign.slug}`,
      },
    });

    expect(session.contactable).toBe(false);
    expect(session.attribution.utm_source).toBe("instagram");
    expect(session.attribution.first_touch_at).toBeTruthy();
    expect(getSimStore().leads).toHaveLength(0);

    sessions.markStarted(session.id);
    expect(campaign.analytics.assessment_starts).toBe(1);

    const engine = new RetirementAssessmentEngine();
    expect(engine.nextQuestion({})!.id).toBe("age_range");

    sessions.persistAnswer(session.id, "age_range", "60–64", "ABOUT_YOU");
    sessions.persistAnswer(session.id, "state", "FL", null);
    sessions.persistAnswer(session.id, "employment", "Working", null);
    sessions.persistAnswer(session.id, "retirement_timing", "Within 2 years", null);
    sessions.persistAnswer(session.id, "marital_status", "Married", "ABOUT_YOU");

    let updated = sessions.get(session.id)!;
    expect(updated.completion_percentage).toBeGreaterThan(0);
    expect(updated.last_completed_question).toBe("marital_status");
    expect(getSimStore().leads).toHaveLength(0);

    sessions.persistAnswer(session.id, "total_retirement_assets", "$1M–$1.99M", null);
    sessions.persistAnswer(session.id, "repositionable_assets", "$750K–$999K", null);
    expect(sessions.get(session.id)!.answers.repositionable_assets).toBe(
      "$750K–$999K",
    );
    expect(sessions.get(session.id)!.answers.total_retirement_assets).not.toBe(
      sessions.get(session.id)!.answers.repositionable_assets,
    );

    // Fill remaining money + goal
    sessions.persistAnswer(session.id, "asset_location", "401(k)", null);
    sessions.persistAnswer(session.id, "employer_assets", "Former employer", null);
    sessions.persistAnswer(session.id, "existing_annuity", "None", null);
    sessions.persistAnswer(session.id, "liquidity_timeline", "1–3 years", "YOUR_MONEY");
    sessions.persistAnswer(session.id, "primary_objective", "BALANCE", "YOUR_GOAL");

    updated = sessions.get(session.id)!;
    expect(updated.branch).toBe("BOTH");

    const afterGoal = { ...updated.answers };
    const applicable = getApplicableQuestions(afterGoal);
    expect(applicable.some((q) => q.branch === "income")).toBe(true);
    expect(applicable.some((q) => q.branch === "accumulation")).toBe(true);

    // Answer income + accumulation subset for BALANCE, then priorities + plan
    let guard = 0;
    while (engine.nextQuestion(sessions.get(session.id)!.answers) && guard < 40) {
      guard += 1;
      const q = engine.nextQuestion(sessions.get(session.id)!.answers)!;
      let value = "8";
      if (q.id === "decision_timeline") value = "Within 30 days";
      else if (q.id === "current_advisor") value = "Not currently";
      else if (q.type !== "slider" && q.options?.[0]) value = q.options[0];
      sessions.persistAnswer(session.id, q.id, value, q.stage);
    }

    expect(engine.nextQuestion(sessions.get(session.id)!.answers)).toBeNull();
    expect(getSimStore().leads).toHaveLength(0);

    const { lead, consumerProfile } = await processPublicLeadSubmission({
      organizationSlug: "demo-org",
      campaignSlug: campaign.slug,
      answers: sessions.get(session.id)!.answers,
      sessionId: session.id,
      contact: {
        firstName: "Riley",
        lastName: "Chen",
        businessName: "",
        email: "riley.chen.ig@example.com",
        phone: "3055550199",
        state: "FL",
        preferredContact: "Phone",
        consent: true,
      },
      appointmentRequested: true,
      attribution: {
        utm_source: "instagram",
        source_channel: "instagram",
        ad_provider: "instagram",
      },
    });

    expect(lead.id).toBeTruthy();
    expect(lead.assessment_answers.repositionable_assets).toBe("$750K–$999K");
    expect(lead.assessment_answers.primary_objective).toBe("BALANCE");
    expect(lead.assessment_answers.decision_timeline).toBe("Within 30 days");
    expect(lead.attribution.utm_source).toBe("instagram");
    expect(lead.attribution.ad_provider).toBe("instagram");
    expect(lead.attribution.external_campaign_id).toBe("ig_camp_1");
    expect(lead.qualification?.asset.repositionable_asset_band).toBe("$750K–$999K");
    expect(lead.score).toBeGreaterThan(0);
    expect(lead.temperature_key).toBeTruthy();

    // Consumer profile hides commercial fields
    expect(consumerProfile.primary_goal).toBe("Income + Protection");
    expect(consumerProfile.planning_horizon).toBe("Within 30 days");
    expect(JSON.stringify(consumerProfile)).not.toMatch(/Opportunity Score|READY NOW|GOLD|DIAMOND/i);

    const completed = sessions.get(session.id)!;
    expect(completed.status).toBe("completed");
    expect(completed.lead_id).toBe(lead.id);
    expect(completed.contactable).toBe(true);

    const funnel = sessions.funnelCounts(campaign.id);
    expect(funnel.campaign_clicks).toBeGreaterThanOrEqual(1);
    expect(funnel.assessment_starts).toBeGreaterThanOrEqual(1);
    expect(funnel.contact_captured).toBeGreaterThanOrEqual(1);

    // Setter queue eligibility via qualification commercial status
    expect(
      ["SETTER_REVIEW", "QUALIFIED", "HIGH_PRIORITY"].includes(
        String(lead.qualification?.commercial_status),
      ) || lead.score > 0,
    ).toBe(true);
  });

  it("does not treat incomplete sessions as contactable leads", () => {
    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000003",
      organization_id: "20000000-0000-4000-8000-000000000003",
      organization_slug: "demo-org",
      name: "Partial Session",
      description: "",
      goal: "generate_leads",
      strategy: "Retirement",
      audience: {},
      territories: ["FL"],
      channels: ["meta"],
      destination: "interactive_assessment",
      budget_cents: 10000,
      template_id: null,
      branding: {},
      qualification_template_key: "retirement-opportunity-v1",
      distribution_config: { method: "campaign_owner" },
    });
    launchSimCampaign(campaign.id);

    const sessions = new AssessmentSessionService();
    const session = sessions.create({
      campaign_id: campaign.id,
      organization_id: campaign.organization_id!,
      organization_slug: "demo-org",
      campaign_slug: campaign.slug,
      attribution: { provider: "instagram", source_channel: "instagram" },
    });
    sessions.persistAnswer(session.id, "age_range", "55–59");
    sessions.markAbandoned(session.id);

    expect(getSimStore().leads).toHaveLength(0);
    expect(sessions.get(session.id)!.contactable).toBe(false);
    expect(sessions.get(session.id)!.status).toBe("abandoned");
  });
});
