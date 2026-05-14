import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock node-forge
const mockSign = vi.fn();
const mockCreateCertificate = vi.fn(() => ({
  publicKey: null,
  serialNumber: "",
  validity: { notBefore: new Date(), notAfter: new Date() },
  setSubject: vi.fn(),
  setIssuer: vi.fn(),
  setExtensions: vi.fn(),
  sign: mockSign,
  subject: {
    attributes: [
      { shortName: "CN", value: "Test" },
      { shortName: "O", value: "TestOrg" },
    ],
  },
}));

vi.mock("node-forge", () => ({
  default: {
    pki: {
      rsa: {
        generateKeyPair: vi.fn(() => ({
          publicKey: "mock-public-key",
          privateKey: "mock-private-key",
        })),
      },
      createCertificate: mockCreateCertificate,
      certificateToAsn1: vi.fn(() => "mock-asn1"),
      oids: { certBag: "1.2.840.113549.1.12.10.1.3" },
    },
    pkcs12: {
      toPkcs12Asn1: vi.fn(() => "mock-p12-asn1"),
      pkcs12FromAsn1: vi.fn(() => ({
        getBags: vi.fn(() => ({
          "1.2.840.113549.1.12.10.1.3": [{
            cert: {
              serialNumber: "test-serial",
              validity: { notBefore: new Date(), notAfter: new Date() },
              subject: {
                attributes: [
                  { shortName: "CN", value: "Test Cert" },
                ],
              },
            },
          }],
        })),
      })),
    },
    asn1: {
      toDer: vi.fn(() => ({
        getBytes: vi.fn(() => "mock-der-bytes"),
      })),
      fromDer: vi.fn(() => "mock-asn1-from-der"),
    },
    md: {
      sha256: {
        create: vi.fn(() => ({
          update: vi.fn().mockReturnThis(),
          digest: vi.fn(() => ({
            toHex: vi.fn(() => "abcdef1234567890abcdef1234567890"),
          })),
        })),
      },
    },
  },
}));

// Mock pdf-lib
vi.mock("pdf-lib", () => ({
  PDFDocument: {
    load: vi.fn(() => ({
      save: vi.fn(() => new Uint8Array([37, 80, 68, 70])),
    })),
  },
}));

// Mock @signpdf
vi.mock("@signpdf/signpdf", () => ({
  default: {
    sign: vi.fn(() => Buffer.from("signed-pdf")),
  },
}));

vi.mock("@signpdf/signer-p12", () => ({
  P12Signer: vi.fn(),
}));

vi.mock("@signpdf/placeholder-pdf-lib", () => ({
  pdflibAddPlaceholder: vi.fn(),
}));

vi.mock("./_core/env", () => ({
  ENV: {},
}));

describe("platformSignature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cached cert
    delete process.env.PLATFORM_SIGNING_P12;
    delete process.env.PLATFORM_SIGNING_PASSPHRASE;
  });

  describe("generateSelfSignedCertificate", () => {
    it("generates a self-signed certificate with explicit passphrase", async () => {
      const { generateSelfSignedCertificate } = await import("./platformSignature");
      const cert = generateSelfSignedCertificate("test-passphrase");
      expect(cert).toBeDefined();
      expect(cert.p12Buffer).toBeInstanceOf(Buffer);
      expect(cert.passphrase).toBe("test-passphrase");
      expect(cert.serialNumber).toBeDefined();
      expect(cert.fingerprint).toBeDefined();
      expect(cert.subject).toContain("Hundredth Sign");
    });

    it("generates a self-signed certificate with custom passphrase", async () => {
      const { generateSelfSignedCertificate } = await import("./platformSignature");
      const cert = generateSelfSignedCertificate("custom-pass");
      expect(cert.passphrase).toBe("custom-pass");
    });
  });

  describe("getPlatformCertificate", () => {
    it("auto-generates certificate with random passphrase when no env var is set", async () => {
      // Force re-import to reset cached cert
      vi.resetModules();
      const mod = await import("./platformSignature");
      const cert = mod.getPlatformCertificate();
      expect(cert).toBeDefined();
      expect(cert.p12Buffer).toBeInstanceOf(Buffer);
      // Passphrase should NOT be the old hardcoded value
      expect(cert.passphrase).not.toBe("hundredth-sign-jp-platform");
      // Should be a base64 string (44 chars for 32 random bytes)
      expect(cert.passphrase.length).toBeGreaterThan(0);
    });

    it("returns cached certificate on second call", async () => {
      vi.resetModules();
      const mod = await import("./platformSignature");
      const cert1 = mod.getPlatformCertificate();
      const cert2 = mod.getPlatformCertificate();
      expect(cert1).toBe(cert2);
    });

    it("loads certificate from env when PLATFORM_SIGNING_P12 is set", async () => {
      vi.resetModules();
      process.env.PLATFORM_SIGNING_P12 = Buffer.from("fake-p12").toString("base64");
      process.env.PLATFORM_SIGNING_PASSPHRASE = "test-pass";
      const mod = await import("./platformSignature");
      const cert = mod.getPlatformCertificate();
      expect(cert).toBeDefined();
    });

    it("uses 'unknown' fallbacks when P12 cert bag has no cert (cert=undefined branches)", async () => {
      vi.resetModules();
      vi.doMock("node-forge", () => ({
        default: {
          pki: {
            rsa: {
              generateKeyPair: vi.fn(() => ({
                publicKey: "mock-public-key",
                privateKey: "mock-private-key",
              })),
            },
            createCertificate: vi.fn(() => ({
              publicKey: null,
              serialNumber: "",
              validity: { notBefore: new Date(), notAfter: new Date() },
              setSubject: vi.fn(),
              setIssuer: vi.fn(),
              setExtensions: vi.fn(),
              sign: vi.fn(),
              subject: { attributes: [{ shortName: "CN", value: "Test" }] },
            })),
            certificateToAsn1: vi.fn(() => "mock-asn1"),
            oids: { certBag: "1.2.840.113549.1.12.10.1.3" },
          },
          pkcs12: {
            toPkcs12Asn1: vi.fn(() => "mock-p12-asn1"),
            pkcs12FromAsn1: vi.fn(() => ({
              getBags: vi.fn(() => ({
                // Empty array → certBag?.[0] = undefined → cert = undefined
                "1.2.840.113549.1.12.10.1.3": [],
              })),
            })),
          },
          asn1: {
            toDer: vi.fn(() => ({ getBytes: vi.fn(() => "mock-der-bytes") })),
            fromDer: vi.fn(() => "mock-asn1-from-der"),
          },
          md: {
            sha256: {
              create: vi.fn(() => ({
                update: vi.fn().mockReturnThis(),
                digest: vi.fn(() => ({ toHex: vi.fn(() => "abcdef1234567890") })),
              })),
            },
          },
        },
      }));

      process.env.PLATFORM_SIGNING_P12 = Buffer.from("fake-p12").toString("base64");
      process.env.PLATFORM_SIGNING_PASSPHRASE = "test-pass";

      const mod = await import("./platformSignature");
      const cert = mod.getPlatformCertificate();
      expect(cert.serialNumber).toBe("unknown");
      expect(cert.fingerprint).toBe("unknown");
      expect(cert.subject).toBe("unknown");
      expect(cert.notBefore).toBeInstanceOf(Date);
      expect(cert.notAfter).toBeInstanceOf(Date);

      vi.doUnmock("node-forge");
    });

    it("falls back to auto-generation when P12 parsing throws", async () => {
      vi.resetModules();
      vi.doMock("node-forge", () => ({
        default: {
          pki: {
            rsa: {
              generateKeyPair: vi.fn(() => ({
                publicKey: "mock-public-key",
                privateKey: "mock-private-key",
              })),
            },
            createCertificate: vi.fn(() => ({
              publicKey: null,
              serialNumber: "auto-serial",
              validity: { notBefore: new Date(), notAfter: new Date() },
              setSubject: vi.fn(),
              setIssuer: vi.fn(),
              setExtensions: vi.fn(),
              sign: vi.fn(),
              subject: {
                attributes: [
                  { shortName: "CN", value: "Hundredth Sign Platform Signing Authority" },
                  { shortName: "O", value: "Hundredth Sign" },
                ],
              },
            })),
            certificateToAsn1: vi.fn(() => "mock-asn1"),
            oids: { certBag: "1.2.840.113549.1.12.10.1.3" },
          },
          pkcs12: {
            toPkcs12Asn1: vi.fn(() => "mock-p12-asn1"),
            pkcs12FromAsn1: vi.fn(() => { throw new Error("Invalid P12 data"); }),
          },
          asn1: {
            toDer: vi.fn(() => ({ getBytes: vi.fn(() => "mock-der-bytes") })),
            fromDer: vi.fn(() => "mock-asn1-from-der"),
          },
          md: {
            sha256: {
              create: vi.fn(() => ({
                update: vi.fn().mockReturnThis(),
                digest: vi.fn(() => ({ toHex: vi.fn(() => "abcdef1234567890") })),
              })),
            },
          },
        },
      }));

      process.env.PLATFORM_SIGNING_P12 = Buffer.from("invalid-p12").toString("base64");
      delete process.env.PLATFORM_SIGNING_PASSPHRASE;

      const mod = await import("./platformSignature");
      const cert = mod.getPlatformCertificate();
      // Should fall back to auto-generated certificate
      expect(cert).toBeDefined();
      expect(cert.p12Buffer).toBeInstanceOf(Buffer);

      vi.doUnmock("node-forge");
    });
  });

  describe("signPdfWithPlatformKey", () => {
    it("signs a PDF buffer with platform key", async () => {
      vi.resetModules();
      const mod = await import("./platformSignature");
      const result = await mod.signPdfWithPlatformKey(Buffer.from("fake-pdf"));
      expect(result).toBeInstanceOf(Buffer);
    });

    it("signs with custom metadata", async () => {
      vi.resetModules();
      const mod = await import("./platformSignature");
      const result = await mod.signPdfWithPlatformKey(Buffer.from("fake-pdf"), {
        reason: "Test signing",
        location: "Test Location",
        contactInfo: "test@example.com",
        documentTitle: "Test Document",
      });
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe("getCertificateInfo", () => {
    it("returns certificate info", async () => {
      vi.resetModules();
      const mod = await import("./platformSignature");
      const info = mod.getCertificateInfo();
      expect(info).toBeDefined();
      expect(info.subject).toBeDefined();
      expect(info.serialNumber).toBeDefined();
      expect(info.fingerprint).toBeDefined();
      expect(info.notBefore).toBeDefined();
      expect(info.notAfter).toBeDefined();
      expect(typeof info.isAutoGenerated).toBe("boolean");
    });
  });
});
