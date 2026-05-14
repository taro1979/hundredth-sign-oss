/**
 * PII Field Encryption (AES-256-GCM)
 *
 * Encrypts personally identifiable information (actorEmail, ipAddress) before
 * storing in audit / activity logs. Decrypts on read for authorized viewers.
 *
 * Design constraints:
 * - WORM tables cannot be updated → encrypt at INSERT time only
 * - Existing plaintext records must remain readable (backward compat)
 * - Hash chain in systemAuditLogs uses raw ipAddress → encrypt AFTER hash computation
 * - Encrypted values carry a versioned prefix for key rotation support
 *
 * Format: "enc:v1:<base64(iv:ciphertext:authTag)>"
 *   - iv: 12 bytes
 *   - authTag: 16 bytes
 *   - ciphertext: variable length
 *
 * Key rotation:
 *   1. Set PII_ENCRYPTION_KEY_PREV = current PII_ENCRYPTION_KEY
 *   2. Set PII_ENCRYPTION_KEY = new key
 *   3. Deploy — new records use new key, old records fall back to PREV
 *   4. After WORM retention period, remove PII_ENCRYPTION_KEY_PREV
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { ENV } from "./_core/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
/** Legacy prefix (pre-rotation) — still supported on decrypt */
const PREFIX_LEGACY = "enc:";
/** Current versioned prefix */
const PREFIX_V1 = "enc:v1:";

let cachedKey: Buffer | null = null;
/** undefined = not yet checked, null = checked but not set, Buffer = valid key */
let cachedKeyPrev: Buffer | null | undefined = undefined;

let keyChecked = false;

/**
 * Derive or retrieve the 32-byte primary encryption key.
 * - If PII_ENCRYPTION_KEY is set (64-char hex string), use it.
 * - Otherwise, return null (encryption will be skipped).
 *
 * Previous behavior auto-generated a random key with randomBytes(32),
 * but that key was lost on every restart, making encrypted PII
 * permanently unrecoverable. Now we skip encryption entirely when no
 * persistent key is configured.
 */
function getKey(): Buffer | null {
  if (cachedKey) return cachedKey;
  if (keyChecked) return null;

  const envKey = ENV.piiEncryptionKey;
  if (envKey && envKey.length === 64) {
    cachedKey = Buffer.from(envKey, "hex");
    keyChecked = true;
    return cachedKey;
  }

  // No valid key — mark as checked, return null (skip encryption)
  keyChecked = true;
  return null;
}

/**
 * Retrieve the previous (rotation) key if configured.
 */
function getPrevKey(): Buffer | null {
  if (cachedKeyPrev !== undefined) return cachedKeyPrev;

  const envKey = ENV.piiEncryptionKeyPrev;
  if (envKey && envKey.length === 64) {
    cachedKeyPrev = Buffer.from(envKey, "hex");
  } else {
    cachedKeyPrev = null;
  }
  return cachedKeyPrev;
}

/**
 * Attempt to decrypt packed bytes with a given key.
 * Returns null on auth failure (wrong key / corrupted).
 */
function tryDecrypt(packed: Buffer, key: Buffer): string | null {
  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) return null;

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(packed.length - AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH, packed.length - AUTH_TAG_LENGTH);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Encrypt a PII string value. Returns `enc:v1:<base64>` format.
 * Returns the original value unchanged if it's null, undefined, or empty.
 * When no valid PII_ENCRYPTION_KEY is configured, returns the plaintext
 * as-is (no encryption) to avoid data loss on restart.
 */
export function encryptPii(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return null;

  const key = getKey();
  if (!key) return plaintext; // No key configured → store as plaintext

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: iv + ciphertext + authTag
  const packed = Buffer.concat([iv, encrypted, authTag]);
  return PREFIX_V1 + packed.toString("base64");
}

/**
 * Decrypt a PII value. Handles:
 *  - `enc:v1:...` (current format) — try primary key, then PREV key
 *  - `enc:...` (legacy format, no version) — try primary key, then PREV key
 *  - Plaintext (no prefix) — returned as-is (backward compatibility)
 */
export function decryptPii(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return null;

  // Backward compatibility: plaintext records don't have the prefix
  if (!stored.startsWith(PREFIX_LEGACY)) return stored;

  let base64: string;
  if (stored.startsWith(PREFIX_V1)) {
    base64 = stored.slice(PREFIX_V1.length);
  } else {
    // Legacy enc: prefix (no version tag)
    base64 = stored.slice(PREFIX_LEGACY.length);
  }

  const packed = Buffer.from(base64, "base64");

  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    console.warn("[PII] Encrypted value too short, returning masked placeholder");
    return "[encrypted]";
  }

  // Try primary key first
  const primaryKey = getKey();
  if (primaryKey) {
    const result = tryDecrypt(packed, primaryKey);
    if (result !== null) return result;
  }

  // Try previous key (key rotation fallback)
  const prevKey = getPrevKey();
  if (prevKey) {
    const prevResult = tryDecrypt(packed, prevKey);
    if (prevResult !== null) return prevResult;
  }

  // Both keys failed — tampered or wrong key entirely
  // Return masked placeholder instead of throwing to prevent entire query from crashing.
  // WORM records cannot be re-encrypted, so graceful degradation is the only option.
  console.warn("[PII] Decryption failed for a stored value — returning masked placeholder");
  return "[encrypted]";
}

/**
 * Check if a value is already encrypted (has enc: prefix).
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX_LEGACY);
}

/**
 * Decrypt PII fields in an audit/activity log record.
 * Mutates and returns the same object for convenience.
 */
export function decryptPiiFields<T extends Record<string, unknown>>(
  record: T,
  fields: string[] = ["actorEmail", "ipAddress"],
): T {
  for (const field of fields) {
    if (field in record && typeof record[field] === "string") {
      (record as any)[field] = decryptPii(record[field] as string);
    }
  }
  return record;
}

/**
 * Reset the cached keys (for testing only).
 */
export function _resetKeyForTest(): void {
  cachedKey = null;
  keyChecked = false;
  cachedKeyPrev = undefined;
}
