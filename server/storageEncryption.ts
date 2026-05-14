/**
 * AES-256-GCM encryption / decryption for PDF at-rest protection.
 *
 * Behaviour:
 *  - STORAGE_ENCRYPTION_KEY not set → encryption disabled (graceful degradation).
 *  - STORAGE_ENCRYPTION_KEY set (64 hex chars = 32 bytes) → encrypt / decrypt active.
 *
 * Proxy token:
 *  - HMAC-SHA256(storageKey + "|" + expiry, JWT_SECRET) — reuses the application session secret.
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { ENV } from "./_core/env";

// ── constants ──────────────────────────────────────────────
const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 12; // GCM standard
const KEY_HEX_LENGTH = 64; // 32 bytes = 64 hex chars

// ── key helpers ────────────────────────────────────────────

function getEncryptionKey(): Buffer | null {
  const hex = ENV.storageEncryptionKey;
  if (!hex || hex.length !== KEY_HEX_LENGTH) return null;
  return Buffer.from(hex, "hex");
}

/** Returns the previous encryption key for rotation fallback, or null if not configured. */
function getPrevEncryptionKey(): Buffer | null {
  const hex = ENV.storageEncryptionKeyPrev;
  if (!hex || hex.length !== KEY_HEX_LENGTH) return null;
  return Buffer.from(hex, "hex");
}

/** True when a valid 32-byte key is configured. */
export function isEncryptionEnabled(): boolean {
  return getEncryptionKey() !== null;
}

// ── encrypt / decrypt ──────────────────────────────────────

export function encryptPdf(
  plaintext: Buffer,
): { encrypted: Buffer; iv: string; tag: string } {
  const key = getEncryptionKey();
  if (!key) throw new Error("[Encryption] STORAGE_ENCRYPTION_KEY is not configured or invalid");

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Attempt decryption with a specific key. Returns null on auth failure.
 */
function tryDecryptWithKey(ciphertext: Buffer, ivBase64: string, tagBase64: string, key: Buffer): Buffer | null {
  try {
    const iv = Buffer.from(ivBase64, "base64");
    const tag = Buffer.from(tagBase64, "base64");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return null;
  }
}

/**
 * Decrypt a PDF. Tries primary key first; if auth fails, tries PREV key (rotation fallback).
 * Throws if no key is configured or both keys fail.
 */
export function decryptPdf(
  ciphertext: Buffer,
  ivBase64: string,
  tagBase64: string,
): Buffer {
  const key = getEncryptionKey();
  if (!key) throw new Error("[Encryption] STORAGE_ENCRYPTION_KEY is not configured or invalid");

  const result = tryDecryptWithKey(ciphertext, ivBase64, tagBase64, key);
  if (result !== null) return result;

  // Try previous key (rotation fallback)
  const prevKey = getPrevEncryptionKey();
  if (prevKey) {
    const prevResult = tryDecryptWithKey(ciphertext, ivBase64, tagBase64, prevKey);
    if (prevResult !== null) return prevResult;
  }

  throw new Error("[Encryption] Decryption failed — wrong key or corrupted ciphertext");
}

// ── proxy token (HMAC-SHA256) ──────────────────────────────

function getHmacSecret(): string {
  return ENV.cookieSecret;
}

/**
 * Generate a short-lived HMAC token that authorises a PDF proxy download.
 * @param storageKey  The worm_records.storageKey
 * @param ttlSec      Token lifetime in seconds (default 1800 = 30 min)
 */
export function generateProxyToken(storageKey: string, ttlSec = 1800): string {
  const expiry = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${storageKey}|${expiry}`;
  const sig = createHmac("sha256", getHmacSecret()).update(payload).digest("hex");
  // Return "<expiry>.<signature>"
  return `${expiry}.${sig}`;
}

/**
 * Verify that a proxy token is valid and not expired.
 */
export function verifyProxyToken(storageKey: string, token: string): boolean {
  const dotIdx = token.indexOf(".");
  if (dotIdx < 0) return false;

  const expiryStr = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry)) return false;
  if (Math.floor(Date.now() / 1000) > expiry) return false; // expired

  const expected = createHmac("sha256", getHmacSecret())
    .update(`${storageKey}|${expiryStr}`)
    .digest("hex");

  // constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
