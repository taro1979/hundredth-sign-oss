/**
 * PDF processing service for Hundredth Sign
 * Uses pdf-lib to embed signatures into PDFs
 */
import { PDFDocument, PDFName, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { storagePut } from "./storage";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";

const execFileAsync = promisify(execFile);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);

// CDN fallback for Japanese fonts when the bundled font is unavailable.
const FONT_CDN_FALLBACK = "https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf";

// Load Japanese font once (lazy singleton)
let _japaneseFontBytes: Buffer | null = null;
let _fontLoadPromise: Promise<Buffer> | null = null;

async function loadJapaneseFontBytes(): Promise<Buffer> {
  if (_japaneseFontBytes) return _japaneseFontBytes;
  if (_fontLoadPromise) return _fontLoadPromise;
  
  _fontLoadPromise = (async () => {
    // Minimum expected font file size (Noto Sans JP Regular is ~5.3MB)
    const MIN_FONT_SIZE = 500_000;
    
    // Try multiple local paths (dev, production dist, and project root)
    const localPaths = [
      path.join(import.meta.dirname, "fonts", "NotoSansJP-Static-Regular.ttf"),
      path.join(import.meta.dirname, "..", "server", "fonts", "NotoSansJP-Static-Regular.ttf"),
      path.join(import.meta.dirname, "fonts", "NotoSansJP-Subset.ttf"),
      path.join(import.meta.dirname, "..", "server", "fonts", "NotoSansJP-Subset.ttf"),
    ];
    
    for (const fontPath of localPaths) {
      if (fs.existsSync(fontPath)) {
        const buf = fs.readFileSync(fontPath);
        if (buf.length >= MIN_FONT_SIZE) {
          _japaneseFontBytes = buf;
          console.log(`[PDF] Japanese font loaded from local: ${fontPath} (${buf.length} bytes)`);
          return _japaneseFontBytes;
        } else {
          console.warn(`[PDF] Font file too small at ${fontPath}: ${buf.length} bytes, skipping`);
        }
      }
    }
    
    // Fallback: download from CDN (deployed environment)
    console.log("[PDF] No local font found, downloading from CDN...");
    const cdnUrls = [FONT_CDN_FALLBACK];
    for (const url of cdnUrls) {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!resp.ok) throw new Error(`CDN failed: ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());
        if (buf.length < MIN_FONT_SIZE) {
          console.warn(`[PDF] CDN font too small: ${buf.length} bytes from ${url}`);
          continue;
        }
        _japaneseFontBytes = buf;
        console.log(`[PDF] Japanese font downloaded from CDN (${buf.length} bytes): ${url}`);
        // Cache locally for subsequent calls
        const fontsDir = path.join(import.meta.dirname, "fonts");
        try {
          if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
          fs.writeFileSync(path.join(fontsDir, "NotoSansJP-Static-Regular.ttf"), _japaneseFontBytes);
        } catch { /* ignore write errors in read-only environments */ }
        return _japaneseFontBytes;
      } catch (e) {
        console.warn(`[PDF] CDN download failed for ${url}:`, e);
      }
    }
    
    throw new Error("[PDF] CRITICAL: Failed to load Japanese font from all sources. PDF text rendering will be broken.");
  })();
  
  return _fontLoadPromise;
}

// Synchronous getter for backward compatibility (preloaded)
function getJapaneseFontBytes(): Buffer {
  if (!_japaneseFontBytes) {
    // Try multiple local paths synchronously
    const localPaths = [
      path.join(import.meta.dirname, "fonts", "NotoSansJP-Static-Regular.ttf"),
      path.join(import.meta.dirname, "..", "server", "fonts", "NotoSansJP-Static-Regular.ttf"),
      path.join(import.meta.dirname, "fonts", "NotoSansJP-Subset.ttf"),
      path.join(import.meta.dirname, "..", "server", "fonts", "NotoSansJP-Subset.ttf"),
    ];
    for (const fontPath of localPaths) {
      if (fs.existsSync(fontPath)) {
        const buf = fs.readFileSync(fontPath);
        if (buf.length >= 500_000) {
          _japaneseFontBytes = buf;
          console.log(`[PDF] Japanese font loaded synchronously from: ${fontPath} (${buf.length} bytes)`);
          return _japaneseFontBytes;
        }
      }
    }
    throw new Error("[PDF] CRITICAL: Japanese font not loaded. Call loadJapaneseFontBytes() first.");
  }
  return _japaneseFontBytes;
}

// Preload font at module initialization
loadJapaneseFontBytes().catch(err => console.error("[PDF] Failed to preload Japanese font:", err));

// Available signature fonts mapped to display names + Google Fonts TTF URLs
export const SIGNATURE_FONTS = [
  { id: "dancing-script", name: "Dancing Script", cssFamily: "'Dancing Script', cursive", ttfUrl: "https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3ROp6.ttf" },
  { id: "great-vibes", name: "Great Vibes", cssFamily: "'Great Vibes', cursive", ttfUrl: "https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.ttf" },
  { id: "pacifico", name: "Pacifico", cssFamily: "'Pacifico', cursive", ttfUrl: "https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ96A4sijpFu_.ttf" },
  { id: "sacramento", name: "Sacramento", cssFamily: "'Sacramento', cursive", ttfUrl: "https://fonts.gstatic.com/s/sacramento/v14/buEzpo6gcdjy0EiZMBUG4CMf_f5Iai0.ttf" },
  { id: "allura", name: "Allura", cssFamily: "'Allura', cursive", ttfUrl: "https://fonts.gstatic.com/s/allura/v21/9oRPNYsQpS4zjuAPjAIXPtrrGA.ttf" },
  { id: "klee-one", name: "Klee One", cssFamily: "'Klee One', cursive", ttfUrl: "https://fonts.gstatic.com/s/kleeone/v8/LDIxapCLNRc6A8oT4q4AOeekWPrP.ttf" },
] as const;

// Cache for signature font bytes (lazy load per font)
const _signatureFontBytesCache = new Map<string, Buffer>();
const _signatureFontLoadPromises = new Map<string, Promise<Buffer | null>>();

async function loadSignatureFontBytes(fontId: string): Promise<Buffer | null> {
  if (_signatureFontBytesCache.has(fontId)) {
    return _signatureFontBytesCache.get(fontId)!;
  }
  if (_signatureFontLoadPromises.has(fontId)) {
    return _signatureFontLoadPromises.get(fontId)!;
  }

  const fontDef = SIGNATURE_FONTS.find(f => f.id === fontId);
  if (!fontDef) return null;

  const promise = (async () => {
    try {
      const resp = await fetch(fontDef.ttfUrl, { signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      _signatureFontBytesCache.set(fontId, buf);
      console.log(`[PDF] Signature font loaded: ${fontId} (${buf.length} bytes)`);
      return buf;
    } catch (e) {
      console.warn(`[PDF] Failed to load signature font "${fontId}":`, e);
      return null;
    }
  })();

  _signatureFontLoadPromises.set(fontId, promise);
  return promise;
}

/** @internal For testing only — clears signature font load cache to enable deterministic unit tests */
export function _resetSignatureFontCacheForTest(): void {
  _signatureFontBytesCache.clear();
  _signatureFontLoadPromises.clear();
}

export type SignatureField = {
  id: string;
  page: number;       // 0-indexed page number
  x: number;          // percentage from left (0-100)
  y: number;          // percentage from top (0-100)
  width: number;      // percentage of page width
  height: number;     // percentage of page height
  signerIndex: number; // which signer (0-based) this field belongs to
  type: "signature" | "date" | "name" | "initials" | "stamp";
  label?: string;
};

export type SignatureData = {
  fieldId: string;
  signerName: string;
  signatureDataUrl?: string; // base64 PNG of drawn signature
  signatureFont?: string;    // font-based signature
  stampDataUrl?: string;     // base64 PNG of stamp (hanko) image
  signedAt: Date;
};

/** Audit trail entry for completion certificate */
export type AuditEntry = {
  signerName: string;
  signerEmail: string;
  ipAddress: string | null;
  userAgent: string | null;
  signedAt: Date;
  action: string;
  /** If this signer was delegated, the original signer's email */
  delegatedFromEmail?: string | null;
};

/**
 * Helper: safely draw text on a PDF page with error handling.
 * If the primary font fails (e.g., missing glyph), falls back to Helvetica.
 * If Helvetica also fails, logs the error and skips the text.
 */
function safeDrawText(
  page: ReturnType<PDFDocument["getPages"]>[0],
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: any;
    fallbackFont: any;
    color: ReturnType<typeof rgb>;
  }
) {
  const { x, y, size, font, fallbackFont, color } = options;
  try {
    page.drawText(text, { x, y, size, font, color });
  } catch (primaryErr) {
    console.warn(`[PDF] Primary font failed for text "${text.substring(0, 20)}...", trying fallback:`, primaryErr);
    try {
      // Try with fallback font (Helvetica) - may not render CJK but won't crash
      page.drawText(text, { x, y, size, font: fallbackFont, color });
    } catch (fallbackErr) {
      console.error(`[PDF] Both fonts failed for text "${text.substring(0, 20)}...":`, fallbackErr);
      // Last resort: try to draw just ASCII characters
      try {
        const asciiOnly = text.replace(/[^\x20-\x7E]/g, "?");
        page.drawText(asciiOnly, { x, y, size, font: fallbackFont, color });
      } catch {
        console.error(`[PDF] Cannot draw text at all, skipping: "${text.substring(0, 30)}"`);
      }
    }
  }
}

/**
 * Helper: safely measure text width with error handling
 */
function safeTextWidth(font: any, text: string, size: number, fallbackFont: any): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    try {
      return fallbackFont.widthOfTextAtSize(text, size);
    } catch {
      return text.length * size * 0.5; // rough estimate
    }
  }
}

/**
 * Validate that a file is a valid PDF
 */
export async function validatePdf(buffer: Buffer): Promise<{ valid: boolean; pageCount: number; error?: string }> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    return { valid: true, pageCount };
  } catch (e) {
    return { valid: false, pageCount: 0, error: "有効なPDFファイルではありません" };
  }
}

/**
 * Get PDF page count from a URL
 */
export async function getPdfPageCount(url: string): Promise<number> {
  try {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch {
    return 0;
  }
}

/**
 * Embed signatures into a PDF and return the signed PDF buffer.
 * This function does NOT apply permission lock - that should be done
 * as the final step after appendCompletionCertificate.
 */
export async function embedSignaturesIntoPdf(
  pdfUrl: string,
  signatureFields: SignatureField[],
  signatures: SignatureData[]
): Promise<Buffer> {
  // Ensure font is loaded before processing
  await loadJapaneseFontBytes();

  // Fetch original PDF
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
  }
  const pdfBytes = Buffer.from(await response.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // Register fontkit for custom font support
  pdfDoc.registerFontkit(fontkit);

  const pages = pdfDoc.getPages();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Embed Japanese font for text that may contain CJK characters
  // CRITICAL: Must use Japanese font for ALL text rendering to prevent glyph loss
  let japaneseFont: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  try {
    const fontBytes = getJapaneseFontBytes();
    japaneseFont = await pdfDoc.embedFont(fontBytes, { subset: false });
    console.log(`[PDF] Japanese font embedded successfully for signature rendering (subset:false, ${fontBytes.length} bytes)`);
  } catch (e) {
    // Do NOT silently fall back to Helvetica - it causes glyph loss for numbers/symbols
    console.error("[PDF] CRITICAL: Failed to embed Japanese font for signatures:", e);
    // Try one more time with async loader
    try {
      const fontBytes = await loadJapaneseFontBytes();
      japaneseFont = await pdfDoc.embedFont(fontBytes, { subset: false });
      console.log(`[PDF] Japanese font embedded on retry (subset:false, ${fontBytes.length} bytes)`);
    } catch (retryErr) {
      console.error("[PDF] FATAL: Cannot embed Japanese font after retry:", retryErr);
      throw new Error("Japanese font embedding failed after retry. Cannot generate PDF with correct text rendering.");
    }
  }

  console.log(`[PDF] Processing ${signatures.length} signature entries across ${signatureFields.length} fields`);

  for (const sig of signatures) {
    const field = signatureFields.find(f => f.id === sig.fieldId);
    if (!field) {
      console.warn(`[PDF] Field not found for signature fieldId=${sig.fieldId}, skipping`);
      continue;
    }

    const page = pages[field.page];
    if (!page) {
      console.warn(`[PDF] Page ${field.page} not found, skipping field ${field.id}`);
      continue;
    }

    console.log(`[PDF] Rendering field: type=${field.type}, id=${field.id}, signerName=${sig.signerName}, page=${field.page}`);

    // Use CropBox if available (matches what pdfjs-dist renders), otherwise MediaBox
    const mediaBox = page.getSize();
    let pageWidth = mediaBox.width;
    let pageHeight = mediaBox.height;
    let offsetX = 0;
    let offsetY = 0;

    try {
      const cropBoxKey = PDFName.of('CropBox');
      const cropBoxObj = page.node.get(cropBoxKey);
      if (cropBoxObj) {
        const cropBox = page.node.lookup(cropBoxObj as any) as any;
        if (cropBox && typeof cropBox.get === 'function') {
          const llx = (cropBox.get(0) as any)?.asNumber?.() ?? 0;
          const lly = (cropBox.get(1) as any)?.asNumber?.() ?? 0;
          const urx = (cropBox.get(2) as any)?.asNumber?.() ?? pageWidth;
          const ury = (cropBox.get(3) as any)?.asNumber?.() ?? pageHeight;
          pageWidth = urx - llx;
          pageHeight = ury - lly;
          offsetX = llx;
          offsetY = lly;
        }
      }
    } catch { /* no CropBox, use MediaBox */ }

    // Read page rotation and apply rotation-aware coordinate transform.
    // pdfjs-dist (client) auto-applies /Rotate via getViewport(), but pdf-lib's
    // page.getSize() returns raw MediaBox dimensions ignoring /Rotate.
    // We must invert the rotation to map visual % positions back to raw PDF coords.
    let rotation = 0;
    try {
      const angle = page.getRotation().angle;
      if ([0, 90, 180, 270].includes(angle)) rotation = angle;
    } catch { /* default to 0° */ }
    if (rotation !== 0) {
      console.log(`[PDF] Page rotation: ${rotation}°`);
    }

    let x: number, y: number, fieldWidth: number, fieldHeight: number;

    if (rotation === 90) {
      // 90° CCW: pdfjs visual dimensions = (pageHeight × pageWidth)
      x = offsetX + pageWidth * (1 - (field.y + field.height) / 100);
      y = offsetY + pageHeight * (1 - (field.x + field.width) / 100);
      fieldWidth = (field.height / 100) * pageWidth;
      fieldHeight = (field.width / 100) * pageHeight;
    } else if (rotation === 180) {
      // 180°: same visual dimensions, both axes flipped
      // X is inverted: use right edge of field as origin
      // Y: viewer top maps to raw bottom, so raw y = field.y% * H (visual top is raw bottom anchor)
      x = offsetX + pageWidth * (1 - (field.x + field.width) / 100);
      y = offsetY + (field.y / 100) * pageHeight;
      fieldWidth = (field.width / 100) * pageWidth;
      fieldHeight = (field.height / 100) * pageHeight;
    } else if (rotation === 270) {
      // 270° CW: pdfjs visual dimensions = (pageHeight × pageWidth)
      x = offsetX + (field.y / 100) * pageWidth;
      y = offsetY + (field.x / 100) * pageHeight;
      fieldWidth = (field.height / 100) * pageWidth;
      fieldHeight = (field.width / 100) * pageHeight;
    } else {
      // 0° (default)
      x = offsetX + (field.x / 100) * pageWidth;
      y = offsetY + pageHeight - ((field.y / 100) * pageHeight) - ((field.height / 100) * pageHeight);
      fieldWidth = (field.width / 100) * pageWidth;
      fieldHeight = (field.height / 100) * pageHeight;
    }

    // ===== TYPE-BASED RENDERING =====
    // Each field type renders ONLY its appropriate content.

    try {
      if (field.type === "stamp") {
        // STAMP: Render hanko/stamp image only
        if (sig.stampDataUrl && sig.stampDataUrl.startsWith("data:image/png")) {
          try {
            const base64Data = sig.stampDataUrl.split(",")[1];
            if (base64Data) {
              const imgBytes = Buffer.from(base64Data, "base64");
              const pngImage = await pdfDoc.embedPng(imgBytes);
              const scaledDims = pngImage.scaleToFit(fieldWidth, fieldHeight);
              page.drawImage(pngImage, {
                x: x + (fieldWidth - scaledDims.width) / 2,
                y: y + (fieldHeight - scaledDims.height) / 2,
                width: scaledDims.width,
                height: scaledDims.height,
              });
              console.log(`[PDF] Stamp image rendered at (${x.toFixed(1)}, ${y.toFixed(1)})`);
            }
          } catch (e) {
            console.warn("[PDF] Failed to embed stamp image:", e);
          }
        }
      } else if (field.type === "signature") {
        // SIGNATURE: Always prefer PNG image when available.
        // Rationale: PNG is rendered by the browser with correct font fallback (CJK/Latin both work).
        // Latin-only fonts (Dancing Script etc.) don't throw on missing CJK glyphs — they silently
        // render .notdef glyphs (X/□), so exception-based fallback is insufficient.
        if (sig.signatureDataUrl && sig.signatureDataUrl.startsWith("data:image/png")) {
          try {
            const base64Data = sig.signatureDataUrl.split(",")[1];
            if (base64Data) {
              const imgBytes = Buffer.from(base64Data, "base64");
              const pngImage = await pdfDoc.embedPng(imgBytes);
              const scaledDims = pngImage.scaleToFit(fieldWidth, fieldHeight);
              page.drawImage(pngImage, {
                x: x + (fieldWidth - scaledDims.width) / 2,
                y: y + (fieldHeight - scaledDims.height) / 2,
                width: scaledDims.width,
                height: scaledDims.height,
              });
              console.log(`[PDF] Signature image rendered at (${x.toFixed(1)}, ${y.toFixed(1)})`);
            }
          } catch (e) {
            console.warn("[PDF] Failed to embed signature image, falling back to text:", e);
            safeDrawText(page, sig.signerName, {
              x: x + 5,
              y: y + fieldHeight / 2 - 6,
              size: Math.min(14, fieldHeight * 0.6),
              font: japaneseFont,
              fallbackFont: helveticaFont,
              color: rgb(0, 0, 0.6),
            });
          }
        } else if (sig.signatureFont) {
          // No PNG available: try font-based text rendering
          const fontSize = Math.min(16, fieldHeight * 0.6);
          try {
            const fontBytes = await loadSignatureFontBytes(sig.signatureFont);
            if (fontBytes) {
              const signatureFont = await pdfDoc.embedFont(fontBytes, { subset: false });
              safeDrawText(page, sig.signerName, {
                x: x + 5,
                y: y + fieldHeight / 2 - fontSize / 2,
                size: fontSize,
                font: signatureFont,
                fallbackFont: japaneseFont,
                color: rgb(0, 0, 0.6),
              });
              console.log(`[PDF] Text signature rendered: "${sig.signerName}" with font="${sig.signatureFont}" at (${x.toFixed(1)}, ${y.toFixed(1)})`);
            } else {
              safeDrawText(page, sig.signerName, {
                x: x + 5,
                y: y + fieldHeight / 2 - fontSize / 2,
                size: fontSize,
                font: japaneseFont,
                fallbackFont: helveticaFont,
                color: rgb(0, 0, 0.6),
              });
              console.log(`[PDF] Text signature rendered: "${sig.signerName}" with default font (font load returned null) at (${x.toFixed(1)}, ${y.toFixed(1)})`);
            }
          } catch (fontErr) {
            console.warn(`[PDF] Failed to embed signature font "${sig.signatureFont}", falling back to Japanese font:`, fontErr);
            safeDrawText(page, sig.signerName, {
              x: x + 5,
              y: y + fieldHeight / 2 - fontSize / 2,
              size: fontSize,
              font: japaneseFont,
              fallbackFont: helveticaFont,
              color: rgb(0, 0, 0.6),
            });
          }
        } else {
          // No PNG and no signatureFont: render with Japanese font
          const fontSize = Math.min(16, fieldHeight * 0.6);
          safeDrawText(page, sig.signerName, {
            x: x + 5,
            y: y + fieldHeight / 2 - fontSize / 2,
            size: fontSize,
            font: japaneseFont,
            fallbackFont: helveticaFont,
            color: rgb(0, 0, 0.6),
          });
          console.log(`[PDF] Text signature rendered: "${sig.signerName}" with default font at (${x.toFixed(1)}, ${y.toFixed(1)})`);
        }
        // Add date below signature
        try {
          const dateStr = sig.signedAt instanceof Date
            ? sig.signedAt.toLocaleDateString("ja-JP", {
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit",
                timeZone: "Asia/Tokyo",
              })
            : new Date(sig.signedAt).toLocaleDateString("ja-JP", {
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit",
                timeZone: "Asia/Tokyo",
              });
          safeDrawText(page, dateStr, {
            x: x + 5,
            y: y + 2,
            size: 7,
            font: japaneseFont,
            fallbackFont: helveticaFont,
            color: rgb(0.4, 0.4, 0.4),
          });
        } catch (dateErr) {
          console.warn("[PDF] Failed to render date below signature:", dateErr);
        }
      } else if (field.type === "date") {
        // DATE: Render date text only (no signature image)
        const dateStr = sig.signedAt instanceof Date
          ? sig.signedAt.toLocaleDateString("ja-JP", {
              year: "numeric", month: "2-digit", day: "2-digit",
              timeZone: "Asia/Tokyo",
            })
          : new Date(sig.signedAt).toLocaleDateString("ja-JP", {
              year: "numeric", month: "2-digit", day: "2-digit",
              timeZone: "Asia/Tokyo",
            });
        const fontSize = Math.min(12, fieldHeight * 0.6);
        safeDrawText(page, dateStr, {
          x: x + 5,
          y: y + fieldHeight / 2 - fontSize / 2,
          size: fontSize,
          font: japaneseFont,
          fallbackFont: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(`[PDF] Date field rendered: "${dateStr}" at (${x.toFixed(1)}, ${y.toFixed(1)}), fontSize=${fontSize}`);
      } else if (field.type === "name") {
        // NAME: Render signer's name text only (no signature image)
        const fontSize = Math.min(12, fieldHeight * 0.6);
        safeDrawText(page, sig.signerName, {
          x: x + 5,
          y: y + fieldHeight / 2 - fontSize / 2,
          size: fontSize,
          font: japaneseFont,
          fallbackFont: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(`[PDF] Name field rendered: "${sig.signerName}" at (${x.toFixed(1)}, ${y.toFixed(1)}), fontSize=${fontSize}`);
      } else if (field.type === "initials") {
        // INITIALS: Render initials (first characters of name parts)
        const initials = sig.signerName
          .split(/[\s\u3000]+/) // split on spaces (including full-width)
          .filter(Boolean)
          .map(part => part.charAt(0))
          .join("");
        const displayText = initials || sig.signerName.charAt(0);
        const fontSize = Math.min(14, fieldHeight * 0.6);
        const textWidth = safeTextWidth(japaneseFont, displayText, fontSize, helveticaFont);
        safeDrawText(page, displayText, {
          x: x + (fieldWidth - textWidth) / 2,
          y: y + fieldHeight / 2 - fontSize / 2,
          size: fontSize,
          font: japaneseFont,
          fallbackFont: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(`[PDF] Initials field rendered: "${displayText}" at (${x.toFixed(1)}, ${y.toFixed(1)}), fontSize=${fontSize}`);
      }
    } catch (fieldErr) {
      console.error(`[PDF] CRITICAL: Failed to render field type=${field.type}, id=${field.id}:`, fieldErr);
    }
  }

  // Flatten the PDF to prevent editing in Acrobat:
  // 1. Remove all form fields (AcroForm) to prevent field editing
  const form = pdfDoc.getForm();
  try {
    const fields = form.getFields();
    for (const f of fields) {
      try { form.removeField(f); } catch { /* ignore */ }
    }
  } catch { /* no form fields */ }

  // 2. Remove all annotations (comments, links, etc.) from each page
  for (const page of pages) {
    try {
      const annotsKey = PDFName.of('Annots');
      if (page.node.get(annotsKey)) {
        page.node.delete(annotsKey);
      }
    } catch { /* no annotations */ }
  }

  // 3. Save with specific options to flatten content
  const signedPdfBytes = await pdfDoc.save({
    useObjectStreams: false,
  });

  // 4. Re-load and re-save to fully flatten all content streams
  const flatDoc = await PDFDocument.load(signedPdfBytes);
  flatDoc.setTitle(`Signed Document - ${new Date().toISOString()}`);
  flatDoc.setProducer('Hundredth Sign - Electronic Signature Platform');
  flatDoc.setCreator('Hundredth Sign');
  flatDoc.setModificationDate(new Date());

  const flattenedBytes = await flatDoc.save();
  return Buffer.from(flattenedBytes);
}

/**
 * Apply PDF permission restrictions using qpdf.
 * Sets modify=none (editing not allowed) while keeping print=full.
 * Uses 256-bit AES encryption with an empty user password (opens without password)
 * but a random owner password (prevents modification).
 * 
 * IMPORTANT: This must be the LAST step in the PDF pipeline, as the encryption
 * prevents subsequent PDFDocument.load() calls from working properly.
 */
export async function applyPdfPermissionLock(pdfBuffer: Buffer): Promise<{ buffer: Buffer; locked: boolean }> {
  const tmpDir = os.tmpdir();
  // Use crypto.randomUUID() to guarantee unique filenames even when
  // multiple requests hit the same millisecond on the same server.
  const uniqueId = crypto.randomUUID();
  const inputPath = path.join(tmpDir, `hundredth-sign-input-${uniqueId}.pdf`);
  const outputPath = path.join(tmpDir, `hundredth-sign-locked-${uniqueId}.pdf`);

  try {
    await writeFileAsync(inputPath, pdfBuffer);

    const ownerPassword = crypto.randomBytes(24).toString('base64');

    await execFileAsync('qpdf', [
      inputPath,
      '--encrypt', '', ownerPassword, '256',
      '--modify=none',
      '--print=full',
      '--extract=y',
      '--accessibility=y',
      '--',
      outputPath,
    ]);

    const lockedBuffer = await readFileAsync(outputPath);
    return { buffer: lockedBuffer, locked: true };
  } catch (e) {
    console.warn('[PDF] qpdf permission lock failed, returning unprotected PDF:', e);
    return { buffer: pdfBuffer, locked: false };
  } finally {
    try { await unlinkAsync(inputPath); } catch { /* ignore */ }
    try { await unlinkAsync(outputPath); } catch { /* ignore */ }
  }
}

/**
 * Helper: wrap text to fit within a given width, returning an array of lines.
 */
function wrapText(text: string, font: any, fallbackFont: any, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  // Split by explicit newlines first
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = safeTextWidth(font, testLine, fontSize, fallbackFont);
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines.length > 0 ? lines : [''];
}

/**
 * Generate a completion certificate page and append it to the PDF.
 * Records: document title, completion date, and for each signer:
 * name, email, IP address, User-Agent, and timestamp.
 */
export async function appendCompletionCertificate(
  pdfBytes: Buffer,
  documentTitle: string,
  auditEntries: AuditEntry[],
  options?: { completedAt?: Date; contentHash?: string },
): Promise<Buffer> {
  // Ensure font is loaded
  await loadJapaneseFontBytes();

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // Register fontkit for Japanese font support
  pdfDoc.registerFontkit(fontkit);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Embed Japanese font for CJK text
  // CRITICAL: Must use Japanese font for ALL text rendering to prevent glyph loss
  let japaneseFont: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  let japaneseFontBold: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  try {
    const fontBytes = getJapaneseFontBytes();
    japaneseFont = await pdfDoc.embedFont(fontBytes, { subset: false });
    japaneseFontBold = japaneseFont; // Use same font (no bold variant available)
    console.log(`[PDF] Japanese font embedded for completion certificate (subset:false, ${fontBytes.length} bytes)`);
  } catch (e) {
    console.error("[PDF] CRITICAL: Failed to embed Japanese font for certificate:", e);
    // Try one more time with async loader
    try {
      const fontBytes = await loadJapaneseFontBytes();
      japaneseFont = await pdfDoc.embedFont(fontBytes, { subset: false });
      japaneseFontBold = japaneseFont;
      console.log(`[PDF] Japanese font embedded on retry for certificate (subset:false, ${fontBytes.length} bytes)`);
    } catch (retryErr) {
      console.error("[PDF] FATAL: Cannot embed Japanese font for certificate after retry:", retryErr);
      throw new Error("Japanese font embedding failed for completion certificate. Cannot generate certificate with correct text rendering.");
    }
  }

  // A4 size in points
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const leftMargin = 50;
  const rightMargin = 50;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  const bottomMargin = 60;

  let certPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPos = pageHeight - 60;

  // Helper to check if we need a new page
  const ensureSpace = (needed: number) => {
    if (yPos - needed < bottomMargin) {
      certPage = pdfDoc.addPage([pageWidth, pageHeight]);
      yPos = pageHeight - 60;
    }
  };

  // Helper to draw text safely on the certificate
  const drawCertText = (text: string, x: number, y: number, size: number, font: any, color: ReturnType<typeof rgb>) => {
    safeDrawText(certPage, text, { x, y, size, font, fallbackFont: helvetica, color });
  };

  // ===== HEADER =====
  drawCertText("Completion Certificate", leftMargin, yPos, 18, helveticaBold, rgb(0.1, 0.1, 0.4));
  yPos -= 8;

  certPage.drawLine({
    start: { x: leftMargin, y: yPos },
    end: { x: leftMargin + contentWidth, y: yPos },
    thickness: 1.5,
    color: rgb(0.1, 0.1, 0.4),
  });
  yPos -= 30;

  // ===== DOCUMENT INFO =====
  const labelX = leftMargin;
  const valueX = leftMargin + 120;
  const labelColor = rgb(0.3, 0.3, 0.3);
  const valueColor = rgb(0, 0, 0);
  const infoFontSize = 10;
  const infoLineHeight = 20;

  // Document Title (may be long, wrap if needed)
  drawCertText("Document Title:", labelX, yPos, infoFontSize, helveticaBold, labelColor);
  const titleLines = wrapText(documentTitle, japaneseFont, helvetica, infoFontSize, contentWidth - 120);
  for (let i = 0; i < titleLines.length; i++) {
    drawCertText(titleLines[i], valueX, yPos - (i * 14), infoFontSize, japaneseFont, valueColor);
  }
  yPos -= infoLineHeight + (titleLines.length - 1) * 14;

  // Completion date — use the actual completion timestamp, not "now"
  const certDate = options?.completedAt ?? new Date();
  const completedAt = certDate.toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Asia/Tokyo",
  });
  drawCertText("Completed At:", labelX, yPos, infoFontSize, helveticaBold, labelColor);
  drawCertText(`${completedAt} (JST)`, valueX, yPos, infoFontSize, helvetica, valueColor);
  yPos -= infoLineHeight;

  // Document ID — use provided content hash or compute SHA-256 from PDF bytes
  const docHash = options?.contentHash
    ? options.contentHash.substring(0, 32).toUpperCase()
    : crypto.createHash("sha256").update(pdfBytes).digest("hex").substring(0, 32).toUpperCase();
  drawCertText("Signed Content Hash (pre-cert):", labelX, yPos, infoFontSize, helveticaBold, labelColor);
  yPos -= 14;
  drawCertText(docHash, valueX, yPos, infoFontSize, helvetica, valueColor);
  yPos -= 28;

  // ===== SIGNER DETAILS =====
  drawCertText("Signer Details", leftMargin, yPos, 14, helveticaBold, rgb(0.1, 0.1, 0.4));
  yPos -= 5;
  certPage.drawLine({
    start: { x: leftMargin, y: yPos },
    end: { x: leftMargin + contentWidth, y: yPos },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  yPos -= 20;

  for (let i = 0; i < auditEntries.length; i++) {
    const entry = auditEntries[i];

    // Calculate actual height needed for this signer box
    const ua = entry.userAgent
      ? (entry.userAgent.length > 120 ? entry.userAgent.substring(0, 117) + "..." : entry.userAgent)
      : "N/A";
    const uaFontSize = 8;
    const uaLineHeight = 11;
    // UA strings are ASCII — use helvetica for accurate width measurement
    const uaLines = wrapText(`UA: ${ua}`, helvetica, helvetica, uaFontSize, contentWidth - 24);

    const boxPadding = 12;
    const lineSpacing = 16;
    const headerBarHeight = 20; // "Signer N" header bar
    const dataLines = 4; // name, email, date, IP
    const uaHeight = uaLines.length * uaLineHeight;
    const boxContentHeight = headerBarHeight + (dataLines * lineSpacing) + uaHeight + 4;
    const boxTotalHeight = boxContentHeight + boxPadding * 2;

    // Check if we need a new page
    ensureSpace(boxTotalHeight + 20);

    const signedAtStr = entry.signedAt
      ? new Date(entry.signedAt).toLocaleString("ja-JP", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          timeZone: "Asia/Tokyo",
        })
      : "N/A";

    // Draw the background box
    const boxTop = yPos + 5;
    const boxBottom = boxTop - boxTotalHeight;
    certPage.drawRectangle({
      x: leftMargin,
      y: boxBottom,
      width: contentWidth,
      height: boxTotalHeight,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 0.5,
      color: rgb(0.97, 0.97, 0.97),
    });

    // Draw signer header bar (dark navy background)
    certPage.drawRectangle({
      x: leftMargin,
      y: boxTop - headerBarHeight,
      width: contentWidth,
      height: headerBarHeight,
      color: rgb(0.1, 0.1, 0.4),
    });

    // Draw signer content
    const infoX = leftMargin + boxPadding;
    // textY starts at center of header bar
    let textY = boxTop - headerBarHeight + 5;

    drawCertText(`Signer ${i + 1}`, infoX, textY, 10, helveticaBold, rgb(1, 1, 1));
    textY -= headerBarHeight + 2;

    // Name (with delegation info if applicable)
    const nameLabel = entry.delegatedFromEmail
      ? `Name: ${entry.signerName} (delegated from: ${entry.delegatedFromEmail})`
      : `Name: ${entry.signerName}`;
    drawCertText(nameLabel, infoX, textY, 10, japaneseFont, rgb(0, 0, 0));
    textY -= lineSpacing;

    // Email
    drawCertText(`Email: ${entry.signerEmail}`, infoX, textY, 9, helvetica, rgb(0.3, 0.3, 0.3));
    textY -= lineSpacing;

    // Signed at
    drawCertText(`Signed At: ${signedAtStr} (JST)`, infoX, textY, 9, helvetica, rgb(0.3, 0.3, 0.3));
    textY -= lineSpacing;

    // IP Address
    drawCertText(`IP Address: ${entry.ipAddress || "N/A"}`, infoX, textY, 9, helvetica, rgb(0.3, 0.3, 0.3));
    textY -= 14;

    // User-Agent (wrapped) - use japaneseFont as primary since UA text may contain Japanese fallback text
    for (const uaLine of uaLines) {
      safeDrawText(certPage, uaLine, {
        x: infoX, y: textY, size: uaFontSize,
        font: helvetica, fallbackFont: japaneseFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      textY -= uaLineHeight;
    }

    // Move yPos below the box with spacing
    yPos = boxBottom - 15;
  }

  // ===== FOOTER =====
  ensureSpace(60);
  yPos -= 10;
  certPage.drawLine({
    start: { x: leftMargin, y: yPos },
    end: { x: leftMargin + contentWidth, y: yPos },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  yPos -= 18;
  drawCertText(
    "This certificate was automatically generated by the Hundredth Sign e-signature platform.",
    leftMargin, yPos, 8, helvetica, rgb(0.5, 0.5, 0.5)
  );
  yPos -= 14;
  drawCertText(
    "Document integrity can be verified using SHA-256 hash.",
    leftMargin, yPos, 8, helvetica, rgb(0.5, 0.5, 0.5)
  );
  yPos -= 14;
  drawCertText(
    `Generated: ${completedAt} (JST) | Platform: Hundredth Sign`,
    leftMargin, yPos, 8, helvetica, rgb(0.5, 0.5, 0.5)
  );

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}

/**
 * Generate signed PDF and upload to S3
 */
export async function generateSignedPdf(
  documentId: number,
  userId: number,
  pdfUrl: string,
  signatureFields: SignatureField[],
  signatures: SignatureData[]
): Promise<{ url: string; key: string }> {
  const signedBuffer = await embedSignaturesIntoPdf(pdfUrl, signatureFields, signatures);
  const fileKey = `signed/${userId}/${documentId}-signed-${Date.now()}.pdf`;
  const { url } = await storagePut(fileKey, signedBuffer, "application/pdf");
  return { url, key: fileKey };
}
