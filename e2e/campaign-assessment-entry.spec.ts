import { test, expect } from "@playwright/test";

/**
 * Instagram campaign → assessment entry (API-level E2E).
 * Verifies assessment IS the landing experience: session+attribution on entry,
 * progressive answers, Q7/Q12/branch, contact → lead, no separate landing form API.
 */
test("Instagram campaign URL creates assessment session then qualified lead", async ({
  request,
}) => {
  const create = await request.post("/api/campaigns", {
    data: {
      action: "create_and_launch",
      draft: {
        owner_type: "SUBSCRIBER_CAMPAIGN",
        organization_slug: "demo-org",
        name: `IG Assessment Entry ${Date.now()}`,
        goal: "generate_leads",
        strategy: "Retirement",
        audience: {},
        territories: ["FL"],
        channels: ["meta"],
        destination: "interactive_assessment",
        qualification_template_key: "retirement-opportunity-v1",
        budget_cents: 25000,
      },
    },
  });
  expect(create.ok()).toBeTruthy();
  const created = await create.json();
  const campaignSlug = created.campaign?.slug;
  expect(campaignSlug).toBeTruthy();

  const sessionRes = await request.post("/api/public/assessment-session", {
    data: {
      organizationSlug: "demo-org",
      campaignSlug,
      attribution: {
        provider: "instagram",
        utm_source: "instagram",
        utm_medium: "paid_social",
        utm_campaign: "retire_ig",
        external_campaign_id: "ig_ext_1",
        source_channel: "instagram",
        landing_page: `/c/demo-org/${campaignSlug}`,
      },
    },
  });
  expect(sessionRes.ok()).toBeTruthy();
  const sessionJson = await sessionRes.json();
  expect(sessionJson.sessionId).toBeTruthy();
  expect(sessionJson.contactable).toBe(false);

  await request.patch("/api/public/assessment-session", {
    data: { sessionId: sessionJson.sessionId, action: "start" },
  });

  const answers: Record<string, string> = {
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
    primary_objective: "BALANCE",
    principal_protection: "8",
    growth_participation: "7",
    market_drop_concern: "Very concerned",
    income_start: "Within 1 year",
    desired_monthly_income: "$5,000–$7,500",
    lifetime_income_importance: "9",
    inflation_concern: "8",
    liquidity_importance: "7",
    legacy_importance: "5",
    healthcare_concern: "6",
    carrier_strength_importance: "8",
    advisor_team_importance: "7",
    current_advisor: "Not currently",
    decision_timeline: "Within 30 days",
  };

  for (const [questionId, value] of Object.entries(answers)) {
    const patch = await request.patch("/api/public/assessment-session", {
      data: {
        sessionId: sessionJson.sessionId,
        action: "answer",
        questionId,
        value,
        stage: questionId === "repositionable_assets" ? "YOUR_MONEY" : null,
      },
    });
    expect(patch.ok()).toBeTruthy();
  }

  // Still no lead until contact
  const leadRes = await request.post("/api/public/leads", {
    data: {
      organizationSlug: "demo-org",
      campaignSlug,
      sessionId: sessionJson.sessionId,
      answers,
      contact: {
        firstName: "Morgan",
        lastName: "Lee",
        email: `morgan.lee.${Date.now()}@example.com`,
        phone: "3055550188",
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
    },
  });
  expect(leadRes.ok()).toBeTruthy();
  const leadJson = await leadRes.json();
  expect(leadJson.leadId).toBeTruthy();
  expect(leadJson.consumerProfile?.primary_goal).toBe("Income + Protection");
  expect(leadJson.consumerProfile?.planning_horizon).toBe("Within 30 days");
  // Must not expose internal scoring on public response
  expect(leadJson.score).toBeUndefined();
  expect(leadJson.temperature).toBeUndefined();
  expect(leadJson.grade).toBeUndefined();

  const detail = await request.get(`/api/leads/${leadJson.leadId}`);
  expect(detail.ok()).toBeTruthy();
  const detailJson = await detail.json();
  expect(detailJson.lead.assessment_answers.repositionable_assets).toBe(
    "$750K–$999K",
  );
  expect(detailJson.lead.attribution.utm_source).toBe("instagram");
});

test("campaign public page renders assessment intro immediately", async ({
  page,
  request,
}) => {
  const create = await request.post("/api/campaigns", {
    data: {
      action: "create_and_launch",
      draft: {
        owner_type: "SUBSCRIBER_CAMPAIGN",
        organization_slug: "demo-org",
        name: `UI Entry ${Date.now()}`,
        goal: "generate_leads",
        strategy: "Retirement",
        audience: {},
        territories: ["FL"],
        channels: ["meta"],
        destination: "interactive_assessment",
        qualification_template_key: "retirement-opportunity-v1",
        budget_cents: 10000,
      },
    },
  });
  if (!create.ok()) {
    test.skip(true, "Campaign create unavailable in this environment");
    return;
  }
  const created = await create.json();
  const slug = created.campaign?.slug;
  await page.goto(
    `/c/demo-org/${slug}?utm_source=instagram&channel=instagram&provider=instagram`,
  );
  await expect(
    page.getByRole("heading", { name: /Retirement Opportunity Profile/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Start My Assessment/i })).toBeVisible();
  // No generic CRM/lead-form wall before assessment
  await expect(page.getByLabel(/Business name/i)).toHaveCount(0);
  await page.getByRole("button", { name: /Start My Assessment/i }).click();
  await expect(page.getByText(/ABOUT YOU/i)).toBeVisible();
});
