import { describe, it, expect } from "vitest";
import {
  emailSchema,
  nameSchema,
  phoneSchema,
  documentTitleSchema,
  documentDescriptionSchema,
  validatePdfFile,
  validatePdfMagicNumber,
  PDF_MAGIC_BYTES,
  PDF_MAGIC_NUMBER_MIN_BYTES,
  signatureFieldSchema,
  signatureFieldsArraySchema,
  signerSchema,
  signersArraySchema,
  declineReasonSchema,
  createContactSchema,
  createInquirySchema,
  signatureFontSchema,
  SIGNATURE_FONT_OPTIONS,
} from "../shared/validation";

// ---------------------------------------------------------------------------
// emailSchema
// ---------------------------------------------------------------------------
describe("emailSchema", () => {
  it("accepts a valid email address", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(emailSchema.safeParse("").success).toBe(false);
  });

  it("rejects an invalid email format", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("rejects an email longer than 320 characters", () => {
    // local(64) + "@" + domain(257) = 322 chars total, which exceeds 320
    const long = "a".repeat(64) + "@" + "b".repeat(253) + ".com";
    expect(long.length).toBeGreaterThan(320);
    expect(emailSchema.safeParse(long).success).toBe(false);
  });

  it("accepts an email of exactly 320 characters", () => {
    // local(64) + @ + domain so total = 320
    const local = "a".repeat(64);
    const domain = "b".repeat(249) + ".com"; // 253 chars
    const email = `${local}@${domain}`; // 64 + 1 + 253 = 318 — valid
    expect(emailSchema.safeParse(email).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// nameSchema
// ---------------------------------------------------------------------------
describe("nameSchema", () => {
  it("accepts a valid name", () => {
    expect(nameSchema.safeParse("Taro Yamada").success).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(nameSchema.safeParse("").success).toBe(false);
  });

  it("rejects a name longer than 255 characters", () => {
    expect(nameSchema.safeParse("a".repeat(256)).success).toBe(false);
  });

  it("accepts a name of exactly 255 characters", () => {
    expect(nameSchema.safeParse("a".repeat(255)).success).toBe(true);
  });

  it("rejects a name with leading whitespace", () => {
    expect(nameSchema.safeParse(" Taro").success).toBe(false);
  });

  it("rejects a name with trailing whitespace", () => {
    expect(nameSchema.safeParse("Taro ").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// phoneSchema
// ---------------------------------------------------------------------------
describe("phoneSchema", () => {
  it("accepts a valid phone number", () => {
    expect(phoneSchema.safeParse("090-1234-5678").success).toBe(true);
  });

  it("accepts an empty string (optional field)", () => {
    expect(phoneSchema.safeParse("").success).toBe(true);
  });

  it("accepts undefined (optional)", () => {
    expect(phoneSchema.safeParse(undefined).success).toBe(true);
  });

  it("rejects phone numbers containing invalid characters", () => {
    expect(phoneSchema.safeParse("090abc").success).toBe(false);
  });

  it("rejects a phone number longer than 50 characters", () => {
    expect(phoneSchema.safeParse("0".repeat(51)).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// documentTitleSchema
// ---------------------------------------------------------------------------
describe("documentTitleSchema", () => {
  it("accepts a valid title", () => {
    expect(documentTitleSchema.safeParse("Contract 2024").success).toBe(true);
  });

  it("rejects an empty string (min 1)", () => {
    expect(documentTitleSchema.safeParse("").success).toBe(false);
  });

  it("accepts a title of exactly 500 characters", () => {
    expect(documentTitleSchema.safeParse("a".repeat(500)).success).toBe(true);
  });

  it("rejects a title of 501 characters", () => {
    expect(documentTitleSchema.safeParse("a".repeat(501)).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// documentDescriptionSchema
// ---------------------------------------------------------------------------
describe("documentDescriptionSchema", () => {
  it("accepts a valid description", () => {
    expect(documentDescriptionSchema.safeParse("Some description").success).toBe(true);
  });

  it("accepts an empty string", () => {
    expect(documentDescriptionSchema.safeParse("").success).toBe(true);
  });

  it("rejects a description longer than 2000 characters", () => {
    expect(documentDescriptionSchema.safeParse("a".repeat(2001)).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePdfFile
// ---------------------------------------------------------------------------
describe("validatePdfFile", () => {
  const validFile = { name: "contract.pdf", size: 1024, type: "application/pdf" };

  it("returns valid=true for a correct PDF file", () => {
    expect(validatePdfFile(validFile)).toEqual({ valid: true });
  });

  it("returns valid=false for a wrong MIME type", () => {
    const result = validatePdfFile({ ...validFile, type: "image/png" });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns valid=false when the file is larger than 20MB", () => {
    const oversized = { ...validFile, size: 21 * 1024 * 1024 };
    const result = validatePdfFile(oversized);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns valid=false for a non-.pdf filename", () => {
    const result = validatePdfFile({ ...validFile, name: "contract.txt" });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("accepts a file of exactly 20MB", () => {
    const exactly20mb = { ...validFile, size: 20 * 1024 * 1024 };
    expect(validatePdfFile(exactly20mb)).toEqual({ valid: true });
  });
});

// ---------------------------------------------------------------------------
// signatureFieldSchema
// ---------------------------------------------------------------------------
describe("signatureFieldSchema", () => {
  const validField = {
    id: "field-1",
    page: 0,
    x: 10,
    y: 20,
    width: 30,
    height: 15,
    signerIndex: 0,
    type: "signature" as const,
  };

  it("accepts a valid signature field object", () => {
    expect(signatureFieldSchema.safeParse(validField).success).toBe(true);
  });

  it("rejects a field with an empty id", () => {
    expect(signatureFieldSchema.safeParse({ ...validField, id: "" }).success).toBe(false);
  });

  it("rejects a field with an invalid type", () => {
    expect(signatureFieldSchema.safeParse({ ...validField, type: "unknown" }).success).toBe(false);
  });

  it("accepts all valid type enum values", () => {
    const types = ["signature", "date", "name", "initials", "stamp"] as const;
    for (const type of types) {
      expect(signatureFieldSchema.safeParse({ ...validField, type }).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// signatureFieldsArraySchema
// ---------------------------------------------------------------------------
describe("signatureFieldsArraySchema", () => {
  const field = {
    id: "f1",
    page: 0,
    x: 10,
    y: 20,
    width: 30,
    height: 15,
    signerIndex: 0,
    type: "signature" as const,
  };

  it("rejects an empty array", () => {
    expect(signatureFieldsArraySchema.safeParse([]).success).toBe(false);
  });

  it("accepts an array with 1 item", () => {
    expect(signatureFieldsArraySchema.safeParse([field]).success).toBe(true);
  });

  it("accepts an array with exactly 50 items (boundary OK)", () => {
    const fields = Array.from({ length: 50 }, (_, i) => ({ ...field, id: `f${i}` }));
    expect(signatureFieldsArraySchema.safeParse(fields).success).toBe(true);
  });

  it("rejects an array with 51 items (boundary NG)", () => {
    const fields = Array.from({ length: 51 }, (_, i) => ({ ...field, id: `f${i}` }));
    expect(signatureFieldsArraySchema.safeParse(fields).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signerSchema
// ---------------------------------------------------------------------------
describe("signerSchema", () => {
  const validSigner = {
    email: "signer@example.com",
    name: "Hanako Yamada",
    order: 1,
  };

  it("accepts a valid signer object", () => {
    expect(signerSchema.safeParse(validSigner).success).toBe(true);
  });

  it("rejects a signer with an invalid email", () => {
    expect(signerSchema.safeParse({ ...validSigner, email: "bad-email" }).success).toBe(false);
  });

  it("accepts an optional message field", () => {
    expect(
      signerSchema.safeParse({ ...validSigner, message: "Please sign this." }).success,
    ).toBe(true);
  });

  // Bug 8: signer order min(1) — 1-based routing integrity
  it("rejects order=0 (1-based routing requires min 1)", () => {
    expect(signerSchema.safeParse({ ...validSigner, order: 0 }).success).toBe(false);
  });

  it("accepts order=1 (minimum valid order)", () => {
    expect(signerSchema.safeParse({ ...validSigner, order: 1 }).success).toBe(true);
  });

  it("rejects negative order values", () => {
    expect(signerSchema.safeParse({ ...validSigner, order: -1 }).success).toBe(false);
  });

  it("accepts order=20 (large valid order)", () => {
    expect(signerSchema.safeParse({ ...validSigner, order: 20 }).success).toBe(true);
  });

  it("defaults order to 1 when not provided", () => {
    const result = signerSchema.safeParse({ email: "signer@example.com", name: "Hanako Yamada" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// signersArraySchema
// ---------------------------------------------------------------------------
describe("signersArraySchema", () => {
  const signer = { email: "s@example.com", name: "Signer One", order: 1 };

  it("rejects an empty array (min 1)", () => {
    expect(signersArraySchema.safeParse([]).success).toBe(false);
  });

  it("accepts a single signer", () => {
    expect(signersArraySchema.safeParse([signer]).success).toBe(true);
  });

  it("accepts exactly 20 signers (boundary OK)", () => {
    const signers = Array.from({ length: 20 }, (_, i) => ({
      ...signer,
      email: `s${i}@example.com`,
    }));
    expect(signersArraySchema.safeParse(signers).success).toBe(true);
  });

  it("rejects 21 signers (boundary NG)", () => {
    const signers = Array.from({ length: 21 }, (_, i) => ({
      ...signer,
      email: `s${i}@example.com`,
    }));
    expect(signersArraySchema.safeParse(signers).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// declineReasonSchema
// ---------------------------------------------------------------------------
describe("declineReasonSchema", () => {
  it("accepts a valid decline reason", () => {
    expect(declineReasonSchema.safeParse("Content is incorrect").success).toBe(true);
  });

  it("rejects an empty string (min 1)", () => {
    expect(declineReasonSchema.safeParse("").success).toBe(false);
  });

  it("accepts exactly 1000 characters", () => {
    expect(declineReasonSchema.safeParse("a".repeat(1000)).success).toBe(true);
  });

  it("rejects 1001 characters", () => {
    expect(declineReasonSchema.safeParse("a".repeat(1001)).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createContactSchema
// ---------------------------------------------------------------------------
describe("createContactSchema", () => {
  const validContact = {
    name: "Taro Contact",
    email: "contact@example.com",
    company: "Acme Inc",
    department: "Engineering",
    phone: "03-1234-5678",
    notes: "VIP client",
    category: "partner",
  };

  it("accepts a valid contact object", () => {
    expect(createContactSchema.safeParse(validContact).success).toBe(true);
  });

  it("rejects a contact with an invalid email", () => {
    expect(
      createContactSchema.safeParse({ ...validContact, email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("accepts optional fields as empty strings", () => {
    const minimal = {
      name: "Minimal",
      email: "m@example.com",
      company: "",
      phone: "",
    };
    expect(createContactSchema.safeParse(minimal).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createInquirySchema
// ---------------------------------------------------------------------------
describe("createInquirySchema", () => {
  const validInquiry = {
    name: "Inquiry User",
    email: "inquiry@example.com",
    company: "Corp",
    phone: "03-0000-0000",
    subject: "Request for info",
    message: "Please send details.",
  };

  it("accepts a valid inquiry object", () => {
    expect(createInquirySchema.safeParse(validInquiry).success).toBe(true);
  });

  it("rejects inquiry without a subject", () => {
    expect(
      createInquirySchema.safeParse({ ...validInquiry, subject: "" }).success,
    ).toBe(false);
  });

  it("rejects inquiry without a message", () => {
    expect(
      createInquirySchema.safeParse({ ...validInquiry, message: "" }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signatureFontSchema
// ---------------------------------------------------------------------------
describe("signatureFontSchema", () => {
  it("accepts all valid font values", () => {
    const validFonts = [
      "dancing-script",
      "great-vibes",
      "pacifico",
      "sacramento",
      "allura",
      "klee-one",
    ] as const;
    for (const font of validFonts) {
      expect(signatureFontSchema.safeParse(font).success).toBe(true);
    }
  });

  it("rejects an invalid font value", () => {
    expect(signatureFontSchema.safeParse("comic-sans").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SIGNATURE_FONT_OPTIONS
// ---------------------------------------------------------------------------
describe("SIGNATURE_FONT_OPTIONS", () => {
  it("is an array", () => {
    expect(Array.isArray(SIGNATURE_FONT_OPTIONS)).toBe(true);
  });

  it("contains exactly 6 font options", () => {
    expect(SIGNATURE_FONT_OPTIONS).toHaveLength(6);
  });

  it("each option has id, name, cssFamily, and googleFont properties", () => {
    for (const option of SIGNATURE_FONT_OPTIONS) {
      expect(option).toHaveProperty("id");
      expect(option).toHaveProperty("name");
      expect(option).toHaveProperty("cssFamily");
      expect(option).toHaveProperty("googleFont");
    }
  });
});

// ---------------------------------------------------------------------------
// validatePdfMagicNumber
// ---------------------------------------------------------------------------
describe("validatePdfMagicNumber (H-05 magic bytes check)", () => {
  function makePdfBuffer(size = 1024): Buffer {
    const buf = Buffer.alloc(size);
    buf[0] = 0x25; // %
    buf[1] = 0x50; // P
    buf[2] = 0x44; // D
    buf[3] = 0x46; // F
    buf[4] = 0x2d; // -
    return buf;
  }

  it("returns valid for a proper 1024-byte buffer starting with %PDF-", () => {
    const result = validatePdfMagicNumber(makePdfBuffer(1024));
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns invalid when buffer is too short (< 1024 bytes)", () => {
    const result = validatePdfMagicNumber(Buffer.from("%PDF-content"));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("小さすぎます");
  });

  it("returns invalid when buffer does not start with %PDF-", () => {
    const buf = makePdfBuffer(1024);
    buf[0] = 0x00; // corrupt first byte
    const result = validatePdfMagicNumber(buf);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("有効なPDF");
  });

  it("accepts ArrayBuffer input", () => {
    const buf = makePdfBuffer(1024);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    const result = validatePdfMagicNumber(ab);
    expect(result.valid).toBe(true);
  });

  it("accepts Uint8Array input", () => {
    const buf = makePdfBuffer(1024);
    const ua = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const result = validatePdfMagicNumber(ua);
    expect(result.valid).toBe(true);
  });

  it("validates all 5 magic bytes individually", () => {
    for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
      const buf = makePdfBuffer(1024);
      buf[i] ^= 0x01; // flip one byte
      const result = validatePdfMagicNumber(buf);
      expect(result.valid).toBe(false);
    }
  });

  it("PDF_MAGIC_NUMBER_MIN_BYTES is 1024", () => {
    expect(PDF_MAGIC_NUMBER_MIN_BYTES).toBe(1024);
  });

  it("PDF_MAGIC_BYTES matches %PDF-", () => {
    expect([...PDF_MAGIC_BYTES]).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });
});
