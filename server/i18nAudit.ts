export type TranslationUsage = {
  filePath: string;
  key: string;
  line: number;
};

const KEY_PATTERNS: RegExp[] = [
  /\bt\(\s*(["'`])([^"'`\\]*(?:\\.[^"'`\\]*)*)\1/g,
  /\bi18n\.t\(\s*(["'`])([^"'`\\]*(?:\\.[^"'`\\]*)*)\1/g,
  /\bi18nKey\s*=\s*(["'`])([^"'`\\]*(?:\\.[^"'`\\]*)*)\1/g,
];

const TRANSLATION_FALLBACK_ANTI_PATTERN = /\bt\([^)]*\)\s*\|\|/g;

function indexToLine(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

export function flattenTranslationKeys(node: unknown, prefix = ""): string[] {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return [];
  }

  const keys: string[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const dottedKey = prefix ? `${prefix}.${key}` : key;
    keys.push(dottedKey);
    keys.push(...flattenTranslationKeys(value, dottedKey));
  }
  return keys;
}

export function extractTranslationUsages(filePath: string, source: string): TranslationUsage[] {
  const usages: TranslationUsage[] = [];
  const dedupe = new Set<string>();

  for (const pattern of KEY_PATTERNS) {
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const key = match[2];
      if (!key || key.includes("${")) {
        continue;
      }

      const line = indexToLine(source, match.index);
      const dedupeKey = `${filePath}:${line}:${key}`;
      if (dedupe.has(dedupeKey)) {
        continue;
      }

      dedupe.add(dedupeKey);
      usages.push({ filePath, key, line });
    }
  }

  return usages;
}

export function findMissingKeys(baseKeys: Iterable<string>, targetKeys: Iterable<string>): string[] {
  const targetSet = new Set(targetKeys);
  const missing: string[] = [];

  for (const key of Array.from(baseKeys)) {
    if (!targetSet.has(key)) {
      missing.push(key);
    }
  }

  return missing.sort();
}

export function findTranslationFallbackAntiPatterns(source: string): number[] {
  const lines: number[] = [];
  TRANSLATION_FALLBACK_ANTI_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TRANSLATION_FALLBACK_ANTI_PATTERN.exec(source)) !== null) {
    lines.push(indexToLine(source, match.index));
  }

  return lines;
}
