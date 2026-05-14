/**
 * Tests for server/_core/notification.ts
 * Covers: validatePayload, buildEndpointUrl (via notifyOwner), notifyOwner
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock ENV with vi.hoisted to ensure it's available before module load
const mockEnv = vi.hoisted(() => ({
  forgeApiUrl: "https://api.example.com",
  forgeApiKey: "test-api-key-123",
}));

vi.mock("./env", () => ({
  ENV: mockEnv,
}));

import { notifyOwner } from "./notification";

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.forgeApiUrl = "https://api.example.com";
  mockEnv.forgeApiKey = "test-api-key-123";
});

describe("notifyOwner - input validation", () => {
  it("throws BAD_REQUEST when title is empty string", async () => {
    await expect(
      notifyOwner({ title: "", content: "valid content" })
    ).rejects.toThrow(TRPCError);

    await expect(
      notifyOwner({ title: "", content: "valid content" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST when title is whitespace only", async () => {
    await expect(
      notifyOwner({ title: "   ", content: "valid content" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST when content is empty string", async () => {
    await expect(
      notifyOwner({ title: "valid title", content: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST when content is whitespace only", async () => {
    await expect(
      notifyOwner({ title: "valid title", content: "   " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST when title exceeds 1200 characters", async () => {
    await expect(
      notifyOwner({ title: "a".repeat(1201), content: "valid content" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST when content exceeds 20000 characters", async () => {
    await expect(
      notifyOwner({ title: "valid title", content: "a".repeat(20001) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("accepts title exactly at max length (1200 chars)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(
      notifyOwner({ title: "a".repeat(1200), content: "valid content" })
    ).resolves.toBe(true);
  });

  it("accepts content exactly at max length (20000 chars)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(
      notifyOwner({ title: "valid title", content: "a".repeat(20000) })
    ).resolves.toBe(true);
  });

  it("trims whitespace from title and content before validation", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const result = await notifyOwner({
      title: "  trimmed title  ",
      content: "  trimmed content  ",
    });
    expect(result).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.title).toBe("trimmed title");
    expect(body.content).toBe("trimmed content");
  });
});

describe("notifyOwner - configuration checks", () => {
  it("throws INTERNAL_SERVER_ERROR when forgeApiUrl is not configured", async () => {
    mockEnv.forgeApiUrl = "";
    await expect(
      notifyOwner({ title: "title", content: "content" })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("throws INTERNAL_SERVER_ERROR when forgeApiKey is not configured", async () => {
    mockEnv.forgeApiKey = "";
    await expect(
      notifyOwner({ title: "title", content: "content" })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

describe("notifyOwner - HTTP behavior", () => {
  it("returns true on successful response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const result = await notifyOwner({
      title: "Test title",
      content: "Test content",
    });
    expect(result).toBe(true);
  });

  it("calls correct endpoint URL with trailing slash base", async () => {
    mockEnv.forgeApiUrl = "https://api.example.com/";
    mockFetch.mockResolvedValueOnce({ ok: true });
    await notifyOwner({ title: "title", content: "content" });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("WebDevService/SendNotification");
  });

  it("calls correct endpoint URL without trailing slash base", async () => {
    mockEnv.forgeApiUrl = "https://api.example.com";
    mockFetch.mockResolvedValueOnce({ ok: true });
    await notifyOwner({ title: "title", content: "content" });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("WebDevService/SendNotification");
  });

  it("sends Authorization Bearer header", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await notifyOwner({ title: "title", content: "content" });
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.authorization).toBe("Bearer test-api-key-123");
  });

  it("returns false when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("error detail"),
    });
    const result = await notifyOwner({ title: "title", content: "content" });
    expect(result).toBe(false);
  });

  it("returns false when response.text() fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: () => Promise.reject(new Error("network error")),
    });
    const result = await notifyOwner({ title: "title", content: "content" });
    expect(result).toBe(false);
  });

  it("returns false when fetch throws (network error)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    const result = await notifyOwner({ title: "title", content: "content" });
    expect(result).toBe(false);
  });

  it("sends JSON body with title and content", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await notifyOwner({ title: "My Title", content: "My Content" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ title: "My Title", content: "My Content" });
  });
});
