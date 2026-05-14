import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractTranslationUsages,
  findMissingKeys,
  findTranslationFallbackAntiPatterns,
  flattenTranslationKeys,
} from "./i18nAudit";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const CLIENT_SRC_DIR = path.join(REPO_ROOT, "client", "src");
const LOCALES_DIR = path.join(REPO_ROOT, "client", "public", "locales");
const TARGET_LOCALES = ["en", "ja", "th", "zh-CN"] as const;

type LocaleCode = (typeof TARGET_LOCALES)[number];

function walkCodeFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkCodeFiles(fullPath, files);
      continue;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function loadLocaleKeySet(locale: LocaleCode): Set<string> {
  const localePath = path.join(LOCALES_DIR, locale, "common.json");
  const localeJson = JSON.parse(fs.readFileSync(localePath, "utf8")) as unknown;
  return new Set(flattenTranslationKeys(localeJson));
}

function toRelative(filePath: string): string {
  return path.relative(REPO_ROOT, filePath);
}

describe("i18n translation completeness (integration)", () => {
  const codeFiles = walkCodeFiles(CLIENT_SRC_DIR);
  const usages = codeFiles.flatMap((filePath) => {
    const source = fs.readFileSync(filePath, "utf8");
    return extractTranslationUsages(toRelative(filePath), source);
  });

  const uniqueUsedKeys = [...new Set(usages.map((usage) => usage.key))].sort();
  const usageByKey = new Map<string, { filePath: string; line: number }>();
  for (const usage of usages) {
    if (!usageByKey.has(usage.key)) {
      usageByKey.set(usage.key, { filePath: usage.filePath, line: usage.line });
    }
  }

  const localeKeys = Object.fromEntries(
    TARGET_LOCALES.map((locale) => [locale, loadLocaleKeySet(locale)]),
  ) as Record<LocaleCode, Set<string>>;

  it("all statically referenced translation keys exist in en/common.json", () => {
    const missingInEn = findMissingKeys(uniqueUsedKeys, localeKeys.en);
    if (missingInEn.length > 0) {
      const details = missingInEn.map((key) => {
        const usage = usageByKey.get(key);
        return `${key} (${usage?.filePath}:${usage?.line})`;
      });
      throw new Error(`Missing keys in en/common.json:\n${details.join("\n")}`);
    }

    expect(missingInEn).toEqual([]);
  });

  for (const locale of TARGET_LOCALES.filter((value) => value !== "en")) {
    it(`locale ${locale} has all keys used by the app`, () => {
      const keysDefinedInEnAndUsed = uniqueUsedKeys.filter((key) => localeKeys.en.has(key));
      const missing = findMissingKeys(keysDefinedInEnAndUsed, localeKeys[locale]);
      if (missing.length > 0) {
        throw new Error(`Missing keys in ${locale}/common.json:\n${missing.join("\n")}`);
      }

      expect(missing).toEqual([]);
    });
  }

  it("does not use the anti-pattern t(...) || fallback in client source", () => {
    const offenders: Array<{ filePath: string; lines: number[] }> = [];

    for (const filePath of codeFiles) {
      const source = fs.readFileSync(filePath, "utf8");
      const lines = findTranslationFallbackAntiPatterns(source);
      if (lines.length > 0) {
        offenders.push({ filePath: toRelative(filePath), lines });
      }
    }

    if (offenders.length > 0) {
      const details = offenders.map(
        (offender) => `${offender.filePath}:${offender.lines.join(",")}`,
      );
      throw new Error(
        `Replace t(...) || fallback with t(key, { defaultValue }) in:\n${details.join("\n")}`,
      );
    }

    expect(offenders).toEqual([]);
  });
});
