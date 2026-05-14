import { test, expect } from "./fixtures";

test.describe("OSS manual and contact navigation", () => {
  test("SP-01: landing footer exposes manual and customization contact links", async ({
    guestPage,
  }) => {
    await guestPage.goto("/", { waitUntil: "domcontentloaded" });
    await guestPage.waitForLoadState("networkidle");

    const footer = guestPage.getByRole("contentinfo");
    await expect(footer.locator('a[href="/manual"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/contact"]').first()).toBeVisible();
    await expect(footer.locator('a[href*="helpticket"]').first()).toHaveCount(
      0
    );
  });

  test("SP-02: dashboard sidebar opens the internal manual page", async ({
    ownerPage,
  }) => {
    await ownerPage.goto("/dashboard");
    await ownerPage.waitForLoadState("networkidle");

    const manualButton = ownerPage
      .getByRole("button", {
        name: /Manual|マニュアル|คู่มือ|手册/,
      })
      .first();
    await expect(manualButton).toBeVisible();
    await manualButton.click();
    await ownerPage.waitForURL("**/manual", { timeout: 5_000 });
    await expect(ownerPage).toHaveURL(/\/manual$/);
  });

  test("SP-03: mobile navigation drawer keeps the manual link reachable", async ({
    ownerPage,
  }) => {
    await ownerPage.setViewportSize({ width: 390, height: 844 });
    await ownerPage.goto("/dashboard");
    await ownerPage.waitForLoadState("networkidle");

    await ownerPage.getByRole("button", { name: /toggle sidebar/i }).click();

    const mobileManualButton = ownerPage
      .locator("[data-mobile='true']")
      .getByRole("button", { name: /Manual|マニュアル|คู่มือ|手册/ })
      .first();
    await expect(mobileManualButton).toBeVisible();
    await mobileManualButton.click();
    await ownerPage.waitForURL("**/manual", { timeout: 5_000 });
    await expect(ownerPage).toHaveURL(/\/manual$/);
  });
});
