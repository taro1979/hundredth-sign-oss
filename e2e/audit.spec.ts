import { test, expect } from "./fixtures";

test.describe("Audit Logs", () => {
  test("AD-01: audit log section displays log entries", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/organization");
    await ownerPage.waitForLoadState("networkidle");
    await ownerPage.waitForTimeout(1000);
    // The audit section is inside a "セキュリティ & コンプライアンス" Collapsible — expand it first
    const securityTrigger = ownerPage
      .locator("button")
      .filter({ hasText: /セキュリティ.*コンプライアンス/ })
      .first();
    await securityTrigger.scrollIntoViewIfNeeded();
    await securityTrigger.click();
    await ownerPage.waitForTimeout(1000);
    // Confirm "操作履歴" section is now visible
    await expect(ownerPage.getByText("操作履歴").first()).toBeVisible({
      timeout: 5_000,
    });
    // Prior tests can append newer event types, so assert the log table contains
    // at least one rendered row instead of depending on a specific label.
    await expect(
      ownerPage.locator("table tbody tr").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("AD-02: hash chain verification button works", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/organization");
    await ownerPage.waitForLoadState("networkidle");
    await ownerPage.waitForTimeout(1000);
    // Expand the Security & Compliance section first
    const securityTrigger = ownerPage
      .locator("button")
      .filter({ hasText: /セキュリティ.*コンプライアンス/ })
      .first();
    await securityTrigger.scrollIntoViewIfNeeded();
    await securityTrigger.click();
    await ownerPage.waitForTimeout(500);
    // Click verify integrity button (text: "整合性検証")
    const verifyBtn = ownerPage
      .locator("button")
      .filter({ hasText: /整合性.*検証|Verify|Integrity/ })
      .first();
    await verifyBtn.scrollIntoViewIfNeeded();
    await verifyBtn.click();
    // Should show toast: "検証完了: X件のレコードが正常です"
    await expect(
      ownerPage.locator("text=/検証完了|正常です|verified|intact|整合/i").first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
