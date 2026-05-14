import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildSignatureRequestEmail,
  buildSignatureCompleteEmail,
  buildAllSignedEmail,
  buildDeclinedEmail,
  buildReminderEmail,
  buildInternalApprovalEmail,
  buildCcNotificationEmail,
  escapeHtml,
  type SupportedLanguage,
} from "./email";

// Mock notifyOwner (used by sendEmail fallback)
const mockNotifyOwner = vi.fn();
vi.mock("./_core/notification", () => ({
  notifyOwner: (...args: any[]) => mockNotifyOwner(...args),
}));

// Mock getDb for logEmail
const mockValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockValues }));
vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    insert: mockInsert,
  })),
}));

vi.mock("../drizzle/schema", () => ({
  emailLogs: {},
}));

const SES_ENV_KEYS = ["AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY", "AWS_SES_REGION", "SES_FROM_EMAIL"];
const SMTP_ENV_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_EMAIL"];

beforeEach(() => {
  vi.clearAllMocks();
  mockNotifyOwner.mockResolvedValue(true);
});

// ==================== fix-quality-improvements: escapeHtml (AC-011) ====================

describe("escapeHtml (AC-011)", () => {
  it("escapes script tags (AC-011)", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('He said "hello"')).toBe("He said &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's a test")).toBe("it&#039;s a test");
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });
});

// ==================== EMAIL TEMPLATE TESTS ====================

describe("buildSignatureRequestEmail", () => {
  it("generates HTML email with correct subject in Japanese", () => {
    const result = buildSignatureRequestEmail({
      signerName: "山田太郎",
      senderName: "田中花子",
      documentTitle: "業務委託契約書",
      signUrl: "https://example.com/sign/abc",
      lang: "ja",
    });
    expect(result.subject).toContain("署名依頼");
    expect(result.subject).toContain("田中花子");
    expect(result.subject).toContain("業務委託契約書");
    expect(result.html).toContain("山田太郎");
    expect(result.html).toContain("田中花子");
    expect(result.html).toContain("https://example.com/sign/abc");
    expect(result.html).toContain("<!DOCTYPE html>");
  });

  it("generates HTML email in English", () => {
    const result = buildSignatureRequestEmail({
      signerName: "John Doe",
      senderName: "Jane Smith",
      documentTitle: "Service Agreement",
      signUrl: "https://example.com/sign/xyz",
      lang: "en",
    });
    expect(result.subject).toContain("Hundredth Sign");
    expect(result.html).toContain("John Doe");
    expect(result.html).toContain("Jane Smith");
    expect(result.html).toContain("REVIEW DOCUMENT");
  });

  it("includes custom message block when provided", () => {
    const result = buildSignatureRequestEmail({
      signerName: "山田太郎",
      senderName: "田中花子",
      documentTitle: "契約書",
      signUrl: "https://example.com/sign/abc",
      message: "お早めにご確認ください",
      lang: "ja",
    });
    expect(result.html).toContain("お早めにご確認ください");
  });

  it("defaults to Japanese when no language specified", () => {
    const result = buildSignatureRequestEmail({
      signerName: "山田太郎",
      senderName: "田中花子",
      documentTitle: "契約書",
      signUrl: "https://example.com/sign/abc",
    });
    expect(result.subject).toContain("署名依頼");
  });

  it("includes sender email when provided", () => {
    const result = buildSignatureRequestEmail({
      signerName: "テスト",
      senderName: "送信者",
      senderEmail: "sender@example.com",
      documentTitle: "文書",
      signUrl: "https://example.com/sign/abc",
      lang: "ja",
    });
    expect(result.html).toContain("sender@example.com");
  });
});

describe("buildSignatureCompleteEmail", () => {
  it("generates signature complete notification", () => {
    const result = buildSignatureCompleteEmail({
      senderName: "田中花子",
      signerName: "山田太郎",
      documentTitle: "契約書",
      dashboardUrl: "https://example.com/dashboard",
      lang: "ja",
    });
    expect(result.subject).toContain("署名完了");
    expect(result.subject).toContain("山田太郎");
    expect(result.html).toContain("https://example.com/dashboard");
  });

  it("M-22: thankYou message uses recipient (document owner) name, not signer name", () => {
    // Owner (田中花子) receives the completion email; signer is 山田太郎.
    // The "ありがとうございます" greeting should address the owner, not the signer.
    const result = buildSignatureCompleteEmail({
      senderName: "田中花子",   // document owner = email recipient
      signerName: "山田太郎",   // signer = displayed as sender in layout
      documentTitle: "契約書",
      dashboardUrl: "https://example.com/dashboard",
      lang: "ja",
    });
    // "田中花子様、ありがとうございます" must appear (recipient name)
    expect(result.html).toContain("田中花子");
    // thankYou should NOT use the signer's name as the greeted recipient
    // The signer name appears in subject/body but not in the thankYou greeting position
    const thankYouIndex = result.html.indexOf("ありがとうございます");
    expect(thankYouIndex).toBeGreaterThan(-1);
    const thankYouSnippet = result.html.substring(thankYouIndex - 80, thankYouIndex + 30);
    expect(thankYouSnippet).toContain("田中花子");
    expect(thankYouSnippet).not.toContain("山田太郎");
  });
});

describe("buildAllSignedEmail", () => {
  it("generates all-signed notification", () => {
    const result = buildAllSignedEmail({
      senderName: "田中花子",
      documentTitle: "契約書",
      downloadUrl: "https://example.com/download",
      lang: "ja",
    });
    expect(result.subject).toContain("全員署名完了");
    expect(result.html).toContain("https://example.com/download");
  });
});

describe("buildDeclinedEmail", () => {
  it("generates declined notification with reason", () => {
    const result = buildDeclinedEmail({
      senderName: "田中花子",
      signerName: "山田太郎",
      documentTitle: "契約書",
      reason: "内容に不備があります",
      dashboardUrl: "https://example.com/dashboard",
      lang: "ja",
    });
    expect(result.subject).toContain("署名拒否");
    expect(result.html).toContain("内容に不備があります");
  });

  it("generates declined notification without reason", () => {
    const result = buildDeclinedEmail({
      senderName: "田中花子",
      signerName: "山田太郎",
      documentTitle: "契約書",
      dashboardUrl: "https://example.com/dashboard",
      lang: "ja",
    });
    expect(result.subject).toContain("署名拒否");
    expect(result.html).not.toContain("拒否理由");
  });
});

describe("buildReminderEmail", () => {
  it("generates reminder notification", () => {
    const result = buildReminderEmail({
      signerName: "山田太郎",
      senderName: "田中花子",
      documentTitle: "契約書",
      signUrl: "https://example.com/sign/abc",
      lang: "ja",
    });
    expect(result.subject).toContain("リマインダー");
    expect(result.html).toContain("https://example.com/sign/abc");
  });
});

describe("buildInternalApprovalEmail", () => {
  it("generates internal approval request email", () => {
    const result = buildInternalApprovalEmail({
      approverName: "佐藤部長",
      senderName: "田中花子",
      documentTitle: "業務委託契約書",
      approveUrl: "https://example.com/approve/token123",
      lang: "ja",
    });
    expect(result.subject).toContain("社内承認依頼");
    expect(result.html).toContain("承認ページを開く");
    expect(result.html).toContain("佐藤部長");
    expect(result.html).toContain("田中花子");
    expect(result.html).toContain("業務委託契約書");
    expect(result.html).toContain("https://example.com/approve/token123");
    expect(result.html).toContain("#D97706"); // amber header color
    expect(result.html).not.toContain("Open approval page");
    expect(result.html).not.toContain("requested internal approval");
  });
});

describe("buildCcNotificationEmail", () => {
  it("builds CC notification email in Japanese", () => {
    const result = buildCcNotificationEmail({
      ccName: "田中花子",
      senderName: "鈴木一郎",
      documentTitle: "業務委託契約書",
      dashboardUrl: "https://app.example.com/dashboard",
      lang: "ja",
    });
    expect(result.subject).toContain("[写し通知]");
    expect(result.subject).toContain("業務委託契約書");
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.html).toContain("田中花子");
    expect(result.html).toContain("鈴木一郎");
    expect(result.html).toContain("業務委託契約書");
    expect(result.html).toContain("https://app.example.com/dashboard");
    expect(result.html).toContain("ダッシュボードを開く");
    expect(result.html).toContain("#6366f1");
  });

  it("builds CC notification email in English", () => {
    const result = buildCcNotificationEmail({
      ccName: "Jane Doe",
      senderName: "John Smith",
      documentTitle: "Service Agreement",
      dashboardUrl: "https://app.example.com/dashboard",
      lang: "en",
    });
    expect(result.subject).toContain("[CC]");
    expect(result.subject).toContain("Service Agreement");
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.html).toContain("Jane Doe");
    expect(result.html).toContain("John Smith");
    expect(result.html).toContain("Service Agreement");
    expect(result.html).toContain("https://app.example.com/dashboard");
    expect(result.html).toContain("Open Dashboard");
  });

  it("defaults to Japanese subject prefix when lang is undefined", () => {
    const result = buildCcNotificationEmail({
      ccName: "User",
      senderName: "Sender",
      documentTitle: "Doc",
      dashboardUrl: "https://example.com",
    });
    // lang=undefined falls back to "ja" (see getTranslation fallback)
    expect(result.subject).toContain("[\u5199\u3057\u901A\u77E5]");
    expect(result.html).toContain("<!DOCTYPE html>");
  });
});

// ==================== MULTI-LANGUAGE SUPPORT ====================

describe("multi-language email support", () => {
  const ALL_LANGUAGES: SupportedLanguage[] = ["ja", "en", "zh", "ko", "fr", "de", "es", "pt", "it", "th", "vi"];

  it("supports 11 languages", () => {
    expect(ALL_LANGUAGES).toHaveLength(11);
  });

  ALL_LANGUAGES.forEach((lang) => {
    it(`generates signature request email in ${lang}`, () => {
      const result = buildSignatureRequestEmail({
        signerName: "Test User",
        senderName: "Sender",
        documentTitle: "Test Document",
        signUrl: "https://example.com/sign/test",
        lang,
      });
      expect(result.subject).toBeTruthy();
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("https://example.com/sign/test");
      expect(result.html).toContain("Test User");
    });

    it(`generates all email types in ${lang}`, () => {
      const request = buildSignatureRequestEmail({
        signerName: "A", senderName: "B", documentTitle: "D", signUrl: "https://x.com", lang,
      });
      const complete = buildSignatureCompleteEmail({
        senderName: "A", signerName: "B", documentTitle: "D", dashboardUrl: "https://x.com", lang,
      });
      const allSigned = buildAllSignedEmail({
        senderName: "A", documentTitle: "D", downloadUrl: "https://x.com", lang,
      });
      const declined = buildDeclinedEmail({
        senderName: "A", signerName: "B", documentTitle: "D", dashboardUrl: "https://x.com", lang,
      });
      const reminder = buildReminderEmail({
        signerName: "A", senderName: "B", documentTitle: "D", signUrl: "https://x.com", lang,
      });

      [request, complete, allSigned, declined, reminder].forEach((email) => {
        expect(email.subject).toBeTruthy();
        expect(email.html).toContain("<!DOCTYPE html>");
      });
    });
  });

  it("generates RTL layout for Arabic language", () => {
    const result = buildSignatureRequestEmail({
      signerName: "A", senderName: "B", documentTitle: "D", signUrl: "https://x.com",
      lang: "ar" as SupportedLanguage,
    });
    expect(result.html).toContain('dir="rtl"');
    expect(result.html).toContain("text-align:right;");
  });

  it("generates LTR layout for English", () => {
    const result = buildSignatureRequestEmail({
      signerName: "A", senderName: "B", documentTitle: "D", signUrl: "https://x.com",
      lang: "en",
    });
    expect(result.html).not.toContain('dir="rtl"');
  });
});

// ==================== EMAIL HTML STRUCTURE ====================

describe("email HTML structure", () => {
  it("contains Hundredth Sign-style header with color", () => {
    const result = buildSignatureRequestEmail({
      signerName: "Test",
      senderName: "Sender",
      documentTitle: "Doc",
      signUrl: "https://example.com",
      lang: "ja",
    });
    expect(result.html).toContain("#10B981");
  });

  it("contains footer with security notice", () => {
    const result = buildSignatureRequestEmail({
      signerName: "Test",
      senderName: "Sender",
      documentTitle: "Doc",
      signUrl: "https://example.com",
      lang: "ja",
    });
    expect(result.html).toContain("このメールを共有しないでください");
    expect(result.html).toContain("Hundredth Sign");
  });

  it("contains CTA button with correct URL", () => {
    const url = "https://example.com/sign/unique-token-123";
    const result = buildSignatureRequestEmail({
      signerName: "Test",
      senderName: "Sender",
      documentTitle: "Doc",
      signUrl: url,
      lang: "ja",
    });
    expect(result.html).toContain(`href="${url}"`);
  });

  it("uses different header colors for different email types", () => {
    const request = buildSignatureRequestEmail({
      signerName: "A", senderName: "B", documentTitle: "D", signUrl: "https://x.com", lang: "ja",
    });
    const complete = buildSignatureCompleteEmail({
      senderName: "A", signerName: "B", documentTitle: "D", dashboardUrl: "https://x.com", lang: "ja",
    });
    const allSigned = buildAllSignedEmail({
      senderName: "A", documentTitle: "D", downloadUrl: "https://x.com", lang: "ja",
    });
    const declined = buildDeclinedEmail({
      senderName: "A", signerName: "B", documentTitle: "D", dashboardUrl: "https://x.com", lang: "ja",
    });

    expect(request.html).toContain("#10B981");
    expect(complete.html).toContain("#4C00FF");
    expect(allSigned.html).toContain("#16a34a");
    expect(declined.html).toContain("#dc2626");
  });

  it("does not include hosted pricing or promotional banner markup", () => {
    const result = buildSignatureRequestEmail({
      signerName: "Test",
      senderName: "Sender",
      documentTitle: "Doc",
      signUrl: "https://example.com",
      lang: "ja",
    });
    expect(result.html).not.toContain("plg-banner");
    expect(result.html).not.toContain("pricing");
  });
});

// ==================== sendEmail ====================
// The top-level email module is loaded WITHOUT AWS env vars,
// so sendEmail uses the notifyOwner fallback path.

describe("sendEmail (notifyOwner fallback)", () => {
  // Import sendEmail dynamically to keep module caching clear
  let sendEmail: typeof import("./email").sendEmail;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    // Save and clear transport env vars so the fallback path is exercised
    for (const key of [...SES_ENV_KEYS, ...SMTP_ENV_KEYS]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    vi.resetModules();
    // Re-register mocks after resetModules
    vi.doMock("./_core/notification", () => ({
      notifyOwner: (...args: any[]) => mockNotifyOwner(...args),
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn(() => ({
        insert: mockInsert,
      })),
    }));
    vi.doMock("../drizzle/schema", () => ({
      emailLogs: {},
    }));
    sendEmail = (await import("./email")).sendEmail;
  });

  afterEach(() => {
    // Restore AWS SES env vars
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val !== undefined) process.env[key] = val;
      else delete process.env[key];
    }
    vi.resetModules();
  });

  it("sends via notifyOwner when SES not configured", async () => {
    const result = await sendEmail({
      to: "test@example.com",
      toName: "テスト",
      subject: "テスト件名",
      html: "<p>テスト本文</p>",
      type: "signature_request",
    });
    expect(result).toBe(true);
    expect(mockNotifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("テスト件名"),
        content: expect.stringContaining("テスト"),
      }),
    );
  });

  it("returns false when notifyOwner fails", async () => {
    mockNotifyOwner.mockResolvedValueOnce(false);
    const result = await sendEmail({
      to: "test@example.com",
      subject: "テスト",
      html: "<p>テスト</p>",
      type: "signature_request",
    });
    expect(result).toBe(false);
  });

  it("returns false when notifyOwner throws", async () => {
    mockNotifyOwner.mockRejectedValueOnce(new Error("Notification API down"));
    const result = await sendEmail({
      to: "test@example.com",
      subject: "テスト",
      html: "<p>テスト</p>",
      type: "signature_request",
    });
    expect(result).toBe(false);
  });

  it("logs email on success", async () => {
    await sendEmail({
      to: "test@example.com",
      subject: "テスト",
      html: "<p>テスト</p>",
      type: "signature_request",
      documentId: 1,
    });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("logs email as failed on notification failure", async () => {
    mockNotifyOwner.mockResolvedValueOnce(false);
    await sendEmail({
      to: "test@example.com",
      subject: "テスト",
      html: "<p>テスト</p>",
      type: "signature_request",
    });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("handles logEmail failure gracefully", async () => {
    mockInsert.mockImplementationOnce(() => {
      throw new Error("DB error");
    });
    const result = await sendEmail({
      to: "test@example.com",
      subject: "テスト",
      html: "<p>テスト</p>",
      type: "signature_request",
    });
    // Should not crash even when logging fails
    expect(result).toBe(true);
  });

  it("sends email with all optional fields", async () => {
    const result = await sendEmail({
      to: "test@example.com",
      toName: "テスト太郎",
      subject: "完全テスト",
      html: "<p>テスト</p>",
      type: "all_signed",
      documentId: 42,
      signatureRequestId: 99,
    });
    expect(result).toBe(true);
  });

  it("strips HTML for notifyOwner content", async () => {
    await sendEmail({
      to: "test@example.com",
      subject: "テスト",
      html: '<p>Hello <strong>World</strong></p><br><a href="https://example.com">Link</a>',
      type: "signature_request",
    });
    expect(mockNotifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Hello World"),
      }),
    );
  });

  it("uses toName in fallback content when available", async () => {
    await sendEmail({
      to: "test@example.com",
      toName: "佐藤一郎",
      subject: "テスト",
      html: "<p>テスト</p>",
      type: "signature_request",
    });
    expect(mockNotifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("佐藤一郎"),
      }),
    );
  });
});

// ==================== SMTP Transport Path Tests ====================

describe("sendEmail with SMTP transport", () => {
  afterEach(() => {
    for (const key of [...SES_ENV_KEYS, ...SMTP_ENV_KEYS]) {
      delete process.env[key];
    }
    vi.resetModules();
  });

  it("sends via SMTP when SMTP_HOST is set", async () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_FROM_EMAIL = "Hundredth Sign <noreply@localhost>";

    vi.resetModules();

    const localMockSendMail = vi.fn().mockResolvedValue({ messageId: "smtp-test-id" });
    const localMockCreateTransport = vi.fn().mockReturnValue({ sendMail: localMockSendMail });
    const localMockNotify = vi.fn();
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: localMockCreateTransport,
      },
    }));
    vi.doMock("./_core/notification", () => ({
      notifyOwner: localMockNotify,
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn(() => ({
        insert: vi.fn(() => ({ values: vi.fn() })),
      })),
    }));
    vi.doMock("../drizzle/schema", () => ({
      emailLogs: {},
    }));

    const { sendEmail: freshSendEmail } = await import("./email");
    const result = await freshSendEmail({
      to: "test@example.com",
      subject: "SMTP test",
      html: "<p>Hello <strong>SMTP</strong></p>",
      type: "signature_request",
    });

    expect(result).toBe(true);
    expect(localMockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "127.0.0.1",
        port: 1025,
        secure: false,
      }),
    );
    expect(localMockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Hundredth Sign <noreply@localhost>",
        to: "test@example.com",
        subject: "SMTP test",
        html: "<p>Hello <strong>SMTP</strong></p>",
        text: "Hello SMTP",
      }),
    );
    expect(localMockNotify).not.toHaveBeenCalled();
  });

  it("returns false when SMTP send fails and does not fall through", async () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";

    vi.resetModules();

    const localMockSendMail = vi.fn().mockRejectedValue(new Error("SMTP unavailable"));
    const localMockNotify = vi.fn();
    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: vi.fn().mockReturnValue({ sendMail: localMockSendMail }),
      },
    }));
    vi.doMock("./_core/notification", () => ({
      notifyOwner: localMockNotify,
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn(() => ({
        insert: vi.fn(() => ({ values: vi.fn() })),
      })),
    }));
    vi.doMock("../drizzle/schema", () => ({
      emailLogs: {},
    }));

    const { sendEmail: freshSendEmail } = await import("./email");
    const result = await freshSendEmail({
      to: "test@example.com",
      subject: "SMTP fail",
      html: "<p>fail</p>",
      type: "signature_request",
    });

    expect(result).toBe(false);
    expect(localMockSendMail).toHaveBeenCalledTimes(1);
    expect(localMockNotify).not.toHaveBeenCalled();
  });
});

// ==================== AWS SES Transport Path Tests ====================

describe("sendEmail with AWS SES transport", () => {
  beforeEach(() => {
    for (const key of SMTP_ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("sends via SES when AWS credentials are set", async () => {
    process.env.AWS_SES_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SES_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.AWS_SES_REGION = "ap-northeast-1";
    process.env.SES_FROM_EMAIL = "Hundredth Sign <noreply@test.com>";

    vi.resetModules();

    const localMockSend = vi.fn().mockResolvedValue({ MessageId: "test-ses-id" });
    vi.doMock("@aws-sdk/client-ses", () => ({
      SESClient: vi.fn().mockImplementation(() => ({
        send: localMockSend,
      })),
      SendEmailCommand: vi.fn().mockImplementation((input: any) => input),
    }));
    vi.doMock("./_core/notification", () => ({
      notifyOwner: vi.fn(),
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn(() => ({
        insert: vi.fn(() => ({ values: vi.fn() })),
      })),
    }));
    vi.doMock("../drizzle/schema", () => ({
      emailLogs: {},
    }));

    const { sendEmail: freshSendEmail } = await import("./email");
    const result = await freshSendEmail({
      to: "test@example.com",
      subject: "SESテスト",
      html: "<p>SES送信テスト</p>",
      type: "signature_request",
    });
    expect(result).toBe(true);
    expect(localMockSend).toHaveBeenCalledTimes(1);

    delete process.env.AWS_SES_ACCESS_KEY_ID;
    delete process.env.AWS_SES_SECRET_ACCESS_KEY;
    delete process.env.AWS_SES_REGION;
    delete process.env.SES_FROM_EMAIL;
    vi.resetModules();
  });

  it("returns false when SES send fails (does not fall through to notifyOwner)", async () => {
    process.env.AWS_SES_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SES_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.AWS_SES_REGION = "ap-northeast-1";

    vi.resetModules();

    const localMockSend = vi.fn().mockRejectedValue(new Error("SES send failed"));
    const localMockNotify = vi.fn();
    vi.doMock("@aws-sdk/client-ses", () => ({
      SESClient: vi.fn().mockImplementation(() => ({
        send: localMockSend,
      })),
      SendEmailCommand: vi.fn().mockImplementation((input: any) => input),
    }));
    vi.doMock("./_core/notification", () => ({
      notifyOwner: localMockNotify,
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn(() => ({
        insert: vi.fn(() => ({ values: vi.fn() })),
      })),
    }));
    vi.doMock("../drizzle/schema", () => ({
      emailLogs: {},
    }));

    const { sendEmail: freshSendEmail } = await import("./email");
    const result = await freshSendEmail({
      to: "test@example.com",
      subject: "SES失敗テスト",
      html: "<p>失敗テスト</p>",
      type: "signature_request",
    });
    expect(result).toBe(false);
    // Should NOT fall through to notifyOwner
    expect(localMockNotify).not.toHaveBeenCalled();

    delete process.env.AWS_SES_ACCESS_KEY_ID;
    delete process.env.AWS_SES_SECRET_ACCESS_KEY;
    delete process.env.AWS_SES_REGION;
    vi.resetModules();
  });

  it("logs email on SES success", async () => {
    process.env.AWS_SES_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SES_SECRET_ACCESS_KEY = "test-secret-key";

    vi.resetModules();

    const localMockInsert = vi.fn(() => ({ values: vi.fn() }));
    vi.doMock("@aws-sdk/client-ses", () => ({
      SESClient: vi.fn().mockImplementation(() => ({
        send: vi.fn().mockResolvedValue({ MessageId: "test" }),
      })),
      SendEmailCommand: vi.fn().mockImplementation((input: any) => input),
    }));
    vi.doMock("./_core/notification", () => ({
      notifyOwner: vi.fn(),
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn(() => ({
        insert: localMockInsert,
      })),
    }));
    vi.doMock("../drizzle/schema", () => ({ emailLogs: {} }));

    const { sendEmail: freshSendEmail } = await import("./email");
    await freshSendEmail({
      to: "test@example.com",
      subject: "テスト",
      html: "<p>テスト</p>",
      type: "signature_request",
    });
    expect(localMockInsert).toHaveBeenCalled();

    delete process.env.AWS_SES_ACCESS_KEY_ID;
    delete process.env.AWS_SES_SECRET_ACCESS_KEY;
    vi.resetModules();
  });

  it("logs email as failed on SES error", async () => {
    process.env.AWS_SES_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SES_SECRET_ACCESS_KEY = "test-secret-key";

    vi.resetModules();

    const localMockInsert = vi.fn(() => ({ values: vi.fn() }));
    vi.doMock("@aws-sdk/client-ses", () => ({
      SESClient: vi.fn().mockImplementation(() => ({
        send: vi.fn().mockRejectedValue(new Error("SES fail")),
      })),
      SendEmailCommand: vi.fn().mockImplementation((input: any) => input),
    }));
    vi.doMock("./_core/notification", () => ({
      notifyOwner: vi.fn(),
    }));
    vi.doMock("./db", () => ({
      getDb: vi.fn(() => ({
        insert: localMockInsert,
      })),
    }));
    vi.doMock("../drizzle/schema", () => ({ emailLogs: {} }));

    const { sendEmail: freshSendEmail } = await import("./email");
    await freshSendEmail({
      to: "test@example.com",
      subject: "テスト",
      html: "<p>テスト</p>",
      type: "signature_request",
    });
    expect(localMockInsert).toHaveBeenCalled();

    delete process.env.AWS_SES_ACCESS_KEY_ID;
    delete process.env.AWS_SES_SECRET_ACCESS_KEY;
    vi.resetModules();
  });

  it("caches SES client on second call", async () => {
    process.env.AWS_SES_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SES_SECRET_ACCESS_KEY = "test-secret-key";

    vi.resetModules();

    const mockSESConstructor = vi.fn().mockImplementation(() => ({
      send: vi.fn().mockResolvedValue({ MessageId: "test" }),
    }));
    vi.doMock("@aws-sdk/client-ses", () => ({
      SESClient: mockSESConstructor,
      SendEmailCommand: vi.fn().mockImplementation((input: any) => input),
    }));
    vi.doMock("./_core/notification", () => ({ notifyOwner: vi.fn() }));
    vi.doMock("./db", () => ({ getDb: vi.fn(() => ({ insert: vi.fn(() => ({ values: vi.fn() })) })) }));
    vi.doMock("../drizzle/schema", () => ({ emailLogs: {} }));

    const { sendEmail: freshSendEmail } = await import("./email");
    await freshSendEmail({ to: "a@b.com", subject: "1", html: "<p>1</p>", type: "signature_request" });
    await freshSendEmail({ to: "a@b.com", subject: "2", html: "<p>2</p>", type: "reminder" });

    // SESClient constructor called only once (cached)
    expect(mockSESConstructor).toHaveBeenCalledTimes(1);

    delete process.env.AWS_SES_ACCESS_KEY_ID;
    delete process.env.AWS_SES_SECRET_ACCESS_KEY;
    vi.resetModules();
  });
});

// ==================== logEmail edge cases ====================

describe("logEmail edge cases", () => {
  it("handles getDb returning null without crashing", async () => {
    vi.resetModules();

    vi.doMock("@aws-sdk/client-ses", () => ({
      SESClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
      SendEmailCommand: vi.fn().mockImplementation((input: any) => input),
    }));
    const localNotify = vi.fn().mockResolvedValue(true);
    vi.doMock("./_core/notification", () => ({ notifyOwner: localNotify }));
    vi.doMock("./db", () => ({ getDb: vi.fn().mockResolvedValue(null) }));
    vi.doMock("../drizzle/schema", () => ({ emailLogs: {} }));

    const { sendEmail: freshSendEmail } = await import("./email");
    const result = await freshSendEmail({
      to: "test@example.com",
      subject: "テスト",
      html: "<p>テスト</p>",
      type: "signature_request",
    });
    expect(result).toBe(true);

    vi.resetModules();
  });
});

describe("escapeHtml (fix-email-notification AC-008)", () => {
  it("escapes script tags (AC-005)", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("escapes attribute injection vectors", () => {
    expect(escapeHtml('"><img src=x onerror=alert(1)>')).toBe(
      "&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("AT&T & More")).toBe("AT&amp;T &amp; More");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's fine")).toBe("it&#039;s fine");
  });

  it("leaves safe text unchanged", () => {
    expect(escapeHtml("Safe text 123")).toBe("Safe text 123");
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
});

// ==================== CULTURAL GREETING TESTS ====================

describe("cultural greeting formatting", () => {
  it("AC-001: Japanese greeting includes 様 honorific", () => {
    const result = buildSignatureRequestEmail({
      signerName: "山田太郎",
      senderName: "田中花子",
      documentTitle: "契約書",
      signUrl: "https://example.com/sign/abc",
      lang: "ja",
    });
    expect(result.html).toContain("山田太郎様");
  });

  it("AC-002: English greeting includes Dear prefix", () => {
    const result = buildSignatureRequestEmail({
      signerName: "John Doe",
      senderName: "Jane Smith",
      documentTitle: "Agreement",
      signUrl: "https://example.com/sign/abc",
      lang: "en",
    });
    expect(result.html).toContain("Dear John Doe,");
  });

  it("AC-003: Thai greeting includes คุณ honorific before name", () => {
    const result = buildSignatureRequestEmail({
      signerName: "สมชาย",
      senderName: "สมหญิง",
      documentTitle: "สัญญา",
      signUrl: "https://example.com/sign/abc",
      lang: "th",
    });
    expect(result.html).toContain("คุณสมชาย");
  });

  it("AC-004: Korean greeting includes 님께 suffix after name", () => {
    const result = buildSignatureRequestEmail({
      signerName: "김철수",
      senderName: "이영희",
      documentTitle: "계약서",
      signUrl: "https://example.com/sign/abc",
      lang: "ko",
    });
    expect(result.html).toContain("김철수님께");
  });

  it("AC-005: Hindi greeting includes जी suffix after name", () => {
    const result = buildSignatureRequestEmail({
      signerName: "राम",
      senderName: "सीता",
      documentTitle: "दस्तावेज़",
      signUrl: "https://example.com/sign/abc",
      lang: "hi",
    });
    expect(result.html).toContain("राम जी,");
  });

  it("AC-006: Thai thankYou includes คุณ honorific", () => {
    const result = buildSignatureRequestEmail({
      signerName: "สมชาย",
      senderName: "สมหญิง",
      documentTitle: "สัญญา",
      signUrl: "https://example.com/sign/abc",
      lang: "th",
    });
    expect(result.html).toContain("ขอบคุณคุณสมชาย");
  });

  it("AC-007: Korean thankYou includes 님 suffix, name comes first", () => {
    const result = buildSignatureRequestEmail({
      signerName: "김철수",
      senderName: "이영희",
      documentTitle: "계약서",
      signUrl: "https://example.com/sign/abc",
      lang: "ko",
    });
    expect(result.html).toContain("김철수님, 감사합니다");
  });

  it("AC-008: Hindi thankYou includes जी suffix, name comes first", () => {
    const result = buildSignatureRequestEmail({
      signerName: "राम",
      senderName: "सीता",
      documentTitle: "दस्तावेज़",
      signUrl: "https://example.com/sign/abc",
      lang: "hi",
    });
    expect(result.html).toContain("राम जी, धन्यवाद");
  });

  it("AC-009: Indonesian CC notification uses translated subject prefix", () => {
    const result = buildCcNotificationEmail({
      ccName: "Budi",
      senderName: "Siti",
      documentTitle: "Kontrak",
      dashboardUrl: "https://example.com/dashboard",
      lang: "id",
    });
    expect(result.subject).toContain("[Salinan]");
    expect(result.html).toContain("Buka dasbor");
  });

  it("AC-012: greeting XSS safety — escapeHtml on name is preserved (no double-escape)", () => {
    const result = buildSignatureRequestEmail({
      signerName: "<script>",
      senderName: "Sender",
      documentTitle: "Doc",
      signUrl: "https://example.com",
      lang: "en",
    });
    // name is escaped at layout level; greeting wraps it
    expect(result.html).toContain("&lt;script&gt;");
    // must NOT double-escape (should not contain &amp;lt;)
    expect(result.html).not.toContain("&amp;lt;");
  });
});

// ==================== fix-message-from-sender ====================

describe("fix-message-from-sender: newline→br conversion (AC-002, AC-003)", () => {
  it("AC-002: newlines in message are converted to <br> tags in email HTML", () => {
    const result = buildSignatureRequestEmail({
      signerName: "山田太郎",
      senderName: "田中花子",
      documentTitle: "契約書",
      signUrl: "https://example.com/sign/abc",
      message: "1行目\n2行目\n3行目",
      lang: "ja",
    });
    expect(result.html).toContain("1行目<br>2行目<br>3行目");
  });

  it("AC-003: XSS in message is escaped before newline→br conversion", () => {
    const result = buildSignatureRequestEmail({
      signerName: "Test",
      senderName: "Sender",
      documentTitle: "Doc",
      signUrl: "https://example.com/sign/abc",
      message: "line1\n<script>alert(1)</script>\nline2",
      lang: "ja",
    });
    // Script must be escaped
    expect(result.html).toContain("&lt;script&gt;");
    // Newlines must still become <br>
    expect(result.html).toContain("<br>");
    // Must not contain raw script tag
    expect(result.html).not.toContain("<script>alert(1)</script>");
  });

  it("declined reason newlines are converted to <br> tags", () => {
    const result = buildDeclinedEmail({
      senderName: "田中花子",
      signerName: "山田太郎",
      documentTitle: "契約書",
      reason: "理由1\n理由2",
      dashboardUrl: "https://example.com/dashboard",
      lang: "ja",
    });
    expect(result.html).toContain("理由1<br>理由2");
  });
});

describe("fix-message-from-sender: RTL message block (AC-005, AC-006, AC-007, AC-008)", () => {
  it("AC-005: Arabic signature request email has border-right in message block", () => {
    const result = buildSignatureRequestEmail({
      signerName: "أحمد",
      senderName: "محمد",
      documentTitle: "وثيقة",
      signUrl: "https://example.com/sign/abc",
      message: "رسالة من المرسل",
      lang: "ar" as SupportedLanguage,
    });
    expect(result.html).toContain("border-right:3px solid #4C00FF");
    expect(result.html).not.toContain("border-left:3px solid #4C00FF");
  });

  it("AC-006: Arabic message block td has text-align:right", () => {
    const result = buildSignatureRequestEmail({
      signerName: "Test",
      senderName: "Sender",
      documentTitle: "Doc",
      signUrl: "https://example.com/sign/abc",
      message: "test message",
      lang: "ar" as SupportedLanguage,
    });
    // The message block td should have text-align:right
    const msgBlockIndex = result.html.indexOf("border-right:3px solid #4C00FF");
    const tdBefore = result.html.lastIndexOf("<td", msgBlockIndex);
    const tdSnippet = result.html.substring(tdBefore, msgBlockIndex + 30);
    expect(tdSnippet).toContain("text-align:right;");
  });

  it("AC-007: Japanese email keeps border-left (no regression)", () => {
    const result = buildSignatureRequestEmail({
      signerName: "山田太郎",
      senderName: "田中花子",
      documentTitle: "契約書",
      signUrl: "https://example.com/sign/abc",
      message: "テストメッセージ",
      lang: "ja",
    });
    expect(result.html).toContain("border-left:3px solid #4C00FF");
    expect(result.html).not.toContain("border-right:3px solid #4C00FF");
  });

  it("AC-008: Arabic declined email has border-right in reason block", () => {
    const result = buildDeclinedEmail({
      senderName: "Sender",
      signerName: "Signer",
      documentTitle: "Doc",
      reason: "سبب الرفض",
      dashboardUrl: "https://example.com/dashboard",
      lang: "ar" as SupportedLanguage,
    });
    expect(result.html).toContain("border-right:3px solid #dc2626");
    expect(result.html).not.toContain("border-left:3px solid #dc2626");
  });

  it("English email keeps border-left in message block (no regression)", () => {
    const result = buildSignatureRequestEmail({
      signerName: "John",
      senderName: "Jane",
      documentTitle: "Contract",
      signUrl: "https://example.com/sign/abc",
      message: "Please sign this",
      lang: "en",
    });
    expect(result.html).toContain("border-left:3px solid #4C00FF");
    expect(result.html).not.toContain("border-right:3px solid #4C00FF");
  });
});
