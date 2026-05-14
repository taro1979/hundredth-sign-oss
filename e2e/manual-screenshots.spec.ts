import path from "node:path";
import fs from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const shouldUpdateScreenshots = process.env.UPDATE_MANUAL_SCREENSHOTS === "1";
const screenshotDir = path.join(
  process.cwd(),
  "client",
  "public",
  "manual",
  "screenshots"
);

async function capture(
  page: Page,
  name: string,
  url: string,
  prepare?: () => Promise<void>
) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await prepare?.();
  await expect(page.locator("body")).toBeVisible();
  await page.screenshot({
    path: path.join(screenshotDir, `${name}.png`),
    fullPage: false,
  });
}

test.describe("Manual screenshots", () => {
  test.skip(
    !shouldUpdateScreenshots,
    "Set UPDATE_MANUAL_SCREENSHOTS=1 to refresh static manual screenshots."
  );

  test("MS-01: captures public setup and login screens", async ({
    guestPage,
  }) => {
    fs.mkdirSync(screenshotDir, { recursive: true });

    await capture(guestPage, "setup", "/setup");
    await capture(guestPage, "login", "/login");
  });

  test("MS-02: captures staff dashboard screens", async ({ ownerPage }) => {
    fs.mkdirSync(screenshotDir, { recursive: true });

    await capture(ownerPage, "dashboard", "/dashboard");
    await capture(ownerPage, "documents", "/dashboard/documents");
    await capture(ownerPage, "document-new", "/dashboard/documents/new");
    await capture(ownerPage, "templates", "/dashboard/templates");
    await capture(ownerPage, "contacts", "/dashboard/contacts");
    await capture(ownerPage, "settings", "/dashboard/settings");
    await capture(ownerPage, "inbox", "/dashboard/inbox");
    await capture(
      ownerPage,
      "audit-log",
      "/dashboard/organization",
      async () => {
        const auditTab = ownerPage.locator('[role="tab"]').nth(3);
        if (await auditTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await auditTab.click();
          await ownerPage.waitForTimeout(500);
        }
      }
    );
  });

  test("MS-03: captures recipient signing screen", async ({ guestPage }) => {
    fs.mkdirSync(screenshotDir, { recursive: true });

    await capture(guestPage, "signing", "/sign/e2e-sign-token?lng=ja");
  });
});
