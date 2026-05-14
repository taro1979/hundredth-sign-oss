import { describe, expect, it } from "vitest";
import {
  extractTranslationUsages,
  findMissingKeys,
  findTranslationFallbackAntiPatterns,
  flattenTranslationKeys,
} from "./i18nAudit";

describe("i18nAudit utilities", () => {
  it("flattens nested translation keys", () => {
    const keys = flattenTranslationKeys({
      documents: {
        title: "Documents",
        detail: {
          resend: "Resend",
        },
      },
      common: {
        save: "Save",
      },
    });

    expect(keys).toEqual([
      "documents",
      "documents.title",
      "documents.detail",
      "documents.detail.resend",
      "common",
      "common.save",
    ]);
  });

  it("extracts translation usages from t/i18n.t/i18nKey and skips dynamic keys", () => {
    const source = `
      const a = t("documents.title");
      const b = i18n.t('documents.detail.resend');
      <Trans i18nKey="common.save" />
      const c = t(\`documents.\${status}\`);
    `;

    const usages = extractTranslationUsages("client/src/pages/Documents.tsx", source);
    expect(usages).toEqual([
      { filePath: "client/src/pages/Documents.tsx", key: "documents.title", line: 2 },
      { filePath: "client/src/pages/Documents.tsx", key: "documents.detail.resend", line: 3 },
      { filePath: "client/src/pages/Documents.tsx", key: "common.save", line: 4 },
    ]);
  });

  it("returns sorted missing keys", () => {
    const missing = findMissingKeys(
      ["documents.title", "documents.searchPlaceholder", "documents.deleteConfirm"],
      ["documents.title", "documents.deleteConfirm"],
    );

    expect(missing).toEqual(["documents.searchPlaceholder"]);
  });

  it("detects translation fallback anti-pattern lines", () => {
    const source = `
      const label = t("documents.detailView") || t("common.edit");
      const safe = t("documents.detailView", { defaultValue: t("common.edit") });
      const other = value || t("common.cancel");
    `;

    expect(findTranslationFallbackAntiPatterns(source)).toEqual([2]);
  });
});
