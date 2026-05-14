import { eq, desc, and, count, asc, inArray, ne, sql, lte, isNotNull, isNull, gt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import {
  InsertUser, users, passwordResetTokens, InsertPasswordResetToken,
  documents, InsertDocument,
  signatureRequests, InsertSignatureRequest,
  signatureFields, InsertSignatureField,
  templates, InsertTemplate,
  templateFields, InsertTemplateField,
  contacts, InsertContact,
  contactCategories, InsertContactCategory,
  contactGroups, InsertContactGroup,
  contactGroupMembers, InsertContactGroupMember,
  activityLogs, InsertActivityLog,
  faqs, InsertFAQ,
  inquiries, InsertInquiry,
  emailLogs,
  internalApprovals, InsertInternalApproval,
  organizations, InsertOrganization,
  memberships, InsertMembership,
  allowedIps, AllowedIp, InsertAllowedIp,
  wormRecords,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { encryptPii, decryptPiiFields } from "./piiEncryption";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (ENV.dbSsl) {
        // SSL mode: explicit mysql2 pool with TLS enabled
        const pool = mysql.createPool({
          uri: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        });
        _db = drizzle(pool);
      } else {
        // Default: connection string pass-through for self-hosted deployments.
        _db = drizzle(process.env.DATABASE_URL);
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USER QUERIES ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  if (!user.email) throw new Error("User email is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId, email: user.email };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod", "passwordHash", "locale"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      (values as Record<string, unknown>)[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.staffRole !== undefined) { values.staffRole = user.staffRole; updateSet.staffRole = user.staffRole; }
    if (user.isActive !== undefined) { values.isActive = user.isActive; updateSet.isActive = user.isActive; }
    if (user.mustChangePassword !== undefined) { values.mustChangePassword = user.mustChangePassword; updateSet.mustChangePassword = user.mustChangePassword; }
    if (user.isSuperAdmin !== undefined) { values.isSuperAdmin = user.isSuperAdmin; updateSet.isSuperAdmin = user.isSuperAdmin; }
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

export async function getUserById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] ?? undefined;
}

export async function getUserCount() {
  const db = await getDb(); if (!db) return 0;
  const rows = await db.select({ cnt: count() }).from(users);
  return Number(rows[0]?.cnt ?? 0);
}

export async function listUsers() {
  const db = await getDb(); if (!db) return [];
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      staffRole: users.staffRole,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      locale: users.locale,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.id));
}

export async function updateUser(userId: number, data: Partial<InsertUser>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function createPasswordResetToken(data: InsertPasswordResetToken) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(passwordResetTokens).values(data);
  return Number(result[0].insertId);
}

export async function getPasswordResetTokenByHash(tokenHash: string) {
  const db = await getDb(); if (!db) return undefined;
  const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);
  return rows[0] ?? undefined;
}

export async function markPasswordResetTokenUsed(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
}

export async function deleteExpiredPasswordResetTokens() {
  const db = await getDb(); if (!db) return;
  await db.delete(passwordResetTokens).where(lte(passwordResetTokens.expiresAt, new Date()));
}

export async function updateUserProfile(userId: number, data: {
  name?: string; phone?: string;
  avatarUrl?: string; signatureFont?: string; signatureText?: string; sealLastName?: string; locale?: string;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ==================== DOCUMENT QUERIES ====================

export async function createDocument(data: InsertDocument) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(documents).values(data);
  return result[0].insertId;
}

/** Get documents belonging to an organization. If userId is provided, filter to that user's documents only. */
export async function getDocumentsByOrg(orgId: number, userId?: number) {
  const db = await getDb(); if (!db) return [];
  const conditions = [eq(documents.organizationId, orgId)];
  if (userId !== undefined) {
    conditions.push(eq(documents.userId, userId));
  }
  return db.select().from(documents).where(and(...conditions)).orderBy(desc(documents.updatedAt));
}

/** Get documents belonging to multiple organizations (for users in multiple orgs) */
export async function getDocumentsByMultipleOrgs(orgIds: number[]) {
  const db = await getDb(); if (!db) return [];
  if (orgIds.length === 0) return [];
  if (orgIds.length === 1) {
    return db.select().from(documents).where(eq(documents.organizationId, orgIds[0])).orderBy(desc(documents.updatedAt));
  }
  return db.select().from(documents).where(inArray(documents.organizationId, orgIds)).orderBy(desc(documents.updatedAt));
}

export async function getDocumentById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function updateDocument(id: number, data: Partial<InsertDocument>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(documents).set(data).where(eq(documents.id, id));
}

export async function deleteDocument(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.delete(signatureFields).where(eq(signatureFields.documentId, id));
  await db.delete(signatureRequests).where(eq(signatureRequests.documentId, id));
  await db.delete(internalApprovals).where(eq(internalApprovals.documentId, id));
  // activityLogs は WORM 設計のため削除しない（電帳法コンプライアンス）
  await db.delete(documents).where(eq(documents.id, id));
}

// ==================== SIGNATURE FIELDS (normalized) ====================

export async function upsertSignatureFields(documentId: number, fields: InsertSignatureField[]) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  // Delete existing fields for this document, then insert new ones
  await db.delete(signatureFields).where(eq(signatureFields.documentId, documentId));
  if (fields.length > 0) {
    await db.insert(signatureFields).values(fields.map(f => ({ ...f, documentId })));
  }
}

export async function getSignatureFieldsByDocument(documentId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(signatureFields)
    .where(eq(signatureFields.documentId, documentId))
    .orderBy(asc(signatureFields.page), asc(signatureFields.id));
}

// ==================== SIGNATURE REQUEST QUERIES ====================

export async function createSignatureRequest(data: InsertSignatureRequest) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(signatureRequests).values(data);
  return result[0].insertId;
}

export async function createSignatureRequestsBulk(data: InsertSignatureRequest[]) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  await db.insert(signatureRequests).values(data);
}

export async function getSignatureRequestsByDocument(documentId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(signatureRequests)
    .where(eq(signatureRequests.documentId, documentId))
    .orderBy(asc(signatureRequests.order), asc(signatureRequests.id));
}

export async function getSignatureRequestsByEmail(email: string) {
  const db = await getDb(); if (!db) return [];
  return db.select({
    request: signatureRequests,
    document: documents,
  }).from(signatureRequests)
    .innerJoin(documents, eq(signatureRequests.documentId, documents.id))
    .where(eq(signatureRequests.signerEmail, email))
    .orderBy(desc(signatureRequests.createdAt));
}

export async function getSignatureRequestById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(signatureRequests).where(eq(signatureRequests.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function getSignatureRequestByToken(token: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select({
    request: signatureRequests,
    document: documents,
  }).from(signatureRequests)
    .innerJoin(documents, eq(signatureRequests.documentId, documents.id))
    .where(eq(signatureRequests.accessToken, token))
    .limit(1);
  return result[0] ?? undefined;
}

export async function updateSignatureRequest(id: number, data: Partial<InsertSignatureRequest>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(signatureRequests).set(data).where(eq(signatureRequests.id, id));
}

export async function checkAllSignersSigned(documentId: number): Promise<boolean> {
  const db = await getDb(); if (!db) return false;
  const requests = await db.select().from(signatureRequests)
    .where(and(
      eq(signatureRequests.documentId, documentId),
      eq(signatureRequests.recipientRole, "signer"),
      isNull(signatureRequests.delegatedToEmail),
    ));
  return requests.length > 0 && requests.every(r => r.status === "signed");
}

export async function getNextPendingSigner(documentId: number) {
  const db = await getDb(); if (!db) return null;
  const requests = await db.select().from(signatureRequests)
    .where(and(
      eq(signatureRequests.documentId, documentId),
      eq(signatureRequests.recipientRole, "signer"),
      inArray(signatureRequests.status, ["pending", "sent"]),
      isNull(signatureRequests.delegatedToEmail),
    ))
    .orderBy(asc(signatureRequests.order), asc(signatureRequests.id))
    .limit(1);
  return requests[0] ?? null;
}

export async function deleteSignatureRequestsByDocument(documentId: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.delete(signatureRequests).where(eq(signatureRequests.documentId, documentId));
}

// ==================== TEMPLATE QUERIES ====================

export async function createTemplate(data: InsertTemplate) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(templates).values(data);
  return result[0].insertId;
}

/** Get templates belonging to an organization (shared across team) */
export async function getTemplatesByOrg(orgId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(templates).where(eq(templates.organizationId, orgId)).orderBy(desc(templates.updatedAt));
}

export async function getTemplateById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function getPublicTemplates() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(templates).where(eq(templates.isPublic, true)).orderBy(desc(templates.usageCount));
}

export async function updateTemplate(id: number, data: Partial<InsertTemplate>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(templates).set(data).where(eq(templates.id, id));
}

export async function deleteTemplate(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.delete(templateFields).where(eq(templateFields.templateId, id));
  await db.delete(templates).where(eq(templates.id, id));
}

export async function incrementTemplateUsage(id: number) {
  const db = await getDb(); if (!db) return;
  await db.update(templates).set({ usageCount: sql`${templates.usageCount} + 1` }).where(eq(templates.id, id));
}

// ==================== TEMPLATE FIELDS (normalized) ====================

export async function upsertTemplateFields(templateId: number, fields: InsertTemplateField[]) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.delete(templateFields).where(eq(templateFields.templateId, templateId));
  if (fields.length > 0) {
    await db.insert(templateFields).values(fields.map(f => ({ ...f, templateId })));
  }
}

export async function getTemplateFieldsByTemplate(templateId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(templateFields)
    .where(eq(templateFields.templateId, templateId))
    .orderBy(asc(templateFields.page), asc(templateFields.id));
}

/**
 * Deep copy template fields into document signature fields.
 * This is the core of "create document from template" flow.
 */
export async function deepCopyTemplateToDocument(templateId: number, documentId: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const tplFields = await getTemplateFieldsByTemplate(templateId);
  if (tplFields.length === 0) return;
  const docFields: InsertSignatureField[] = tplFields.map(tf => ({
    documentId,
    clientId: tf.clientId,
    page: tf.page,
    xPercent: tf.xPercent,
    yPercent: tf.yPercent,
    widthPercent: tf.widthPercent,
    heightPercent: tf.heightPercent,
    signerIndex: tf.signerIndex,
    type: tf.type,
    label: tf.label,
    required: tf.required,
  }));
  await db.insert(signatureFields).values(docFields);
}

// ==================== CONTACT QUERIES ====================

/** Get contacts belonging to an organization (shared across team) */
export async function getContactsByOrg(orgId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(contacts).where(eq(contacts.organizationId, orgId)).orderBy(desc(contacts.updatedAt));
}

export async function getContactById(id: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function createContact(data: InsertContact) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(contacts).values(data);
  return result[0].insertId;
}

export async function updateContact(id: number, data: Partial<InsertContact>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(contacts).set(data).where(eq(contacts.id, id));
}

export async function deleteContact(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  // Delete group memberships first to prevent orphan records
  await db.delete(contactGroupMembers).where(eq(contactGroupMembers.contactId, id));
  await db.delete(contacts).where(eq(contacts.id, id));
}

// ==================== ACTIVITY LOG QUERIES ====================

export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb(); if (!db) return;
  await db.insert(activityLogs).values({
    ...data,
    actorEmail: encryptPii(data.actorEmail),
    ipAddress: encryptPii(data.ipAddress),
  });
}

export async function getActivityLogsByDocument(documentId: number) {
  const db = await getDb(); if (!db) return [];
  const logs = await db.select().from(activityLogs).where(eq(activityLogs.documentId, documentId)).orderBy(desc(activityLogs.createdAt));
  return logs.map(log => decryptPiiFields(log));
}

/** Get recent activity scoped to an organization (including external signers) */
export async function getRecentActivityByOrg(orgId: number, limit = 20) {
  const db = await getDb(); if (!db) return [];
  const logs = await db.select({
    id: activityLogs.id,
    documentId: activityLogs.documentId,
    userId: activityLogs.userId,
    action: activityLogs.action,
    details: activityLogs.details,
    ipAddress: activityLogs.ipAddress,
    actorEmail: activityLogs.actorEmail,
    createdAt: activityLogs.createdAt,
    userName: users.name,
  })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.organizationId, orgId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
  return logs.map(log => decryptPiiFields(log));
}

// ==================== FAQ QUERIES ====================

export async function getPublishedFaqs() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(faqs).where(eq(faqs.isPublished, true)).orderBy(faqs.order);
}

export async function createFaq(data: InsertFAQ) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(faqs).values(data);
  return result[0].insertId;
}

export async function updateFaq(id: number, data: Partial<InsertFAQ>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(faqs).set(data).where(eq(faqs.id, id));
}

export async function deleteFaq(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.delete(faqs).where(eq(faqs.id, id));
}

// ==================== INQUIRY QUERIES ====================

export async function createInquiry(data: InsertInquiry) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const result = await db.insert(inquiries).values(data);
  return result[0].insertId;
}

export async function getInquiries() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(inquiries).orderBy(desc(inquiries.createdAt));
}

export async function updateInquiryStatus(id: number, status: "new" | "read" | "replied" | "closed") {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  await db.update(inquiries).set({ status }).where(eq(inquiries.id, id));
}

// ==================== EMAIL LOG ====================

export async function createEmailLog(data: {
  toEmail: string; toName?: string; subject: string;
  type: "signature_request" | "signature_complete" | "signature_declined" | "all_signed" | "document_voided" | "reminder" | "invitation";
  documentId?: number; signatureRequestId?: number; status?: "sent" | "failed";
}) {
  const db = await getDb(); if (!db) return;
  await db.insert(emailLogs).values(data as any);
}

// ==================== DASHBOARD STATS ====================

/** Get dashboard stats scoped to an organization */
export async function getDashboardStatsByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return { totalDocuments: 0, pendingSignatures: 0, completedDocuments: 0, sentDocuments: 0, declinedDocuments: 0, draftDocuments: 0 };

  const [docCount] = await db.select({ count: count() }).from(documents).where(eq(documents.organizationId, orgId));
  const [sentCount] = await db.select({ count: count() }).from(documents).where(and(eq(documents.organizationId, orgId), eq(documents.status, "sent")));
  const [completedCount] = await db.select({ count: count() }).from(documents).where(and(eq(documents.organizationId, orgId), eq(documents.status, "completed")));
  const [declinedCount] = await db.select({ count: count() }).from(documents).where(and(eq(documents.organizationId, orgId), eq(documents.status, "declined")));
  const [draftCount] = await db.select({ count: count() }).from(documents).where(and(eq(documents.organizationId, orgId), eq(documents.status, "draft")));

  return {
    totalDocuments: docCount?.count ?? 0,
    pendingSignatures: sentCount?.count ?? 0,
    completedDocuments: completedCount?.count ?? 0,
    sentDocuments: sentCount?.count ?? 0,
    declinedDocuments: declinedCount?.count ?? 0,
    draftDocuments: draftCount?.count ?? 0,
  };
}


// ==================== INTERNAL APPROVALS ====================

export async function createInternalApprovalsBulk(data: InsertInternalApproval[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  await db.insert(internalApprovals).values(data);
}

export async function getInternalApprovalsByDocument(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(internalApprovals)
    .where(eq(internalApprovals.documentId, documentId))
    .orderBy(asc(internalApprovals.order));
}

export async function getInternalApprovalByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(internalApprovals)
    .where(eq(internalApprovals.accessToken, token))
    .limit(1);
  return rows[0] || null;
}

export async function updateInternalApproval(id: number, data: Partial<InsertInternalApproval>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(internalApprovals).set(data).where(eq(internalApprovals.id, id));
}

export async function deleteInternalApprovalsByDocument(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(internalApprovals).where(eq(internalApprovals.documentId, documentId));
}

export async function getNextPendingApprover(documentId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(internalApprovals)
    .where(and(
      eq(internalApprovals.documentId, documentId),
      eq(internalApprovals.status, "pending"),
    ))
    .orderBy(asc(internalApprovals.order))
    .limit(1);
  return rows[0] || null;
}

export async function checkAllApproversApproved(documentId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(internalApprovals)
    .where(eq(internalApprovals.documentId, documentId));
  if (rows.length === 0) return true;
  return rows.every(r => r.status === "approved");
}


// ==================== Contact Categories ====================

/** Get contact categories scoped to an organization */
export async function getCategoriesByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contactCategories).where(eq(contactCategories.organizationId, orgId)).orderBy(asc(contactCategories.order), asc(contactCategories.id));
}

export async function createCategory(data: InsertContactCategory) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(contactCategories).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateCategory(id: number, data: Partial<InsertContactCategory>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contactCategories).set(data).where(eq(contactCategories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(contactCategories).where(eq(contactCategories.id, id));
}

// ==================== Contact Groups ====================

/** Get contact groups scoped to an organization */
export async function getGroupsByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contactGroups).where(eq(contactGroups.organizationId, orgId)).orderBy(asc(contactGroups.id));
}

export async function createGroup(data: InsertContactGroup) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(contactGroups).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateGroup(id: number, data: Partial<InsertContactGroup>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contactGroups).set(data).where(eq(contactGroups.id, id));
}

export async function deleteGroup(id: number) {
  const db = await getDb();
  if (!db) return;
  // Delete memberships first
  await db.delete(contactGroupMembers).where(eq(contactGroupMembers.groupId, id));
  await db.delete(contactGroups).where(eq(contactGroups.id, id));
}

// ==================== Contact Group Members ====================

export async function getGroupMembers(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: contactGroupMembers.id,
    contactId: contactGroupMembers.contactId,
    groupId: contactGroupMembers.groupId,
    contactName: contacts.name,
    contactEmail: contacts.email,
  })
    .from(contactGroupMembers)
    .innerJoin(contacts, eq(contactGroupMembers.contactId, contacts.id))
    .where(eq(contactGroupMembers.groupId, groupId));
}

export async function getGroupsForContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: contactGroupMembers.id,
    groupId: contactGroupMembers.groupId,
    groupName: contactGroups.name,
  })
    .from(contactGroupMembers)
    .innerJoin(contactGroups, eq(contactGroupMembers.groupId, contactGroups.id))
    .where(eq(contactGroupMembers.contactId, contactId));
}

export async function addContactToGroup(contactId: number, groupId: number) {
  const db = await getDb();
  if (!db) return null;
  // Check if already exists
  const existing = await db.select().from(contactGroupMembers)
    .where(and(eq(contactGroupMembers.contactId, contactId), eq(contactGroupMembers.groupId, groupId)))
    .limit(1);
  if (existing.length > 0) return { id: existing[0].id };
  const result = await db.insert(contactGroupMembers).values({ contactId, groupId });
  return { id: Number(result[0].insertId) };
}

export async function removeContactFromGroup(contactId: number, groupId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(contactGroupMembers).where(
    and(eq(contactGroupMembers.contactId, contactId), eq(contactGroupMembers.groupId, groupId))
  );
}

export async function getContactsByGroup(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: contacts.id,
    name: contacts.name,
    email: contacts.email,
    company: contacts.company,
    department: contacts.department,
    phone: contacts.phone,
    category: contacts.category,
  })
    .from(contactGroupMembers)
    .innerJoin(contacts, eq(contactGroupMembers.contactId, contacts.id))
    .where(eq(contactGroupMembers.groupId, groupId));
}


// ==================== ACCOUNT CLAIM ====================

/**
 * Link all signature requests matching a given email to a user ID.
 * Called when a staff account is created or recovered to claim previously signed documents.
 *
 * Handles Gmail-style aliases (e.g. user+tag@gmail.com) and dot-insensitivity
 * by first doing an exact-match SQL UPDATE, then selecting unclaimed rows whose
 * local-part prefix (before '+') matches and comparing via normalizeEmail in JS.
 */
export async function claimSignatureRequestsByEmail(email: string, userId: number) {
  const db = await getDb(); if (!db) return 0;

  // 1. Fast path: exact case-insensitive match via SQL
  const exactResult = await db.update(signatureRequests)
    .set({ signerUserId: userId })
    .where(and(
      eq(signatureRequests.signerEmail, email),
      sql`${signatureRequests.signerUserId} IS NULL`
    ));
  let claimed = (exactResult as any)[0]?.affectedRows ?? 0;

  // 2. Alias / dot-variant matching: find unclaimed rows whose base local-part matches
  const { emailsMatch } = await import("@shared/email");
  const atIdx = email.indexOf("@");
  if (atIdx > 0) {
    const domain = email.slice(atIdx + 1).toLowerCase();
    // Select unclaimed rows for the same domain
    const candidates = await db.select({
      id: signatureRequests.id,
      signerEmail: signatureRequests.signerEmail,
    }).from(signatureRequests).where(and(
      sql`${signatureRequests.signerUserId} IS NULL`,
      sql`SUBSTRING_INDEX(${signatureRequests.signerEmail}, '@', -1) = ${domain}`,
      // Exclude those already claimed in step 1 (exact match)
      ne(signatureRequests.signerEmail, email),
    ));

    const aliasIds = candidates
      .filter(c => emailsMatch(c.signerEmail, email))
      .map(c => c.id);

    if (aliasIds.length > 0) {
      const aliasResult = await db.update(signatureRequests)
        .set({ signerUserId: userId })
        .where(and(
          inArray(signatureRequests.id, aliasIds),
          sql`${signatureRequests.signerUserId} IS NULL`,
        ));
      claimed += (aliasResult as any)[0]?.affectedRows ?? 0;
    }
  }

  return claimed;
}

export async function claimInternalApprovalsByEmail(email: string, userId: number) {
  const db = await getDb(); if (!db) return 0;

  const exactResult = await db.update(internalApprovals)
    .set({ approverUserId: userId })
    .where(and(
      eq(internalApprovals.approverEmail, email),
      sql`${internalApprovals.approverUserId} IS NULL`
    ));
  let claimed = (exactResult as any)[0]?.affectedRows ?? 0;

  const { emailsMatch } = await import("@shared/email");
  const atIdx = email.indexOf("@");
  if (atIdx > 0) {
    const domain = email.slice(atIdx + 1).toLowerCase();
    const candidates = await db.select({
      id: internalApprovals.id,
      approverEmail: internalApprovals.approverEmail,
    }).from(internalApprovals).where(and(
      sql`${internalApprovals.approverUserId} IS NULL`,
      sql`SUBSTRING_INDEX(${internalApprovals.approverEmail}, '@', -1) = ${domain}`,
      ne(internalApprovals.approverEmail, email),
    ));

    const aliasIds = candidates
      .filter(c => emailsMatch(c.approverEmail, email))
      .map(c => c.id);

    if (aliasIds.length > 0) {
      const aliasResult = await db.update(internalApprovals)
        .set({ approverUserId: userId })
        .where(and(
          inArray(internalApprovals.id, aliasIds),
          sql`${internalApprovals.approverUserId} IS NULL`,
        ));
      claimed += (aliasResult as any)[0]?.affectedRows ?? 0;
    }
  }

  return claimed;
}

export async function getSignatureInboxEntriesForUser(email: string, userId: number, organizationId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({
    request: signatureRequests,
    document: documents,
    owner: {
      id: users.id,
      name: users.name,
      email: users.email,
    },
  }).from(signatureRequests)
    .innerJoin(documents, eq(signatureRequests.documentId, documents.id))
    .leftJoin(users, eq(documents.userId, users.id))
    .where(and(
      or(
        eq(signatureRequests.signerUserId, userId),
        eq(signatureRequests.signerEmail, email),
      ),
      eq(documents.organizationId, organizationId),
      inArray(signatureRequests.recipientRole, ["signer", "cc"]),
      inArray(signatureRequests.status, ["sent", "viewed", "signed", "declined", "expired"]),
    ))
    .orderBy(desc(signatureRequests.updatedAt), desc(signatureRequests.createdAt));
}

export async function getInternalApprovalInboxEntriesForUser(email: string, userId: number, organizationId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({
    approval: internalApprovals,
    document: documents,
    owner: {
      id: users.id,
      name: users.name,
      email: users.email,
    },
  }).from(internalApprovals)
    .innerJoin(documents, eq(internalApprovals.documentId, documents.id))
    .leftJoin(users, eq(documents.userId, users.id))
    .where(and(
      or(
        eq(internalApprovals.approverUserId, userId),
        eq(internalApprovals.approverEmail, email),
      ),
      eq(documents.organizationId, organizationId),
    ))
    .orderBy(desc(internalApprovals.updatedAt), desc(internalApprovals.createdAt));
}

// ==================== GUEST DOCUMENT VIEW ====================

/**
 * Get document detail for a token-based viewer (signed/completed documents).
 * Returns document info, all signature requests (for progress), and the signed PDF URL.
 */
export async function getDocumentDetailByToken(token: string) {
  const db = await getDb(); if (!db) return undefined;
  // First get the signature request
  const reqResult = await db.select({
    request: signatureRequests,
    document: documents,
  }).from(signatureRequests)
    .innerJoin(documents, eq(signatureRequests.documentId, documents.id))
    .where(eq(signatureRequests.accessToken, token))
    .limit(1);
  if (!reqResult[0]) return undefined;

  const { request, document } = reqResult[0];

  // Get all signature requests for this document (for progress display)
  const allRequests = await db.select().from(signatureRequests)
    .where(eq(signatureRequests.documentId, document.id))
    .orderBy(asc(signatureRequests.order));

  return {
    request,
    document,
    allRequests,
  };
}


// ==================== REMINDER & EXPIRATION QUERIES ====================

/**
 * Get documents that need reminder emails sent
 * (status is 'sent', nextReminderAt is past, reminderDays is set)
 */
export async function getDocumentsNeedingReminder() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(documents)
    .where(and(
      eq(documents.status, "sent"),
      isNotNull(documents.nextReminderAt),
      isNotNull(documents.reminderDays),
      gt(documents.reminderDays, 0),
      lte(documents.nextReminderAt, new Date()),
    ));
}

/**
 * Get documents that have expired (past expiresAt, still status 'sent')
 */
export async function getDocumentsNeedingExpiration() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(documents)
    .where(and(
      eq(documents.status, "sent"),
      isNotNull(documents.expiresAt),
      lte(documents.expiresAt, new Date()),
    ));
}

/**
 * Get pending (unsigned) signature requests for a document
 */
export async function getPendingSignatureRequests(documentId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(signatureRequests)
    .where(and(
      eq(signatureRequests.documentId, documentId),
      eq(signatureRequests.recipientRole, "signer"),
      eq(signatureRequests.status, "sent"),
    ))
    .orderBy(asc(signatureRequests.order));
}


// ==================== ORGANIZATION QUERIES ====================

export async function createOrganization(data: InsertOrganization) {
  const db = await getDb(); if (!db) return null;
  const result = await db.insert(organizations).values(data);
  const id = result[0].insertId;
  return getOrganizationById(id);
}

export async function getOrganizationById(id: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getOrganizationBySlug(slug: string) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function updateOrganization(id: number, data: Partial<InsertOrganization>) {
  const db = await getDb(); if (!db) return;
  await db.update(organizations).set(data).where(eq(organizations.id, id));
}

export async function getOrganizationsByUser(userId: number) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({
    org: organizations,
    membership: memberships,
  }).from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.isActive, true),
      eq(organizations.isActive, true),
    ))
    .orderBy(desc(memberships.joinedAt));
  return rows;
}

// ==================== MEMBERSHIP QUERIES ====================

export async function createMembership(data: InsertMembership) {
  const db = await getDb(); if (!db) return;
  await db.insert(memberships).values(data);
}

export async function getMembershipsByOrg(orgId: number) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({
    membership: memberships,
    user: users,
  }).from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(
      eq(memberships.organizationId, orgId),
      eq(memberships.isActive, true),
    ))
    .orderBy(asc(memberships.role), asc(memberships.joinedAt));
  return rows;
}

export async function getMembership(userId: number, orgId: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(memberships)
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, orgId),
      eq(memberships.isActive, true),
    )).limit(1);
  return rows[0] ?? null;
}

/** Get membership including inactive (for re-invitation flow) */
export async function getMembershipIncludingInactive(userId: number, orgId: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(memberships)
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, orgId),
    )).limit(1);
  return rows[0] ?? null;
}

export async function reactivateMembership(id: number, role: "owner" | "manager" | "member", orgId: number) {
  const db = await getDb(); if (!db) return;
  await db.update(memberships).set({ isActive: true, role }).where(and(eq(memberships.id, id), eq(memberships.organizationId, orgId)));
}

export async function updateMembershipRole(id: number, role: "owner" | "manager" | "member", orgId: number) {
  const db = await getDb(); if (!db) return;
  await db.update(memberships).set({ role }).where(and(eq(memberships.id, id), eq(memberships.organizationId, orgId)));
}

export async function deactivateMembership(id: number, orgId: number) {
  const db = await getDb(); if (!db) return;
  await db.update(memberships).set({ isActive: false }).where(and(eq(memberships.id, id), eq(memberships.organizationId, orgId)));
}

export async function countActiveMembers(orgId: number) {
  const db = await getDb(); if (!db) return 0;
  const rows = await db.select({ cnt: count() }).from(memberships)
    .where(and(
      eq(memberships.organizationId, orgId),
      eq(memberships.isActive, true),
    ));
  return rows[0]?.cnt ?? 0;
}

// ==================== MEMBER USAGE TRACKING ====================

export async function getMemberUsageByOrg(orgId: number) {
  const db = await getDb(); if (!db) return [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const rows = await db.select({
    userId: documents.userId,
    userName: users.name,
    userEmail: users.email,
    userAvatarUrl: users.avatarUrl,
    sendCount: count(documents.id),
  })
    .from(documents)
    .innerJoin(users, eq(documents.userId, users.id))
    .where(and(
      eq(documents.organizationId, orgId),
      inArray(documents.status, ["sent", "completed", "declined", "voided", "expired"]),
      sql`${documents.createdAt} >= ${monthStart}`,
    ))
    .groupBy(documents.userId, users.name, users.email, users.avatarUrl)
    .orderBy(desc(count(documents.id)));

  return rows;
}

/**
 * Get all documents created by a specific member within an organization.
 * Owner/Admin can view all documents by any member.
 */
export async function getDocumentsByMember(orgId: number, memberUserId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select()
    .from(documents)
    .where(and(
      eq(documents.organizationId, orgId),
      eq(documents.userId, memberUserId),
    ))
    .orderBy(desc(documents.updatedAt));
}

export async function countPendingSignatureRequestsByEmail(email: string) {
  const db = await getDb(); if (!db) return 0;
  const rows = await db.select({ cnt: count() })
    .from(signatureRequests)
    .where(and(
      eq(signatureRequests.signerEmail, email),
      inArray(signatureRequests.status, ["pending", "sent", "viewed"]),
    ));
  return rows[0]?.cnt ?? 0;
}

export async function getWormRecordByDocumentId(documentId: number) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select()
    .from(wormRecords)
    .where(eq(wormRecords.documentId, documentId))
    .orderBy(desc(wormRecords.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// ==================== IP Restriction ====================

/** Get all active IP restriction entries for an organization. */
export async function getActiveAllowedIps(organizationId: number): Promise<AllowedIp[]> {
  const db = await getDb(); if (!db) return [];
  return db.select().from(allowedIps).where(and(
    eq(allowedIps.organizationId, organizationId),
    eq(allowedIps.isActive, true),
  ));
}

/** Add an IP restriction entry. */
export async function createAllowedIp(data: InsertAllowedIp): Promise<AllowedIp> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(allowedIps).values(data).$returningId();
  const [record] = await db.select().from(allowedIps).where(eq(allowedIps.id, row.id));
  return record;
}

/** Soft-delete an IP restriction entry (sets isActive=false). */
export async function deactivateAllowedIp(id: number, organizationId: number): Promise<void> {
  const db = await getDb(); if (!db) return;
  await db.update(allowedIps).set({ isActive: false }).where(
    and(eq(allowedIps.id, id), eq(allowedIps.organizationId, organizationId)),
  );
}
