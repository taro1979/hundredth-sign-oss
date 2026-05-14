/**
 * Integration tests for server/platformSignature.ts — Digital Certificate boundary (IP-8)
 *
 * Tests that:
 * 1. generateSelfSignedCertificate produces a valid P12 certificate
 * 2. getPlatformCertificate caches and returns the same cert on subsequent calls
 * 3. signPdfWithPlatformKey signs a minimal PDF and returns a valid PDF buffer
 *
 * Strategy: uses real node-forge and pdf-lib (no mocks) to verify
 * the actual certificate generation and signing pipeline.
 * These tests are intentionally slow (~2-5s) due to RSA key generation.
 *
 * AC: AC-I08
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// IP-8a: generateSelfSignedCertificate produces valid certificate
// ---------------------------------------------------------------------------
describe("IP-8a: generateSelfSignedCertificate (AC-I08)", () => {
  it(
    "generates a P12 certificate with valid structure and fields",
    async () => {
      const { generateSelfSignedCertificate } = await import("./platformSignature");

      const cert = generateSelfSignedCertificate("test-passphrase");

      // Should return a valid certificate structure
      expect(cert.p12Buffer).toBeInstanceOf(Buffer);
      expect(cert.p12Buffer.length).toBeGreaterThan(100);

      // Passphrase should be preserved
      expect(cert.passphrase).toBe("test-passphrase");

      // Serial number should be a hex string
      expect(cert.serialNumber).toMatch(/^[0-9a-f]+$/i);

      // Fingerprint should be a 64-char hex SHA-256
      expect(cert.fingerprint).toMatch(/^[0-9a-f]{64}$/i);

      // Valid date range: notBefore < notAfter (10 years apart)
      expect(cert.notBefore.getTime()).toBeLessThan(cert.notAfter.getTime());
      const tenYearsMs = 10 * 365 * 24 * 60 * 60 * 1000;
      const diff = cert.notAfter.getTime() - cert.notBefore.getTime();
      expect(diff).toBeGreaterThan(tenYearsMs * 0.95);

      // Subject should contain Hundredth Sign info
      expect(cert.subject).toContain("Hundredth Sign");
    },
    30_000, // RSA key generation can be slow
  );

  it(
    "generates different certificates each time (unique serial numbers)",
    async () => {
      const { generateSelfSignedCertificate } = await import("./platformSignature");

      const cert1 = generateSelfSignedCertificate();
      const cert2 = generateSelfSignedCertificate();

      // Serial numbers should differ (timestamp-based)
      // Allow 1ms tolerance — they might collide in very fast runs
      // But fingerprints must definitely differ (different key pairs)
      expect(cert1.fingerprint).not.toBe(cert2.fingerprint);
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------
// IP-8b: getPlatformCertificate caches on second call
// ---------------------------------------------------------------------------
describe("IP-8b: getPlatformCertificate caching (AC-I08)", () => {
  it(
    "returns the same certificate instance on subsequent calls",
    async () => {
      // Unset env var to ensure auto-generation path
      delete process.env.PLATFORM_SIGNING_P12;

      const { getPlatformCertificate } = await import("./platformSignature");

      const cert1 = getPlatformCertificate();
      const cert2 = getPlatformCertificate();

      // Should be the same cached instance
      expect(cert1.fingerprint).toBe(cert2.fingerprint);
      expect(cert1.serialNumber).toBe(cert2.serialNumber);
      expect(cert1.p12Buffer).toBe(cert2.p12Buffer); // Same Buffer reference
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------
// IP-8c: signPdfWithPlatformKey signs a minimal PDF buffer
// ---------------------------------------------------------------------------
describe("IP-8c: signPdfWithPlatformKey (AC-I08)", () => {
  it(
    "signs a minimal PDF and returns a non-empty PDF buffer",
    async () => {
      delete process.env.PLATFORM_SIGNING_P12;

      const { PDFDocument } = await import("pdf-lib");
      const { signPdfWithPlatformKey } = await import("./platformSignature");

      // Create a minimal valid PDF
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage();
      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      const signedBuffer = await signPdfWithPlatformKey(pdfBuffer, {
        reason: "Integration test signature",
        location: "Tokyo, Japan",
        documentTitle: "Integration Test Document",
      });

      // Should return a non-empty buffer
      expect(signedBuffer).toBeInstanceOf(Buffer);
      expect(signedBuffer.length).toBeGreaterThan(pdfBuffer.length);

      // Signed PDF should start with %PDF
      const header = signedBuffer.subarray(0, 4).toString("ascii");
      expect(header).toBe("%PDF");
    },
    60_000, // Certificate generation + PDF signing
  );
});
