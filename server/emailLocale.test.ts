import { describe, it, expect } from "vitest";
import {
  TRANSLATIONS,
  resolveEmailLocale,
  isRtlLanguage,
  type SupportedLanguage,
} from "./emailTranslations";

describe("Email Locale System", () => {
  describe("resolveEmailLocale", () => {
    it("should return en for undefined/null/empty", () => {
      expect(resolveEmailLocale(undefined)).toBe("en");
      expect(resolveEmailLocale(null as any)).toBe("en");
      expect(resolveEmailLocale("")).toBe("en");
    });

    it("should return exact match for supported locales", () => {
      expect(resolveEmailLocale("en")).toBe("en");
      expect(resolveEmailLocale("ja")).toBe("ja");
      expect(resolveEmailLocale("ko")).toBe("ko");
      expect(resolveEmailLocale("fr")).toBe("fr");
      expect(resolveEmailLocale("ar")).toBe("ar");
      expect(resolveEmailLocale("zh-CN")).toBe("zh-CN");
      expect(resolveEmailLocale("zh-TW")).toBe("zh-TW");
    });

    it("should map zh to zh-CN", () => {
      expect(resolveEmailLocale("zh")).toBe("zh-CN");
    });

    it("should fallback to en for unsupported locales", () => {
      expect(resolveEmailLocale("xx")).toBe("en");
      expect(resolveEmailLocale("fi")).toBe("en");
    });
  });

  describe("isRtlLanguage", () => {
    it("should return true for Arabic", () => {
      expect(isRtlLanguage("ar")).toBe(true);
    });

    it("should return false for LTR languages", () => {
      expect(isRtlLanguage("ja")).toBe(false);
      expect(isRtlLanguage("en")).toBe(false);
      expect(isRtlLanguage("ko")).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isRtlLanguage(undefined)).toBe(false);
    });
  });

  describe("TRANSLATIONS", () => {
    const requiredLanguages: SupportedLanguage[] = [
      "ja", "en", "zh-CN", "zh-TW", "ko", "fr", "de", "es", "pt", "it",
      "th", "vi", "id", "hi", "nl", "pl", "sv", "tr", "ru", "ar",
    ];

    it("should have all 20 supported languages", () => {
      expect(Object.keys(TRANSLATIONS).length).toBe(20);
      for (const lang of requiredLanguages) {
        expect(TRANSLATIONS[lang]).toBeDefined();
      }
    });

    it.each(requiredLanguages)("should have complete translation set for %s", (lang) => {
      const t = TRANSLATIONS[lang];
      // signatureRequest
      expect(typeof t.signatureRequest.subject).toBe("function");
      expect(typeof t.signatureRequest.heading).toBe("function");
      expect(typeof t.signatureRequest.body).toBe("function");
      expect(typeof t.signatureRequest.button).toBe("string");
      expect(typeof t.signatureRequest.messagePreamble).toBe("string");
      // signatureComplete
      expect(typeof t.signatureComplete.subject).toBe("function");
      expect(typeof t.signatureComplete.heading).toBe("string");
      expect(typeof t.signatureComplete.body).toBe("function");
      expect(typeof t.signatureComplete.button).toBe("string");
      // allSigned
      expect(typeof t.allSigned.subject).toBe("function");
      expect(typeof t.allSigned.heading).toBe("string");
      expect(typeof t.allSigned.body).toBe("function");
      expect(typeof t.allSigned.button).toBe("string");
      // declined
      expect(typeof t.declined.subject).toBe("function");
      expect(typeof t.declined.heading).toBe("string");
      expect(typeof t.declined.body).toBe("function");
      expect(typeof t.declined.reasonLabel).toBe("string");
      expect(typeof t.declined.button).toBe("string");
      // reminder
      expect(typeof t.reminder.subject).toBe("function");
      expect(typeof t.reminder.heading).toBe("string");
      expect(typeof t.reminder.body).toBe("function");
      expect(typeof t.reminder.button).toBe("string");
      // footer
      expect(typeof t.footer.doNotShare).toBe("string");
      expect(typeof t.footer.doNotShareBody).toBe("string");
      expect(typeof t.footer.aboutHundredthSign).toBe("string");
      expect(typeof t.footer.aboutHundredthSignBody).toBe("string");
      expect(typeof t.footer.questions).toBe("string");
      expect(typeof t.footer.questionsBody).toBe("string");
      // completeWith & thankYou
      expect(typeof t.completeWith).toBe("function");
      expect(typeof t.thankYou).toBe("function");
    });

    it("should generate correct subject lines", () => {
      const jaT = TRANSLATIONS.ja;
      expect(jaT.signatureRequest.subject("田中", "契約書")).toContain("田中");
      expect(jaT.signatureRequest.subject("田中", "契約書")).toContain("契約書");

      const enT = TRANSLATIONS.en;
      const enSubject = enT.signatureRequest.subject("John", "Contract");
      expect(enSubject).toContain("Contract");
      expect(enSubject.length).toBeGreaterThan(0);

      const arT = TRANSLATIONS.ar;
      expect(arT.signatureRequest.subject("أحمد", "عقد")).toContain("أحمد");
    });
  });
});

// ==================== Full function invocation coverage ====================
// Each language has ~13 lambda functions. This test calls ALL of them to achieve function coverage.

describe("TRANSLATIONS - Full function invocation coverage", () => {
  const allLanguages: SupportedLanguage[] = [
    "ja", "en", "zh-CN", "zh-TW", "ko", "fr", "de", "es", "pt", "it",
    "th", "vi", "id", "hi", "nl", "pl", "sv", "tr", "ru", "ar",
  ];

  it.each(allLanguages)("should invoke ALL lambda functions for %s", (lang) => {
    const t = TRANSLATIONS[lang];

    // signatureRequest functions (3)
    const srSubject = t.signatureRequest.subject("Sender", "Document");
    expect(typeof srSubject).toBe("string");
    expect(srSubject.length).toBeGreaterThan(0);

    const srHeading = t.signatureRequest.heading("Sender");
    expect(typeof srHeading).toBe("string");
    expect(srHeading.length).toBeGreaterThan(0);

    const srBody = t.signatureRequest.body("Document");
    expect(typeof srBody).toBe("string");
    expect(srBody.length).toBeGreaterThan(0);

    // signatureComplete functions (2)
    const scSubject = t.signatureComplete.subject("Signer", "Document");
    expect(typeof scSubject).toBe("string");
    expect(scSubject.length).toBeGreaterThan(0);

    const scBody = t.signatureComplete.body("Signer", "Document");
    expect(typeof scBody).toBe("string");
    expect(scBody.length).toBeGreaterThan(0);

    // allSigned functions (2)
    const asSubject = t.allSigned.subject("Document");
    expect(typeof asSubject).toBe("string");
    expect(asSubject.length).toBeGreaterThan(0);

    const asBody = t.allSigned.body("Document");
    expect(typeof asBody).toBe("string");
    expect(asBody.length).toBeGreaterThan(0);

    // declined functions (2)
    const dSubject = t.declined.subject("Signer", "Document");
    expect(typeof dSubject).toBe("string");
    expect(dSubject.length).toBeGreaterThan(0);

    const dBody = t.declined.body("Signer", "Document");
    expect(typeof dBody).toBe("string");
    expect(dBody.length).toBeGreaterThan(0);

    // reminder functions (2)
    const rSubject = t.reminder.subject("Document");
    expect(typeof rSubject).toBe("string");
    expect(rSubject.length).toBeGreaterThan(0);

    const rBody = t.reminder.body("Document");
    expect(typeof rBody).toBe("string");
    expect(rBody.length).toBeGreaterThan(0);

    // completeWith & thankYou (2)
    const cw = t.completeWith("Document");
    expect(typeof cw).toBe("string");
    expect(cw.length).toBeGreaterThan(0);

    const ty = t.thankYou("Name");
    expect(typeof ty).toBe("string");
    expect(ty.length).toBeGreaterThan(0);
  });
});
