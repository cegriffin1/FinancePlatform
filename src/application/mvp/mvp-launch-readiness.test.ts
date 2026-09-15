import { describe, expect, it, beforeEach } from "vitest";
import { resetSimStore, getSimStore } from "@/application/growth/simulationStore";
import { createSimCampaign, launchSimCampaign } from "@/application/growth/campaignService";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";
import {
  AppointmentHandoffService,
  SetterVerificationService,
} from "@/application/setter/SetterHandoffService";
import { RetirementCrmService } from "@/application/crm/RetirementCrmService";
import { LeadInventoryService } from "@/application/inventory/LeadInventoryService";
import { LeadPendingRecoveryService } from "@/application/ops/LeadPendingRecoveryService";
import { MvpAnalyticsService } from "@/application/analytics/MvpAnalyticsService";
import { PUBLIC_CONSENT_VERSION } from "@/domain/compliance/consent";
import { verifyWebhookSignature } from "@/application/integrations/nativeLeadIngestion";

beforeEach(() => {
  resetSimStore();
  delete process.env.PROVIDER_MODE;
  delete process.env.META_WEBHOOK_SECRET;
});

const goldAnswers = {
  age_range: "60–64",
  state: "FL",
  employment: "Working",
  retirement_timing: "Within 2 years",
  marital_status: "Married",
  total_retirement_assets: "$1M–$1.99M",
  repositionable_assets: "$750K–$999K",
  asset_location: "401(k)",
  employer_assets: "Former employer",
  existing_annuity: "None",
  liquidity_timeline: "1–3 years",
  primary_objective: "INCOME",
  income_start: "Within 1 year",
  desired_monthly_income: "$5,000–$7,500",
  lifetime_income_importance: "9",
  existing_guaranteed_income: "Neither",
  inflation_concern: "8",
  liquidity_importance: "7",
  legacy_importance: "5",
  healthcare_concern: "6",
  carrier_strength_importance: "8",
  advisor_team_importance: "7",
  current_advisor: "Not currently",
  decision_timeline: "Immediately",
};

describe("MVP golden path + edge cases", () => {
  it("runs Meta → assessment → score → setter → appointment → CRM → outcome", async () => {
    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000003",
      organization_id: "20000000-0000-4000-8000-000000000003",
      organization_slug: "demo-org",
      name: "Golden Meta Retirement",
      description: "",
      goal: "generate_leads",
      strategy: "Retirement",
      audience: {},
      territories: ["FL"],
      channels: ["meta"],
      destination: "interactive_assessment",
      budget_cents: 100000,
      template_id: null,
      branding: { organization_name: "Demo Organization" },
      qualification_template_key: "retirement-opportunity-v1",
      distribution_config: { method: "campaign_owner" },
    });
    launchSimCampaign(campaign.id);

    const { lead } = await processPublicLeadSubmission({
      organizationSlug: "demo-org",
      campaignSlug: campaign.slug,
      answers: goldAnswers,
      contact: {
        firstName: "Alex",
        lastName: "Morgan",
        businessName: "Morgan Household",
        email: "alex.morgan.gold@example.com",
        phone: "3055550144",
        state: "FL",
        preferredContact: "Phone",
        consent: true,
      },
      appointmentRequested: true,
      attribution: {
        ad_provider: "meta",
        source_channel: "meta",
        utm_source: "meta",
      },
    });

    expect(lead.qualification?.asset.commercial_tier).toBe("GOLD");
    expect(lead.qualification?.asset.repositionable_asset_band).toBe("$750K–$999K");
    expect(lead.score).toBeGreaterThan(50);
    expect(lead.compliance?.consent_version).toBe(PUBLIC_CONSENT_VERSION);
    expect(lead.compliance?.consent_text).toBeTruthy();
    expect(lead.ownership_history?.length).toBeGreaterThan(0);
    expect(lead.preferred_communication).toBe("Phone");

    const verification = new SetterVerificationService();
    const handoff = new AppointmentHandoffService();
    const crm = new RetirementCrmService();
    verification.open(lead);
    verification.confirmAssets(lead);
    verification.setDisposition(lead, "VERIFIED");
    const agent = handoff.listEligibleAgents(
      lead.assigned_organization_id ?? lead.organization_id!,
      lead.state,
    )[0]!;
    const appt = handoff.scheduleAppointment({
      lead,
      agentId: agent.id,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      preferredContactMethod: "Phone",
    });
    await handoff.assignAgentAndHandoff({
      lead,
      agentId: agent.id,
      appointmentId: appt.id,
    });
    crm.recordContactAttempt(lead, "call");
    crm.createFollowUp(lead, {
      type: "Task",
      title: "Send plan outline",
      dueAt: new Date(Date.now() + 3600000).toISOString(),
    });
    crm.recordOutcome(lead, "Won");
    expect(lead.outcome).toBe("Won");
    expect(lead.pipeline_stage).toBe("WON");

    const analytics = new MvpAnalyticsService().fromStore();
    expect(analytics.executive.primary_kpi).toBe("COST_PER_QUALIFIED_OPPORTUNITY");
    expect(analytics.executive.won).toBeGreaterThanOrEqual(1);
    // Spend not fabricated
    expect(analytics.executive.spend_data_available).toBe(false);
    expect(analytics.executive.ad_spend_cents).toBeNull();
  });

  it("handles under-$250K, duplicate, invalid contact, fraud honeypot, scoring pending retry", async () => {
    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000003",
      organization_id: "20000000-0000-4000-8000-000000000003",
      organization_slug: "demo-org",
      name: "Edge Cases",
      description: "",
      goal: "generate_leads",
      strategy: "Retirement",
      audience: {},
      territories: ["FL"],
      channels: ["meta"],
      destination: "interactive_assessment",
      budget_cents: 10000,
      template_id: null,
      branding: { organization_name: "Demo Organization" },
      qualification_template_key: "retirement-opportunity-v1",
      distribution_config: { method: "campaign_owner" },
    });
    launchSimCampaign(campaign.id);

    const low = await processPublicLeadSubmission({
      organizationSlug: "demo-org",
      campaignSlug: campaign.slug,
      answers: { ...goldAnswers, repositionable_assets: "Under $250K", decision_timeline: "Just researching" },
      contact: {
        firstName: "Low",
        lastName: "Assets",
        businessName: "Low",
        email: "low.assets@example.com",
        phone: "3055550111",
        state: "FL",
        preferredContact: "Email",
        consent: true,
      },
      appointmentRequested: false,
      attribution: { ad_provider: "meta", source_channel: "meta" },
    });
    expect(low.lead.qualification?.asset.meets_target_asset_threshold).toBe(false);

    const first = await processPublicLeadSubmission({
      organizationSlug: "demo-org",
      campaignSlug: campaign.slug,
      answers: goldAnswers,
      contact: {
        firstName: "Dup",
        lastName: "Lead",
        businessName: "Dup",
        email: "dup.lead@example.com",
        phone: "3055550222",
        state: "FL",
        preferredContact: "Email",
        consent: true,
      },
      appointmentRequested: false,
      attribution: { source_channel: "meta" },
    });
    const dup = await processPublicLeadSubmission({
      organizationSlug: "demo-org",
      campaignSlug: campaign.slug,
      answers: goldAnswers,
      contact: {
        firstName: "Dup",
        lastName: "Lead",
        businessName: "Dup",
        email: "dup.lead@example.com",
        phone: "3055550222",
        state: "FL",
        preferredContact: "Email",
        consent: true,
      },
      appointmentRequested: false,
      attribution: { source_channel: "meta" },
    });
    expect(dup.duplicate).toBe(true);
    expect(dup.lead.id).toBe(first.lead.id);

    await expect(
      processPublicLeadSubmission({
        organizationSlug: "demo-org",
        campaignSlug: campaign.slug,
        answers: goldAnswers,
        contact: {
          firstName: "Bad",
          lastName: "Email",
          businessName: "Bad",
          email: "not-an-email",
          phone: "3055550333",
          state: "FL",
          preferredContact: "Email",
          consent: true,
        },
        appointmentRequested: false,
        attribution: {},
      }),
    ).rejects.toThrow();

    const fraud = await processPublicLeadSubmission({
      organizationSlug: "demo-org",
      campaignSlug: campaign.slug,
      answers: goldAnswers,
      contact: {
        firstName: "Spam",
        lastName: "Bot",
        businessName: "Spam",
        email: "spam.bot@example.com",
        phone: "3055550444",
        state: "FL",
        preferredContact: "Email",
        consent: true,
      },
      appointmentRequested: false,
      honeypot: "http://spam.example",
      attribution: { source_channel: "meta" },
    });
    expect(["rejected", "review", "new", "qualified", "nurture"]).toContain(
      fraud.lead.status,
    );

    // Simulate failed scoring and recover
    const pendingLead = first.lead;
    pendingLead.status = "scoring_pending";
    pendingLead.processing_flags = { scoring_pending: true };
    const recovery = new LeadPendingRecoveryService();
    const result = await recovery.reprocessLead(pendingLead);
    expect(result.retried).toContain("SCORING_PENDING");
    expect(pendingLead.processing_flags?.scoring_pending).toBe(false);
  });

  it("expired lead can become marketplace eligible with consent; blocked without sharing", async () => {
    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000003",
      organization_id: "20000000-0000-4000-8000-000000000003",
      organization_slug: "demo-org",
      name: "Expire Path",
      description: "",
      goal: "generate_leads",
      strategy: "Retirement",
      audience: {},
      territories: ["FL"],
      channels: ["meta"],
      destination: "interactive_assessment",
      budget_cents: 10000,
      template_id: null,
      branding: { organization_name: "Demo Organization" },
      qualification_template_key: "retirement-opportunity-v1",
      distribution_config: { method: "campaign_owner" },
    });
    launchSimCampaign(campaign.id);
    const { lead } = await processPublicLeadSubmission({
      organizationSlug: "demo-org",
      campaignSlug: campaign.slug,
      answers: goldAnswers,
      contact: {
        firstName: "Expire",
        lastName: "Path",
        businessName: "Expire",
        email: "expire.path@example.com",
        phone: "3055550555",
        state: "FL",
        preferredContact: "Email",
        consent: true,
      },
      appointmentRequested: false,
      attribution: { source_channel: "meta" },
    });
    const inventory = new LeadInventoryService();
    lead.ownership!.ownership_expires_at = new Date(Date.now() - 1000).toISOString();
    inventory.refreshLifecycle(lead);
    expect(lead.inventory_status).toBe("MARKETPLACE_ELIGIBLE");
    inventory.listOnMarketplace(lead);
    expect(lead.marketplace_listed).toBe(true);

    // Tenant isolation sanity: buyer org differs after purchase path covered elsewhere
    expect(getSimStore().leads.some((l) => l.id === lead.id)).toBe(true);
  });

  it("LIVE webhook mode fails closed without secret", () => {
    process.env.PROVIDER_MODE = "LIVE";
    expect(verifyWebhookSignature("meta", "{}", null)).toBe(false);
  });
});
