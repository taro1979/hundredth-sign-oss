/**
 * Tests for server/_core/systemRouter.ts
 * Covers: health query, notifyOwner mutation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock notifyOwner
const mockNotifyOwner = vi.fn();
vi.mock("./notification", () => ({
  notifyOwner: (...args: any[]) => mockNotifyOwner(...args),
}));

import { systemRouter } from "./systemRouter";

// Minimal context for superAdmin
function makeSuperAdminCtx() {
  return {
    user: { id: "admin-1", isSuperAdmin: true, email: "admin@example.com" },
    req: {},
    db: {} as any,
    organization: null,
  } as any;
}

function makePublicCtx() {
  return {
    user: null,
    req: {},
    db: {} as any,
    organization: null,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("systemRouter.health", () => {
  it("returns ok: true with any valid timestamp", async () => {
    const caller = systemRouter.createCaller(makePublicCtx());
    const result = await caller.health({ timestamp: Date.now() });
    expect(result).toEqual({ ok: true });
  });

  it("returns ok: true with timestamp 0", async () => {
    const caller = systemRouter.createCaller(makePublicCtx());
    const result = await caller.health({ timestamp: 0 });
    expect(result).toEqual({ ok: true });
  });

  it("throws when timestamp is negative", async () => {
    const caller = systemRouter.createCaller(makePublicCtx());
    await expect(caller.health({ timestamp: -1 })).rejects.toThrow();
  });
});

describe("systemRouter.notifyOwner", () => {
  it("returns success: true when notifyOwner delivers", async () => {
    mockNotifyOwner.mockResolvedValueOnce(true);
    const caller = systemRouter.createCaller(makeSuperAdminCtx());
    const result = await caller.notifyOwner({
      title: "Test title",
      content: "Test content",
    });
    expect(result).toEqual({ success: true });
    expect(mockNotifyOwner).toHaveBeenCalledWith({
      title: "Test title",
      content: "Test content",
    });
  });

  it("returns success: false when notifyOwner fails to deliver", async () => {
    mockNotifyOwner.mockResolvedValueOnce(false);
    const caller = systemRouter.createCaller(makeSuperAdminCtx());
    const result = await caller.notifyOwner({
      title: "title",
      content: "content",
    });
    expect(result).toEqual({ success: false });
  });

  it("throws FORBIDDEN for non-super-admin user", async () => {
    const caller = systemRouter.createCaller({
      ...makePublicCtx(),
      user: { id: "user-1", isSuperAdmin: false, email: "user@example.com" },
    });
    await expect(
      caller.notifyOwner({ title: "title", content: "content" })
    ).rejects.toThrow();
  });

  it("throws FORBIDDEN for unauthenticated user", async () => {
    const caller = systemRouter.createCaller(makePublicCtx());
    await expect(
      caller.notifyOwner({ title: "title", content: "content" })
    ).rejects.toThrow();
  });
});
