# Locales - Translation Files

## Directory Structure

```text
locales/
├── en/common.json        -> Base language
├── ja/common.json        -> Japanese
├── th/common.json        -> Thai
├── zh-CN/common.json     -> Simplified Chinese
└── _template/common.json -> Starter template for new languages
```

## Supported Languages

Edit `client/src/lib/i18n.ts` and `SUPPORTED_LOCALES` to control which
languages appear in the UI.

| Code | Language | Status |
|---|---|---|
| `en` | English | Base |
| `ja` | Japanese | Full |
| `th` | Thai | Full |
| `zh-CN` | Chinese (Simplified) | Full |

## How To Add A New Language

1. Copy the template:

   ```bash
   cp -r locales/_template locales/<lang-code>
   ```

2. Translate all values in `locales/<lang-code>/common.json`.
   Keys must match `en/common.json` exactly, and `{{variable}}` placeholders
   must stay unchanged.

3. Register the language in `client/src/lib/i18n.ts`.

4. Add matching email translations in `server/emailTranslations.ts`.

## Keeping Translations In Sync

`en/common.json` is the source of truth. When adding a new key to English, add
the same key to all other supported language files.

## Notes

- `_template/common.json` mirrors `en/common.json` with empty string values.
- The `landing` section covers the public page.
- The `dashboard`, `documents`, `signing`, and related sections cover app UI.
- RTL support is configured in `client/src/lib/i18n.ts` with `isRtlLocale()`.
