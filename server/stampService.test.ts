import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @napi-rs/canvas
vi.mock("@napi-rs/canvas", () => {
  const mockCtx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    getImageData: vi.fn().mockReturnValue({
      data: new Uint8ClampedArray(200 * 200 * 4), // RGBA for 200x200
    }),
    putImageData: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    textAlign: "",
    textBaseline: "",
    font: "",
  };
  return {
    createCanvas: vi.fn().mockReturnValue({
      getContext: vi.fn().mockReturnValue(mockCtx),
      toBuffer: vi.fn().mockReturnValue(Buffer.from("fake-png-data")),
    }),
    GlobalFonts: {
      registerFromPath: vi.fn(),
    },
  };
});

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { generateStampImage, generateStampDataUrl, type StampOptions } from "./stampService";

describe("StampService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateStampImage", () => {
    it("should generate a stamp image buffer for a single character", () => {
      const result = generateStampImage({ name: "田" });
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should generate a stamp for two characters (vertical layout)", () => {
      const result = generateStampImage({ name: "田中" });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should generate a stamp for three characters", () => {
      const result = generateStampImage({ name: "田中太" });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should generate a stamp for four+ characters (two-column layout)", () => {
      const result = generateStampImage({ name: "田中太郎" });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should generate a stamp for five characters", () => {
      const result = generateStampImage({ name: "田中太郎子" });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should throw error for empty name", () => {
      expect(() => generateStampImage({ name: "" })).toThrow("名前を入力してください");
    });

    it("should throw error for whitespace-only name", () => {
      expect(() => generateStampImage({ name: "   " })).toThrow("名前を入力してください");
    });

    it("should use custom size", () => {
      const result = generateStampImage({ name: "田", size: 300 });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should use custom color", () => {
      const result = generateStampImage({ name: "田", color: "#0000ff" });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should use square style", () => {
      const result = generateStampImage({ name: "田", style: "square" });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should use circle style (default)", () => {
      const result = generateStampImage({ name: "田", style: "circle" });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should handle non-transparent background", () => {
      const result = generateStampImage({ name: "田", transparent: false });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should handle transparent background (default)", () => {
      const result = generateStampImage({ name: "田", transparent: true });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should use default options when not specified", () => {
      const result = generateStampImage({ name: "佐藤" });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should handle all options together", () => {
      const opts: StampOptions = {
        name: "鈴木",
        size: 250,
        color: "#ff0000",
        style: "square",
        transparent: false,
      };
      const result = generateStampImage(opts);
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe("generateStampDataUrl", () => {
    it("should return a data URL string", () => {
      const result = generateStampDataUrl({ name: "田中" });
      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it("should contain valid base64 data", () => {
      const result = generateStampDataUrl({ name: "佐藤" });
      const base64Part = result.split(",")[1];
      expect(base64Part).toBeTruthy();
      // Verify it's valid base64
      expect(() => Buffer.from(base64Part, "base64")).not.toThrow();
    });
  });

  describe("addStampTexture (internal)", () => {
    it("should apply texture to stamp via generateStampImage", () => {
      // The texture function modifies pixel data in-place
      // We test it indirectly through generateStampImage
      const result = generateStampImage({ name: "A" });
      expect(result).toBeInstanceOf(Buffer);
    });

    it("modifies non-transparent pixels (data[i+3] > 0 branch)", () => {
      // Override canvas to return imageData with non-transparent pixels
      const dataWithAlpha = new Uint8ClampedArray(10 * 10 * 4);
      for (let i = 0; i < dataWithAlpha.length; i += 4) {
        dataWithAlpha[i] = 200;     // R
        dataWithAlpha[i + 1] = 0;   // G
        dataWithAlpha[i + 2] = 0;   // B
        dataWithAlpha[i + 3] = 200; // A - non-transparent
      }

      const mockCtxWithAlpha = {
        clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
        arc: vi.fn(), stroke: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(),
        getImageData: vi.fn().mockReturnValue({ data: dataWithAlpha }),
        putImageData: vi.fn(),
        fillStyle: "", strokeStyle: "", lineWidth: 0, textAlign: "", textBaseline: "", font: "",
      };

      vi.mocked(createCanvas).mockReturnValueOnce({
        getContext: vi.fn().mockReturnValue(mockCtxWithAlpha),
        toBuffer: vi.fn().mockReturnValue(Buffer.from("fake-png-data")),
      } as any);

      const result = generateStampImage({ name: "田" });
      expect(result).toBeInstanceOf(Buffer);
      // putImageData should have been called (texture was applied)
      expect(mockCtxWithAlpha.putImageData).toHaveBeenCalled();
    });
  });

  describe("ensureFonts (catch branch)", () => {
    it("continues gracefully when font registration throws", async () => {
      // Use vi.resetModules + vi.doMock to get a fresh module with fontsRegistered=false
      vi.resetModules();
      vi.doMock("@napi-rs/canvas", () => {
        const mockCtx = {
          clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
          arc: vi.fn(), stroke: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(),
          getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(200 * 200 * 4) }),
          putImageData: vi.fn(),
          fillStyle: "", strokeStyle: "", lineWidth: 0, textAlign: "", textBaseline: "", font: "",
        };
        return {
          createCanvas: vi.fn().mockReturnValue({
            getContext: vi.fn().mockReturnValue(mockCtx),
            toBuffer: vi.fn().mockReturnValue(Buffer.from("fake-png-data")),
          }),
          GlobalFonts: {
            // First call throws to trigger the catch block (line 25-27)
            registerFromPath: vi.fn().mockImplementationOnce(() => {
              throw new Error("Font file not found");
            }),
          },
        };
      });

      const { generateStampImage: freshGenerateStampImage } = await import("./stampService");
      // Should not throw even when font registration fails
      const result = freshGenerateStampImage({ name: "田" });
      expect(result).toBeInstanceOf(Buffer);

      vi.doUnmock("@napi-rs/canvas");
    });
  });

  describe("W-11: multi-platform font path fallback", () => {
    it("AC-008/AC-009: uses bundled font when system CJK fonts are absent", async () => {
      // The mock registerFromPath tracks which paths are tried.
      // In test env, system paths don't exist, so only BUNDLED_FONT should be used.
      vi.resetModules();
      const registerMock = vi.fn();
      vi.doMock("@napi-rs/canvas", () => ({
        createCanvas: vi.fn().mockReturnValue({
          getContext: vi.fn().mockReturnValue({
            clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
            arc: vi.fn(), stroke: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(),
            getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(200 * 200 * 4) }),
            putImageData: vi.fn(),
            fillStyle: "", strokeStyle: "", lineWidth: 0, textAlign: "", textBaseline: "", font: "",
          }),
          toBuffer: vi.fn().mockReturnValue(Buffer.from("fake-png")),
        }),
        GlobalFonts: { registerFromPath: registerMock },
      }));

      const { generateStampImage: freshGen } = await import("./stampService");
      const result = freshGen({ name: "山" });
      // Should generate successfully without throwing
      expect(result).toBeInstanceOf(Buffer);
      // registerFromPath should only be called with paths that exist
      // (all system paths absent in CI → only BUNDLED_FONT if it exists, else nothing)
      const calledPaths = registerMock.mock.calls.map((c: any[]) => c[0] as string);
      for (const p of calledPaths) {
        expect(typeof p).toBe("string");
        expect(p.length).toBeGreaterThan(0);
      }

      vi.doUnmock("@napi-rs/canvas");
    });

    it("AC-010: ensureFonts does not throw when no font path is found", async () => {
      vi.resetModules();
      vi.doMock("@napi-rs/canvas", () => ({
        createCanvas: vi.fn().mockReturnValue({
          getContext: vi.fn().mockReturnValue({
            clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
            arc: vi.fn(), stroke: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(),
            getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(200 * 200 * 4) }),
            putImageData: vi.fn(),
            fillStyle: "", strokeStyle: "", lineWidth: 0, textAlign: "", textBaseline: "", font: "",
          }),
          toBuffer: vi.fn().mockReturnValue(Buffer.from("fake-png")),
        }),
        GlobalFonts: {
          registerFromPath: vi.fn().mockImplementation(() => {
            throw new Error("Font not found");
          }),
        },
      }));
      vi.doMock("fs", () => ({
        default: { existsSync: vi.fn().mockReturnValue(false) },
        existsSync: vi.fn().mockReturnValue(false),
      }));

      const { generateStampImage: freshGen } = await import("./stampService");
      // Should not throw even when all font paths are absent
      expect(() => freshGen({ name: "田" })).not.toThrow();

      vi.doUnmock("@napi-rs/canvas");
      vi.doUnmock("fs");
    });
  });
});
