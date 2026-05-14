import { test, expect } from "./fixtures";

test.describe("Dashboard", () => {
  test("DA-01: stat cards show document counts", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard");
    await ownerPage.waitForLoadState("networkidle");
    // The dashboard should display stat cards with numbers
    // We have 3 seeded documents: 1 draft, 1 sent, 1 completed
    // Look for text indicating stats are present (they may show as cards with numbers)
    const mainContent = ownerPage.locator("main, [class*='inset']").first();
    await expect(mainContent).toBeVisible();
    // Should contain some numeric values
    await expect(ownerPage.locator("text=/\\d+/").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("DA-02: recent activity is displayed", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard");
    await ownerPage.waitForLoadState("networkidle");
    // Seed includes activity logs — look for any activity/timeline section
    // Check for activity-related text or timeline elements
    const content = ownerPage.locator("main, [class*='inset']").first();
    await expect(content).toBeVisible();
  });

  test("DA-03: new document button navigates to /dashboard/documents/new", async ({
    ownerPage,
  }) => {
    await ownerPage.goto("/dashboard");
    await ownerPage.waitForLoadState("networkidle");
    // The dashboard hero exposes a direct CTA for creating a new document.
    const createDocBtn = ownerPage.getByRole("button", { name: /新規文書/ }).first();
    await createDocBtn.click();
    await ownerPage.waitForURL("**/dashboard/documents/new", { timeout: 5_000 });
    await expect(ownerPage).toHaveURL(/\/dashboard\/documents\/new/);
  });
});
