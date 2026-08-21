import { test, expect } from "@playwright/test";

test("subscriber campaign vertical slice", async ({ request }) => {
  const create = await request.post("/api/campaigns", {
    data: {
      action: "create_and_launch",
      draft: {
        owner_type: "SUBSCRIBER_CAMPAIGN",
        name: "E2E Subscriber Growth",
        description: "",
        goal: "generate_leads",
        strategy: "Business Growth",
        secondary_strategies: [],
        audience: { personas: ["Business Owner"] },
        territories: ["FL"],
        channels: ["meta"],
        destination: "interactive_assessment",
        budget_cents: 100000,
        organization_slug: "demo-org",
        branding: { organization_name: "Demo Organization", custom_cta: "Start" },
      },
    },
  });
  expect(create.ok()).toBeTruthy();
  const created = await create.json();

  const leadRes = await request.post("/api/dev/generate-test-lead", {
    data: { campaignId: created.campaign.id },
  });
  expect(leadRes.ok()).toBeTruthy();
  const leadJson = await leadRes.json();
  expect(leadJson.distributionStatus).toBe("subscriber_owned");
  expect(leadJson.assignedOrganizationId).toBe(
    "20000000-0000-4000-8000-000000000003",
  );

  const detail = await request.get(`/api/leads/${leadJson.leadId}`);
  expect(detail.ok()).toBeTruthy();
  const detailJson = await detail.json();
  expect(detailJson.lead.business_name).toBe("Acme Manufacturing");
  expect(detailJson.events.length).toBeGreaterThan(3);
  expect(detailJson.lead.score).toBeGreaterThan(0);
});

test("platform campaign distributes to premier", async ({ request }) => {
  const create = await request.post("/api/campaigns", {
    data: {
      action: "create_and_launch",
      draft: {
        owner_type: "ALTUS_PLATFORM_CAMPAIGN",
        name: "E2E Platform Tax",
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
  const leadRes = await request.post("/api/dev/generate-test-lead", {
    data: { campaignId: created.campaign.id },
  });
  const leadJson = await leadRes.json();
  expect(leadRes.ok()).toBeTruthy();
  expect(leadJson.distributionStatus).toBe("assigned");
  expect(leadJson.assignedOrganizationId).toBe(
    "20000000-0000-4000-8000-000000000002",
  );
  expect(leadJson.temperature).toMatch(/HOT|PRIORITY/);
});
