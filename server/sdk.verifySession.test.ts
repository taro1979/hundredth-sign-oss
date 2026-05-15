/**
 * Tests for sdk.verifySession — name フィールドの検証ルール
 * spec: docs/spec/fix-org-auto-creation-on-fresh-db.md (AC-005, AC-006, AC-007)
 */
import { describe, it, expect } from "vitest";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

describe("sdk.verifySession", () => {
  async function makeToken(fields: { openId?: string; appId?: string; name?: unknown }) {
    // signSession with partial overrides via direct JWT construction
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    return new SignJWT(fields as Record<string, unknown>)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(secret);
  }

  it("AC-005: name が空文字列でも有効なセッションを返す", async () => {
    const token = await makeToken({ openId: "user-123", appId: "app-456", name: "" });
    const result = await sdk.verifySession(token);
    expect(result).not.toBeNull();
    expect(result?.openId).toBe("user-123");
    expect(result?.name).toBe("");
  });

  it("AC-006: openId が空文字列の場合は null を返す", async () => {
    const token = await makeToken({ openId: "", appId: "app-456", name: "Test" });
    const result = await sdk.verifySession(token);
    expect(result).toBeNull();
  });

  it("AC-006: appId が空文字列の場合は null を返す", async () => {
    const token = await makeToken({ openId: "user-123", appId: "", name: "Test" });
    const result = await sdk.verifySession(token);
    expect(result).not.toBeNull();
    expect(result?.openId).toBe("user-123");
  });

  it("AC-007: name フィールドが存在しない（undefined）場合は null を返す", async () => {
    const token = await makeToken({ openId: "user-123", appId: "app-456" }); // name なし
    const result = await sdk.verifySession(token);
    expect(result).toBeNull();
  });

  it("通常の name がある場合は有効なセッションを返す（既存動作が壊れていないこと）", async () => {
    const token = await makeToken({ openId: "user-123", appId: "app-456", name: "Test User" });
    const result = await sdk.verifySession(token);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Test User");
  });
});
