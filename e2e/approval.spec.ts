/**
 * E2E Tests: Internal Approval Flow
 *
 * Tests the guest-facing approval page at /approve/{accessToken}.
 * Approvers access via token links from email (no login required).
 *
 * Seed data required (added to e2e/seed.ts):
 *   - e2e-approval-pending-token  (E2E Pending Approval Document, approver: member@e2e-test.local)
 *   - e2e-approval-rejected-token (E2E Rejected Approval Document, status: rejected)
 *
 * The ApprovePage.tsx at /approve/:token calls:
 *   - trpc.internalApproval.getByToken (query)
 *   - trpc.internalApproval.decide (mutation: approved | rejected)
 *
 * Note: Rejection requires a non-empty comment (zod .refine validation).
 */
import { test, expect } from "./fixtures";
import { E2E_BASE_URL } from "./base-url";

const BASE = E2E_BASE_URL;

// ── Helper: call tRPC via fetch (same pattern as inbox-import.spec.ts) ──
async function callTrpc(page: import("@playwright/test").Page, procedure: string, input: unknown) {
  return page.evaluate(
    async ({ procedure, input, base }) => {
      const res = await fetch(`${base}/api/trpc/${procedure}?batch=1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ "0": { json: input } }),
        credentials: "include",
      });
      const json = await res.json();
      return { status: res.status, data: json };
    },
    { procedure, input, base: BASE },
  );
}

test.describe("Internal Approval Flow", () => {
  test("AP-01: approval page loads for pending approval token", async ({ guestPage }) => {
    await guestPage.goto(`${BASE}/approve/e2e-approval-pending-token`);
    await guestPage.waitForLoadState("networkidle");
    await guestPage.waitForTimeout(500);

    // The ApprovePage should show the document title and approval chain
    await expect(
      guestPage.locator("text=E2E Pending Approval Document").first()
    ).toBeVisible({ timeout: 10_000 });

    // The approval flow section should be visible
    await expect(
      guestPage.locator("text=承認フロー").first()
    ).toBeVisible({ timeout: 5_000 });

    // Approve and reject buttons should be visible (status is pending)
    await expect(
      guestPage.locator("button").filter({ hasText: "承認する" }).first()
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      guestPage.locator("button").filter({ hasText: "却下する" }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("AP-02: approves document via approval page UI", async ({ guestPage }) => {
    // Uses a separate token (e2e-approval-action-token) to avoid conflict with AP-01
    await guestPage.goto(`${BASE}/approve/e2e-approval-action-token`);
    await guestPage.waitForLoadState("networkidle");
    await guestPage.waitForTimeout(500);

    // The approval page should load with the document
    await expect(
      guestPage.locator("text=E2E Approve Action Document").first()
    ).toBeVisible({ timeout: 10_000 });

    // Click the approve button
    const approveButton = guestPage
      .locator("button")
      .filter({ hasText: "承認する" })
      .first();
    await expect(approveButton).toBeVisible({ timeout: 10_000 });
    await approveButton.click();
    await guestPage.waitForTimeout(1500);

    // After approval, should show approved confirmation
    await expect(
      guestPage.locator("text=/承認済み|承認しました|Approved|approvalPage\\.approved/").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("AP-03: rejects document via tRPC API", async ({ guestPage }) => {
    // Use API directly for rejection because the seed sets the token to "rejected" status,
    // which means the UI shows "already decided" state.
    // We test rejection logic via a fresh API call to verify the endpoint accepts it.
    // Note: Idempotency guard: if status === decision, returns success without error.
    await guestPage.goto(`${BASE}/approve/e2e-approval-rejected-token`);
    await guestPage.waitForLoadState("networkidle");
    await guestPage.waitForTimeout(500);

    const result = await callTrpc(guestPage, "internalApproval.decide", {
      token: "e2e-approval-rejected-token",
      decision: "rejected",
      comment: "E2E test rejection reason",
    });

    expect(result.status).toBe(200);
    const responseData = result.data as any;
    const trpcResult = Array.isArray(responseData) ? responseData[0] : responseData;

    // Should succeed (idempotent: same decision returns success)
    // or fail with "already processed" error (if status changed due to AP-02)
    if (trpcResult?.error) {
      expect(trpcResult.error.json?.message ?? trpcResult.error.message ?? "").toMatch(
        /処理済み|既に|already/i
      );
    } else {
      expect(trpcResult?.result?.data?.json?.decision).toBe("rejected");
    }
  });

  test("AP-04: rejected approval page shows already-decided state", async ({ guestPage }) => {
    await guestPage.goto(`${BASE}/approve/e2e-approval-rejected-token`);
    await guestPage.waitForLoadState("networkidle");
    await guestPage.waitForTimeout(500);

    // The document should be visible
    await expect(
      guestPage.locator("text=E2E Rejected Approval Document").first()
    ).toBeVisible({ timeout: 10_000 });

    // The already-decided state: approve/reject buttons should NOT appear
    // (status is "rejected", not "pending")
    await expect(
      guestPage.locator("button").filter({ hasText: "承認する" })
    ).toBeHidden({ timeout: 5_000 });
  });
});
