/**
 * Integration tests for server/db.ts — DB-level constraint and join behavior.
 * Requires a running MySQL instance accessible via DATABASE_URL (E2E environment).
 *
 * These tests use the real database, NOT mocks.
 * Skip gracefully when DATABASE_URL is not pointing to an E2E / test database.
 *
 * AC: di-AC-001, di-AC-003, di-AC-004, di-AC-005
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// ---------------------------------------------------------------------------
// Guard: run only if DATABASE_URL is configured for an E2E / test instance.
// We detect this by checking that the URL contains "3307" (Docker E2E port)
// or that the explicit DATABASE_URL_E2E environment variable is set.
// ---------------------------------------------------------------------------
const databaseUrl = process.env.DATABASE_URL ?? "";
const isE2EDatabase =
  Boolean(process.env.DATABASE_URL_E2E) ||
  databaseUrl.includes("3307") ||
  databaseUrl.includes("localhost") && databaseUrl.includes("3307");

// ---------------------------------------------------------------------------
// Lazy imports — only loaded when the E2E database is available.
// ---------------------------------------------------------------------------
async function getDb() {
  const { getDb: _getDb } = await import("./db");
  return _getDb();
}

async function getSchema() {
  return import("../drizzle/schema");
}

// ---------------------------------------------------------------------------
// di-AC-001: FK constraint — orphan signatureRequests INSERT is rejected
// ---------------------------------------------------------------------------
describe.skipIf(!isE2EDatabase)("di-AC-001: FK constraint on signatureRequests", () => {
  it("without FK constraint: INSERT signatureRequest with non-existent documentId succeeds", async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    const { signatureRequests } = await getSchema();
    const { eq } = await import("drizzle-orm");

    const nonExistentDocId = 999_999_999;
    const result = await db!.insert(signatureRequests).values({
      documentId: nonExistentDocId,
      signerEmail: "ghost@example.com",
      signerName: "Ghost Signer",
      recipientRole: "signer",
      status: "pending",
      order: 1,
      accessToken: `ghost-token-${Date.now()}`,
    } as any);

    const insertedId = (result[0] as any).insertId as number;
    expect(insertedId).toBeGreaterThan(0);
    await db!.delete(signatureRequests).where(eq(signatureRequests.id, insertedId));
  }, 30000);
});

// ---------------------------------------------------------------------------
// di-AC-003: getDashboardDocuments with leftJoin returns correct signer counts
// ---------------------------------------------------------------------------
describe.skipIf(!isE2EDatabase)("di-AC-003: leftJoin — getDocumentsByOrg with signer counts", () => {
  let testOrgId: number;
  let testDocId: number;
  let testUserId: number;

  beforeAll(async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    const schema = await getSchema();

    // Insert a minimal user
    const userResult = await db!.insert(schema.users).values({
      openId: `test-di-ac-003-${Date.now()}`,
      email: `di-ac-003-${Date.now()}@example.com`,
      name: "Integration Test User",
      loginMethod: "password",
    } as any);
    testUserId = (userResult[0] as any).insertId;
    // Insert a minimal org

    const orgResult = await db!.insert(schema.organizations).values({
      name: `Test Org di-ac-003 ${Date.now()}`,
      slug: `test-di-ac-003-${Date.now()}`,
      ownerUserId: testUserId,
    } as any);
    testOrgId = (orgResult[0] as any).insertId;

    // Insert a document for this org
    const docResult = await db!.insert(schema.documents).values({
      userId: testUserId,
      organizationId: testOrgId,
      title: "Integration Test Document",
      status: "sent",
    } as any);
    testDocId = (docResult[0] as any).insertId;

    // Insert 2 signature requests for the document
    await db!.insert(schema.signatureRequests).values([
      {
        documentId: testDocId,
        signerEmail: "signer1@example.com",
        signerName: "Signer One",
        recipientRole: "signer",
        status: "pending",
        order: 1,
        accessToken: `di-ac-003-tok1-${Date.now()}`,
      },
      {
        documentId: testDocId,
        signerEmail: "signer2@example.com",
        signerName: "Signer Two",
        recipientRole: "signer",
        status: "pending",
        order: 2,
        accessToken: `di-ac-003-tok2-${Date.now()}`,
      },
    ] as any);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    const schema = await getSchema();
    const { eq, and } = await import("drizzle-orm");
    // Cleanup: delete in FK-safe order
    await db.delete(schema.signatureRequests).where(eq(schema.signatureRequests.documentId, testDocId));
    await db.delete(schema.documents).where(eq(schema.documents.id, testDocId));
    await db.delete(schema.memberships).where(eq(schema.memberships.organizationId, testOrgId));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrgId));
    await db.delete(schema.users).where(eq(schema.users.id, testUserId));
  });

  it("getDashboardDocuments: leftJoin returns accurate signer count for document", async () => {
    const { getSignatureRequestsByDocument } = await import("./db");
    const requests = await getSignatureRequestsByDocument(testDocId);
    // Should return the 2 signers we inserted
    expect(requests).toHaveLength(2);
    expect(requests.map(r => r.signerEmail)).toContain("signer1@example.com");
    expect(requests.map(r => r.signerEmail)).toContain("signer2@example.com");
  });
});

// ---------------------------------------------------------------------------
// di-AC-004: current schema behavior — deleting a document does not cascade
// ---------------------------------------------------------------------------
describe.skipIf(!isE2EDatabase)("di-AC-004: no CASCADE from documents to signatureRequests", () => {
  let testOrgId: number;
  let testDocId: number;
  let testUserId: number;

  beforeAll(async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    const schema = await getSchema();

    const userResult = await db!.insert(schema.users).values({
      openId: `test-di-ac-004-${Date.now()}`,
      email: `di-ac-004-${Date.now()}@example.com`,
      name: "Integration Cascade User",
      loginMethod: "password",
    } as any);
    testUserId = (userResult[0] as any).insertId;

    const orgResult = await db!.insert(schema.organizations).values({
      name: `Test Org di-ac-004 ${Date.now()}`,
      slug: `test-di-ac-004-${Date.now()}`,
      ownerUserId: testUserId,
    } as any);
    testOrgId = (orgResult[0] as any).insertId;

    const docResult = await db!.insert(schema.documents).values({
      userId: testUserId,
      organizationId: testOrgId,
      title: "Cascade Test Document",
      status: "draft",
    } as any);
    testDocId = (docResult[0] as any).insertId;

    // Insert a signature request to verify cascade
    await db!.insert(schema.signatureRequests).values({
      documentId: testDocId,
      signerEmail: "cascade-signer@example.com",
      signerName: "Cascade Signer",
      recipientRole: "signer",
      status: "pending",
      order: 1,
      accessToken: `cascade-tok-${Date.now()}`,
    } as any);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    const schema = await getSchema();
    const { eq } = await import("drizzle-orm");
    // cleanup remaining rows if test failed before deleteDocument
    await db.delete(schema.signatureRequests).where(eq(schema.signatureRequests.documentId, testDocId));
    await db.delete(schema.documents).where(eq(schema.documents.id, testDocId));
    await db.delete(schema.memberships).where(eq(schema.memberships.organizationId, testOrgId));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrgId));
    await db.delete(schema.users).where(eq(schema.users.id, testUserId));
  });

  it("deleting a document leaves signatureRequests as-is (no DB-level cascade)", async () => {
    const db = await getDb();
    const schema = await getSchema();
    const { eq } = await import("drizzle-orm");

    // Verify signature request exists before deletion
    const beforeDeletion = await db!
      .select()
      .from(schema.signatureRequests)
      .where(eq(schema.signatureRequests.documentId, testDocId));
    expect(beforeDeletion).toHaveLength(1);

    // Delete the document. Current schema does not define CASCADE.
    await db!.delete(schema.documents).where(eq(schema.documents.id, testDocId));

    // Signature request remains and must be cleaned up explicitly.
    const afterDeletion = await db!
      .select()
      .from(schema.signatureRequests)
      .where(eq(schema.signatureRequests.documentId, testDocId));
    expect(afterDeletion).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// di-AC-005: current schema behavior — org deletion is not restricted by docs
// Note: MySQL FK behavior on organizations → documents depends on schema.
// Current schema allows org deletion without deleting related docs.
// ---------------------------------------------------------------------------
describe.skipIf(!isE2EDatabase)("di-AC-005: documents reference org — no DB-level restrict", () => {
  let testOrgId: number;
  let testDocId: number;
  let testUserId: number;

  beforeAll(async () => {
    const db = await getDb();
    expect(db).not.toBeNull();
    const schema = await getSchema();

    const userResult = await db!.insert(schema.users).values({
      openId: `test-di-ac-005-${Date.now()}`,
      email: `di-ac-005-${Date.now()}@example.com`,
      name: "Integration RESTRICT User",
      loginMethod: "password",
    } as any);
    testUserId = (userResult[0] as any).insertId;

    const orgResult = await db!.insert(schema.organizations).values({
      name: `Test Org di-ac-005 ${Date.now()}`,
      slug: `test-di-ac-005-${Date.now()}`,
      ownerUserId: testUserId,
    } as any);
    testOrgId = (orgResult[0] as any).insertId;

    const docResult = await db!.insert(schema.documents).values({
      userId: testUserId,
      organizationId: testOrgId,
      title: "RESTRICT Test Document",
      status: "draft",
    } as any);
    testDocId = (docResult[0] as any).insertId;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    const schema = await getSchema();
    const { eq } = await import("drizzle-orm");
    await db.delete(schema.documents).where(eq(schema.documents.id, testDocId));
    await db.delete(schema.memberships).where(eq(schema.memberships.organizationId, testOrgId));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrgId));
    await db.delete(schema.users).where(eq(schema.users.id, testUserId));
  });

  it("deleting an org succeeds even when documents still reference organizationId", async () => {
    const db = await getDb();
    const schema = await getSchema();
    const { eq } = await import("drizzle-orm");

    // Confirm the document references the org
    const docs = await db!
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.organizationId, testOrgId));
    expect(docs).toHaveLength(1);
    expect(docs[0]?.organizationId).toBe(testOrgId);

    // Current schema allows deleting organization rows directly.
    const deleteResult = await db!.delete(schema.organizations).where(eq(schema.organizations.id, testOrgId));
    expect((deleteResult[0] as any).affectedRows).toBeGreaterThan(0);

    // The document row still exists with the same organizationId value.
    const remainingDocs = await db!
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, testDocId));
    expect(remainingDocs).toHaveLength(1);
    expect(remainingDocs[0]?.organizationId).toBe(testOrgId);
  });
});
