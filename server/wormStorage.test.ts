import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/worm/test.pdf", key: "worm/test.pdf" }),
  storageGet: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/worm/test.pdf", key: "worm/test.pdf" }),
}));

vi.mock("./auditLog", () => ({
  appendAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("abc12345"),
}));

// Default: encryption disabled (STORAGE_ENCRYPTION_KEY not set)
vi.mock("./storageEncryption", () => ({
  isEncryptionEnabled: vi.fn().mockReturnValue(false),
  encryptPdf: vi.fn(),
}));

// Mock DB for wormStorePdf / wormKeyExists / verifyWormIntegrity
const mockInsertValues = vi.fn().mockResolvedValue([{ insertId: 1 }]);
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockUpdateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    select: (...args: any[]) => mockSelect(...args),
  }),
}));

vi.mock("../drizzle/schema", () => ({
  wormRecords: {
    id: "wormRecords.id",
    storageKey: "wormRecords.storageKey",
    contentHash: "wormRecords.contentHash",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ type: "eq", a, b })),
}));

import {
  generateWormKey,
  wormStorePdf,
  wormGetPdf,
  wormDelete,
  wormOverwrite,
  wormKeyExists,
  verifyWormIntegrity,
  WORM_STORAGE_POLICY,
} from "./wormStorage";
import { storagePut, storageGet } from "./storage";
import { appendAuditLog } from "./auditLog";
import { getDb } from "./db";
import { isEncryptionEnabled, encryptPdf } from "./storageEncryption";

describe("WormStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behavior
    mockInsertValues.mockResolvedValue([{ insertId: 1 }]);
    mockSelectFrom.mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  describe("generateWormKey", () => {
    it("should generate key with organization id", () => {
      const key = generateWormKey(1, 100);
      expect(key).toMatch(/^worm\/org-1\/doc-100\/\d+-abc12345-signed\.pdf$/);
    });

    it("should generate key with org id prefix", () => {
      const key = generateWormKey(200, 300);
      expect(key).toMatch(/^worm\/org-200\/doc-300\/\d+-abc12345-signed\.pdf$/);
    });

    it("should use custom suffix", () => {
      const key = generateWormKey(1, 100, "completed");
      expect(key).toContain("-completed.pdf");
    });

    it("should use default suffix 'signed'", () => {
      const key = generateWormKey(1, 100);
      expect(key).toContain("-signed.pdf");
    });
  });

  describe("wormStorePdf", () => {
    it("should store PDF and return key, url, contentHash, storedAt", async () => {
      const pdfBuffer = Buffer.from("fake-pdf-content");
      const result = await wormStorePdf(pdfBuffer, 1, 1, 10, { test: true });

      expect(result.key).toMatch(/^worm\//);
      expect(result.url).toBe("https://cdn.example.com/worm/test.pdf");
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.storedAt).toBeGreaterThan(0);
    });

    it("should call storagePut with correct arguments", async () => {
      const pdfBuffer = Buffer.from("test-pdf");
      await wormStorePdf(pdfBuffer, 2, 1);

      expect(storagePut).toHaveBeenCalledWith(
        expect.stringMatching(/^worm\//),
        pdfBuffer,
        "application/pdf",
      );
    });

    it("should call appendAuditLog with correct metadata", async () => {
      const pdfBuffer = Buffer.from("test-pdf");
      await wormStorePdf(pdfBuffer, 3, 2, 15, { extra: "data" });

      expect(appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        eventType: "pdf.stored_worm",
        entityType: "document",
        entityId: 3,
        organizationId: 2,
        actorUserId: 15,
        metadata: expect.objectContaining({
          extra: "data",
          contentHash: expect.any(String),
          fileSizeBytes: pdfBuffer.length,
          storedAt: expect.any(Number),
        }),
      }));
    });

    it("should pass organizationId to audit log", async () => {
      const pdfBuffer = Buffer.from("test-pdf");
      await wormStorePdf(pdfBuffer, 4, 99);

      expect(appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: 99,
      }));
    });

    it("should handle undefined actorUserId", async () => {
      const pdfBuffer = Buffer.from("test-pdf");
      await wormStorePdf(pdfBuffer, 5, 1);

      expect(appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        actorUserId: undefined,
      }));
    });

    it("should throw on DB null", async () => {
      vi.mocked(getDb).mockResolvedValueOnce(null as any);
      const pdfBuffer = Buffer.from("test-pdf");
      await expect(wormStorePdf(pdfBuffer, 1, 1)).rejects.toThrow("Database not available");
    });

    it("should throw WORM violation on duplicate key error (errno 1062)", async () => {
      mockInsertValues.mockRejectedValueOnce({ errno: 1062, code: "ER_DUP_ENTRY" });
      const pdfBuffer = Buffer.from("test-pdf");
      await expect(wormStorePdf(pdfBuffer, 1, 1)).rejects.toThrow("WORM violation");
    });

    it("should throw WORM violation on duplicate key error (code ER_DUP_ENTRY)", async () => {
      mockInsertValues.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });
      const pdfBuffer = Buffer.from("test-pdf");
      await expect(wormStorePdf(pdfBuffer, 1, 1)).rejects.toThrow("WORM violation");
    });

    it("should re-throw non-duplicate DB errors", async () => {
      mockInsertValues.mockRejectedValueOnce(new Error("Connection lost"));
      const pdfBuffer = Buffer.from("test-pdf");
      await expect(wormStorePdf(pdfBuffer, 1, 1)).rejects.toThrow("Connection lost");
    });

    it("should re-throw S3 upload errors", async () => {
      vi.mocked(storagePut).mockRejectedValueOnce(new Error("S3 error"));
      const pdfBuffer = Buffer.from("test-pdf");
      await expect(wormStorePdf(pdfBuffer, 1, 1)).rejects.toThrow("S3 error");
    });

    it("should update DB row with S3 URL after upload", async () => {
      const pdfBuffer = Buffer.from("test-pdf");
      await wormStorePdf(pdfBuffer, 1, 1);

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith({ url: "https://cdn.example.com/worm/test.pdf" });
    });

    it("should encrypt PDF when encryption is enabled", async () => {
      const pdfBuffer = Buffer.from("plaintext-pdf");
      const fakeEncrypted = Buffer.from("encrypted-data");
      vi.mocked(isEncryptionEnabled).mockReturnValue(true);
      vi.mocked(encryptPdf).mockReturnValue({
        encrypted: fakeEncrypted,
        iv: "dGVzdC1pdi1iYXNl",
        tag: "dGVzdC10YWctYmFzZTY0cGFk",
      });

      await wormStorePdf(pdfBuffer, 1, 1);

      // storagePut should receive encrypted buffer, not plaintext
      expect(storagePut).toHaveBeenCalledWith(
        expect.stringMatching(/^worm\//),
        fakeEncrypted,
        "application/pdf",
      );
      // DB insert should include encryption metadata
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          encryptionIv: "dGVzdC1pdi1iYXNl",
          encryptionTag: "dGVzdC10YWctYmFzZTY0cGFk",
        }),
      );
    });

    it("should store null encryption fields when encryption is disabled", async () => {
      vi.mocked(isEncryptionEnabled).mockReturnValue(false);
      const pdfBuffer = Buffer.from("plaintext-pdf");
      await wormStorePdf(pdfBuffer, 1, 1);

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          encryptionIv: null,
          encryptionTag: null,
        }),
      );
    });
  });

  describe("wormGetPdf", () => {
    it("should return URL for valid WORM key", async () => {
      const result = await wormGetPdf("worm/org-1/doc-1/12345-abc-signed.pdf");
      expect(result.url).toBe("https://cdn.example.com/worm/test.pdf");
      expect(storageGet).toHaveBeenCalledWith("worm/org-1/doc-1/12345-abc-signed.pdf");
    });

    it("should throw for invalid WORM key (no worm/ prefix)", async () => {
      await expect(wormGetPdf("invalid/key.pdf")).rejects.toThrow("Invalid WORM key");
    });

    it("should throw for key without worm/ prefix", async () => {
      await expect(wormGetPdf("signed/doc.pdf")).rejects.toThrow(
        'does not start with "worm/"',
      );
    });
  });

  describe("wormKeyExists", () => {
    it("should return true when record exists", async () => {
      mockSelectFrom.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 42 }]),
        }),
      });
      const exists = await wormKeyExists("worm/test.pdf");
      expect(exists).toBe(true);
    });

    it("should return false when record does not exist", async () => {
      mockSelectFrom.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });
      const exists = await wormKeyExists("worm/nonexistent.pdf");
      expect(exists).toBe(false);
    });

    it("should return false when DB is not available", async () => {
      vi.mocked(getDb).mockResolvedValueOnce(null as any);
      const exists = await wormKeyExists("worm/test.pdf");
      expect(exists).toBe(false);
    });
  });

  describe("wormDelete", () => {
    it("should always throw WORM violation error", () => {
      expect(() => wormDelete("worm/test.pdf")).toThrow("WORM violation");
      expect(() => wormDelete("worm/test.pdf")).toThrow("DELETE operation is prohibited");
    });
  });

  describe("wormOverwrite", () => {
    it("should always throw WORM violation error", () => {
      expect(() => wormOverwrite("worm/test.pdf", Buffer.from("new"))).toThrow("WORM violation");
      expect(() => wormOverwrite("worm/test.pdf", Buffer.from("new"))).toThrow("OVERWRITE operation is prohibited");
    });
  });

  describe("verifyWormIntegrity", () => {
    it("should return intact when hash matches", async () => {
      const content = "pdf-content";
      const crypto = await import("crypto");
      const buf = Buffer.from(content);
      const expectedHash = crypto.createHash("sha256").update(buf).digest("hex");

      const originalFetch = global.fetch;
      const uint8 = new Uint8Array(buf);
      const ab = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(ab),
      }) as any;

      const result = await verifyWormIntegrity("worm/test.pdf", expectedHash);
      expect(result.isIntact).toBe(true);
      expect(result.currentHash).toBe(expectedHash);
      expect(result.error).toBeUndefined();

      global.fetch = originalFetch;
    });

    it("should return not intact when hash mismatches", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from("different-content").buffer),
      }) as any;

      const result = await verifyWormIntegrity("worm/test.pdf", "expected-hash-that-wont-match");
      expect(result.isIntact).toBe(false);
      expect(result.error).toContain("Hash mismatch");

      global.fetch = originalFetch;
    });

    it("should handle fetch failure", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }) as any;

      const result = await verifyWormIntegrity("worm/test.pdf", "some-hash");
      expect(result.isIntact).toBe(false);
      expect(result.error).toContain("Failed to fetch: 404");

      global.fetch = originalFetch;
    });

    it("should handle invalid WORM key", async () => {
      const result = await verifyWormIntegrity("invalid/key.pdf", "some-hash");
      expect(result.isIntact).toBe(false);
      expect(result.error).toContain("Invalid WORM key");
    });

    it("should handle network error", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error")) as any;

      const result = await verifyWormIntegrity("worm/test.pdf", "some-hash");
      expect(result.isIntact).toBe(false);
      expect(result.error).toContain("Network error");

      global.fetch = originalFetch;
    });

    it("should look up hash from DB when expectedHash not provided", async () => {
      const crypto = await import("crypto");
      const content = "pdf-for-db-lookup";
      const buf = Buffer.from(content);
      const hash = crypto.createHash("sha256").update(buf).digest("hex");

      // Mock DB to return record with contentHash
      mockSelectFrom.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ contentHash: hash }]),
        }),
      });

      const originalFetch = global.fetch;
      const uint8 = new Uint8Array(buf);
      const ab = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(ab),
      }) as any;

      const result = await verifyWormIntegrity("worm/test.pdf");
      expect(result.isIntact).toBe(true);
      expect(result.currentHash).toBe(hash);

      global.fetch = originalFetch;
    });

    it("should return error when DB has no record and no expectedHash", async () => {
      mockSelectFrom.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await verifyWormIntegrity("worm/test.pdf");
      expect(result.isIntact).toBe(false);
      expect(result.error).toContain("No WORM record found");
    });

    it("should return error when DB not available and no expectedHash", async () => {
      vi.mocked(getDb).mockResolvedValueOnce(null as any);

      const result = await verifyWormIntegrity("worm/test.pdf");
      expect(result.isIntact).toBe(false);
      expect(result.error).toContain("Database not available");
    });
  });

  describe("WORM_STORAGE_POLICY", () => {
    it("should be frozen", () => {
      expect(Object.isFrozen(WORM_STORAGE_POLICY)).toBe(true);
    });

    it("should have correct prefix", () => {
      expect(WORM_STORAGE_POLICY.prefix).toBe("worm/");
    });

    it("should allow PUT (once) and GET", () => {
      expect(WORM_STORAGE_POLICY.allowedOperations).toEqual(["PUT (once)", "GET"]);
    });

    it("should prohibit overwrite, delete, move, rename", () => {
      expect(WORM_STORAGE_POLICY.prohibitedOperations).toContain("PUT (overwrite)");
      expect(WORM_STORAGE_POLICY.prohibitedOperations).toContain("DELETE");
      expect(WORM_STORAGE_POLICY.prohibitedOperations).toContain("MOVE");
      expect(WORM_STORAGE_POLICY.prohibitedOperations).toContain("RENAME");
    });

    it("should use SHA-256 hash algorithm", () => {
      expect(WORM_STORAGE_POLICY.hashAlgorithm).toBe("SHA-256");
    });
  });
});
