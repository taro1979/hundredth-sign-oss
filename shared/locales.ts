export type TextDirection = "ltr" | "rtl";

export interface LocaleDefinition {
  label: string;
  bcp47: string;
  dir: TextDirection;
  ui: boolean;
  email: boolean;
  aliases?: readonly string[];
}

export const LOCALE_REGISTRY = {
  en: {
    label: "English",
    bcp47: "en-US",
    dir: "ltr",
    ui: true,
    email: true,
    aliases: ["en-us", "en-gb", "en-au"],
  },
  ja: {
    label: "日本語",
    bcp47: "ja-JP",
    dir: "ltr",
    ui: true,
    email: true,
    aliases: ["ja-jp"],
  },
  th: {
    label: "ไทย",
    bcp47: "th-TH",
    dir: "ltr",
    ui: true,
    email: true,
    aliases: ["th-th"],
  },
  "zh-CN": {
    label: "简体中文",
    bcp47: "zh-CN",
    dir: "ltr",
    ui: true,
    email: true,
    aliases: ["zh", "zh-cn", "zh-hans"],
  },
  "zh-TW": {
    label: "繁體中文",
    bcp47: "zh-TW",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["zh-tw", "zh-hant"],
  },
  ko: {
    label: "한국어",
    bcp47: "ko-KR",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["ko-kr"],
  },
  fr: {
    label: "Français",
    bcp47: "fr-FR",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["fr-fr"],
  },
  de: {
    label: "Deutsch",
    bcp47: "de-DE",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["de-de"],
  },
  es: {
    label: "Español",
    bcp47: "es-ES",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["es-es", "es-mx"],
  },
  pt: {
    label: "Português",
    bcp47: "pt-PT",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["pt-pt", "pt-br"],
  },
  it: {
    label: "Italiano",
    bcp47: "it-IT",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["it-it"],
  },
  vi: {
    label: "Tiếng Việt",
    bcp47: "vi-VN",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["vi-vn"],
  },
  id: {
    label: "Bahasa Indonesia",
    bcp47: "id-ID",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["id-id"],
  },
  hi: {
    label: "हिन्दी",
    bcp47: "hi-IN",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["hi-in"],
  },
  nl: {
    label: "Nederlands",
    bcp47: "nl-NL",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["nl-nl"],
  },
  pl: {
    label: "Polski",
    bcp47: "pl-PL",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["pl-pl"],
  },
  sv: {
    label: "Svenska",
    bcp47: "sv-SE",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["sv-se"],
  },
  tr: {
    label: "Türkçe",
    bcp47: "tr-TR",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["tr-tr"],
  },
  ru: {
    label: "Русский",
    bcp47: "ru-RU",
    dir: "ltr",
    ui: false,
    email: true,
    aliases: ["ru-ru"],
  },
  ar: {
    label: "العربية",
    bcp47: "ar",
    dir: "rtl",
    ui: false,
    email: true,
    aliases: ["ar-sa", "ar-eg"],
  },
} as const satisfies Record<string, LocaleDefinition>;

export type AppLocale = keyof typeof LOCALE_REGISTRY;

type LocaleWithCapability<Key extends "ui" | "email"> = {
  [Code in AppLocale]: (typeof LOCALE_REGISTRY)[Code][Key] extends true ? Code : never;
}[AppLocale];

export type UiLocale = LocaleWithCapability<"ui">;
export type EmailLocale = LocaleWithCapability<"email">;

export const ALL_LOCALES = Object.freeze(
  Object.keys(LOCALE_REGISTRY) as AppLocale[],
);

export const UI_LOCALES = Object.freeze(
  ALL_LOCALES.filter((locale): locale is UiLocale => LOCALE_REGISTRY[locale].ui),
);


export const EMAIL_LOCALES = Object.freeze(
  ALL_LOCALES.filter((locale): locale is EmailLocale => LOCALE_REGISTRY[locale].email),
);

export const UI_LOCALE_LABELS = Object.freeze(
  Object.fromEntries(UI_LOCALES.map((locale) => [locale, LOCALE_REGISTRY[locale].label])) as Record<UiLocale, string>,
);

export const EMAIL_LOCALE_OPTIONS = Object.freeze(
  EMAIL_LOCALES.map((locale) => ({ value: locale, label: LOCALE_REGISTRY[locale].label })),
);

const NORMALIZED_LOCALE_LOOKUP = (() => {
  const lookup: Record<string, AppLocale> = {};
  for (const locale of ALL_LOCALES) {
    const definition = LOCALE_REGISTRY[locale];
    lookup[locale.toLowerCase()] = locale;
    for (const alias of definition.aliases ?? []) {
      lookup[alias.toLowerCase()] = locale;
    }
  }
  return lookup;
})();

function resolveLocaleFromList<TLocale extends AppLocale>(
  locale: string | null | undefined,
  allowedLocales: readonly TLocale[],
  fallbackLocale: TLocale,
): TLocale {
  if (!locale) return fallbackLocale;

  const normalized = locale.toLowerCase();
  const direct = NORMALIZED_LOCALE_LOOKUP[normalized];
  if (direct && allowedLocales.includes(direct as TLocale)) {
    return direct as TLocale;
  }

  const base = normalized.split("-")[0];
  const baseLocale = NORMALIZED_LOCALE_LOOKUP[base];
  if (baseLocale && allowedLocales.includes(baseLocale as TLocale)) {
    return baseLocale as TLocale;
  }

  return fallbackLocale;
}

export function resolveAppLocale(locale?: string | null): AppLocale {
  return resolveLocaleFromList(locale, ALL_LOCALES, "en");
}

export function resolveUiLocale(locale?: string | null): UiLocale {
  return resolveLocaleFromList(locale, UI_LOCALES, "en");
}


export function resolveEmailLocaleCode(locale?: string | null): EmailLocale {
  return resolveLocaleFromList(locale, EMAIL_LOCALES, "en");
}

export function getLocaleDefinition(locale?: string | null) {
  return LOCALE_REGISTRY[resolveAppLocale(locale)];
}

export function getUiLocaleDefinition(locale?: string | null) {
  return LOCALE_REGISTRY[resolveUiLocale(locale)];
}


export function getLocaleBcp47(locale?: string | null): string {
  return getLocaleDefinition(locale).bcp47;
}

export function getUiLocaleBcp47(locale?: string | null): string {
  return getUiLocaleDefinition(locale).bcp47;
}

export function isRtlLocale(locale?: string | null): boolean {
  return getLocaleDefinition(locale).dir === "rtl";
}

function hasSupportedUiLocale(locale?: string | null): boolean {
  if (!locale) return false;

  const normalized = locale.toLowerCase();
  const direct = NORMALIZED_LOCALE_LOOKUP[normalized];
  if (direct && UI_LOCALES.includes(direct as UiLocale)) return true;

  const base = normalized.split("-")[0];
  const baseLocale = NORMALIZED_LOCALE_LOOKUP[base];
  return !!(baseLocale && UI_LOCALES.includes(baseLocale as UiLocale));
}

/**
 * Determines the UI locale for the signing page.
 *
 * Priority: valid URL ?lng= param > navigator.language > "en"
 *
 * Designed for the sign page (public, no localStorage cache):
 * the language attached to the signing URL is the sender-selected locale.
 */
export function resolveSignPageLocale(
  navigatorLang: string | undefined,
  urlLng: string | undefined,
): UiLocale {
  if (hasSupportedUiLocale(urlLng)) return resolveUiLocale(urlLng);
  if (navigatorLang) return resolveUiLocale(navigatorLang);
  return "en";
}
