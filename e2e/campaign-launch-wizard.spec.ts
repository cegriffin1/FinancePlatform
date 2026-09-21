import { test, expect } from "@playwright/test";

test.describe("Admin campaign launch golden path", () => {
  test("wizard → review → simulation launch → campaign health", async ({
    page,
  }) => {
    await page.goto("/app/campaigns/new");
    await expect(
      page.getByRole("heading", { name: /create campaign/i }),
    ).toBeVisible();

    // Goal
    await expect(
      page.getByText(/what do you want this campaign to accomplish/i),
    ).toBeVisible();
    await page.getByRole("button", { name: /generate retirement opportunities/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Channels
    await expect(page.getByText(/where should this campaign run/i)).toBeVisible();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Audience
    await expect(page.getByText(/who should see this campaign/i)).toBeVisible();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Creative
    await expect(page.getByText(/what will prospects see/i)).toBeVisible();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Budget
    await expect(
      page.getByText(/how much would you like to invest/i),
    ).toBeVisible();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Experience + preview
    await expect(
      page.getByText(/what happens after someone clicks/i),
    ).toBeVisible();
    await page.getByRole("button", { name: /preview experience/i }).click();
    await expect(
      page.getByRole("dialog", { name: /preview prospect journey/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^close$/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Review
    await expect(
      page.getByText(/your campaign is ready for review/i),
    ).toBeVisible();
    await expect(page.getByText(/creative ready/i)).toBeVisible();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Launch
    await expect(page.getByText(/ready to launch/i)).toBeVisible();
    await expect(page.getByText(/simulation mode/i)).toBeVisible();
    await page.getByRole("button", { name: /launch campaign/i }).click();

    await expect(page.getByText(/campaign launched/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/what happens next/i)).toBeVisible();

    await page.getByRole("link", { name: /view campaign health/i }).click();
    await expect(page.getByText(/campaign health/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/assessment starts/i)).toBeVisible();
  });
});
