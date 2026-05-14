import { test, expect } from "./fixtures";
import { test as baseTest, expect as baseExpect } from "@playwright/test";

baseTest.describe("Authentication", () => {
  baseTest("AU-01: unauthenticated user is redirected from /dashboard to /", async ({ page }) => {
    // No cookie set — page should redirect to landing
    await page.goto("/dashboard");
    await page.waitForURL("/", { timeout: 10_000 });
    await baseExpect(page).toHaveURL("/");
  });
});

test.describe("Authenticated Sessions", () => {
  test("AU-02: owner can access dashboard and see username", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard");
    await ownerPage.waitForLoadState("networkidle");
    // Should see the owner name "E2E Owner" somewhere on page
    await expect(ownerPage.locator("text=E2E Owner").first()).toBeVisible({ timeout: 10_000 });
  });

  test("AU-03: member can access dashboard", async ({ memberPage }) => {
    await memberPage.goto("/dashboard");
    await memberPage.waitForLoadState("networkidle");
    // Should see the member name
    await expect(memberPage.locator("text=E2E Member").first()).toBeVisible({ timeout: 10_000 });
  });

  test("AU-04: logout redirects to / and clears cookie", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard");
    await ownerPage.waitForLoadState("networkidle");
    // Click on user avatar/dropdown (the button in the sidebar footer shows user name)
    const avatar = ownerPage.locator("button").filter({ hasText: /E2E Owner/ }).first();
    await avatar.click();
    // Click logout
    const logoutItem = ownerPage.getByRole("menuitem").filter({ hasText: /logout|ログアウト/i });
    await logoutItem.click();
    // Should redirect to /
    await ownerPage.waitForURL("/", { timeout: 10_000 });
    // Wait until the session cookie is actually cleared.
    await expect
      .poll(async () => {
        const cookies = await ownerPage.context().cookies();
        return cookies.some((c) => c.name === "app_session_id");
      }, { timeout: 10_000 })
      .toBe(false);
  });
});
