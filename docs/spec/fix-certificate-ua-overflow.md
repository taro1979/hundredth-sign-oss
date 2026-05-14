# Feature Specification: fix-certificate-ua-overflow

## 1. Overview
- 目的: 署名完了証明書の Signer Details ボックスで User-Agent テキストが右端からはみ出すバグを修正する
- 対象ユーザー: 署名完了後に証明書 PDF を確認するすべてのユーザー
- スコープ: `server/pdf.ts` の `appendCompletionCertificate` 内 UA 描画処理のみ

## 2. User Stories
- As a document owner, I want the UA string to stay within the signer box, so that the certificate looks professional and is readable without content being cut off.

## 3. Root Cause Analysis

### 問題
`wrapText` で UA テキストの折り返し幅を計算する際に `japaneseFont` を使用しているが、
日本語フォント（NotoSansJP 等）は ASCII 文字のグリフ幅メトリクスが Helvetica と異なる。
- `widthOfTextAtSize`（japaneseFont）が報告する幅 < 実際の描画幅
- 結果として折り返し位置がずれ、テキストがボックス右端からはみ出す

### 証拠
スクリーンショットで `5 .0`、`1 0 _1 5 _7` のように数字・記号間に余分なスペースが表示されており、
日本語フォントが ASCII 文字を等幅・広幅で描画していることが確認できる。

## 4. Functional Requirements

1. FR-001: UA テキストの折り返し幅計算（`wrapText` の primary font 引数）を `helvetica` に変更する
2. FR-002: UA テキストの描画（`safeDrawText` の `font` 引数）を `helvetica` に変更し、
   CJK フォールバックが必要な場合のみ `japaneseFont` を使う
3. FR-003: 修正後、UA テキストがボックス内に収まること（はみ出しなし）

## 5. Non-Functional Requirements
- パフォーマンス: 変更なし（Helvetica は pdf-lib 組込みフォントで追加ロード不要）
- セキュリティ: 変更なし
- 可観測性: 既存の `[PDF]` ログ出力を維持

## 6. Data Model Changes
| 対象 | 変更内容 | 備考 |
|---|---|---|
| なし | — | DB・スキーマ変更なし |

## 7. API / UI Design
- API: 変更なし（`appendCompletionCertificate` のシグネチャ変更なし）
- UI: 証明書 PDF の UA 行がボックス内に正しく折り返される

### 変更箇所（`server/pdf.ts`）

| 行 | 変更前 | 変更後 |
|---|---|---|
| L831 `wrapText` 呼び出し | `wrapText(..., japaneseFont, helvetica, ...)` | `wrapText(..., helvetica, helvetica, ...)` |
| L903 `safeDrawText` の font | `font: japaneseFont, fallbackFont: helvetica` | `font: helvetica, fallbackFont: japaneseFont` |

## 8. Acceptance Criteria
- [ ] AC-001: 実際の Chrome UA 文字列（100〜120文字）を含む証明書を生成しても、UA テキストが Signer ボックス右端からはみ出さない
- [ ] AC-002: UA テキストが複数行に適切に折り返される（1行あたり Helvetica 8pt で `contentWidth - 24` 以内に収まる）
- [ ] AC-003: `pnpm test` が全テストパスする
- [ ] AC-004: `pnpm check` が型エラーなしで通る

## 9. Edge Cases
- UA が null / 空の場合: "N/A" で代替表示（既存動作を維持）
- UA に CJK 文字が含まれる場合: Helvetica では描画不可だが `fallbackFont: japaneseFont` で対応
- UA が 120 文字超の場合: 既存の切り詰め（117 文字 + "..."）は維持

## 10. Cross-Reference
| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| `fix-completion-certificate-layout.md` | wrapText / safeDrawText の利用パターン | 今回の修正対象 |

## 11. Out of Scope
- UA の最大文字数変更（120文字制限はそのまま）
- 他のフィールド（Name, Email, IP 等）のフォント変更
- 証明書の多言語対応
