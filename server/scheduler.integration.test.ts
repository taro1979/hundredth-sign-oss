/**
 * Integration tests for server/scheduler.ts
 * Requires a running MySQL instance accessible via DATABASE_URL (E2E environment).
 *
 * dsm-AC-008: expiresAt < now の文書を scheduler が expired に更新する
 * email-AC-003: リマインダーのメール URL が ENV.appUrl ベースの完全パスを持つ
 *
 * Skip gracefully when DATABASE_URL is not pointing to an E2E / test database.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// ---------------------------------------------------------------------------
// Guard: only run when E2E database is configured
// ---------------------------------------------------------------------------
const databaseUrl = process.env.DATABASE_URL ?? "";
const isE2EDatabase =
  Boolean(process.env.DATABASE_URL_E2E) ||
  (databaseUrl.includes("localhost") && databaseUrl.includes("3307"));

// ============================================================
// dsm-AC-008: processExpirations marks past-due documents as expired
// ============================================================
describe.skipIf(!isE2EDatabase)("dsm-AC-008: processExpirations marks expired documents", () => {
  let testOrgId: number;
  let testDocId: number;
  let testUserId: number;

  beforeAll(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    expect(db).not.toBeNull();

    const schema = await import("../drizzle/schema");

    // Insert test user
    const userResult = await db!.insert(schema.users).values({
      openId: `test-dsm-ac-008-${Date.now()}`,
      email: `dsm-ac-008-${Date.now()}@example.com`,
      name: "Scheduler Integration User",
      loginMethod: "password",
    } as any);
    testUserId = (userResult[0] as any).insertId;
    // Insert org

    const orgResult = await db!.insert(schema.organizations).values({
      name: `Test Org dsm-ac-008 ${Date.now()}`,
      slug: `test-dsm-ac-008-${Date.now()}`,
      ownerUserId: testUserId,
    } as any);
    testOrgId = (orgResult[0] as any).insertId;

    // Insert a document with expiresAt in the past (1 second ago)
    const pastDate = new Date(Date.now() - 1000);
    const docResult = await db!.insert(schema.documents).values({
      userId: testUserId,
      organizationId: testOrgId,
      title: "Expiring Scheduler Test Document",
      status: "sent",
      expiresAt: pastDate,
    } as any);
    testDocId = (docResult[0] as any).insertId;
  }, 30000);

  afterAll(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const schema = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(schema.signatureRequests).where(eq(schema.signatureRequests.documentId, testDocId));
    await db.delete(schema.documents).where(eq(schema.documents.id, testDocId));
    await db.delete(schema.memberships).where(eq(schema.memberships.organizationId, testOrgId));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrgId));
    await db.delete(schema.users).where(eq(schema.users.id, testUserId));
  }, 30000);

  it("dsm-AC-008: document with past expiresAt is marked expired by processExpirations", async () => {
    // processExpirations uses real DB; import and mock only email-related stuff
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { processExpirations } = await import("./scheduler");

    // Run expiration processing
    await processExpirations();

    // Verify the document is now 'expired'
    const { getDocumentById } = await import("./db");
    const doc = await getDocumentById(testDocId);
    expect(doc).not.toBeNull();
    expect(doc?.status).toBe("expired");

    vi.restoreAllMocks();
  });
});

// ============================================================
// email-AC-003: reminder email URL is based on ENV.appUrl
// (This test can run without a real DB — uses mock DB)
// ============================================================
describe("email-AC-003: reminder email URL is based on ENV.appUrl", () => {
  it("email-AC-003: reminder signUrl uses ENV.appUrl as base path", async () => {
    vi.resetModules();

    const appUrl = "https://app.hundredthsign.example.com";

    vi.doMock("./_core/env", () => ({
      ENV: { appUrl },
    }));

    const mockSendEmail = vi.fn().mockResolvedValue(true);
    const mockBuildReminderEmail = vi.fn().mockReturnValue({
      subject: "リマインダー",
      html: "<p>reminder</p>",
    });
    const mockResolveEmailLocale = vi.fn().mockReturnValue("ja");

    vi.doMock("./email", () => ({
      sendEmail: mockSendEmail,
      buildReminderEmail: mockBuildReminderEmail,
      resolveEmailLocale: mockResolveEmailLocale,
    }));

    const accessToken = `email-ac-003-token-${Date.now()}`;
    vi.doMock("./db", () => ({
      getDocumentsNeedingReminder: vi.fn().mockResolvedValue([{
        id: 42,
        title: "テスト文書",
        userId: 10,
        organizationId: 100,
        reminderDays: 3,
      }]),
      getDocumentsNeedingExpiration: vi.fn().mockResolvedValue([]),
      getPendingSignatureRequests: vi.fn().mockResolvedValue([
        {
          id: 1,
          signerEmail: "signer@example.com",
          signerName: "テスト署名者",
          accessToken,
          locale: "ja",
        },
      ]),
      updateDocument: vi.fn().mockResolvedValue(undefined),
      getUserById: vi.fn().mockResolvedValue({ id: 10, name: "送信者名" }),
      createActivityLog: vi.fn().mockResolvedValue(undefined),
    }));

    const { processReminders } = await import("./scheduler");
    await processReminders();

    // Verify buildReminderEmail was called with signUrl that starts with appUrl
    expect(mockBuildReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        signUrl: expect.stringContaining(appUrl),
      }),
    );

    // Verify the signUrl contains the accessToken
    const call = mockBuildReminderEmail.mock.calls[0]?.[0];
    expect(call?.signUrl).toBe(`${appUrl}/sign/${accessToken}?lng=ja`);

    vi.resetModules();
  });
});

// ============================================================
// IT-003: processReminders early return when ENV.appUrl is empty
// getDocumentsNeedingReminder と updateDocument が呼ばれないことを検証
// ============================================================
describe("IT-003: processReminders early return when ENV.appUrl is empty", () => {
  it("does NOT call getDocumentsNeedingReminder or updateDocument when appUrl is empty", async () => {
    vi.resetModules();

    vi.doMock("./_core/env", () => ({
      ENV: { appUrl: "" },
    }));

    const mockGetDocs = vi.fn().mockResolvedValue([]);
    const mockGetExpiration = vi.fn().mockResolvedValue([]);
    const mockGetPending = vi.fn().mockResolvedValue([]);
    const mockUpdateDocument = vi.fn().mockResolvedValue(undefined);
    const mockGetUserById = vi.fn().mockResolvedValue(null);
    const mockCreateActivityLog = vi.fn().mockResolvedValue(undefined);

    vi.doMock("./db", () => ({
      getDocumentsNeedingReminder: mockGetDocs,
      getDocumentsNeedingExpiration: mockGetExpiration,
      getPendingSignatureRequests: mockGetPending,
      updateDocument: mockUpdateDocument,
      getUserById: mockGetUserById,
      getDocumentById: vi.fn(),
      createActivityLog: mockCreateActivityLog,
    }));

    vi.doMock("./email", () => ({
      sendEmail: vi.fn(),
      buildReminderEmail: vi.fn(),
      resolveEmailLocale: vi.fn(),
    }));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { processReminders } = await import("./scheduler");
    await processReminders();

    // 早期リターン: DB クエリが一切実行されていないことを検証
    expect(mockGetDocs).not.toHaveBeenCalled();
    // nextReminderAt が更新されていないことを検証（データ消失しない）
    expect(mockUpdateDocument).not.toHaveBeenCalled();
    // 警告ログが出力されることを検証
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[SCHEDULER] Skipping all reminders"),
    );

    warnSpy.mockRestore();
    vi.resetModules();
  });
});
