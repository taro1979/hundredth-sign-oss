import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ==================== MOCKS ====================

vi.mock("./_core/env", () => ({
  ENV: {
    appUrl: "https://test.example.com",
    appId: "test-app",
    cookieSecret: "test-secret-key-minimum-32-chars!!",
    databaseUrl: "",
    isProduction: false,
    trustProxy: "false",
    forgeApiUrl: "",
    forgeApiKey: "",
  },
}));

vi.mock("./db", () => ({
  // getDb for transaction / direct SQL
  getDb: vi.fn().mockResolvedValue({
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      }),
    }),
  }),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
  getUserById: vi.fn().mockResolvedValue({ id: 1, openId: "test", name: "テスト", email: "test@example.com", isSuperAdmin: false }),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  createDocument: vi.fn().mockResolvedValue(1),
  getDocumentsByOrg: vi.fn().mockResolvedValue([]),
  getDocumentsByMultipleOrgs: vi.fn().mockResolvedValue([]),
  getDocumentById: vi.fn().mockResolvedValue({
    id: 1, userId: 1, title: "テスト文書", status: "draft",
    fileUrl: "https://example.com/test.pdf", fileKey: "test-key",
    pageCount: 3, sequentialRouting: false, organizationId: 100,
    createdAt: new Date(), updatedAt: new Date(),
  }),
  updateDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  upsertSignatureFields: vi.fn().mockResolvedValue(undefined),
  getSignatureFieldsByDocument: vi.fn().mockResolvedValue([]),
  createSignatureRequest: vi.fn().mockResolvedValue(1),
  createSignatureRequestsBulk: vi.fn().mockResolvedValue(undefined),
  getSignatureRequestsByDocument: vi.fn().mockResolvedValue([]),
  getSignatureRequestsByEmail: vi.fn().mockResolvedValue([]),
  getSignatureRequestById: vi.fn().mockResolvedValue(null),
  getSignatureRequestByToken: vi.fn().mockResolvedValue(null),
  updateSignatureRequest: vi.fn().mockResolvedValue(undefined),
  checkAllSignersSigned: vi.fn().mockResolvedValue(false),
  getNextPendingSigner: vi.fn().mockResolvedValue(null),
  deleteSignatureRequestsByDocument: vi.fn().mockResolvedValue(undefined),
  createTemplate: vi.fn().mockResolvedValue(1),
  getTemplatesByOrg: vi.fn().mockResolvedValue([]),
  getTemplateById: vi.fn().mockResolvedValue({
    id: 1, userId: 1, title: "テスト", description: null,
    fileUrl: "https://example.com/template.pdf", fileKey: "tpl-key",
    isPublic: false, category: null, usageCount: 0, pageCount: 3,
    createdAt: new Date(), updatedAt: new Date(),
  }),
  getPublicTemplates: vi.fn().mockResolvedValue([]),
  updateTemplate: vi.fn().mockResolvedValue(undefined),
  deleteTemplate: vi.fn().mockResolvedValue(undefined),
  incrementTemplateUsage: vi.fn().mockResolvedValue(undefined),
  upsertTemplateFields: vi.fn().mockResolvedValue(undefined),
  getTemplateFieldsByTemplate: vi.fn().mockResolvedValue([]),
  deepCopyTemplateToDocument: vi.fn().mockResolvedValue(1),
  getContactsByOrg: vi.fn().mockResolvedValue([]),
  getContactById: vi.fn().mockResolvedValue({ id: 1, userId: 1, name: "連絡先", email: "contact@example.com" }),
  createContact: vi.fn().mockResolvedValue(1),
  updateContact: vi.fn().mockResolvedValue(undefined),
  deleteContact: vi.fn().mockResolvedValue(undefined),
  createActivityLog: vi.fn().mockResolvedValue(undefined),
  getActivityLogsByDocument: vi.fn().mockResolvedValue([]),
  getRecentActivityByOrg: vi.fn().mockResolvedValue([]),
  getPublishedFaqs: vi.fn().mockResolvedValue([]),
  createFaq: vi.fn().mockResolvedValue(1),
  updateFaq: vi.fn().mockResolvedValue(undefined),
  deleteFaq: vi.fn().mockResolvedValue(undefined),
  createInquiry: vi.fn().mockResolvedValue(1),
  getInquiries: vi.fn().mockResolvedValue([]),
  updateInquiryStatus: vi.fn().mockResolvedValue(undefined),
  createEmailLog: vi.fn().mockResolvedValue(undefined),
  getDashboardStatsByOrg: vi.fn().mockResolvedValue({ totalDocuments: 0, pendingSignatures: 0, completedDocuments: 0, sentDocuments: 0, declinedDocuments: 0, draftDocuments: 0 }),
  getDocumentDetailByToken: vi.fn().mockResolvedValue(undefined),
  claimSignatureRequestsByEmail: vi.fn().mockResolvedValue(0),
  claimInternalApprovalsByEmail: vi.fn().mockResolvedValue(0),
  getSignatureInboxEntriesForUser: vi.fn().mockResolvedValue([]),
  getInternalApprovalInboxEntriesForUser: vi.fn().mockResolvedValue([]),
  getPendingSignatureRequests: vi.fn().mockResolvedValue([]),
  getDocumentsByMember: vi.fn().mockResolvedValue([]),
  getCategoriesByOrg: vi.fn().mockResolvedValue([]),
  createCategory: vi.fn().mockResolvedValue({ id: 1 }),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  getGroupsByOrg: vi.fn().mockResolvedValue([]),
  createGroup: vi.fn().mockResolvedValue({ id: 1 }),
  updateGroup: vi.fn().mockResolvedValue(undefined),
  deleteGroup: vi.fn().mockResolvedValue(undefined),
  getGroupMembers: vi.fn().mockResolvedValue([]),
  addContactToGroup: vi.fn().mockResolvedValue(null),
  removeContactFromGroup: vi.fn().mockResolvedValue(undefined),
  getContactsByGroup: vi.fn().mockResolvedValue([]),
  getGroupsForContact: vi.fn().mockResolvedValue([]),
  getOrganizationsByUser: vi.fn().mockResolvedValue([]),
  getOrganizationById: vi.fn().mockResolvedValue({ id: 100, name: "テスト組織", isActive: true }),
  getOrganizationBySlug: vi.fn().mockResolvedValue(null),
  createOrganization: vi.fn().mockResolvedValue({ id: 1, name: "テスト組織", slug: "test-org" }),
  updateOrganization: vi.fn().mockResolvedValue(undefined),
  getMembership: vi.fn().mockResolvedValue({ id: 1, userId: 1, organizationId: 100, role: "owner", isActive: true, createdAt: new Date(), updatedAt: new Date() }),
  getMembershipsByOrg: vi.fn().mockResolvedValue([]),
  createMembership: vi.fn().mockResolvedValue(1),
  deactivateMembership: vi.fn().mockResolvedValue(undefined),
  updateMembershipRole: vi.fn().mockResolvedValue(undefined),
  getInternalApprovalsByDocument: vi.fn().mockResolvedValue([]),
  getInternalApprovalByToken: vi.fn().mockResolvedValue(null),
  updateInternalApproval: vi.fn().mockResolvedValue(undefined),
  deleteInternalApprovalsByDocument: vi.fn().mockResolvedValue(undefined),
  createInternalApprovalsBulk: vi.fn().mockResolvedValue(undefined),
  getNextPendingApprover: vi.fn().mockResolvedValue(null),
  checkAllApproversApproved: vi.fn().mockResolvedValue(false),
  getOrganizationById: vi.fn().mockResolvedValue({ id: 100, isActive: true }),
  // IP Restriction (default: no restrictions)
  getActiveAllowedIps: vi.fn().mockResolvedValue([]),
  createAllowedIp: vi.fn().mockResolvedValue({ id: 1, organizationId: 100, ipAddress: "192.168.1.1", label: null, isActive: true, createdByUserId: 1, createdAt: new Date(), updatedAt: new Date() }),
  deactivateAllowedIp: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://example.com/file.pdf", key: "test-key" }),
}));
vi.mock("./email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  buildSignatureRequestEmail: vi.fn().mockReturnValue({ subject: "署名依頼", html: "<p>test</p>" }),
  buildSignatureCompleteEmail: vi.fn().mockReturnValue({ subject: "署名完了", html: "<p>test</p>" }),
  buildAllSignedEmail: vi.fn().mockReturnValue({ subject: "全署名完了", html: "<p>test</p>" }),
  buildCcNotificationEmail: vi.fn().mockReturnValue({ subject: "[写し通知] テスト文書", html: "<p>cc-test</p>" }),
  buildDeclinedEmail: vi.fn().mockReturnValue({ subject: "署名拒否", html: "<p>test</p>" }),
  buildInternalApprovalEmail: vi.fn().mockReturnValue({ subject: "approval", html: "<p>approval</p>" }),
  buildReminderEmail: vi.fn().mockReturnValue({ subject: "リマインダー", html: "<p>reminder</p>" }),
  resolveEmailLocale: vi.fn().mockImplementation((locale?: string) => locale || "ja"),
}));
vi.mock("./pdf", () => ({
  validatePdf: vi.fn().mockResolvedValue({ valid: true, pageCount: 3 }),
  embedSignaturesIntoPdf: vi.fn().mockResolvedValue(Buffer.from("signed-pdf")),
  generateSignedPdf: vi.fn().mockResolvedValue({ url: "https://example.com/signed.pdf", key: "signed-key" }),
  appendCompletionCertificate: vi.fn().mockResolvedValue(Buffer.from("signed-pdf-with-cert")),
  applyPdfPermissionLock: vi.fn().mockResolvedValue({ buffer: Buffer.from("locked-pdf"), locked: true }),
  SIGNATURE_FONTS: [{ id: "dancing-script", name: "Dancing Script", cssFamily: "'Dancing Script', cursive" }],
}));
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));
vi.mock("./stampService", () => ({
  generateStampDataUrl: vi.fn().mockReturnValue("data:image/png;base64,stamp-test"),
}));
vi.mock("./auditLog", () => ({
  appendAuditLog: vi.fn().mockResolvedValue({ id: 1, recordHash: "abc123" }),
  getAuditLogsByEntity: vi.fn().mockResolvedValue([]),
  getAuditLogsByOrg: vi.fn().mockResolvedValue([]),
  getAuditLogCount: vi.fn().mockResolvedValue(42),
  getAuditLogsPaginated: vi.fn().mockResolvedValue({ logs: [], total: 0 }),
  verifyHashChainIntegrity: vi.fn().mockResolvedValue({ totalRecords: 42, verifiedRecords: 42, brokenAt: null, isIntact: true }),
}));
vi.mock("./platformSignature", () => ({
  signPdfWithPlatformKey: vi.fn().mockResolvedValue(Buffer.from("platform-signed-pdf")),
  getCertificateInfo: vi.fn().mockReturnValue({
    subject: "CN=Hundredth Sign Platform",
    serialNumber: "1234567890",
    fingerprint: "AA:BB:CC:DD",
    notBefore: "2026-01-01T00:00:00Z",
    notAfter: "2031-01-01T00:00:00Z",
    isAutoGenerated: true,
  }),
}));
vi.mock("./wormStorage", () => ({
  wormStorePdf: vi.fn().mockResolvedValue({ url: "https://example.com/worm/test.pdf", key: "worm/test.pdf", contentHash: "sha256-abc" }),
}));
vi.mock("@shared/validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/validation")>();
  return { ...actual, validatePdfMagicNumber: vi.fn().mockReturnValue({ valid: true }) };
});

// ==================== HELPERS ====================
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
function createUserCtx(isSuperAdmin = false): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1, openId: "test-user", email: "test@example.com", name: "テストユーザー",
    loginMethod: "manus", isSuperAdmin, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: { "x-organization-id": "100" }, socket: { remoteAddress: "127.0.0.1" } } as any,
    res: { clearCookie: vi.fn() } as any,
  };
  return { ctx };
}
function createPubCtx(headers: Record<string, any> = {}): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers, socket: { remoteAddress: "127.0.0.1" } } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

// Helper: reset all mocks and restore default values
// vi.clearAllMocks() does NOT clear mockResolvedValueOnce queue,
// so unconsumed values from previous tests leak into subsequent tests.
// This helper uses mockReset() on critical mocks to clear their queues,
// then re-applies the default mockResolvedValue.
async function resetMocksToDefaults() {
  const db = await import("./db");
  // Reset critical mocks that frequently have unconsumed mockResolvedValueOnce
  (db.getMembership as any).mockReset().mockResolvedValue({ id: 1, userId: 1, organizationId: 100, role: "owner", isActive: true, createdAt: new Date(), updatedAt: new Date() });
  (db.getDocumentById as any).mockReset().mockResolvedValue({
    id: 1, userId: 1, title: "テスト文書", status: "draft",
    fileUrl: "https://example.com/test.pdf", fileKey: "test-key",
    pageCount: 3, sequentialRouting: false, organizationId: 100,
    createdAt: new Date(), updatedAt: new Date(),
  });
  (db.getTemplateById as any).mockReset().mockResolvedValue({
    id: 1, userId: 1, title: "テスト", description: null,
    fileUrl: "https://example.com/template.pdf", fileKey: "tpl-key",
    isPublic: false, category: null, usageCount: 0, pageCount: 3, organizationId: 100,
    createdAt: new Date(), updatedAt: new Date(),
  });
  (db.getOrganizationsByUser as any).mockReset().mockResolvedValue([]);
  (db.getContactById as any).mockReset().mockResolvedValue({ id: 1, userId: 1, name: "連絡先", email: "contact@example.com", organizationId: 100 });
  (db.getSignatureFieldsByDocument as any).mockReset().mockResolvedValue([]);
  // vi.resetAllMocks() (organization.changeRole describe) clears this mock's implementation
  (db.getSignatureRequestsByDocument as any).mockReset().mockResolvedValue([]);
  // Restore email mocks to defaults — vi.clearAllMocks() does not restore mockImplementation
  // set by custom mockImplementation() calls in tests (e.g. "email failure" test).
  const email = await import("./email");
  (email.sendEmail as any).mockResolvedValue(true);
  (email.buildSignatureRequestEmail as any).mockReturnValue({ subject: "署名依頼", html: "<p>test</p>" });
  (email.buildSignatureCompleteEmail as any).mockReturnValue({ subject: "署名完了", html: "<p>test</p>" });
  (email.buildAllSignedEmail as any).mockReturnValue({ subject: "全署名完了", html: "<p>test</p>" });
  (email.resolveEmailLocale as any).mockImplementation((locale?: string) => locale || "ja");
  vi.clearAllMocks();
}

// Helper: mock fields for sendForSignature (requires signerIndex 0 field)
async function mockFieldsForSend(signerCount: number = 1) {
  const { getSignatureFieldsByDocument } = await import("./db");
  const fields = [];
  for (let i = 0; i < signerCount; i++) {
    fields.push({
      id: i + 1, documentId: 1, clientId: `f${i + 1}`, page: 0,
      xPercent: "50.00", yPercent: "80.00", widthPercent: "20.00", heightPercent: "6.00",
      signerIndex: i, type: "signature", label: null,
    });
  }
  (getSignatureFieldsByDocument as any).mockResolvedValueOnce(fields);
}

// ==================== BRANCH COVERAGE TESTS ====================

describe("routers-branch: catch blocks (audit log failures)", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("documents.create: catches audit log failure", async () => {
    const { appendAuditLog } = await import("./auditLog");
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));
    const { getOrganizationsByUser } = await import("./db");
    (getOrganizationsByUser as any).mockResolvedValueOnce([]);
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.create({ title: "テスト" });
    expect(result.id).toBe(1);
  });

  it("documents.uploadPdf: non-draft rejection", async () => {
    const { getDocumentById } = await import("./db");
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", status: "sent", organizationId: 100,
      fileUrl: "https://example.com/test.pdf",
      createdAt: new Date(), updatedAt: new Date(),
    });
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.uploadPdf({
      documentId: 1, fileBase64: Buffer.from("test").toString("base64"),
      fileName: "test.pdf", mimeType: "application/pdf",
    })).rejects.toThrow("errors.documents.draftOnlyPdf");
  });

  it("documents.uploadPdf: rejects invalid PDF with null error", async () => {
    const { getDocumentById } = await import("./db");
    const { validatePdf } = await import("./pdf");
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", status: "draft", organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (validatePdf as any).mockResolvedValueOnce({ valid: false, error: null });
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.uploadPdf({
      documentId: 1, fileBase64: Buffer.from("not-pdf").toString("base64"),
      fileName: "bad.pdf", mimeType: "application/pdf",
    })).rejects.toThrow("errors.documents.invalidPdf");
  });

  it("documents.uploadPdf: pageCount ?? 0 fallback", async () => {
    const { getDocumentById } = await import("./db");
    const { validatePdf } = await import("./pdf");
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", status: "draft", organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (validatePdf as any).mockResolvedValueOnce({ valid: true, pageCount: undefined });
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.uploadPdf({
      documentId: 1, fileBase64: Buffer.from("pdf-content").toString("base64"),
      fileName: "test.pdf", mimeType: "application/pdf",
    });
    expect(result.pageCount).toBe(0);
  });

  it("documents.uploadPdf: catches audit log failure", async () => {
    const { appendAuditLog } = await import("./auditLog");
    const { getDocumentById } = await import("./db");
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", status: "draft", organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.uploadPdf({
      documentId: 1, fileBase64: Buffer.from("pdf-content").toString("base64"),
      fileName: "test.pdf", mimeType: "application/pdf",
    });
    expect(result.url).toBeDefined();
  });

  it("documents.void: catches audit log failure", async () => {
    const { appendAuditLog } = await import("./auditLog");
    const { getDocumentById } = await import("./db");
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", status: "sent", organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.void({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("documents.delete: catches audit log failure", async () => {
    const { appendAuditLog } = await import("./auditLog");
    const { getDocumentById } = await import("./db");
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", status: "draft", organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe("routers-branch: sendForSignature fallback || branches", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("parallel routing with null names, null locale, catch audit", async () => {
    const { getDocumentById, getSignatureFieldsByDocument, getSignatureRequestsByDocument,
            getOrganizationsByUser } = await import("./db");
    const { appendAuditLog } = await import("./auditLog");

    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト文書", status: "draft",
      fileUrl: "https://example.com/test.pdf", fileKey: "test-key",
      organizationId: 100, createdAt: new Date(), updatedAt: new Date(),
    });
    // Fields for signer index 0
    (getSignatureFieldsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, clientId: "f1", page: 0, xPercent: "50", yPercent: "80",
        widthPercent: "20", heightPercent: "6", signerIndex: 0, type: "signature", label: null },
    ]);
    (getOrganizationsByUser as any).mockResolvedValueOnce([]);
    // Return requests with null signerName
    (getSignatureRequestsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: null,
        recipientRole: "signer", order: 1, status: "pending", accessToken: "token-1",
        locale: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, documentId: 1, signerEmail: "cc@example.com", signerName: null,
        recipientRole: "cc", order: 2, status: "pending", accessToken: "token-2",
        locale: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));

    const { ctx } = createUserCtx();
    ctx.user!.name = null as any;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.sendForSignature({
      documentId: 1,
      signers: [
        { email: "signer@example.com", name: "署名者", role: "signer", order: 1 },
        { email: "cc@example.com", name: "CC受信者", role: "cc", order: 2 },
      ],
      sequentialRouting: false,
      origin: "https://example.com",
    });
    expect(result.success).toBe(true);
  });

  it("sequential routing with null names", async () => {
    const { getDocumentById, getSignatureFieldsByDocument, getSignatureRequestsByDocument,
            getOrganizationsByUser } = await import("./db");

    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト文書", status: "draft",
      fileUrl: "https://example.com/test.pdf", fileKey: "test-key",
      organizationId: 100, createdAt: new Date(), updatedAt: new Date(),
    });
    (getSignatureFieldsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, clientId: "f1", page: 0, xPercent: "50", yPercent: "80",
        widthPercent: "20", heightPercent: "6", signerIndex: 0, type: "signature", label: null },
    ]);
    (getOrganizationsByUser as any).mockResolvedValueOnce([]);
    (getSignatureRequestsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: null,
        recipientRole: "signer", order: 1, status: "pending", accessToken: "token-1",
        locale: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const { ctx } = createUserCtx();
    ctx.user!.name = null as any;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.sendForSignature({
      documentId: 1,
      signers: [{ email: "signer@example.com", name: "署名者", role: "signer", order: 1 }],
      sequentialRouting: true,
      origin: "https://example.com",
    });
    expect(result.success).toBe(true);
  });

  it("with internal approval and null names", async () => {
    const { getDocumentById, getSignatureFieldsByDocument, getOrganizationsByUser,
            getNextPendingApprover } = await import("./db");

    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト文書", status: "draft",
      fileUrl: "https://example.com/test.pdf", fileKey: "test-key",
      organizationId: 100, createdAt: new Date(), updatedAt: new Date(),
    });
    (getSignatureFieldsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, clientId: "f1", page: 0, xPercent: "50", yPercent: "80",
        widthPercent: "20", heightPercent: "6", signerIndex: 0, type: "signature", label: null },
    ]);
    (getOrganizationsByUser as any).mockResolvedValueOnce([]);
    (getNextPendingApprover as any).mockResolvedValueOnce({
      id: 1, documentId: 1, approverEmail: "approver@example.com", approverName: null,
      status: "pending", order: 1, accessToken: "approval-token",
    });

    const { ctx } = createUserCtx();
    ctx.user!.name = null as any;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.sendForSignature({
      documentId: 1,
      signers: [{ email: "signer@example.com", name: "署名者", role: "signer", order: 1 }],
      sequentialRouting: false,
      origin: "https://example.com",
      internalApproval: {
        approvers: [{ email: "approver@example.com", name: "承認者", order: 1 }],
      },
    });
    expect(result.success).toBe(true);
    expect(result.pendingApproval).toBe(true);
  });
});

describe("routers-branch: resendReminder fallback ||", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("null signerName and null user.name", async () => {
    const { getDocumentById, getPendingSignatureRequests } = await import("./db");

    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト文書", status: "sent", organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (getPendingSignatureRequests as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: null,
        accessToken: "token-1", locale: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const { ctx } = createUserCtx();
    ctx.user!.name = null as any;
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.resendReminder({ id: 1, origin: "" });
    expect(result.success).toBe(true);
  });
});

describe("routers-branch: downloadSigned org access branches", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("org member (non-manager) cannot access another user's doc in different org", async () => {
    const { getDocumentById, getMembership } = await import("./db");
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 999, title: "テスト", status: "completed",
      signedFileUrl: "https://example.com/signed.pdf",
      organizationId: 999, // different org from ctx org (100)
      createdAt: new Date(), updatedAt: new Date(),
    });
    (getMembership as any).mockResolvedValueOnce({ id: 1, userId: 1, organizationId: 100, role: "member", isActive: true, createdAt: new Date(), updatedAt: new Date() });
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.downloadSigned({ id: 1 })).rejects.toThrow("errors.documents.notFound");
  });

  it("no org membership, not creator", async () => {
    const { getDocumentById, getMembership } = await import("./db");
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 999, title: "テスト", status: "completed",
      signedFileUrl: "https://example.com/signed.pdf",
      organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    // No membership - orgProcedure will reject
    (getMembership as any).mockResolvedValueOnce(null);
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.downloadSigned({ id: 1 })).rejects.toThrow("errors.auth.notOrgMember");
  });
});

describe("routers-branch: signature.sign IP extraction", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  async function mockSignRequest() {
    const { getSignatureRequestByToken } = await import("./db");
    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "sent",
        fileUrl: "https://example.com/test.pdf", organizationId: 100,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
  }

  it("x-forwarded-for string", async () => {
    await mockSignRequest();
    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    });
    expect(result.success).toBe(true);
  });

  it("x-forwarded-for array", async () => {
    await mockSignRequest();
    const ctx = createPubCtx({ 'x-forwarded-for': ['1.2.3.4', '5.6.7.8'] });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    });
    expect(result.success).toBe(true);
  });

  it("x-real-ip", async () => {
    await mockSignRequest();
    const ctx = createPubCtx({ 'x-real-ip': '10.0.0.1' });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    });
    expect(result.success).toBe(true);
  });

  it("socket.remoteAddress fallback", async () => {
    await mockSignRequest();
    const ctx = createPubCtx({});
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    });
    expect(result.success).toBe(true);
  });

  it("x-forwarded-for array with empty first element", async () => {
    await mockSignRequest();
    const ctx = createPubCtx({ 'x-forwarded-for': [undefined] });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    });
    expect(result.success).toBe(true);
  });
});

describe("routers-branch: signature.sign fallback || branches", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("null signatureDataUrl, null signerName, null owner.name, audit catch", async () => {
    const { getSignatureRequestByToken, getUserById } = await import("./db");
    const { appendAuditLog } = await import("./auditLog");

    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: null,
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        locale: null, createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "sent",
        fileUrl: "https://example.com/test.pdf", organizationId: 100,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    (getUserById as any).mockResolvedValueOnce({ id: 1, email: "owner@example.com", name: null });
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));

    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4' });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureFont: "dancing-script",
    });
    expect(result.success).toBe(true);
  });
});

describe("routers-branch: signature.sign all-signed flow", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("all signed: platform sign fail, WORM fail, audit fail", async () => {
    const { getSignatureRequestByToken, getSignatureFieldsByDocument, getSignatureRequestsByDocument,
            checkAllSignersSigned, getUserById } = await import("./db");
    const { appendAuditLog } = await import("./auditLog");
    const { signPdfWithPlatformKey } = await import("./platformSignature");
    const { wormStorePdf } = await import("./wormStorage");

    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: null,
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        locale: null, createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "sent",
        fileUrl: "https://example.com/test.pdf", organizationId: 1,
        sequentialRouting: false,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    (getSignatureFieldsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, clientId: "f1", page: 0, xPercent: "50", yPercent: "80",
        widthPercent: "20", heightPercent: "6", signerIndex: 0, type: null, label: null },
    ]);
    (getSignatureRequestsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: null,
        recipientRole: "signer", order: 1, status: "sent",
        signatureDataUrl: null, signatureFont: "dancing-script", stampDataUrl: null,
        signedAt: null, signerIpAddress: null, signerUserAgent: null,
        accessToken: "token-abc", createdAt: new Date(), updatedAt: new Date() },
    ]);
    (checkAllSignersSigned as any).mockResolvedValueOnce(true);
    (getUserById as any).mockResolvedValueOnce({ id: 1, email: "owner@example.com", name: null });
    (signPdfWithPlatformKey as any).mockRejectedValueOnce(new Error("sign fail"));
    (wormStorePdf as any).mockRejectedValueOnce(new Error("worm fail"));
    (appendAuditLog as any).mockResolvedValueOnce({ id: 1 }); // signature.signed
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail")); // document.completed

    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4' });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureFont: "dancing-script",
    })).rejects.toThrow("errors.signature.pdfGenerationFailed");
  });

  it("all signed: email failure and activity log failure", async () => {
    const { getSignatureRequestByToken, getSignatureFieldsByDocument, getSignatureRequestsByDocument,
            checkAllSignersSigned, getUserById, createActivityLog } = await import("./db");
    const { sendEmail } = await import("./email");

    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        locale: null, createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "sent",
        fileUrl: "https://example.com/test.pdf", organizationId: 100,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    (getSignatureFieldsByDocument as any).mockResolvedValueOnce([]);
    (getSignatureRequestsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent",
        signatureDataUrl: "data:image/png;base64,test", signatureFont: null, stampDataUrl: null,
        signedAt: new Date(), signerIpAddress: "1.2.3.4", signerUserAgent: "test",
        accessToken: "token-abc", createdAt: new Date(), updatedAt: new Date() },
    ]);
    (checkAllSignersSigned as any).mockResolvedValueOnce(true);
    (getUserById as any).mockResolvedValueOnce({ id: 1, email: "owner@example.com", name: "オーナー" });
    // Make completion email fail (the first sendEmail for signature_complete will succeed)
    let emailCallCount = 0;
    (sendEmail as any).mockImplementation(() => {
      emailCallCount++;
      if (emailCallCount >= 2) return Promise.reject(new Error("email fail"));
      return Promise.resolve(true);
    });
    // Make activity log fail on the second call
    let activityCallCount = 0;
    (createActivityLog as any).mockImplementation(() => {
      activityCallCount++;
      if (activityCallCount >= 2) return Promise.reject(new Error("activity fail"));
      return Promise.resolve(undefined);
    });

    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4' });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    });
    expect(result.success).toBe(true);
    // Reset mockImplementation back to default
    (sendEmail as any).mockResolvedValue(true);
    (createActivityLog as any).mockResolvedValue(undefined);
  });

  it("outer catch with signedPdfBuffer defined, cert fail reverts to sent", async () => {
    const { getSignatureRequestByToken, getSignatureFieldsByDocument, getSignatureRequestsByDocument,
            checkAllSignersSigned, getUserById } = await import("./db");
    const { appendCompletionCertificate } = await import("./pdf");

    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "sent",
        fileUrl: "https://example.com/test.pdf", organizationId: 100,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    (getSignatureFieldsByDocument as any).mockResolvedValueOnce([]);
    (getSignatureRequestsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent",
        signatureDataUrl: "data:image/png;base64,test", signatureFont: null, stampDataUrl: null,
        signedAt: new Date(), accessToken: "token-abc", createdAt: new Date(), updatedAt: new Date() },
    ]);
    (checkAllSignersSigned as any).mockResolvedValueOnce(true);
    (getUserById as any).mockResolvedValueOnce({ id: 1, email: "owner@example.com", name: "オーナー" });
    // appendCompletionCertificate throws (after embedSignaturesIntoPdf succeeds)
    // WORM修正後: cert failはouter catchに入り、ドキュメントはsentに戻される
    // storagePutフォールバックは削除されたため、mockRejectedValueOnceは不要
    (appendCompletionCertificate as any).mockRejectedValueOnce(new Error("cert fail"));

    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4' });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    })).rejects.toThrow("errors.signature.pdfGenerationFailed");
  });

  it("outer catch with no signedPdfBuffer (embed fails immediately)", async () => {
    const { getSignatureRequestByToken, getSignatureFieldsByDocument, getSignatureRequestsByDocument,
            checkAllSignersSigned, getUserById } = await import("./db");
    const { embedSignaturesIntoPdf } = await import("./pdf");

    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "sent",
        fileUrl: "https://example.com/test.pdf", organizationId: 100,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    (getSignatureFieldsByDocument as any).mockResolvedValueOnce([]);
    (getSignatureRequestsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent",
        signatureDataUrl: "data:image/png;base64,test", signatureFont: null, stampDataUrl: null,
        signedAt: new Date(), accessToken: "token-abc", createdAt: new Date(), updatedAt: new Date() },
    ]);
    (checkAllSignersSigned as any).mockResolvedValueOnce(true);
    (getUserById as any).mockResolvedValueOnce({ id: 1, email: "owner@example.com", name: "オーナー" });
    (embedSignaturesIntoPdf as any).mockRejectedValueOnce(new Error("embed fail"));

    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4' });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    })).rejects.toThrow("errors.signature.pdfGenerationFailed");
  });

  it("sequential routing: next signer with null name", async () => {
    const { getSignatureRequestByToken, getSignatureFieldsByDocument, getSignatureRequestsByDocument,
            checkAllSignersSigned, getNextPendingSigner, getUserById } = await import("./db");

    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-1",
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "sent",
        fileUrl: "https://example.com/test.pdf", organizationId: 100,
        sequentialRouting: true,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    (getSignatureFieldsByDocument as any).mockResolvedValueOnce([]);
    (getSignatureRequestsByDocument as any).mockResolvedValueOnce([]);
    (checkAllSignersSigned as any).mockResolvedValueOnce(false);
    (getNextPendingSigner as any).mockResolvedValueOnce({
      id: 2, documentId: 1, signerEmail: "signer2@example.com", signerName: null,
      recipientRole: "signer", order: 2, status: "pending", accessToken: "token-2",
    });
    (getUserById as any).mockResolvedValueOnce({ id: 1, email: "owner@example.com", name: null });

    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4' });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.sign({
      token: "token-1", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    });
    expect(result.success).toBe(true);
  });
});

describe("routers-branch: signature.decline fallback ||", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("null signerName and null owner.name, audit catch", async () => {
    const { getSignatureRequestByToken, getUserById } = await import("./db");
    const { appendAuditLog } = await import("./auditLog");

    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: null,
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "sent",
        fileUrl: "https://example.com/test.pdf",
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    (getUserById as any).mockResolvedValueOnce({ id: 1, email: "owner@example.com", name: null });
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));

    const ctx = createPubCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.decline({
      token: "token-abc", reason: "テスト拒否",
    });
    expect(result.success).toBe(true);
  });
});

describe("routers-branch: signature.delegate fallback ||", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("null signerName, audit catch", async () => {
    const { getSignatureRequestByToken } = await import("./db");
    const { appendAuditLog } = await import("./auditLog");

    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: null,
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "sent",
        fileUrl: "https://example.com/test.pdf",
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));

    const ctx = createPubCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.delegate({
      token: "token-abc",
      delegateEmail: "delegate@example.com",
      delegateName: "委任者",
    });
    expect(result.success).toBe(true);
  });
});

describe("routers-branch: signature.verifyAccessCode catch", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("catches audit log failure", async () => {
    const { getSignatureRequestByToken } = await import("./db");
    const { appendAuditLog } = await import("./auditLog");

    // Pre-computed bcrypt hash of "1234" with 12 rounds
    const HASHED_1234 = "$2b$12$iAKY2BMVIxnp2lZPbVmU3.XbcDAmNvH.cPC7xU6caB/9IZEOIWa6a";
    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        accessCode: HASHED_1234,
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "sent",
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));

    const ctx = createPubCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.verifyAccessCode({
      token: "token-abc", accessCode: "1234",
    });
    expect(result.verified).toBe(true);
  }, 15000);
});

describe("routers-branch: templates", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("templates.create: null description, category, signerCount + audit catch", async () => {
    const { appendAuditLog } = await import("./auditLog");
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.create({ title: "テスト" });
    expect(result.id).toBe(1);
  });

  it("templates.uploadPdf: invalid PDF with null error", async () => {
    const { getTemplateById } = await import("./db");
    const { validatePdf } = await import("./pdf");
    (getTemplateById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (validatePdf as any).mockResolvedValueOnce({ valid: false, error: null });
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.templates.uploadPdf({
      templateId: 1, fileBase64: Buffer.from("not-pdf").toString("base64"),
      fileName: "bad.pdf", mimeType: "application/pdf",
    })).rejects.toThrow("errors.templates.invalidPdf");
  });

  it("templates.uploadPdf: pageCount ?? 0 fallback", async () => {
    const { getTemplateById } = await import("./db");
    const { validatePdf } = await import("./pdf");
    (getTemplateById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (validatePdf as any).mockResolvedValueOnce({ valid: true, pageCount: undefined });
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.uploadPdf({
      templateId: 1, fileBase64: Buffer.from("pdf-content").toString("base64"),
      fileName: "test.pdf", mimeType: "application/pdf",
    });
    expect(result.pageCount).toBe(0);
  });

  it("templates.update: catches audit log failure", async () => {
    const { getTemplateById } = await import("./db");
    const { appendAuditLog } = await import("./auditLog");
    (getTemplateById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.update({ id: 1, title: "更新テスト" });
    expect(result.success).toBe(true);
  });

  it("templates.delete: catches audit log failure", async () => {
    const { getTemplateById } = await import("./db");
    const { appendAuditLog } = await import("./auditLog");
    (getTemplateById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe("routers-branch: internalApproval.decide", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("approved, all approved, sequential routing, null names, audit catch", async () => {
    const { getInternalApprovalByToken, getDocumentById, getUserById,
            checkAllApproversApproved, getSignatureRequestsByDocument } = await import("./db");
    const { appendAuditLog } = await import("./auditLog");

    (getInternalApprovalByToken as any).mockResolvedValueOnce({
      id: 1, documentId: 1, approverEmail: "approver@example.com", approverName: null,
      status: "pending", order: 1, accessToken: "approval-token",
    });
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", status: "pending_approval",
      fileUrl: "https://example.com/test.pdf",
      sequentialRouting: true, organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));
    (checkAllApproversApproved as any).mockResolvedValueOnce(true);
    (getUserById as any).mockResolvedValueOnce({ id: 1, email: "owner@example.com", name: null });
    (getSignatureRequestsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: null,
        recipientRole: "signer", order: 1, status: "pending", accessToken: "sign-token",
        createdAt: new Date(), updatedAt: new Date() },
      { id: 2, documentId: 1, signerEmail: "cc@example.com", signerName: null,
        recipientRole: "cc", order: 2, status: "pending", accessToken: "cc-token",
        createdAt: new Date(), updatedAt: new Date() },
    ]);

    const ctx = createPubCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.internalApproval.decide({
      token: "approval-token", decision: "approved", origin: "",
    });
    expect(result.success).toBe(true);
    expect(result.allApproved).toBe(true);
  });

  it("approved, all approved, parallel routing, null names", async () => {
    const { getInternalApprovalByToken, getDocumentById, getUserById,
            checkAllApproversApproved, getSignatureRequestsByDocument } = await import("./db");

    (getInternalApprovalByToken as any).mockResolvedValueOnce({
      id: 1, documentId: 1, approverEmail: "approver@example.com", approverName: "承認者",
      status: "pending", order: 1, accessToken: "approval-token",
    });
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", status: "pending_approval",
      fileUrl: "https://example.com/test.pdf",
      sequentialRouting: false, organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (checkAllApproversApproved as any).mockResolvedValueOnce(true);
    (getUserById as any).mockResolvedValueOnce({ id: 1, email: "owner@example.com", name: null });
    (getSignatureRequestsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: null,
        recipientRole: "signer", order: 1, status: "pending", accessToken: "sign-token",
        createdAt: new Date(), updatedAt: new Date() },
      { id: 2, documentId: 1, signerEmail: "cc@example.com", signerName: null,
        recipientRole: "cc", order: 2, status: "pending", accessToken: "cc-token",
        createdAt: new Date(), updatedAt: new Date() },
    ]);

    const ctx = createPubCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.internalApproval.decide({
      token: "approval-token", decision: "approved", origin: "",
    });
    expect(result.success).toBe(true);
  });

  it("approved, not all approved, next approver with null name", async () => {
    const { getInternalApprovalByToken, getDocumentById, getUserById,
            checkAllApproversApproved, getNextPendingApprover } = await import("./db");

    (getInternalApprovalByToken as any).mockResolvedValueOnce({
      id: 1, documentId: 1, approverEmail: "approver@example.com", approverName: "承認者",
      status: "pending", order: 1, accessToken: "approval-token",
    });
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", status: "pending_approval",
      fileUrl: "https://example.com/test.pdf",
      organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (checkAllApproversApproved as any).mockResolvedValueOnce(false);
    (getUserById as any).mockResolvedValueOnce({ id: 1, email: "owner@example.com", name: null });
    (getNextPendingApprover as any).mockResolvedValueOnce({
      id: 2, documentId: 1, approverEmail: "approver2@example.com", approverName: null,
      status: "pending", order: 2, accessToken: "approval-token-2",
    });

    const ctx = createPubCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.internalApproval.decide({
      token: "approval-token", decision: "approved", origin: "",
    });
    expect(result.success).toBe(true);
    expect(result.allApproved).toBe(false);
  });
});

describe("routers-branch: internalApproval.listByDocument org access", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("org member (non-manager) cannot access", async () => {
    const { getDocumentById, getMembership } = await import("./db");
    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 999, title: "テスト", status: "sent",
      organizationId: 1,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (getMembership as any).mockResolvedValueOnce({ role: "member" });
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.internalApproval.listByDocument({ documentId: 1 })).rejects.toThrow("errors.documents.notFound");
  });
});

describe("routers-branch: auditLog.list org access", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("non-manager, no organizationId, member role", async () => {
    const { getMembership } = await import("./db");
    (getMembership as any).mockResolvedValue({ id: 1, userId: 1, organizationId: 100, role: "member", isActive: true, createdAt: new Date(), updatedAt: new Date() });
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.auditLog.list({})).rejects.toThrow("errors.auth.managerRequired");
  });

  it("non-manager, with organizationId, member role", async () => {
    const { getMembership } = await import("./db");
    (getMembership as any).mockResolvedValue({ id: 1, userId: 1, organizationId: 100, role: "member", isActive: true, createdAt: new Date(), updatedAt: new Date() });
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.auditLog.list({ organizationId: 1 })).rejects.toThrow("errors.auth.managerRequired");
  });
});

describe("routers-branch: auditLog.count and verifyIntegrity", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("auditLog.count: member role cannot access", async () => {
    const { getMembership } = await import("./db");
    (getMembership as any).mockResolvedValue({ id: 1, userId: 1, organizationId: 100, role: "member", isActive: true, createdAt: new Date(), updatedAt: new Date() });
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.auditLog.count()).rejects.toThrow("errors.auth.managerRequired");
  });

  it("auditLog.verifyIntegrity: member role cannot access", async () => {
    const { getMembership } = await import("./db");
    (getMembership as any).mockResolvedValue({ id: 1, userId: 1, organizationId: 100, role: "member", isActive: true, createdAt: new Date(), updatedAt: new Date() });
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.auditLog.verifyIntegrity()).rejects.toThrow("errors.auth.managerRequired");
  });
});

describe("routers-branch: contactGroups.addMember", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("group not found", async () => {
    const { getGroupsByOrg } = await import("./db");
    (getGroupsByOrg as any).mockResolvedValueOnce([]);
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.contactGroups.addMember({ groupId: 999, contactId: 1 })).rejects.toThrow("errors.groups.notFound");
  });
});

describe("routers-branch: contacts/categories/groups create fallback ||", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("contacts.create: null company fallback", async () => {
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.contacts.create({
      name: "テスト", email: "test@example.com",
    });
    expect(result.id).toBe(1);
  });

  it("contactCategories.create: null color fallback", async () => {
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.contactCategories.create({ name: "テスト" });
    expect(result).toBeDefined();
  });

  it("contactGroups.create: null description fallback", async () => {
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.contactGroups.create({ name: "テスト" });
    expect(result).toBeDefined();
  });
});

describe("routers-branch: createFromTemplate audit catch", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("catches audit log failure", async () => {
    const { getTemplateById, getOrganizationsByUser } = await import("./db");
    const { appendAuditLog } = await import("./auditLog");
    (getTemplateById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト", isPublic: true,
      fileUrl: "https://example.com/template.pdf",
      createdAt: new Date(), updatedAt: new Date(),
    });
    (getOrganizationsByUser as any).mockResolvedValueOnce([]);
    (appendAuditLog as any).mockRejectedValueOnce(new Error("audit fail"));
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.createFromTemplate({
      templateId: 1, title: "テスト", description: "",
    });
    expect(result.id).toBe(1);
  });
});

describe("routers-branch: signature.sign with stampDataUrl", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("with stampDataUrl only", async () => {
    const { getSignatureRequestByToken } = await import("./db");
    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "sent",
        fileUrl: "https://example.com/test.pdf", organizationId: 100,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4' });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      stampDataUrl: "data:image/png;base64,stamp",
    });
    expect(result.success).toBe(true);
  });
});

describe("routers-branch: signature.generateStamp", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("generates stamp with minimal input", async () => {
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.signature.generateStamp({
      name: "テスト", date: "2026-01-01",
    });
    expect(result.dataUrl).toBeDefined();
  });
});


// ==================== Phase 73 Tests ====================

describe("Phase 73: Fix 1 - declined/voided/expired documents block signing", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("signature.sign rejects declined document", async () => {
    const { getSignatureRequestByToken } = await import("./db");
    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "declined",
        fileUrl: "https://example.com/test.pdf", organizationId: 100,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4' });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    })).rejects.toThrow();
  });

  it("signature.sign rejects voided document", async () => {
    const { getSignatureRequestByToken } = await import("./db");
    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "voided",
        fileUrl: "https://example.com/test.pdf", organizationId: 100,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4' });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    })).rejects.toThrow();
  });

  it("signature.sign rejects expired document", async () => {
    const { getSignatureRequestByToken } = await import("./db");
    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-abc",
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 1, userId: 1, title: "テスト", status: "expired",
        fileUrl: "https://example.com/test.pdf", organizationId: 100,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4' });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.signature.sign({
      token: "token-abc", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    })).rejects.toThrow();
  });
});

describe("Phase 73: Fix 2 - outer catch rolls back signatureRequest", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("reverts signatureRequest to sent with null fields on PDF failure", async () => {
    const { getDb, getSignatureRequestByToken, getSignatureFieldsByDocument, getSignatureRequestsByDocument,
            checkAllSignersSigned, getUserById, updateSignatureRequest, updateDocument } = await import("./db");
    const { embedSignaturesIntoPdf } = await import("./pdf");

    // Re-mock getDb after clearAllMocks resets it
    (getDb as any).mockResolvedValueOnce({
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
        }),
      }),
    });

    (getSignatureRequestByToken as any).mockResolvedValueOnce({
      request: {
        id: 42, documentId: 10, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent", accessToken: "token-xyz",
        createdAt: new Date(), updatedAt: new Date(),
      },
      document: {
        id: 10, userId: 1, title: "テスト", status: "sent",
        fileUrl: "https://example.com/test.pdf", organizationId: 100,
        createdAt: new Date(), updatedAt: new Date(),
      },
    });
    (getSignatureFieldsByDocument as any).mockResolvedValueOnce([]);
    (getSignatureRequestsByDocument as any).mockResolvedValueOnce([
      { id: 42, documentId: 10, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "sent",
        signatureDataUrl: "data:image/png;base64,test", signatureFont: null, stampDataUrl: null,
        signedAt: new Date(), accessToken: "token-xyz", createdAt: new Date(), updatedAt: new Date() },
    ]);
    (checkAllSignersSigned as any).mockResolvedValueOnce(true);
    (getUserById as any).mockResolvedValueOnce({ id: 1, email: "owner@example.com", name: "オーナー" });
    (embedSignaturesIntoPdf as any).mockRejectedValueOnce(new Error("embed fail"));

    const ctx = createPubCtx({ 'x-forwarded-for': '1.2.3.4' });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.signature.sign({
      token: "token-xyz", signerEmail: "signer@example.com",
      signatureDataUrl: "data:image/png;base64,test",
    })).rejects.toThrow("errors.signature.pdfGenerationFailed");

    // Verify signatureRequest was rolled back with null fields
    expect(updateSignatureRequest).toHaveBeenCalledWith(42, expect.objectContaining({
      status: "sent",
      signatureDataUrl: null,
      signatureFont: null,
      stampDataUrl: null,
      signedAt: null,
      signerIpAddress: null,
      signerUserAgent: null,
    }));
    // Verify document was also rolled back
    expect(updateDocument).toHaveBeenCalledWith(10, expect.objectContaining({
      status: "sent",
      completedAt: null,
    }));
  });
});

describe("Phase 73: Fix 3 - documents.list returns org documents (orgProcedure)", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("returns documents for the active organization via orgProcedure", async () => {
    const { getDocumentsByOrg } = await import("./db");
    const orgDocs = [
      { id: 1, title: "組織文書1", userId: 1, status: "draft", organizationId: 100 },
      { id: 2, title: "組織文書2", userId: 2, status: "sent", organizationId: 100 },
    ];
    (getDocumentsByOrg as any).mockResolvedValueOnce(orgDocs);

    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.list();
    expect(getDocumentsByOrg).toHaveBeenCalledWith(100, undefined);
    expect(result).toEqual(orgDocs);
  });

  it("rejects when user is not a member of the organization", async () => {
    const { getMembership } = await import("./db");
    (getMembership as any).mockResolvedValue(null);
    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.list()).rejects.toThrow("errors.auth.notOrgMember");
  });
});

describe("Phase 73: Fix 4 - createFromTemplate allows org members (orgProcedure)", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("allows org member to use same-org template", async () => {
    const { getTemplateById, createDocument,
            deepCopyTemplateToDocument, incrementTemplateUsage, createActivityLog } = await import("./db");
    // Template belongs to same org (100) as the user's active org
    (getTemplateById as any).mockResolvedValueOnce({
      id: 10, userId: 99, organizationId: 100, isPublic: false,
      title: "組織テンプレート", description: "テスト",
      fileUrl: "https://example.com/tmpl.pdf", fileKey: "tmpl-key",
      fileName: "tmpl.pdf", pageCount: 2,
      defaultExpirationDays: null, defaultReminderDays: null,
    });
    (createDocument as any).mockResolvedValueOnce(100);
    (deepCopyTemplateToDocument as any).mockResolvedValueOnce(undefined);
    (incrementTemplateUsage as any).mockResolvedValueOnce(undefined);
    (createActivityLog as any).mockResolvedValueOnce(undefined);

    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.createFromTemplate({
      templateId: 10, title: "新しい文書", description: "テスト",
    });
    expect(result.id).toBe(100);
  });

  it("rejects template from different org", async () => {
    const { getTemplateById } = await import("./db");
    // Template belongs to org 5, but user's active org is 100
    (getTemplateById as any).mockResolvedValueOnce({
      id: 10, userId: 99, organizationId: 5, isPublic: false,
      title: "組織テンプレート", description: "テスト",
      fileUrl: "https://example.com/tmpl.pdf", fileKey: "tmpl-key",
      fileName: "tmpl.pdf", pageCount: 2,
    });

    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.createFromTemplate({
      templateId: 10, title: "新しい文書", description: "テスト",
    })).rejects.toThrow("errors.templates.accessDenied");
  });
});

describe("Phase 73: Fix 5 - CC recipients receive email on sendForSignature", () => {
  beforeEach(async () => { await resetMocksToDefaults(); });

  it("sends email to CC recipients in parallel mode", async () => {
    const { getDocumentById, getSignatureFieldsByDocument, getOrganizationsByUser,
            getSignatureRequestsByDocument, createSignatureRequest, updateDocument,
            deleteSignatureRequestsByDocument, updateSignatureRequest, createActivityLog } = await import("./db");
    const { sendEmail, buildSignatureRequestEmail, buildCcNotificationEmail, resolveEmailLocale } = await import("./email");

    // Re-mock email helpers after clearAllMocks
    (buildSignatureRequestEmail as any).mockReturnValue({ subject: "署名依頼", html: "<p>test</p>" });
    (buildCcNotificationEmail as any).mockReturnValue({ subject: "[写し通知] テスト文書", html: "<p>cc-test</p>" });
    (resolveEmailLocale as any).mockImplementation((locale?: string) => locale || "ja");

    (getDocumentById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "テスト文書", status: "draft",
      fileUrl: "https://example.com/test.pdf", fileKey: "test-key",
      pageCount: 3, sequentialRouting: false, organizationId: 100,
      createdAt: new Date(), updatedAt: new Date(),
    });
    (getSignatureFieldsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, clientId: "f1", page: 0, xPercent: "50", yPercent: "80",
        widthPercent: "20", heightPercent: "6", signerIndex: 0, type: "signature", required: true },
    ]);
    (getOrganizationsByUser as any).mockResolvedValueOnce([]);
    (deleteSignatureRequestsByDocument as any).mockResolvedValueOnce(undefined);
    (createSignatureRequest as any).mockResolvedValue(1);
    (updateDocument as any).mockResolvedValueOnce(undefined);
    (updateSignatureRequest as any).mockResolvedValue(undefined);
    (createActivityLog as any).mockResolvedValueOnce(undefined);
    (getSignatureRequestsByDocument as any).mockResolvedValueOnce([
      { id: 1, documentId: 1, signerEmail: "signer@example.com", signerName: "署名者",
        recipientRole: "signer", order: 1, status: "pending", accessToken: "tok-1" },
      { id: 2, documentId: 1, signerEmail: "cc@example.com", signerName: "CC受信者",
        recipientRole: "cc", order: 2, status: "pending", accessToken: "tok-2", locale: "ja" },
    ]);

    const { ctx } = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    await caller.documents.sendForSignature({
      documentId: 1,
      signers: [
        { email: "signer@example.com", name: "署名者", role: "signer", order: 1 },
        { email: "cc@example.com", name: "CC受信者", role: "cc", order: 2 },
      ],
    });

    // sendEmail should be called for both signer and CC
    expect(sendEmail).toHaveBeenCalledTimes(2);
    // Second call should be for CC recipient
    const ccCall = (sendEmail as any).mock.calls[1][0];
    expect(ccCall.to).toBe("cc@example.com");
    expect(ccCall.subject).toContain("写し通知");
  });
});

describe("fix-pdf-rendering-bugs: font subset mode", () => {
  it("all embedFont calls use subset: false to prevent glyph mapping bugs", async () => {
    // subset: true in @pdf-lib/fontkit causes CMap/encoding corruption for certain glyphs
    // (e.g. '/' and '0' are dropped, turning "2022/03/08" into "22 3 8").
    // Verified fix: all embedFont calls must use subset: false.
    const fs = await import("fs");
    const { fileURLToPath } = await import("node:url");
    const pdfSource = fs.readFileSync(fileURLToPath(new URL("./pdf.ts", import.meta.url)), "utf-8");
    const subsetFalseCount = (pdfSource.match(/subset:\s*false/g) || []).length;
    const subsetTrueCount = (pdfSource.match(/subset:\s*true/g) || []).length;
    expect(subsetTrueCount).toBe(0);
    expect(subsetFalseCount).toBeGreaterThanOrEqual(4);
  });
});
