import { test, expect } from "@playwright/test";

test("lead intelligence vertical journey", async ({ request }) => {
  const create = await request.post("/api/campaigns", {
    data: {
      action: "create_and_launch",
      draft: {
        owner_type: "ALTUS_PLATFORM_CAMPAIGN",
        name: "E2E Lead Intelligence",
        description: "",
        goal: "generate_leads",
        strategy: "Tax Strategy",
        secondary_strategies: [],
        audience: { personas: ["Business Owner"] },
        territories: ["FL"],
        channels: ["linkedin"],
        destination: "interactive_assessment",
        budget_cents: 200000,
        organization_slug: "altus",
        branding: { organization_name: "ALTUS", custom_cta: "Start" },
      },
    },
  });
  expect(create.ok()).toBeTruthy();
  const created = await create.json();

  const leadRes = await request.post("/api/public/leads", {
    data: {
      organizationSlug: "altus",
      campaignSlug: created.campaign.slug,
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
        email: `marcus.reed+${Date.now()}@reedlogistics.example`,
        phone: "3055550188",
        state: "FL",
        preferredContact: "Phone",
        consent: true,
      },
      appointmentRequested: true,
      submissionStartedAt: new Date(Date.now() - 120000).toISOString(),
      honeypot: "",
      attribution: { utm_source: "linkedin", source_channel: "linkedin" },
    },
  });
  expect(leadRes.ok()).toBeTruthy();
  const leadJson = await leadRes.json();
  expect(leadJson.duplicate).toBe(false);
  expect(leadJson.grade).toBeTruthy();
  expect(leadJson.distributionStatus).toBe("assigned");

  const detail = await request.get(`/api/leads/${leadJson.leadId}`);
  expect(detail.ok()).toBeTruthy();
  const detailJson = await detail.json();
  expect(detailJson.lead.intelligence.quality_gate).toBe("ACCEPT");
  expect(detailJson.lead.score_snapshots.length).toBeGreaterThan(0);

  const outcome = await request.post(`/api/leads/${leadJson.leadId}`, {
    data: {
      action: "outcome",
      outcome: "Won",
      stage: "Won",
      closed_value_cents: 2500000,
    },
  });
  expect(outcome.ok()).toBeTruthy();
  const outcomeJson = await outcome.json();
  expect(outcomeJson.lead.outcome).toBe("Won");
  expect(outcomeJson.lead.closed_value_cents).toBe(2500000);
});
