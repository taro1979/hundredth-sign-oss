import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock ENV with vi.hoisted to ensure it's available before module load
const mockEnv = vi.hoisted(() => ({
  forgeApiUrl: "https://api.example.com",
  forgeApiKey: "test-api-key-123",
}));

vi.mock("./_core/env", () => ({
  ENV: mockEnv,
}));

import { storagePut, storageGet } from "./storage";

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.forgeApiUrl = "https://api.example.com";
  mockEnv.forgeApiKey = "test-api-key-123";
});

describe("storagePut", () => {
  it("uploads data to S3 and returns url", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: "https://storage.example.com/test.pdf" }),
    });

    const result = await storagePut("uploads/test.pdf", Buffer.from("test"), "application/pdf");

    expect(result.key).toBe("uploads/test.pdf");
    expect(result.url).toBe("https://storage.example.com/test.pdf");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("throws error when upload fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("Server error"),
    });

    await expect(
      storagePut("uploads/test.pdf", Buffer.from("test"), "application/pdf")
    ).rejects.toThrow("Storage upload failed");
  });

  it("normalizes leading slashes in key", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: "https://storage.example.com/test.pdf" }),
    });

    const result = await storagePut("///uploads/test.pdf", Buffer.from("test"));
    expect(result.key).toBe("uploads/test.pdf");
  });

  it("uses default content type when not specified", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: "https://storage.example.com/file" }),
    });

    await storagePut("uploads/file", Buffer.from("test"));
    expect(mockFetch).toHaveBeenCalled();
  });

  it("handles string data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: "https://storage.example.com/text.txt" }),
    });

    const result = await storagePut("uploads/text.txt", "hello world", "text/plain");
    expect(result.url).toBe("https://storage.example.com/text.txt");
  });

  it("handles Uint8Array data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: "https://storage.example.com/binary" }),
    });

    const result = await storagePut("uploads/binary", new Uint8Array([1, 2, 3]));
    expect(result.url).toBe("https://storage.example.com/binary");
  });

  it("handles error.text() failure gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.reject(new Error("Cannot read body")),
    });

    await expect(
      storagePut("test.pdf", Buffer.from("test"))
    ).rejects.toThrow("Storage upload failed (500 Internal Server Error): Internal Server Error");
  });
});

describe("storageGet", () => {
  it("returns presigned download URL", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ url: "https://storage.example.com/signed-url" }),
    });

    const result = await storageGet("uploads/test.pdf");

    expect(result.key).toBe("uploads/test.pdf");
    expect(result.url).toBe("https://storage.example.com/signed-url");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: "GET",
      })
    );
  });

  it("normalizes key for download URL", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ url: "https://storage.example.com/signed-url" }),
    });

    const result = await storageGet("///uploads/test.pdf");
    expect(result.key).toBe("uploads/test.pdf");
  });
});

describe("storage edge cases", () => {
  it("handles base URL that already ends with trailing slash (ensureTrailingSlash no-op branch)", async () => {
    mockEnv.forgeApiUrl = "https://api.example.com/"; // Already has trailing slash
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: "https://storage.example.com/test.pdf" }),
    });
    const result = await storagePut("test.pdf", Buffer.from("test"));
    expect(result.key).toBe("test.pdf");
  });

  it("uses 'file' as default filename when key resolves to empty string (|| 'file' branch)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: "https://storage.example.com/file" }),
    });
    // Empty key → split("/").pop() = "" → "" || "file" = "file"
    const result = await storagePut("", Buffer.from("test"));
    expect(result.url).toBe("https://storage.example.com/file");
  });
});

describe("storage config", () => {
  it("falls back to local storage when both credentials are absent", async () => {
    mockEnv.forgeApiUrl = "";
    mockEnv.forgeApiKey = "";

    // Both missing → local filesystem fallback (does not throw)
    const result = await storagePut("test.pdf", Buffer.from("test"));
    expect(result.key).toBe("test.pdf");
    expect(result.url).toMatch(/^http:\/\/localhost:\d+\/local-uploads\/test\.pdf$/);
  });

  it("throws when only apiKey is missing", async () => {
    mockEnv.forgeApiUrl = "https://api.example.com";
    mockEnv.forgeApiKey = "";

    await expect(
      storagePut("test.pdf", Buffer.from("test"))
    ).rejects.toThrow("Storage proxy credentials missing");
  });

  it("throws when only baseUrl is missing", async () => {
    mockEnv.forgeApiUrl = "";
    mockEnv.forgeApiKey = "test-api-key-123";

    await expect(
      storagePut("test.pdf", Buffer.from("test"))
    ).rejects.toThrow("Storage proxy credentials missing");
  });

  it("storageGet falls back to local URL when both credentials are absent", async () => {
    mockEnv.forgeApiUrl = "";
    mockEnv.forgeApiKey = "";

    const result = await storageGet("uploads/test.pdf");
    expect(result.key).toBe("uploads/test.pdf");
    expect(result.url).toMatch(/^http:\/\/localhost:\d+\/local-uploads\/uploads\/test\.pdf$/);
  });

  it("storagePut local mode uses custom PORT when set", async () => {
    mockEnv.forgeApiUrl = "";
    mockEnv.forgeApiKey = "";
    const originalPort = process.env.PORT;
    process.env.PORT = "8080";
    try {
      const result = await storagePut("test.pdf", Buffer.from("test"));
      expect(result.url).toContain("localhost:8080");
    } finally {
      if (originalPort === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = originalPort;
      }
    }
  });

  it("storageGet local mode uses custom PORT when set", async () => {
    mockEnv.forgeApiUrl = "";
    mockEnv.forgeApiKey = "";
    const originalPort = process.env.PORT;
    process.env.PORT = "9090";
    try {
      const result = await storageGet("test.pdf");
      expect(result.url).toContain("localhost:9090");
    } finally {
      if (originalPort === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = originalPort;
      }
    }
  });
});
