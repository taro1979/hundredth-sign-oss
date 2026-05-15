# Fix Specification: Message from sender — 3バグ修正

## 1. Overview

- **目的**: 「送信者からのメッセージ」機能の3つのバグ（改行不可・RTL言語でメッセージ非表示・署名ページでPDF領域を圧迫）を修正し、実用レベルに引き上げる
- **対象ユーザー**: 文書送信者（メッセージ入力）、署名受信者（メッセージ閲覧）
- **スコープ**: `DocumentNew.tsx`（入力UI）、`email.ts`（メール生成）、`SignDocument.tsx`（署名ページ表示）

---

## 2. User Stories

- As a sender, I want to enter multi-line messages, so that I can write structured instructions to signers.
- As a signer receiving an Arabic email, I want to see the sender's message displayed correctly with RTL layout, so that I can read it naturally.
- As a signer on the signing page, I want to see the sender's message without it compressing the PDF viewing area, so that I can focus on signing.

---

## 3. Functional Requirements

### Bug 1: 改行サポート

**FR-001**: 個別メッセージ入力フィールドを `<Input>` から `<Textarea>` に変更する
- `rows={2}`, `maxLength={1000}`, `resize-none`
- `onChange` ハンドラーは既存と同一（`updateRecipient(index, "message", e.target.value)`）
- グローバルコメントは既に `<Textarea>` のため変更不要

**FR-002**: メール HTML での改行変換
- `escapeHtml(params.message)` の後に `.replace(/\n/g, "<br>")` を適用する
- `escapeHtml` を先に実行してXSSを防いでから変換する（順序厳守）
- 同様の処理を declined reason block にも適用する

**FR-003**: クライアント側テキスト表示での改行保持
- メールプレビュー（`DocumentNew.tsx` line 1363）のメッセージ `<p>` タグに `whitespace-pre-wrap` を付与
- 署名ページのメッセージ表示テキストにも `whitespace-pre-wrap` を付与（FR-007と合わせて実施）

---

### Bug 2: RTL言語メールのメッセージブロック対応

**FR-004**: `buildSignatureRequestEmail` のメッセージブロックにRTL対応を追加する

現状（RTL未対応）:
```html
<td style="padding:0 32px 16px;">
  <div style="background:#f9f9f9;padding:12px 16px;border-left:3px solid #4C00FF;border-radius:4px;">
```

修正後（RTL対応）:
```html
<td style="padding:0 32px 16px;{rtl ? 'text-align:right;' : ''}">
  <div style="background:#f9f9f9;padding:12px 16px;border-{rtl ? 'right' : 'left'}:3px solid #4C00FF;border-radius:4px;" dir="{rtl ? 'rtl' : 'ltr'}">
```

- `buildSignatureRequestEmail` 内で `const rtl = isRtlLanguage(params.lang)` を宣言する
- `isRtlLanguage` は `server/emailTranslations.ts` から既にエクスポート済み

**FR-005**: declined reason block にも同様のRTL対応を適用する（`buildDeclinedNotificationEmail` 内の reason ブロック）

**FR-006**: RTL対応の対象言語
- 現在: `ar`（アラビア語）のみ `dir: "rtl"` が登録されている
- `isRtlLanguage()` は `isRtlLocale()` を通じて汎用判定するため、将来ヘブライ語（`he`）・ペルシャ語（`fa`）が追加されても自動対応する

---

### Bug 3: 署名ページのメッセージ表示位置変更

**FR-007**: 署名ページのフルワイドバナーをヘッダー内Popoverに移動する

現状: ヘッダーとPDF間にフルワイドバナー（`bg-blue-50 border-b border-blue-200`）が表示され、メッセージが長い・改行を含む場合にPDF表示領域を圧迫する

修正後:
- フルワイドバナー（lines 1128-1135）を **削除**
- ヘッダー内のアクションエリア（DropdownMenu の前）に **Popoverボタン** を追加する
  - `request.message` が存在する場合のみ表示
  - ボタン: `<MessageSquare>` アイコン + デスクトップでは "送信者からのメッセージ" ラベル
  - Popover内: メッセージ全文（`whitespace-pre-wrap`で改行保持）
  - `align="end"` でヘッダー右端に揃える
  - モバイルではアイコンのみ表示（ラベルは `hidden sm:inline`）

---

## 4. Non-Functional Requirements

- **セキュリティ**: `escapeHtml` → `.replace(/\n/g, "<br>")` の順序を守ること（逆順は XSS になる）
- **パフォーマンス**: `isRtlLanguage` 呼び出しはビルド時定数ルックアップ。ランタイムコストなし
- **メールクライアント互換性**: `<br>` タグは全主要メールクライアントで対応済み。インラインスタイルの `border-right` も広くサポートされる
- **後方互換**: DB スキーマ変更なし。API の入出力変更なし（`message: string` はそのまま）

---

## 5. Data Model Changes

なし。`signatureRequests.message` は `text` 型のため改行文字はそのまま保存可能。

---

## 6. API / UI Design

**変更ファイル一覧:**

| ファイル | 変更内容 |
|---|---|
| `client/src/pages/DocumentNew.tsx` | L833: `<Input>` → `<Textarea rows={2} maxLength={1000} className="mt-1 resize-none">`<br>L1363: `<p>` に `whitespace-pre-wrap` 追加 |
| `server/email.ts` | L399: `escapeHtml(params.message)` → `escapeHtml(params.message).replace(/\n/g, "<br>")`<br>L395-402: RTL対応 (`isRtlLanguage` + 条件分岐スタイル)<br>declined reason block: 同様の修正 |
| `client/src/pages/SignDocument.tsx` | L1128-1135: フルワイドバナー削除<br>L1079付近: Popoverボタン追加<br>import: `Popover, PopoverTrigger, PopoverContent`, `MessageSquare` |
| `server/email.test.ts` | RTL言語でのメッセージブロック検証テスト追加<br>改行→`<br>`変換テスト追加 |

**権限変更**: なし（`publicProcedure` の署名ページ、`orgProcedure` の送信フローは変更なし）

---

## 7. Acceptance Criteria

### Bug 1: 改行サポート
- [ ] **AC-001**: 個別メッセージ欄で Enter キーを押すと改行が入力できる（`<Textarea>` になっている）
- [ ] **AC-002**: 改行を含むメッセージを送信すると、メール HTML 内に `<br>` タグが含まれる
- [ ] **AC-003**: XSS: `"line1\n<script>alert(1)</script>\nline2"` を送ると `&lt;script&gt;` + `<br>` になる（エスケープが先）
- [ ] **AC-004**: メールプレビューで改行が視覚的に反映される（`whitespace-pre-wrap`）

### Bug 2: RTL言語メール
- [ ] **AC-005**: アラビア語（`lang: "ar"`）の署名依頼メールで、メッセージブロックに `border-right:3px solid #4C00FF` が含まれる
- [ ] **AC-006**: アラビア語メールのメッセージブロックの `<td>` に `text-align:right` が含まれる
- [ ] **AC-007**: 日本語（`lang: "ja"`）の署名依頼メールでは `border-left:3px solid #4C00FF` のまま（デグレなし）
- [ ] **AC-008**: アラビア語 declined メールの reason ブロックに `border-right:3px solid #dc2626` が含まれる
- [ ] **AC-009**: `pnpm test` が全件パス

### Bug 3: 署名ページ表示
- [ ] **AC-010**: 署名ページのヘッダーにフルワイドメッセージバナーが存在しない
- [ ] **AC-011**: `request.message` がある場合、ヘッダーに MessageSquare アイコンのボタンが表示される
- [ ] **AC-012**: そのボタンをクリックするとPopoverが開き、メッセージ全文が表示される
- [ ] **AC-013**: 改行を含むメッセージがPopover内で正しく改行表示される
- [ ] **AC-014**: `request.message` がない場合、ボタンは表示されない
- [ ] **AC-015**: モバイル幅でアイコンのみ表示、デスクトップでアイコン+ラベル表示

---

## 8. Edge Cases

- **空のメッセージ**: `message: ""` の場合、`.replace(/\n/g, "<br>")` は空文字を返す。`messageBlock` の条件分岐（`params.message ? ... : ""`）で空文字は falsy のため問題なし
- **1000文字 + 改行**: maxLength=1000 は改行文字も含めてカウントされる（既存の DB 側 `text` 型の上限なしとは分離して UI レベルで制限）
- **RTL言語 + 改行**: `<br>` タグは RTL コンテキストでも有効。問題なし
- **メッセージのみ改行文字列** (`"\n\n\n"`): `escapeHtml` を通過し `<br><br><br>` になる。メール内では空行が表示されるが害はなし
- **グローバルコメントと個別メッセージの優先度**: 既存ロジック通り（個別メッセージ > グローバルコメント）。本仕様では変更しない

---

## 9. Cross-Reference

| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| `product-spec.md` (Signing flow) | メッセージは `signatureRequests.message` に保存。API は変更なし | なし |
| `fix-email-cultural-formatting.md` | RTL対応の前提として `isRtlLanguage()` が既実装。`hundredthSignEmailLayout` 内のRTLは対応済みだが、メッセージブロックは対象外だった | メッセージブロックのみ追加対応 |
| `product-spec.md` (i18n) | `SupportedLanguage` 型・`isRtlLocale()` を利用 | なし |

---

## 10. Out of Scope

- RTL言語のUI（署名ページ・ダッシュボード）対応
- メッセージの文字数を1000文字以上に拡張
- メッセージに画像・リッチテキストを含める機能
- 新規RTL言語（ヘブライ語、ペルシャ語）の追加
- グローバルコメントと個別メッセージの優先度ロジック変更
- メッセージ入力の文字数カウント表示（個別メッセージ欄）
