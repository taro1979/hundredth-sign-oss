/**
 * Platform Digital Signature Service
 * 
 * 電帳法対応: 運用者自身の秘密鍵を用いた「立会人型電子署名」
 * 
 * - Self-signed X.509 certificate (RSA 2048-bit)
 * - PKCS#7 detached signature via @signpdf
 * - NTP-synced server timestamp embedded in signature
 * - Adobe Acrobat compatible (shows signature panel)
 */

import { randomBytes } from "crypto";
import forge from "node-forge";
import { PDFDocument } from "pdf-lib";
import signpdf from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { ENV } from "./_core/env";

// ==================== Certificate Management ====================

interface PlatformCertificate {
  p12Buffer: Buffer;
  passphrase: string;
  serialNumber: string;
  fingerprint: string;
  notBefore: Date;
  notAfter: Date;
  subject: string;
}

let cachedCert: PlatformCertificate | null = null;

/**
 * Generate a self-signed X.509 certificate and PKCS#12 bundle.
 * Used when no pre-existing certificate is provided via environment variables.
 */
export function generateSelfSignedCertificate(
  passphrase: string,
): PlatformCertificate {
  // Generate RSA 2048-bit key pair
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // Create X.509 v3 certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = Date.now().toString(16);

  // Valid for 10 years
  const notBefore = new Date();
  const notAfter = new Date();
  notAfter.setFullYear(notAfter.getFullYear() + 10);
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;

  // Subject and Issuer (self-signed)
  const attrs = [
    { name: "commonName", value: "Hundredth Sign Platform Signing Authority" },
    { name: "organizationName", value: "Hundredth Sign" },
    { name: "countryName", value: "JP" },
    { shortName: "ST", value: "Tokyo" },
    { name: "localityName", value: "Shibuya" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  // Extensions
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    {
      name: "keyUsage",
      digitalSignature: true,
      nonRepudiation: true,
    },
    {
      name: "extKeyUsage",
      emailProtection: true,
    },
    {
      name: "subjectKeyIdentifier",
    },
  ]);

  // Self-sign with SHA-256
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // Export as PKCS#12
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, passphrase, {
    algorithm: "3des",
    friendlyName: "Hundredth Sign Platform",
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Buffer = Buffer.from(p12Der, "binary");

  // Compute fingerprint
  const fingerprint = forge.md.sha256
    .create()
    .update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
    .digest()
    .toHex();

  return {
    p12Buffer,
    passphrase,
    serialNumber: cert.serialNumber,
    fingerprint,
    notBefore,
    notAfter,
    subject: "CN=Hundredth Sign Platform Signing Authority, O=Hundredth Sign, C=JP",
  };
}

/**
 * Get or create the platform signing certificate.
 * Checks environment variables first, falls back to auto-generation.
 */
export function getPlatformCertificate(): PlatformCertificate {
  if (cachedCert) return cachedCert;

  // Check if a pre-existing P12 is provided via env
  const p12Base64 = process.env.PLATFORM_SIGNING_P12;
  const passphrase = ENV.platformSigningPassphrase || randomBytes(32).toString("base64");
  if (!ENV.platformSigningPassphrase) {
    console.warn("[PlatformSignature] Auto-generated passphrase (set PLATFORM_SIGNING_PASSPHRASE for persistence)");
  }

  if (p12Base64) {
    try {
      const p12Buffer = Buffer.from(p12Base64, "base64");
      // Validate the P12 by loading it
      const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString("binary"));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);
      
      // Extract cert info
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag]?.[0];
      const cert = certBag?.cert;

      cachedCert = {
        p12Buffer,
        passphrase,
        serialNumber: cert?.serialNumber ?? "unknown",
        fingerprint: cert
          ? forge.md.sha256
              .create()
              .update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
              .digest()
              .toHex()
          : "unknown",
        notBefore: cert?.validity.notBefore ?? new Date(),
        notAfter: cert?.validity.notAfter ?? new Date(),
        subject: cert
          ? cert.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(", ")
          : "unknown",
      };
      console.log("[PlatformSignature] Loaded certificate from environment");
      return cachedCert;
    } catch (e) {
      console.warn("[PlatformSignature] Failed to load P12 from env, generating new:", e);
    }
  }

  // Auto-generate a self-signed certificate
  console.log("[PlatformSignature] Generating self-signed certificate...");
  cachedCert = generateSelfSignedCertificate(passphrase);
  console.log(`[PlatformSignature] Certificate generated: SN=${cachedCert.serialNumber}, FP=${cachedCert.fingerprint.substring(0, 16)}...`);
  return cachedCert;
}

// ==================== PDF Signing ====================

/**
 * Sign a PDF buffer with the platform's digital signature.
 * 
 * Process:
 * 1. Load PDF with pdf-lib
 * 2. Add signature placeholder via @signpdf/placeholder-pdf-lib
 * 3. Save PDF with placeholder
 * 4. Apply PKCS#7 detached signature via @signpdf/signpdf + P12Signer
 * 
 * The resulting PDF will show a digital signature in Adobe Acrobat's
 * signature panel, with tamper detection enabled.
 */
export async function signPdfWithPlatformKey(
  pdfBuffer: Buffer,
  metadata?: {
    reason?: string;
    location?: string;
    contactInfo?: string;
    documentTitle?: string;
  },
): Promise<Buffer> {
  const cert = getPlatformCertificate();

  // 1. Load PDF with pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  // 2. Add signature placeholder
  const signatureReason = metadata?.reason ?? "電子署名プラットフォームによる立会人型署名";
  const signatureLocation = metadata?.location ?? "Tokyo, Japan";
  const contactInfo = metadata?.contactInfo ?? "Hundredth Sign Platform";

  pdflibAddPlaceholder({
    pdfDoc,
    reason: signatureReason,
    contactInfo,
    name: "Hundredth Sign Platform",
    location: signatureLocation,
    signingTime: new Date(),
    signatureLength: 8192, // Generous size for the signature
  });

  // 3. Save PDF with placeholder
  const pdfWithPlaceholder = await pdfDoc.save();
  const pdfBuf = Buffer.from(pdfWithPlaceholder);

  // 4. Sign with P12
  const signer = new P12Signer(cert.p12Buffer, {
    passphrase: cert.passphrase,
  });

  const signedPdf = await signpdf.sign(pdfBuf, signer);

  return Buffer.from(signedPdf);
}

// ==================== Certificate Info ====================

/**
 * Get information about the current platform signing certificate.
 * Useful for admin dashboards and audit reports.
 */
export function getCertificateInfo(): {
  subject: string;
  serialNumber: string;
  fingerprint: string;
  notBefore: string;
  notAfter: string;
  isAutoGenerated: boolean;
} {
  const cert = getPlatformCertificate();
  return {
    subject: cert.subject,
    serialNumber: cert.serialNumber,
    fingerprint: cert.fingerprint,
    notBefore: cert.notBefore.toISOString(),
    notAfter: cert.notAfter.toISOString(),
    isAutoGenerated: !process.env.PLATFORM_SIGNING_P12,
  };
}
