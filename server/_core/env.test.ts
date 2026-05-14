import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";

// ==================== auth-session-security: env & cookie tests ====================

describe("auth-session-security: ENV configuration", () => {
  it("cookieSecret requires JWT_SECRET with minimum 22 chars in production (AC-001)", async () => {
    // ENV.cookieSecret reads JWT_SECRET via requireEnv("JWT_SECRET", 22) in non-test mode.
    // In test mode it uses process.env.JWT_SECRET if set, otherwise falls back to a hardcoded test secret.
    // This test validates that cookieSecret is defined and non-empty.
    const { ENV } = await import("./env");
    expect(ENV.cookieSecret.length).toBeGreaterThan(0);
    // In production, requireEnv enforces >= 22 chars; in test mode we just verify it's set.
    if (process.env.NODE_ENV !== "test") {
      expect(ENV.cookieSecret.length).toBeGreaterThanOrEqual(22);
    }
  });

  it("databaseUrl is defined from environment variable (AC-002)", async () => {
    const { ENV } = await import("./env");
    // Uses requireEnv("DATABASE_URL", 20) in production — throws if < 20 chars.
    // In test mode falls back to process.env.DATABASE_URL ?? "".
    expect(typeof ENV.databaseUrl).toBe("string");
  });

  it("appUrl strips trailing slashes (AC-003)", async () => {
    const { ENV } = await import("./env");
    // appUrl is cleaned via .replace(/\/+$/, "")
    expect(ENV.appUrl).not.toMatch(/\/$/);
  });
});

describe("auth-session-security: cookie security options", () => {
  it("session cookie uses SameSite=lax to prevent CSRF (AC-004)", async () => {
    const { getSessionCookieOptions } = await import("./cookies");
    const mockReq = { protocol: "https", headers: {} } as unknown as Request;
    const options = getSessionCookieOptions(mockReq);
    expect(options.sameSite).toBe("lax");
  });

  it("session cookie uses httpOnly=true (AC-005)", async () => {
    const { getSessionCookieOptions } = await import("./cookies");
    const mockReq = { protocol: "https", headers: {} } as unknown as Request;
    const options = getSessionCookieOptions(mockReq);
    expect(options.httpOnly).toBe(true);
  });

  it("session cookie sets secure=true on HTTPS requests (AC-006)", async () => {
    const { getSessionCookieOptions } = await import("./cookies");
    const httpsReq = { protocol: "https", headers: {} } as unknown as Request;
    const options = getSessionCookieOptions(httpsReq);
    expect(options.secure).toBe(true);
  });

  it("session cookie sets secure=false on HTTP requests (AC-007)", async () => {
    const { getSessionCookieOptions } = await import("./cookies");
    const httpReq = { protocol: "http", headers: {} } as unknown as Request;
    const options = getSessionCookieOptions(httpReq);
    expect(options.secure).toBe(false);
  });

  it("session cookie detects HTTPS from x-forwarded-proto header (AC-008)", async () => {
    const { getSessionCookieOptions } = await import("./cookies");
    const behindLbReq = {
      protocol: "http",
      headers: { "x-forwarded-proto": "https" },
    } as unknown as Request;
    const options = getSessionCookieOptions(behindLbReq);
    expect(options.secure).toBe(true);
  });
});

describe("env-startup-error-message: requireEnv error messages", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("error message includes [STARTUP] prefix (AC-001)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "short");
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    await expect(import("./env")).rejects.toThrow("[STARTUP]");
  });

  it("error message includes Fix instruction for JWT_SECRET (AC-002)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "short");
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    await expect(import("./env")).rejects.toThrow(
      "Fix: Set JWT_SECRET in your deployment environment variables."
    );
  });

  it("error message includes openssl command for JWT_SECRET (AC-003)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "short");
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    await expect(import("./env")).rejects.toThrow("openssl rand -base64 48");
  });

  it("error message includes DATABASE_URL format hint (AC-004)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "test-secret-key-minimum-32-chars!!");
    vi.stubEnv("DATABASE_URL", "short");
    await expect(import("./env")).rejects.toThrow("mysql://user:pass@host:port/dbname");
  });

  it("NODE_ENV=test does not throw even with short JWT_SECRET (AC-005)", async () => {
    vi.resetModules();
    vi.stubEnv("JWT_SECRET", "short");
    const { ENV } = await import("./env");
    expect(ENV.cookieSecret.length).toBeGreaterThan(0);
  });

  it("error message does not include the actual value of the env var (AC-006)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    const secretValue = "my-short-secret";
    vi.stubEnv("JWT_SECRET", secretValue);
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    try {
      await import("./env");
      expect.fail("Should have thrown");
    } catch (err) {
      expect((err as Error).message).not.toContain(secretValue);
    }
  });

  it("22-char JWT_SECRET starts container without error (AC-008)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    vi.stubEnv("APP_URL", "https://app.example.com");
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    const { ENV } = await import("./env");
    expect(ENV.cookieSecret.length).toBe(22);
  });

  it("error message says 'not set' when JWT_SECRET is absent in production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    const orig = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      await expect(import("./env")).rejects.toThrow("not set");
    } finally {
      if (orig !== undefined) process.env.JWT_SECRET = orig;
    }
  });

  it("21-char JWT_SECRET throws [STARTUP] error (AC-009)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a".repeat(21));
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    await expect(import("./env")).rejects.toThrow("[STARTUP]");
  });

  it("H-21: missing APP_URL in production falls back to empty string", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VITE_APP_URL", "");
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    const { ENV } = await import("./env");
    expect(ENV.appUrl).toBe("");
  });

  it("H-21: development ENV uses http://localhost:5000 fallback when APP_URL unset", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VITE_APP_URL", "");
    const { ENV } = await import("./env");
    expect(ENV.appUrl).toBe("http://localhost:5000");
  });
});

describe("manus-app-url-optional v2: startup warning (AC-006)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("warns when APP_URL is empty in non-test environment", async () => {
    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VITE_APP_URL", "");
    // In development, fallback is http://localhost:5000, so no warning
    // Test production instead where fallback is ""
    warnSpy.mockRestore();

    vi.resetModules();
    const warnSpy2 = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VITE_APP_URL", "");
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    await import("./env");
    expect(warnSpy2).toHaveBeenCalledWith(
      expect.stringContaining("[STARTUP] APP_URL is not set")
    );
    warnSpy2.mockRestore();
  });

  it("does not warn when APP_URL is set", async () => {
    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@host:3306/db");
    vi.stubEnv("APP_URL", "https://app.example.com");
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    await import("./env");
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("[STARTUP] APP_URL is not set")
    );
    warnSpy.mockRestore();
  });
});

describe("env.ts uncovered branches", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("VITE_APP_ID is read from env when set (branch 0 — ?? left side)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VITE_APP_ID", "my-app-id");
    const { ENV } = await import("./env");
    expect(ENV.appId).toBe("my-app-id");
  });

  it("cookieSecret uses hardcoded test fallback when JWT_SECRET is unset in test mode", async () => {
    // In test mode, cookieSecret uses: process.env.JWT_SECRET ?? "test-secret-key-minimum-32-chars!!"
    // So when JWT_SECRET is absent, the hardcoded fallback is used
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      const { ENV } = await import("./env");
      // Falls back to the hardcoded test secret
      expect(ENV.cookieSecret).toBe("test-secret-key-minimum-32-chars!!");
    } finally {
      if (original !== undefined) {
        process.env.JWT_SECRET = original;
      }
    }
  });

  it("ENV.appId falls back to empty string when VITE_APP_ID is undefined (appId ?? \"\" branch)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    // Delete VITE_APP_ID so it is undefined (not empty string) — triggers the ?? "" fallback
    const original = process.env.VITE_APP_ID;
    delete process.env.VITE_APP_ID;
    try {
      const { ENV } = await import("./env");
      expect(ENV.appId).toBe("");
    } finally {
      if (original !== undefined) {
        process.env.VITE_APP_ID = original;
      }
    }
  });
});

describe("piiEncryptionKeyPrev validation (H-07)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws on startup when PII_ENCRYPTION_KEY_PREV is set but not 64 hex chars (non-test env)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("PII_ENCRYPTION_KEY_PREV", "tooshort");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://localhost/test_db");
    await expect(import("./env")).rejects.toThrow("PII_ENCRYPTION_KEY_PREV must be exactly 64 hex chars");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts empty PII_ENCRYPTION_KEY_PREV without throwing", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PII_ENCRYPTION_KEY_PREV", "");
    const { ENV } = await import("./env");
    expect(ENV.piiEncryptionKeyPrev).toBe("");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts valid 64-char hex PII_ENCRYPTION_KEY_PREV", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PII_ENCRYPTION_KEY_PREV", "a".repeat(64));
    const { ENV } = await import("./env");
    expect(ENV.piiEncryptionKeyPrev).toBe("a".repeat(64));
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe("storageEncryptionKeyPrev validation (H-07)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws on startup when STORAGE_ENCRYPTION_KEY_PREV is set but not 64 hex chars", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("STORAGE_ENCRYPTION_KEY_PREV", "bad_key");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://localhost/test_db");
    await expect(import("./env")).rejects.toThrow("STORAGE_ENCRYPTION_KEY_PREV must be exactly 64 hex chars");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts valid 64-char hex STORAGE_ENCRYPTION_KEY_PREV", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("STORAGE_ENCRYPTION_KEY_PREV", "b".repeat(64));
    const { ENV } = await import("./env");
    expect(ENV.storageEncryptionKeyPrev).toBe("b".repeat(64));
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe("redisUrl (H-06)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to empty string when REDIS_URL not set", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.REDIS_URL;
    const { ENV } = await import("./env");
    expect(ENV.redisUrl).toBe("");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads REDIS_URL when set", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    const { ENV } = await import("./env");
    expect(ENV.redisUrl).toBe("redis://localhost:6379");
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe("piiEncryptionKey validation (H-07)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("warns and returns empty when PII_ENCRYPTION_KEY is set but not 64 hex chars in production (AC-006)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PII_ENCRYPTION_KEY", "tooshort");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://localhost/test_db");
    vi.stubEnv("APP_URL", "https://app.example.com");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ENV } = await import("./env");
    expect(ENV.piiEncryptionKey).toBe("");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("PII_ENCRYPTION_KEY must be exactly 64 hex chars"),
    );
    warnSpy.mockRestore();
  });

  it("returns empty string in production when PII_ENCRYPTION_KEY is not set (encryption disabled)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://localhost/test_db");
    vi.stubEnv("APP_URL", "https://app.example.com");
    const origPii = process.env.PII_ENCRYPTION_KEY;
    delete process.env.PII_ENCRYPTION_KEY;
    try {
      const { ENV } = await import("./env");
      expect(ENV.piiEncryptionKey).toBe("");
    } finally {
      if (origPii !== undefined) process.env.PII_ENCRYPTION_KEY = origPii;
    }
  });

  it("accepts valid 64-char hex PII_ENCRYPTION_KEY in production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://localhost/test_db");
    vi.stubEnv("APP_URL", "https://app.example.com");
    const { ENV } = await import("./env");
    expect(ENV.piiEncryptionKey).toBe("a".repeat(64));
  });
});

describe("storageEncryptionKey validation (H-07)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws when STORAGE_ENCRYPTION_KEY is set but not 64 hex chars in production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("STORAGE_ENCRYPTION_KEY", "tooshort");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://localhost/test_db");
    vi.stubEnv("APP_URL", "https://app.example.com");
    await expect(import("./env")).rejects.toThrow("STORAGE_ENCRYPTION_KEY must be exactly 64 hex chars");
  });

  it("warns in production when STORAGE_ENCRYPTION_KEY is not set (FR-003)", async () => {
    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://localhost/test_db");
    vi.stubEnv("APP_URL", "https://app.example.com");
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    const origStorage = process.env.STORAGE_ENCRYPTION_KEY;
    delete process.env.STORAGE_ENCRYPTION_KEY;
    try {
      await import("./env");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("STORAGE_ENCRYPTION_KEY is not set"),
      );
    } finally {
      if (origStorage !== undefined) process.env.STORAGE_ENCRYPTION_KEY = origStorage;
      warnSpy.mockRestore();
    }
  });

  it("accepts valid 64-char hex STORAGE_ENCRYPTION_KEY in production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STORAGE_ENCRYPTION_KEY", "b".repeat(64));
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    vi.stubEnv("JWT_SECRET", "a".repeat(22));
    vi.stubEnv("DATABASE_URL", "mysql://localhost/test_db");
    vi.stubEnv("APP_URL", "https://app.example.com");
    const { ENV } = await import("./env");
    expect(ENV.storageEncryptionKey).toBe("b".repeat(64));
  });
});

describe("auth-session-security: session duration constants", () => {
  it("SESSION_DURATION_MS is 24 hours (AC-009)", async () => {
    const { SESSION_DURATION_MS } = await import("../../shared/const");
    expect(SESSION_DURATION_MS).toBe(1000 * 60 * 60 * 24);
  });

  it("ONE_YEAR_MS is 365 days (AC-010)", async () => {
    const { ONE_YEAR_MS } = await import("../../shared/const");
    expect(ONE_YEAR_MS).toBe(1000 * 60 * 60 * 24 * 365);
  });

  it("local password sessions use SESSION_DURATION_MS as the 24h baseline", async () => {
    const { SESSION_DURATION_MS, ONE_YEAR_MS } = await import("../../shared/const");
    expect(SESSION_DURATION_MS).toBe(1000 * 60 * 60 * 24);
    expect(ONE_YEAR_MS).toBeGreaterThan(SESSION_DURATION_MS);
  });
});
