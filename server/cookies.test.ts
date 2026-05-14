/**
 * Tests for server/_core/cookies.ts (AC-008)
 * Covers: AC-003 (sameSite=lax), httpOnly=true, secure flag based on protocol
 */
import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "./_core/cookies";

function makeReq(
  overrides: Partial<{
    protocol: string;
    headers: Record<string, string>;
    hostname: string;
  }> = {}
): Request {
  return {
    protocol: "http",
    headers: {},
    hostname: "localhost",
    ...overrides,
  } as unknown as Request;
}

describe("getSessionCookieOptions (fix-auth-session-security AC-008)", () => {
  it("returns sameSite: 'lax' (AC-003)", () => {
    const options = getSessionCookieOptions(makeReq());
    expect(options.sameSite).toBe("lax");
  });

  it("returns httpOnly: true", () => {
    const options = getSessionCookieOptions(makeReq());
    expect(options.httpOnly).toBe(true);
  });

  it("returns secure: true for HTTPS requests", () => {
    const options = getSessionCookieOptions(makeReq({ protocol: "https" }));
    expect(options.secure).toBe(true);
  });

  it("returns secure: false for HTTP requests", () => {
    const options = getSessionCookieOptions(makeReq({ protocol: "http" }));
    expect(options.secure).toBe(false);
  });

  it("returns secure: true when x-forwarded-proto is https", () => {
    const options = getSessionCookieOptions(
      makeReq({
        protocol: "http",
        headers: { "x-forwarded-proto": "https" },
      })
    );
    expect(options.secure).toBe(true);
  });

  it("returns secure: false when x-forwarded-proto is http", () => {
    const options = getSessionCookieOptions(
      makeReq({
        protocol: "http",
        headers: { "x-forwarded-proto": "http" },
      })
    );
    expect(options.secure).toBe(false);
  });

  it("returns secure: true when x-forwarded-proto is array containing https", () => {
    const req = {
      protocol: "http",
      headers: { "x-forwarded-proto": ["https", "http"] },
      hostname: "localhost",
    } as unknown as Request;
    const options = getSessionCookieOptions(req);
    expect(options.secure).toBe(true);
  });

  it("returns secure: false when x-forwarded-proto is array with only http", () => {
    const req = {
      protocol: "http",
      headers: { "x-forwarded-proto": ["http"] },
      hostname: "localhost",
    } as unknown as Request;
    const options = getSessionCookieOptions(req);
    expect(options.secure).toBe(false);
  });
});
