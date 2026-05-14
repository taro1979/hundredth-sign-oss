import { test, expect } from "./fixtures";

test.describe("Templates", () => {
  test("TE-01: template list shows seeded template", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/templates");
    await ownerPage.waitForLoadState("networkidle");
    await expect(ownerPage.locator("text=E2E Test Template").first()).toBeVisible({ timeout: 10_000 });
  });

  test("TE-02: search filters templates by title", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/templates");
    await ownerPage.waitForLoadState("networkidle");
    const searchInput = ownerPage.locator("input[placeholder*='search' i], input[placeholder*='検索'], input[type='search']").first();
    await searchInput.fill("E2E Test");
    await ownerPage.waitForTimeout(500);
    await expect(ownerPage.locator("text=E2E Test Template").first()).toBeVisible();
  });
});

test.describe("Templates CRUD", () => {
  test.setTimeout(60_000);

  test("TE-03: create new template", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/templates");
    await ownerPage.waitForLoadState("networkidle");

    const uniqueTitle = `E2E New Template ${Date.now()}`;

    // Click "新しいテンプレート" button
    await ownerPage
      .locator("button")
      .filter({ hasText: /新規テンプレート|テンプレートを作成|Create Template|New Template/i })
      .first()
      .click();
    await ownerPage.waitForTimeout(500);

    // Fill title in dialog
    await ownerPage
      .locator("input[placeholder*='タイトル'], input[placeholder*='title' i]")
      .first()
      .fill(uniqueTitle);

    // Click create button
    await ownerPage
      .locator("button")
      .filter({ hasText: /作成.*編集|編集.*作成|Create.*Edit|Create & Edit/i })
      .last()
      .click();
    await ownerPage.waitForTimeout(2000);

    // Should be in edit view now (template was created)
    // Go back to list to verify template appears
    const backBtn = ownerPage.locator("button").filter({ hasText: /戻る|Back/ }).first();
    if (await backBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await backBtn.click();
    } else {
      await ownerPage.goto("/dashboard/templates");
    }
    await ownerPage.waitForLoadState("networkidle");
    await ownerPage.waitForTimeout(1000);

    await expect(ownerPage.locator(`text=${uniqueTitle}`).first()).toBeVisible({
      timeout: 10_000,
    });

    // Clean up - delete the created template
    const templateRow = ownerPage
      .locator("[data-slot='card']")
      .filter({ hasText: uniqueTitle })
      .first();
    const moreBtn = templateRow.locator("button").last();
    await moreBtn.click();
    await ownerPage.waitForTimeout(300);
    ownerPage.once("dialog", (d) => d.accept());
    await ownerPage
      .locator("[role='menuitem']")
      .filter({ hasText: /削除|Delete/ })
      .last()
      .click();
    await ownerPage.waitForTimeout(1000);
  });

  test("TE-04: open template for editing shows edit view", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/templates");
    await ownerPage.waitForLoadState("networkidle");
    await ownerPage.waitForTimeout(500);

    const searchInput = ownerPage
      .locator("input[placeholder*='search' i], input[placeholder*='検索'], input[type='search']")
      .first();
    if (await searchInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await searchInput.fill("E2E Test Template");
      await ownerPage.waitForTimeout(500);
    }

    // Verify E2E Test Template is visible
    const templateTitle = ownerPage.getByRole("heading", { name: "E2E Test Template" }).first();
    await expect(templateTitle).toBeVisible({
      timeout: 10_000,
    });

    // Click "…" dropdown for E2E Test Template
    const templateCard = ownerPage
      .locator("[data-slot='card']")
      .filter({ has: templateTitle })
      .first();
    const moreBtn = templateCard.locator("button").last();
    await moreBtn.click();
    await ownerPage.waitForTimeout(300);

    // Click "編集" (Edit) option
    await ownerPage
      .locator("[role='menuitem']")
      .filter({ hasText: /編集|Edit/ })
      .first()
      .click();

    // Should now be in edit view — wait for the template title to appear in the h1
    await expect(ownerPage.getByRole("heading", { name: "E2E Test Template" }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Upload PDF section should be visible
    await expect(
      ownerPage
        .locator("text=PDFをアップロード")
        .or(ownerPage.locator("text=Upload PDF"))
        .or(ownerPage.locator("input[type='file']"))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("TE-05: delete template", async ({ ownerPage }) => {
    // First create a template to delete
    const deleteTitle = `E2E Delete Template ${Date.now()}`;

    await ownerPage.goto("/dashboard/templates");
    await ownerPage.waitForLoadState("networkidle");

    // Create template
    await ownerPage
      .locator("button")
      .filter({ hasText: /新規テンプレート|テンプレートを作成|Create Template|New Template/i })
      .first()
      .click();
    await ownerPage.waitForTimeout(500);
    await ownerPage
      .locator("input[placeholder*='タイトル'], input[placeholder*='title' i]")
      .first()
      .fill(deleteTitle);
    await ownerPage
      .locator("button")
      .filter({ hasText: /作成.*編集|編集.*作成|Create.*Edit|Create & Edit/i })
      .last()
      .click();
    await ownerPage.waitForTimeout(1000);

    // Go back to list
    const backBtn = ownerPage.locator("button").filter({ hasText: /戻る|Back/ }).first();
    if (await backBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await backBtn.click();
    } else {
      await ownerPage.goto("/dashboard/templates");
    }
    await ownerPage.waitForLoadState("networkidle");

    // Verify template exists
    await expect(ownerPage.locator(`text=${deleteTitle}`).first()).toBeVisible({
      timeout: 10_000,
    });

    // Find template card and click "…" dropdown
    const templateCard = ownerPage
      .locator("[data-slot='card']")
      .filter({ hasText: deleteTitle })
      .first();
    const moreBtn = templateCard.locator("button").last();
    await moreBtn.scrollIntoViewIfNeeded();
    await moreBtn.click();
    await ownerPage.waitForTimeout(300);

    // Handle confirm dialog and click delete
    ownerPage.once("dialog", (d) => d.accept());
    await ownerPage
      .locator("[role='menuitem']")
      .filter({ hasText: /削除|Delete/ })
      .last()
      .click();
    await ownerPage.waitForTimeout(1000);

    // Verify template is gone
    await expect(ownerPage.locator(`text=${deleteTitle}`)).toBeHidden({ timeout: 10_000 });
  });
});
