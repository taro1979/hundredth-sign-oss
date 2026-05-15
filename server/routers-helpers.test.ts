import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { ENV } from "./_core/env";
import { getAppUrlOrThrow } from "./routers/_helpers";

function mockRequest(headers: Record<string, string | string[]>, protocol = "https") {
  return { headers, protocol } as unknown as Request;
}

describe("getAppUrlOrThrow", () => {
  it("uses localhost request origin in development even when APP_URL is configured", () => {
    const originalAppUrl = ENV.appUrl;
    const originalIsProduction = ENV.isProduction;
    (ENV as any).appUrl = "http://localhost:4817";
    (ENV as any).isProduction = false;

    try {
      expect(
        getAppUrlOrThrow(mockRequest({ origin: "http://localhost:3015" })),
      ).toBe("http://localhost:3015");
    } finally {
      (ENV as any).appUrl = originalAppUrl;
      (ENV as any).isProduction = originalIsProduction;
    }
  });

  it("keeps APP_URL authoritative in production", () => {
    const originalAppUrl = ENV.appUrl;
    const originalIsProduction = ENV.isProduction;
    (ENV as any).appUrl = "https://sign.example.com";
    (ENV as any).isProduction = true;

    try {
      expect(
        getAppUrlOrThrow(mockRequest({ origin: "http://localhost:3015" })),
      ).toBe("https://sign.example.com");
    } finally {
      (ENV as any).appUrl = originalAppUrl;
      (ENV as any).isProduction = originalIsProduction;
    }
  });

  it("falls back to request host in development when APP_URL is empty", () => {
    const originalAppUrl = ENV.appUrl;
    const originalIsProduction = ENV.isProduction;
    (ENV as any).appUrl = "";
    (ENV as any).isProduction = false;

    try {
      expect(
        getAppUrlOrThrow(
          mockRequest({
            "x-forwarded-host": "preview.example.com",
            "x-forwarded-proto": "https",
          }),
        ),
      ).toBe("https://preview.example.com");
    } finally {
      (ENV as any).appUrl = originalAppUrl;
      (ENV as any).isProduction = originalIsProduction;
    }
  });
});
