import { test, expect } from "./fixtures";
import { readFileSync } from "fs";
import { join } from "path";
import { getOrgId, trpcMutation, trpcQuery } from "./helpers/trpc";

async function uploadSamplePdf(page: any, documentId: number, orgId: string): Promise<void> {
  const pdfBuffer = readFileSync(join(process.cwd(), "e2e/fixtures/sample.pdf"));
  await trpcMutation(page, "documents.uploadPdf", {
    documentId,
    fileName: "sample.pdf",
    fileBase64: pdfBuffer.toString("base64"),
    mimeType: "application/pdf",
  }, orgId);
}

async function createApprovalDocument(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any
): Promise<{ token: string; documentId: number }> {
  const title = `E2E Approval Test ${Date.now()}`;
  const orgId = await getOrgId(page);

  const createData = await trpcMutation<{ id: number }>(
    page,
    "documents.create",
    { title },
    orgId,
  );
  const documentId = createData.id;
  if (!documentId) throw new Error(`No documentId: ${JSON.stringify(createData)}`);

  // Upload PDF (required for sendForSignature)
  await uploadSamplePdf(page, documentId, orgId);

  // Save fields
  await trpcMutation(
    page,
    "documents.saveFields",
    {
      documentId,
      fields: [
        {
          id: "f1",
          page: 0,
          x: 20,
          y: 50,
          width: 30,
          height: 10,
          signerIndex: 0,
          type: "name",
        },
      ],
    },
    orgId,
  );

  // Send with internal approval
  await trpcMutation(
    page,
    "documents.sendForSignature",
    {
      documentId,
      signers: [
        {
          email: "signer@e2e-test.local",
          name: "E2E Signer",
          order: 1,
          role: "signer",
        },
      ],
      sequentialRouting: false,
      internalApproval: {
        approvers: [
          {
            email: "owner@e2e-test.local",
            name: "E2E Owner",
            order: 1,
          },
        ],
      },
    },
    orgId,
  );

  // Get approval token
  const docData = await trpcQuery<{
    internalApprovals?: Array<{ accessToken: string }>;
  }>(page, "documents.getById", { id: documentId }, orgId);

  const approvals = docData.internalApprovals ?? [];
  if (approvals.length === 0) {
    throw new Error(`No approval found for document ${documentId}`);
  }

  const token = approvals[0].accessToken;
  if (!token) throw new Error(`No token for document ${documentId}`);

  return { token, documentId };
}

test.describe("Internal Approval Flow", () => {
  test.setTimeout(60_000);

  test("IA-01: approve a document", async ({ ownerPage }) => {
    const { token } = await createApprovalDocument(ownerPage);

    // Navigate to approval page (no auth required for approval page)
    await ownerPage.goto(`/approve/${token}`);
    await ownerPage.waitForLoadState("networkidle");

    // Should show the approval page
    await expect(
      ownerPage
        .locator("text=社内承認")
        .or(ownerPage.locator("text=Internal Approval"))
        .first()
    ).toBeVisible({ timeout: 10_000 });

    // Click approve button
    const approveBtn = ownerPage
      .locator("button")
      .filter({ hasText: /承認する|Approve/ })
      .first();
    await expect(approveBtn).toBeVisible({ timeout: 10_000 });
    await approveBtn.click();
    await ownerPage.waitForTimeout(2000);

    // Should show success status
    await expect(
      ownerPage
        .locator("text=/承認済み|承認しました|Approved|approvalPage\\.approved/")
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("IA-02: reject a document", async ({ ownerPage }) => {
    const { token } = await createApprovalDocument(ownerPage);

    await ownerPage.goto(`/approve/${token}`);
    await ownerPage.waitForLoadState("networkidle");

    // Should show the approval page
    await expect(
      ownerPage
        .locator("text=社内承認")
        .or(ownerPage.locator("text=Internal Approval"))
        .first()
    ).toBeVisible({ timeout: 10_000 });

    // Fill in rejection comment if textarea is visible
    const commentArea = ownerPage.locator("textarea").first();
    if (await commentArea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await commentArea.fill("E2E テスト拒否理由");
    }

    // Click reject button
    const rejectBtn = ownerPage
      .locator("button")
      .filter({ hasText: /却下|Reject/ })
      .first();
    await expect(rejectBtn).toBeVisible({ timeout: 10_000 });
    await rejectBtn.click();
    await ownerPage.waitForTimeout(2000);

    // Should show rejection success
    await expect(
      ownerPage
        .locator("text=/却下しました|却下|Rejected|approvalPage\\.rejected/")
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
