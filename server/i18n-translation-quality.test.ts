import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const LOCALE_ROOT = path.resolve(process.cwd(), "client/public/locales");
const TARGET_LOCALES = ["ja", "th", "zh-CN"] as const;

const ALLOWED_ENGLISH_VALUE_PATTERNS = [
  /^Hundredth Sign/i,
  /^INFIBILITIS CO\., LTD\.$/,
  /^PDF$/i,
  /^IP$/i,
  /^TLS 1\.3$/i,
  /^AES-?256$/i,
  /^WORM$/i,
  /^CC$/i,
  /^X\.509$/i,
  /^Zero AI Training$/i,
  /^FAQ$/i,
  /^ID$/i,
  /^INFIBILITIS CO\., LTD\.$/i,
  /^20\+$/i,
  /^1\/100$/i,
  /^\d[\d,]*\+?$/i,
  /^[A-Za-z0-9_.-]+\.pdf$/i,
  /^\{\{(from|start)\}\}\s*[~〜]\s*\{\{(to|end)\}\}$/i,
  // Email addresses are not translated
  /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i,
  // "Cookie" is a universal technical term used in all languages
  /\bCookie\b/i,
];

const JAPANESE_KANA_RE = /[\u3040-\u30ff]/;
const CJK_RE = /[\u3400-\u9fff]/;

function loadCommon(locale: string) {
  return JSON.parse(
    fs.readFileSync(path.join(LOCALE_ROOT, locale, "common.json"), "utf8"),
  ) as Record<string, unknown>;
}

function flattenValues(
  value: unknown,
  prefix = "",
  out: Array<{ key: string; value: string }> = [],
): Array<{ key: string; value: string }> {
  if (typeof value === "string") {
    out.push({ key: prefix, value });
    return out;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return out;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${key}` : key;
    flattenValues(child, next, out);
  }
  return out;
}

function looksLikeAllowedEnglishLiteral(value: string): boolean {
  return ALLOWED_ENGLISH_VALUE_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

describe("i18n translation quality", () => {
  it("prevents untranslated English strings in ja/th/zh-CN", () => {
    const en = loadCommon("en");
    const enByKey = new Map(
      flattenValues(en).map(({ key, value }) => [key, value]),
    );

    const violations: Array<{
      locale: string;
      key: string;
      value: string;
      reason: string;
    }> = [];

    for (const locale of TARGET_LOCALES) {
      const entries = flattenValues(loadCommon(locale));
      for (const { key, value } of entries) {
        const trimmed = value.trim();
        if (!trimmed) continue;

        const enValue = enByKey.get(key)?.trim() ?? "";
        const isAsciiOnly = /^[\x20-\x7E]+$/.test(trimmed);
        const hasWord = /[A-Za-z]{4,}/.test(trimmed);
        const isAllowed = looksLikeAllowedEnglishLiteral(trimmed);

        if (
          key.toLowerCase().includes("placeholder") &&
          (trimmed.includes("@") || trimmed.includes("example"))
        ) {
          continue;
        }

        // signing.errors.* and errors.* are intentionally English in non-ja locales (i18next falls back to en)
        if (key.startsWith("signing.errors.") || key.startsWith("errors.")) {
          continue;
        }

        if (/\.code\.[^.]+\.code$/.test(key)) {
          continue;
        }

        if (
          key.startsWith("manual.usage.") &&
          key.endsWith(".label") &&
          /^([A-Za-z][A-Za-z0-9_*./ -]*|--json|Webhook)$/.test(trimmed)
        ) {
          continue;
        }

        if (locale === "th" && (JAPANESE_KANA_RE.test(trimmed) || CJK_RE.test(trimmed)) && !isAllowed) {
          violations.push({
            locale,
            key,
            value: trimmed,
            reason: "Thai locale contains Japanese/CJK script",
          });
          continue;
        }

        if (locale === "zh-CN" && JAPANESE_KANA_RE.test(trimmed) && !isAllowed) {
          violations.push({
            locale,
            key,
            value: trimmed,
            reason: "zh-CN locale contains Japanese kana",
          });
          continue;
        }

        if (trimmed === enValue && isAsciiOnly && hasWord && !isAllowed) {
          violations.push({
            locale,
            key,
            value: trimmed,
            reason: "matches English source value",
          });
          continue;
        }

        if (isAsciiOnly && hasWord && !isAllowed) {
          violations.push({
            locale,
            key,
            value: trimmed,
            reason: "ASCII English-like literal",
          });
        }
      }
    }

    expect(violations, `Untranslated English literals detected:\\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });
});
