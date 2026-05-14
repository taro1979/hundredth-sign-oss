import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash, randomBytes } from "crypto";

// Mock ENV before importing the module
const mockEnv = {
  storageEncryptionKey: "",
  cookieSecret: "test-secret-key-minimum-32-chars!!",
};

vi.mock("./_core/env", () => ({
  ENV: new Proxy({} as any, {
    get(_target, prop) {
      return (mockEnv as any)[prop] ?? "";
    },
  }),
}));

import {
  isEncryptionEnabled,
  encryptPdf,
  decryptPdf,
  generateProxyToken,
  verifyProxyToken,
} from "./storageEncryption";

describe("storageEncryption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: encryption disabled
    mockEnv.storageEncryptionKey = "";
  });

  describe("isEncryptionEnabled", () => {
    it("returns false when key is empty", () => {
      mockEnv.storageEncryptionKey = "";
      expect(isEncryptionEnabled()).toBe(false);
    });

    it("returns false when key is too short", () => {
      mockEnv.storageEncryptionKey = "abcdef1234";
      expect(isEncryptionEnabled()).toBe(false);
    });

    it("returns false when key is too long", () => {
      mockEnv.storageEncryptionKey = "a".repeat(65);
      expect(isEncryptionEnabled()).toBe(false);
    });

    it("returns true when key is exactly 64 hex chars", () => {
      mockEnv.storageEncryptionKey = randomBytes(32).toString("hex");
      expect(isEncryptionEnabled()).toBe(true);
    });
  });

  describe("encryptPdf / decryptPdf round-trip", () => {
    const validKey = randomBytes(32).toString("hex");

    beforeEach(() => {
      mockEnv.storageEncryptionKey = validKey;
    });

    it("round-trips correctly for a small buffer", () => {
      const plaintext = Buffer.from("Hello, this is a test PDF content");
      const { encrypted, iv, tag } = encryptPdf(plaintext);

      // Encrypted should differ from plaintext
      expect(encrypted.equals(plaintext)).toBe(false);
      expect(iv).toBeTruthy();
      expect(tag).toBeTruthy();

      const decrypted = decryptPdf(encrypted, iv, tag);
      expect(decrypted.equals(plaintext)).toBe(true);
    });

    it("round-trips correctly for a larger buffer", () => {
      const plaintext = randomBytes(1024 * 100); // 100 KB
      const { encrypted, iv, tag } = encryptPdf(plaintext);
      const decrypted = decryptPdf(encrypted, iv, tag);
      expect(decrypted.equals(plaintext)).toBe(true);
    });

    it("produces different IVs for each encryption", () => {
      const plaintext = Buffer.from("same content");
      const enc1 = encryptPdf(plaintext);
      const enc2 = encryptPdf(plaintext);
      expect(enc1.iv).not.toBe(enc2.iv);
    });

    it("fails decryption with wrong tag (tamper detection)", () => {
      const plaintext = Buffer.from("test content");
      const { encrypted, iv } = encryptPdf(plaintext);
      const fakeTag = Buffer.from(randomBytes(16)).toString("base64");
      expect(() => decryptPdf(encrypted, iv, fakeTag)).toThrow();
    });

    it("fails decryption with wrong IV", () => {
      const plaintext = Buffer.from("test content");
      const { encrypted, tag } = encryptPdf(plaintext);
      const fakeIv = Buffer.from(randomBytes(12)).toString("base64");
      expect(() => decryptPdf(encrypted, fakeIv, tag)).toThrow();
    });

    it("throws when key is not configured", () => {
      mockEnv.storageEncryptionKey = "";
      expect(() => encryptPdf(Buffer.from("test"))).toThrow("not configured");
      expect(() => decryptPdf(Buffer.from("test"), "aaa", "bbb")).toThrow("not configured");
    });
  });

  describe("key rotation — STORAGE_ENCRYPTION_KEY_PREV (H-07)", () => {
    const keyA = randomBytes(32).toString("hex");
    const keyB = randomBytes(32).toString("hex");

    it("decrypts when primary key fails but PREV key succeeds", () => {
      // Encrypt with keyA
      mockEnv.storageEncryptionKey = keyA;
      const plaintext = Buffer.from("rotation-test-pdf-content");
      const { encrypted, iv, tag } = encryptPdf(plaintext);

      // Switch to keyB as primary, keyA as prev
      mockEnv.storageEncryptionKey = keyB;
      (mockEnv as any).storageEncryptionKeyPrev = keyA;

      const decrypted = decryptPdf(encrypted, iv, tag);
      expect(decrypted.equals(plaintext)).toBe(true);

      delete (mockEnv as any).storageEncryptionKeyPrev;
    });

    it("throws when both primary and PREV keys fail", () => {
      const keyC = randomBytes(32).toString("hex");

      // Encrypt with keyA
      mockEnv.storageEncryptionKey = keyA;
      const plaintext = Buffer.from("both-keys-fail-content");
      const { encrypted, iv, tag } = encryptPdf(plaintext);

      // Both unrelated keys
      mockEnv.storageEncryptionKey = keyB;
      (mockEnv as any).storageEncryptionKeyPrev = keyC;

      expect(() => decryptPdf(encrypted, iv, tag)).toThrow();

      delete (mockEnv as any).storageEncryptionKeyPrev;
    });

    it("decrypts with primary key when PREV is not set", () => {
      mockEnv.storageEncryptionKey = keyA;
      delete (mockEnv as any).storageEncryptionKeyPrev;

      const plaintext = Buffer.from("no-prev-key-content");
      const { encrypted, iv, tag } = encryptPdf(plaintext);
      const decrypted = decryptPdf(encrypted, iv, tag);
      expect(decrypted.equals(plaintext)).toBe(true);
    });
  });

  describe("proxy token", () => {
    it("generates and verifies a valid token", () => {
      const key = "worm/org-1/doc-42/12345-abc-signed.pdf";
      const token = generateProxyToken(key, 300); // 5 min
      expect(verifyProxyToken(key, token)).toBe(true);
    });

    it("rejects token for different key", () => {
      const token = generateProxyToken("worm/key-a", 300);
      expect(verifyProxyToken("worm/key-b", token)).toBe(false);
    });

    it("rejects expired token", () => {
      // Generate token that already expired (ttl = -1)
      const key = "worm/test.pdf";
      const token = generateProxyToken(key, -1);
      expect(verifyProxyToken(key, token)).toBe(false);
    });

    it("rejects malformed token (no dot)", () => {
      expect(verifyProxyToken("worm/test.pdf", "nodothere")).toBe(false);
    });

    it("rejects token with invalid expiry", () => {
      expect(verifyProxyToken("worm/test.pdf", "notanumber.abc123")).toBe(false);
    });

    it("rejects token with tampered signature", () => {
      const key = "worm/test.pdf";
      const token = generateProxyToken(key, 300);
      const [expiry] = token.split(".");
      const tampered = `${expiry}.${"0".repeat(64)}`;
      expect(verifyProxyToken(key, tampered)).toBe(false);
    });
  });
});
