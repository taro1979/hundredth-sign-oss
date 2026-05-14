import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all dependencies before importing
vi.mock("./db", () => ({
  getDocumentsNeedingReminder: vi.fn(),
  getDocumentsNeedingExpiration: vi.fn(),
  getPendingSignatureRequests: vi.fn(),
  updateDocument: vi.fn(),
  getDocumentById: vi.fn(),
  getUserById: vi.fn(),
  createActivityLog: vi.fn(),
}));

vi.mock("./email", () => ({
  sendEmail: vi.fn(),
  buildReminderEmail: vi.fn().mockReturnValue({
    subject: "リマインダー",
    html: "<p>リマインダー</p>",
  }),
  resolveEmailLocale: vi.fn().mockReturnValue("ja"),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    appUrl: "https://app.example.com",
  },
}));

vi.mock("./auditLog", () => ({
  verifyHashChainIntegrity: vi.fn(),
  appendAuditLog: vi.fn(),
}));

import { processReminders, processExpirations, startScheduler, processIntegrityCheck, INTEGRITY_CHECK_INTERVAL_MS } from "./scheduler";
import {
  getDocumentsNeedingReminder,
  getDocumentsNeedingExpiration,
  getPendingSignatureRequests,
  updateDocument,
  getUserById,
  createActivityLog,
} from "./db";
import { sendEmail, buildReminderEmail } from "./email";
import { verifyHashChainIntegrity, appendAuditLog } from "./auditLog";

describe("Scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processReminders", () => {
    it("should send reminders to pending signers", async () => {
      const mockDoc = {
        id: 1,
        title: "テスト契約書",
        userId: 10,
        reminderDays: 3,
      };
      (getDocumentsNeedingReminder as any).mockResolvedValue([mockDoc]);
      (getUserById as any).mockResolvedValue({ id: 10, name: "田中太郎" });
      (getPendingSignatureRequests as any).mockResolvedValue([
        { id: 1, signerEmail: "signer@example.com", signerName: "佐藤花子", accessToken: "abc123" },
        { id: 2, signerEmail: "signer2@example.com", signerName: null, accessToken: "def456" },
      ]);
      (sendEmail as any).mockResolvedValue(undefined);
      (updateDocument as any).mockResolvedValue(undefined);
      (createActivityLog as any).mockResolvedValue(undefined);

      await processReminders();

      expect(getDocumentsNeedingReminder).toHaveBeenCalled();
      expect(getUserById).toHaveBeenCalledWith(10);
      expect(buildReminderEmail).toHaveBeenCalledTimes(2);
      // buildReminderEmail is now called with signUrl, senderName, lang, etc.
      expect(buildReminderEmail).toHaveBeenCalledWith(expect.objectContaining({
        signerName: "佐藤花子",
        senderName: "田中太郎",
        documentTitle: "テスト契約書",
        lang: "ja",
      }));
      expect(sendEmail).toHaveBeenCalledTimes(2);
      // First signer uses signerName
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: "signer@example.com",
        toName: "佐藤花子",
        type: "reminder",
        documentId: 1,
        signatureRequestId: 1,
      }));
      // Second signer has no name, toName should be undefined
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: "signer2@example.com",
        toName: undefined,
        type: "reminder",
        documentId: 1,
        signatureRequestId: 2,
      }));
      expect(updateDocument).toHaveBeenCalledWith(1, { nextReminderAt: expect.any(Date) });
      expect(createActivityLog).toHaveBeenCalledWith(expect.objectContaining({
        documentId: 1,
        action: "reminder_sent",
      }));
    });

    it("should skip documents with no pending signers", async () => {
      const mockDoc = { id: 2, title: "完了済み", userId: 10, reminderDays: 3 };
      (getDocumentsNeedingReminder as any).mockResolvedValue([mockDoc]);
      (getPendingSignatureRequests as any).mockResolvedValue([]);

      await processReminders();

      expect(sendEmail).not.toHaveBeenCalled();
      expect(updateDocument).not.toHaveBeenCalled();
    });

    it("should set nextReminderAt to null when reminderDays is not set", async () => {
      const mockDoc = { id: 3, title: "テスト", userId: 10, reminderDays: null };
      (getDocumentsNeedingReminder as any).mockResolvedValue([mockDoc]);
      (getUserById as any).mockResolvedValue({ id: 10, name: "田中" });
      (getPendingSignatureRequests as any).mockResolvedValue([
        { id: 1, signerEmail: "s@example.com", signerName: "A", accessToken: "t1" },
      ]);
      (sendEmail as any).mockResolvedValue(undefined);
      (updateDocument as any).mockResolvedValue(undefined);
      (createActivityLog as any).mockResolvedValue(undefined);

      await processReminders();

      expect(updateDocument).toHaveBeenCalledWith(3, { nextReminderAt: null });
    });

    it("should use fallback sender name when owner is null", async () => {
      const mockDoc = { id: 4, title: "テスト", userId: null, reminderDays: 1 };
      (getDocumentsNeedingReminder as any).mockResolvedValue([mockDoc]);
      (getUserById as any).mockResolvedValue(null);
      (getPendingSignatureRequests as any).mockResolvedValue([
        { id: 1, signerEmail: "s@example.com", signerName: "A", accessToken: "t1" },
      ]);
      (sendEmail as any).mockResolvedValue(undefined);
      (updateDocument as any).mockResolvedValue(undefined);
      (createActivityLog as any).mockResolvedValue(undefined);

      await processReminders();

      expect(buildReminderEmail).toHaveBeenCalledWith(expect.objectContaining({
        senderName: "送信者",
      }));
    });

    it("should use email as signerName fallback in buildReminderEmail", async () => {
      const mockDoc = { id: 5, title: "テスト", userId: 10, reminderDays: 1 };
      (getDocumentsNeedingReminder as any).mockResolvedValue([mockDoc]);
      (getUserById as any).mockResolvedValue({ id: 10, name: "田中" });
      (getPendingSignatureRequests as any).mockResolvedValue([
        { id: 1, signerEmail: "signer@example.com", signerName: null, accessToken: "t1" },
      ]);
      (sendEmail as any).mockResolvedValue(undefined);
      (updateDocument as any).mockResolvedValue(undefined);
      (createActivityLog as any).mockResolvedValue(undefined);

      await processReminders();

      expect(buildReminderEmail).toHaveBeenCalledWith(expect.objectContaining({
        signerName: "signer@example.com",
      }));
    });

    it("should handle error in individual document processing", async () => {
      const mockDoc = { id: 6, title: "エラー", userId: 10, reminderDays: 1 };
      (getDocumentsNeedingReminder as any).mockResolvedValue([mockDoc]);
      (getPendingSignatureRequests as any).mockRejectedValue(new Error("DB error"));

      await processReminders();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to process reminder for document 6"),
        expect.any(Error),
      );
    });

    it("should handle top-level error in processReminders", async () => {
      (getDocumentsNeedingReminder as any).mockRejectedValue(new Error("Connection failed"));

      await processReminders();

      expect(console.error).toHaveBeenCalledWith(
        "[Scheduler] Error processing reminders:",
        expect.any(Error),
      );
    });

    it("should handle owner with no name", async () => {
      const mockDoc = { id: 7, title: "テスト", userId: 10, reminderDays: 1 };
      (getDocumentsNeedingReminder as any).mockResolvedValue([mockDoc]);
      (getUserById as any).mockResolvedValue({ id: 10, name: null });
      (getPendingSignatureRequests as any).mockResolvedValue([
        { id: 1, signerEmail: "s@example.com", signerName: "A", accessToken: "t1" },
      ]);
      (sendEmail as any).mockResolvedValue(undefined);
      (updateDocument as any).mockResolvedValue(undefined);
      (createActivityLog as any).mockResolvedValue(undefined);

      await processReminders();

      expect(buildReminderEmail).toHaveBeenCalledWith(expect.objectContaining({
        senderName: "送信者",
      }));
    });

    it("AC-001/AC-002 (W-08): reminderDays=0 sets nextReminderAt to null", async () => {
      const mockDoc = { id: 9, title: "ゼロ日", userId: 10, reminderDays: 0 };
      (getDocumentsNeedingReminder as any).mockResolvedValue([mockDoc]);
      (getUserById as any).mockResolvedValue({ id: 10, name: "田中" });
      (getPendingSignatureRequests as any).mockResolvedValue([
        { id: 1, signerEmail: "s@example.com", signerName: "A", accessToken: "t1" },
      ]);
      (sendEmail as any).mockResolvedValue(undefined);
      (updateDocument as any).mockResolvedValue(undefined);
      (createActivityLog as any).mockResolvedValue(undefined);

      await processReminders();

      expect(updateDocument).toHaveBeenCalledWith(9, { nextReminderAt: null });
    });

    it("reminder email uses full URL with ENV.appUrl (AC-003)", async () => {
      const mockDoc = { id: 8, title: "URL確認テスト", userId: 10, reminderDays: 1 };
      (getDocumentsNeedingReminder as any).mockResolvedValue([mockDoc]);
      (getUserById as any).mockResolvedValue({ id: 10, name: "田中" });
      (getPendingSignatureRequests as any).mockResolvedValue([
        { id: 1, signerEmail: "s@example.com", signerName: "A", accessToken: "token-xyz" },
      ]);
      (sendEmail as any).mockResolvedValue(undefined);
      (updateDocument as any).mockResolvedValue(undefined);
      (createActivityLog as any).mockResolvedValue(undefined);

      await processReminders();

      // signUrl must be a full URL using ENV.appUrl
      expect(buildReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          signUrl: expect.stringContaining("https://app.example.com"),
        })
      );
      // And must include the access token
      expect(buildReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          signUrl: expect.stringContaining("token-xyz"),
        })
      );
    });
  });

  describe("processExpirations", () => {
    it("should expire expired documents", async () => {
      const mockDocs = [
        { id: 10, title: "期限切れ1", userId: 5, organizationId: 1 },
        { id: 11, title: "期限切れ2", userId: 6, organizationId: 1 },
      ];
      (getDocumentsNeedingExpiration as any).mockResolvedValue(mockDocs);
      (updateDocument as any).mockResolvedValue(undefined);
      (createActivityLog as any).mockResolvedValue(undefined);

      await processExpirations();

      expect(updateDocument).toHaveBeenCalledWith(10, { status: "expired" });
      expect(updateDocument).toHaveBeenCalledWith(11, { status: "expired" });
      expect(createActivityLog).toHaveBeenCalledTimes(2);
      expect(createActivityLog).toHaveBeenCalledWith(expect.objectContaining({
        documentId: 10,
        action: "document_expired",
      }));
    });

    it("should handle error in individual document expiration", async () => {
      const mockDocs = [{ id: 12, title: "エラー", userId: 5, organizationId: 1 }];
      (getDocumentsNeedingExpiration as any).mockResolvedValue(mockDocs);
      (updateDocument as any).mockRejectedValue(new Error("Update failed"));

      await processExpirations();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to expire document 12"),
        expect.any(Error),
      );
    });

    it("should handle top-level error in processExpirations", async () => {
      (getDocumentsNeedingExpiration as any).mockRejectedValue(new Error("Connection failed"));

      await processExpirations();

      expect(console.error).toHaveBeenCalledWith(
        "[Scheduler] Error processing expirations:",
        expect.any(Error),
      );
    });

    it("should handle empty expiration list", async () => {
      (getDocumentsNeedingExpiration as any).mockResolvedValue([]);

      await processExpirations();

      expect(updateDocument).not.toHaveBeenCalled();
    });
  });

  describe("startScheduler", () => {
    it("should start the scheduler and run immediately", () => {
      vi.useFakeTimers();
      (getDocumentsNeedingReminder as any).mockResolvedValue([]);
      (getDocumentsNeedingExpiration as any).mockResolvedValue([]);

      startScheduler();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Starting automatic reminder & expiration scheduler"),
      );
      // processReminders and processExpirations should be called immediately
      expect(getDocumentsNeedingReminder).toHaveBeenCalled();
      expect(getDocumentsNeedingExpiration).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should run periodically on interval", async () => {
      vi.useFakeTimers();
      (getDocumentsNeedingReminder as any).mockResolvedValue([]);
      (getDocumentsNeedingExpiration as any).mockResolvedValue([]);

      startScheduler();

      // Clear initial calls
      vi.clearAllMocks();

      // Advance timer by 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);

      expect(getDocumentsNeedingReminder).toHaveBeenCalled();
      expect(getDocumentsNeedingExpiration).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});

// ==================== manus-app-url-optional v2: scheduler skip (AC-008) ====================

describe("manus-app-url-optional v2: scheduler skip (AC-008)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips all reminders when ENV.appUrl is empty (no nextReminderAt update)", async () => {
    // Override ENV.appUrl to empty string
    const envModule = await import("./_core/env");
    const original = envModule.ENV.appUrl;
    (envModule.ENV as any).appUrl = "";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await processReminders();

    // Early return: should not even query for documents
    expect(getDocumentsNeedingReminder).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(buildReminderEmail).not.toHaveBeenCalled();
    // nextReminderAt should NOT be updated (no updateDocument call)
    expect(updateDocument).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[SCHEDULER] Skipping all reminders")
    );

    // Restore
    (envModule.ENV as any).appUrl = original;
    warnSpy.mockRestore();
  });
});

// ==================== fix-sign-url-locale-param: scheduler (AC-S01〜AC-S04) ====================

describe("fix-sign-url-locale-param: scheduler.processReminders signUrl locale", () => {
  beforeEach(() => vi.clearAllMocks());

  // AC-S01: th locale が signUrl に反映される
  it("AC-S01: processReminders embeds 'th' locale in signUrl", async () => {
    (getDocumentsNeedingReminder as any).mockResolvedValue([
      { id: 1, title: "Thai Doc", userId: 1, organizationId: 10, reminderDays: 3, nextReminderAt: new Date() },
    ]);
    (getUserById as any).mockResolvedValue({ id: 1, name: "Owner", email: "o@example.com" });
    (getPendingSignatureRequests as any).mockResolvedValue([
      { id: 1, signerEmail: "s@example.com", signerName: "S", accessToken: "tok-th", locale: "th" },
    ]);
    (sendEmail as any).mockResolvedValue(undefined);
    (updateDocument as any).mockResolvedValue(undefined);
    (createActivityLog as any).mockResolvedValue(undefined);

    // resolveEmailLocale mock returns the locale as-is (truthy)
    const { resolveEmailLocale } = await import("./email");
    (resolveEmailLocale as any).mockReturnValueOnce("th");

    await processReminders();

    expect(buildReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ signUrl: expect.stringMatching(/\?lng=th$/) })
    );
  });

  // AC-S02: zh-CN locale が signUrl に反映される
  it("AC-S02: processReminders embeds 'zh-CN' locale in signUrl", async () => {
    (getDocumentsNeedingReminder as any).mockResolvedValue([
      { id: 2, title: "ZH Doc", userId: 1, organizationId: 10, reminderDays: 3, nextReminderAt: new Date() },
    ]);
    (getUserById as any).mockResolvedValue({ id: 1, name: "Owner", email: "o@example.com" });
    (getPendingSignatureRequests as any).mockResolvedValue([
      { id: 2, signerEmail: "s@example.com", signerName: "S", accessToken: "tok-zh", locale: "zh-CN" },
    ]);
    (sendEmail as any).mockResolvedValue(undefined);
    (updateDocument as any).mockResolvedValue(undefined);
    (createActivityLog as any).mockResolvedValue(undefined);

    const { resolveEmailLocale } = await import("./email");
    (resolveEmailLocale as any).mockReturnValueOnce("zh-CN");

    await processReminders();

    expect(buildReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ signUrl: expect.stringMatching(/\?lng=zh-CN$/) })
    );
  });

  // AC-S03: en locale が signUrl に反映される
  it("AC-S03: processReminders embeds 'en' locale in signUrl", async () => {
    (getDocumentsNeedingReminder as any).mockResolvedValue([
      { id: 3, title: "EN Doc", userId: 1, organizationId: 10, reminderDays: 3, nextReminderAt: new Date() },
    ]);
    (getUserById as any).mockResolvedValue({ id: 1, name: "Owner", email: "o@example.com" });
    (getPendingSignatureRequests as any).mockResolvedValue([
      { id: 3, signerEmail: "s@example.com", signerName: "S", accessToken: "tok-en", locale: "en" },
    ]);
    (sendEmail as any).mockResolvedValue(undefined);
    (updateDocument as any).mockResolvedValue(undefined);
    (createActivityLog as any).mockResolvedValue(undefined);

    const { resolveEmailLocale } = await import("./email");
    (resolveEmailLocale as any).mockReturnValueOnce("en");

    await processReminders();

    expect(buildReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ signUrl: expect.stringMatching(/\?lng=en$/) })
    );
  });

  // AC-S04: signUrl の形式が /sign/{token}?lng={locale} であることを確認
  it("AC-S04: processReminders signUrl format is /sign/{token}?lng={locale}", async () => {
    (getDocumentsNeedingReminder as any).mockResolvedValue([
      { id: 4, title: "Format Doc", userId: 1, organizationId: 10, reminderDays: 3, nextReminderAt: new Date() },
    ]);
    (getUserById as any).mockResolvedValue({ id: 1, name: "Owner", email: "o@example.com" });
    (getPendingSignatureRequests as any).mockResolvedValue([
      { id: 4, signerEmail: "s@example.com", signerName: "S", accessToken: "my-access-tok", locale: "th" },
    ]);
    (sendEmail as any).mockResolvedValue(undefined);
    (updateDocument as any).mockResolvedValue(undefined);
    (createActivityLog as any).mockResolvedValue(undefined);

    const { resolveEmailLocale } = await import("./email");
    (resolveEmailLocale as any).mockReturnValueOnce("th");

    await processReminders();

    const call = (buildReminderEmail as any).mock.calls[0]?.[0];
    expect(call?.signUrl).toMatch(/https:\/\/app\.example\.com\/sign\/my-access-tok\?lng=th$/);
    // lang と signUrl が一致する
    expect(new URL(call.signUrl).searchParams.get("lng")).toBe(call.lang);
  });
});

// ==================== processIntegrityCheck (H-04) ====================

describe("processIntegrityCheck (H-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs pass message when hash chain is intact", async () => {
    (verifyHashChainIntegrity as any).mockResolvedValue({
      isIntact: true,
      totalRecords: 42,
      verifiedRecords: 42,
      brokenAt: null,
    });

    await processIntegrityCheck();

    expect(verifyHashChainIntegrity).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Hash chain verification passed")
    );
    expect(appendAuditLog).not.toHaveBeenCalled();
  });

  it("logs error and appends audit event when chain is broken", async () => {
    (verifyHashChainIntegrity as any).mockResolvedValue({
      isIntact: false,
      totalRecords: 100,
      verifiedRecords: 57,
      brokenAt: 58,
    });
    (appendAuditLog as any).mockResolvedValue(undefined);

    await processIntegrityCheck();

    expect(verifyHashChainIntegrity).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Hash chain BROKEN")
    );
    expect(appendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "integrity.chain_broken",
        metadata: expect.objectContaining({ brokenAt: 58 }),
      })
    );
  });

  it("handles appendAuditLog failure gracefully when chain is broken", async () => {
    (verifyHashChainIntegrity as any).mockResolvedValue({
      isIntact: false,
      totalRecords: 10,
      verifiedRecords: 5,
      brokenAt: 6,
    });
    (appendAuditLog as any).mockRejectedValue(new Error("DB write failed"));

    await processIntegrityCheck();

    // Should not throw, should log the appendAuditLog failure
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to record breach audit event"),
      expect.any(Error)
    );
  });

  it("handles verifyHashChainIntegrity throwing an error", async () => {
    (verifyHashChainIntegrity as any).mockRejectedValue(new Error("DB connection error"));

    await processIntegrityCheck();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Hash chain verification failed with error"),
      expect.any(Error)
    );
  });

  it("INTEGRITY_CHECK_INTERVAL_MS is 6 hours", () => {
    expect(INTEGRITY_CHECK_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
  });

  it("startScheduler schedules integrity check interval", () => {
    vi.useFakeTimers();
    (getDocumentsNeedingReminder as any).mockResolvedValue([]);
    (getDocumentsNeedingExpiration as any).mockResolvedValue([]);
    (verifyHashChainIntegrity as any).mockResolvedValue({ isIntact: true, totalRecords: 0, verifiedRecords: 0, brokenAt: null });

    startScheduler();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Hash chain integrity check scheduled")
    );

    // Advance 6 hours to trigger integrity check
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.advanceTimersByTime(INTEGRITY_CHECK_INTERVAL_MS);

    expect(verifyHashChainIntegrity).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
