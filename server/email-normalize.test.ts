import { describe, it, expect } from "vitest";
import { normalizeEmail, emailsMatch } from "@shared/email";

describe("normalizeEmail", () => {
  it("returns null for falsy inputs", () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });

  it("returns null for invalid emails (no @)", () => {
    expect(normalizeEmail("notanemail")).toBeNull();
    expect(normalizeEmail("@domain.com")).toBeNull();
    expect(normalizeEmail("user@")).toBeNull();
  });

  it("lower-cases the entire address", () => {
    expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("strips +alias from local part", () => {
    expect(normalizeEmail("user+tag@example.com")).toBe("user@example.com");
    expect(normalizeEmail("yk.saikyou+1@gmail.com")).toBe("yksaikyou@gmail.com");
    expect(normalizeEmail("user+long+nested@example.com")).toBe("user@example.com");
  });

  it("removes dots from Gmail local part", () => {
    expect(normalizeEmail("y.k.saikyou@gmail.com")).toBe("yksaikyou@gmail.com");
    expect(normalizeEmail("y.k.saikyou@googlemail.com")).toBe("yksaikyou@googlemail.com");
  });

  it("does NOT remove dots for non-Gmail domains", () => {
    expect(normalizeEmail("first.last@company.com")).toBe("first.last@company.com");
  });

  it("handles combined alias + dots for Gmail", () => {
    expect(normalizeEmail("y.k.saikyou+test@gmail.com")).toBe("yksaikyou@gmail.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });
});

describe("emailsMatch", () => {
  it("returns true for exact match (case-insensitive)", () => {
    expect(emailsMatch("user@example.com", "USER@example.com")).toBe(true);
  });

  it("returns true for +alias match", () => {
    expect(emailsMatch("user+tag@example.com", "user@example.com")).toBe(true);
    expect(emailsMatch("yk.saikyou+1@gmail.com", "yk.saikyou@gmail.com")).toBe(true);
    expect(emailsMatch("yk.saikyou+1@gmail.com", "yksaikyou@gmail.com")).toBe(true);
  });

  it("returns true for Gmail dot variants", () => {
    expect(emailsMatch("y.k.saikyou@gmail.com", "yksaikyou@gmail.com")).toBe(true);
    expect(emailsMatch("yk.saikyou@gmail.com", "y.k.s.a.i.k.y.o.u@gmail.com")).toBe(true);
  });

  it("returns false for different users", () => {
    expect(emailsMatch("alice@example.com", "bob@example.com")).toBe(false);
  });

  it("returns false for different domains", () => {
    expect(emailsMatch("user@gmail.com", "user@yahoo.com")).toBe(false);
  });

  it("returns false when either is null/undefined", () => {
    expect(emailsMatch(null, "user@example.com")).toBe(false);
    expect(emailsMatch("user@example.com", null)).toBe(false);
    expect(emailsMatch(null, null)).toBe(false);
  });

  it("returns false for dots in non-Gmail domains (different meaning)", () => {
    expect(emailsMatch("user.name@company.com", "username@company.com")).toBe(false);
  });

  it("returns true for +alias in non-Gmail (alias stripped, dots kept)", () => {
    expect(emailsMatch("user+tag@company.com", "user@company.com")).toBe(true);
  });
});
