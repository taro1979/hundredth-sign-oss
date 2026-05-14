/**
 * Integration tests for server/storage.ts — S3 storage boundary (IP-4)
 *
 * Tests the storage proxy HTTP client: URL construction, FormData upload,
 * signed-URL download, error handling, and missing-credentials guard.
 *
 * Strategy: mock globalThis.fetch so no real HTTP requests are made,
 * but the actual module code (URL building, headers, FormData) is exercised.
 *
 * AC: AC-I04
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Reset module state between tests (ENV is read at call time)
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// IP-4a: storagePut uploads file and returns {key, url}
// ---------------------------------------------------------------------------
describe("IP-4a: storagePut (AC-I04)", () => {
  it("builds correct upload URL and returns key + url on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://storage.example.com/files/test-doc.pdf" }),
      text: async () => "ok",
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.doMock("./_core/env", () => ({
      ENV: {
        forgeApiUrl: "https://storage-proxy.example.com",
        forgeApiKey: "test-api-key-123",
      },
    }));

    const { storagePut } = await import("./storage");
    const result = await storagePut("documents/test-doc.pdf", Buffer.from("PDF content"), "application/pdf");

    // Verify result structure
    expect(result.key).toBe("documents/test-doc.pdf");
    expect(result.url).toBe("https://storage.example.com/files/test-doc.pdf");

    // Verify fetch was called with POST and correct URL
    expect(mockFetch).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl.toString()).toContain("v1/storage/upload");
    expect(calledUrl.toString()).toContain("documents%2Ftest-doc.pdf");
    expect(calledInit.method).toBe("POST");
    expect(calledInit.headers).toMatchObject({
      Authorization: "Bearer test-api-key-123",
    });
  });

  it("normalizes leading slashes in key", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://storage.example.com/files/normalized.pdf" }),
      text: async () => "ok",
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.doMock("./_core/env", () => ({
      ENV: {
        forgeApiUrl: "https://storage-proxy.example.com/",
        forgeApiKey: "test-key",
      },
    }));

    const { storagePut } = await import("./storage");
    const result = await storagePut("///normalized.pdf", Buffer.from("data"), "text/plain");
    expect(result.key).toBe("normalized.pdf");
  });

  it("throws when upload response is not ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "Access denied",
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.doMock("./_core/env", () => ({
      ENV: {
        forgeApiUrl: "https://storage-proxy.example.com",
        forgeApiKey: "bad-key",
      },
    }));

    const { storagePut } = await import("./storage");
    await expect(
      storagePut("test.pdf", Buffer.from("data"), "application/pdf"),
    ).rejects.toThrow(/403/);
  });

  it("throws when storage credentials are missing", async () => {
    // isLocalMode() returns true only when BOTH forgeApiUrl AND forgeApiKey are empty.
    // Setting forgeApiUrl to a non-empty value forces S3 mode, then empty forgeApiKey
    // causes getStorageConfig() to throw "Storage proxy credentials missing".
    vi.doMock("./_core/env", () => ({
      ENV: {
        forgeApiUrl: "https://storage-proxy.example.com",
        forgeApiKey: "",
      },
    }));

    const { storagePut } = await import("./storage");
    await expect(
      storagePut("test.pdf", Buffer.from("data")),
    ).rejects.toThrow(/credentials missing/i);
  });
});

// ---------------------------------------------------------------------------
// IP-4b: storageGet retrieves signed download URL
// ---------------------------------------------------------------------------
describe("IP-4b: storageGet (AC-I04)", () => {
  it("builds correct download URL and returns key + url", async () => {
    const signedUrl = "https://storage.example.com/signed/test-doc.pdf?token=abc123";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: signedUrl }),
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.doMock("./_core/env", () => ({
      ENV: {
        forgeApiUrl: "https://storage-proxy.example.com",
        forgeApiKey: "test-api-key-456",
      },
    }));

    const { storageGet } = await import("./storage");
    const result = await storageGet("documents/test-doc.pdf");

    expect(result.key).toBe("documents/test-doc.pdf");
    expect(result.url).toBe(signedUrl);

    // Verify GET request to download URL endpoint
    expect(mockFetch).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl.toString()).toContain("v1/storage/downloadUrl");
    expect(calledUrl.toString()).toContain("documents%2Ftest-doc.pdf");
    expect(calledInit?.method ?? "GET").toBe("GET");
    expect((calledInit?.headers as Record<string, string>)?.Authorization).toBe("Bearer test-api-key-456");
  });
});
