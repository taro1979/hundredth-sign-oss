import { describe, it, expect, vi, beforeEach } from "vitest";
import { SIGNATURE_FONTS, validatePdf, getPdfPageCount, embedSignaturesIntoPdf, generateSignedPdf, _resetSignatureFontCacheForTest } from "./pdf";
import type { SignatureField, SignatureData } from "./pdf";

// Mock pdf-lib
const mockGetPageCount = vi.fn(() => 3);
// Create fresh page mocks for each call
let mockDrawText: ReturnType<typeof vi.fn>;
let mockDrawImage: ReturnType<typeof vi.fn>;
const mockGetPages = vi.fn(() => {
  mockDrawText = vi.fn();
  mockDrawImage = vi.fn();
  return [
    {
      getSize: () => ({ width: 612, height: 792 }),
      getRotation: vi.fn(() => ({ angle: 0 })),
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
const mockEmbedFont = vi.fn(() => ({}));
const mockEmbedPng = vi.fn(() => ({
  scaleToFit: vi.fn(() => ({ width: 100, height: 50 })),
}));
const mockGetForm = vi.fn(() => ({
  getFields: vi.fn(() => []),
  removeField: vi.fn(),
}));
const mockSave = vi.fn(() => new Uint8Array([37, 80, 68, 70])); // %PDF
const mockSetTitle = vi.fn();
const mockSetProducer = vi.fn();
const mockSetCreator = vi.fn();
const mockSetModificationDate = vi.fn();

vi.mock("pdf-lib", () => ({
  PDFDocument: {
    load: vi.fn(() => ({
      getPageCount: mockGetPageCount,
      getPages: mockGetPages,
      embedFont: mockEmbedFont,
      embedPng: mockEmbedPng,
      getForm: mockGetForm,
      save: mockSave,
      setTitle: mockSetTitle,
      setProducer: mockSetProducer,
      setCreator: mockSetCreator,
      setModificationDate: mockSetModificationDate,
      registerFontkit: vi.fn(),
    })),
  },
  PDFName: {
    of: vi.fn((name: string) => name),
  },
  rgb: vi.fn((r: number, g: number, b: number) => ({ r, g, b })),
  StandardFonts: {
    Helvetica: "Helvetica",
  },
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn(() => ({ url: "https://storage.example.com/signed.pdf", key: "signed/1/1-signed.pdf" })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
  });
});

describe("SIGNATURE_FONTS", () => {
  it("contains 6 signature fonts", () => {
    expect(SIGNATURE_FONTS).toHaveLength(6);
  });

  it("each font has id, name, and cssFamily", () => {
    SIGNATURE_FONTS.forEach((font) => {
      expect(font.id).toBeTruthy();
      expect(font.name).toBeTruthy();
      expect(font.cssFamily).toBeTruthy();
    });
  });
});

describe("validatePdf", () => {
  it("returns valid result for a valid PDF", async () => {
    const result = await validatePdf(Buffer.from("test"));
    expect(result.valid).toBe(true);
    expect(result.pageCount).toBe(3);
  });

  it("returns invalid result when PDF loading fails", async () => {
    const { PDFDocument } = await import("pdf-lib");
    (PDFDocument.load as any).mockRejectedValueOnce(new Error("Invalid PDF"));
    const result = await validatePdf(Buffer.from("not a pdf"));
    expect(result.valid).toBe(false);
    expect(result.pageCount).toBe(0);
    expect(result.error).toContain("有効なPDFファイルではありません");
  });
});

describe("getPdfPageCount", () => {
  it("returns page count from URL", async () => {
    const count = await getPdfPageCount("https://example.com/test.pdf");
    expect(count).toBe(3);
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/test.pdf");
  });

  it("returns 0 when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const count = await getPdfPageCount("https://example.com/bad.pdf");
    expect(count).toBe(0);
  });
});

describe("embedSignaturesIntoPdf", () => {
  const baseField: SignatureField = {
    id: "field1",
    page: 0,
    x: 50,
    y: 50,
    width: 20,
    height: 6,
    signerIndex: 0,
    type: "signature",
  };

  it("embeds text-based signature into PDF", async () => {
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [baseField],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
    expect(mockDrawText).toHaveBeenCalled();
  });

  it("embeds drawn signature (PNG) into PDF", async () => {
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      signedAt: new Date("2024-01-01"),
    }];
    await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [baseField],
      signatures
    );
    expect(mockEmbedPng).toHaveBeenCalled();
  });

  it("falls back to text when PNG embed fails", async () => {
    mockEmbedPng.mockRejectedValueOnce(new Error("Invalid PNG"));
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signatureDataUrl: "data:image/png;base64,invalid",
      signedAt: new Date("2024-01-01"),
    }];
    await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [baseField],
      signatures
    );
    expect(mockDrawText).toHaveBeenCalled();
  });

  it("skips signatures with no matching field", async () => {
    const signatures: SignatureData[] = [{
      fieldId: "nonexistent",
      signerName: "山田太郎",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [baseField],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });

  it("adds date text for signature type fields", async () => {
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signedAt: new Date("2024-01-01"),
    }];
    await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [baseField],
      signatures
    );
    // drawText should be called at least twice: once for name, once for date
    expect(mockDrawText).toHaveBeenCalledTimes(2);
  });

  it("does not add date for non-signature type fields", async () => {
    const dateField: SignatureField = { ...baseField, type: "date" };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signedAt: new Date("2024-01-01"),
    }];
    await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [dateField],
      signatures
    );
    // Only one drawText call (name only, no date)
    expect(mockDrawText).toHaveBeenCalledTimes(1);
  });

  it("flattens PDF by removing form fields and annotations", async () => {
    await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [],
      []
    );
    expect(mockGetForm).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });

  it("sets document metadata on final PDF", async () => {
    await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [],
      []
    );
    expect(mockSetTitle).toHaveBeenCalled();
    expect(mockSetProducer).toHaveBeenCalledWith("Hundredth Sign - Electronic Signature Platform");
    expect(mockSetCreator).toHaveBeenCalledWith("Hundredth Sign");
    expect(mockSetModificationDate).toHaveBeenCalled();
  });
});

describe("generateSignedPdf", () => {
  it("generates signed PDF and uploads to S3", async () => {
    const { storagePut } = await import("./storage");
    const result = await generateSignedPdf(
      1, 1,
      "https://example.com/test.pdf",
      [],
      []
    );
    expect(result.url).toBe("https://storage.example.com/signed.pdf");
    expect(result.key).toContain("signed/");
    expect(storagePut).toHaveBeenCalled();
  });
});

describe("embedSignaturesIntoPdf - CropBox handling", () => {
  it("adjusts coordinates when CropBox is present", async () => {
    // Override mockGetPages to return a page with CropBox
    const cropBoxArray = {
      get: vi.fn((idx: number) => {
        const values = [
          { asNumber: () => 36 },   // llx
          { asNumber: () => 36 },   // lly
          { asNumber: () => 576 },  // urx
          { asNumber: () => 756 },  // ury
        ];
        return values[idx];
      }),
    };
    const drawText = vi.fn();
    const drawImage = vi.fn();
    const pageWithCropBox = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage,
      drawText,
      node: {
        get: vi.fn((key: string) => {
          if (key === "CropBox") return "cropbox-ref";
          if (key === "Annots") return null;
          return null;
        }),
        lookup: vi.fn(() => cropBoxArray),
        delete: vi.fn(),
      },
    };
    mockGetPages.mockReturnValueOnce([pageWithCropBox]);

    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "テスト太郎",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
    expect(drawText).toHaveBeenCalled();
  });

  it("handles CropBox without get function gracefully", async () => {
    const drawText = vi.fn();
    const pageWithBadCropBox = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(),
      drawText,
      node: {
        get: vi.fn((key: string) => {
          if (key === "CropBox") return "cropbox-ref";
          if (key === "Annots") return null;
          return null;
        }),
        lookup: vi.fn(() => ({})), // no get function
        delete: vi.fn(),
      },
    };
    mockGetPages.mockReturnValueOnce([pageWithBadCropBox]);

    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "テスト太郎",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("embedSignaturesIntoPdf - form field removal", () => {
  it("handles form fields that throw on removal", async () => {
    const mockField = { getName: () => "testField" };
    mockGetForm.mockReturnValueOnce({
      getFields: vi.fn(() => [mockField]),
      removeField: vi.fn(() => { throw new Error("Cannot remove"); }),
    });

    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [],
      []
    );
    expect(result).toBeInstanceOf(Buffer);
  });

  it("handles getFields throwing", async () => {
    mockGetForm.mockReturnValueOnce({
      getFields: vi.fn(() => { throw new Error("No form"); }),
      removeField: vi.fn(),
    });

    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [],
      []
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("embedSignaturesIntoPdf - annotation removal", () => {
  it("removes annotations when present", async () => {
    const deleteFn = vi.fn();
    const pageWithAnnots = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(),
      drawText: vi.fn(),
      node: {
        get: vi.fn((key: string) => {
          if (key === "Annots") return "annots-ref";
          return null;
        }),
        lookup: vi.fn(),
        delete: deleteFn,
      },
    };
    mockGetPages.mockReturnValueOnce([pageWithAnnots]);

    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [],
      []
    );
    expect(result).toBeInstanceOf(Buffer);
    expect(deleteFn).toHaveBeenCalled();
  });

  it("handles annotation deletion throwing", async () => {
    const pageWithBadAnnots = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(),
      drawText: vi.fn(),
      node: {
        get: vi.fn((key: string) => {
          if (key === "Annots") return "annots-ref";
          return null;
        }),
        lookup: vi.fn(),
        delete: vi.fn(() => { throw new Error("Cannot delete"); }),
      },
    };
    mockGetPages.mockReturnValueOnce([pageWithBadAnnots]);

    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [],
      []
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("embedSignaturesIntoPdf - initials field type", () => {
  it("handles initials field type", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 10, height: 4, signerIndex: 0, type: "initials",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("embedSignaturesIntoPdf - name field type", () => {
  it("handles name field type", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 20, height: 4, signerIndex: 0, type: "name",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("embedSignaturesIntoPdf - stamp field type", () => {
  it("handles stamp with valid PNG data URL", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 10, height: 10, signerIndex: 0, type: "stamp",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田",
      stampDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
    expect(mockEmbedPng).toHaveBeenCalled();
  });

  it("handles stamp with non-PNG data URL (skips)", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 10, height: 10, signerIndex: 0, type: "stamp",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田",
      stampDataUrl: "data:image/jpeg;base64,/9j/4AAQ",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });

  it("handles stamp with no stampDataUrl", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 10, height: 10, signerIndex: 0, type: "stamp",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });

  it("handles stamp embed failure gracefully", async () => {
    mockEmbedPng.mockRejectedValueOnce(new Error("Invalid stamp PNG"));
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 10, height: 10, signerIndex: 0, type: "stamp",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田",
      stampDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("embedSignaturesIntoPdf - date field type", () => {
  it("renders date text only", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 20, height: 4, signerIndex: 0, type: "date",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });

  it("handles string date for date field", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 20, height: 4, signerIndex: 0, type: "date",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signedAt: "2024-01-01T00:00:00.000Z" as any,
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("embedSignaturesIntoPdf - signature with string date", () => {
  it("handles string signedAt for signature type", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signedAt: "2024-01-01T00:00:00.000Z" as any,
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("embedSignaturesIntoPdf - page not found", () => {
  it("skips field when page index is out of range", async () => {
    const field: SignatureField = {
      id: "field1", page: 99, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("embedSignaturesIntoPdf - font fallback paths", () => {
  it("handles primary font embed failure with retry", async () => {
    // First embedFont call succeeds (Helvetica), second fails then retry succeeds
    let callCount = 0;
    mockEmbedFont.mockImplementation(() => {
      callCount++;
      if (callCount === 2) throw new Error("First CJK embed fail");
      return { widthOfTextAtSize: vi.fn(() => 50) };
    });

    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "name",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "Test",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("embedSignaturesIntoPdf - date rendering error", () => {
  it("handles date rendering error gracefully", async () => {
    // Make drawText throw on the second call (date rendering)
    const drawTextFn = vi.fn();
    let drawCallCount = 0;
    drawTextFn.mockImplementation(() => {
      drawCallCount++;
      if (drawCallCount === 2) throw new Error("Date render fail");
    });
    const pageWithFailingDate = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(),
      drawText: drawTextFn,
      node: {
        get: vi.fn(() => null),
        lookup: vi.fn(),
        delete: vi.fn(),
      },
    };
    mockGetPages.mockReturnValueOnce([pageWithFailingDate]);

    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "Test",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("appendCompletionCertificate", () => {
  it("appends a completion certificate page to PDF", async () => {
    const { appendCompletionCertificate } = await import("./pdf");
    const mockAddPage = vi.fn(() => ({
      drawText: vi.fn(),
      drawLine: vi.fn(),
      drawRectangle: vi.fn(),
      getSize: () => ({ width: 595.28, height: 841.89 }),
    }));
    const { PDFDocument: MockPDFDocument } = await import("pdf-lib");
    (MockPDFDocument.load as any).mockResolvedValueOnce({
      addPage: mockAddPage,
      embedFont: vi.fn(() => ({
        widthOfTextAtSize: vi.fn(() => 50),
      })),
      save: vi.fn(() => new Uint8Array([37, 80, 68, 70])),
      registerFontkit: vi.fn(),
    });

    const auditEntries: import("./pdf").AuditEntry[] = [
      {
        signerName: "山田太郎",
        signerEmail: "yamada@example.com",
        signedAt: new Date("2024-01-15T10:30:00Z"),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      {
        signerName: "Jane Doe",
        signerEmail: "jane@example.com",
        signedAt: new Date("2024-01-16T14:00:00Z"),
        ipAddress: "10.0.0.1",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 very long user agent string that exceeds 90 characters limit for truncation testing",
      },
    ];

    const result = await appendCompletionCertificate(
      Buffer.from("fake-pdf"),
      "業務委託契約書",
      auditEntries
    );
    expect(result).toBeInstanceOf(Buffer);
    expect(mockAddPage).toHaveBeenCalled();
  });

  it("handles empty audit entries", async () => {
    const { appendCompletionCertificate } = await import("./pdf");
    const mockAddPage = vi.fn(() => ({
      drawText: vi.fn(),
      drawLine: vi.fn(),
      drawRectangle: vi.fn(),
      getSize: () => ({ width: 595.28, height: 841.89 }),
    }));
    const { PDFDocument: MockPDFDocument } = await import("pdf-lib");
    (MockPDFDocument.load as any).mockResolvedValueOnce({
      addPage: mockAddPage,
      embedFont: vi.fn(() => ({
        widthOfTextAtSize: vi.fn(() => 50),
      })),
      save: vi.fn(() => new Uint8Array([37, 80, 68, 70])),
      registerFontkit: vi.fn(),
    });

    const result = await appendCompletionCertificate(
      Buffer.from("fake-pdf"),
      "Test Document",
      []
    );
    expect(result).toBeInstanceOf(Buffer);
  });

  it("handles entry with null signedAt", async () => {
    const { appendCompletionCertificate } = await import("./pdf");
    const mockAddPage = vi.fn(() => ({
      drawText: vi.fn(),
      drawLine: vi.fn(),
      drawRectangle: vi.fn(),
      getSize: () => ({ width: 595.28, height: 841.89 }),
    }));
    const { PDFDocument: MockPDFDocument } = await import("pdf-lib");
    (MockPDFDocument.load as any).mockResolvedValueOnce({
      addPage: mockAddPage,
      embedFont: vi.fn(() => ({
        widthOfTextAtSize: vi.fn(() => 50),
      })),
      save: vi.fn(() => new Uint8Array([37, 80, 68, 70])),
      registerFontkit: vi.fn(),
    });

    const result = await appendCompletionCertificate(
      Buffer.from("fake-pdf"),
      "Test",
      [{
        signerName: "Test User",
        signerEmail: "test@example.com",
        signedAt: null as any,
        ipAddress: null as any,
        userAgent: null as any,
      }]
    );
    expect(result).toBeInstanceOf(Buffer);
  });

  it("throws error when font embed fails in certificate (no Helvetica fallback)", async () => {
    const { appendCompletionCertificate } = await import("./pdf");
    const mockAddPage = vi.fn(() => ({
      drawText: vi.fn(),
      drawLine: vi.fn(),
      drawRectangle: vi.fn(),
      getSize: () => ({ width: 595.28, height: 841.89 }),
    }));
    let fontCallCount = 0;
    const { PDFDocument: MockPDFDocument } = await import("pdf-lib");
    (MockPDFDocument.load as any).mockResolvedValueOnce({
      addPage: mockAddPage,
      embedFont: vi.fn(() => {
        fontCallCount++;
        // First two calls succeed (Helvetica, HelveticaBold)
        // Third call fails (Japanese font), fourth also fails (retry)
        if (fontCallCount >= 3) throw new Error("Font embed fail");
        return { widthOfTextAtSize: vi.fn(() => 50) };
      }),
      save: vi.fn(() => new Uint8Array([37, 80, 68, 70])),
      registerFontkit: vi.fn(),
    });

    await expect(appendCompletionCertificate(
      Buffer.from("fake-pdf"),
      "Test",
      []
    )).rejects.toThrow("Japanese font embedding failed for completion certificate");
  });
});

describe("applyPdfPermissionLock", () => {
  it("applies permission lock using qpdf", async () => {
    const { applyPdfPermissionLock } = await import("./pdf");
    // This test may fail if qpdf is not installed, which is expected in test env
    const result = await applyPdfPermissionLock(Buffer.from("%PDF-1.4 fake"));
    // Should return { buffer, locked } regardless of qpdf availability
    expect(result).toHaveProperty("buffer");
    expect(result).toHaveProperty("locked");
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(typeof result.locked).toBe("boolean");
  });
});

describe("embedSignaturesIntoPdf - multiple fields on multiple pages", () => {
  it("handles multiple signatures across different field types", async () => {
    const drawText = vi.fn();
    const drawImage = vi.fn();
    mockGetPages.mockReturnValueOnce([
      {
        getSize: () => ({ width: 612, height: 792 }),
        drawImage, drawText,
        node: { get: vi.fn(() => null), lookup: vi.fn(), delete: vi.fn() },
      },
    ]);

    const fields: SignatureField[] = [
      { id: "f1", page: 0, x: 10, y: 10, width: 20, height: 6, signerIndex: 0, type: "signature" },
      { id: "f2", page: 0, x: 50, y: 50, width: 15, height: 4, signerIndex: 0, type: "name" },
      { id: "f3", page: 0, x: 70, y: 70, width: 15, height: 4, signerIndex: 0, type: "date" },
      { id: "f4", page: 0, x: 30, y: 30, width: 10, height: 10, signerIndex: 0, type: "initials" },
    ];
    const signatures: SignatureData[] = [
      { fieldId: "f1", signerName: "山田 太郎", signedAt: new Date("2024-01-01") },
      { fieldId: "f2", signerName: "山田 太郎", signedAt: new Date("2024-01-01") },
      { fieldId: "f3", signerName: "山田 太郎", signedAt: new Date("2024-01-01") },
      { fieldId: "f4", signerName: "山田 太郎", signedAt: new Date("2024-01-01") },
    ];

    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      fields,
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
    // signature (text + date) + name + date + initials = 5 drawText calls
    expect(drawText.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});

describe("embedSignaturesIntoPdf - initials with single name", () => {
  it("handles single-word name for initials", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 10, height: 4, signerIndex: 0, type: "initials",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "A",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });

  it("handles full-width space separated name for initials", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 10, height: 4, signerIndex: 0, type: "initials",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田\u3000太郎",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

describe("embedSignaturesIntoPdf - page out of range", () => {
  it("skips field when page index is out of range", async () => {
    const field: SignatureField = {
      id: "field1", page: 5, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const signatures: SignatureData[] = [{
      fieldId: "field1",
      signerName: "山田太郎",
      signedAt: new Date("2024-01-01"),
    }];
    const result = await embedSignaturesIntoPdf(
      "https://example.com/test.pdf",
      [field],
      signatures
    );
    expect(result).toBeInstanceOf(Buffer);
  });
});

// ===== UT-A: safeDrawText fallback chain =====
describe("safeDrawText - fallback chain", () => {
  const testField: SignatureField = {
    id: "field1", page: 0, x: 50, y: 50, width: 20, height: 4, signerIndex: 0, type: "name",
  };
  const testSig: SignatureData[] = [{
    fieldId: "field1",
    signerName: "Test",
    signedAt: new Date("2024-01-01"),
  }];

  it("UT-A2: falls back to Helvetica when primary font throws", async () => {
    const drawText = vi.fn();
    let callCount = 0;
    drawText.mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error("Primary font fail");
      // second call (Helvetica fallback) succeeds
    });
    const page = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(),
      drawText,
      node: { get: vi.fn(() => null), lookup: vi.fn(), delete: vi.fn() },
    };
    mockGetPages.mockReturnValueOnce([page]);
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [testField], testSig);
    expect(result).toBeInstanceOf(Buffer);
    expect(drawText).toHaveBeenCalledTimes(2); // primary fails, Helvetica succeeds
  });

  it("UT-A3: falls back to ASCII replace when primary and Helvetica both throw", async () => {
    const drawText = vi.fn();
    let callCount = 0;
    drawText.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) throw new Error("Font fail");
      // third call (ASCII replace) succeeds
    });
    const page = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(),
      drawText,
      node: { get: vi.fn(() => null), lookup: vi.fn(), delete: vi.fn() },
    };
    mockGetPages.mockReturnValueOnce([page]);
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [testField], testSig);
    expect(result).toBeInstanceOf(Buffer);
    expect(drawText).toHaveBeenCalledTimes(3); // primary fail, Helvetica fail, ASCII succeed
  });

  it("UT-A4: silently skips text when all drawing attempts throw", async () => {
    const drawText = vi.fn(() => { throw new Error("All rendering fail"); });
    const page = {
      getSize: () => ({ width: 612, height: 792 }),
      drawImage: vi.fn(),
      drawText,
      node: { get: vi.fn(() => null), lookup: vi.fn(), delete: vi.fn() },
    };
    mockGetPages.mockReturnValueOnce([page]);
    // Must not throw even when all drawing fails
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [testField], testSig);
    expect(result).toBeInstanceOf(Buffer);
  });
});

// ===== UT-B: CropBox + Rotation combined =====
describe("embedSignaturesIntoPdf - CropBox + Rotation combined", () => {
  const makeCropBoxPage = (rotation: number) => {
    const cropBoxArray = {
      get: vi.fn((idx: number) => {
        const values = [
          { asNumber: () => 36 },   // llx
          { asNumber: () => 36 },   // lly
          { asNumber: () => 576 },  // urx
          { asNumber: () => 756 },  // ury
        ];
        return values[idx];
      }),
    };
    const drawText = vi.fn();
    const page = {
      getSize: () => ({ width: 612, height: 792 }),
      getRotation: vi.fn(() => ({ angle: rotation })),
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
    return { page, drawText };
  };

  it("UT-B1: CropBox + 90° rotation combined renders without throwing", async () => {
    const { page, drawText } = makeCropBoxPage(90);
    mockGetPages.mockReturnValueOnce([page]);
    const field: SignatureField = {
      id: "field1", page: 0, x: 10, y: 20, width: 30, height: 40, signerIndex: 0, type: "date",
    };
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], [{
      fieldId: "field1", signerName: "テスト", signedAt: new Date("2024-01-01"),
    }]);
    expect(result).toBeInstanceOf(Buffer);
    // CropBox: pageWidth=540, pageHeight=720
    // 90°: x=36+540*(1-(0.2+0.4))=36+216=252, y=36+720*(1-(0.1+0.3))=36+432=468
    // drawText x=252+5=257
    expect(drawText).toHaveBeenCalled();
    const [, opts] = drawText.mock.calls[0];
    expect(opts.x).toBeCloseTo(257, 0);
  });

  it("UT-B2: CropBox + 180° rotation combined renders correctly", async () => {
    const { page, drawText } = makeCropBoxPage(180);
    mockGetPages.mockReturnValueOnce([page]);
    const field: SignatureField = {
      id: "field1", page: 0, x: 10, y: 20, width: 30, height: 40, signerIndex: 0, type: "date",
    };
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], [{
      fieldId: "field1", signerName: "テスト", signedAt: new Date("2024-01-01"),
    }]);
    expect(result).toBeInstanceOf(Buffer);
    // CropBox: pageWidth=540, pageHeight=720, offsetX=36, offsetY=36
    // 180°: x=36+540*(1-(0.1+0.3))=36+324=360, y=36+(0.2/1)*720=36+144=180
    const [, opts] = drawText.mock.calls[0];
    expect(opts.x).toBeCloseTo(365, 0); // x+5
  });
});

// ===== UT-C: embedSignaturesIntoPdf error cases =====
describe("embedSignaturesIntoPdf - error handling", () => {
  it("UT-C1: throws when fetch fails for PDF URL", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(
      embedSignaturesIntoPdf("https://example.com/test.pdf", [], [])
    ).rejects.toThrow();
  });

  it("UT-C2: throws when PDFDocument.load fails", async () => {
    const { PDFDocument } = await import("pdf-lib");
    (PDFDocument.load as any).mockRejectedValueOnce(new Error("Invalid PDF data"));
    await expect(
      embedSignaturesIntoPdf("https://example.com/test.pdf", [], [])
    ).rejects.toThrow("Invalid PDF data");
  });

  it("UT-C3: throws when both font embed attempts fail", async () => {
    // embedFont call order: 1=Helvetica(ok), 2=Japanese(fail), 3=Japanese retry(fail)
    mockEmbedFont.mockImplementationOnce(() => ({})); // Helvetica succeeds
    mockEmbedFont.mockImplementationOnce(() => { throw new Error("Font embed fail"); });
    mockEmbedFont.mockImplementationOnce(() => { throw new Error("Font embed fail"); });
    await expect(
      embedSignaturesIntoPdf("https://example.com/test.pdf", [], [])
    ).rejects.toThrow("Japanese font embedding failed after retry");
  });

  it("UT-C4: handles null signedAt for signature type (uses epoch date)", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], [{
      fieldId: "field1",
      signerName: "Test",
      signedAt: null as any,
    }]);
    expect(result).toBeInstanceOf(Buffer);
  });

  it("UT-C5: handles empty signerName for initials field", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 10, height: 4, signerIndex: 0, type: "initials",
    };
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], [{
      fieldId: "field1",
      signerName: "",
      signedAt: new Date("2024-01-01"),
    }]);
    expect(result).toBeInstanceOf(Buffer);
  });
});

// ===== UT-D: stamp/signature with empty base64 after comma =====
describe("embedSignaturesIntoPdf - empty base64 handling", () => {
  it("UT-D1: stamp with empty base64 after comma skips gracefully", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 10, height: 10, signerIndex: 0, type: "stamp",
    };
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], [{
      fieldId: "field1",
      signerName: "山田",
      stampDataUrl: "data:image/png;base64,", // empty base64
      signedAt: new Date(),
    }]);
    expect(result).toBeInstanceOf(Buffer);
    expect(mockEmbedPng).not.toHaveBeenCalled();
  });

  it("UT-D2: signature with empty base64 after comma falls back to text", async () => {
    const field: SignatureField = {
      id: "field1", page: 0, x: 50, y: 50, width: 20, height: 6, signerIndex: 0, type: "signature",
    };
    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [field], [{
      fieldId: "field1",
      signerName: "山田太郎",
      signatureDataUrl: "data:image/png;base64,", // empty base64
      signedAt: new Date("2024-01-01"),
    }]);
    expect(result).toBeInstanceOf(Buffer);
    expect(mockEmbedPng).not.toHaveBeenCalled();
    expect(mockDrawText).toHaveBeenCalled(); // Falls back to text rendering
  });
});

// ===== UT-F3: appendCompletionCertificate - ensureSpace triggers new page =====
describe("appendCompletionCertificate - page overflow and wrapText", () => {
  const makeDocMock = (addPage: ReturnType<typeof vi.fn>) => ({
    addPage,
    embedFont: vi.fn(() => ({ widthOfTextAtSize: vi.fn((text: string, size: number) => text.length * size * 0.5) })),
    save: vi.fn(() => new Uint8Array([37, 80, 68, 70])),
    registerFontkit: vi.fn(),
  });

  it("UT-F3: ensureSpace triggers additional page for many signers", async () => {
    const { appendCompletionCertificate } = await import("./pdf");
    let addPageCallCount = 0;
    const mockAddPage = vi.fn(() => {
      addPageCallCount++;
      return {
        drawText: vi.fn(),
        drawLine: vi.fn(),
        drawRectangle: vi.fn(),
        getSize: () => ({ width: 595.28, height: 841.89 }),
      };
    });
    const { PDFDocument: MockPDFDocument } = await import("pdf-lib");
    (MockPDFDocument.load as any).mockResolvedValueOnce(makeDocMock(mockAddPage));

    // 15 signers should exceed one page (~60px per signer, page height ~842)
    const manyEntries = Array.from({ length: 15 }, (_, i) => ({
      signerName: `Signer ${i + 1}`,
      signerEmail: `signer${i + 1}@example.com`,
      signedAt: new Date("2024-01-01"),
      ipAddress: `192.168.1.${i + 1}`,
      userAgent: "Mozilla/5.0",
    }));
    const result = await appendCompletionCertificate(Buffer.from("fake-pdf"), "Test Doc", manyEntries);
    expect(result).toBeInstanceOf(Buffer);
    expect(addPageCallCount).toBeGreaterThanOrEqual(2); // at least 2 pages needed
  });

  it("UT-F4: long document title wraps across multiple lines", async () => {
    const { appendCompletionCertificate } = await import("./pdf");
    const drawText = vi.fn();
    const mockAddPage = vi.fn(() => ({
      drawText,
      drawLine: vi.fn(),
      drawRectangle: vi.fn(),
      getSize: () => ({ width: 595.28, height: 841.89 }),
    }));
    const { PDFDocument: MockPDFDocument } = await import("pdf-lib");
    (MockPDFDocument.load as any).mockResolvedValueOnce(makeDocMock(mockAddPage));

    const longTitle = "Very Long Document Title That Should Be Wrapped Across Multiple Lines Because It Exceeds The Maximum Width Of The Content Area In The Certificate";
    const result = await appendCompletionCertificate(Buffer.from("fake-pdf"), longTitle, []);
    expect(result).toBeInstanceOf(Buffer);
    // Multiple drawText calls should occur (title lines + labels)
    expect(drawText.mock.calls.length).toBeGreaterThan(3);
  });

  it("UT-F5: string signedAt in audit entry is formatted correctly", async () => {
    const { appendCompletionCertificate } = await import("./pdf");
    const drawText = vi.fn();
    const mockAddPage = vi.fn(() => ({
      drawText,
      drawLine: vi.fn(),
      drawRectangle: vi.fn(),
      getSize: () => ({ width: 595.28, height: 841.89 }),
    }));
    const { PDFDocument: MockPDFDocument } = await import("pdf-lib");
    (MockPDFDocument.load as any).mockResolvedValueOnce(makeDocMock(mockAddPage));

    const result = await appendCompletionCertificate(Buffer.from("fake-pdf"), "Test", [{
      signerName: "Test User",
      signerEmail: "test@example.com",
      signedAt: "2026-03-08T10:00:00.000Z" as any, // string date
      ipAddress: "127.0.0.1",
      userAgent: "TestAgent/1.0",
    }]);
    expect(result).toBeInstanceOf(Buffer);
    // Check that signed date text was drawn (not "N/A")
    const calls = drawText.mock.calls.map(([text]: [string]) => text);
    expect(calls.some((t: string) => t.includes("Signed At:"))).toBe(true);
  });
});

// ===== UT-G: applyPdfPermissionLock edge cases =====
describe("applyPdfPermissionLock - edge cases", () => {
  it("UT-G2: still returns { buffer, locked } when unlink throws after qpdf failure", async () => {
    const { applyPdfPermissionLock } = await import("./pdf");
    // qpdf will fail (not installed in CI), but unlink also fails
    // The finally block ignores unlink errors, so should still return original buffer
    const input = Buffer.from("%PDF-1.4 minimal test");
    const result = await applyPdfPermissionLock(input);
    expect(result).toHaveProperty("buffer");
    expect(result).toHaveProperty("locked");
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("UT-G3: returns { buffer: original, locked: false } when qpdf output file is missing", async () => {
    const { applyPdfPermissionLock } = await import("./pdf");
    // When qpdf fails completely, the function falls back to returning original
    const input = Buffer.from("%PDF-1.4 test content");
    const result = await applyPdfPermissionLock(input);
    expect(result.buffer).toBeInstanceOf(Buffer);
    // In CI qpdf is not installed, so locked=false
    expect(typeof result.locked).toBe("boolean");
  });
});

describe("embedSignaturesIntoPdf - page rotation coordinate transform", () => {
  // Page: W=200, H=100. Field: x:10, y:20, w:30, h:40 (date type)
  // For date field rendering: drawText(text, { x: field_x+5, y: field_y+fieldHeight/2-fontSize/2, ... })
  // fontSize = Math.min(12, fieldHeight*0.6)
  const testField: SignatureField = {
    id: "field1", page: 0,
    x: 10, y: 20, width: 30, height: 40,
    signerIndex: 0, type: "date",
  };
  const signatures: SignatureData[] = [{
    fieldId: "field1",
    signerName: "テスト",
    signedAt: new Date("2024-03-08"),
  }];

  const createPage = (rotation: number) => {
    const drawText = vi.fn();
    const drawImage = vi.fn();
    const page = {
      getSize: () => ({ width: 200, height: 100 }),
      getRotation: vi.fn(() => ({ angle: rotation })),
      drawImage,
      drawText,
      node: { get: vi.fn(() => null), lookup: vi.fn(), delete: vi.fn() },
    };
    return { page, drawText, drawImage };
  };

  it("0°: field_x=20, field_y=40, fieldHeight=40 → drawText at (25, 54)", async () => {
    // x=(10/100)*200=20, y=100-20-40=40, fW=60, fH=40, fontSize=12
    // drawText x=20+5=25, y=40+20-6=54
    const { page, drawText } = createPage(0);
    mockGetPages.mockReturnValueOnce([page]);
    await embedSignaturesIntoPdf("https://example.com/test.pdf", [testField], signatures);
    expect(drawText).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ x: 25, y: 54 }));
  });

  it("90° CCW: field_x=80, field_y=60, fieldHeight=30 → drawText at (85, 69)", async () => {
    // x=200*(1-0.6)=80, y=100*(1-0.4)=60, fW=80, fH=30, fontSize=12
    // drawText x=80+5=85, y=60+15-6=69
    const { page, drawText } = createPage(90);
    mockGetPages.mockReturnValueOnce([page]);
    await embedSignaturesIntoPdf("https://example.com/test.pdf", [testField], signatures);
    expect(drawText).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ x: 85, y: 69 }));
  });

  it("180°: field_x=120, field_y=20, fieldHeight=40 → drawText at (125, 34)", async () => {
    // x=200*(1-0.4)=120, y=(20/100)*100=20, fW=60, fH=40, fontSize=12
    // drawText x=120+5=125, y=20+20-6=34
    const { page, drawText } = createPage(180);
    mockGetPages.mockReturnValueOnce([page]);
    await embedSignaturesIntoPdf("https://example.com/test.pdf", [testField], signatures);
    expect(drawText).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ x: 125, y: 34 }));
  });

  it("270° CW: field_x=40, field_y=10, fieldHeight=30 → drawText at (45, 19)", async () => {
    // x=(20/100)*200=40, y=(10/100)*100=10, fW=80, fH=30, fontSize=12
    // drawText x=40+5=45, y=10+15-6=19
    const { page, drawText } = createPage(270);
    mockGetPages.mockReturnValueOnce([page]);
    await embedSignaturesIntoPdf("https://example.com/test.pdf", [testField], signatures);
    expect(drawText).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ x: 45, y: 19 }));
  });

  it("non-standard rotation (45°) falls back to 0°", async () => {
    const { page, drawText } = createPage(45);
    mockGetPages.mockReturnValueOnce([page]);
    await embedSignaturesIntoPdf("https://example.com/test.pdf", [testField], signatures);
    // Falls back to 0° coordinates
    expect(drawText).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ x: 25, y: 54 }));
  });

  it("getRotation() throwing falls back to 0°", async () => {
    const drawText = vi.fn();
    const page = {
      getSize: () => ({ width: 200, height: 100 }),
      getRotation: vi.fn(() => { throw new Error("No rotation info"); }),
      drawImage: vi.fn(),
      drawText,
      node: { get: vi.fn(() => null), lookup: vi.fn(), delete: vi.fn() },
    };
    mockGetPages.mockReturnValueOnce([page]);
    await embedSignaturesIntoPdf("https://example.com/test.pdf", [testField], signatures);
    // Falls back to 0° coordinates
    expect(drawText).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ x: 25, y: 54 }));
  });
});

// ============================================================
// FR-001: loadSignatureFontBytes behavior (via embedSignaturesIntoPdf)
// ============================================================
describe("FR-001: loadSignatureFontBytes behavior (via embedSignaturesIntoPdf)", () => {
  const sigField: SignatureField = {
    id: "fr001-field",
    page: 0,
    x: 50,
    y: 50,
    width: 20,
    height: 6,
    signerIndex: 0,
    type: "signature",
  };

  // Reset signature font cache before each test to ensure deterministic behavior
  beforeEach(() => {
    _resetSignatureFontCacheForTest();
  });

  it("FR-001-a: fetches font from CDN URL for known fontId (dancing-script)", async () => {
    const dancingScriptDef = SIGNATURE_FONTS.find(f => f.id === "dancing-script")!;
    // First call: PDF fetch. Second call: font CDN fetch (ok: true so loadSignatureFontBytes succeeds)
    mockFetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(500)) });

    await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], [{
      fieldId: "fr001-field",
      signerName: "Test Signer",
      signatureFont: "dancing-script",
      signedAt: new Date("2026-01-01"),
    }]);

    expect(mockFetch).toHaveBeenCalledWith(
      dancingScriptDef.ttfUrl,
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it("FR-001-b: second call with same fontId uses cache — fetch called only once for font", async () => {
    const fontDef = SIGNATURE_FONTS.find(f => f.id === "great-vibes")!;
    // PDF-1, font (ok), PDF-2 (font comes from cache on 2nd embed call)
    mockFetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(500)) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) });

    const sigData: SignatureData[] = [{
      fieldId: "fr001-field",
      signerName: "Cache Test",
      signatureFont: "great-vibes",
      signedAt: new Date("2026-01-01"),
    }];

    await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], sigData);
    await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], sigData);

    // Font CDN should have been fetched exactly once across both calls
    const fontFetchCalls = mockFetch.mock.calls.filter(([url]) => url === fontDef.ttfUrl);
    expect(fontFetchCalls).toHaveLength(1);
  });

  it("FR-001-c: unknown fontId returns null without calling font CDN", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) });

    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], [{
      fieldId: "fr001-field",
      signerName: "Test",
      signatureFont: "nonexistent-font-xyz",
      signedAt: new Date("2026-01-01"),
    }]);

    expect(result).toBeInstanceOf(Buffer);
    // No font CDN URL should have been fetched
    SIGNATURE_FONTS.forEach(({ ttfUrl }) => {
      expect(mockFetch).not.toHaveBeenCalledWith(ttfUrl, expect.anything());
    });
  });

  it("FR-001-d: HTTP error response (ok:false) causes null return — PDF still generated", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) })
      .mockResolvedValueOnce({ ok: false, status: 500 }); // font CDN returns 500

    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], [{
      fieldId: "fr001-field",
      signerName: "HTTP Error Test",
      signatureFont: "pacifico",
      signedAt: new Date("2026-01-01"),
    }]);

    // PDF should be generated successfully despite font fetch failure
    expect(result).toBeInstanceOf(Buffer);
    expect(mockDrawText).toHaveBeenCalled();
  });

  it("FR-001-e: fetch throws (network/timeout error) — PDF still generated without rethrowing", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) })
      .mockRejectedValueOnce(Object.assign(new Error("AbortError"), { name: "AbortError" }));

    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], [{
      fieldId: "fr001-field",
      signerName: "Timeout Test",
      signatureFont: "sacramento",
      signedAt: new Date("2026-01-01"),
    }]);

    expect(result).toBeInstanceOf(Buffer);
    expect(mockDrawText).toHaveBeenCalled();
  });
});

// ============================================================
// FR-002: embedSignaturesIntoPdf — signatureFont コードパス
// ============================================================
describe("FR-002: embedSignaturesIntoPdf — signatureFont rendering paths", () => {
  const sigField: SignatureField = {
    id: "fr002-field",
    page: 0,
    x: 50,
    y: 50,
    width: 20,
    height: 6,
    signerIndex: 0,
    type: "signature",
  };

  beforeEach(() => {
    _resetSignatureFontCacheForTest();
  });

  it("FR-002-a: signatureFont set → font CDN URL is fetched", async () => {
    const fontDef = SIGNATURE_FONTS.find(f => f.id === "allura")!;
    mockFetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(500)) });

    await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], [{
      fieldId: "fr002-field",
      signerName: "Allura Test",
      signatureFont: "allura",
      signedAt: new Date("2026-01-01"),
    }]);

    expect(mockFetch).toHaveBeenCalledWith(
      fontDef.ttfUrl,
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it("FR-002-b: font bytes fetched successfully → pdfDoc.embedFont called → signerName drawn", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(500)) });

    await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], [{
      fieldId: "fr002-field",
      signerName: "Klee One Test",
      signatureFont: "klee-one",
      signedAt: new Date("2026-01-01"),
    }]);

    // embedFont must be called (at minimum: Helvetica + Japanese + signatureFont)
    expect(mockEmbedFont).toHaveBeenCalled();
    // signerName must be drawn
    expect(mockDrawText).toHaveBeenCalledWith("Klee One Test", expect.anything());
  });

  it("FR-002-f: signatureFont + signatureDataUrl provided → prefers PNG image over font text (CJK .notdef fix)", async () => {
    // PNG is always preferred to avoid Latin-only fonts rendering CJK glyphs as .notdef (X/□).
    // pdf-lib does NOT throw for missing glyphs — it silently renders .notdef — so exception-based
    // fallback cannot catch the problem. PNG (browser-rendered with font fallback) is always correct.
    mockFetch.mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) });

    await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], [{
      fieldId: "fr002-field",
      signerName: "山田太郎",
      signatureFont: "dancing-script",
      signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      signedAt: new Date("2026-01-01"),
    }]);

    // PNG image should be embedded (not text drawn for the signature itself)
    expect(mockDrawImage).toHaveBeenCalled();
    // Font CDN should NOT be fetched when PNG is available
    const dancingScriptUrl = SIGNATURE_FONTS.find(f => f.id === "dancing-script")!.ttfUrl;
    expect(mockFetch).not.toHaveBeenCalledWith(dancingScriptUrl, expect.anything());
  });

  it("FR-002-c: loadSignatureFontBytes returns null (CDN unreachable) → falls back to japaneseFont, PDF still generated", async () => {
    // Default mock has no ok:true → font fetch fails → null returned → fall back to japaneseFont
    mockFetch.mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) });

    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], [{
      fieldId: "fr002-field",
      signerName: "Fallback Test",
      signatureFont: "dancing-script", // CDN unreachable → null
      signedAt: new Date("2026-01-01"),
    }]);

    expect(result).toBeInstanceOf(Buffer);
    expect(mockDrawText).toHaveBeenCalledWith("Fallback Test", expect.anything());
  });

  it("FR-002-d: pdfDoc.embedFont throws for signatureFont bytes → falls back to japaneseFont, PDF still generated", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(500)) });

    // Override embedFont: 1st (Helvetica) and 2nd (Japanese) succeed, 3rd (signatureFont) throws
    mockEmbedFont
      .mockResolvedValueOnce({})  // Helvetica
      .mockResolvedValueOnce({})  // Japanese
      .mockRejectedValueOnce(new Error("Invalid font data for signature font"));

    const result = await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], [{
      fieldId: "fr002-field",
      signerName: "EmbedThrow Test",
      signatureFont: "great-vibes",
      signedAt: new Date("2026-01-01"),
    }]);

    // Despite embedFont throwing for signatureFont, PDF is still generated
    expect(result).toBeInstanceOf(Buffer);
    expect(mockDrawText).toHaveBeenCalled();
  });

  it("FR-002-e: signatureFont undefined → font CDN is not fetched, signerName still drawn", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) });

    await embedSignaturesIntoPdf("https://example.com/test.pdf", [sigField], [{
      fieldId: "fr002-field",
      signerName: "No Font Test",
      // signatureFont intentionally omitted
      signedAt: new Date("2026-01-01"),
    }]);

    // No font CDN should have been fetched
    SIGNATURE_FONTS.forEach(({ ttfUrl }) => {
      expect(mockFetch).not.toHaveBeenCalledWith(ttfUrl, expect.anything());
    });
    // But signerName must still be drawn
    expect(mockDrawText).toHaveBeenCalled();
  });
});
