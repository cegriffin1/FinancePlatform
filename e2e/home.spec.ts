import { test, expect } from "@playwright/test";

test("ALTUS hub renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "growing a stronger business",
  );
});

test("campaigns workspace renders", async ({ page }) => {
  await page.goto("/app/campaigns");
  await expect(page.getByRole("heading", { name: "Campaigns" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create campaign" })).toBeVisible();
});

test("campaign builder wizard renders", async ({ page }) => {
  await page.goto("/app/campaigns/new");
  await expect(page.getByText("CAMPAIGN BUILDER")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});
