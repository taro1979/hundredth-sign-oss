/**
 * Additional branch coverage tests for pdf.ts
 * Targets specific uncovered branches: CropBox fallback, font retry failure,
 * safeDrawText failure, initials fallback, field error, wrapText paths,
 * applyPdfPermissionLock success, and appendCompletionCertificate page break.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SignatureField, SignatureData } from "./pdf";

// ─── Shared mocks ───────────────────────────────────────────────
let mockDrawText: ReturnType<typeof vi.fn>;
let mockDrawImage: ReturnType<typeof vi.fn>;
const mockGetPageCount = vi.fn(() => 3);
const mockGetPages = vi.fn(() => {
  mockDrawText = vi.fn();
  mockDrawImage = vi.fn();
  return [
    {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: mockDrawImage,
      drawText: mockDrawText,
      node: {
        get: vi.fn(() => null),
        lookup: vi.fn(),
        delete: vi.fn(),
      },
    },
  ];
});
const mockEmbedFont = vi.fn(() => ({
  widthOfTextAtSize: vi.fn(() => 50),
}));
const mockEmbedPng = vi.fn(() => ({
  scaleToFit: vi.fn(() => ({ width: 100, height: 50 })),
}));
const mockGetForm = vi.fn(() => ({
  getFields: vi.fn(() => []),
  removeField: vi.fn(),
}));
const mockSave = vi.fn(() => new Uint8Array([37, 80, 68, 70]));
const mockAddPage = vi.fn(() => ({
  drawText: vi.fn(),
  drawLine: vi.fn(),
  drawRectangle: vi.fn(),
  getSize: () => ({ width: 595.28, height: 841.89 }),
}));

vi.mock("pdf-lib", () => ({
  PDFDocument: {
    load: vi.fn(() => ({
      getPageCount: mockGetPageCount,
      getPages: mockGetPages,
      embedFont: mockEmbedFont,
      embedPng: mockEmbedPng,
      getForm: mockGetForm,
      save: mockSave,
      setTitle: vi.fn(),
      setProducer: vi.fn(),
      setCreator: vi.fn(),
      setModificationDate: vi.fn(),
      registerFontkit: vi.fn(),
      addPage: mockAddPage,
    })),
  },
  PDFName: { of: vi.fn((name: string) => name) },
  rgb: vi.fn((r: number, g: number, b: number) => ({ r, g, b })),
  StandardFonts: { Helvetica: "Helvetica", HelveticaBold: "HelveticaBold" },
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(() => ({ url: "https://storage.example.com/signed.pdf", key: "signed.pdf" })),
}));

// Mock child_process for applyPdfPermissionLock
vi.mock("child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: Function) => {
    // Default: simulate qpdf success by writing output file
    const fs = require("fs");
    const args = _args as string[];
    const outputPath = args[args.length - 1];
    try {
      fs.writeFileSync(outputPath, Buffer.from("%PDF-1.4 locked"));
    } catch {}
    cb(null, "", "");
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
  });
  mockEmbedFont.mockImplementation(() => ({
    widthOfTextAtSize: vi.fn(() => 50),
  }));
});

// ─── Tests ──────────────────────────────────────────────────────

describe("pdf.ts branch coverage - CropBox asNumber fallback", () => {
  it("uses fallback values when CropBox entries lack asNumber", async () => {
    // CropBox.get() returns objects WITHOUT asNumber function -> triggers ?? fallback
    const cropBoxArray = {
      get: vi.fn((_idx: number) => {
        // Return objects without asNumber - triggers ?? 0 / ?? pageWidth / ?? pageHeight
        return {};
      }),
    };
    const drawText = vi.fn();
    const pageWithBadCropBox = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(),
      drawText,
      node: {
        get: vi.fn((key: string) => {
          if (key === "CropBox") return "cropbox-ref";
          return null;
        }),
        lookup: vi.fn(() => cropBoxArray),
        delete: vi.fn(),
      },
    };
    mockGetPages.mockReturnValueOnce([pageWithBadCropBox]);

    const { embedSignaturesIntoPdf } = await import("./pdf");
    const field: SignatureField = {
      id: "f1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const sigs: SignatureData[] = [{
      fieldId: "f1", signerName: "Test", signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], sigs);
    expect(result).toBeInstanceOf(Buffer);
  });

  it("catches CropBox processing error", async () => {
    // CropBox lookup throws -> triggers catch { /* no CropBox, use MediaBox */ }
    const drawText = vi.fn();
    const pageWithThrowingCropBox = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(),
      drawText,
      node: {
        get: vi.fn((key: string) => {
          if (key === "CropBox") return "cropbox-ref";
          return null;
        }),
        lookup: vi.fn(() => { throw new Error("CropBox parse error"); }),
        delete: vi.fn(),
      },
    };
    mockGetPages.mockReturnValueOnce([pageWithThrowingCropBox]);

    const { embedSignaturesIntoPdf } = await import("./pdf");
    const field: SignatureField = {
      id: "f1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const sigs: SignatureData[] = [{
      fieldId: "f1", signerName: "Test", signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], sigs);
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("pdf.ts branch coverage - font retry failure in embedSignaturesIntoPdf", () => {
  it("throws error when both initial and retry font embed fail", async () => {
    let callCount = 0;
    mockEmbedFont.mockImplementation(() => {
      callCount++;
      // Call 1: Helvetica succeeds
      if (callCount === 1) return { widthOfTextAtSize: vi.fn(() => 50) };
      // Call 2+: Japanese font fails (initial and retry)
      throw new Error("Font embed fail");
    });

    const { embedSignaturesIntoPdf } = await import("./pdf");
    const field: SignatureField = {
      id: "f1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "name",
    };
    const sigs: SignatureData[] = [{
      fieldId: "f1", signerName: "Test", signedAt: new Date("2024-01-01"),
    }];
    await expect(embedSignaturesIntoPdf("https://example.com/test.pdf", [field], sigs))
      .rejects.toThrow("Japanese font embedding failed after retry");
  });
});

describe("pdf.ts branch coverage - safeDrawText both fonts failing", () => {
  it("handles both primary and fallback font failures", async () => {
    const drawText = vi.fn(() => { throw new Error("Font render fail"); });
    const pageWithFailingDraw = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(),
      drawText,
      node: {
        get: vi.fn(() => null),
        lookup: vi.fn(),
        delete: vi.fn(),
      },
    };
    mockGetPages.mockReturnValueOnce([pageWithFailingDraw]);

    const { embedSignaturesIntoPdf } = await import("./pdf");
    const field: SignatureField = {
      id: "f1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "name",
    };
    const sigs: SignatureData[] = [{
      fieldId: "f1", signerName: "テスト太郎", signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], sigs);
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("pdf.ts branch coverage - initials with whitespace-only name", () => {
  it("falls back to charAt(0) when initials are empty", async () => {
    const { embedSignaturesIntoPdf } = await import("./pdf");
    const field: SignatureField = {
      id: "f1", page: 0, x: 50, y: 50, width: 10, height: 4, signerIndex: 0, type: "initials",
    };
    // Name with only spaces - split/filter produces empty array, initials = ""
    const sigs: SignatureData[] = [{
      fieldId: "f1", signerName: "   ", signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], sigs);
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("pdf.ts branch coverage - field processing error", () => {
  it("catches field processing error gracefully", async () => {
    // Make getPages return a page where drawText throws only on specific calls
    let drawCallCount = 0;
    const drawText = vi.fn(() => {
      drawCallCount++;
      // Throw on every call to trigger fieldErr catch
      throw new Error("Field render catastrophic fail");
    });
    const pageWithError = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(() => { throw new Error("Image fail"); }),
      drawText,
      node: {
        get: vi.fn(() => null),
        lookup: vi.fn(),
        delete: vi.fn(),
      },
    };
    mockGetPages.mockReturnValueOnce([pageWithError]);
    // Also make embedPng throw to ensure the signature field processing catches
    mockEmbedPng.mockRejectedValueOnce(new Error("PNG embed fail"));

    const { embedSignaturesIntoPdf } = await import("./pdf");
    const field: SignatureField = {
      id: "f1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const sigs: SignatureData[] = [{
      fieldId: "f1", signerName: "Test", signedAt: new Date("2024-01-01"),
      signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    }];
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], sigs);
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("pdf.ts branch coverage - applyPdfPermissionLock success path", () => {
  it("successfully applies permission lock via qpdf", async () => {
    const { applyPdfPermissionLock } = await import("./pdf");
    const result = await applyPdfPermissionLock(Buffer.from("%PDF-1.4 test content"));
    expect(result).toHaveProperty("buffer");
    expect(result).toHaveProperty("locked");
    expect(result.buffer).toBeInstanceOf(Buffer);
    // child_process mock writes output file, so qpdf "succeeds" → locked=true
    expect(result.locked).toBe(true);
  });
});

describe("pdf.ts branch coverage - appendCompletionCertificate", () => {
  it("triggers page break with many audit entries", async () => {
    const { appendCompletionCertificate } = await import("./pdf");
    const { PDFDocument: MockPDFDocument } = await import("pdf-lib");
    const mockPage = {
      drawText: vi.fn(),
      drawLine: vi.fn(),
      drawRectangle: vi.fn(),
      getSize: () => ({ width: 595.28, height: 841.89 }),
    };
    (MockPDFDocument.load as any).mockResolvedValueOnce({
      addPage: vi.fn(() => mockPage),
      embedFont: vi.fn(() => ({
        widthOfTextAtSize: vi.fn(() => 50),
      })),
      save: vi.fn(() => new Uint8Array([37, 80, 68, 70])),
      registerFontkit: vi.fn(),
    });

    // Create many audit entries to trigger page break
    const auditEntries: import("./pdf").AuditEntry[] = Array.from({ length: 10 }, (_, i) => ({
      signerName: `署名者${i + 1}`,
      signerEmail: `signer${i + 1}@example.com`,
      signedAt: new Date("2024-01-15T10:30:00Z"),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 very long user agent string that exceeds the limit",
    }));

    const result = await appendCompletionCertificate(
      Buffer.from("fake-pdf"),
      "非常に長い文書タイトル - テスト用の長いタイトルを設定して折り返しを確認する",
      auditEntries
    );
    expect(result).toBeInstanceOf(Buffer);
  });

  it("handles font retry success in certificate", async () => {
    const { appendCompletionCertificate } = await import("./pdf");
    const { PDFDocument: MockPDFDocument } = await import("pdf-lib");
    let fontCallCount = 0;
    (MockPDFDocument.load as any).mockResolvedValueOnce({
      addPage: vi.fn(() => ({
        drawText: vi.fn(),
        drawLine: vi.fn(),
        drawRectangle: vi.fn(),
        getSize: () => ({ width: 595.28, height: 841.89 }),
      })),
      embedFont: vi.fn(() => {
        fontCallCount++;
        // Calls 1-2: Helvetica, HelveticaBold succeed
        // Call 3: Japanese font fails (initial)
        // Call 4: Japanese font retry succeeds
        if (fontCallCount === 3) throw new Error("First CJK embed fail");
        return { widthOfTextAtSize: vi.fn(() => 50) };
      }),
      save: vi.fn(() => new Uint8Array([37, 80, 68, 70])),
      registerFontkit: vi.fn(),
    });

    const result = await appendCompletionCertificate(
      Buffer.from("fake-pdf"),
      "Test Document",
      [{ signerName: "Test", signerEmail: "test@example.com", signedAt: new Date(), ipAddress: "1.2.3.4", userAgent: "Test UA" }]
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("pdf.ts branch coverage - date rendering error in embedSignaturesIntoPdf", () => {
  it("catches date rendering error after signature", async () => {
    // Make drawText succeed for signature text but fail for date text
    let textCallCount = 0;
    const drawText = vi.fn(() => {
      textCallCount++;
      // First call succeeds (signature text), second call fails (date text)
      if (textCallCount >= 2) throw new Error("Date text render fail");
    });
    const page = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(),
      drawText,
      node: {
        get: vi.fn(() => null),
        lookup: vi.fn(),
        delete: vi.fn(),
      },
    };
    mockGetPages.mockReturnValueOnce([page]);

    const { embedSignaturesIntoPdf } = await import("./pdf");
    const field: SignatureField = {
      id: "f1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const sigs: SignatureData[] = [{
      fieldId: "f1", signerName: "Test User", signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], sigs);
    expect(result).toBeInstanceOf(Buffer);
  });
});
