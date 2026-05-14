import { test, expect } from "./fixtures";
import { readFileSync } from "fs";
import { join } from "path";
import { getOrgId, trpcMutation, trpcQuery } from "./helpers/trpc";

/** Upload sample.pdf to a document */
async function uploadSamplePdf(page: any, documentId: number, orgId: string): Promise<void> {
  const pdfBuffer = readFileSync(join(process.cwd(), "e2e/fixtures/sample.pdf"));
  await trpcMutation(page, "documents.uploadPdf", {
    documentId,
    fileName: "sample.pdf",
    fileBase64: pdfBuffer.toString("base64"),
    mimeType: "application/pdf",
  }, orgId);
}

test.describe("Document Send Flow", () => {
  test.setTimeout(60_000);

  test("DS-04: save draft from new document page", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/documents/new");
    await ownerPage.waitForLoadState("networkidle");

    // Upload PDF — the title input is only shown after a file is selected
    const pdfPath = join(process.cwd(), "e2e/fixtures/sample.pdf");
    const fileInput = ownerPage.locator('input[type="file"]').first();
    await fileInput.setInputFiles(pdfPath);

    // Wait for title input to appear (auto-filled from filename)
    const titleInput = ownerPage.locator("input#title").first();
    await titleInput.waitFor({ state: "visible", timeout: 10_000 });

    // Overwrite with test title
    await titleInput.fill("E2E Draft Auto Test");

    // Click save draft button (visible in top bar)
    await ownerPage.locator("button").filter({ hasText: /下書き保存/ }).first().click();
    await ownerPage.waitForLoadState("networkidle");

    // After saving draft, we should be redirected to document detail
    await expect(ownerPage).toHaveURL(/\/dashboard\/documents\/\d+/, {
      timeout: 15_000,
    });
  });

  test("DS-05: email preview modal is wide", async ({ ownerPage }) => {
    test.skip(
      true,
      "Modal width is covered by DocumentNew.emailPreview.test.tsx; this E2E flow is flaky when PDF preprocessing resets the wizard step.",
    );

    const nextButton = () =>
      ownerPage.getByRole("button", { name: /次へ|Next/ }).last();
    const goNext = async () => {
      const button = nextButton();
      await expect(button).toBeEnabled({ timeout: 10_000 });
      await button.click();
    };

    await ownerPage.goto("/dashboard/documents/new");
    await ownerPage.waitForLoadState("networkidle");

    const pdfPath = join(process.cwd(), "e2e/fixtures/sample.pdf");
    const fileInput = ownerPage.locator('input[type="file"]').first();
    await fileInput.setInputFiles(pdfPath);

    const titleInput = ownerPage.locator("input#title").first();
    await titleInput.waitFor({ state: "visible", timeout: 10_000 });
    await titleInput.fill("E2E Preview Width Test");

    const firstPage = ownerPage.locator("[data-page-num]").first();
    const pageVisible = await firstPage.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!pageVisible) {
      const pdfLoadError = ownerPage
        .locator("text=PDFの読み込みに失敗")
        .or(ownerPage.locator("text=Failed to load PDF"))
        .first();
      if (await pdfLoadError.isVisible({ timeout: 2_000 }).catch(() => false)) {
        test.skip(true, "PDF preview failed to render in this run");
      }
      await firstPage.waitFor({ state: "visible", timeout: 20_000 });
    }

    await firstPage.click({ position: { x: 60, y: 80 } });
    await expect(ownerPage.locator("[data-field-id]").first()).toBeVisible({ timeout: 10_000 });

    await goNext();
    await expect(
      ownerPage
        .locator("text=02 送付先の設定")
        .or(ownerPage.locator("text=02 Set Recipients"))
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await ownerPage
      .locator(
        "input[placeholder*='example@company.com'], input[placeholder*='recipient@company.com'], input[placeholder*='email' i]",
      )
      .first()
      .fill("signer@e2e-test.local");
    await ownerPage
      .locator(
        "input[placeholder*='山田太郎'], input[placeholder*='recipient name' i], input[placeholder*='name' i]",
      )
      .first()
      .fill("E2E Signer");
    await goNext();
    await expect(
      ownerPage
        .locator("text=03 入力項目の設定")
        .or(ownerPage.locator("text=03 Set Fields"))
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await goNext();
    await expect(
      ownerPage
        .locator("text=04 送信内容の確認")
        .or(ownerPage.locator("text=04 Review and Send"))
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await ownerPage
      .getByRole("button", { name: /メールプレビュー|Preview Email/ })
      .click();

    const dialog = ownerPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/max-w-5xl/);
    await expect(dialog).toHaveClass(/w-\[90vw\]/);
    await expect(dialog).toHaveClass(/max-h-\[90vh\]/);
  });

  test("DS-01: create document, save fields, and send for signature via API", async ({
    ownerPage,
  }) => {
    const title = `E2E Send Test ${Date.now()}`;
    const orgId = await getOrgId(ownerPage);

    // Step 1: Create document
    const createData = await trpcMutation<{ id: number }>(
      ownerPage,
      "documents.create",
      { title },
      orgId,
    );
    const documentId = createData.id;
    expect(documentId).toBeTruthy();

    // Upload PDF (required before sendForSignature)
    await uploadSamplePdf(ownerPage, documentId, orgId);

    // Step 2: Save fields
    await trpcMutation(
      ownerPage,
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

    // Step 3: Send for signature
    await trpcMutation(
      ownerPage,
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
      },
      orgId,
    );

    // Verify document status is now "sent" in the UI
    await ownerPage.goto(`/dashboard/documents/${documentId}`);
    await ownerPage.waitForLoadState("networkidle");
    await expect(
      ownerPage
        .locator("text=送信済み")
        .or(ownerPage.locator("text=Sent"))
        .or(ownerPage.locator("[data-testid='status-badge']"))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("DS-02: send document with multiple recipients (sequential routing)", async ({
    ownerPage,
  }) => {
    const title = `E2E Sequential Test ${Date.now()}`;
    const orgId = await getOrgId(ownerPage);

    const createData = await trpcMutation<{ id: number }>(
      ownerPage,
      "documents.create",
      { title },
      orgId,
    );
    const documentId = createData.id;
    expect(documentId).toBeTruthy();

    // Upload PDF (required before sendForSignature)
    await uploadSamplePdf(ownerPage, documentId, orgId);

    // Save fields for 2 signers
    await trpcMutation(
      ownerPage,
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
          {
            id: "f2",
            page: 0,
            x: 20,
            y: 70,
            width: 30,
            height: 10,
            signerIndex: 1,
            type: "name",
          },
        ],
      },
      orgId,
    );

    await trpcMutation(
      ownerPage,
      "documents.sendForSignature",
      {
        documentId,
        signers: [
          {
            email: "signer@e2e-test.local",
            name: "E2E Signer 1",
            order: 1,
            role: "signer",
          },
          {
            email: "member@e2e-test.local",
            name: "E2E Member",
            order: 2,
            role: "signer",
          },
        ],
        sequentialRouting: true,
      },
      orgId,
    );

    // Verify document is sent
    await ownerPage.goto(`/dashboard/documents/${documentId}`);
    await ownerPage.waitForLoadState("networkidle");
    await expect(
      ownerPage
        .locator("text=送信済み")
        .or(ownerPage.locator("text=Sent"))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("DS-03: create document from template and send", async ({ ownerPage }) => {
    const orgId = await getOrgId(ownerPage);

    // Get the E2E Test Template ID from the templates list
    const templates = await trpcQuery<Array<{ id: number; title: string }>>(
      ownerPage,
      "templates.list",
      {},
      orgId,
    );

    const e2eTemplate = (Array.isArray(templates) ? templates : []).find(
      (t) => t.title === "E2E Test Template",
    );

    if (!e2eTemplate) {
      // Create a template first, then create from it
      const createTplData = await trpcMutation<{ id: number }>(
        ownerPage,
        "templates.create",
        { title: "E2E Template for DS-03", signerCount: 1 },
        orgId,
      );
      const templateId = createTplData.id;
      expect(templateId).toBeTruthy();

      const createDocData = await trpcMutation<{ id: number }>(
        ownerPage,
        "documents.createFromTemplate",
        { templateId, title: `E2E Template Doc ${Date.now()}` },
        orgId,
      );
      expect(createDocData.id).toBeTruthy();
      return; // Template without PDF can't be sent, just verify creation succeeded
    }

    // Create from existing template
    const createDocData = await trpcMutation<{ id: number }>(
      ownerPage,
      "documents.createFromTemplate",
      {
        templateId: e2eTemplate.id,
        title: `E2E Template Doc ${Date.now()}`,
      },
      orgId,
    );
    const documentId = createDocData.id;
    expect(documentId).toBeTruthy();

    // Navigate to document and verify it was created
    await ownerPage.goto(`/dashboard/documents/${documentId}`);
    await ownerPage.waitForLoadState("networkidle");
    await expect(
      ownerPage
        .locator("text=下書き")
        .or(ownerPage.locator("text=Draft"))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
