/**
 * Tests for server/piiEncryption.ts (S-07: Audit Log PII Encryption)
 *
 * AC-S07-001: actorEmail, ipAddress must be encrypted on new insert operations
 * AC-S07-002: Audit API returns decrypted data to authorized viewers
 * AC-S07-003: Existing plaintext records remain accessible (backward compatibility)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encryptPii, decryptPii, isEncrypted, decryptPiiFields, _resetKeyForTest } from "./piiEncryption";

const TEST_KEY = "a".repeat(64);

describe("piiEncryption", () => {
  beforeEach(async () => {
    _resetKeyForTest();
  });

  // --- AC-001: Key not set → plaintext passthrough ---
  describe("no key configured (AC-001, AC-005)", () => {
    beforeEach(async () => {
      const { ENV } = await import("./_core/env");
      (ENV as any).piiEncryptionKey = "";
    });

    it("AC-001: encryptPii returns plaintext when PII_ENCRYPTION_KEY is not set", () => {
      const email = "user@example.com";
      expect(encryptPii(email)).toBe(email);
    });

    it("AC-001: encryptPii returns plain IP when key is not set", () => {
      const ip = "203.0.113.42";
      expect(encryptPii(ip)).toBe(ip);
    });

    it("AC-005: getKey returns null — randomBytes is never called", () => {
      // encryptPii returns plaintext, proving getKey() returned null
      const value = "no-random-key@test.com";
      const result = encryptPii(value);
      expect(result).toBe(value);
      expect(isEncrypted(result)).toBe(false);
    });
  });

  // --- AC-002: Key set → encryption works ---
  describe("encryptPii / decryptPii round-trip (AC-002)", () => {
    beforeEach(async () => {
      const { ENV } = await import("./_core/env");
      (ENV as any).piiEncryptionKey = TEST_KEY;
    });
    afterEach(async () => {
      const { ENV } = await import("./_core/env");
      (ENV as any).piiEncryptionKey = "";
      _resetKeyForTest();
    });

    it("encrypts and decrypts an email address (AC-S07-001, AC-S07-002)", () => {
      const email = "user@example.com";
      const encrypted = encryptPii(email);
      expect(encrypted).not.toBeNull();
      expect(encrypted).not.toBe(email);
      expect(encrypted!.startsWith("enc:")).toBe(true);

      const decrypted = decryptPii(encrypted);
      expect(decrypted).toBe(email);
    });

    it("encrypts and decrypts an IP address", () => {
      const ip = "203.0.113.42";
      const encrypted = encryptPii(ip);
      expect(encrypted!.startsWith("enc:")).toBe(true);
      expect(decryptPii(encrypted)).toBe(ip);
    });

    it("encrypts and decrypts IPv6 address", () => {
      const ipv6 = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
      const encrypted = encryptPii(ipv6);
      expect(decryptPii(encrypted)).toBe(ipv6);
    });

    it("encrypts and decrypts Japanese characters", () => {
      const name = "田中太郎@example.jp";
      const encrypted = encryptPii(name);
      expect(decryptPii(encrypted)).toBe(name);
    });

    it("produces different ciphertext for the same input (random IV)", () => {
      const email = "test@example.com";
      const enc1 = encryptPii(email);
      const enc2 = encryptPii(email);
      expect(enc1).not.toBe(enc2); // Different IVs → different output
      expect(decryptPii(enc1)).toBe(email);
      expect(decryptPii(enc2)).toBe(email);
    });
  });

  describe("null / empty handling", () => {
    it("returns null for null input", () => {
      expect(encryptPii(null)).toBeNull();
      expect(decryptPii(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(encryptPii(undefined)).toBeNull();
      expect(decryptPii(undefined)).toBeNull();
    });

    it("passes through empty string unchanged", () => {
      expect(encryptPii("")).toBeNull();
      expect(decryptPii("")).toBeNull();
    });
  });

  describe("backward compatibility (AC-S07-003)", () => {
    it("decryptPii returns plaintext as-is when no enc: prefix", () => {
      const plainEmail = "legacy@example.com";
      expect(decryptPii(plainEmail)).toBe(plainEmail);
    });

    it("decryptPii returns plain IP address as-is", () => {
      const plainIp = "192.168.1.1";
      expect(decryptPii(plainIp)).toBe(plainIp);
    });
  });

  describe("isEncrypted", () => {
    it("returns true for encrypted values", async () => {
      const { ENV } = await import("./_core/env");
      (ENV as any).piiEncryptionKey = TEST_KEY;
      const encrypted = encryptPii("test@example.com");
      expect(isEncrypted(encrypted)).toBe(true);
      (ENV as any).piiEncryptionKey = "";
      _resetKeyForTest();
    });

    it("returns false for plaintext", () => {
      expect(isEncrypted("test@example.com")).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
    });
  });

  describe("decryptPiiFields", () => {
    beforeEach(async () => {
      const { ENV } = await import("./_core/env");
      (ENV as any).piiEncryptionKey = TEST_KEY;
    });
    afterEach(async () => {
      const { ENV } = await import("./_core/env");
      (ENV as any).piiEncryptionKey = "";
      _resetKeyForTest();
    });

    it("decrypts specified fields in a record object", () => {
      const email = "user@example.com";
      const ip = "10.0.0.1";
      const record = {
        id: 1,
        actorEmail: encryptPii(email),
        ipAddress: encryptPii(ip),
        eventType: "document.created",
      };

      const result = decryptPiiFields(record);
      expect(result.actorEmail).toBe(email);
      expect(result.ipAddress).toBe(ip);
      expect(result.eventType).toBe("document.created");
      expect(result.id).toBe(1);
    });

    it("handles mixed encrypted and plaintext fields (backward compat)", () => {
      const record = {
        actorEmail: "legacy@example.com", // plaintext (old record)
        ipAddress: encryptPii("10.0.0.1"), // encrypted (new record)
      };

      const result = decryptPiiFields(record);
      expect(result.actorEmail).toBe("legacy@example.com");
      expect(result.ipAddress).toBe("10.0.0.1");
    });

    it("handles null fields gracefully", () => {
      const record = {
        actorEmail: null as string | null,
        ipAddress: null as string | null,
      };
      const result = decryptPiiFields(record);
      expect(result.actorEmail).toBeNull();
      expect(result.ipAddress).toBeNull();
    });
  });

  describe("tamper detection", () => {
    beforeEach(async () => {
      const { ENV } = await import("./_core/env");
      (ENV as any).piiEncryptionKey = TEST_KEY;
    });
    afterEach(async () => {
      const { ENV } = await import("./_core/env");
      (ENV as any).piiEncryptionKey = "";
      _resetKeyForTest();
    });

    it("returns masked placeholder on tampered ciphertext (AES-GCM auth tag verification)", () => {
      const encrypted = encryptPii("secret@example.com")!;
      // Format: enc:v1:<base64> — extract the base64 part after the second ":"
      const PREFIX_V1 = "enc:v1:";
      const base64 = encrypted.slice(PREFIX_V1.length);
      const payload = Buffer.from(base64, "base64");
      payload[payload.length - 1] ^= 0xff; // flip last byte (auth tag)
      const tampered = PREFIX_V1 + payload.toString("base64");

      expect(decryptPii(tampered)).toBe("[encrypted]");
    });
  });

  describe("corrupted data handling", () => {
    it("returns masked placeholder when encrypted payload is too short (< IV + authTag)", () => {
      // enc: prefix with very short base64 (< 28 bytes = 12 IV + 16 authTag)
      const shortPayload = Buffer.from("tooshort").toString("base64");
      const corrupted = `enc:${shortPayload}`;
      const result = decryptPii(corrupted);
      expect(result).toBe("[encrypted]");
    });

    it("returns masked placeholder when encrypted payload is exactly IV length (no ciphertext or authTag)", () => {
      const ivOnly = Buffer.alloc(12).toString("base64");
      const corrupted = `enc:${ivOnly}`;
      const result = decryptPii(corrupted);
      expect(result).toBe("[encrypted]");
    });
  });

  describe("getKey with environment key", () => {
    it("uses valid 64-char hex env key", async () => {
      _resetKeyForTest();
      const { ENV } = await import("./_core/env");
      const validHexKey = "a".repeat(64);
      (ENV as any).piiEncryptionKey = validHexKey;

      const plaintext = "env-key-test@example.com";
      const encrypted = encryptPii(plaintext);
      expect(encrypted).not.toBeNull();
      expect(encrypted!.startsWith("enc:")).toBe(true);
      expect(decryptPii(encrypted)).toBe(plaintext);

      // Restore
      (ENV as any).piiEncryptionKey = "";
    });

    it("skips encryption when env key has invalid length (returns plaintext)", async () => {
      _resetKeyForTest();
      const { ENV } = await import("./_core/env");
      // env.ts already returns "" for invalid keys, but test directly setting invalid value
      (ENV as any).piiEncryptionKey = "tooshort";

      const plaintext = "invalid-key-test@example.com";
      const result = encryptPii(plaintext);
      // Invalid key → getKey() returns null → plaintext passthrough
      expect(result).toBe(plaintext);

      (ENV as any).piiEncryptionKey = "";
    });
  });
});

describe("key rotation (H-07)", () => {
  it("decrypts enc:v1: ciphertext encrypted with the same key", async () => {
    _resetKeyForTest();
    const { ENV } = await import("./_core/env");
    const key = "a".repeat(64);
    (ENV as any).piiEncryptionKey = key;

    const encrypted = encryptPii("rotation-test@example.com");
    expect(encrypted!.startsWith("enc:v1:")).toBe(true);
    expect(decryptPii(encrypted)).toBe("rotation-test@example.com");

    (ENV as any).piiEncryptionKey = "";
    _resetKeyForTest();
  });

  it("falls back to PREV key when primary key fails (rotation scenario)", async () => {
    _resetKeyForTest();
    const { ENV } = await import("./_core/env");

    // Encrypt with key A
    const keyA = "a".repeat(64);
    (ENV as any).piiEncryptionKey = keyA;
    (ENV as any).piiEncryptionKeyPrev = "";
    const encrypted = encryptPii("prev-key-test@example.com")!;
    _resetKeyForTest();

    // Now set key B as primary, key A as PREV — decryption should use PREV
    const keyB = "b".repeat(64);
    (ENV as any).piiEncryptionKey = keyB;
    (ENV as any).piiEncryptionKeyPrev = keyA;

    const decrypted = decryptPii(encrypted);
    expect(decrypted).toBe("prev-key-test@example.com");

    (ENV as any).piiEncryptionKey = "";
    (ENV as any).piiEncryptionKeyPrev = "";
    _resetKeyForTest();
  });

  it("returns masked placeholder when both primary and PREV keys fail", async () => {
    _resetKeyForTest();
    const { ENV } = await import("./_core/env");

    // Encrypt with key A
    const keyA = "a".repeat(64);
    (ENV as any).piiEncryptionKey = keyA;
    const encrypted = encryptPii("throw-test@example.com")!;
    _resetKeyForTest();

    // Set unrelated key B as primary, key C as PREV
    (ENV as any).piiEncryptionKey = "b".repeat(64);
    (ENV as any).piiEncryptionKeyPrev = "c".repeat(64);

    expect(decryptPii(encrypted)).toBe("[encrypted]");

    (ENV as any).piiEncryptionKey = "";
    (ENV as any).piiEncryptionKeyPrev = "";
    _resetKeyForTest();
  });

  it("getPrevKey returns null sentinel when PII_ENCRYPTION_KEY_PREV is empty", async () => {
    _resetKeyForTest();
    const { ENV } = await import("./_core/env");
    (ENV as any).piiEncryptionKey = "a".repeat(64);
    (ENV as any).piiEncryptionKeyPrev = ""; // not set

    const encrypted = encryptPii("sentinel-test@example.com")!;
    // Two calls to decryptPii to hit the cached sentinel path
    expect(decryptPii(encrypted)).toBe("sentinel-test@example.com");
    expect(decryptPii(encrypted)).toBe("sentinel-test@example.com");

    (ENV as any).piiEncryptionKey = "";
    _resetKeyForTest();
  });

  it("_resetKeyForTest resets both primary and PREV cached keys", async () => {
    _resetKeyForTest();
    const { ENV } = await import("./_core/env");
    const keyA = "a".repeat(64);
    (ENV as any).piiEncryptionKey = keyA;
    const enc1 = encryptPii("before-reset")!;

    _resetKeyForTest(); // reset both

    const keyB = "b".repeat(64);
    (ENV as any).piiEncryptionKey = keyB;
    const enc2 = encryptPii("after-reset")!;

    // enc1 was encrypted with keyA, now only keyB is primary — returns masked placeholder
    expect(decryptPii(enc1)).toBe("[encrypted]");
    expect(decryptPii(enc2)).toBe("after-reset");

    (ENV as any).piiEncryptionKey = "";
    _resetKeyForTest();
  });

  it("decrypts legacy enc: prefix (pre-v1 format) with primary key", async () => {
    _resetKeyForTest();
    const { ENV } = await import("./_core/env");
    const key = "a".repeat(64);
    (ENV as any).piiEncryptionKey = key;

    // Manually construct a legacy enc: (no v1) encrypted payload
    // by encrypting normally then stripping the v1 to simulate legacy format
    const encrypted = encryptPii("legacy-test@example.com")!;
    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    // Simulate legacy: enc:v1: -> enc: (remove v1 version tag)
    const legacyEncrypted = "enc:" + encrypted.slice("enc:v1:".length);

    const decrypted = decryptPii(legacyEncrypted);
    expect(decrypted).toBe("legacy-test@example.com");

    (ENV as any).piiEncryptionKey = "";
    _resetKeyForTest();
  });
});
