/**
 * Playwright custom fixtures — provides pre-authenticated pages.
 *
 * Usage in tests:
 *   import { test, expect } from "./fixtures";
 *   test("my test", async ({ ownerPage }) => { ... });
 */
import { test as base, type Browser, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { createSessionCookie, TEST_USERS } from "./auth-helper";
import { E2E_BASE_URL } from "./base-url";

type E2EFixtures = {
  ownerPage: Page;
  memberPage: Page;
  signerPage: Page;
  guestPage: Page;
};

function getSeedOrganizationId(user: (typeof TEST_USERS)[keyof typeof TEST_USERS]): number {
  return user.openId === TEST_USERS.signer.openId ? 2 : 1;
}

async function createAuthenticatedPage(
  browser: Browser,
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS],
  origin: string,
) {
  const context = await browser.newContext({ baseURL: origin });
  const cookie = await createSessionCookie(user, origin);
  await context.addCookies([cookie]);

  const page = await context.newPage();
  const seedOrgId = getSeedOrganizationId(user);
  await page.addInitScript((orgId: number) => {
    localStorage.setItem("hundredth-sign-org-id", String(orgId));
    // Default to Japanese so tests use consistent UI text, but respect
    // language changes made within the test (e.g. i18n switching tests).
    if (!localStorage.getItem("hundredth-sign-jp-lang")) {
      localStorage.setItem("hundredth-sign-jp-lang", "ja");
    }
  }, seedOrgId);

  // Some runs land on the public home page on the first navigation even though
  // the cookie has been added. Probe once and re-apply the session cookie if needed.
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname === "/") {
    await context.clearCookies();
    await context.addCookies([cookie]);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  }

  return { context, page };
}

function writeCoverage(coverage: object[], label: string): void {
  const coverageDir = path.join(process.cwd(), "coverage", "e2e-client");
  fs.mkdirSync(coverageDir, { recursive: true });
  const uuid = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(path.join(coverageDir, `${uuid}.json`), JSON.stringify(coverage));
}

export const test = base.extend<E2EFixtures>({
  ownerPage: async ({ browser, baseURL }, use) => {
    const origin = baseURL ?? E2E_BASE_URL;
    const { context, page } = await createAuthenticatedPage(browser, TEST_USERS.owner, origin);
    await page.coverage.startJSCoverage();
    await use(page);
    const coverage = await page.coverage.stopJSCoverage();
    writeCoverage(coverage, "owner");
    await context.close();
  },
  memberPage: async ({ browser, baseURL }, use) => {
    const origin = baseURL ?? E2E_BASE_URL;
    const { context, page } = await createAuthenticatedPage(browser, TEST_USERS.member, origin);
    await page.coverage.startJSCoverage();
    await use(page);
    const coverage = await page.coverage.stopJSCoverage();
    writeCoverage(coverage, "member");
    await context.close();
  },
  signerPage: async ({ browser, baseURL }, use) => {
    const origin = baseURL ?? E2E_BASE_URL;
    const { context, page } = await createAuthenticatedPage(browser, TEST_USERS.signer, origin);
    await page.coverage.startJSCoverage();
    await use(page);
    const coverage = await page.coverage.stopJSCoverage();
    writeCoverage(coverage, "signer");
    await context.close();
  },
  guestPage: async ({ browser, baseURL }, use) => {
    const origin = baseURL ?? E2E_BASE_URL;
    const context = await browser.newContext({ baseURL: origin });
    // No cookie: unauthenticated browser context
    const page = await context.newPage();
    // Default to Japanese locale; respect changes made within the test.
    await page.addInitScript(() => {
      if (!localStorage.getItem("hundredth-sign-jp-lang")) {
        localStorage.setItem("hundredth-sign-jp-lang", "ja");
      }
    });
    await page.coverage.startJSCoverage();
    await use(page);
    const coverage = await page.coverage.stopJSCoverage();
    writeCoverage(coverage, "guest");
    await context.close();
  },
});

export { expect } from "@playwright/test";
