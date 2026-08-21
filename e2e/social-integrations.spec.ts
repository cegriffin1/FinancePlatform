import { test, expect } from "@playwright/test";

test("subscriber connects Meta, publishes, receives simulated lead", async ({
  request,
}) => {
  const connect = await request.post("/api/integrations", {
    data: { action: "connect", provider: "meta", authCode: "e2e_meta" },
  });
  expect(connect.ok()).toBeTruthy();

  const create = await request.post("/api/campaigns", {
    data: {
      action: "create_and_launch",
      draft: {
        owner_type: "SUBSCRIBER_CAMPAIGN",
        name: "E2E Social Meta",
        description: "",
        goal: "generate_leads",
        strategy: "Tax Strategy",
        secondary_strategies: [],
        audience: { personas: ["Business Owner"], industry: "Manufacturing" },
        territories: ["FL"],
        channels: ["meta"],
        destination: "interactive_assessment",
        budget_cents: 150000,
        organization_slug: "demo-org",
        branding: { organization_name: "Demo Organization", custom_cta: "Learn More" },
      },
    },
  });
  expect(create.ok()).toBeTruthy();
  const created = await create.json();

  const publish = await request.post("/api/campaigns/publish", {
    data: {
      action: "publish",
      campaignId: created.campaign.id,
      confirmationAccepted: true,
      channelConfigs: [
        {
          provider: "meta",
          config: {
            placements: ["facebook", "instagram"],
            objective: "OUTCOME_LEADS",
            daily_budget_cents: 15000,
            cta: "LEARN_MORE",
          },
        },
      ],
    },
  });
  expect(publish.ok()).toBeTruthy();
  const published = await publish.json();
  expect(published.result.status).toBe("active");
  const externalId = published.result.runs[0].external_campaign_id as string;
  expect(externalId).toBeTruthy();

  const webhook = await request.post("/api/webhooks/meta", {
    data: {
      external_event_id: `e2e_${Date.now()}`,
      external_campaign_id: externalId,
      first_name: "Casey",
      last_name: "Nguyen",
      company: "Nguyen Manufacturing",
      email: `casey.nguyen+${Date.now()}@example.com`,
      phone: "4075550144",
      state: "FL",
    },
  });
  expect(webhook.ok()).toBeTruthy();
  const leadJson = await webhook.json();
  expect(leadJson.duplicate).toBe(false);
  expect(leadJson.leadId).toBeTruthy();

  const detail = await request.get(`/api/leads/${leadJson.leadId}`);
  expect(detail.ok()).toBeTruthy();
  const detailJson = await detail.json();
  expect(detailJson.lead.score).toBeGreaterThan(0);
  expect(detailJson.lead.attribution.ad_provider).toBe("meta");
  expect(detailJson.lead.attribution.external_campaign_id).toBe(externalId);

  const metrics = await request.post("/api/campaigns/publish", {
    data: {
      action: "sync_metrics",
      campaignId: created.campaign.id,
      provider: "meta",
    },
  });
  expect(metrics.ok()).toBeTruthy();
});

test("linkedin and google provider contract connect", async ({ request }) => {
  for (const provider of ["linkedin", "google"] as const) {
    const res = await request.post("/api/integrations", {
      data: { action: "connect", provider, authCode: `e2e_${provider}` },
    });
    expect(res.ok()).toBeTruthy();
  }
  const state = await request.get("/api/integrations");
  const json = await state.json();
  expect(json.connections.filter((c: { status: string }) => c.status === "CONNECTED").length).toBeGreaterThanOrEqual(2);
});
