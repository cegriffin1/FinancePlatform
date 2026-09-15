import { describe, expect, it, beforeEach } from "vitest";
import { resetSimStore, getSimStore } from "@/application/growth/simulationStore";
import { createSimCampaign, launchSimCampaign } from "@/application/growth/campaignService";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";
import {
  AppointmentHandoffService,
  SetterVerificationService,
} from "@/application/setter/SetterHandoffService";
import {
  DEFAULT_ROLE_PERMISSIONS,
  hasPermission,
} from "@/domain/permissions/keys";
import {
  canSetterManageAppointments,
  canSetterVerify,
  canSetterViewLeads,
} from "@/application/authorization";

beforeEach(() => {
  resetSimStore();
});

const retirementAnswers = {
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

describe("setter permissions", () => {
  it("gives setter QC permissions without platform-admin", () => {
    const setter = DEFAULT_ROLE_PERMISSIONS.setter;
    expect(canSetterViewLeads(setter)).toBe(true);
    expect(canSetterVerify(setter)).toBe(true);
    expect(canSetterManageAppointments(setter)).toBe(true);
    expect(hasPermission(setter, "organization.update")).toBe(false);
    expect(hasPermission(setter, "users.invite")).toBe(false);
    expect(hasPermission(setter, "campaigns.publish")).toBe(false);
  });

  it("does not grant setter.verify to sales by default", () => {
    expect(canSetterVerify(DEFAULT_ROLE_PERMISSIONS.sales)).toBe(false);
  });
});

describe("E2E: Meta → assessment → setter → agent handoff", () => {
  it("qualifies a $500K prospect and completes verified warm handoff without mutating assessment", async () => {
    const campaign = createSimCampaign({
      owner_type: "SUBSCRIBER_CAMPAIGN",
      owner_id: "20000000-0000-4000-8000-000000000003",
      organization_id: "20000000-0000-4000-8000-000000000003",
      organization_slug: "demo-org",
      name: "Meta Retirement FL",
      description: "Meta retirement opportunity",
      goal: "generate_leads",
      strategy: "Retirement",
      audience: {},
      territories: ["FL"],
      channels: ["meta"],
      destination: "interactive_assessment",
      budget_cents: 75000,
      template_id: null,
      branding: { organization_name: "Demo Organization" },
      qualification_template_key: "retirement-opportunity-v1",
      distribution_config: { method: "campaign_owner" },
    });
    launchSimCampaign(campaign.id);

    const originalAnswers = { ...retirementAnswers };
    const { lead } = await processPublicLeadSubmission({
      organizationSlug: "demo-org",
      campaignSlug: campaign.slug,
      answers: retirementAnswers,
      contact: {
        firstName: "Pat",
        lastName: "Nguyen",
        businessName: "Nguyen Household",
        email: "pat.nguyen@example.com",
        phone: "3055550199",
        state: "FL",
        preferredContact: "Phone",
        consent: true,
      },
      appointmentRequested: true,
      attribution: {
        utm_source: "meta",
        source_channel: "meta",
        ad_provider: "meta",
        external_campaign_id: "meta-camp-500k",
      },
    });

    // Qualified $500K GOLD path
    expect(lead.qualification).toBeTruthy();
    expect(lead.qualification!.asset.commercial_tier).toBe("GOLD");
    expect(lead.qualification!.asset.meets_target_asset_threshold).toBe(true);
    expect(lead.qualification!.asset.verification_status).toBe("SELF_REPORTED");
    expect(lead.score).toBeGreaterThanOrEqual(55);
    expect(lead.attribution.ad_provider).toBe("meta");

    const store = getSimStore();
    const eventTypes = store.events
      .filter((e) => e.lead_id === lead.id)
      .map((e) => e.event_type);
    expect(eventTypes).toEqual(expect.arrayContaining(["lead_submitted", "lead_scored"]));

    // Same lead record — no duplicate
    expect(store.leads.filter((l) => l.email === lead.email)).toHaveLength(1);

    const verification = new SetterVerificationService();
    const handoff = new AppointmentHandoffService();

    verification.open(lead, "setter-e2e");
    verification.markCallAttempted(lead);

    const beforeAssets = { ...lead.assessment_answers };
    verification.verifyField(lead, "identity", "CONFIRMED", {
      setterUserId: "setter-e2e",
    });
    verification.verifyField(lead, "state", "CONFIRMED");
    verification.verifyField(lead, "contact", "CONFIRMED");
    verification.verifyField(lead, "repositionable_assets", "CONFIRMED");
    verification.verifyField(lead, "asset_location", "CONFIRMED");
    verification.verifyField(lead, "primary_objective", "CONFIRMED");
    verification.verifyField(lead, "decision_timeline", "CONFIRMED");
    verification.verifyField(lead, "appointment_interest", "CONFIRMED");

    expect(lead.assessment_answers).toEqual(beforeAssets);
    expect(lead.assessment_answers).toEqual(originalAnswers);
    expect(lead.setter_verification!.asset_verification_status).toBe(
      "SETTER_CONFIRMED",
    );
    expect(lead.qualification!.asset.verification_status).toBe("SETTER_CONFIRMED");

    const agents = handoff.listEligibleAgents(
      lead.assigned_organization_id ?? lead.organization_id!,
      lead.state,
    );
    expect(agents.length).toBeGreaterThan(0);
    const agent = agents[0]!;
    const intro = handoff.getIntroduction(agent.id);
    expect(intro?.approved_introduction_script).toBeTruthy();
    expect(intro?.approved_introduction_script).not.toMatch(/CFP|Series 7|guaranteed returns/i);

    const appointment = handoff.scheduleAppointment({
      lead,
      agentId: agent.id,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      preferredContactMethod: "Phone",
      notes: "Warm handoff after asset confirmation",
      createdBy: "setter-e2e",
    });
    expect(lead.qualification!.commercial_status).toBe("APPOINTMENT_READY");
    expect(appointment.status).toBe("confirmed");

    await handoff.assignAgentAndHandoff({
      lead,
      agentId: agent.id,
      appointmentId: appointment.id,
    });

    expect(lead.qualification!.commercial_status).toBe("ASSIGNED");
    expect(lead.assigned_agent_id).toBe(agent.id);
    expect(lead.assigned_agent_label).toBe(agent.name);
    expect(lead.distribution_status).toBe("assigned");

    const agentNote = store.notifications.find(
      (n) =>
        n.lead_id === lead.id &&
        n.title === "NEW VERIFIED RETIREMENT OPPORTUNITY",
    );
    expect(agentNote).toBeTruthy();
    expect(agentNote!.channel).toBe("in_app");
    expect(agentNote!.body).toContain("Opportunity Score");
    expect(agentNote!.metadata?.assessment_answers).toEqual(originalAnswers);
    expect(agentNote!.metadata?.setter_verification).toBeTruthy();
    expect(agentNote!.metadata?.appointment).toBeTruthy();

    const timeline = store.events
      .filter((e) => e.lead_id === lead.id)
      .map((e) => e.event_type);
    expect(timeline).toEqual(
      expect.arrayContaining([
        "lead_submitted",
        "lead_scored",
        "setter_opened",
        "call_attempted",
        "assets_confirmed",
        "appointment_created",
        "agent_assigned",
        "agent_notified",
      ]),
    );

    // Agent opens complete profile (same lead id)
    const crmLead = store.leads.find((l) => l.id === lead.id)!;
    expect(crmLead.qualification).toBeTruthy();
    expect(crmLead.setter_verification).toBeTruthy();
    expect(crmLead.appointments?.length).toBeGreaterThan(0);
    expect(Object.keys(crmLead.assessment_answers).length).toBeGreaterThan(10);
  });

  it("requires reason for disqualifying dispositions", () => {
    const lead = {
      id: "50000000-0000-4000-8000-000000000099",
      assessment_answers: {},
      organization_id: "20000000-0000-4000-8000-000000000003",
      assigned_organization_id: "20000000-0000-4000-8000-000000000003",
    } as never;
    const store = getSimStore();
    store.leads.push(lead as never);
    const service = new SetterVerificationService();
    expect(() => service.setDisposition(lead as never, "DISQUALIFIED")).toThrow(
      /requires a reason/,
    );
  });
});
