import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localeRoot = path.join(root, "client", "public", "locales");
const locales = ["ja", "en", "th", "zh-CN"];

function flatten(value, prefix = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

const keySets = new Map();
for (const locale of locales) {
  const filePath = path.join(localeRoot, locale, "common.json");
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const keys = flatten(json.manual ?? {}).sort();
  keySets.set(locale, keys);
}

const reference = keySets.get("ja");
let failed = false;
for (const locale of locales.slice(1)) {
  const current = keySets.get(locale);
  const missing = reference.filter((key) => !current.includes(key));
  const extra = current.filter((key) => !reference.includes(key));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`[manual locale mismatch] ${locale}`);
    if (missing.length) console.error(`  missing: ${missing.join(", ")}`);
    if (extra.length) console.error(`  extra: ${extra.join(", ")}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Manual locale keys match: ${locales.join(", ")} (${reference.length} keys)`);
