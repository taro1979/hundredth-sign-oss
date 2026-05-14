import { int, mysqlEnum, mysqlTable, text, mediumtext, timestamp, varchar, boolean, json, float, bigint, uniqueIndex, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  staffRole: mysqlEnum("staffRole", ["admin", "member"]).default("member").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** Staff user's preferred UI/email default locale. */
  locale: varchar("locale", { length: 10 }).default("ja").notNull(),
  /** SuperAdmin flag - system-level privilege, completely separate from org roles */
  isSuperAdmin: boolean("isSuperAdmin").default(false).notNull(),
  avatarUrl: text("avatarUrl"),
  phone: varchar("phone", { length: 50 }),
  signatureFont: varchar("signatureFont", { length: 100 }).default("dancing-script"),
  signatureText: varchar("signatureText", { length: 255 }),
  /** Default seal (hanko) last name for stamp generation */
  sealLastName: varchar("sealLastName", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ==================== SELF-HOSTED WORKSPACE TABLES ====================

/**
 * Organizations - internal workspace boundary for the single-tenant OSS build.
 * User-facing organization switching is removed, but this row remains as the
 * scope for documents, templates, contacts, IP restrictions, and audit logs.
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  /** Owner user ID (the person who created the org) */
  ownerUserId: int("ownerUserId").notNull(),
  domain: varchar("domain", { length: 255 }),
  logoUrl: text("logoUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

/**
 * Memberships - links staff users to the internal workspace with roles.
 * Roles: owner (full control), manager (staff/admin operations), member (use features).
 */
export const memberships = mysqlTable("memberships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId").notNull(),
  role: mysqlEnum("memberRole", ["owner", "manager", "member"]).default("member").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  // Prevent duplicate staff membership rows.
  uniqueIndex("idx_memberships_user_org").on(table.userId, table.organizationId),
]));

export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = typeof memberships.$inferInsert;

// ==================== SIGNATURE WORKFLOW TABLES ====================

/**
 * Documents (Envelopes) - the core entity for signature workflows.
 * Each document represents one PDF + its signing lifecycle.
 * Scoped to the single self-hosted workspace.
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Organization this document belongs to */
  organizationId: int("organizationId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  // PDF file stored in S3
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  fileName: varchar("fileName", { length: 500 }),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  pageCount: int("pageCount").default(0),
  status: mysqlEnum("status", [
    "draft", "pending_internal_approval", "sent", "completed", "declined", "voided", "expired"
  ]).default("draft").notNull(),
  // Sequential routing toggle
  sequentialRouting: boolean("sequentialRouting").default(false).notNull(),
  // Template origin (for deep copy tracking)
  sourceTemplateId: int("sourceTemplateId"),
  // Expiration & Reminder settings
  expirationDays: int("expirationDays"),           // auto-void after X days
  reminderDays: int("reminderDays"),                // send reminder every X days
  nextReminderAt: timestamp("nextReminderAt"),
  expiresAt: timestamp("expiresAt"),
  completedAt: timestamp("completedAt"),
  // Signed PDF (generated after all signers complete)
  signedFileUrl: text("signedFileUrl"),
  signedFileKey: text("signedFileKey"),
  /** Optional reference back to a third-party system that initiated this workflow. */
  externalSystem: varchar("externalSystem", { length: 100 }),
  externalEntityType: varchar("externalEntityType", { length: 100 }),
  externalEntityId: varchar("externalEntityId", { length: 255 }),
  externalMetadata: json("externalMetadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  index("idx_documents_external_ref").on(table.externalSystem, table.externalEntityType, table.externalEntityId),
  uniqueIndex("idx_documents_external_ref_unique").on(table.organizationId, table.externalSystem, table.externalEntityType, table.externalEntityId),
]));

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Signature Fields - normalized table for field positions on a document's PDF.
 * Coordinates are stored as percentages (0-100) relative to PDF page dimensions.
 * This ensures zoom-independent, resolution-independent positioning.
 * Now includes "stamp" type for Japanese hanko/seal.
 */
export const signatureFields = mysqlTable("signatureFields", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  /** Stable client-side identifier for drag/drop operations */
  clientId: varchar("clientId", { length: 64 }).notNull(),
  page: int("page").notNull(),                    // 0-indexed page number
  xPercent: float("xPercent").notNull(),           // 0-100 from left
  yPercent: float("yPercent").notNull(),           // 0-100 from top
  widthPercent: float("widthPercent").notNull(),   // 0-100 of page width
  heightPercent: float("heightPercent").notNull(), // 0-100 of page height
  signerIndex: int("signerIndex").notNull(),       // 0-based: which recipient
  type: mysqlEnum("fieldType", ["signature", "date", "name", "initials", "stamp"]).default("signature").notNull(),
  label: varchar("label", { length: 255 }),
  required: boolean("required").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SignatureFieldRow = typeof signatureFields.$inferSelect;
export type InsertSignatureField = typeof signatureFields.$inferInsert;

/**
 * Signature Requests (Recipients) - tracks each person who needs to act on a document.
 * Supports sequential routing, roles (signer vs CC), and access codes.
 * Enhanced with IP address and user agent for audit trail.
 */
export const signatureRequests = mysqlTable("signatureRequests", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  signerEmail: varchar("signerEmail", { length: 320 }).notNull(),
  signerName: varchar("signerName", { length: 255 }),
  signerUserId: int("signerUserId"),
  /** Role: "signer" needs to sign, "cc" receives a copy only, "approver" approves without signing */
  recipientRole: mysqlEnum("recipientRole", ["signer", "cc", "approver"]).default("signer").notNull(),
  /** Sequential routing order (1-based). Lower order signs first. */
  order: int("order").default(1).notNull(),
  status: mysqlEnum("status", [
    "pending", "sent", "viewed", "signed", "declined", "expired"
  ]).default("pending").notNull(),
  /** Unique token for email-based access (no login required) */
  accessToken: varchar("accessToken", { length: 128 }).unique(),
  /** Optional access code (passcode) - stored as bcrypt hash */
  accessCode: varchar("accessCode", { length: 255 }),
  // Signature data (populated when signer completes)
  signatureDataUrl: mediumtext("signatureDataUrl"),
  signatureFont: varchar("signatureFont", { length: 100 }),
  /** Stamp (hanko) data URL - base64 PNG of generated seal image */
  stampDataUrl: mediumtext("stampDataUrl"),
  signedAt: timestamp("signedAt"),
  declinedAt: timestamp("declinedAt"),
  declineReason: text("declineReason"),
  message: text("message"),
  /** Audit trail: IP address at time of signing */
  signerIpAddress: varchar("signerIpAddress", { length: 45 }),
  /** Audit trail: User-Agent string at time of signing */
  signerUserAgent: text("signerUserAgent"),
  /** Delegation: email of the person this was delegated to */
  delegatedToEmail: varchar("delegatedToEmail", { length: 320 }),
  delegatedToName: varchar("delegatedToName", { length: 255 }),
  delegatedAt: timestamp("delegatedAt"),
  /** Recipient's preferred locale for email notifications (e.g., "ja", "en", "zh-CN") */
  locale: varchar("locale", { length: 10 }).default("ja").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SignatureRequest = typeof signatureRequests.$inferSelect;
export type InsertSignatureRequest = typeof signatureRequests.$inferInsert;

/**
 * Templates - reusable document templates with PDF and signature field definitions.
 * Scoped to the single self-hosted workspace and shared across staff members.
 */
export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Organization this template belongs to */
  organizationId: int("organizationId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  fileName: varchar("fileName", { length: 500 }),
  pageCount: int("pageCount").default(0),
  /** Number of signers this template expects */
  signerCount: int("signerCount").default(1),
  /** Default expiration days */
  defaultExpirationDays: int("defaultExpirationDays"),
  /** Default reminder days */
  defaultReminderDays: int("defaultReminderDays"),
  isPublic: boolean("isPublic").default(false).notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;

/**
 * Template Fields - signature field definitions for templates.
 * When a document is created from a template, these are deep-copied
 * into the signatureFields table.
 * Now includes "stamp" type for Japanese hanko/seal.
 */
export const templateFields = mysqlTable("templateFields", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  clientId: varchar("clientId", { length: 64 }).notNull(),
  page: int("page").notNull(),
  xPercent: float("xPercent").notNull(),
  yPercent: float("yPercent").notNull(),
  widthPercent: float("widthPercent").notNull(),
  heightPercent: float("heightPercent").notNull(),
  signerIndex: int("signerIndex").notNull(),
  type: mysqlEnum("templateFieldType", ["signature", "date", "name", "initials", "stamp"]).default("signature").notNull(),
  label: varchar("label", { length: 255 }),
  required: boolean("required").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TemplateFieldRow = typeof templateFields.$inferSelect;
export type InsertTemplateField = typeof templateFields.$inferInsert;

/**
 * Contacts - address book for signers.
 * Scoped to the single self-hosted workspace and shared across staff members.
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Organization this contact belongs to */
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 255 }),
  department: varchar("department", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  notes: text("notes"),
  category: varchar("category", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * Activity log - audit trail for document actions.
 * Enhanced with user agent for complete audit trail.
 */
export const activityLogs = mysqlTable("activityLogs", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId"),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 512 }),
  userAgent: text("userAgent"),
  actorEmail: varchar("actorEmail", { length: 512 }),
  /** Organization context for multi-tenant audit trail */
  organizationId: int("organizationId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

/**
 * FAQ entries - managed by admin
 */
export const faqs = mysqlTable("faqs", {
  id: int("id").autoincrement().primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: varchar("category", { length: 100 }),
  order: int("order").default(0).notNull(),
  isPublished: boolean("isPublished").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FAQ = typeof faqs.$inferSelect;
export type InsertFAQ = typeof faqs.$inferInsert;

/**
 * Inquiries - contact form submissions
 */
export const inquiries = mysqlTable("inquiries", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "read", "replied", "closed"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Inquiry = typeof inquiries.$inferSelect;
export type InsertInquiry = typeof inquiries.$inferInsert;

/**
 * Email notification log
 */
export const emailLogs = mysqlTable("emailLogs", {
  id: int("id").autoincrement().primaryKey(),
  toEmail: varchar("toEmail", { length: 320 }).notNull(),
  toName: varchar("toName", { length: 255 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  type: mysqlEnum("type", [
    "signature_request", "signature_complete", "signature_declined",
    "all_signed", "document_voided", "reminder",
    "password_reset", "staff_invitation"
  ]).notNull(),
  documentId: int("documentId"),
  signatureRequestId: int("signatureRequestId"),
  status: mysqlEnum("emailStatus", ["sent", "failed"]).default("sent").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

/**
 * Internal Approvals - 社内稟議フロー
 * Documents can require internal approval before being sent to external signers.
 * Approvers are processed in order (sequential approval chain).
 */
export const internalApprovals = mysqlTable("internalApprovals", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  approverEmail: varchar("approverEmail", { length: 320 }).notNull(),
  approverName: varchar("approverName", { length: 255 }),
  approverUserId: int("approverUserId"),
  /** Sequential order (1-based). Lower order approves first. */
  order: int("approvalOrder").default(1).notNull(),
  status: mysqlEnum("approvalStatus", [
    "pending", "approved", "rejected"
  ]).default("pending").notNull(),
  comment: text("approvalComment"),
  /** Unique token for email-based approval access */
  accessToken: varchar("approvalAccessToken", { length: 128 }),
  /** Locale selected from the sender's UI at the time the approval request was created. */
  locale: varchar("locale", { length: 10 }).default("ja").notNull(),
  decidedAt: timestamp("decidedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InternalApproval = typeof internalApprovals.$inferSelect;
export type InsertInternalApproval = typeof internalApprovals.$inferInsert;


/**
 * Contact Categories - user-defined categories for organizing contacts.
 * Users can create custom categories (e.g., 顧客, パートナー, 社内, 取引先, 法務).
 */
export const contactCategories = mysqlTable("contact_categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Organization this category belongs to */
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }),
  order: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContactCategory = typeof contactCategories.$inferSelect;
export type InsertContactCategory = typeof contactCategories.$inferInsert;

/**
 * Contact Groups - user-defined groups for organizing contacts.
 * Contacts can belong to multiple groups (many-to-many).
 */
export const contactGroups = mysqlTable("contact_groups", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Organization this group belongs to */
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContactGroup = typeof contactGroups.$inferSelect;
export type InsertContactGroup = typeof contactGroups.$inferInsert;

/**
 * Contact-Group membership (many-to-many join table).
 */
export const contactGroupMembers = mysqlTable("contact_group_members", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  groupId: int("groupId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("idx_cgm_contact_group").on(table.contactId, table.groupId),
]));

export type ContactGroupMember = typeof contactGroupMembers.$inferSelect;
export type InsertContactGroupMember = typeof contactGroupMembers.$inferInsert;

// ==================== IMMUTABLE AUDIT LOG (WORM) ====================

/**
 * System Audit Logs - Immutable, append-only audit trail.
 * 
 * This table implements WORM (Write Once Read Many) semantics:
 * - INSERT only — no UPDATE or DELETE is ever performed
 * - Each record includes a SHA-256 hash chain for tamper detection
 * - Records capture: who, what, when, where (IP/UA) for legal evidence
 * 
 * 電帳法対応: 「訂正・削除ができないシステム」の要件を満たすための不変監査ログ
 */
export const systemAuditLogs = mysqlTable("system_audit_logs", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  
  // Event classification
  eventType: varchar("eventType", { length: 100 }).notNull(),
  
  // Target entity
  entityType: varchar("entityType", { length: 50 }),   // 'document', 'signature_request', 'user', etc.
  entityId: int("entityId"),
  
  // Organization context
  organizationId: int("organizationId"),
  
  // Actor information
  actorUserId: int("actorUserId"),
  actorEmail: varchar("actorEmail", { length: 512 }),

  // Environment info (legal evidence)
  ipAddress: varchar("ipAddress", { length: 512 }),
  userAgent: text("userAgent"),
  
  // Event details (JSON)
  metadata: json("metadata"),
  
  // Hash chain for tamper detection
  previousHash: varchar("previousHash", { length: 64 }),   // SHA-256 of previous record
  recordHash: varchar("recordHash", { length: 64 }).notNull(), // SHA-256 of this record
  
  // NTP-synced server timestamp (millisecond precision)
  serverTimestamp: bigint("serverTimestamp", { mode: "number" }).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemAuditLog = typeof systemAuditLogs.$inferSelect;
export type InsertSystemAuditLog = typeof systemAuditLogs.$inferInsert;

// ==================== WORM Storage Registry ====================
// DB-level enforcement of Write-Once semantics.
// The UNIQUE constraint on `storageKey` physically prevents any
// second INSERT with the same key, even across multiple servers.

export const wormRecords = mysqlTable("worm_records", {
  id: int("id").autoincrement().primaryKey(),
  /** The S3 object key (e.g. worm/org-1/doc-42/...-signed.pdf) */
  storageKey: varchar("storageKey", { length: 512 }).notNull().unique(),
  /** SHA-256 of the stored file content */
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  /** Size in bytes */
  fileSizeBytes: int("fileSizeBytes").notNull(),
  /** Associated document ID */
  documentId: int("documentId").notNull(),
  /** Organization context */
  organizationId: int("organizationId").notNull(),
  /** User who triggered the store */
  actorUserId: int("actorUserId"),
  /** Public URL returned by S3 */
  url: text("url").notNull(),
  /** AES-256-GCM initialization vector (base64, 16 chars). NULL = not encrypted. */
  encryptionIv: varchar("encryptionIv", { length: 24 }),
  /** AES-256-GCM authentication tag (base64, 24 chars). NULL = not encrypted. */
  encryptionTag: varchar("encryptionTag", { length: 24 }),
  /** Encryption key version for rotation support (e.g. "v1"). NULL = unencrypted or pre-rotation. */
  keyVersion: varchar("keyVersion", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WormRecord = typeof wormRecords.$inferSelect;
export type InsertWormRecord = typeof wormRecords.$inferInsert;

// ==================== EXTERNAL INTEGRATIONS ====================

/**
 * API keys for third-party systems and automation clients.
 * Only SHA-256 hashes are stored. Keys must expire and may be revoked.
 */
export const integrationApiKeys = mysqlTable("integration_api_keys", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  createdByUserId: int("createdByUserId"),
  name: varchar("name", { length: 255 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 32 }).notNull(),
  keyHash: varchar("keyHash", { length: 64 }).notNull().unique(),
  scopes: json("scopes").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  index("idx_integration_api_keys_org").on(table.organizationId),
  index("idx_integration_api_keys_prefix").on(table.keyPrefix),
]));

export type IntegrationApiKey = typeof integrationApiKeys.$inferSelect;
export type InsertIntegrationApiKey = typeof integrationApiKeys.$inferInsert;

export const integrationWebhooks = mysqlTable("integration_webhooks", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  targetUrl: text("targetUrl").notNull(),
  secretHash: varchar("secretHash", { length: 64 }).notNull(),
  events: json("events").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdByApiKeyId: int("createdByApiKeyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  index("idx_integration_webhooks_org").on(table.organizationId),
]));

export type IntegrationWebhook = typeof integrationWebhooks.$inferSelect;
export type InsertIntegrationWebhook = typeof integrationWebhooks.$inferInsert;

export const integrationWebhookDeliveries = mysqlTable("integration_webhook_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  webhookId: int("webhookId").notNull(),
  organizationId: int("organizationId").notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  payload: json("payload").notNull(),
  status: mysqlEnum("status", ["pending", "delivered", "failed"]).default("pending").notNull(),
  attemptCount: int("attemptCount").default(0).notNull(),
  lastStatusCode: int("lastStatusCode"),
  lastError: text("lastError"),
  nextAttemptAt: timestamp("nextAttemptAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ([
  index("idx_integration_webhook_deliveries_webhook").on(table.webhookId),
  index("idx_integration_webhook_deliveries_status").on(table.status, table.nextAttemptAt),
]));

export type IntegrationWebhookDelivery = typeof integrationWebhookDeliveries.$inferSelect;
export type InsertIntegrationWebhookDelivery = typeof integrationWebhookDeliveries.$inferInsert;

export const integrationIdempotencyKeys = mysqlTable("integration_idempotency_keys", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  apiKeyId: int("apiKeyId").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull(),
  requestMethod: varchar("requestMethod", { length: 16 }).notNull(),
  requestPath: varchar("requestPath", { length: 512 }).notNull(),
  requestHash: varchar("requestHash", { length: 64 }).notNull(),
  responseStatus: int("responseStatus").notNull(),
  responseBody: json("responseBody").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ([
  uniqueIndex("uniq_integration_idempotency_key").on(table.organizationId, table.apiKeyId, table.idempotencyKey),
  index("idx_integration_idempotency_expires").on(table.expiresAt),
]));

export type IntegrationIdempotencyKey = typeof integrationIdempotencyKeys.$inferSelect;
export type InsertIntegrationIdempotencyKey = typeof integrationIdempotencyKeys.$inferInsert;

// ==================== ORGANIZATION IP RESTRICTIONS ====================

/**
 * Allowed IPs - organization-level IP restriction for security.
 * When entries exist for an org, only requests from listed IPs are allowed.
 */
export const allowedIps = mysqlTable("allowed_ips", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
  label: varchar("label", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AllowedIp = typeof allowedIps.$inferSelect;
export type InsertAllowedIp = typeof allowedIps.$inferInsert;
