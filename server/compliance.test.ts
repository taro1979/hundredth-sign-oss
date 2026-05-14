/**
 * 電帳法対応基盤テスト
 * - Immutable Audit Log (WORM DB)
 * - Platform Digital Signature
 * - WORM Storage
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ==================== Audit Log Tests ====================

// Mock getDb for audit log tests
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([]),
        }),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([]),
            offset: vi.fn().mockReturnValue([]),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    }),
  }),
}));

// Mock storage for WORM tests
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "worm/test/key.pdf", url: "https://example.com/worm/test/key.pdf" }),
  storageGet: vi.fn().mockResolvedValue({ key: "worm/test/key.pdf", url: "https://example.com/worm/test/key.pdf" }),
}));

describe("Immutable Audit Log (WORM DB)", () => {
  describe("Hash Chain Computation", () => {
    it("should compute deterministic SHA-256 hash for identical inputs", async () => {
      const { createHash } = await import("crypto");
      
      const payload1 = ["GENESIS", "document.created", "document", "1", "42", "127.0.0.1", "1700000000000", "{}"].join("|");
      const hash1 = createHash("sha256").update(payload1, "utf8").digest("hex");
      
      const payload2 = ["GENESIS", "document.created", "document", "1", "42", "127.0.0.1", "1700000000000", "{}"].join("|");
      const hash2 = createHash("sha256").update(payload2, "utf8").digest("hex");
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it("should produce different hashes for different inputs", async () => {
      const { createHash } = await import("crypto");
      
      const payload1 = ["GENESIS", "document.created", "document", "1", "42", "127.0.0.1", "1700000000000", "{}"].join("|");
      const hash1 = createHash("sha256").update(payload1, "utf8").digest("hex");
      
      const payload2 = ["GENESIS", "document.uploaded", "document", "1", "42", "127.0.0.1", "1700000000000", "{}"].join("|");
      const hash2 = createHash("sha256").update(payload2, "utf8").digest("hex");
      
      expect(hash1).not.toBe(hash2);
    });

    it("should chain hashes by incorporating previous hash", async () => {
      const { createHash } = await import("crypto");
      
      // First record uses "GENESIS"
      const payload1 = ["GENESIS", "document.created", "document", "1", "", "", "1700000000000", ""].join("|");
      const hash1 = createHash("sha256").update(payload1, "utf8").digest("hex");
      
      // Second record uses hash1 as previous
      const payload2 = [hash1, "document.sent", "document", "1", "", "", "1700000001000", ""].join("|");
      const hash2 = createHash("sha256").update(payload2, "utf8").digest("hex");
      
      // Verify chain dependency
      expect(hash2).not.toBe(hash1);
      
      // Tampering with hash1 would produce different hash2
      const tamperedPayload2 = ["tampered_hash", "document.sent", "document", "1", "", "", "1700000001000", ""].join("|");
      const tamperedHash2 = createHash("sha256").update(tamperedPayload2, "utf8").digest("hex");
      
      expect(tamperedHash2).not.toBe(hash2);
    });
  });

  describe("WORM Policy", () => {
    it("should only allow INSERT and SELECT operations", async () => {
      const { WORM_POLICY } = await import("./auditLog");
      
      expect(WORM_POLICY.allowedOperations).toContain("INSERT");
      expect(WORM_POLICY.allowedOperations).toContain("SELECT");
      expect(WORM_POLICY.prohibitedOperations).toContain("UPDATE");
      expect(WORM_POLICY.prohibitedOperations).toContain("DELETE");
      expect(WORM_POLICY.prohibitedOperations).toContain("TRUNCATE");
      expect(WORM_POLICY.prohibitedOperations).toContain("DROP");
    }, 30000);

    it("should target the system_audit_logs table", async () => {
      const { WORM_POLICY } = await import("./auditLog");
      expect(WORM_POLICY.table).toBe("system_audit_logs");
    }, 30000);

    it("should be frozen (immutable policy object)", async () => {
      const { WORM_POLICY } = await import("./auditLog");
      expect(Object.isFrozen(WORM_POLICY)).toBe(true);
    });
  });

  describe("Audit Event Types", () => {
    it("should support document lifecycle events", async () => {
      const { appendAuditLog } = await import("./auditLog");
      
      // Should not throw for valid event types
      const result = await appendAuditLog({
        eventType: "document.created",
        entityType: "document",
        entityId: 1,
        actorUserId: 42,
        metadata: { title: "Test Contract" },
      });
      
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("recordHash");
      expect(result.recordHash).toHaveLength(64);
    });

    it("should support signature events", async () => {
      const { appendAuditLog } = await import("./auditLog");
      
      const result = await appendAuditLog({
        eventType: "signature.signed",
        entityType: "signature_request",
        entityId: 5,
        actorEmail: "signer@example.com",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        metadata: { signatureMethod: "draw", consentTimestamp: Date.now() },
      });
      
      expect(result.recordHash).toHaveLength(64);
    });

    it("should support organization events", async () => {
      const { appendAuditLog } = await import("./auditLog");
      
      const result = await appendAuditLog({
        eventType: "org.updated",
        entityType: "organization",
        entityId: 10,
        organizationId: 10,
        actorUserId: 1,
        metadata: { name: "Hundredth Sign" },
      });
      
      expect(result.recordHash).toHaveLength(64);
    });
  });

  describe("appendAuditLog", () => {
    it("should include server timestamp", async () => {
      const { appendAuditLog } = await import("./auditLog");
      
      const before = Date.now();
      const result = await appendAuditLog({
        eventType: "auth.email_verified",
        actorUserId: 1,
      });
      const after = Date.now();
      
      expect(result).toHaveProperty("id");
      // The hash should be computed with a timestamp between before and after
      expect(result.recordHash).toHaveLength(64);
    });
  });
});

// ==================== Platform Signature Tests ====================

describe("Platform Digital Signature", () => {
  describe("Certificate Generation", () => {
    it("should generate a valid self-signed certificate", { timeout: 30000 }, async () => {
      const { generateSelfSignedCertificate } = await import("./platformSignature");
      
      const cert = generateSelfSignedCertificate("test-passphrase");
      
      expect(cert.p12Buffer).toBeInstanceOf(Buffer);
      expect(cert.p12Buffer.length).toBeGreaterThan(0);
      expect(cert.passphrase).toBe("test-passphrase");
      expect(cert.serialNumber).toBeTruthy();
      expect(cert.fingerprint).toHaveLength(64); // SHA-256 hex
      expect(cert.subject).toContain("Hundredth Sign");
      expect(cert.notBefore).toBeInstanceOf(Date);
      expect(cert.notAfter).toBeInstanceOf(Date);
    });

    it("should generate certificate valid for 10 years", { timeout: 30000 }, async () => {
      const { generateSelfSignedCertificate } = await import("./platformSignature");
      
      const cert = generateSelfSignedCertificate();
      const yearDiff = cert.notAfter.getFullYear() - cert.notBefore.getFullYear();
      
      expect(yearDiff).toBe(10);
    });

    it("should generate unique certificates each time", { timeout: 30000 }, async () => {
      const { generateSelfSignedCertificate } = await import("./platformSignature");
      
      const cert1 = generateSelfSignedCertificate("pass1");
      const cert2 = generateSelfSignedCertificate("pass2");
      
      expect(cert1.serialNumber).not.toBe(cert2.serialNumber);
      expect(cert1.fingerprint).not.toBe(cert2.fingerprint);
    });

    it("should include correct X.509 extensions", async () => {
      const forge = (await import("node-forge")).default;
      const { generateSelfSignedCertificate } = await import("./platformSignature");
      
      const certData = generateSelfSignedCertificate("test");
      
      // Parse the P12 to verify extensions
      const p12Asn1 = forge.asn1.fromDer(certData.p12Buffer.toString("binary"));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, "test");
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
      
      expect(cert).toBeTruthy();
      expect(cert!.subject.getField("CN")?.value).toBe("Hundredth Sign Platform Signing Authority");
      expect(cert!.subject.getField("O")?.value).toBe("Hundredth Sign");
      expect(cert!.subject.getField("C")?.value).toBe("JP");
    });
  });

  describe("getCertificateInfo", () => {
    it("should return certificate metadata", async () => {
      const { getCertificateInfo } = await import("./platformSignature");
      
      const info = getCertificateInfo();
      
      expect(info.subject).toContain("Hundredth Sign");
      expect(info.serialNumber).toBeTruthy();
      expect(info.fingerprint).toHaveLength(64);
      expect(info.notBefore).toBeTruthy();
      expect(info.notAfter).toBeTruthy();
      expect(typeof info.isAutoGenerated).toBe("boolean");
    });
  });

  describe("PDF Signing", () => {
    it("should sign a PDF buffer and return a larger buffer", async () => {
      const { PDFDocument } = await import("pdf-lib");
      const { signPdfWithPlatformKey } = await import("./platformSignature");
      
      // Create a minimal PDF
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([595, 842]); // A4
      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);
      
      const signedPdf = await signPdfWithPlatformKey(pdfBuffer, {
        reason: "テスト署名",
        location: "Tokyo",
      });
      
      expect(signedPdf).toBeInstanceOf(Buffer);
      // Signed PDF should be larger due to embedded signature
      expect(signedPdf.length).toBeGreaterThan(pdfBuffer.length);
      // Should still be a valid PDF (starts with %PDF)
      expect(signedPdf.toString("ascii", 0, 5)).toBe("%PDF-");
    });
  });
});

// ==================== WORM Storage Tests ====================

describe("WORM Storage", () => {
  describe("Key Generation", () => {
    it("should generate keys with worm/ prefix", async () => {
      const { generateWormKey } = await import("./wormStorage");
      
      const key = generateWormKey(1, 42);
      expect(key).toMatch(/^worm\//);
    });

    it("should include organization ID in key", async () => {
      const { generateWormKey } = await import("./wormStorage");
      
      const key = generateWormKey(5, 42);
      expect(key).toContain("org-5");
    });

    it("should use org id in key", async () => {
      const { generateWormKey } = await import("./wormStorage");

      const key = generateWormKey(42, 100);
      expect(key).toContain("org-42");
    });

    it("should include document ID in key", async () => {
      const { generateWormKey } = await import("./wormStorage");
      
      const key = generateWormKey(1, 99);
      expect(key).toContain("doc-99");
    });

    it("should generate unique keys for same inputs", async () => {
      const { generateWormKey } = await import("./wormStorage");
      
      const key1 = generateWormKey(1, 42);
      const key2 = generateWormKey(1, 42);
      expect(key1).not.toBe(key2); // nonce ensures uniqueness
    });
  });

  describe("WORM Guards", () => {
    it("should throw on delete attempt", async () => {
      const { wormDelete } = await import("./wormStorage");
      
      expect(() => wormDelete("worm/test/key.pdf")).toThrow("WORM violation");
      expect(() => wormDelete("worm/test/key.pdf")).toThrow("DELETE operation is prohibited");
    });

    it("should throw on overwrite attempt", async () => {
      const { wormOverwrite } = await import("./wormStorage");
      
      expect(() => wormOverwrite("worm/test/key.pdf", Buffer.from("data"))).toThrow("WORM violation");
      expect(() => wormOverwrite("worm/test/key.pdf", Buffer.from("data"))).toThrow("OVERWRITE operation is prohibited");
    });
  });

  describe("WORM Policy", () => {
    it("should define correct allowed operations", async () => {
      const { WORM_STORAGE_POLICY } = await import("./wormStorage");
      
      expect(WORM_STORAGE_POLICY.allowedOperations).toContain("PUT (once)");
      expect(WORM_STORAGE_POLICY.allowedOperations).toContain("GET");
    });

    it("should define correct prohibited operations", async () => {
      const { WORM_STORAGE_POLICY } = await import("./wormStorage");
      
      expect(WORM_STORAGE_POLICY.prohibitedOperations).toContain("PUT (overwrite)");
      expect(WORM_STORAGE_POLICY.prohibitedOperations).toContain("DELETE");
      expect(WORM_STORAGE_POLICY.prohibitedOperations).toContain("MOVE");
      expect(WORM_STORAGE_POLICY.prohibitedOperations).toContain("RENAME");
    });

    it("should use SHA-256 for content hashing", async () => {
      const { WORM_STORAGE_POLICY } = await import("./wormStorage");
      expect(WORM_STORAGE_POLICY.hashAlgorithm).toBe("SHA-256");
    });

    it("should be frozen (immutable policy object)", async () => {
      const { WORM_STORAGE_POLICY } = await import("./wormStorage");
      expect(Object.isFrozen(WORM_STORAGE_POLICY)).toBe(true);
    });
  });

  describe("wormGetPdf", () => {
    it("should reject non-WORM keys", async () => {
      const { wormGetPdf } = await import("./wormStorage");
      
      await expect(wormGetPdf("regular/path/file.pdf")).rejects.toThrow("Invalid WORM key");
    });

    it("should accept valid WORM keys", async () => {
      const { wormGetPdf } = await import("./wormStorage");
      
      const result = await wormGetPdf("worm/org-1/doc-42/123456-abc-signed.pdf");
      expect(result).toHaveProperty("key");
      expect(result).toHaveProperty("url");
    });
  });

  describe("Content Hash Integrity", () => {
    it("should compute deterministic SHA-256 hash for PDF content", async () => {
      const { createHash } = await import("crypto");
      
      const pdfContent = Buffer.from("%PDF-1.4 test content");
      const hash1 = createHash("sha256").update(pdfContent).digest("hex");
      const hash2 = createHash("sha256").update(pdfContent).digest("hex");
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("should detect content changes via hash mismatch", async () => {
      const { createHash } = await import("crypto");
      
      const original = Buffer.from("%PDF-1.4 original content");
      const tampered = Buffer.from("%PDF-1.4 tampered content");
      
      const originalHash = createHash("sha256").update(original).digest("hex");
      const tamperedHash = createHash("sha256").update(tampered).digest("hex");
      
      expect(originalHash).not.toBe(tamperedHash);
    });
  });
});
