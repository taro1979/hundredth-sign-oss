# Fix Specification: 署名ページの言語決定ロジック

## 1. Overview

- **目的**: 署名依頼メールに含まれる `?lng=` を署名ページの表示言語として優先し、発行者が選んだ受信者向け言語を公開署名ページへ確実に引き継ぐ。
- **対象ユーザー**: 署名依頼メールの「文書を確認する」リンクから署名ページへアクセスする署名者。
- **スコープ**: `shared/locales.ts` の言語解決、`client/src/pages/SignDocument.tsx` の初期言語設定、関連テスト。

## 2. Functional Requirements

1. `resolveSignPageLocale(navigatorLang, urlLng)` は次の優先順で `UiLocale` を返す。
   1. 有効な URL `?lng=` パラメータ
   2. `navigator.language`
   3. `"en"`
2. `?lng=` が未対応または不正な値の場合は、ブラウザ言語へフォールバックする。
3. 署名ページでは localStorage の言語キャッシュを使わず、アクセスごとに URL とブラウザ言語から決定する。
4. ダッシュボード側の i18next LanguageDetector 設定は変更しない。

## 3. Expected Behavior

| URL `?lng=` | Browser language | Result |
|---|---|---|
| `ja` | `en-US` | `ja` |
| `en` | `ja-JP` | `en` |
| `th` | `en-US` | `th` |
| `zh-CN` | `en-US` | `zh-CN` |
| invalid | `ja-JP` | `ja` |
| missing | `th-TH` | `th` |
| missing | unsupported | `en` |

## 4. Acceptance Criteria

- `resolveSignPageLocale("en", "ja")` returns `"ja"`.
- `resolveSignPageLocale("ja", "en")` returns `"en"`.
- `resolveSignPageLocale("ja", "../../etc/passwd")` returns `"ja"`.
- `resolveSignPageLocale(undefined, "es")` returns `"en"`.
- `SignDocument` calls `i18n.changeLanguage()` with the resolved locale on mount.
- Existing dashboard language selection behavior remains unchanged.

## 5. Cross-Reference

- `fix-sign-url-locale-param.md`: email links must include `?lng={locale}`.
- `product-spec.md` (i18n section): supported UI locales are `en`, `ja`, `th`, and `zh-CN`.
