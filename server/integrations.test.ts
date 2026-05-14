import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey, normalizeScopes } from "./integrations";

describe("integration API key helpers", () => {
  it("generates Sign API keys with a stable prefix and hashed storage value", () => {
    const generated = generateApiKey();

    expect(generated.apiKey).toMatch(/^hsign_sk_/);
    expect(generated.prefix).toBe(generated.apiKey.slice(0, 18));
    expect(generated.hash).toBe(hashApiKey(generated.apiKey));
    expect(generated.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.hash).not.toContain(generated.apiKey);
  });

  it("normalizes scopes to the supported integration scope set", () => {
    expect(normalizeScopes(["documents:read", "nope", 123, "api_keys:manage"])).toEqual([
      "documents:read",
      "api_keys:manage",
    ]);
  });

  it("returns no scopes for malformed stored JSON", () => {
    expect(normalizeScopes("documents:read")).toEqual([]);
    expect(normalizeScopes(null)).toEqual([]);
  });
});
