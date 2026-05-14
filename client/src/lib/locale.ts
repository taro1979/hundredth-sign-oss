import { enUS, ja, th as thLocale, zhCN, type Locale } from "date-fns/locale";
import { getUiLocaleBcp47, resolveUiLocale, type UiLocale } from "@shared/locales";

const DATE_FNS_LOCALE_MAP: Record<UiLocale, Locale> = {
  en: enUS,
  ja,
  th: thLocale,
  "zh-CN": zhCN,
};

export type DateFormatKey = "date" | "dateShort" | "dateTime" | "shortDateTime" | "time";

const DATE_FORMATS: Record<UiLocale, Record<DateFormatKey, string>> = {
  en: {
    date: "MMM d, yyyy",
    dateShort: "MMM d, yyyy",
    dateTime: "MMM d, yyyy HH:mm",
    shortDateTime: "MMM d HH:mm",
    time: "HH:mm",
  },
  ja: {
    date: "yyyy/MM/dd",
    dateShort: "yyyy/M/d",
    dateTime: "yyyy/MM/dd HH:mm",
    shortDateTime: "MM/dd HH:mm",
    time: "HH:mm",
  },
  th: {
    date: "d MMM yyyy",
    dateShort: "d MMM yyyy",
    dateTime: "d MMM yyyy HH:mm",
    shortDateTime: "d MMM HH:mm",
    time: "HH:mm",
  },
  "zh-CN": {
    date: "yyyy/MM/dd",
    dateShort: "yyyy/M/d",
    dateTime: "yyyy/MM/dd HH:mm",
    shortDateTime: "MM/dd HH:mm",
    time: "HH:mm",
  },
};

export function getDateFnsLocale(locale?: string | null): Locale {
  return DATE_FNS_LOCALE_MAP[resolveUiLocale(locale)];
}

export function getDateFormat(locale: string | null | undefined, key: DateFormatKey): string {
  return DATE_FORMATS[resolveUiLocale(locale)][key];
}

export function getLocaleNumber(locale?: string | null): string {
  return getUiLocaleBcp47(locale);
}

export function formatLocaleNumber(
  value: number,
  locale?: string | null,
  options?: Intl.NumberFormatOptions,
): string {
  return value.toLocaleString(getLocaleNumber(locale), options);
}

export function formatLocaleDate(
  value: Date | string | number,
  locale?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(value).toLocaleDateString(getLocaleNumber(locale), options);
}

export function formatLocaleDateTime(
  value: Date | string | number,
  locale?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(value).toLocaleString(getLocaleNumber(locale), options);
}
