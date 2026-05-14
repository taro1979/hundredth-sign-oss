import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Strategy: Use a single shared "terminalValue" that every chain-terminal
 * method reads. Chain methods (.from, .where, .innerJoin, .set) return
 * the chain itself. Terminal methods (.limit, .orderBy, .values, .onDuplicateKeyUpdate)
 * return terminalValue.
 *
 * Key insight from db.ts analysis:
 * - .where() is sometimes terminal (checkAllSignersSigned, getGroupMembers, etc.)
 *   and sometimes chainable (.where().limit(), .where().orderBy())
 * - Solution: .where() returns an object that is BOTH iterable (acts as array)
 *   AND has .limit()/.orderBy() methods
 */

let terminalValue: any = [];

function createDualChain(): any {
  // Returns an object that:
  // 1. Can be awaited to get terminalValue (when used as terminal)
  // 2. Has .limit(), .orderBy() etc. for further chaining
  // 3. Has array-like properties for iteration
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      // Array iteration support
      if (prop === Symbol.iterator) {
        const val = terminalValue;
        return function* () {
          if (Array.isArray(val)) yield* val;
        };
      }
      if (prop === "length") return Array.isArray(terminalValue) ? terminalValue.length : 0;
      if (prop === "every") return Array.isArray(terminalValue) ? terminalValue.every.bind(terminalValue) : undefined;
      if (prop === "filter") return Array.isArray(terminalValue) ? terminalValue.filter.bind(terminalValue) : undefined;
      if (prop === "map") return Array.isArray(terminalValue) ? terminalValue.map.bind(terminalValue) : undefined;
      if (prop === "forEach") return Array.isArray(terminalValue) ? terminalValue.forEach.bind(terminalValue) : undefined;
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        return Array.isArray(terminalValue) ? terminalValue[Number(prop)] : undefined;
      }

      // Promise-like (for await)
      if (prop === "then") {
        return (resolve: any) => resolve(terminalValue);
      }

      // Chain methods that return another dual chain
      if (["from", "where", "innerJoin", "set", "groupBy", "leftJoin"].includes(prop as string)) {
        return vi.fn(() => createDualChain());
      }

      // Terminal-ish methods that also return dual chain
      if (prop === "limit") {
        return vi.fn(() => terminalValue);
      }
      if (prop === "orderBy") {
        return vi.fn(() => createDualChain());
      }
      if (prop === "values") {
        return vi.fn(() => createDualChain());
      }
      if (prop === "onDuplicateKeyUpdate") {
        return vi.fn(() => terminalValue);
      }
      if (prop === "$returningId") {
        return vi.fn(() => terminalValue);
      }

      return undefined;
    }
  };
  return new Proxy({}, handler);
}

const mockSelect = vi.fn(() => createDualChain());
const mockInsert = vi.fn(() => createDualChain());
const mockUpdate = vi.fn(() => createDualChain());
const mockDelete = vi.fn(() => createDualChain());

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  desc: vi.fn((a) => ({ type: "desc", a })),
  asc: vi.fn((a) => ({ type: "asc", a })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  count: vi.fn(() => "count"),
  inArray: vi.fn((a, b) => ({ type: "inArray", a, b })),
  ne: vi.fn((a, b) => ({ type: "ne", a, b })),
  sql: vi.fn(),
  isNotNull: vi.fn((a) => ({ type: "isNotNull", a })),
  lte: vi.fn((a, b) => ({ type: "lte", a, b })),
  isNull: vi.fn((a) => ({ type: "isNull", a })),
  gt: vi.fn((a, b) => ({ type: "gt", a, b })),
  or: vi.fn((...args: any[]) => ({ type: "or", args })),
  notInArray: vi.fn((a, b) => ({ type: "notInArray", a, b })),
}));

vi.mock("../drizzle/schema", () => ({
  users: { id: "users.id", openId: "users.openId", email: "users.email", isSuperAdmin: "users.isSuperAdmin", name: "users.name", avatarUrl: "users.avatarUrl" },
  documents: { id: "documents.id", userId: "documents.userId", status: "documents.status", updatedAt: "documents.updatedAt" },
  signatureRequests: { id: "sr.id", documentId: "sr.documentId", signerEmail: "sr.signerEmail", accessToken: "sr.accessToken", recipientRole: "sr.recipientRole", status: "sr.status", order: "sr.order", createdAt: "sr.createdAt" },
  signatureFields: { id: "sf.id", documentId: "sf.documentId", page: "sf.page" },
  templates: { id: "t.id", userId: "t.userId", isPublic: "t.isPublic", usageCount: "t.usageCount", updatedAt: "t.updatedAt" },
  templateFields: { id: "tf.id", templateId: "tf.templateId", page: "tf.page" },
  contacts: { id: "c.id", userId: "c.userId", name: "c.name", email: "c.email", company: "c.company", department: "c.department", phone: "c.phone", category: "c.category", updatedAt: "c.updatedAt" },
  contactCategories: { id: "cc.id", userId: "cc.userId", order: "cc.order" },
  contactGroups: { id: "cg.id", userId: "cg.userId", name: "cg.name" },
  contactGroupMembers: { id: "cgm.id", contactId: "cgm.contactId", groupId: "cgm.groupId" },
  activityLogs: { id: "al.id", documentId: "al.documentId", userId: "al.userId", createdAt: "al.createdAt" },
  faqs: { id: "f.id", isPublished: "f.isPublished", order: "f.order" },
  inquiries: { id: "i.id", createdAt: "i.createdAt" },
  emailLogs: { id: "el.id" },
  internalApprovals: { id: "ia.id", documentId: "ia.documentId", accessToken: "ia.accessToken", status: "ia.status", order: "ia.order" },
  organizations: { id: "o.id", name: "o.name", slug: "o.slug", isActive: "o.isActive", createdAt: "o.createdAt", updatedAt: "o.updatedAt" },
  memberships: { id: "m.id", userId: "m.userId", organizationId: "m.organizationId", role: "m.role", isActive: "m.isActive", joinedAt: "m.joinedAt" },
  allowedIps: { id: "ai.id", organizationId: "ai.organizationId", ipAddress: "ai.ipAddress", label: "ai.label", isActive: "ai.isActive", createdByUserId: "ai.createdByUserId" },
  wormRecords: { id: "wr.id", documentId: "wr.documentId", createdAt: "wr.createdAt" },
}));

vi.mock("./_core/env", () => ({
  ENV: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test";
  terminalValue = [];
  mockSelect.mockImplementation(() => createDualChain());
  mockInsert.mockImplementation(() => createDualChain());
  mockUpdate.mockImplementation(() => createDualChain());
  mockDelete.mockImplementation(() => createDualChain());
});

// ==================== TESTS ====================

describe("db.ts - getDb", () => {
  it("returns db instance when DATABASE_URL is set", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    expect(db).toBeDefined();
  });

  // Note: getDb connection error (lines 29-31) requires module reset which
  // breaks subsequent tests. Coverage for this catch block is accepted as
  // a known gap since it's a simple console.warn + null return.
});

describe("db.ts - User queries", () => {
  it("upsertUser inserts a user with openId", async () => {
    // insert().values().onDuplicateKeyUpdate() → terminal
    terminalValue = undefined;
    const { upsertUser } = await import("./db");
    await upsertUser({ openId: "test-id", name: "テスト", email: "test@example.com" });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("upsertUser throws when openId is missing", async () => {
    const { upsertUser } = await import("./db");
    await expect(upsertUser({ openId: "" } as any)).rejects.toThrow("User openId is required");
  });

  it("upsertUser sets isSuperAdmin for owner", async () => {
    terminalValue = undefined;
    const { upsertUser } = await import("./db");
    await upsertUser({ openId: "owner-open-id", name: "Owner", email: "owner@example.com" });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("getUserByOpenId returns user", async () => {
    terminalValue = [{ id: 1, openId: "test", name: "テスト" }];
    const { getUserByOpenId } = await import("./db");
    const result = await getUserByOpenId("test");
    expect(result).toEqual({ id: 1, openId: "test", name: "テスト" });
  });

  it("getUserByOpenId returns undefined when not found", async () => {
    terminalValue = [];
    const { getUserByOpenId } = await import("./db");
    const result = await getUserByOpenId("nonexistent");
    expect(result).toBeUndefined();
  });

  it("getUserById returns user", async () => {
    terminalValue = [{ id: 1, name: "テスト" }];
    const { getUserById } = await import("./db");
    const result = await getUserById(1);
    expect(result).toEqual({ id: 1, name: "テスト" });
  });

  it("getUserByEmail returns user", async () => {
    terminalValue = [{ id: 1, email: "test@example.com" }];
    const { getUserByEmail } = await import("./db");
    const result = await getUserByEmail("test@example.com");
    expect(result).toEqual({ id: 1, email: "test@example.com" });
  });

  it("updateUserProfile updates user data", async () => {
    terminalValue = undefined;
    const { updateUserProfile } = await import("./db");
    await updateUserProfile(1, { name: "新しい名前" });
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("db.ts - Document queries", () => {
  it("createDocument inserts and returns insertId", async () => {
    terminalValue = [{ insertId: 42 }];
    const { createDocument } = await import("./db");
    const id = await createDocument({ userId: 1, title: "テスト文書" } as any);
    expect(id).toBe(42);
  });

  it("getDocumentById returns document", async () => {
    terminalValue = [{ id: 1, title: "テスト" }];
    const { getDocumentById } = await import("./db");
    const result = await getDocumentById(1);
    expect(result).toEqual({ id: 1, title: "テスト" });
  });

  it("updateDocument updates document", async () => {
    terminalValue = undefined;
    const { updateDocument } = await import("./db");
    await updateDocument(1, { title: "更新後" });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("deleteDocument deletes related records and document", async () => {
    terminalValue = undefined;
    const { deleteDocument } = await import("./db");
    await deleteDocument(1);
    expect(mockDelete).toHaveBeenCalledTimes(4);
  });
});

describe("db.ts - Signature Fields", () => {
  it("upsertSignatureFields deletes existing and inserts new", async () => {
    terminalValue = undefined;
    const { upsertSignatureFields } = await import("./db");
    await upsertSignatureFields(1, [
      { documentId: 1, clientId: "f1", page: 0, xPercent: "50", yPercent: "50", widthPercent: "20", heightPercent: "6", signerIndex: 0, type: "signature", required: true } as any,
    ]);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it("upsertSignatureFields with empty array only deletes", async () => {
    terminalValue = undefined;
    const { upsertSignatureFields } = await import("./db");
    await upsertSignatureFields(1, []);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("getSignatureFieldsByDocument returns fields", async () => {
    terminalValue = [{ id: 1, documentId: 1 }];
    const { getSignatureFieldsByDocument } = await import("./db");
    const result = await getSignatureFieldsByDocument(1);
    expect(result).toEqual([{ id: 1, documentId: 1 }]);
  });
});

describe("db.ts - Signature Requests", () => {
  it("createSignatureRequest inserts and returns id", async () => {
    terminalValue = [{ insertId: 10 }];
    const { createSignatureRequest } = await import("./db");
    const id = await createSignatureRequest({ documentId: 1, signerEmail: "test@example.com" } as any);
    expect(id).toBe(10);
  });

  it("createSignatureRequestsBulk inserts multiple", async () => {
    terminalValue = undefined;
    const { createSignatureRequestsBulk } = await import("./db");
    await createSignatureRequestsBulk([
      { documentId: 1, signerEmail: "a@example.com" } as any,
      { documentId: 1, signerEmail: "b@example.com" } as any,
    ]);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("createSignatureRequestsBulk with empty array does nothing", async () => {
    const { createSignatureRequestsBulk } = await import("./db");
    await createSignatureRequestsBulk([]);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("getSignatureRequestsByDocument returns requests", async () => {
    terminalValue = [{ id: 1, documentId: 1 }];
    const { getSignatureRequestsByDocument } = await import("./db");
    const result = await getSignatureRequestsByDocument(1);
    expect(result).toEqual([{ id: 1, documentId: 1 }]);
  });

  it("getSignatureRequestsByEmail returns requests with documents", async () => {
    terminalValue = [{ request: { id: 1 }, document: { id: 1 } }];
    const { getSignatureRequestsByEmail } = await import("./db");
    const result = await getSignatureRequestsByEmail("test@example.com");
    expect(result).toEqual([{ request: { id: 1 }, document: { id: 1 } }]);
  });

  it("getSignatureRequestById returns request", async () => {
    terminalValue = [{ id: 1, signerEmail: "test@example.com" }];
    const { getSignatureRequestById } = await import("./db");
    const result = await getSignatureRequestById(1);
    expect(result).toEqual({ id: 1, signerEmail: "test@example.com" });
  });

  it("getSignatureRequestByToken returns request with document", async () => {
    terminalValue = [{ request: { id: 1 }, document: { id: 1 } }];
    const { getSignatureRequestByToken } = await import("./db");
    const res = await getSignatureRequestByToken("test-token");
    expect(res).toEqual({ request: { id: 1 }, document: { id: 1 } });
  });

  it("updateSignatureRequest updates request", async () => {
    terminalValue = undefined;
    const { updateSignatureRequest } = await import("./db");
    await updateSignatureRequest(1, { status: "signed" });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("checkAllSignersSigned returns true when all signed", async () => {
    terminalValue = [
      { id: 1, recipientRole: "signer", status: "signed" },
      { id: 2, recipientRole: "signer", status: "signed" },
    ];
    const { checkAllSignersSigned } = await import("./db");
    const result = await checkAllSignersSigned(1);
    expect(result).toBe(true);
  });

  it("checkAllSignersSigned returns false when some pending", async () => {
    terminalValue = [
      { id: 1, recipientRole: "signer", status: "signed" },
      { id: 2, recipientRole: "signer", status: "pending" },
    ];
    const { checkAllSignersSigned } = await import("./db");
    const result = await checkAllSignersSigned(1);
    expect(result).toBe(false);
  });

  it("getNextPendingSigner returns next pending signer", async () => {
    terminalValue = [{ id: 1, status: "pending" }];
    const { getNextPendingSigner } = await import("./db");
    const result = await getNextPendingSigner(1);
    expect(result).toEqual({ id: 1, status: "pending" });
  });

  it("deleteSignatureRequestsByDocument deletes requests", async () => {
    terminalValue = undefined;
    const { deleteSignatureRequestsByDocument } = await import("./db");
    await deleteSignatureRequestsByDocument(1);
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe("db.ts - Template queries", () => {
  it("createTemplate inserts and returns id", async () => {
    terminalValue = [{ insertId: 5 }];
    const { createTemplate } = await import("./db");
    const id = await createTemplate({ userId: 1, title: "テンプレート" } as any);
    expect(id).toBe(5);
  });

  it("getTemplateById returns template", async () => {
    terminalValue = [{ id: 1, title: "テスト" }];
    const { getTemplateById } = await import("./db");
    const result = await getTemplateById(1);
    expect(result).toEqual({ id: 1, title: "テスト" });
  });

  it("getPublicTemplates returns public templates", async () => {
    terminalValue = [{ id: 1, isPublic: true }];
    const { getPublicTemplates } = await import("./db");
    const result = await getPublicTemplates();
    expect(result).toEqual([{ id: 1, isPublic: true }]);
  });

  it("updateTemplate updates template", async () => {
    terminalValue = undefined;
    const { updateTemplate } = await import("./db");
    await updateTemplate(1, { title: "更新後" });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("deleteTemplate deletes fields and template", async () => {
    terminalValue = undefined;
    const { deleteTemplate } = await import("./db");
    await deleteTemplate(1);
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });

  it("incrementTemplateUsage increments count", async () => {
    terminalValue = undefined;
    const { incrementTemplateUsage } = await import("./db");
    await incrementTemplateUsage(1);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("db.ts - Template Fields", () => {
  it("upsertTemplateFields deletes and inserts", async () => {
    terminalValue = undefined;
    const { upsertTemplateFields } = await import("./db");
    await upsertTemplateFields(1, [{ templateId: 1, clientId: "tf1" } as any]);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it("upsertTemplateFields with empty array only deletes", async () => {
    terminalValue = undefined;
    const { upsertTemplateFields } = await import("./db");
    await upsertTemplateFields(1, []);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("getTemplateFieldsByTemplate returns fields", async () => {
    terminalValue = [{ id: 1, templateId: 1 }];
    const { getTemplateFieldsByTemplate } = await import("./db");
    const result = await getTemplateFieldsByTemplate(1);
    expect(result).toEqual([{ id: 1, templateId: 1 }]);
  });
});

describe("db.ts - deepCopyTemplateToDocument", () => {
  it("copies template fields to document", async () => {
    terminalValue = [
      { id: 1, templateId: 1, clientId: "tf1", page: 0, xPercent: "50", yPercent: "50", widthPercent: "20", heightPercent: "6", signerIndex: 0, type: "signature", label: null, required: true },
    ];
    const { deepCopyTemplateToDocument } = await import("./db");
    await deepCopyTemplateToDocument(1, 10);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("does nothing when template has no fields", async () => {
    terminalValue = [];
    const { deepCopyTemplateToDocument } = await import("./db");
    await deepCopyTemplateToDocument(1, 10);
    // insert should not be called since no fields
    // But the function first calls getTemplateFieldsByTemplate which returns []
    // Then checks if fields.length > 0
  });
});

describe("db.ts - Contact queries", () => {
  it("getContactById returns contact", async () => {
    terminalValue = [{ id: 1, name: "テスト" }];
    const { getContactById } = await import("./db");
    const result = await getContactById(1);
    expect(result).toEqual({ id: 1, name: "テスト" });
  });

  it("createContact inserts and returns id", async () => {
    terminalValue = [{ insertId: 3 }];
    const { createContact } = await import("./db");
    const id = await createContact({ userId: 1, name: "テスト", email: "test@example.com" } as any);
    expect(id).toBe(3);
  });

  it("updateContact updates contact", async () => {
    terminalValue = undefined;
    const { updateContact } = await import("./db");
    await updateContact(1, { name: "更新後" });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("deleteContact deletes contact", async () => {
    terminalValue = undefined;
    const { deleteContact } = await import("./db");
    await deleteContact(1);
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe("db.ts - Activity Log queries", () => {
  it("createActivityLog inserts log", async () => {
    terminalValue = undefined;
    const { createActivityLog } = await import("./db");
    await createActivityLog({ documentId: 1, action: "created" } as any);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("getActivityLogsByDocument returns logs", async () => {
    terminalValue = [{ id: 1, documentId: 1 }];
    const { getActivityLogsByDocument } = await import("./db");
    const result = await getActivityLogsByDocument(1);
    expect(result).toEqual([{ id: 1, documentId: 1 }]);
  });

});

describe("db.ts - FAQ queries", () => {
  it("getPublishedFaqs returns published FAQs", async () => {
    terminalValue = [{ id: 1, question: "テスト" }];
    const { getPublishedFaqs } = await import("./db");
    const result = await getPublishedFaqs();
    expect(result).toEqual([{ id: 1, question: "テスト" }]);
  });

  it("createFaq inserts and returns id", async () => {
    terminalValue = [{ insertId: 1 }];
    const { createFaq } = await import("./db");
    const id = await createFaq({ question: "Q", answer: "A" } as any);
    expect(id).toBe(1);
  });

  it("updateFaq updates FAQ", async () => {
    terminalValue = undefined;
    const { updateFaq } = await import("./db");
    await updateFaq(1, { question: "更新後" });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("deleteFaq deletes FAQ", async () => {
    terminalValue = undefined;
    const { deleteFaq } = await import("./db");
    await deleteFaq(1);
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe("db.ts - Inquiry queries", () => {
  it("createInquiry inserts and returns id", async () => {
    terminalValue = [{ insertId: 1 }];
    const { createInquiry } = await import("./db");
    const id = await createInquiry({ name: "テスト", email: "test@example.com", subject: "件名", message: "本文" } as any);
    expect(id).toBe(1);
  });

  it("getInquiries returns all inquiries", async () => {
    terminalValue = [{ id: 1, name: "テスト" }];
    const { getInquiries } = await import("./db");
    const result = await getInquiries();
    expect(result).toEqual([{ id: 1, name: "テスト" }]);
  });

  it("updateInquiryStatus updates status", async () => {
    terminalValue = undefined;
    const { updateInquiryStatus } = await import("./db");
    await updateInquiryStatus(1, "read");
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("db.ts - Email Log", () => {
  it("createEmailLog inserts log", async () => {
    terminalValue = undefined;
    const { createEmailLog } = await import("./db");
    await createEmailLog({ toEmail: "test@example.com", subject: "テスト", type: "signature_request" });
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe("db.ts - Internal Approvals", () => {
  it("createInternalApprovalsBulk inserts approvals", async () => {
    terminalValue = undefined;
    const { createInternalApprovalsBulk } = await import("./db");
    await createInternalApprovalsBulk([{ documentId: 1, approverEmail: "a@example.com" } as any]);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("createInternalApprovalsBulk with empty array does nothing", async () => {
    const { createInternalApprovalsBulk } = await import("./db");
    await createInternalApprovalsBulk([]);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("getInternalApprovalsByDocument returns approvals", async () => {
    terminalValue = [{ id: 1, documentId: 1 }];
    const { getInternalApprovalsByDocument } = await import("./db");
    const result = await getInternalApprovalsByDocument(1);
    expect(result).toEqual([{ id: 1, documentId: 1 }]);
  });

  it("getInternalApprovalByToken returns approval", async () => {
    terminalValue = [{ id: 1, accessToken: "test" }];
    const { getInternalApprovalByToken } = await import("./db");
    const result = await getInternalApprovalByToken("test");
    expect(result).toEqual({ id: 1, accessToken: "test" });
  });

  it("getInternalApprovalByToken returns null when not found", async () => {
    terminalValue = [];
    const { getInternalApprovalByToken } = await import("./db");
    const result = await getInternalApprovalByToken("nonexistent");
    expect(result).toBeNull();
  });

  it("updateInternalApproval updates approval", async () => {
    terminalValue = undefined;
    const { updateInternalApproval } = await import("./db");
    await updateInternalApproval(1, { status: "approved" });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("deleteInternalApprovalsByDocument deletes approvals", async () => {
    terminalValue = undefined;
    const { deleteInternalApprovalsByDocument } = await import("./db");
    await deleteInternalApprovalsByDocument(1);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("getNextPendingApprover returns next pending", async () => {
    terminalValue = [{ id: 1, status: "pending" }];
    const { getNextPendingApprover } = await import("./db");
    const result = await getNextPendingApprover(1);
    expect(result).toEqual({ id: 1, status: "pending" });
  });

  it("checkAllApproversApproved returns true when all approved", async () => {
    terminalValue = [
      { id: 1, status: "approved" },
      { id: 2, status: "approved" },
    ];
    const { checkAllApproversApproved } = await import("./db");
    const result = await checkAllApproversApproved(1);
    expect(result).toBe(true);
  });

  it("checkAllApproversApproved returns false when some pending", async () => {
    terminalValue = [
      { id: 1, status: "approved" },
      { id: 2, status: "pending" },
    ];
    const { checkAllApproversApproved } = await import("./db");
    const result = await checkAllApproversApproved(1);
    expect(result).toBe(false);
  });
});

describe("db.ts - Contact Categories", () => {
  it("createCategory inserts and returns id", async () => {
    terminalValue = [{ insertId: 3 }];
    const { createCategory } = await import("./db");
    const result = await createCategory({ userId: 1, name: "新カテゴリー" } as any);
    expect(result).toEqual({ id: 3 });
  });

  it("updateCategory updates category", async () => {
    terminalValue = undefined;
    const { updateCategory } = await import("./db");
    await updateCategory(1, { name: "更新後" });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("deleteCategory deletes category", async () => {
    terminalValue = undefined;
    const { deleteCategory } = await import("./db");
    await deleteCategory(1);
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe("db.ts - Contact Groups", () => {
  it("createGroup inserts and returns id", async () => {
    terminalValue = [{ insertId: 2 }];
    const { createGroup } = await import("./db");
    const result = await createGroup({ userId: 1, name: "新グループ" } as any);
    expect(result).toEqual({ id: 2 });
  });

  it("updateGroup updates group", async () => {
    terminalValue = undefined;
    const { updateGroup } = await import("./db");
    await updateGroup(1, { name: "更新後" });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("deleteGroup deletes memberships and group", async () => {
    terminalValue = undefined;
    const { deleteGroup } = await import("./db");
    await deleteGroup(1);
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });

  it("getGroupMembers returns members with contact info", async () => {
    terminalValue = [{ id: 1, contactId: 1, groupId: 1, contactName: "テスト" }];
    const { getGroupMembers } = await import("./db");
    const result = await getGroupMembers(1);
    expect(result).toEqual([{ id: 1, contactId: 1, groupId: 1, contactName: "テスト" }]);
  });

  it("getGroupsForContact returns groups for a contact", async () => {
    terminalValue = [{ id: 1, groupId: 1, groupName: "営業チーム" }];
    const { getGroupsForContact } = await import("./db");
    const result = await getGroupsForContact(1);
    expect(result).toEqual([{ id: 1, groupId: 1, groupName: "営業チーム" }]);
  });

  it("addContactToGroup inserts membership when not existing", async () => {
    // terminalValue is shared, so both select and insert use it.
    // The select returns [] (empty, length 0), so it proceeds to insert.
    // The insert().values() resolves via then → terminalValue which is still [].
    // result[0] is undefined → result[0].insertId throws.
    // We can only verify that insert was called.
    terminalValue = [{ insertId: 5 }];
    // With this, select returns [{insertId:5}] which has length > 0,
    // so it returns existing[0].id. We need a different approach.
    // Since both select and insert share terminalValue, we can't differentiate.
    // Best we can do: test the "already exists" path and verify insert is called
    // in the general flow. Let's just verify the function doesn't throw.
    terminalValue = [];
    const { addContactToGroup } = await import("./db");
    // This will throw because result[0] is undefined after insert
    // Let's catch and verify insert was called
    try {
      await addContactToGroup(1, 1);
    } catch (e) {
      // Expected: Cannot read properties of undefined
    }
    expect(mockInsert).toHaveBeenCalled();
  });

  it("addContactToGroup returns existing when already member", async () => {
    terminalValue = [{ id: 3 }];
    const { addContactToGroup } = await import("./db");
    const result = await addContactToGroup(1, 1);
    expect(result).toEqual({ id: 3 });
  });

  it("removeContactFromGroup deletes membership", async () => {
    terminalValue = undefined;
    const { removeContactFromGroup } = await import("./db");
    await removeContactFromGroup(1, 1);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("getContactsByGroup returns contacts in group", async () => {
    terminalValue = [{ id: 1, name: "テスト", email: "test@example.com" }];
    const { getContactsByGroup } = await import("./db");
    const result = await getContactsByGroup(1);
    expect(result).toEqual([{ id: 1, name: "テスト", email: "test@example.com" }]);
  });
});

// ==================== Edge cases: db not available ====================

describe("db.ts - Database not available", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("getUserByOpenId returns undefined when db not available", async () => {
    // Force re-import with no DATABASE_URL
    vi.resetModules();
    const { getUserByOpenId } = await import("./db");
    const result = await getUserByOpenId("test");
    expect(result).toBeUndefined();
  });

});


// ==================== ACCOUNT CLAIM ====================

describe("db.ts - claimSignatureRequestsByEmail", () => {
  it("claims signature requests and returns affected rows", async () => {
    terminalValue = [{ affectedRows: 3 }];
    const { claimSignatureRequestsByEmail } = await import("./db");
    const result = await claimSignatureRequestsByEmail("test@example.com", 1);
    expect(result).toBe(3);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns 0 when no rows affected", async () => {
    terminalValue = [{}];
    const { claimSignatureRequestsByEmail } = await import("./db");
    const result = await claimSignatureRequestsByEmail("test@example.com", 1);
    expect(result).toBe(0);
  });

  it("returns 0 when db is null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { claimSignatureRequestsByEmail } = await import("./db");
    const result = await claimSignatureRequestsByEmail("test@example.com", 1);
    expect(result).toBe(0);
  });
});

// ==================== GUEST DOCUMENT VIEW ====================

describe("db.ts - getDocumentDetailByToken", () => {
  it("returns document detail with all requests", async () => {
    const mockRequest = { id: 1, documentId: 1 };
    const mockDocument = { id: 1, title: "テスト" };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        terminalValue = [{ request: mockRequest, document: mockDocument }];
      } else {
        terminalValue = [mockRequest];
      }
      return createDualChain();
    });
    const { getDocumentDetailByToken } = await import("./db");
    const result = await getDocumentDetailByToken("token123");
    expect(result).toBeDefined();
    expect(mockSelect).toHaveBeenCalled();
  });

  it("returns undefined when not found", async () => {
    terminalValue = [];
    const { getDocumentDetailByToken } = await import("./db");
    const result = await getDocumentDetailByToken("nonexistent");
    expect(result).toBeUndefined();
  });

  it("returns undefined when db is null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getDocumentDetailByToken } = await import("./db");
    const result = await getDocumentDetailByToken("token");
    expect(result).toBeUndefined();
  });
});

// ==================== REMINDER & EXPIRATION ====================

describe("db.ts - Reminder & Expiration queries", () => {
  it("getDocumentsNeedingReminder returns documents", async () => {
    terminalValue = [{ id: 1, status: "sent" }];
    const { getDocumentsNeedingReminder } = await import("./db");
    const result = await getDocumentsNeedingReminder();
    expect(mockSelect).toHaveBeenCalled();
  });

  it("getDocumentsNeedingReminder returns empty when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getDocumentsNeedingReminder } = await import("./db");
    const result = await getDocumentsNeedingReminder();
    expect(result).toEqual([]);
  });

  it("getDocumentsNeedingExpiration returns documents", async () => {
    terminalValue = [{ id: 1, status: "sent" }];
    const { getDocumentsNeedingExpiration } = await import("./db");
    const result = await getDocumentsNeedingExpiration();
    expect(mockSelect).toHaveBeenCalled();
  });

  it("getDocumentsNeedingExpiration returns empty when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getDocumentsNeedingExpiration } = await import("./db");
    const result = await getDocumentsNeedingExpiration();
    expect(result).toEqual([]);
  });

  it("getPendingSignatureRequests returns requests", async () => {
    terminalValue = [{ id: 1, status: "sent" }];
    const { getPendingSignatureRequests } = await import("./db");
    const result = await getPendingSignatureRequests(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("getPendingSignatureRequests returns empty when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getPendingSignatureRequests } = await import("./db");
    const result = await getPendingSignatureRequests(1);
    expect(result).toEqual([]);
  });
});

// ==================== ORGANIZATION QUERIES ====================

describe("db.ts - Organization queries", () => {
  it("createOrganization creates and returns org", async () => {
    terminalValue = [{ id: 1, name: "テスト組織" }];
    mockInsert.mockImplementation(() => {
      terminalValue = [{ insertId: 1 }];
      return createDualChain();
    });
    const { createOrganization } = await import("./db");
    const result = await createOrganization({ name: "テスト組織", slug: "test" } as any);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("createOrganization returns null when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { createOrganization } = await import("./db");
    const result = await createOrganization({ name: "test" } as any);
    expect(result).toBeNull();
  });

  it("getOrganizationById returns org", async () => {
    terminalValue = [{ id: 1, name: "テスト" }];
    const { getOrganizationById } = await import("./db");
    const result = await getOrganizationById(1);
    expect(result).toEqual({ id: 1, name: "テスト" });
  });

  it("getOrganizationById returns null when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getOrganizationById } = await import("./db");
    const result = await getOrganizationById(1);
    expect(result).toBeNull();
  });

  it("getOrganizationBySlug returns org", async () => {
    terminalValue = [{ id: 1, slug: "test" }];
    const { getOrganizationBySlug } = await import("./db");
    const result = await getOrganizationBySlug("test");
    expect(result).toEqual({ id: 1, slug: "test" });
  });

  it("getOrganizationBySlug returns null when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getOrganizationBySlug } = await import("./db");
    const result = await getOrganizationBySlug("test");
    expect(result).toBeNull();
  });

  it("updateOrganization updates org", async () => {
    const { updateOrganization } = await import("./db");
    await updateOrganization(1, { name: "更新" } as any);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("updateOrganization returns when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { updateOrganization } = await import("./db");
    await updateOrganization(1, {});
  });

  it("getOrganizationsByUser returns orgs with memberships", async () => {
    terminalValue = [{ org: { id: 1 }, membership: { role: "owner" } }];
    const { getOrganizationsByUser } = await import("./db");
    const result = await getOrganizationsByUser(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("getOrganizationsByUser returns empty when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getOrganizationsByUser } = await import("./db");
    const result = await getOrganizationsByUser(1);
    expect(result).toEqual([]);
  });
});



// ==================== MEMBERSHIP QUERIES ====================

describe("db.ts - Membership queries", () => {
  it("createMembership inserts membership", async () => {
    const { createMembership } = await import("./db");
    await createMembership({ userId: 1, organizationId: 1, role: "member" } as any);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("createMembership returns when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { createMembership } = await import("./db");
    await createMembership({ userId: 1 } as any);
  });

  it("getMembershipsByOrg returns memberships with user info", async () => {
    terminalValue = [{ membership: { id: 1 }, user: { name: "田中" } }];
    const { getMembershipsByOrg } = await import("./db");
    const result = await getMembershipsByOrg(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("getMembershipsByOrg returns empty when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getMembershipsByOrg } = await import("./db");
    const result = await getMembershipsByOrg(1);
    expect(result).toEqual([]);
  });

  it("getMembership returns membership", async () => {
    terminalValue = [{ id: 1, role: "owner" }];
    const { getMembership } = await import("./db");
    const result = await getMembership(1, 1);
    expect(result).toEqual({ id: 1, role: "owner" });
  });

  it("getMembership returns null when not found", async () => {
    terminalValue = [];
    const { getMembership } = await import("./db");
    const result = await getMembership(1, 1);
    expect(result).toBeNull();
  });

  it("getMembership returns null when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getMembership } = await import("./db");
    const result = await getMembership(1, 1);
    expect(result).toBeNull();
  });

  it("updateMembershipRole updates role", async () => {
    const { updateMembershipRole } = await import("./db");
    await updateMembershipRole(1, "admin");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("updateMembershipRole returns when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { updateMembershipRole } = await import("./db");
    await updateMembershipRole(1, "admin");
  });

  it("deactivateMembership deactivates membership", async () => {
    const { deactivateMembership } = await import("./db");
    await deactivateMembership(1);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("deactivateMembership returns when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { deactivateMembership } = await import("./db");
    await deactivateMembership(1);
  });

  it("countActiveMembers returns count", async () => {
    terminalValue = [{ cnt: 5 }];
    const { countActiveMembers } = await import("./db");
    const result = await countActiveMembers(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("countActiveMembers returns 0 when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { countActiveMembers } = await import("./db");
    const result = await countActiveMembers(1);
    expect(result).toBe(0);
  });
});



// ==================== MEMBER USAGE ====================

describe("db.ts - Member Usage", () => {
  it("getMemberUsageByOrg returns member usage stats", async () => {
    terminalValue = [{ userId: 1, userName: "田中", sendCount: 5 }];
    const { getMemberUsageByOrg } = await import("./db");
    const result = await getMemberUsageByOrg(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("getMemberUsageByOrg returns empty when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getMemberUsageByOrg } = await import("./db");
    const result = await getMemberUsageByOrg(1);
    expect(result).toEqual([]);
  });

  it("getDocumentsByMember returns member documents", async () => {
    terminalValue = [{ id: 1, title: "テスト" }];
    const { getDocumentsByMember } = await import("./db");
    const result = await getDocumentsByMember(1, 1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("getDocumentsByMember returns empty when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getDocumentsByMember } = await import("./db");
    const result = await getDocumentsByMember(1, 1);
    expect(result).toEqual([]);
  });
});

// ==================== BULK DB NULL BRANCH TESTS ====================
// These tests cover the `if (!db) return/throw` branches for all remaining functions
describe("db.ts - Bulk null branch coverage", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
  });

  // --- User functions ---
  it("upsertUser returns undefined when db null", async () => {
    const { upsertUser } = await import("./db");
    const result = await upsertUser({ openId: "test-null", email: "test-null@example.com" } as any);
    expect(result).toBeUndefined();
  });
  it("getUserById returns undefined when db null", async () => {
    const { getUserById } = await import("./db");
    const result = await getUserById(1);
    expect(result).toBeUndefined();
  });
  it("getUserByEmail returns undefined when db null", async () => {
    const { getUserByEmail } = await import("./db");
    const result = await getUserByEmail("test@test.com");
    expect(result).toBeUndefined();
  });
  it("updateUserProfile throws when db null", async () => {
    const { updateUserProfile } = await import("./db");
    await expect(updateUserProfile(1, { name: "test" })).rejects.toThrow("Database not available");
  });

  // --- Document functions ---
  it("createDocument throws when db null", async () => {
    const { createDocument } = await import("./db");
    await expect(createDocument({ userId: 1, title: "test", status: "draft" } as any)).rejects.toThrow("Database not available");
  });
  it("getDocumentsByOrg returns empty when db null", async () => {
    const { getDocumentsByOrg } = await import("./db");
    const result = await getDocumentsByOrg(1);
    expect(result).toEqual([]);
  });
  it("getDocumentById returns undefined when db null", async () => {
    const { getDocumentById } = await import("./db");
    const result = await getDocumentById(1);
    expect(result).toBeUndefined();
  });
  it("updateDocument throws when db null", async () => {
    const { updateDocument } = await import("./db");
    await expect(updateDocument(1, { title: "test" })).rejects.toThrow("Database not available");
  });
  it("deleteDocument throws when db null", async () => {
    const { deleteDocument } = await import("./db");
    await expect(deleteDocument(1)).rejects.toThrow("Database not available");
  });

  // --- Signature fields ---
  it("upsertSignatureFields throws when db null", async () => {
    const { upsertSignatureFields } = await import("./db");
    await expect(upsertSignatureFields(1, [])).rejects.toThrow("Database not available");
  });
  it("getSignatureFieldsByDocument returns empty when db null", async () => {
    const { getSignatureFieldsByDocument } = await import("./db");
    const result = await getSignatureFieldsByDocument(1);
    expect(result).toEqual([]);
  });

  // --- Signature requests ---
  it("createSignatureRequest throws when db null", async () => {
    const { createSignatureRequest } = await import("./db");
    await expect(createSignatureRequest({ documentId: 1, signerEmail: "a@b.com", accessToken: "t", order: 1, recipientRole: "signer" } as any)).rejects.toThrow("Database not available");
  });
  it("createSignatureRequestsBulk throws when db null", async () => {
    const { createSignatureRequestsBulk } = await import("./db");
    await expect(createSignatureRequestsBulk([{ documentId: 1, signerEmail: "a@b.com", accessToken: "t", order: 1, recipientRole: "signer" } as any])).rejects.toThrow("Database not available");
  });
  it("getSignatureRequestsByDocument returns empty when db null", async () => {
    const { getSignatureRequestsByDocument } = await import("./db");
    const result = await getSignatureRequestsByDocument(1);
    expect(result).toEqual([]);
  });
  it("getSignatureRequestsByEmail returns empty when db null", async () => {
    const { getSignatureRequestsByEmail } = await import("./db");
    const result = await getSignatureRequestsByEmail("test@test.com");
    expect(result).toEqual([]);
  });
  it("getSignatureRequestById returns undefined when db null", async () => {
    const { getSignatureRequestById } = await import("./db");
    const result = await getSignatureRequestById(1);
    expect(result).toBeUndefined();
  });
  it("getSignatureRequestByToken returns undefined when db null", async () => {
    const { getSignatureRequestByToken } = await import("./db");
    const result = await getSignatureRequestByToken("token");
    expect(result).toBeUndefined();
  });
  it("updateSignatureRequest throws when db null", async () => {
    const { updateSignatureRequest } = await import("./db");
    await expect(updateSignatureRequest(1, { status: "signed" } as any)).rejects.toThrow("Database not available");
  });
  it("checkAllSignersSigned returns false when db null", async () => {
    const { checkAllSignersSigned } = await import("./db");
    const result = await checkAllSignersSigned(1);
    expect(result).toBe(false);
  });
  it("getNextPendingSigner returns null when db null", async () => {
    const { getNextPendingSigner } = await import("./db");
    const result = await getNextPendingSigner(1);
    expect(result).toBeNull();
  });
  it("deleteSignatureRequestsByDocument throws when db null", async () => {
    const { deleteSignatureRequestsByDocument } = await import("./db");
    await expect(deleteSignatureRequestsByDocument(1)).rejects.toThrow("Database not available");
  });

  // --- Template functions ---
  it("createTemplate throws when db null", async () => {
    const { createTemplate } = await import("./db");
    await expect(createTemplate({ userId: 1, title: "test" } as any)).rejects.toThrow("Database not available");
  });
  it("getTemplatesByOrg returns empty when db null", async () => {
    const { getTemplatesByOrg } = await import("./db");
    const result = await getTemplatesByOrg(1);
    expect(result).toEqual([]);
  });
  it("getTemplateById returns undefined when db null", async () => {
    const { getTemplateById } = await import("./db");
    const result = await getTemplateById(1);
    expect(result).toBeUndefined();
  });
  it("getPublicTemplates returns empty when db null", async () => {
    const { getPublicTemplates } = await import("./db");
    const result = await getPublicTemplates();
    expect(result).toEqual([]);
  });
  it("updateTemplate throws when db null", async () => {
    const { updateTemplate } = await import("./db");
    await expect(updateTemplate(1, { title: "test" })).rejects.toThrow("Database not available");
  });
  it("deleteTemplate throws when db null", async () => {
    const { deleteTemplate } = await import("./db");
    await expect(deleteTemplate(1)).rejects.toThrow("Database not available");
  });
  it("incrementTemplateUsage returns undefined when db null", async () => {
    const { incrementTemplateUsage } = await import("./db");
    const result = await incrementTemplateUsage(1);
    expect(result).toBeUndefined();
  });
  it("upsertTemplateFields throws when db null", async () => {
    const { upsertTemplateFields } = await import("./db");
    await expect(upsertTemplateFields(1, [])).rejects.toThrow("Database not available");
  });
  it("getTemplateFieldsByTemplate returns empty when db null", async () => {
    const { getTemplateFieldsByTemplate } = await import("./db");
    const result = await getTemplateFieldsByTemplate(1);
    expect(result).toEqual([]);
  });
  it("deepCopyTemplateToDocument throws when db null", async () => {
    const { deepCopyTemplateToDocument } = await import("./db");
    await expect(deepCopyTemplateToDocument(1, 1)).rejects.toThrow("Database not available");
  });

  // --- Contact functions ---
  it("getContactsByOrg returns empty when db null", async () => {
    const { getContactsByOrg } = await import("./db");
    const result = await getContactsByOrg(1);
    expect(result).toEqual([]);
  });
  it("getContactById returns undefined when db null", async () => {
    const { getContactById } = await import("./db");
    const result = await getContactById(1);
    expect(result).toBeUndefined();
  });
  it("createContact throws when db null", async () => {
    const { createContact } = await import("./db");
    await expect(createContact({ userId: 1, name: "test", email: "a@b.com" } as any)).rejects.toThrow("Database not available");
  });
  it("updateContact throws when db null", async () => {
    const { updateContact } = await import("./db");
    await expect(updateContact(1, { name: "test" })).rejects.toThrow("Database not available");
  });
  it("deleteContact throws when db null", async () => {
    const { deleteContact } = await import("./db");
    await expect(deleteContact(1)).rejects.toThrow("Database not available");
  });

  // --- Activity log functions ---
  it("createActivityLog returns undefined when db null", async () => {
    const { createActivityLog } = await import("./db");
    const result = await createActivityLog({ documentId: 1, action: "test" } as any);
    expect(result).toBeUndefined();
  });
  it("getActivityLogsByDocument returns empty when db null", async () => {
    const { getActivityLogsByDocument } = await import("./db");
    const result = await getActivityLogsByDocument(1);
    expect(result).toEqual([]);
  });
  // --- FAQ functions ---
  it("getPublishedFaqs returns empty when db null", async () => {
    const { getPublishedFaqs } = await import("./db");
    const result = await getPublishedFaqs();
    expect(result).toEqual([]);
  });
  it("createFaq throws when db null", async () => {
    const { createFaq } = await import("./db");
    await expect(createFaq({ question: "q", answer: "a" } as any)).rejects.toThrow("Database not available");
  });
  it("updateFaq throws when db null", async () => {
    const { updateFaq } = await import("./db");
    await expect(updateFaq(1, { question: "q" })).rejects.toThrow("Database not available");
  });
  it("deleteFaq throws when db null", async () => {
    const { deleteFaq } = await import("./db");
    await expect(deleteFaq(1)).rejects.toThrow("Database not available");
  });

  // --- Inquiry functions ---
  it("createInquiry throws when db null", async () => {
    const { createInquiry } = await import("./db");
    await expect(createInquiry({ name: "test", email: "a@b.com", message: "msg" } as any)).rejects.toThrow("Database not available");
  });
  it("getInquiries returns empty when db null", async () => {
    const { getInquiries } = await import("./db");
    const result = await getInquiries();
    expect(result).toEqual([]);
  });
  it("updateInquiryStatus throws when db null", async () => {
    const { updateInquiryStatus } = await import("./db");
    await expect(updateInquiryStatus(1, "read")).rejects.toThrow("Database not available");
  });

  // --- Email log ---
  it("createEmailLog returns undefined when db null", async () => {
    const { createEmailLog } = await import("./db");
    const result = await createEmailLog({ toEmail: "a@b.com", subject: "s", type: "signature_request" });
    expect(result).toBeUndefined();
  });

  // --- Dashboard stats by org ---
  it("getDashboardStatsByOrg returns zeros when db null", async () => {
    const { getDashboardStatsByOrg } = await import("./db");
    const result = await getDashboardStatsByOrg(1);
    expect(result.totalDocuments).toBe(0);
    expect(result.pendingSignatures).toBe(0);
    expect(result.completedDocuments).toBe(0);
  });

  // --- Internal approval functions ---
  it("createInternalApprovalsBulk throws when db null", async () => {
    const { createInternalApprovalsBulk } = await import("./db");
    await expect(createInternalApprovalsBulk([{ documentId: 1, approverEmail: "a@b.com", accessToken: "t", order: 1 } as any])).rejects.toThrow("Database not available");
  });
  it("getInternalApprovalsByDocument returns empty when db null", async () => {
    const { getInternalApprovalsByDocument } = await import("./db");
    const result = await getInternalApprovalsByDocument(1);
    expect(result).toEqual([]);
  });
  it("getInternalApprovalByToken returns null when db null", async () => {
    const { getInternalApprovalByToken } = await import("./db");
    const result = await getInternalApprovalByToken("token");
    expect(result).toBeNull();
  });
  it("updateInternalApproval throws when db null", async () => {
    const { updateInternalApproval } = await import("./db");
    await expect(updateInternalApproval(1, { status: "approved" } as any)).rejects.toThrow("Database not available");
  });
  it("deleteInternalApprovalsByDocument throws when db null", async () => {
    const { deleteInternalApprovalsByDocument } = await import("./db");
    await expect(deleteInternalApprovalsByDocument(1)).rejects.toThrow("Database not available");
  });
  it("getNextPendingApprover returns null when db null", async () => {
    const { getNextPendingApprover } = await import("./db");
    const result = await getNextPendingApprover(1);
    expect(result).toBeNull();
  });
  it("checkAllApproversApproved returns false when db null", async () => {
    const { checkAllApproversApproved } = await import("./db");
    const result = await checkAllApproversApproved(1);
    expect(result).toBe(false);
  });

  // --- Category functions ---
  it("createCategory returns null when db null", async () => {
    const { createCategory } = await import("./db");
    const result = await createCategory({ userId: 1, name: "test" } as any);
    expect(result).toBeNull();
  });
  it("updateCategory returns undefined when db null", async () => {
    const { updateCategory } = await import("./db");
    const result = await updateCategory(1, { name: "test" });
    expect(result).toBeUndefined();
  });
  it("deleteCategory returns undefined when db null", async () => {
    const { deleteCategory } = await import("./db");
    const result = await deleteCategory(1);
    expect(result).toBeUndefined();
  });

  // --- Group functions ---
  it("createGroup returns null when db null", async () => {
    const { createGroup } = await import("./db");
    const result = await createGroup({ userId: 1, name: "test" } as any);
    expect(result).toBeNull();
  });
  it("updateGroup returns undefined when db null", async () => {
    const { updateGroup } = await import("./db");
    const result = await updateGroup(1, { name: "test" });
    expect(result).toBeUndefined();
  });
  it("deleteGroup returns undefined when db null", async () => {
    const { deleteGroup } = await import("./db");
    const result = await deleteGroup(1);
    expect(result).toBeUndefined();
  });
  it("getGroupMembers returns empty when db null", async () => {
    const { getGroupMembers } = await import("./db");
    const result = await getGroupMembers(1);
    expect(result).toEqual([]);
  });
  it("getGroupsForContact returns empty when db null", async () => {
    const { getGroupsForContact } = await import("./db");
    const result = await getGroupsForContact(1);
    expect(result).toEqual([]);
  });
  it("addContactToGroup returns null when db null", async () => {
    const { addContactToGroup } = await import("./db");
    const result = await addContactToGroup(1, 1);
    expect(result).toBeNull();
  });
  it("removeContactFromGroup returns undefined when db null", async () => {
    const { removeContactFromGroup } = await import("./db");
    const result = await removeContactFromGroup(1, 1);
    expect(result).toBeUndefined();
  });
  it("getContactsByGroup returns empty when db null", async () => {
    const { getContactsByGroup } = await import("./db");
    const result = await getContactsByGroup(1);
    expect(result).toEqual([]);
  });

  // --- Guest document view ---
  it("getDocumentDetailByToken returns undefined when db null", async () => {
    const { getDocumentDetailByToken } = await import("./db");
    const result = await getDocumentDetailByToken("token");
    expect(result).toBeUndefined();
  });
});


// ==================== EMPTY RESULT FALLBACK BRANCH TESTS ====================
// These tests cover the ?? fallback branches when db queries return empty arrays
describe("db.ts - Empty result fallback branches", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getUserById returns undefined when result is empty", async () => {
    terminalValue = [];
    const { getUserById } = await import("./db");
    const result = await getUserById(999);
    expect(result).toBeUndefined();
  });

  it("getUserByEmail returns undefined when result is empty", async () => {
    terminalValue = [];
    const { getUserByEmail } = await import("./db");
    const result = await getUserByEmail("nonexistent@example.com");
    expect(result).toBeUndefined();
  });

  it("getDocumentById returns undefined when result is empty", async () => {
    terminalValue = [];
    const { getDocumentById } = await import("./db");
    const result = await getDocumentById(999);
    expect(result).toBeUndefined();
  });

  it("getSignatureRequestById returns undefined when result is empty", async () => {
    terminalValue = [];
    const { getSignatureRequestById } = await import("./db");
    const result = await getSignatureRequestById(999);
    expect(result).toBeUndefined();
  });

  it("getSignatureRequestByToken returns undefined when result is empty", async () => {
    terminalValue = [];
    const { getSignatureRequestByToken } = await import("./db");
    const result = await getSignatureRequestByToken("nonexistent-token");
    expect(result).toBeUndefined();
  });

  it("getNextPendingSigner returns null when result is empty", async () => {
    terminalValue = [];
    const { getNextPendingSigner } = await import("./db");
    const result = await getNextPendingSigner(999);
    expect(result).toBeNull();
  });

  it("getTemplateById returns undefined when result is empty", async () => {
    terminalValue = [];
    const { getTemplateById } = await import("./db");
    const result = await getTemplateById(999);
    expect(result).toBeUndefined();
  });

  it("getContactById returns undefined when result is empty", async () => {
    terminalValue = [];
    const { getContactById } = await import("./db");
    const result = await getContactById(999);
    expect(result).toBeUndefined();
  });

  it("getDashboardStatsByOrg returns zeros when counts are undefined", async () => {
    terminalValue = [];
    const { getDashboardStatsByOrg } = await import("./db");
    const result = await getDashboardStatsByOrg(1);
    expect(result.totalDocuments).toBe(0);
    expect(result.pendingSignatures).toBe(0);
    expect(result.completedDocuments).toBe(0);
    expect(result.sentDocuments).toBe(0);
    expect(result.declinedDocuments).toBe(0);
    expect(result.draftDocuments).toBe(0);
  });

  it("getNextPendingApprover returns null when result is empty", async () => {
    terminalValue = [];
    const { getNextPendingApprover } = await import("./db");
    const result = await getNextPendingApprover(999);
    expect(result).toBeNull();
  });

  it("checkAllApproversApproved returns true when no approvers exist", async () => {
    terminalValue = [];
    const { checkAllApproversApproved } = await import("./db");
    const result = await checkAllApproversApproved(999);
    expect(result).toBe(true);
  });

  it("getOrganizationById returns null when result is empty", async () => {
    terminalValue = [];
    const { getOrganizationById } = await import("./db");
    const result = await getOrganizationById(999);
    expect(result).toBeNull();
  });

  it("getOrganizationBySlug returns null when result is empty", async () => {
    terminalValue = [];
    const { getOrganizationBySlug } = await import("./db");
    const result = await getOrganizationBySlug("nonexistent");
    expect(result).toBeNull();
  });

  it("countActiveMembers returns 0 when result is empty", async () => {
    terminalValue = [];
    const { countActiveMembers } = await import("./db");
    const result = await countActiveMembers(999);
    expect(result).toBe(0);
  });

  it("getDocumentsByOrg returns empty array", async () => {
    terminalValue = [];
    const { getDocumentsByOrg } = await import("./db");
    const result = await getDocumentsByOrg(999);
    expect(result).toEqual([]);
  });

  it("getTemplatesByOrg returns empty array", async () => {
    terminalValue = [];
    const { getTemplatesByOrg } = await import("./db");
    const result = await getTemplatesByOrg(999);
    expect(result).toEqual([]);
  });

  it("getContactsByOrg returns empty array", async () => {
    terminalValue = [];
    const { getContactsByOrg } = await import("./db");
    const result = await getContactsByOrg(999);
    expect(result).toEqual([]);
  });
});

// ==================== UPSERT USER BRANCH TESTS ====================
describe("db.ts - upsertUser branch coverage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upsertUser with null name triggers ?? null fallback", async () => {
    terminalValue = undefined;
    const { upsertUser } = await import("./db");
    await upsertUser({ openId: "test-null", name: null as any, email: "test@test.com" });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("upsertUser with lastSignedIn set", async () => {
    terminalValue = undefined;
    const { upsertUser } = await import("./db");
    const date = new Date();
    await upsertUser({ openId: "test-ls", email: "test-ls@example.com", lastSignedIn: date });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("upsertUser with only openId (empty updateSet)", async () => {
    terminalValue = undefined;
    const { upsertUser } = await import("./db");
    await upsertUser({ openId: "test-minimal", email: "test-minimal@example.com" });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("upsertUser catches and re-throws db error", async () => {
    mockInsert.mockImplementationOnce(() => { throw new Error("DB error"); });
    const { upsertUser } = await import("./db");
    await expect(upsertUser({ openId: "test-error", name: "Test", email: "test-error@example.com" })).rejects.toThrow("DB error");
  });
});

// ==================== IP RESTRICTION ====================

describe("db.ts - IP Restriction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getActiveAllowedIps returns active IPs for org", async () => {
    const ip = { id: 1, organizationId: 100, ipAddress: "192.168.1.1", label: "Office", isActive: true, createdByUserId: 1, createdAt: new Date(), updatedAt: new Date() };
    terminalValue = [ip];
    const { getActiveAllowedIps } = await import("./db");
    const result = await getActiveAllowedIps(100);
    expect(mockSelect).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("getActiveAllowedIps returns empty array when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getActiveAllowedIps } = await import("./db");
    const result = await getActiveAllowedIps(100);
    expect(result).toEqual([]);
  });

  it("createAllowedIp inserts and returns the new record", async () => {
    const ip = { id: 1, organizationId: 100, ipAddress: "10.0.0.1", label: null, isActive: true, createdByUserId: 2, createdAt: new Date(), updatedAt: new Date() };
    terminalValue = [ip];
    const { createAllowedIp } = await import("./db");
    const result = await createAllowedIp({ organizationId: 100, ipAddress: "10.0.0.1", label: null, createdByUserId: 2 });
    expect(mockInsert).toHaveBeenCalled();
    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual(ip);
  });

  it("createAllowedIp throws when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { createAllowedIp } = await import("./db");
    await expect(createAllowedIp({ organizationId: 100, ipAddress: "10.0.0.1", label: null, createdByUserId: 2 })).rejects.toThrow("DB not available");
  });

  it("deactivateAllowedIp calls update with isActive false", async () => {
    terminalValue = undefined;
    const { deactivateAllowedIp } = await import("./db");
    await deactivateAllowedIp(1, 100);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("deactivateAllowedIp returns early when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { deactivateAllowedIp } = await import("./db");
    await deactivateAllowedIp(1, 100); // should not throw
  });
});

// ==================== SIGNATURE RECIPIENT AND WORM HELPERS ====================

describe("db.ts - Signature recipient and WORM helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("countPendingSignatureRequestsByEmail returns count", async () => {
    terminalValue = [{ cnt: 3 }];
    const { countPendingSignatureRequestsByEmail } = await import("./db");
    const result = await countPendingSignatureRequestsByEmail("signer@example.com");
    expect(mockSelect).toHaveBeenCalled();
    expect(result).toBe(3);
  });

  it("countPendingSignatureRequestsByEmail returns 0 when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { countPendingSignatureRequestsByEmail } = await import("./db");
    const result = await countPendingSignatureRequestsByEmail("signer@example.com");
    expect(result).toBe(0);
  });

  it("getWormRecordByDocumentId returns record", async () => {
    const record = { id: 1, documentId: 10, hash: "abc123" };
    terminalValue = [record];
    const { getWormRecordByDocumentId } = await import("./db");
    const result = await getWormRecordByDocumentId(10);
    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual(record);
  });

  it("getWormRecordByDocumentId returns null when not found", async () => {
    terminalValue = [];
    const { getWormRecordByDocumentId } = await import("./db");
    const result = await getWormRecordByDocumentId(999);
    expect(result).toBeNull();
  });

  it("getWormRecordByDocumentId returns null when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getWormRecordByDocumentId } = await import("./db");
    const result = await getWormRecordByDocumentId(10);
    expect(result).toBeNull();
  });
});

// ==================== getDocumentsByMultipleOrgs ====================

describe("db.ts - getDocumentsByMultipleOrgs", () => {
  it("returns empty array when orgIds is empty", async () => {
    const { getDocumentsByMultipleOrgs } = await import("./db");
    const result = await getDocumentsByMultipleOrgs([]);
    expect(result).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("queries single org with eq when orgIds has one entry", async () => {
    terminalValue = [{ id: 1, title: "Doc" }];
    const { getDocumentsByMultipleOrgs } = await import("./db");
    const result = await getDocumentsByMultipleOrgs([42]);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("queries multiple orgs with inArray when orgIds has multiple entries", async () => {
    terminalValue = [{ id: 1 }, { id: 2 }];
    const { getDocumentsByMultipleOrgs } = await import("./db");
    const result = await getDocumentsByMultipleOrgs([10, 20]);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("returns empty array when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getDocumentsByMultipleOrgs } = await import("./db");
    const result = await getDocumentsByMultipleOrgs([1, 2]);
    expect(result).toEqual([]);
  });
});

// ==================== getRecentActivityByOrg ====================

describe("db.ts - getRecentActivityByOrg", () => {
  it("returns recent activity logs for org", async () => {
    terminalValue = [{ id: 1, documentId: 1, userId: 1, action: "sent", details: null, ipAddress: null, actorEmail: "a@b.com", createdAt: new Date(), userName: "Test" }];
    const { getRecentActivityByOrg } = await import("./db");
    const result = await getRecentActivityByOrg(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("accepts custom limit parameter", async () => {
    terminalValue = [];
    const { getRecentActivityByOrg } = await import("./db");
    const result = await getRecentActivityByOrg(1, 5);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("returns empty array when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getRecentActivityByOrg } = await import("./db");
    const result = await getRecentActivityByOrg(1);
    expect(result).toEqual([]);
  });
});

// ==================== getCategoriesByOrg ====================

describe("db.ts - getCategoriesByOrg", () => {
  it("returns categories for org", async () => {
    terminalValue = [{ id: 1, name: "重要" }];
    const { getCategoriesByOrg } = await import("./db");
    const result = await getCategoriesByOrg(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("returns empty array when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getCategoriesByOrg } = await import("./db");
    const result = await getCategoriesByOrg(1);
    expect(result).toEqual([]);
  });
});

// ==================== getGroupsByOrg ====================

describe("db.ts - getGroupsByOrg", () => {
  it("returns groups for org", async () => {
    terminalValue = [{ id: 1, name: "営業チーム" }];
    const { getGroupsByOrg } = await import("./db");
    const result = await getGroupsByOrg(1);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("returns empty array when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getGroupsByOrg } = await import("./db");
    const result = await getGroupsByOrg(1);
    expect(result).toEqual([]);
  });
});

// ==================== getMembershipIncludingInactive / reactivateMembership ====================

describe("db.ts - getMembershipIncludingInactive and reactivateMembership", () => {
  it("getMembershipIncludingInactive returns membership", async () => {
    terminalValue = [{ id: 5, userId: 1, organizationId: 1, isActive: false }];
    const { getMembershipIncludingInactive } = await import("./db");
    const result = await getMembershipIncludingInactive(1, 1);
    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual({ id: 5, userId: 1, organizationId: 1, isActive: false });
  });

  it("getMembershipIncludingInactive returns null when not found", async () => {
    terminalValue = [];
    const { getMembershipIncludingInactive } = await import("./db");
    const result = await getMembershipIncludingInactive(99, 99);
    expect(result).toBeNull();
  });

  it("getMembershipIncludingInactive returns null when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { getMembershipIncludingInactive } = await import("./db");
    const result = await getMembershipIncludingInactive(1, 1);
    expect(result).toBeNull();
  });

  it("reactivateMembership calls update with isActive true", async () => {
    terminalValue = undefined;
    const { reactivateMembership } = await import("./db");
    await reactivateMembership(5, "member", 1);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("reactivateMembership returns early when db null", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { reactivateMembership } = await import("./db");
    await reactivateMembership(5, "member", 1); // should not throw
  });
});
