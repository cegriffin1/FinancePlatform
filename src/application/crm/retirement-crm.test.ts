import { describe, expect, it, beforeEach } from "vitest";
import { resetSimStore, getSimStore } from "@/application/growth/simulationStore";
import { createSimCampaign, launchSimCampaign } from "@/application/growth/campaignService";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";
import {
  AppointmentHandoffService,
  SetterVerificationService,
} from "@/application/setter/SetterHandoffService";
import { RetirementCrmService } from "@/application/crm/RetirementCrmService";
import {
  AltusCRMProvider,
  Dynamics365CRMProvider,
} from "@/infrastructure/providers/AltusCRMProvider";
import {
  DEFAULT_OWNERSHIP_PERIOD_DAYS,
  computeOwnershipExpiry,
} from "@/domain/types/retirement-crm";
import { createProviderContainer } from "@/infrastructure/providers/container";

beforeEach(() => {
  resetSimStore();
});

const answers = {
  age_range: "60–64",
  state: "FL",
  employment: "Working",
  retirement_timing: "Within 2 years",
  marital_status: "Married",
  total_retirement_assets: "$500K–$749K",
  repositionable_assets: "$500K–$749K",
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
  decision_timeline: "Within 30 days",
};

describe("CRM providers", () => {
  it("defaults to AltusCRMProvider without D365", () => {
    const container = createProviderContainer();
    expect(container.crm).toBeInstanceOf(AltusCRMProvider);
    expect(container.dynamics365).toBeInstanceOf(Dynamics365CRMProvider);
  });

  it("ownership period uses config default, not hardcoded call-site magic", () => {
    expect(DEFAULT_OWNERSHIP_PERIOD_DAYS).toBe(60);
    const start = "2026-01-01T00:00:00.000Z";
    const expiry = computeOwnershipExpiry(start);
    expect(expiry).toBe("2026-03-02T00:00:00.000Z");
    const custom = computeOwnershipExpiry(start, { ownership_period_days: 30 });
    expect(custom).toBe("2026-01-31T00:00:00.000Z");
  });

  it("Dynamics365 placeholder refuses until configured", async () => {
    await expect(
      new Dynamics365CRMProvider().syncLead("org", { id: "x" } as never),
    ).rejects.toThrow(/not configured/i);
  });
});

describe("Full journey: campaign → CRM won/lost", () => {
  it("runs assessment through setter appointment into agent CRM outcomes", async () => {
    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000003",
      organization_id: "20000000-0000-4000-8000-000000000003",
      organization_slug: "demo-org",
      name: "CRM Retirement Journey",
      description: "",
      goal: "generate_leads",
      strategy: "Retirement",
      audience: {},
      territories: ["FL"],
      channels: ["meta"],
      destination: "interactive_assessment",
      budget_cents: 80000,
      template_id: null,
      branding: { organization_name: "Demo Organization" },
      qualification_template_key: "retirement-opportunity-v1",
      distribution_config: { method: "campaign_owner" },
    });
    launchSimCampaign(campaign.id);

    const { lead } = await processPublicLeadSubmission({
      organizationSlug: "demo-org",
      campaignSlug: campaign.slug,
      answers,
      contact: {
        firstName: "Riley",
        lastName: "Chen",
        businessName: "Chen Household",
        email: "riley.chen@example.com",
        phone: "3055550177",
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

    expect(lead.qualification).toBeTruthy();
    expect(lead.score).toBeGreaterThan(0);
    expect(lead.ownership).toBeTruthy();
    expect(lead.ownership!.period_days).toBe(
      getSimStore().ownership_config.ownership_period_days,
    );
    expect(["NEW", "SETTER_REVIEW", "NURTURE"]).toContain(lead.pipeline_stage);

    const verification = new SetterVerificationService();
    const handoff = new AppointmentHandoffService();
    const crm = new RetirementCrmService();

    verification.open(lead);
    verification.confirmAssets(lead);
    verification.setDisposition(lead, "VERIFIED");
    expect(lead.pipeline_stage).toBe("VERIFIED");

    const agent = handoff.listEligibleAgents(
      lead.assigned_organization_id ?? lead.organization_id!,
      lead.state,
    )[0]!;
    const appointment = handoff.scheduleAppointment({
      lead,
      agentId: agent.id,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      preferredContactMethod: "Phone",
    });
    expect(lead.pipeline_stage).toBe("APPOINTMENT_SET");

    await handoff.assignAgentAndHandoff({
      lead,
      agentId: agent.id,
      appointmentId: appointment.id,
    });
    expect(lead.ownership!.owner_id).toBe(agent.id);
    expect(lead.qualification!.commercial_status).toBe("ASSIGNED");

    const home = crm.buildAgentHome([lead], agent.name);
    expect(home.greeting).toContain(agent.name.toUpperCase());
    expect(home.priority_opportunities.some((l) => l.id === lead.id)).toBe(true);

    crm.recordContactAttempt(lead, "call", "Connected");
    expect(lead.pipeline_stage).toBe("CONTACTED");
    expect(lead.contact_attempts?.length).toBe(1);

    crm.addNote(lead, "Strong income need; confirmed former employer plan.");
    crm.createFollowUp(lead, {
      type: "Callback",
      title: "Callback tomorrow",
      dueAt: new Date(Date.now() + 3600000).toISOString(),
    });
    crm.setStage(lead, "OPPORTUNITY");
    expect(lead.pipeline_stage).toBe("OPPORTUNITY");

    crm.recordOutcome(lead, "Won");
    expect(lead.pipeline_stage).toBe("WON");
    expect(lead.outcome).toBe("Won");

    const store = getSimStore();
    const camp = store.campaigns.find((c) => c.id === campaign.id)!;
    expect(camp.analytics.outcome_counts?.Won).toBe(1);
    expect(camp.analytics.won).toBe(1);
    expect(store.crm_sync_log.some((e) => e.provider === "altus")).toBe(true);

    // Lost path on a second lead-style outcome recording is covered by stage map
    const lostLead = { ...lead, id: "50000000-0000-4000-8000-000000000088", outcome: null };
    store.leads.push(lostLead as never);
    crm.recordOutcome(lostLead as never, "Lost");
    expect(lostLead.pipeline_stage).toBe("LOST");
    expect(camp.analytics.lost).toBe(1);
  });
});
