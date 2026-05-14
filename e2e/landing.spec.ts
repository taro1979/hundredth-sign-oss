import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("LP-01: displays hero, features, and pricing sections", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("section#pricing")).toBeVisible();
    await expect(page.locator("section#faq")).toBeVisible();
  });

  test("LP-02: login button exists in header", async ({ page }) => {
    await page.goto("/");

    const authLink = page
      .getByRole("link", { name: /ログイン|Login|ダッシュボード|Dashboard/i })
      .first();
    await expect(authLink).toBeVisible();
  });
});
