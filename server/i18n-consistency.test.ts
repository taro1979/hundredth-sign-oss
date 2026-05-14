import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const LOCALE_ROOT = path.resolve(process.cwd(), "client/public/locales");
const UI_LOCALES = ["en", "ja", "th", "zh-CN"] as const;

function loadCommon(locale: string) {
  const file = path.join(LOCALE_ROOT, locale, "common.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}

function flattenKeys(
  value: unknown,
  prefix = "",
  out: string[] = [],
): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (prefix) out.push(prefix);
    return out;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${key}` : key;
    flattenKeys(child, next, out);
  }
  return out;
}

describe("i18n locale consistency", () => {
  it("keeps keyset identical across en/ja/th/zh-CN", () => {
    const keysets = UI_LOCALES.map((locale) => ({
      locale,
      keys: new Set(flattenKeys(loadCommon(locale))),
    }));

    const base = keysets.find((entry) => entry.locale === "en");
    expect(base).toBeTruthy();

    for (const { locale, keys } of keysets) {
      const missing = [...(base?.keys ?? [])].filter((key) => !keys.has(key));
      const extra = [...keys].filter((key) => !(base?.keys ?? new Set()).has(key));
      expect(
        { locale, missing, extra },
        `${locale} has key drift from en/common.json`,
      ).toEqual({ locale, missing: [], extra: [] });
    }
  });
});
