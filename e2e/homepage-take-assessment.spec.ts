import { test, expect } from "@playwright/test";

test("homepage Start Assessment stays on page and shows Q1 in section", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Start Assessment/i }).first().click();
  await expect(page.locator("#retirement-assessment")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Build Your Retirement Profile/i }).first(),
  ).toBeVisible();
  await page
    .locator("#retirement-assessment")
    .getByRole("button", { name: /Start Assessment/i })
    .click();
  await expect(page.getByText(/ABOUT YOU/i)).toBeVisible();
  // Still on homepage — no route change to /assessment/retirement
  await expect(page).not.toHaveURL(/\/assessment\/retirement/);
});
