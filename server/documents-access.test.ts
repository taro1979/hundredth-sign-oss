import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ==================== MOCKS ====================

const mockGetOrganizationsByUser = vi.fn();
const mockGetDocumentsByOrg = vi.fn();
const mockGetDocumentsByMultipleOrgs = vi.fn();
const mockGetDocumentById = vi.fn();
const mockGetMembership = vi.fn();
const mockGetSignatureFieldsByDocument = vi.fn().mockResolvedValue([]);
const mockGetSignatureRequestsByDocument = vi.fn().mockResolvedValue([]);
const mockGetActivityLogsByDocument = vi.fn().mockResolvedValue([]);
const mockUpdateDocument = vi.fn().mockResolvedValue(undefined);
const mockDeleteDocument = vi.fn().mockResolvedValue(undefined);

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) }) }),
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ encryptionIv: null, storageKey: "worm/test.pdf" }]) }) }) }),
  }),
  getUserById: vi.fn().mockResolvedValue({ id: 1, openId: "test", name: "テスト", email: "test@example.com", isSuperAdmin: false }),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  getOrganizationsByUser: (...args: unknown[]) => mockGetOrganizationsByUser(...args),
  getDocumentsByOrg: (...args: unknown[]) => mockGetDocumentsByOrg(...args),
  getDocumentsByMultipleOrgs: (...args: unknown[]) => mockGetDocumentsByMultipleOrgs(...args),
  getDocumentById: (...args: unknown[]) => mockGetDocumentById(...args),
  getMembership: (...args: unknown[]) => mockGetMembership(...args),
  getSignatureFieldsByDocument: (...args: unknown[]) => mockGetSignatureFieldsByDocument(...args),
  getSignatureRequestsByDocument: (...args: unknown[]) => mockGetSignatureRequestsByDocument(...args),
  getActivityLogsByDocument: (...args: unknown[]) => mockGetActivityLogsByDocument(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
  updateUserProfile: vi.fn(),
  createDocument: vi.fn().mockResolvedValue(1),
  upsertSignatureFields: vi.fn(),
  createSignatureRequest: vi.fn().mockResolvedValue(1),
  createSignatureRequestsBulk: vi.fn(),
  getSignatureRequestsByEmail: vi.fn().mockResolvedValue([]),
  getSignatureRequestById: vi.fn().mockResolvedValue(null),
  getSignatureRequestByToken: vi.fn().mockResolvedValue(null),
  updateSignatureRequest: vi.fn(),
  checkAllSignersSigned: vi.fn().mockResolvedValue(false),
  getNextPendingSigner: vi.fn().mockResolvedValue(null),
  deleteSignatureRequestsByDocument: vi.fn(),
  createTemplate: vi.fn().mockResolvedValue(1),
  getTemplateById: vi.fn().mockResolvedValue(null),
  getPublicTemplates: vi.fn().mockResolvedValue([]),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  incrementTemplateUsage: vi.fn(),
  upsertTemplateFields: vi.fn(),
  getTemplateFieldsByTemplate: vi.fn().mockResolvedValue([]),
  deepCopyTemplateToDocument: vi.fn(),
  createContact: vi.fn().mockResolvedValue(1),
  getContactById: vi.fn().mockResolvedValue(null),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  createActivityLog: vi.fn(),
  getActivityLogsByUser: vi.fn().mockResolvedValue([]),
  getPublishedFaqs: vi.fn().mockResolvedValue([]),
  createFaq: vi.fn().mockResolvedValue(1),
  updateFaq: vi.fn(),
  deleteFaq: vi.fn(),
  createInquiry: vi.fn().mockResolvedValue(1),
  getInquiries: vi.fn().mockResolvedValue([]),
  updateInquiryStatus: vi.fn(),
  createEmailLog: vi.fn(),
  createInternalApprovalsBulk: vi.fn(),
  getInternalApprovalsByDocument: vi.fn().mockResolvedValue([]),
  getInternalApprovalByToken: vi.fn().mockResolvedValue(null),
  updateInternalApproval: vi.fn(),
  deleteInternalApprovalsByDocument: vi.fn(),
  checkAllApproversApproved: vi.fn().mockResolvedValue(false),
  getNextPendingApprover: vi.fn().mockResolvedValue(null),
  getDashboardStatsByOrg: vi.fn().mockResolvedValue({ totalDocuments: 0, pendingSignatures: 0, completedDocuments: 0, sentDocuments: 0, declinedDocuments: 0, draftDocuments: 0 }),
  createCategory: vi.fn().mockResolvedValue({ id: 1 }),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createGroup: vi.fn().mockResolvedValue({ id: 1 }),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  getGroupMembers: vi.fn().mockResolvedValue([]),
  addContactToGroup: vi.fn().mockResolvedValue({ id: 1 }),
  removeContactFromGroup: vi.fn(),
  getContactsByGroup: vi.fn().mockResolvedValue([]),
  getGroupsForContact: vi.fn().mockResolvedValue([]),
  getDocumentDetailByToken: vi.fn().mockResolvedValue(null),
  claimSignatureRequestsByEmail: vi.fn().mockResolvedValue(0),
  claimInternalApprovalsByEmail: vi.fn().mockResolvedValue(0),
  getSignatureInboxEntriesForUser: vi.fn().mockResolvedValue([]),
  getInternalApprovalInboxEntriesForUser: vi.fn().mockResolvedValue([]),
  getPendingSignatureRequests: vi.fn().mockResolvedValue([]),
  getDocumentsNeedingReminder: vi.fn().mockResolvedValue([]),
  getDocumentsNeedingExpiration: vi.fn().mockResolvedValue([]),
  createOrganization: vi.fn().mockResolvedValue(1),
  getOrganizationById: vi.fn().mockResolvedValue(null),
  getOrganizationBySlug: vi.fn().mockResolvedValue(null),
  updateOrganization: vi.fn(),
  createMembership: vi.fn().mockResolvedValue(1),
  getMembershipsByOrg: vi.fn().mockResolvedValue([]),
  getMemberUsageByOrg: vi.fn().mockResolvedValue([]),
  getDocumentsByMember: vi.fn().mockResolvedValue([]),
  updateMembershipRole: vi.fn(),
  deactivateMembership: vi.fn(),
  countActiveMembers: vi.fn().mockResolvedValue(0),
  getTemplatesByOrg: vi.fn().mockResolvedValue([]),
  getContactsByOrg: vi.fn().mockResolvedValue([]),
  getDashboardStatsByOrg: vi.fn().mockResolvedValue({ totalDocuments: 0, pendingSignatures: 0, completedDocuments: 0, sentDocuments: 0, declinedDocuments: 0, draftDocuments: 0 }),
  getRecentActivityByOrg: vi.fn().mockResolvedValue([]),
  getCategoriesByOrg: vi.fn().mockResolvedValue([]),
  getGroupsByOrg: vi.fn().mockResolvedValue([]),
  getActiveAllowedIps: vi.fn().mockResolvedValue([]),
  createAllowedIp: vi.fn().mockResolvedValue(undefined),
  deactivateAllowedIp: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://example.com/file.pdf", key: "test-key" }),
  storageGet: vi.fn().mockResolvedValue({ url: "https://example.com/signed.pdf", key: "signed-key" }),
}));
vi.mock("./storageEncryption", () => ({
  isEncryptionEnabled: vi.fn().mockReturnValue(false),
  encryptPdf: vi.fn(),
  generateProxyToken: vi.fn().mockReturnValue("12345.abc"),
  verifyProxyToken: vi.fn().mockReturnValue(true),
}));
vi.mock("./email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  buildSignatureRequestEmail: vi.fn().mockReturnValue({ subject: "署名依頼", html: "<p>test</p>" }),
  buildSignatureCompleteEmail: vi.fn().mockReturnValue({ subject: "署名完了", html: "<p>test</p>" }),
  buildAllSignedEmail: vi.fn().mockReturnValue({ subject: "全署名完了", html: "<p>test</p>" }),
  buildDeclinedEmail: vi.fn().mockReturnValue({ subject: "署名拒否", html: "<p>test</p>" }),
  buildInternalApprovalEmail: vi.fn().mockReturnValue({ subject: "approval", html: "<p>approval</p>" }),
  buildReminderEmail: vi.fn().mockReturnValue({ subject: "リマインダー", html: "<p>reminder</p>" }),
  resolveEmailLocale: vi.fn().mockImplementation((locale?: string) => locale || "ja"),
}));
vi.mock("./pdf", () => ({
  validatePdf: vi.fn().mockResolvedValue({ valid: true, pageCount: 3 }),
  embedSignaturesIntoPdf: vi.fn().mockResolvedValue(Buffer.from("signed-pdf")),
  generateSignedPdf: vi.fn().mockResolvedValue({ url: "https://example.com/signed.pdf", key: "signed-key" }),
  appendCompletionCertificate: vi.fn().mockResolvedValue(Buffer.from("cert")),
  applyPdfPermissionLock: vi.fn().mockResolvedValue({ buffer: Buffer.from("locked"), locked: true }),
  SIGNATURE_FONTS: [{ id: "dancing-script", name: "Dancing Script", cssFamily: "'Dancing Script', cursive" }],
}));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn().mockResolvedValue(true) }));
vi.mock("./stampService", () => ({ generateStampDataUrl: vi.fn().mockReturnValue("data:image/png;base64,stamp") }));
vi.mock("./auditLog", () => ({
  appendAuditLog: vi.fn().mockResolvedValue({ id: 1, recordHash: "abc" }),
  getAuditLogsByEntity: vi.fn().mockResolvedValue([]),
  getAuditLogsByOrg: vi.fn().mockResolvedValue([]),
  getAuditLogCount: vi.fn().mockResolvedValue(0),
  getAuditLogsPaginated: vi.fn().mockResolvedValue({ logs: [], total: 0 }),
  verifyHashChainIntegrity: vi.fn().mockResolvedValue({ totalRecords: 0, verifiedRecords: 0, brokenAt: null, isIntact: true }),
}));
vi.mock("./platformSignature", () => ({
  signPdfWithPlatformKey: vi.fn().mockResolvedValue(Buffer.from("signed")),
  getCertificateInfo: vi.fn().mockReturnValue({ subject: "CN=Test", serialNumber: "1", fingerprint: "AA:BB", notBefore: "2026-01-01", notAfter: "2031-01-01", isAutoGenerated: true }),
}));
vi.mock("./wormStorage", () => ({
  wormStorePdf: vi.fn().mockResolvedValue({ url: "https://example.com/worm.pdf", key: "worm/test.pdf", contentHash: "sha256-abc" }),
}));

// ==================== HELPERS ====================

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserCtx(userId: number = 1, orgId: number = 10, memberRole: "owner" | "manager" | "member" = "member"): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId, openId: `user-${userId}`, email: `user${userId}@example.com`,
    name: `ユーザー${userId}`, loginMethod: "manus", isSuperAdmin: false,
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  mockGetMembership.mockResolvedValueOnce({
    id: userId * 100, userId, organizationId: orgId, role: memberRole, isActive: true,
  });
  return {
    user,
    req: { protocol: "https", headers: { "x-organization-id": String(orgId) } } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function sampleDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, userId: 1, organizationId: 10, title: "テスト文書", status: "draft",
    description: null, fileUrl: "https://example.com/test.pdf", fileKey: "test-key",
    mimeType: "application/pdf", pageCount: 3, sequentialRouting: false,
    expirationDays: null, reminderDays: null, expiresAt: null, nextReminderAt: null,
    completedAt: null, signedFileUrl: null, signedFileKey: null, sourceTemplateId: null,
    fileName: null, fileSize: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

// ==================== TESTS ====================

describe("documents.list - multi-org support", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns docs from specified organizationId when user is a member", async () => {
    const ctx = createUserCtx(1, 10, "member");
    const orgDocs = [sampleDoc({ id: 100, organizationId: 10 })];
    mockGetDocumentsByOrg.mockResolvedValue(orgDocs);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.list();
    expect(mockGetDocumentsByOrg).toHaveBeenCalledWith(10, 1);
    expect(result).toEqual(orgDocs);
  });

  it("rejects when user is not a member of specified org", async () => {
    mockGetMembership.mockReset();
    mockGetMembership.mockResolvedValueOnce(null);
    const user: AuthenticatedUser = {
      id: 1, openId: "user-1", email: "user1@example.com", name: "ユーザー1",
      loginMethod: "manus", isSuperAdmin: false,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    };
    const ctx: TrpcContext = {
      user,
      req: { protocol: "https", headers: { "x-organization-id": "999" } } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.list()).rejects.toThrow();
  });

  it("uses the user's default organization when no x-organization-id header is provided", async () => {
    const user: AuthenticatedUser = {
      id: 1, openId: "user-1", email: "user1@example.com", name: "ユーザー1",
      loginMethod: "password", isSuperAdmin: false,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    };
    const orgDocs = [sampleDoc({ id: 100, organizationId: 10 })];
    mockGetOrganizationsByUser.mockResolvedValueOnce([{ org: { id: 10 }, membership: { role: "member" } }]);
    mockGetMembership.mockResolvedValueOnce({ id: 1, userId: 1, organizationId: 10, role: "member", isActive: true });
    mockGetDocumentsByOrg.mockResolvedValueOnce(orgDocs);
    const ctx: TrpcContext = {
      user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.list();
    expect(mockGetDocumentsByOrg).toHaveBeenCalledWith(10, 1);
    expect(result).toEqual(orgDocs);
  });
});

describe("documents.getById - member access", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("allows member to access org document", async () => {
    const ctx = createUserCtx(1, 10, "member");
    mockGetDocumentById.mockResolvedValue(sampleDoc({ userId: 1, organizationId: 10 }));
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.getById({ id: 1 });
    expect(result.title).toBe("テスト文書");
  });

  it("forbids MEMBER from viewing another user's document", async () => {
    const ctx = createUserCtx(2, 10, "member");
    mockGetDocumentById.mockResolvedValue(sampleDoc({ userId: 1, organizationId: 10 }));
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.getById({ id: 1 })).rejects.toThrow("errors.documents.ownDocumentsOnly");
  });

  it("allows OWNER of same org to view another user's document", async () => {
    const ctx = createUserCtx(3, 10, "owner");
    mockGetDocumentById.mockResolvedValue(sampleDoc({ userId: 1, organizationId: 10 }));
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.getById({ id: 1 });
    expect(result.title).toBe("テスト文書");
  });

  it("rejects when document belongs to different org", async () => {
    const ctx = createUserCtx(1, 10, "member");
    mockGetDocumentById.mockResolvedValue(sampleDoc({ userId: 1, organizationId: 20 }));
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.getById({ id: 1 })).rejects.toThrow("errors.documents.notFound");
  });

  it("rejects non-member from accessing org document", async () => {
    mockGetMembership.mockReset();
    mockGetMembership.mockResolvedValueOnce(null);
    const user: AuthenticatedUser = {
      id: 5, openId: "user-5", email: "user5@example.com", name: "ユーザー5",
      loginMethod: "manus", isSuperAdmin: false,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    };
    const ctx: TrpcContext = {
      user,
      req: { protocol: "https", headers: { "x-organization-id": "10" } } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.getById({ id: 1 })).rejects.toThrow();
  });
});

describe("documents.update - owner/manager only (not member)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("allows creator to update their own document", async () => {
    const ctx = createUserCtx(1, 10, "member");
    mockGetDocumentById.mockResolvedValue(sampleDoc({ userId: 1, organizationId: 10 }));
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.update({ id: 1, title: "更新" });
    expect(result.success).toBe(true);
  });

  it("allows org OWNER to update another user's document", async () => {
    const ctx = createUserCtx(2, 10, "owner");
    mockGetDocumentById.mockResolvedValue(sampleDoc({ userId: 1, organizationId: 10 }));
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.update({ id: 1, title: "更新" });
    expect(result.success).toBe(true);
  });

  it("allows org MANAGER to update another user's document", async () => {
    const ctx = createUserCtx(3, 10, "manager");
    mockGetDocumentById.mockResolvedValue(sampleDoc({ userId: 1, organizationId: 10 }));
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.update({ id: 1, title: "更新" });
    expect(result.success).toBe(true);
  });

  it("rejects MEMBER from updating another user's document", async () => {
    const ctx = createUserCtx(4, 10, "member");
    mockGetDocumentById.mockResolvedValue(sampleDoc({ userId: 1, organizationId: 10 }));
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.update({ id: 1, title: "更新" })).rejects.toThrow();
  });
});

describe("documents.delete - owner/manager only (not member)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("allows creator to delete their own document", async () => {
    const ctx = createUserCtx(1, 10, "member");
    mockGetDocumentById.mockResolvedValue(sampleDoc({ userId: 1, organizationId: 10 }));
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("allows org OWNER to delete another user's document", async () => {
    const ctx = createUserCtx(2, 10, "owner");
    mockGetDocumentById.mockResolvedValue(sampleDoc({ userId: 1, organizationId: 10 }));
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects MEMBER from deleting another user's document", async () => {
    const ctx = createUserCtx(4, 10, "member");
    mockGetDocumentById.mockResolvedValue(sampleDoc({ userId: 1, organizationId: 10 }));
    const caller = appRouter.createCaller(ctx);
    await expect(caller.documents.delete({ id: 1 })).rejects.toThrow();
  });
});

describe("documents.downloadSigned - org access", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("allows org owner to download signed PDF of another member", async () => {
    const ctx = createUserCtx(2, 10, "owner");
    mockGetDocumentById.mockResolvedValue(sampleDoc({
      userId: 1, organizationId: 10, status: "completed",
      signedFileUrl: "https://example.com/signed.pdf", signedFileKey: "signed-key",
    }));
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.downloadSigned({ id: 1 });
    expect(result.url).toBeDefined();
  });
});
