/**
 * i18n configuration for Hundredth Sign
 * Supports 4 languages: English (base), Japanese, Thai, Simplified Chinese
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import {
  UI_LOCALES as SUPPORTED_LOCALES,
  UI_LOCALE_LABELS as LOCALE_LABELS,
  isRtlLocale,
  type UiLocale as SupportedLocale,
} from "@shared/locales";

export { SUPPORTED_LOCALES, LOCALE_LABELS, isRtlLocale };
export type { SupportedLocale };

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["common"],
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
      queryStringParams: { v: __BUILD_HASH__ },
    },
    detection: {
      order: ["localStorage", "querystring", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "hundredth-sign-jp-lang",
      lookupQuerystring: "lng",
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: true,
    },
  });

export default i18n;
