/**
 * E2E helper for signing flow tests.
 * Creates documents, uploads PDF, saves fields, and sends for signature.
 */
import { readFileSync } from "fs";
import { join } from "path";
import type { Page } from "@playwright/test";
import { getOrgId, trpcMutation, trpcQuery } from "./trpc";

/** Upload the sample PDF fixture to a document. Returns true if successful. */
async function uploadSamplePdf(
  page: Page,
  documentId: number,
  orgId: string,
): Promise<boolean> {
  try {
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
    return true;
  } catch (err) {
    console.warn(`[E2E] PDF upload failed (forge API may not be available): ${err}`);
    return false;
  }
}

/**
 * Create a document, upload PDF, save fields, and send for signature.
 * Returns the signature access token for the first signer.
 */
export async function seedSentDocument(
  page: Page,
  options: {
    title?: string;
    signerEmail?: string;
    signerName?: string;
    accessCode?: string | null;
  } = {},
): Promise<{ token: string; documentId: number }> {
  const title = options.title ?? `E2E Signing Test ${Date.now()}`;
  const signerEmail = options.signerEmail ?? "signer@e2e-test.local";
  const signerName = options.signerName ?? "E2E Signer";

  const orgId = await getOrgId(page);

  // Create document
  const createData = await trpcMutation<{ id: number }>(
    page,
    "documents.create",
    { title, description: "E2E test" },
    orgId,
  );
  const documentId = createData.id;
  if (!documentId) {
    throw new Error(`No document ID in response: ${JSON.stringify(createData)}`);
  }

  // Upload PDF (required before sendForSignature)
  const uploaded = await uploadSamplePdf(page, documentId, orgId);
  if (!uploaded) {
    throw new Error(
      `Cannot send document ${documentId}: PDF upload failed (BUILT_IN_FORGE_API_URL not configured in .env.e2e?)`,
    );
  }

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

  // Send for signature
  const signerPayload: Record<string, unknown> = {
    email: signerEmail,
    name: signerName,
    order: 1,
    role: "signer",
  };
  if (options.accessCode) signerPayload.accessCode = options.accessCode;

  await trpcMutation(
    page,
    "documents.sendForSignature",
    {
      documentId,
      signers: [signerPayload],
      sequentialRouting: false,
    },
    orgId,
  );

  // Get the signature token from the document detail
  const docData = await trpcQuery<{
    signatureRequests: Array<{ accessToken: string }>;
  }>(page, "documents.getById", { id: documentId }, orgId);

  const signatureRequests = docData.signatureRequests ?? [];
  if (signatureRequests.length === 0) {
    throw new Error(`No signature requests found for document ${documentId}`);
  }

  const token = signatureRequests[0].accessToken;
  if (!token) {
    throw new Error(`No access token found in signature requests`);
  }

  return { token, documentId };
}

/**
 * Create a document with accessCode and send for signature.
 */
export async function seedSentDocumentWithAccessCode(
  page: Page,
  accessCode: string,
): Promise<{ token: string; documentId: number }> {
  return seedSentDocument(page, { accessCode });
}
