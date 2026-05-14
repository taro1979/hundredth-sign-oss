/**
 * E2E helper for internal approval flow tests.
 */
import { readFileSync } from "fs";
import { join } from "path";
import type { Page } from "@playwright/test";
import { getOrgId, trpcMutation, trpcQuery } from "./trpc";

export interface ApprovalTestData {
  token: string;
  documentId: number;
}

/** Upload the sample PDF fixture to a document. */
async function uploadSamplePdf(
  page: Page,
  documentId: number,
  orgId: string,
): Promise<void> {
  const pdfPath = join(process.cwd(), "e2e/fixtures/sample.pdf");
  const pdfBuffer = readFileSync(pdfPath);
  const fileBase64 = pdfBuffer.toString("base64");

  await trpcMutation(
    page,
    "documents.uploadPdf",
    {
      documentId,
      fileName: "sample.pdf",
      fileBase64,
      mimeType: "application/pdf",
    },
    orgId,
  );
}

/**
 * Create a document with internal approval and send it.
 * Returns the approval token.
 */
export async function seedDocumentWithApproval(page: Page): Promise<ApprovalTestData> {
  const title = `E2E Approval Test ${Date.now()}`;
  const orgId = await getOrgId(page);

  // Create document
  const createData = await trpcMutation<{ id: number }>(
    page,
    "documents.create",
    { title, description: "E2E approval test" },
    orgId,
  );
  const documentId = createData.id;
  if (!documentId) {
    throw new Error(`No document ID: ${JSON.stringify(createData)}`);
  }

  // Upload PDF (required for sendForSignature)
  await uploadSamplePdf(page, documentId, orgId);

  // Save signature fields
  await trpcMutation(
    page,
    "documents.saveFields",
    {
      documentId,
      fields: [
        {
          id: "field-1",
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

  // Get approval token from document detail
  const docData = await trpcQuery<{
    internalApprovals?: Array<{ accessToken: string }>;
  }>(page, "documents.getById", { id: documentId }, orgId);

  const approvals = docData.internalApprovals ?? [];
  if (approvals.length === 0) {
    throw new Error(`No approvals found for document ${documentId}`);
  }

  const token = approvals[0].accessToken;
  if (!token) {
    throw new Error(`No approval token found in document ${documentId}`);
  }

  return { token, documentId };
}
