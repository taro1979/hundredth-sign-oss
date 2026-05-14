import { describe, it, expect, vi } from "vitest";

// This test file is isolated to test getDb connection error handling
// without affecting other db.test.ts tests via vi.resetModules()

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => { throw new Error("Connection refused"); }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), desc: vi.fn(), asc: vi.fn(), and: vi.fn(),
  count: vi.fn(), inArray: vi.fn(), ne: vi.fn(), sql: vi.fn(),
}));

vi.mock("../drizzle/schema", () => ({
  users: {}, documents: {}, signatureRequests: {}, signatureFields: {},
  templates: {}, templateFields: {}, contacts: {}, contactCategories: {},
  contactGroups: {}, contactGroupMembers: {}, activityLogs: {}, faqs: {},
  inquiries: {}, emailLogs: {}, internalApprovals: {},
}));

vi.mock("./_core/env", () => ({ ENV: {} }));

describe("getDb - connection error", () => {
  it("returns null when drizzle throws", async () => {
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test";
    const { getDb } = await import("./db");
    const db = await getDb();
    expect(db).toBeNull();
  });
});
