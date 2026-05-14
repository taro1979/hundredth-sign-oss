import { describe, it, expect } from "vitest";
import { resolveSignPageLocale, resolveUiLocale } from "../shared/locales";

describe("resolveUiLocale mapping", () => {
  it("maps ja variants to ja", () => {
    expect(resolveUiLocale("ja")).toBe("ja");
    expect(resolveUiLocale("ja-JP")).toBe("ja");
  });

  it("maps en variants to en", () => {
    expect(resolveUiLocale("en")).toBe("en");
    expect(resolveUiLocale("en-US")).toBe("en");
  });

  it("maps th variants to th", () => {
    expect(resolveUiLocale("th")).toBe("th");
    expect(resolveUiLocale("th-TH")).toBe("th");
  });

  it("maps Chinese variants to zh-CN", () => {
    expect(resolveUiLocale("zh-CN")).toBe("zh-CN");
    expect(resolveUiLocale("zh-TW")).toBe("zh-CN");
    expect(resolveUiLocale("zh")).toBe("zh-CN");
  });

  it("falls back to en for unsupported or empty locales", () => {
    expect(resolveUiLocale("es")).toBe("en");
    expect(resolveUiLocale("es-ES")).toBe("en");
    expect(resolveUiLocale("fr")).toBe("en");
    expect(resolveUiLocale("de")).toBe("en");
    expect(resolveUiLocale("ko")).toBe("en");
    expect(resolveUiLocale("ar")).toBe("en");
    expect(resolveUiLocale(undefined)).toBe("en");
    expect(resolveUiLocale(null)).toBe("en");
    expect(resolveUiLocale("")).toBe("en");
  });
});

describe("resolveSignPageLocale priority", () => {
  it("uses URL locale before browser locale", () => {
    expect(resolveSignPageLocale("en", "ja")).toBe("ja");
    expect(resolveSignPageLocale("ja", "en")).toBe("en");
    expect(resolveSignPageLocale("en", "th")).toBe("th");
    expect(resolveSignPageLocale("th", "en")).toBe("en");
    expect(resolveSignPageLocale("zh-TW", "en")).toBe("en");
  });

  it("falls back to browser locale when URL locale is missing or unsupported", () => {
    expect(resolveSignPageLocale("ja", undefined)).toBe("ja");
    expect(resolveSignPageLocale("th", undefined)).toBe("th");
    expect(resolveSignPageLocale("ja", "../../etc/passwd")).toBe("ja");
  });

  it("falls back to en when neither URL nor browser has a supported locale", () => {
    expect(resolveSignPageLocale("es", undefined)).toBe("en");
    expect(resolveSignPageLocale(undefined, "es")).toBe("en");
    expect(resolveSignPageLocale(undefined, undefined)).toBe("en");
  });
});
