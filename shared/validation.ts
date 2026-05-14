/**
 * Shared validation schemas for Hundredth Sign
 * Used by both frontend and backend
 */
import { z } from "zod";

// ==================== COMMON VALIDATORS ====================

export const emailSchema = z.string()
  .min(1, "メールアドレスは必須です")
  .email("有効なメールアドレスを入力してください")
  .max(320, "メールアドレスが長すぎます");

export const nameSchema = z.string()
  .min(1, "名前は必須です")
  .max(255, "名前は255文字以内で入力してください")
  .regex(/^[^\s].*[^\s]$|^[^\s]$/, "名前の前後に空白は使用できません");

export const phoneSchema = z.string()
  .regex(/^[\d\-+() ]{0,50}$/, "有効な電話番号を入力してください")
  .optional()
  .or(z.literal(""));

export const companySchema = z.string().max(255, "会社名は255文字以内で入力してください").optional().or(z.literal(""));

// ==================== DOCUMENT VALIDATORS ====================

export const documentTitleSchema = z.string()
  .min(1, "文書タイトルは必須です")
  .max(500, "文書タイトルは500文字以内で入力してください");

export const documentDescriptionSchema = z.string()
  .max(2000, "説明は2000文字以内で入力してください")
  .optional()
  .or(z.literal(""));

// PDF file validation
export const ALLOWED_MIME_TYPES = ["application/pdf"] as const;
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
/** Minimum bytes required to check the magic number header */
export const PDF_MAGIC_NUMBER_MIN_BYTES = 1024;
/** PDF magic number bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D) */
export const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

export function validatePdfFile(file: { name: string; size: number; type: string }): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    return { valid: false, error: "PDFファイルのみアップロード可能です" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `ファイルサイズは${MAX_FILE_SIZE / 1024 / 1024}MB以下にしてください` };
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return { valid: false, error: "PDFファイルのみアップロード可能です" };
  }
  return { valid: true };
}

/**
 * Validate PDF magic number from raw bytes (server-side / ArrayBuffer).
 * Checks that the first 5 bytes are `%PDF-` and the file is at least 1024 bytes.
 *
 * This is the server-side guard against MIME type spoofing — a client can set
 * `file.type = "application/pdf"` for any file, but cannot fake the raw bytes.
 *
 * @param buffer  A Buffer (Node.js) or ArrayBuffer / Uint8Array (browser)
 */
export function validatePdfMagicNumber(buffer: Buffer | ArrayBuffer | Uint8Array): { valid: boolean; error?: string } {
  let bytes: Uint8Array;
  if (buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(buffer);
  } else if (Buffer.isBuffer(buffer)) {
    bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else {
    bytes = buffer;
  }

  if (bytes.length < PDF_MAGIC_NUMBER_MIN_BYTES) {
    return { valid: false, error: "PDFファイルが小さすぎます（破損または空のファイル）" };
  }

  // Check first 5 bytes: %PDF-
  for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
    if (bytes[i] !== PDF_MAGIC_BYTES[i]) {
      return { valid: false, error: "有効なPDFファイルではありません" };
    }
  }

  return { valid: true };
}

// ==================== SIGNATURE FIELD VALIDATORS ====================

export const signatureFieldSchema = z.object({
  id: z.string().min(1),
  page: z.number().int().min(0),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  signerIndex: z.number().int().min(0),
  type: z.enum(["signature", "date", "name", "initials", "stamp"]),
  label: z.string().optional(),
});

export const signatureFieldsArraySchema = z.array(signatureFieldSchema)
  .min(1, "署名フィールドを1つ以上配置してください")
  .max(50, "署名フィールドは50個以内にしてください");

// ==================== SIGNER VALIDATORS ====================

export const signerSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  order: z.number().int().min(1).default(1),
  message: z.string().max(1000, "メッセージは1000文字以内で入力してください").optional(),
});

export const signersArraySchema = z.array(signerSchema)
  .min(1, "署名者を1名以上指定してください")
  .max(20, "署名者は20名以下にしてください");

// ==================== CONTACT VALIDATORS ====================

export const createContactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  company: companySchema,
  department: z.string().max(255).optional().or(z.literal("")),
  phone: phoneSchema,
  notes: z.string().max(1000).optional().or(z.literal("")),
  category: z.string().max(50).optional().or(z.literal("")),
});

// ==================== INQUIRY VALIDATORS ====================

export const createInquirySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  company: companySchema,
  phone: phoneSchema,
  subject: z.string().min(1, "件名は必須です").max(500, "件名は500文字以内で入力してください"),
  message: z.string().min(1, "メッセージは必須です").max(5000, "メッセージは5000文字以内で入力してください"),
});

// ==================== SIGNATURE FONTS ====================

export const SIGNATURE_FONT_OPTIONS = [
  { id: "dancing-script", name: "Dancing Script", cssFamily: "'Dancing Script', cursive", googleFont: "Dancing+Script" },
  { id: "great-vibes", name: "Great Vibes", cssFamily: "'Great Vibes', cursive", googleFont: "Great+Vibes" },
  { id: "pacifico", name: "Pacifico", cssFamily: "'Pacifico', cursive", googleFont: "Pacifico" },
  { id: "sacramento", name: "Sacramento", cssFamily: "'Sacramento', cursive", googleFont: "Sacramento" },
  { id: "allura", name: "Allura", cssFamily: "'Allura', cursive", googleFont: "Allura" },
  { id: "klee-one", name: "Klee One", cssFamily: "'Klee One', cursive", googleFont: "Klee+One" },
] as const;

export type SignatureFontId = typeof SIGNATURE_FONT_OPTIONS[number]["id"];

export const signatureFontSchema = z.enum(["dancing-script", "great-vibes", "pacifico", "sacramento", "allura", "klee-one"]);

// ==================== DECLINE VALIDATORS ====================

export const declineReasonSchema = z.string()
  .min(1, "拒否理由を入力してください")
  .max(1000, "拒否理由は1000文字以内で入力してください");
