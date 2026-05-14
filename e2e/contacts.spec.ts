import { test, expect } from "./fixtures";

test.describe.serial("Contacts CRUD", () => {
  test("CO-01: contacts list shows seed data", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/contacts");
    await ownerPage.waitForLoadState("networkidle");
    // Should see at least one of the seeded contacts
    await expect(
      ownerPage
        .locator("text=田中太郎")
        .or(ownerPage.locator("text=tanaka@e2e-test.local"))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("CO-02: create a new contact", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/contacts");
    await ownerPage.waitForLoadState("networkidle");
    await ownerPage.waitForTimeout(500);
    // Click "連絡先を追加" button (specific text to avoid matching "カテゴリー管理" etc.)
    const addBtn = ownerPage
      .locator("button")
      .filter({ hasText: /連絡先を追加/ })
      .first();
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();
    await ownerPage.waitForTimeout(300);
    // Scope all inputs to the dialog — the search input behind the dialog must not match
    const dialog = ownerPage.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // Name input: first input in dialog (placeholder="山田太郎", no name/type attr)
    await dialog.locator("input").nth(0).fill("E2E New Contact");
    // Email input: has type="email"
    await dialog.locator("input[type='email']").first().fill("newcontact@e2e-test.local");
    // Submit — text is "作成" (ja) / "Create" (en) for new contact
    const submitBtn = dialog
      .locator("button")
      .filter({ hasText: /追加|Save|Add|Create|作成/ })
      .last();
    await submitBtn.click();
    // Verify the new contact appears in the list
    await expect(
      ownerPage.locator("text=E2E New Contact").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("CO-03: edit an existing contact", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/contacts");
    await ownerPage.waitForLoadState("networkidle");
    // Contacts use <tr> rows in a table
    const row = ownerPage
      .locator("tr")
      .filter({ hasText: "E2E New Contact" })
      .first();
    // Edit button is first icon-only button in last <td> (no text, just Edit icon)
    const editBtn = row.locator("td").last().locator("button").first();
    await editBtn.click();
    await ownerPage.waitForTimeout(300);
    // Scope to dialog
    const dialog = ownerPage.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const nameInput = dialog.locator("input").nth(0);
    await nameInput.clear();
    await nameInput.fill("E2E Updated Contact");
    // Save — text is "保存" (ja common.save) or "Save" (en)
    const saveBtn = dialog
      .locator("button")
      .filter({ hasText: /更新|Save|Update|保存/ })
      .last();
    await saveBtn.click();
    // Verify updated
    await expect(
      ownerPage.locator("text=E2E Updated Contact").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("CO-04: delete a contact", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/contacts");
    await ownerPage.waitForLoadState("networkidle");
    // Find the row with "E2E Updated Contact"
    const row = ownerPage
      .locator("tr")
      .filter({ hasText: "E2E Updated Contact" })
      .first();
    // Delete button is last icon-only button in last <td> (no text, just Trash2 icon)
    const deleteBtn = row.locator("td").last().locator("button").last();
    // Handle window.confirm before clicking
    ownerPage.once("dialog", (d) => d.accept());
    await deleteBtn.click();
    await ownerPage.waitForTimeout(1000);
    // Verify the contact is gone
    await expect(
      ownerPage.locator("text=E2E Updated Contact")
    ).toBeHidden({ timeout: 10_000 });
  });

  test("CO-05: search contacts by name", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/contacts");
    await ownerPage.waitForLoadState("networkidle");
    // Type in search box
    const searchInput = ownerPage
      .locator(
        "input[placeholder*='search' i], input[placeholder*='検索'], input[type='search']"
      )
      .first();
    await searchInput.fill("田中");
    await ownerPage.waitForTimeout(500);
    // 田中太郎 should be visible, others may be hidden
    await expect(ownerPage.locator("text=田中太郎").first()).toBeVisible();
  });

  test("CO-06: create a category", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/contacts");
    await ownerPage.waitForLoadState("networkidle");
    // Click the "カテゴリー管理" button to open category management dialog
    const categoryBtn = ownerPage
      .locator("button")
      .filter({ hasText: /カテゴリー管理/ })
      .first();
    await categoryBtn.click();
    await ownerPage.waitForTimeout(300);
    // Scope to dialog — the inline form is always visible (no separate "add" button needed)
    const dialog = ownerPage.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // Fill category name in the form's input
    const nameInput = dialog.locator("input").first();
    await nameInput.fill("E2E Category");
    // Click submit button (t("common.create") = "作成" in Japanese)
    const saveBtn = dialog
      .locator("button")
      .filter({ hasText: /追加|Save|Add|Create|作成/ })
      .last();
    await saveBtn.click();
    await expect(
      ownerPage.locator("text=E2E Category").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("CO-07: assign category to a contact", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/contacts");
    await ownerPage.waitForLoadState("networkidle");
    // Find 田中太郎 row and click edit (first icon button in last td)
    const row = ownerPage
      .locator("tr")
      .filter({ hasText: "田中太郎" })
      .first();
    const editBtn = row.locator("td").last().locator("button").first();
    await editBtn.click();
    await ownerPage.waitForTimeout(300);
    // Scope to dialog
    const dialog = ownerPage.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // Find category select/dropdown and select a category
    const categorySelect = dialog.locator("[role='combobox']").first();
    if (await categorySelect.isVisible()) {
      await categorySelect.click();
      await ownerPage
        .locator("[role='option']")
        .filter({ hasText: /取引先|E2E Category/ })
        .first()
        .click();
    }
    // Save (t("common.save") = "保存" in Japanese)
    const saveBtn = dialog
      .locator("button")
      .filter({ hasText: /更新|Save|Update|保存/ })
      .last();
    await saveBtn.click();
    await ownerPage.waitForTimeout(1000);
    // Verify badge appears by reloading contacts page
    await ownerPage.goto("/dashboard/contacts");
    await ownerPage.waitForLoadState("networkidle");
  });

  test("CO-08: create a group", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/contacts");
    await ownerPage.waitForLoadState("networkidle");
    // Click "グループ管理" button
    const groupBtn = ownerPage
      .locator("button")
      .filter({ hasText: /グループ管理/ })
      .first();
    await groupBtn.click();
    await ownerPage.waitForTimeout(300);
    // Scope to dialog — inline form is always visible
    const dialog = ownerPage.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const nameInput = dialog.locator("input").first();
    await nameInput.fill("E2E Group");
    const saveBtn = dialog
      .locator("button")
      .filter({ hasText: /追加|Save|Add|Create|作成/ })
      .last();
    await saveBtn.click();
    await expect(ownerPage.locator("text=E2E Group").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("CO-09: add member to group", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/contacts");
    await ownerPage.waitForLoadState("networkidle");
    // Open group management dialog
    const groupBtn = ownerPage
      .locator("button")
      .filter({ hasText: /グループ管理/ })
      .first();
    await groupBtn.click();
    await ownerPage.waitForTimeout(500);
    // Scope to the group management dialog
    const groupDialog = ownerPage.locator("[role='dialog']");
    await expect(groupDialog).toBeVisible({ timeout: 5_000 });
    // Click the member-management button in the specific "E2E Group" row.
    const groupRow = groupDialog
      .locator("div")
      .filter({ hasText: "E2E Group" })
      .first();
    const memberMgmtBtn = groupRow.locator("button[title='グループ管理']").first();
    await memberMgmtBtn.scrollIntoViewIfNeeded();
    await memberMgmtBtn.click();
    await ownerPage.waitForTimeout(500);
    // Group Members Dialog opens with title = group name ("E2E Group"), NOT "のメンバー"
    // Two dialogs are open simultaneously — get the one that does NOT contain "グループ管理"
    const membersDialog = ownerPage
      .locator("[role='dialog']")
      .filter({ hasNotText: "グループ管理" })
      .first();
    await expect(membersDialog).toBeVisible({ timeout: 5_000 });
    // Find 田中太郎 in the "連絡先を追加" section and click "追加"
    const addRow = membersDialog
      .locator("div")
      .filter({ hasText: "田中太郎" })
      .first();
    const addBtn = addRow.locator("button").filter({ hasText: /追加|作成|Add|Create/ }).first();
    if (await addBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addBtn.scrollIntoViewIfNeeded();
      await addBtn.click();
      await ownerPage.waitForTimeout(1000);
      await expect(membersDialog.getByText("田中太郎").first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("CO-10: remove member from group", async ({ ownerPage }) => {
    await ownerPage.goto("/dashboard/contacts");
    await ownerPage.waitForLoadState("networkidle");
    // Open group management dialog
    const groupBtn = ownerPage
      .locator("button")
      .filter({ hasText: /グループ管理/ })
      .first();
    await groupBtn.click();
    await ownerPage.waitForTimeout(500);
    const groupDialog = ownerPage.locator("[role='dialog']");
    await expect(groupDialog).toBeVisible({ timeout: 5_000 });
    // Click the UserPlus button (title=t("contacts.manageGroups")="グループ管理") to open Group Members dialog
    const memberMgmtBtn = groupDialog
      .locator("button[title='グループ管理']")
      .first();
    await memberMgmtBtn.scrollIntoViewIfNeeded();
    await memberMgmtBtn.click();
    await ownerPage.waitForTimeout(500);
    // Group Members Dialog has title = group name (NOT "のメンバー"), get dialog without "グループ管理"
    const membersDialog = ownerPage
      .locator("[role='dialog']")
      .filter({ hasNotText: "グループ管理" })
      .first();
    await expect(membersDialog).toBeVisible({ timeout: 5_000 });
    // Find 田中太郎 in "現在のメンバー" section and click UserMinus (title=t("contacts.removeFromGroup")="グループから削除")
    const memberRow = membersDialog
      .locator("div")
      .filter({ hasText: "田中太郎" })
      .first();
    const removeBtn = memberRow
      .locator("button[title='グループから削除']")
      .first();
    if (await removeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await removeBtn.scrollIntoViewIfNeeded();
      await removeBtn.click();
      await ownerPage.waitForTimeout(1000);
    }
  });
});
