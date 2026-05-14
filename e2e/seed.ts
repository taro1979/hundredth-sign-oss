/**
 * E2E Seed Script — idempotent test data insertion
 *
 * Inserts test users, organizations, memberships, documents,
 * templates, contacts, activity logs, and audit logs.
 *
 * WORM compliance:
 *   - activityLogs / systemAuditLogs: existence check → INSERT only (no UPDATE/DELETE)
 *
 * Run: dotenv -e .env.e2e -- tsx e2e/seed.ts
 */
import { createHash } from "crypto";
import { drizzle } from "drizzle-orm/mysql2";
import * as mysql from "mysql2/promise";
import { eq, and, ne, or, sql } from "drizzle-orm";
import {
  users,
  organizations,
  memberships,
  documents,
  templates,
  templateFields,
  contacts,
  contactCategories,
  activityLogs,
  systemAuditLogs,
  signatureRequests,
  wormRecords,
  internalApprovals,
} from "../drizzle/schema";
import { E2E_BASE_URL } from "./base-url";

// ── DB connection ──

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function main() {
  const pool = mysql.createPool(DATABASE_URL);
  const db = drizzle(pool);

  console.log("[seed] Starting E2E seed...");

  // ── 2. Users ──
  const superAdmin = await upsertUser(db, {
    openId: "e2e-super-admin",
    name: "E2E Super Admin",
    email: "superadmin@e2e-test.local",
    isSuperAdmin: true,
  });
  const owner = await upsertUser(db, {
    openId: "e2e-owner",
    name: "E2E Owner",
    email: "owner@e2e-test.local",
    isSuperAdmin: false,
  });
  const member = await upsertUser(db, {
    openId: "e2e-member",
    name: "E2E Member",
    email: "member@e2e-test.local",
    isSuperAdmin: false,
  });
  console.log("[seed] Users:", superAdmin.id, owner.id, member.id);

  // ── 2b. Clean up extra test orgs that persist from previous runs ──
  const extraOrgRows = await db.select().from(organizations)
    .where(and(
      ne(organizations.slug, "e2e-test-org"),
      // Only clean up orgs owned by our test users (member or owner)
      or(
        eq(organizations.ownerUserId, member.id),
        eq(organizations.ownerUserId, owner.id),
      ),
    ));
  for (const extraOrg of extraOrgRows) {
    await db.delete(memberships).where(eq(memberships.organizationId, extraOrg.id));
    await db.delete(organizations).where(eq(organizations.id, extraOrg.id));
    console.log(`[seed] Cleaned up extra org: ${extraOrg.name}`);
  }

  // ── 3. Organization ──
  const org = await upsertOrg(db, {
    name: "E2E Test Org",
    slug: "e2e-test-org",
    ownerUserId: owner.id,
  });
  console.log("[seed] Organization:", org.id);


  // ── 3.1. Clean up leftover E2E templates (from aborted runs) ──
  const staleTemplates = await db.select().from(templates)
    .where(and(
      eq(templates.organizationId, org.id),
      ne(templates.title, "E2E Test Template"),
    ));
  for (const tmpl of staleTemplates) {
    await db.delete(templateFields).where(eq(templateFields.templateId, tmpl.id));
    await db.delete(templates).where(eq(templates.id, tmpl.id));
    console.log(`[seed] Cleaned up template: ${tmpl.title}`);
  }

  // ── 4. Memberships ──
  await upsertMembership(db, {
    userId: owner.id,
    organizationId: org.id,
    role: "owner",
  });
  await upsertMembership(db, {
    userId: member.id,
    organizationId: org.id,
    role: "member",
  });
  console.log("[seed] Memberships created");

  // ── 5. Documents ──
  const docDraft = await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Draft Document",
    status: "draft",
  });
  const docSent = await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Sent Document",
    status: "sent",
  });
  const docCompleted = await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Completed Document",
    status: "completed",
    signedFileUrl: "https://e2e-fixtures.local/signed-sample.pdf",
  });
  // docDeletable: used by DO-04 delete test (separate doc so "E2E Draft Document" survives for PDF-04)
  await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Deletable Document",
    status: "draft",
  });
  console.log("[seed] Documents:", docDraft.id, docSent.id, docCompleted.id);

  // ── 5.3. Signature flow test documents ──
  // docForSign: sent status doc for SG-01 (text signature)
  const docForSign = await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Sign Flow Document",
    status: "sent",
  });
  // docForDecline: sent status doc for SG-02 (decline)
  const docForDecline = await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Decline Flow Document",
    status: "sent",
  });
  // docForDelegate: sent status doc for SG-03 (delegate)
  const docForDelegate = await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Delegate Flow Document",
    status: "sent",
  });
  // docForAccessCode: sent status doc for SG-04 (access code)
  const docForAccessCode = await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Access Code Document",
    status: "sent",
  });
  console.log("[seed] Sign flow docs:", docForSign.id, docForDecline.id, docForDelegate.id, docForAccessCode.id);

  // Signature requests for sign flow tests (signer email: external-sign@e2e-test.local)
  await upsertSignatureRequest(db, {
    documentId: docForSign.id,
    signerEmail: "external-sign@e2e-test.local",
    signerName: "External Sign User",
    recipientRole: "signer",
    order: 1,
    status: "sent",
    accessToken: "e2e-sign-token",
  });
  // Second signer for docForSign: prevents allSigned=true when SG-01 signs, avoiding PDF generation
  // (docForSign has no fileUrl, so PDF embedding would fail with 500 if completion is triggered)
  await upsertSignatureRequest(db, {
    documentId: docForSign.id,
    signerEmail: "external-sign2@e2e-test.local",
    signerName: "External Sign User 2",
    recipientRole: "signer",
    order: 2,
    status: "sent",
    accessToken: "e2e-sign-token-s2",
  });
  await upsertSignatureRequest(db, {
    documentId: docForDecline.id,
    signerEmail: "external-sign@e2e-test.local",
    signerName: "External Sign User",
    recipientRole: "signer",
    order: 1,
    status: "sent",
    accessToken: "e2e-decline-token",
  });
  await upsertSignatureRequest(db, {
    documentId: docForDelegate.id,
    signerEmail: "external-sign@e2e-test.local",
    signerName: "External Sign User",
    recipientRole: "signer",
    order: 1,
    status: "sent",
    accessToken: "e2e-delegate-token",
  });
  // Access code request: hasAccessCode is stored as a hash in the DB, but for E2E we
  // seed a request without access code and test the flow via API directly.
  await upsertSignatureRequest(db, {
    documentId: docForAccessCode.id,
    signerEmail: "external-sign@e2e-test.local",
    signerName: "External Sign User",
    recipientRole: "signer",
    order: 1,
    status: "sent",
    accessToken: "e2e-access-code-token",
  });
  console.log("[seed] Sign flow signature requests seeded");

  // ── 5.3b. Sequential signing test documents (SG-10, SG-11 — F-17) ──
  const docSeqSign = await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Sequential Sign Document",
    status: "sent",
  });
  await upsertSignatureRequest(db, {
    documentId: docSeqSign.id,
    signerEmail: "e2e-seq-signer1@e2e-test.local",
    signerName: "E2E Sequential Signer 1",
    recipientRole: "signer",
    order: 1,
    status: "sent",
    accessToken: "e2e-seq-s1-token",
  });
  await upsertSignatureRequest(db, {
    documentId: docSeqSign.id,
    signerEmail: "e2e-seq-signer2@e2e-test.local",
    signerName: "E2E Sequential Signer 2",
    recipientRole: "signer",
    order: 2,
    status: "pending",
    accessToken: "e2e-seq-s2-token",
  });
  console.log("[seed] Sequential sign doc seeded:", docSeqSign.id);

  // ── 5.3c. Send validation test document (DO-12 — F-16) ──
  await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Send Validation Document",
    status: "draft",
  });
  console.log("[seed] Send validation doc seeded");

  // ── 5.4. Internal approval test documents ──
  // docPendingApproval: sent status doc with a pending internal approval
  const docPendingApproval = await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Pending Approval Document",
    status: "pending_internal_approval",
  });
  // docRejectedApproval: draft status doc (was rejected → back to draft)
  const docRejectedApproval = await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Rejected Approval Document",
    status: "draft",
  });
  console.log("[seed] Approval docs:", docPendingApproval.id, docRejectedApproval.id);

  // docApproveAction: separate doc for AP-02 (approve action)
  const docApproveAction = await upsertDocument(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Approve Action Document",
    status: "pending_internal_approval",
  });
  console.log("[seed] Approve action doc:", docApproveAction.id);

  // Internal approvals
  // AP-01: view pending approval page
  await upsertInternalApproval(db, {
    documentId: docPendingApproval.id,
    approverEmail: "member@e2e-test.local",
    approverName: "E2E Member",
    order: 1,
    status: "pending",
    accessToken: "e2e-approval-pending-token",
  });
  // AP-02: perform approve action (separate doc/token to avoid conflict with AP-01)
  await upsertInternalApproval(db, {
    documentId: docApproveAction.id,
    approverEmail: "member@e2e-test.local",
    approverName: "E2E Member",
    order: 1,
    status: "pending",
    accessToken: "e2e-approval-action-token",
  });
  // AP-03/AP-04: rejected approval (for viewing already-decided state)
  await upsertInternalApproval(db, {
    documentId: docRejectedApproval.id,
    approverEmail: "member@e2e-test.local",
    approverName: "E2E Member",
    order: 1,
    status: "rejected",
    accessToken: "e2e-approval-rejected-token",
  });
  // Signature request for docPendingApproval (to be sent after approval)
  await upsertSignatureRequest(db, {
    documentId: docPendingApproval.id,
    signerEmail: "external-signer@e2e-test.local",
    signerName: "External Signer",
    recipientRole: "signer",
    order: 1,
    status: "pending",
    accessToken: "e2e-approval-doc-sign-token",
  });
  console.log("[seed] Internal approvals seeded");

  // ── 5.5. Import-related users and orgs ──
  const signer = await upsertUser(db, {
    openId: "e2e-signer",
    name: "E2E Signer",
    email: "signer@e2e-test.local",
    isSuperAdmin: false,
  });
  const signerOrg = await upsertOrg(db, {
    name: "E2E Signer Org",
    slug: "e2e-signer-org",
    ownerUserId: signer.id,
  });
  await upsertMembership(db, { userId: signer.id, organizationId: signerOrg.id, role: "owner" });
  console.log("[seed] Signer user/org:", signer.id, signerOrg.id);

  // ── 6. Templates ──
  const tmpl = await upsertTemplate(db, {
    userId: owner.id,
    organizationId: org.id,
    title: "E2E Test Template",
    description: "Template for E2E testing",
  });
  console.log("[seed] Template:", tmpl.id);

  // ── 7. Contacts ──
  const c1 = await upsertContact(db, {
    userId: owner.id,
    organizationId: org.id,
    name: "田中太郎",
    email: "tanaka@e2e-test.local",
    company: "テスト株式会社",
  });
  const c2 = await upsertContact(db, {
    userId: owner.id,
    organizationId: org.id,
    name: "佐藤花子",
    email: "sato@e2e-test.local",
    company: "サンプル合同会社",
  });
  const c3 = await upsertContact(db, {
    userId: owner.id,
    organizationId: org.id,
    name: "鈴木一郎",
    email: "suzuki@e2e-test.local",
    company: "例示産業株式会社",
  });
  console.log("[seed] Contacts:", c1.id, c2.id, c3.id);

  // ── 8. Contact Categories ──
  await upsertContactCategory(db, {
    userId: owner.id,
    organizationId: org.id,
    name: "取引先",
    color: "#3b82f6",
  });
  console.log("[seed] Contact category created");

  // ── 9. Activity Logs (WORM: INSERT only if not exists) ──
  await insertActivityLogIfNotExists(db, {
    documentId: docDraft.id,
    userId: owner.id,
    organizationId: org.id,
    action: "document.created",
    details: "E2E test: draft document created",
  });
  await insertActivityLogIfNotExists(db, {
    documentId: docCompleted.id,
    userId: owner.id,
    organizationId: org.id,
    action: "document.completed",
    details: "E2E test: document completed",
  });
  console.log("[seed] Activity logs seeded");

  // ── 10. System Audit Logs (WORM: INSERT only if not exists, with hash chain) ──
  await seedAuditLogs(db, org.id, owner.id);
  console.log("[seed] System audit logs seeded");

  console.log("[seed] ✅ E2E seed complete");
  await pool.end();
  process.exit(0);
}

// ── Helper functions ──

async function upsertUser(db: any, data: {
  openId: string; name: string; email: string; isSuperAdmin: boolean;
}) {
  const [existing] = await db.select().from(users).where(eq(users.openId, data.openId)).limit(1);
  if (existing) {
    await db.update(users).set({ name: data.name, email: data.email, isSuperAdmin: data.isSuperAdmin })
      .where(eq(users.openId, data.openId));
    const [updated] = await db.select().from(users).where(eq(users.openId, data.openId)).limit(1);
    return updated;
  }
  const [result] = await db.insert(users).values(data);
  const [inserted] = await db.select().from(users).where(eq(users.id, result.insertId)).limit(1);
  return inserted;
}

async function upsertOrg(db: any, data: {
  name: string; slug: string; ownerUserId: number;
}) {
  const [existing] = await db.select().from(organizations).where(eq(organizations.slug, data.slug)).limit(1);
  if (existing) {
    await db.update(organizations)
      .set({ name: data.name, ownerUserId: data.ownerUserId })
      .where(eq(organizations.slug, data.slug));
    const [updated] = await db.select().from(organizations).where(eq(organizations.slug, data.slug)).limit(1);
    return updated;
  }
  const [result] = await db.insert(organizations).values(data);
  const [inserted] = await db.select().from(organizations).where(eq(organizations.id, result.insertId)).limit(1);
  return inserted;
}

async function upsertMembership(db: any, data: {
  userId: number; organizationId: number; role: "owner" | "manager" | "member";
}) {
  const [existing] = await db.select().from(memberships)
    .where(and(eq(memberships.userId, data.userId), eq(memberships.organizationId, data.organizationId)))
    .limit(1);
  if (existing) {
    await db.delete(memberships).where(eq(memberships.id, existing.id));
  }
  const [result] = await db.insert(memberships).values({ ...data, isActive: true });
  const [inserted] = await db.select().from(memberships).where(eq(memberships.id, result.insertId)).limit(1);
  return inserted;
}

async function upsertDocument(db: any, data: {
  userId: number; organizationId: number; title: string; status: string; signedFileUrl?: string;
}) {
  const [existing] = await db.select().from(documents)
    .where(and(eq(documents.title, data.title), eq(documents.organizationId, data.organizationId)))
    .limit(1);
  if (existing) {
    await db.update(documents)
      .set({ status: data.status, signedFileUrl: data.signedFileUrl ?? null })
      .where(eq(documents.id, existing.id));
    return existing;
  }
  const [result] = await db.insert(documents).values(data);
  const [inserted] = await db.select().from(documents).where(eq(documents.id, result.insertId)).limit(1);
  return inserted;
}

async function upsertTemplate(db: any, data: {
  userId: number; organizationId: number; title: string; description: string;
}) {
  const [existing] = await db.select().from(templates)
    .where(and(eq(templates.title, data.title), eq(templates.organizationId, data.organizationId)))
    .limit(1);
  if (existing) return existing;
  const [result] = await db.insert(templates).values(data);
  const [inserted] = await db.select().from(templates).where(eq(templates.id, result.insertId)).limit(1);
  return inserted;
}

async function upsertContact(db: any, data: {
  userId: number; organizationId: number; name: string; email: string; company: string;
}) {
  const [existing] = await db.select().from(contacts)
    .where(and(eq(contacts.email, data.email), eq(contacts.organizationId, data.organizationId)))
    .limit(1);
  if (existing) return existing;
  const [result] = await db.insert(contacts).values(data);
  const [inserted] = await db.select().from(contacts).where(eq(contacts.id, result.insertId)).limit(1);
  return inserted;
}

async function upsertContactCategory(db: any, data: {
  userId: number; organizationId: number; name: string; color: string;
}) {
  const [existing] = await db.select().from(contactCategories)
    .where(and(eq(contactCategories.name, data.name), eq(contactCategories.organizationId, data.organizationId)))
    .limit(1);
  if (existing) return existing;
  const [result] = await db.insert(contactCategories).values(data);
  return { id: result.insertId, ...data };
}

// WORM: INSERT only — existence check first
async function insertActivityLogIfNotExists(db: any, data: {
  documentId: number; userId: number; organizationId: number;
  action: string; details: string;
}) {
  const [existing] = await db.select().from(activityLogs)
    .where(and(
      eq(activityLogs.documentId, data.documentId),
      eq(activityLogs.action, data.action),
      eq(activityLogs.organizationId, data.organizationId),
    ))
    .limit(1);
  if (existing) return existing;
  const [result] = await db.insert(activityLogs).values(data);
  return { id: result.insertId, ...data };
}

// ── Audit log hash chain (mirrors server/auditLog.ts computeRecordHash) ──

function stableJsonStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return "";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(stableJsonStringify).join(",") + "]";
  }
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  const parts = sorted.map(
    (k) => JSON.stringify(k) + ":" + stableJsonStringify((obj as Record<string, unknown>)[k]),
  );
  return "{" + parts.join(",") + "}";
}

function computeRecordHash(
  previousHash: string | null,
  entry: {
    eventType: string;
    entityType?: string;
    entityId?: number;
    actorUserId?: number;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  },
  serverTimestamp: number,
): string {
  const payload = [
    previousHash ?? "GENESIS",
    entry.eventType,
    entry.entityType ?? "",
    String(entry.entityId ?? ""),
    String(entry.actorUserId ?? ""),
    entry.ipAddress ?? "",
    String(serverTimestamp),
    entry.metadata ? stableJsonStringify(entry.metadata) : "",
  ].join("|");

  return createHash("sha256").update(payload, "utf8").digest("hex");
}

async function seedAuditLogs(db: any, orgId: number, ownerUserId: number) {
  // Check if we already have E2E audit logs for this org
  const [existing] = await db.select({ count: sql<number>`count(*)` })
    .from(systemAuditLogs)
    .where(eq(systemAuditLogs.organizationId, orgId));

  if (existing && existing.count >= 2) {
    console.log("[seed] Audit logs already exist, skipping");
    return;
  }

  // Get the latest hash in the table (if any)
  const [lastRecord] = await db.select({ recordHash: systemAuditLogs.recordHash })
    .from(systemAuditLogs)
    .orderBy(sql`id DESC`)
    .limit(1);

  let previousHash: string | null = lastRecord?.recordHash ?? null;

  // Insert 2 audit log entries
  const entries = [
    {
      eventType: "document.created",
      entityType: "document",
      entityId: 1,
      organizationId: orgId,
      actorUserId: ownerUserId,
      ipAddress: "127.0.0.1",
      metadata: { source: "e2e-seed", title: "E2E Draft Document" },
    },
    {
      eventType: "document.completed",
      entityType: "document",
      entityId: 3,
      organizationId: orgId,
      actorUserId: ownerUserId,
      ipAddress: "127.0.0.1",
      metadata: { source: "e2e-seed", title: "E2E Completed Document" },
    },
  ];

  for (const entry of entries) {
    const serverTimestamp = Date.now();
    const recordHash = computeRecordHash(previousHash, entry, serverTimestamp);

    await db.insert(systemAuditLogs).values({
      ...entry,
      previousHash,
      recordHash,
      serverTimestamp,
    });

    previousHash = recordHash;
  }
}

async function upsertSignatureRequest(db: any, data: {
  documentId: number;
  signerEmail: string;
  signerName?: string;
  recipientRole: "signer" | "cc" | "approver";
  order: number;
  status: "pending" | "sent" | "viewed" | "signed" | "declined" | "expired";
  accessToken: string;
}) {
  const [existing] = await db.select().from(signatureRequests)
    .where(eq(signatureRequests.accessToken, data.accessToken))
    .limit(1);
  if (existing) {
    await db.update(signatureRequests)
      .set({
        documentId: data.documentId,
        signerEmail: data.signerEmail,
        signerName: data.signerName ?? null,
        signerUserId: null,
        recipientRole: data.recipientRole,
        order: data.order,
        status: data.status,
        accessCode: null,
        signatureDataUrl: null,
        signatureFont: null,
        stampDataUrl: null,
        signedAt: null,
        declinedAt: null,
        declineReason: null,
        message: null,
        signerIpAddress: null,
        signerUserAgent: null,
        delegatedToEmail: null,
        delegatedToName: null,
        delegatedAt: null,
        locale: "ja",
      })
      .where(eq(signatureRequests.id, existing.id));
    const [updated] = await db.select().from(signatureRequests)
      .where(eq(signatureRequests.id, existing.id)).limit(1);
    return updated;
  }
  const [result] = await db.insert(signatureRequests).values(data);
  const [inserted] = await db.select().from(signatureRequests)
    .where(eq(signatureRequests.id, result.insertId)).limit(1);
  return inserted;
}

async function upsertInternalApproval(db: any, data: {
  documentId: number;
  approverEmail: string;
  approverName?: string;
  order: number;
  status: "pending" | "approved" | "rejected";
  accessToken: string;
}) {
  const [existing] = await db.select().from(internalApprovals)
    .where(eq(internalApprovals.accessToken, data.accessToken))
    .limit(1);
  if (existing) {
    await db.update(internalApprovals)
      .set({ status: data.status })
      .where(eq(internalApprovals.id, existing.id));
    const [updated] = await db.select().from(internalApprovals)
      .where(eq(internalApprovals.id, existing.id)).limit(1);
    return updated;
  }
  const [result] = await db.insert(internalApprovals).values(data);
  const [inserted] = await db.select().from(internalApprovals)
    .where(eq(internalApprovals.id, result.insertId)).limit(1);
  return inserted;
}

async function upsertWormRecord(db: any, data: {
  storageKey: string;
  contentHash: string;
  fileSizeBytes: number;
  documentId: number;
  organizationId: number;
  actorUserId: number;
  url: string;
}) {
  const [existing] = await db.select().from(wormRecords)
    .where(eq(wormRecords.storageKey, data.storageKey))
    .limit(1);
  if (existing) return existing;
  const [result] = await db.insert(wormRecords).values(data);
  const [inserted] = await db.select().from(wormRecords)
    .where(eq(wormRecords.id, result.insertId)).limit(1);
  return inserted;
}

main().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
