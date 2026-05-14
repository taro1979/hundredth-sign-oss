/**
 * WORM (Write Once Read Many) Storage Service
 * 
 * 電帳法対応: インフラレベルの証跡不変性担保
 * 
 * - Completed PDFs are stored under a `worm/` prefix
 * - DB UNIQUE constraint on `worm_records.storageKey` physically prevents
 *   overwrite even across multiple servers / Pods (horizontal scaling safe)
 * - Each stored file gets a SHA-256 content hash for integrity verification
 * - Metadata (hash, timestamp, original key) is recorded in the audit log
 *
 * Previous design used an in-memory Set (`wormKeyRegistry`) which could not
 * prevent overwrites across servers.  The new design uses the `worm_records`
 * table with a UNIQUE constraint as the single source of truth.
 */

import { createHash } from "crypto";
import { storagePut, storageGet } from "./storage";
import { appendAuditLog } from "./auditLog";
import { getDb } from "./db";
import { wormRecords } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { isEncryptionEnabled, encryptPdf } from "./storageEncryption";

// ==================== WORM Constants ====================

const WORM_PREFIX = "worm/";

/**
 * Generate a WORM-compliant storage key.
 * Format: worm/{orgId}/{documentId}/{timestamp}-{nonce}.pdf
 * 
 * The key includes:
 * - Organization ID for the internal workspace boundary
 * - Document ID for traceability
 * - Millisecond timestamp for ordering
 * - Random nonce to prevent collision
 */
export function generateWormKey(
  organizationId: number,
  documentId: number,
  suffix = "signed",
): string {
  const timestamp = Date.now();
  const nonce = nanoid(8);
  return `${WORM_PREFIX}org-${organizationId}/doc-${documentId}/${timestamp}-${nonce}-${suffix}.pdf`;
}

// ==================== Core WORM Operations ====================

/**
 * Store a PDF in WORM storage (Write Once).
 * 
 * Race-condition safe design for horizontal scaling:
 *   1. Generate a unique WORM key (timestamp + nonce makes collision near-impossible).
 *   2. INSERT into `worm_records` with the key.  The UNIQUE constraint on
 *      `storageKey` will throw a duplicate-key error if another server
 *      somehow produced the same key — this is the physical overwrite guard.
 *   3. Upload the file to S3.
 *   4. Record the event in the immutable audit log.
 *
 * If the DB INSERT succeeds but S3 upload fails, we have an orphan DB row
 * but NO orphan file — the caller can retry with a new key.
 *
 * @returns The storage key, URL, and content hash
 */
export async function wormStorePdf(
  pdfBuffer: Buffer,
  documentId: number,
  organizationId: number,
  actorUserId?: number,
  metadata?: Record<string, unknown>,
): Promise<{
  key: string;
  url: string;
  contentHash: string;
  storedAt: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available for WORM storage");

  // Generate WORM key
  const key = generateWormKey(organizationId, documentId);

  // Compute content hash from plaintext (document integrity, not ciphertext)
  const contentHash = createHash("sha256").update(pdfBuffer).digest("hex");
  const storedAt = Date.now();

  // Encrypt if STORAGE_ENCRYPTION_KEY is configured; otherwise store plaintext
  let uploadBuffer: Buffer | Uint8Array = pdfBuffer;
  let encIv: string | null = null;
  let encTag: string | null = null;
  let encKeyVersion: string | null = null;

  if (isEncryptionEnabled()) {
    const enc = encryptPdf(pdfBuffer);
    uploadBuffer = enc.encrypted;
    encIv = enc.iv;
    encTag = enc.tag;
    encKeyVersion = "v1";
  }

  // Step 1: Register in DB FIRST (UNIQUE constraint = physical overwrite guard).
  // If another server already stored a record with the same key, this INSERT
  // will throw a duplicate-key error and the upload is aborted.
  try {
    await db.insert(wormRecords).values({
      storageKey: key,
      contentHash,
      fileSizeBytes: pdfBuffer.length, // original plaintext size
      documentId,
      organizationId,
      actorUserId: actorUserId ?? null,
      url: "", // placeholder — updated after S3 upload
      encryptionIv: encIv,
      encryptionTag: encTag,
      keyVersion: encKeyVersion,
    });
  } catch (err: any) {
    // MySQL duplicate-key error code: ER_DUP_ENTRY (1062)
    if (err?.errno === 1062 || err?.code === "ER_DUP_ENTRY") {
      throw new Error(`WORM violation: key "${key}" already exists. Overwrite is prohibited.`);
    }
    throw err;
  }

  // Step 2: Upload to S3 (encrypted or plaintext depending on key config)
  let url: string;
  try {
    const result = await storagePut(key, uploadBuffer, "application/pdf");
    url = result.url;
  } catch (uploadErr) {
    // S3 upload failed — the DB row is an orphan but the file was NOT stored,
    // so WORM semantics are preserved (no data was overwritten).
    // We leave the DB row so the key cannot be reused.
    throw uploadErr;
  }

  // Step 3: Update the DB row with the actual S3 URL
  await db
    .update(wormRecords)
    .set({ url })
    .where(eq(wormRecords.storageKey, key));

  // Step 4: Record in immutable audit log
  await appendAuditLog({
    eventType: "pdf.stored_worm",
    entityType: "document",
    entityId: documentId,
    organizationId,
    actorUserId,
    metadata: {
      ...metadata,
      wormKey: key,
      contentHash,
      fileSizeBytes: pdfBuffer.length,
      storedAt,
    },
  });

  return { key, url, contentHash, storedAt };
}

/**
 * Retrieve a WORM-stored PDF URL (Read Only).
 * Does not allow modification of the stored file.
 */
export async function wormGetPdf(key: string): Promise<{ key: string; url: string }> {
  if (!key.startsWith(WORM_PREFIX)) {
    throw new Error(`Invalid WORM key: "${key}" does not start with "${WORM_PREFIX}"`);
  }
  return storageGet(key);
}

/**
 * Check if a WORM key already exists in the database.
 * Useful for pre-flight checks before attempting a store.
 */
export async function wormKeyExists(key: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [record] = await db
    .select({ id: wormRecords.id })
    .from(wormRecords)
    .where(eq(wormRecords.storageKey, key))
    .limit(1);
  return !!record;
}

/**
 * WORM Delete Guard: Explicitly prevent deletion of WORM-stored files.
 * This function always throws — it exists to document the design intent
 * and to be called if any code path attempts deletion.
 */
export function wormDelete(_key: string): never {
  throw new Error(
    "WORM violation: DELETE operation is prohibited on WORM storage. " +
    "Files stored under the 'worm/' prefix are immutable and cannot be deleted."
  );
}

/**
 * WORM Overwrite Guard: Explicitly prevent overwriting WORM-stored files.
 * This function always throws — it exists to document the design intent.
 */
export function wormOverwrite(_key: string, _data: Buffer): never {
  throw new Error(
    "WORM violation: OVERWRITE operation is prohibited on WORM storage. " +
    "Files stored under the 'worm/' prefix are immutable and cannot be modified."
  );
}

// ==================== Integrity Verification ====================

/**
 * Verify the integrity of a WORM-stored PDF by comparing its content hash
 * against the hash recorded in the database.
 * 
 * @param key - The WORM storage key
 * @param expectedHash - The SHA-256 hash recorded at storage time (optional — if omitted, looked up from DB)
 * @returns Whether the file is intact
 */
export async function verifyWormIntegrity(
  key: string,
  expectedHash?: string,
): Promise<{ isIntact: boolean; currentHash: string | null; error?: string }> {
  try {
    // If no expected hash provided, look it up from the DB
    if (!expectedHash) {
      const db = await getDb();
      if (!db) return { isIntact: false, currentHash: null, error: "Database not available" };
      const [record] = await db
        .select({ contentHash: wormRecords.contentHash })
        .from(wormRecords)
        .where(eq(wormRecords.storageKey, key))
        .limit(1);
      if (!record) {
        return { isIntact: false, currentHash: null, error: `No WORM record found for key: ${key}` };
      }
      expectedHash = record.contentHash;
    }

    const { url } = await wormGetPdf(key);
    
    // Fetch the file content
    const response = await fetch(url);
    if (!response.ok) {
      return { isIntact: false, currentHash: null, error: `Failed to fetch: ${response.status}` };
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const currentHash = createHash("sha256").update(buffer).digest("hex");
    
    return {
      isIntact: currentHash === expectedHash,
      currentHash,
      error: currentHash !== expectedHash ? "Hash mismatch — file may have been tampered with" : undefined,
    };
  } catch (e: any) {
    return { isIntact: false, currentHash: null, error: e.message };
  }
}

// ==================== WORM Policy ====================

export const WORM_STORAGE_POLICY = Object.freeze({
  prefix: WORM_PREFIX,
  allowedOperations: ["PUT (once)", "GET"] as const,
  prohibitedOperations: ["PUT (overwrite)", "DELETE", "MOVE", "RENAME"] as const,
  enforcement: "DB UNIQUE constraint + application-layer guard + content-hash audit trail",
  hashAlgorithm: "SHA-256",
  auditEventType: "pdf.stored_worm",
});
