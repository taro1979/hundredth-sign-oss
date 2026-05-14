/**
 * Immutable Audit Log Service (WORM - Write Once Read Many)
 * 
 * 電帳法対応: 「訂正・削除ができないシステム」の要件を満たす不変監査ログ
 * 
 * - INSERT only — no UPDATE or DELETE functions are exposed
 * - SHA-256 hash chain for tamper detection
 * - NTP-synced server timestamps
 * - Application-layer WORM guard (no update/delete operations)
 * - DB-level row locking (SELECT ... FOR UPDATE) prevents race conditions
 *   across multiple servers / Pods in a horizontally-scaled deployment
 */

import { createHash } from "crypto";
import { getDb } from "./db";
import { systemAuditLogs } from "../drizzle/schema";
import { eq, desc, asc, and, gte, lte, sql } from "drizzle-orm";
import { encryptPii, decryptPii, decryptPiiFields } from "./piiEncryption";

// ==================== Types ====================

export type AuditEventType =
  // Document lifecycle
  | "document.created"
  | "document.uploaded"
  | "document.sent"
  | "document.viewed"
  | "document.completed"
  | "document.voided"
  | "document.deleted"
  // Signature events
  | "signature.viewed"
  | "signature.signed"
  | "signature.declined"
  | "signature.reminded"
  | "signature.delegated"
  // Authentication events
  | "auth.email_verified"
  | "auth.access_code_verified"
  // PDF processing events
  | "pdf.signed"
  | "pdf.stored_worm"
  | "pdf.certificate_appended"
  | "pdf.permission_lock_failed"
  | "pdf.worm_stored"
  // Organization events
  | "org.created"
  | "org.updated"
  | "org.member_removed"
  | "org.role_changed"
  // Template events
  | "template.created"
  | "template.updated"
  | "template.deleted"
  // Internal approval events
  | "approval.requested"
  | "approval.approved"
  | "approval.rejected"
  // External integration events
  | "integration.api_key.created"
  | "integration.api_key.revoked"
  | "integration.webhook.created"
  | "integration.webhook.tested"
  // Integrity events (H-04)
  | "integrity.chain_broken";

export type EntityType =
  | "document"
  | "signature_request"
  | "user"
  | "organization"
  | "membership"
  | "template"
  | "internal_approval"
  | "integration_api_key"
  | "integration_webhook"
  | "pdf";

export interface AuditLogEntry {
  eventType: AuditEventType;
  entityType?: EntityType;
  entityId?: number;
  organizationId?: number;
  actorUserId?: number;
  actorEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

// ==================== Hash Chain ====================

/**
 * Deterministic JSON serialization with sorted keys.
 * MySQL JSON columns reorder keys alphabetically, so we must sort
 * to ensure the same hash regardless of insertion vs read-back order.
 */
function stableJsonStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return "";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(stableJsonStringify).join(",") + "]";
  }
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  const parts = sorted.map(k => JSON.stringify(k) + ":" + stableJsonStringify((obj as Record<string, unknown>)[k]));
  return "{" + parts.join(",") + "}";
}

export function computeRecordHash(
  previousHash: string | null,
  entry: AuditLogEntry,
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

// ==================== Core INSERT function ====================

/**
 * Append an immutable audit log entry using DB-level row locking.
 *
 * Design (race-condition safe for horizontal scaling):
 *   1. BEGIN TRANSACTION
 *   2. SELECT ... ORDER BY id DESC LIMIT 1 FOR UPDATE
 *      → acquires an exclusive row lock on the latest record so no other
 *        Pod / server can read the same "latest hash" concurrently.
 *   3. Compute the new recordHash chaining from the locked previousHash.
 *   4. INSERT the new row.
 *   5. COMMIT — releases the lock.
 *
 * If two servers race, the second one blocks at step 2 until the first
 * commits, then reads the freshly inserted row as the new latest.
 *
 * No in-memory cache (`lastHashCache`) is used — the DB is always the
 * single source of truth.
 */
export async function appendAuditLog(entry: AuditLogEntry): Promise<{ id: number; recordHash: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available for audit log");

  // Drizzle ORM exposes the underlying mysql2 pool via .$client.
  // drizzle() with a URL string creates a callback-style mysql2 Pool.
  // We must convert it to a promise pool via .promise() before awaiting methods.
  const rawPool = (db as any).$client;
  const pool = (rawPool && typeof (rawPool as any).promise === "function")
    ? (rawPool as any).promise()
    : rawPool;
  if (!pool || typeof pool.getConnection !== "function") {
    // Fallback: if pool is not available (e.g. in test), use non-transactional path
    return appendAuditLogFallback(db, entry);
  }

  let conn: any;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Step 1: Lock the latest row with SELECT ... FOR UPDATE
    const [rows] = await conn.execute(
      `SELECT recordHash FROM system_audit_logs ORDER BY id DESC LIMIT 1 FOR UPDATE`
    );
    const previousHash: string | null = (rows as any[])?.[0]?.recordHash ?? null;

    // Step 2: Compute hash (uses RAW ipAddress — MUST happen before PII encryption)
    const serverTimestamp = Date.now();
    const recordHash = computeRecordHash(previousHash, entry, serverTimestamp);

    // Step 3: Encrypt PII fields before storage
    const encActorEmail = encryptPii(entry.actorEmail);
    const encIpAddress = encryptPii(entry.ipAddress);

    // Step 4: INSERT
    const [result] = await conn.execute(
      `INSERT INTO system_audit_logs
        (eventType, entityType, entityId, organizationId, actorUserId, actorEmail,
         ipAddress, userAgent, metadata, previousHash, recordHash, serverTimestamp, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        entry.eventType,
        entry.entityType ?? null,
        entry.entityId ?? null,
        entry.organizationId ?? null,
        entry.actorUserId ?? null,
        encActorEmail,
        encIpAddress,
        entry.userAgent ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        previousHash ?? null,
        recordHash,
        serverTimestamp,
      ],
    );

    await conn.commit();
    return { id: Number((result as any).insertId), recordHash };
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Non-transactional fallback for environments where the raw pool is
 * unavailable (e.g. unit tests with mocked Drizzle).  This path is
 * NOT safe for concurrent multi-server writes but keeps tests working.
 */
async function appendAuditLogFallback(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  entry: AuditLogEntry,
): Promise<{ id: number; recordHash: string }> {
  const [lastRecord] = await db
    .select({ recordHash: systemAuditLogs.recordHash })
    .from(systemAuditLogs)
    .orderBy(desc(systemAuditLogs.id))
    .limit(1);

  const previousHash = lastRecord?.recordHash ?? null;
  const serverTimestamp = Date.now();
  const recordHash = computeRecordHash(previousHash, entry, serverTimestamp);

  const [result] = await db.insert(systemAuditLogs).values({
    eventType: entry.eventType,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    organizationId: entry.organizationId ?? null,
    actorUserId: entry.actorUserId ?? null,
    actorEmail: encryptPii(entry.actorEmail),
    ipAddress: encryptPii(entry.ipAddress),
    userAgent: entry.userAgent ?? null,
    metadata: entry.metadata ?? null,
    previousHash: previousHash ?? null,
    recordHash,
    serverTimestamp,
  });

  return { id: Number(result.insertId), recordHash };
}

// ==================== Batch INSERT for bulk events ====================

/**
 * Append multiple audit log entries atomically within a single transaction.
 * Each entry's hash chains to the previous one.
 *
 * The entire batch is wrapped in a transaction with FOR UPDATE locking
 * to prevent interleaving from other servers.
 */
export async function appendAuditLogBatch(entries: AuditLogEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const db = await getDb();
  if (!db) throw new Error("Database not available for audit log");

  // Convert callback-style mysql2 Pool to promise Pool (same fix as appendAuditLog)
  const rawPool = (db as any).$client;
  const pool = (rawPool && typeof (rawPool as any).promise === "function")
    ? (rawPool as any).promise()
    : rawPool;
  if (!pool || typeof pool.getConnection !== "function") {
    // Fallback for tests
    return appendAuditLogBatchFallback(db, entries);
  }

  let conn: any;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Lock the latest row
    const [rows] = await conn.execute(
      `SELECT recordHash FROM system_audit_logs ORDER BY id DESC LIMIT 1 FOR UPDATE`
    );
    let previousHash: string | null = (rows as any[])?.[0]?.recordHash ?? null;

    for (const entry of entries) {
      const serverTimestamp = Date.now();
      const recordHash = computeRecordHash(previousHash, entry, serverTimestamp);

      await conn.execute(
        `INSERT INTO system_audit_logs
          (eventType, entityType, entityId, organizationId, actorUserId, actorEmail,
           ipAddress, userAgent, metadata, previousHash, recordHash, serverTimestamp, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          entry.eventType,
          entry.entityType ?? null,
          entry.entityId ?? null,
          entry.organizationId ?? null,
          entry.actorUserId ?? null,
          encryptPii(entry.actorEmail),
          encryptPii(entry.ipAddress),
          entry.userAgent ?? null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          previousHash ?? null,
          recordHash,
          serverTimestamp,
        ],
      );
      previousHash = recordHash;
    }

    await conn.commit();
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Non-transactional fallback for batch insert (tests only).
 */
async function appendAuditLogBatchFallback(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  entries: AuditLogEntry[],
): Promise<void> {
  const [lastRecord] = await db
    .select({ recordHash: systemAuditLogs.recordHash })
    .from(systemAuditLogs)
    .orderBy(desc(systemAuditLogs.id))
    .limit(1);

  let previousHash = lastRecord?.recordHash ?? null;
  const rows = [];

  for (const entry of entries) {
    const serverTimestamp = Date.now();
    const recordHash = computeRecordHash(previousHash, entry, serverTimestamp);
    rows.push({
      eventType: entry.eventType,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      organizationId: entry.organizationId ?? null,
      actorUserId: entry.actorUserId ?? null,
      actorEmail: encryptPii(entry.actorEmail),
      ipAddress: encryptPii(entry.ipAddress),
      userAgent: entry.userAgent ?? null,
      metadata: entry.metadata ?? null,
      previousHash: previousHash ?? null,
      recordHash,
      serverTimestamp,
    });
    previousHash = recordHash;
  }

  await db.insert(systemAuditLogs).values(rows);
}

// ==================== Query functions (READ ONLY) ====================

/**
 * Get audit logs for a specific entity within an organization.
 * organizationId is required for data isolation between organizations.
 */
export async function getAuditLogsByEntity(
  entityType: EntityType,
  entityId: number,
  organizationId: number,
  limit = 100,
) {
  const db = await getDb();
  if (!db) return [];
  const logs = await db
    .select()
    .from(systemAuditLogs)
    .where(
      and(
        eq(systemAuditLogs.entityType, entityType),
        eq(systemAuditLogs.entityId, entityId),
        eq(systemAuditLogs.organizationId, organizationId),
      ),
    )
    .orderBy(desc(systemAuditLogs.id))
    .limit(limit);
  return logs.map(log => decryptPiiFields(log));
}

/**
 * Get audit logs for an organization.
 */
export async function getAuditLogsByOrg(orgId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const logs = await db
    .select()
    .from(systemAuditLogs)
    .where(eq(systemAuditLogs.organizationId, orgId))
    .orderBy(desc(systemAuditLogs.id))
    .limit(limit);
  return logs.map(log => decryptPiiFields(log));
}

/**
 * Get audit logs within a time range.
 */
export async function getAuditLogsByTimeRange(
  startMs: number,
  endMs: number,
  limit = 1000,
) {
  const db = await getDb();
  if (!db) return [];
  const logs = await db
    .select()
    .from(systemAuditLogs)
    .where(
      and(
        gte(systemAuditLogs.serverTimestamp, startMs),
        lte(systemAuditLogs.serverTimestamp, endMs),
      ),
    )
    .orderBy(asc(systemAuditLogs.id))
    .limit(limit);
  return logs.map(log => decryptPiiFields(log));
}

/**
 * Get total count of audit log entries.
 */
export async function getAuditLogCount(organizationId?: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  // SECURITY: organizationId is REQUIRED for data isolation
  // If not provided, return 0 to prevent cross-org data leakage
  if (!organizationId) return 0;
  const whereClause = eq(systemAuditLogs.organizationId, organizationId);
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(systemAuditLogs)
    .where(whereClause);
  return result?.count ?? 0;
}

/**
 * Get audit logs with pagination and optional filters.
 * Used by the admin audit log dashboard.
 */
export async function getAuditLogsPaginated(opts: {
  organizationId?: number;
  eventType?: string;
  entityType?: string;
  actorUserId?: number;
  startMs?: number;
  endMs?: number;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const page = opts.page ?? 1;
  const pageSize = Math.min(opts.pageSize ?? 50, 200);
  const offset = (page - 1) * pageSize;

  const conditions = [];
  // SECURITY: organizationId is REQUIRED for data isolation
  // If not provided, return empty results to prevent cross-org data leakage
  if (!opts.organizationId) {
    return { logs: [], total: 0 };
  }
  conditions.push(
    eq(systemAuditLogs.organizationId, opts.organizationId)
  );
  if (opts.eventType) conditions.push(eq(systemAuditLogs.eventType, opts.eventType));
  if (opts.entityType) conditions.push(eq(systemAuditLogs.entityType, opts.entityType));
  if (opts.actorUserId) conditions.push(eq(systemAuditLogs.actorUserId, opts.actorUserId));
  if (opts.startMs) conditions.push(gte(systemAuditLogs.serverTimestamp, opts.startMs));
  if (opts.endMs) conditions.push(lte(systemAuditLogs.serverTimestamp, opts.endMs));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(systemAuditLogs)
    .where(whereClause);

  const logs = await db
    .select()
    .from(systemAuditLogs)
    .where(whereClause)
    .orderBy(desc(systemAuditLogs.id))
    .limit(pageSize)
    .offset(offset);

  return { logs: logs.map(log => decryptPiiFields(log)), total: countResult?.count ?? 0 };
}

// ==================== Hash Chain Integrity Verification ====================

export interface IntegrityReport {
  totalRecords: number;
  verifiedRecords: number;
  unverifiableRecords: number; // Records where PII decryption failed (hash cannot be recomputed)
  brokenAt: number | null; // ID of first broken record, or null if chain is intact
  isIntact: boolean;
}

/**
 * Verify the integrity of the hash chain.
 * Scans all records in order and recomputes each hash to detect tampering.
 * 
 * This is an expensive operation — run periodically (e.g., daily cron job),
 * not on every request.
 */
export async function verifyHashChainIntegrity(
  organizationId?: number,
  batchSize = 500,
): Promise<IntegrityReport> {
  let offset = 0;
  let totalRecords = 0;
  let verifiedRecords = 0;
  let unverifiableRecords = 0;
  let previousHash: string | null = null;
  let brokenAt: number | null = null;

  while (true) {
    const db = await getDb();
    if (!db) return { totalRecords: 0, verifiedRecords: 0, unverifiableRecords: 0, brokenAt: null, isIntact: true };

    // Build query with optional organization filter
    const conditions = organizationId
      ? [eq(systemAuditLogs.organizationId, organizationId)]
      : [];

    const batch = await db
      .select()
      .from(systemAuditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(systemAuditLogs.id))
      .limit(batchSize)
      .offset(offset);

    if (batch.length === 0) break;

    for (const record of batch) {
      totalRecords++;

      // Decrypt ipAddress for hash verification (hash was computed on plaintext)
      const rawIpAddress = decryptPii(record.ipAddress) ?? undefined;

      // If PII decryption failed (lost key), hash cannot be recomputed accurately.
      // The decrypted value "[encrypted]" differs from the original plaintext,
      // so hash comparison would produce a false positive tamper detection.
      // Skip hash verification for such records but continue chain linkage.
      const piiDecryptionFailed = rawIpAddress === "[encrypted]";

      if (organizationId) {
        // Organization-scoped verification: verify individual record hash integrity only.
        // Chain verification (previousHash linkage) is skipped because the chain spans
        // all organizations and filtering breaks the sequential linkage.
        if (piiDecryptionFailed) {
          unverifiableRecords++;
        } else {
          const expectedHash = computeRecordHash(
            record.previousHash,
            {
              eventType: record.eventType as AuditEventType,
              entityType: (record.entityType as EntityType) ?? undefined,
              entityId: record.entityId ?? undefined,
              actorUserId: record.actorUserId ?? undefined,
              ipAddress: rawIpAddress,
              metadata: (record.metadata as Record<string, unknown>) ?? undefined,
            },
            record.serverTimestamp,
          );

          if (record.recordHash !== expectedHash) {
            brokenAt = Number(record.id);
            return { totalRecords, verifiedRecords, unverifiableRecords, brokenAt, isIntact: false };
          }

          verifiedRecords++;
        }
      } else {
        // Global verification: full chain linkage + hash integrity
        if (record.previousHash !== previousHash) {
          brokenAt = Number(record.id);
          return { totalRecords, verifiedRecords, unverifiableRecords, brokenAt, isIntact: false };
        }

        if (piiDecryptionFailed) {
          // Chain linkage is valid but hash cannot be verified — skip hash check,
          // trust the stored recordHash to continue the chain.
          unverifiableRecords++;
        } else {
          const expectedHash = computeRecordHash(
            previousHash,
            {
              eventType: record.eventType as AuditEventType,
              entityType: (record.entityType as EntityType) ?? undefined,
              entityId: record.entityId ?? undefined,
              actorUserId: record.actorUserId ?? undefined,
              ipAddress: rawIpAddress,
              metadata: (record.metadata as Record<string, unknown>) ?? undefined,
            },
            record.serverTimestamp,
          );

          if (record.recordHash !== expectedHash) {
            brokenAt = Number(record.id);
            return { totalRecords, verifiedRecords, unverifiableRecords, brokenAt, isIntact: false };
          }

          verifiedRecords++;
        }

        previousHash = record.recordHash;
      }
    }

    offset += batchSize;
  }

  return { totalRecords, verifiedRecords, unverifiableRecords, brokenAt: null, isIntact: true };
}

// ==================== WORM Guard ====================

/**
 * WORM Guard: Explicitly prevent any UPDATE or DELETE on system_audit_logs.
 * This function is exported for testing purposes — it should NEVER be called
 * in production code. It exists to document the design intent.
 * 
 * The actual enforcement is:
 * 1. No UPDATE/DELETE functions are exported from this module
 * 2. No tRPC procedures expose mutation operations on audit logs
 * 3. Hash chain verification detects any out-of-band tampering
 */
export const WORM_POLICY = Object.freeze({
  table: "system_audit_logs",
  allowedOperations: ["INSERT", "SELECT"] as const,
  prohibitedOperations: ["UPDATE", "DELETE", "TRUNCATE", "DROP"] as const,
  enforcement: "application-layer + hash-chain-verification + row-locking",
});
