import { test, expect } from "./fixtures";
import { getOrgId, trpcMutation } from "./helpers/trpc";

test.describe("Documents", () => {
  test("DO-01: document list shows seeded documents", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/documents");
    await ownerPage.waitForLoadState("networkidle");
    // Should see seeded documents
    await expect(ownerPage.locator("text=E2E Draft Document").first()).toBeVisible({ timeout: 10_000 });
    await expect(ownerPage.locator("text=E2E Sent Document").first()).toBeVisible();
    await expect(ownerPage.locator("text=E2E Completed Document").first()).toBeVisible();
  });

  test("DO-02: status filter shows only draft documents", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/documents");
    await ownerPage.waitForLoadState("networkidle");
    // Click on "Drafts" filter tab/button
    const draftFilter = ownerPage.locator("button, [role='tab']").filter({ hasText: /Draft|下書き/i }).first();
    await draftFilter.click();
    await ownerPage.waitForTimeout(500);
    // Draft doc should be visible
    await expect(ownerPage.locator("text=E2E Draft Document").first()).toBeVisible();
    // Sent/Completed should be hidden or filtered out
    await expect(ownerPage.locator("text=E2E Sent Document")).toBeHidden({ timeout: 3_000 });
  });

  test("DO-03: text search filters by title", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/documents");
    await ownerPage.waitForLoadState("networkidle");
    const searchInput = ownerPage.locator("input[placeholder*='search' i], input[placeholder*='検索'], input[type='search']").first();
    await searchInput.fill("Completed");
    await ownerPage.waitForTimeout(500);
    // Only completed doc should remain
    await expect(ownerPage.locator("text=E2E Completed Document").first()).toBeVisible();
    await expect(ownerPage.locator("text=E2E Draft Document")).toBeHidden({ timeout: 3_000 });
  });

  test("DO-04: delete a draft document", async ({ ownerPage }) => {
    // Create a dedicated draft document to delete (preserves seeded "E2E Draft Document" for other tests)
    const orgId = await getOrgId(ownerPage);
    const title = `E2E DO-04 Delete Test ${Date.now()}`;
    await trpcMutation(ownerPage, "documents.create", { title, description: "" }, orgId);

    await ownerPage.goto("/dashboard/documents");
    await ownerPage.waitForLoadState("networkidle");
    await ownerPage.waitForTimeout(500);

    // Search for the specific document to delete
    const searchInput = ownerPage.locator("input[placeholder*='search' i], input[placeholder*='検索']").first();
    if (await searchInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await searchInput.fill(title);
      await ownerPage.waitForTimeout(500);
    }

    // Confirm the draft document is visible
    await expect(ownerPage.getByText(title).first()).toBeVisible({ timeout: 10_000 });
    // Documents use CSS Grid divs (not <tr>) with cursor-pointer class
    const draftRow = ownerPage
      .locator(".cursor-pointer")
      .filter({ hasText: title })
      .first();
    // Open the actions dropdown — MoreVertical button is the last button in the row
    const actionsBtn = draftRow.locator("button").last();
    await actionsBtn.scrollIntoViewIfNeeded();
    await actionsBtn.click();
    await ownerPage.waitForTimeout(300);
    // Register window.confirm handler BEFORE clicking "削除" (which triggers confirm())
    ownerPage.once("dialog", (d) => d.accept());
    await ownerPage.locator("[role='menuitem']").filter({ hasText: /削除|Delete/ }).first().click();
    await ownerPage.waitForTimeout(1000);
    // Verify it's gone
    await expect(ownerPage.locator(`text=${title}`)).toBeHidden({ timeout: 10_000 });
  });

  test("DO-05: voids a sent document", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/documents");
    await ownerPage.waitForLoadState("networkidle");
    await ownerPage.waitForTimeout(500);

    // Navigate to the Sent document detail page via row click
    const sentRow = ownerPage
      .locator(".cursor-pointer")
      .filter({ hasText: "E2E Sent Document" })
      .first();
    await expect(sentRow).toBeVisible({ timeout: 10_000 });
    await sentRow.click();
    await ownerPage.waitForLoadState("networkidle");
    await ownerPage.waitForTimeout(500);

    // The document detail page should show a "無効化" button for sent documents
    const voidButton = ownerPage
      .locator("button")
      .filter({ hasText: /無効化/ })
      .first();
    await expect(voidButton).toBeVisible({ timeout: 10_000 });
    await voidButton.click();
    await ownerPage.waitForTimeout(300);

    // A confirmation dialog appears — click the destructive confirm button
    const confirmButton = ownerPage
      .locator("[role='dialog'] button")
      .filter({ hasText: /文書を無効化|Void Document|無効化/ })
      .first();
    await expect(confirmButton).toBeVisible({ timeout: 5_000 });
    await confirmButton.click();
    await ownerPage.waitForTimeout(1000);

    // After voiding, the document status badge should show "無効"
    await expect(
      ownerPage.locator("text=無効").or(ownerPage.locator("text=Voided")).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("DO-06: does not render raw translation keys on Documents UI", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/documents");
    await ownerPage.waitForLoadState("networkidle");
    await ownerPage.waitForTimeout(500);

    const bodyText = await ownerPage.locator("body").innerText();
    expect(bodyText).not.toMatch(/\b(?:documents|inbox|common|templates|nav)\.[A-Za-z0-9_.-]+\b/);

    const searchInput = ownerPage.locator("main input[placeholder]").first();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    const placeholder = (await searchInput.getAttribute("placeholder")) ?? "";
    expect(placeholder).not.toMatch(/^(documents|inbox|common|templates|nav)\./);

    const sentRow = ownerPage
      .locator(".cursor-pointer")
      .filter({ hasText: "E2E Sent Document" })
      .first();
    await expect(sentRow).toBeVisible({ timeout: 10_000 });

    const actionsBtn = sentRow.locator("button").last();
    await actionsBtn.click();
    await ownerPage.waitForTimeout(300);

    const menuText = await ownerPage.locator("[role='menu']").last().innerText();
    expect(menuText).not.toMatch(/\b(?:documents|inbox|common|templates|nav)\.[A-Za-z0-9_.-]+\b/);
  });
});
