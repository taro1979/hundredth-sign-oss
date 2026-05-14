import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

const RAW_I18N_KEY_PATTERN =
  /\b(?:documents|inbox|common|templates|nav|landing|dashboard|pricing|organization|contacts|signing)\.[A-Za-z0-9_.-]+\b/;

async function expectNoRawTranslationKeyLeak(page: Page): Promise<void> {
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(RAW_I18N_KEY_PATTERN);

  const placeholders = await page
    .locator("input[placeholder], textarea[placeholder]")
    .evaluateAll((elements) =>
      elements
        .map((element) => element.getAttribute("placeholder") ?? "")
        .filter((placeholder) => placeholder.length > 0),
    );

  for (const placeholder of placeholders) {
    expect(placeholder).not.toMatch(
      /^(documents|inbox|common|templates|nav|landing|dashboard|pricing|organization|contacts|signing)\./,
    );
  }
}

test.describe("i18n Language Switching", () => {
  test("I18-01: Japanese locale when localStorage is set to ja", async ({ ownerPage }) => {
    // Set localStorage before navigating to trigger Japanese UI
    await ownerPage.goto("/dashboard");
    await ownerPage.evaluate(() => {
      localStorage.setItem("hundredth-sign-jp-lang", "ja");
    });
    await ownerPage.reload();
    await ownerPage.waitForLoadState("networkidle");
    // Should see Japanese nav labels
    await expect(ownerPage.locator("text=ダッシュボード").first()).toBeVisible({ timeout: 10_000 });
  });

  test("I18-02: switch to English", async ({ ownerPage }) => {
    // First set to Japanese
    await ownerPage.goto("/dashboard");
    await ownerPage.evaluate(() => {
      localStorage.setItem("hundredth-sign-jp-lang", "ja");
    });
    await ownerPage.reload();
    await ownerPage.waitForLoadState("networkidle");
    await expect(ownerPage.locator("text=ダッシュボード").first()).toBeVisible({ timeout: 10_000 });

    // Now find and use the language selector
    const langSelector = ownerPage.locator("select, [role='combobox'], button").filter({ hasText: /日本語|Language|言語|English/ }).first();
    await langSelector.click();
    await ownerPage.waitForTimeout(300);
    // Select English
    const englishOption = ownerPage.locator("[role='option'], option, [role='menuitem']").filter({ hasText: "English" }).first();
    await englishOption.click();
    await ownerPage.waitForTimeout(1000);
    // Should see English nav label
    await expect(ownerPage.locator("text=Dashboard").first()).toBeVisible({ timeout: 10_000 });
  });

  test("I18-03: language persists after page reload", async ({ ownerPage }) => {
    // Set English via localStorage
    await ownerPage.goto("/dashboard");
    await ownerPage.evaluate(() => {
      localStorage.setItem("hundredth-sign-jp-lang", "en");
    });
    await ownerPage.reload();
    await ownerPage.waitForLoadState("networkidle");
    await expect(ownerPage.locator("text=Dashboard").first()).toBeVisible({ timeout: 10_000 });

    // Reload and verify it stays in English
    await ownerPage.reload();
    await ownerPage.waitForLoadState("networkidle");
    await expect(ownerPage.locator("text=Dashboard").first()).toBeVisible({ timeout: 10_000 });
    // Verify Japanese is NOT showing in the sidebar nav
    const jaLabel = ownerPage
      .locator("nav")
      .getByText("ダッシュボード")
      .or(ownerPage.locator("[data-sidebar]").getByText("ダッシュボード"));
    await expect(jaLabel).toBeHidden({ timeout: 3_000 });
  });

  test("I18-04: does not render raw translation keys on main pages", async ({
    ownerPage,
    guestPage,
  }) => {
    test.setTimeout(90_000);

    await guestPage.goto("/");
    await guestPage.waitForLoadState("networkidle");
    await expectNoRawTranslationKeyLeak(guestPage);

    const dashboardPaths = [
      "/dashboard",
      "/dashboard/documents",
      "/dashboard/inbox",
      "/dashboard/templates",
      "/dashboard/organization",
    ];

    for (const path of dashboardPaths) {
      await ownerPage.goto(path);
      await ownerPage.waitForLoadState("networkidle");
      await ownerPage.waitForTimeout(300);
      await expectNoRawTranslationKeyLeak(ownerPage);
    }
  });
});
