/**
 * E2E: PDF Quality Tests (FR-006)
 *
 * Verifies the PDF download flow for completed documents:
 *  - PDF-01: Download button visible on completed doc
 *  - PDF-02: Downloaded PDF size > 0
 *  - PDF-03: Downloaded PDF starts with %PDF header
 *  - PDF-04: No download button on draft doc
 *  - PDF-05: No download button on sent doc
 *
 * Prerequisites: E2E seed must have run (docCompleted has signedFileUrl set).
 * The signedFileUrl is intercepted via Playwright context routing.
 */
import fs from "fs";
import { test, expect } from "./fixtures";

// The URL stored as signedFileUrl in seed.ts for "E2E Completed Document"
const FIXTURE_PDF_URL_PATTERN = "**/e2e-fixtures.local/**";

// Minimal valid PDF buffer (starts with %PDF, size > 0)
const MINIMAL_PDF = Buffer.from("%PDF-1.4\n%%EOF\n");

/** Navigate to a document by title from the documents list. */
async function openDocumentByTitle(page: import("@playwright/test").Page, title: string) {
  await page.goto("/dashboard/documents");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  // Use search input to filter by title, ensuring the row is visible regardless of list size
  // Placeholder: "文書名で検索..." (ja) or "Search by document name..." (en)
  const searchInput = page
    .locator("input[placeholder*='文書'], input[placeholder*='search' i], input[placeholder*='検索']")
    .first();
  try {
    await searchInput.fill(title, { timeout: 3_000 });
    await page.waitForTimeout(700);
  } catch {
    // Search not available, proceed without filter
  }

  const row = page.locator(".cursor-pointer").filter({ hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();
  await page.waitForLoadState("networkidle");
}

/** Set up context-level route to intercept the fixture PDF URL. */
async function routeFixturePdf(page: import("@playwright/test").Page) {
  await page.context().route(FIXTURE_PDF_URL_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: { "Content-Disposition": "attachment; filename=signed.pdf" },
      body: MINIMAL_PDF,
    });
  });
}

test.describe("PDF Quality", () => {
  test("PDF-01: download button visible on completed doc", async ({ ownerPage }) => {
    await openDocumentByTitle(ownerPage, "E2E Completed Document");
    // The download button appears only when signedFileUrl is set and downloadSigned query succeeds
    const downloadBtn = ownerPage
      .locator("a")
      .filter({ hasText: /署名済みPDF(をダウンロード|ダウンロード)|Download Signed PDF/ });
    await expect(downloadBtn).toBeVisible({ timeout: 15_000 });
  });

  test("PDF-02: downloaded PDF size > 0", async ({ ownerPage }) => {
    await routeFixturePdf(ownerPage);
    await openDocumentByTitle(ownerPage, "E2E Completed Document");

    const downloadBtn = ownerPage
      .locator("a")
      .filter({ hasText: /署名済みPDF(をダウンロード|ダウンロード)|Download Signed PDF/ });
    await expect(downloadBtn).toBeVisible({ timeout: 15_000 });

    const [download] = await Promise.all([
      ownerPage.waitForEvent("download"),
      downloadBtn.click(),
    ]);

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const stat = fs.statSync(filePath!);
    expect(stat.size).toBeGreaterThan(0);
  });

  test("PDF-03: downloaded PDF starts with %PDF header", async ({ ownerPage }) => {
    await routeFixturePdf(ownerPage);
    await openDocumentByTitle(ownerPage, "E2E Completed Document");

    const downloadBtn = ownerPage
      .locator("a")
      .filter({ hasText: /署名済みPDF(をダウンロード|ダウンロード)|Download Signed PDF/ });
    await expect(downloadBtn).toBeVisible({ timeout: 15_000 });

    const [download] = await Promise.all([
      ownerPage.waitForEvent("download"),
      downloadBtn.click(),
    ]);

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const buf = fs.readFileSync(filePath!);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  test("PDF-04: draft doc has no download button", async ({ ownerPage }) => {
    await openDocumentByTitle(ownerPage, "E2E Draft Document");
    await ownerPage.waitForTimeout(3_000); // Wait for async queries to settle
    await expect(ownerPage.locator("text=署名済みPDFダウンロード, text=Download Signed PDF").first()).toBeHidden({ timeout: 5_000 });
  });

  test("PDF-05: sent doc has no download button", async ({ ownerPage }) => {
    await openDocumentByTitle(ownerPage, "E2E Sent Document");
    await ownerPage.waitForTimeout(3_000); // Wait for async queries to settle
    await expect(ownerPage.locator("text=署名済みPDFダウンロード, text=Download Signed PDF").first()).toBeHidden({ timeout: 5_000 });
  });
});
