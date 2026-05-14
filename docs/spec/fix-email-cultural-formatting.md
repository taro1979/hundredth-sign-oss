# Feature Specification: メール文化的フォーマット最適化

## 1. Overview

- **目的**: 20言語対応の署名リクエストメールに、文化圏ごとに適切な挨拶・敬称を追加し、ビジネスメールとして適切な品質に引き上げる
- **対象ユーザー**: 署名依頼メールを受け取る全受信者（特に Thai・Korean・Indonesian・Hindi 圏）
- **スコープ**: `server/emailTranslations.ts` の翻訳レイヤーのみ。HTML レイアウト・DB スキーマ・フロントエンドは変更しない

## 2. User Stories

- As a Thai signer, I want to see "คุณ{名前}" in the greeting, so that the email feels respectful in Thai business context.
- As a Korean signer, I want to see "{名前}님께" as a salutation, so that the email follows Korean business etiquette.
- As an English signer, I want to see "Dear {名前}," as a greeting, so that the email looks professional.
- As a Japanese signer, I want to see "{名前}様" as the greeting, consistent with the existing thankYou style.

## 3. Functional Requirements

### FR-001: TranslationSet に `greeting` 関数を追加
`TranslationSet` インターフェースに以下を追加する:
```typescript
greeting: (name: string) => string;
```
- `name` は `escapeHtml()` 済みの文字列が渡される（呼び出し元で処理済み）
- 戻り値はメール本文の宛名行として表示される

### FR-002: 全20ロケールに `greeting` を実装

| ロケール | greeting 値 | 根拠 |
|---|---|---|
| ja | `${name}様` | 日本語ビジネス標準敬称 |
| en | `Dear ${name},` | 英語ビジネス標準 |
| zh-CN | `${name}，您好` | 中国語ビジネス慣例 |
| zh-TW | `${name}，您好` | 繁体字同慣例 |
| ko | `${name}님께` | 님 = 韓国の標準敬称、께 = 敬語助詞 |
| th | `คุณ${name}` | คุณ はタイ語ビジネスメールで必須の敬称 |
| vi | `Kính gửi ${name},` | ベトナム語フォーマル表現 |
| id | `Yth. ${name},` | "Yang terhormat" の略、インドネシア標準 |
| hi | `${name} जी,` | जी = ヒンディー語の必須敬称 |
| fr | `Bonjour ${name},` | 性別中立フランス語ビジネス挨拶 |
| de | `Guten Tag ${name},` | 性別中立ドイツ語ビジネス挨拶 |
| es | `Estimado/a ${name},` | スペイン語フォーマル（性別中立） |
| pt | `Prezado(a) ${name},` | ポルトガル語フォーマル（性別中立） |
| it | `Gentile ${name},` | イタリア語性別中立フォーマル |
| nl | `Beste ${name},` | オランダ語標準ビジネス挨拶 |
| pl | `Szanowna/y ${name},` | ポーランド語フォーマル（性別中立） |
| sv | `Hej ${name},` | スウェーデン語標準ビジネス挨拶 |
| tr | `Sayın ${name},` | トルコ語フォーマル敬称 |
| ru | `Здравствуйте, ${name},` | ロシア語性別中立フォーマル |
| ar | `مرحبًا ${name}،` | アラビア語性別中立挨拶（RTL 対応済み） |

### FR-003: `email.ts` レイアウトで `greeting` を使用
`hundredthSignEmailLayout()` の宛名行（line 254）を変更する:
- Before: `${params.recipientName}`
- After: `${t.greeting(params.recipientName)}`

### FR-004: `thankYou` の敬称欠落を修正
以下3言語の `thankYou` を文化的に正しい表現に修正する:

| ロケール | 現状 | 修正後 | 理由 |
|---|---|---|---|
| th | `` `ขอบคุณ, ${name}` `` | `` `ขอบคุณคุณ${name}` `` | คุณ 敬称が欠落している |
| ko | `` `감사합니다, ${name}` `` | `` `${name}님, 감사합니다` `` | 님 欠落・韓国語は名前が先 |
| hi | `` `धन्यवाद, ${name}` `` | `` `${name} जी, धन्यवाद` `` | जी 欠落・ヒンディー語は名前が先 |

### FR-005: CC通知メールを全20ロケール対応に
`buildCcNotificationEmail()` の現状: ja/en のみハードコード。

`TranslationSet` に `ccNotification` セクションを追加:
```typescript
ccNotification: {
  subjectPrefix: string;           // 例: "写し通知"(ja), "CC"(en), "副本通知"(zh-CN)
  body: (senderName: string, docTitle: string) => string;
  button: string;                  // 例: "ダッシュボードを開く", "Open Dashboard"
};
```

全20ロケールに翻訳を追加し、`buildCcNotificationEmail()` のハードコードを `t.ccNotification.*` に置き換える。

## 4. Non-Functional Requirements

- **パフォーマンス**: 翻訳はビルド時定数。ランタイムコストなし
- **セキュリティ**: `greeting` の引数 `name` は呼び出し元で `escapeHtml()` 済み。greeting 関数内で再エスケープしない（二重エスケープ禁止）
- **後方互換**: DB スキーマ・API・既存のメール subject には影響なし

## 5. Data Model Changes

なし。変更は翻訳レイヤーのみ。

## 6. API / UI Design

**変更対象ファイル:**

| ファイル | 変更内容 |
|---|---|
| `server/emailTranslations.ts` | TranslationSet に `greeting` と `ccNotification` 追加。全20ロケールに実装。`thankYou` を th/ko/hi で修正 |
| `server/email.ts` | line 254: `${params.recipientName}` → `${t.greeting(params.recipientName)}`。`buildCcNotificationEmail` の ja/en ハードコードを `t.ccNotification.*` に置換 |
| `server/email.test.ts` | greeting と ccNotification のテスト追加・更新 |

## 7. Acceptance Criteria

- [ ] **AC-001**: ja メールの宛名行に「様」が含まれる（例: `山田太郎様`）
- [ ] **AC-002**: en メールの宛名行に「Dear {name},」が含まれる
- [ ] **AC-003**: th メールの宛名行に「คุณ」が名前の前に付く
- [ ] **AC-004**: ko メールの宛名行に「님께」が名前の後に付く
- [ ] **AC-005**: hi メールの宛名行に「जी,」が名前の後に付く
- [ ] **AC-006**: th の thankYou が「ขอบคุณคุณ{name}」になっている
- [ ] **AC-007**: ko の thankYou が「{name}님, 감사합니다」になっている
- [ ] **AC-008**: hi の thankYou が「{name} जी, धन्यवाद」になっている
- [ ] **AC-009**: CC通知メールが id ロケールで生成できる（subject に "CC" ではなく id 翻訳が使われる）
- [ ] **AC-010**: `pnpm test` が全件パス
- [ ] **AC-011**: `pnpm check` が型エラー0件
- [ ] **AC-012**: XSS: `greeting("<script>")` が `&lt;script&gt;` を含む（二重エスケープせず、呼び出し元エスケープを信頼）

## 8. Edge Cases

- **日本語名がインドネシア語メールに入る場合**: greeting は `Yth. もっちみ,` — 言語の混在は正常。名前はユーザーが設定した値をそのまま表示する
- **空の name**: 各言語の greeting 関数はそのまま空文字を受け入れる（呼び出し元の責務）
- **RTL（ar）**: greeting も RTL テキストに合わせる。HTML の `dir="rtl"` は既実装済みで変更不要

## 9. Cross-Reference

| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| `feature-i18n.md` | EmailLocale の定義・メール翻訳の仕組み | なし（拡張のみ） |
| `feature-signature-flow.md` | メール送信フロー・lang パラメータ | なし（翻訳レイヤーのみ変更） |

## 10. Out of Scope

- UIロケール（ダッシュボード表示）への影響なし
- HTML レイアウト変更なし
- DB スキーマ変更なし
- 新規言語の追加なし
- メール件名（subject）の文化的調整（現状を維持）
- 性別（Mr./Ms.）の出し分け（受信者の性別データなし）
