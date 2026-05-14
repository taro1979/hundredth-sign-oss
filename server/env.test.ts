/**
 * Tests for server/_core/env.ts ENV validation (AC-007)
 * Covers: AC-001 (JWT_SECRET required), AC-002 (JWT_SECRET min length),
 *         AC-005 (SESSION_DURATION_MS = 24h), AC-006 (DATABASE_URL required)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { SESSION_DURATION_MS } from "../shared/const";

describe("ENV validation (fix-auth-session-security)", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("SESSION_DURATION_MS is exactly 24 hours (AC-005)", () => {
    expect(SESSION_DURATION_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("exits when JWT_SECRET is not set in production (AC-001)", async () => {
    const savedNodeEnv = process.env.NODE_ENV;
    const savedSecret = process.env.JWT_SECRET;
    const savedDbUrl = process.env.DATABASE_URL;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.JWT_SECRET;
      // Provide DATABASE_URL so we isolate the JWT_SECRET error
      process.env.DATABASE_URL = "mysql://user:pass@localhost:3306/testdb";
      vi.resetModules();
      await expect(import("./_core/env")).rejects.toThrow(/JWT_SECRET/);
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
      if (savedSecret !== undefined) process.env.JWT_SECRET = savedSecret;
      else delete process.env.JWT_SECRET;
      if (savedDbUrl !== undefined) process.env.DATABASE_URL = savedDbUrl;
      else delete process.env.DATABASE_URL;
    }
  });

  it("exits when JWT_SECRET is shorter than 32 chars (AC-002)", async () => {
    const savedNodeEnv = process.env.NODE_ENV;
    const savedSecret = process.env.JWT_SECRET;
    const savedDbUrl = process.env.DATABASE_URL;
    try {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "short-secret"; // < 32 chars
      process.env.DATABASE_URL = "mysql://user:pass@localhost:3306/testdb";
      vi.resetModules();
      await expect(import("./_core/env")).rejects.toThrow(/JWT_SECRET/);
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
      if (savedSecret !== undefined) process.env.JWT_SECRET = savedSecret;
      else delete process.env.JWT_SECRET;
      if (savedDbUrl !== undefined) process.env.DATABASE_URL = savedDbUrl;
      else delete process.env.DATABASE_URL;
    }
  });

  it("exits when DATABASE_URL is not set in production (AC-006)", async () => {
    const savedNodeEnv = process.env.NODE_ENV;
    const savedSecret = process.env.JWT_SECRET;
    const savedDbUrl = process.env.DATABASE_URL;
    try {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "a-valid-secret-key-that-is-at-least-32-chars!";
      delete process.env.DATABASE_URL;
      vi.resetModules();
      await expect(import("./_core/env")).rejects.toThrow(/DATABASE_URL/);
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
      if (savedSecret !== undefined) process.env.JWT_SECRET = savedSecret;
      else delete process.env.JWT_SECRET;
      if (savedDbUrl !== undefined) process.env.DATABASE_URL = savedDbUrl;
      else delete process.env.DATABASE_URL;
    }
  });

  it("does not throw in test environment even without JWT_SECRET", async () => {
    // Confirm NODE_ENV=test bypasses validation (existing behavior)
    const savedNodeEnv = process.env.NODE_ENV;
    const savedSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = "test";
      delete process.env.JWT_SECRET;
      vi.resetModules();
      // Should not throw
      const mod = await import("./_core/env");
      expect(mod.ENV).toBeDefined();
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
      if (savedSecret !== undefined) process.env.JWT_SECRET = savedSecret;
      else delete process.env.JWT_SECRET;
    }
  });
});
