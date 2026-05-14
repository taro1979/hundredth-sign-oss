# Fix Specification: 署名URLに言語パラメータを付与

## 1. Overview

- **目的**: 署名依頼メールの言語設定を署名ページへ引き継ぐため、署名URLに `?lng={locale}` を付与する。
- **対象ユーザー**: 署名依頼メールから署名ページへアクセスする署名者。
- **スコープ**: `/sign/{token}` の生成箇所、リマインダー、委任、内部承認後送信の署名URL。

## 2. Functional Requirements

1. 署名URL生成時は、対象の `signatureRequests.locale` を `resolveEmailLocale()` で正規化し、`/sign/{token}?lng={locale}` を生成する。
2. 署名依頼メール本文の `lang` と署名URLの `?lng=` は同じ正規化済みlocaleを使う。
3. `locale` が空または未対応の場合は `"en"` にフォールバックする。
4. 署名ページでは `?lng=` が最優先される。ブラウザ言語やlocalStorageで上書きしない。

## 3. URL Generation Points

| Flow | Locale source |
|---|---|
| `documents.sendForSignature` sequential first signer | `firstSigner.locale` |
| `documents.sendForSignature` parallel signers | `req.locale` |
| `documents.resendReminder` | `req.locale` |
| `signature.sign` next sequential signer | `nextSigner.locale` |
| `signature.delegate` delegated signer | `request.locale` |
| `internalApproval.decide` sequential first signer | `firstSigner.locale` |
| `internalApproval.decide` parallel signers | `req.locale` |
| `scheduler.processReminders` | pending request locale |

## 4. Acceptance Criteria

- Every generated signer-facing URL is `/sign/{token}?lng={locale}`.
- `sendForSignature` preserves each recipient's selected locale.
- If the sender UI is Japanese and the recipient locale is left at its default, the email link contains `?lng=ja`.
- Existing URLs without `?lng=` still work via the sign page fallback chain.
- `pnpm test` and `pnpm check` pass.

## 5. Out of Scope

- CC dashboard URLs.
- Adding a language switcher to the public signing page.
- Expanding supported UI locales beyond `en`, `ja`, `th`, and `zh-CN`.
