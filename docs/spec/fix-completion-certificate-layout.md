# Feature Specification: fix-completion-certificate-layout

## 1. Overview
- 目的: 署名完了証明書 PDF のレイアウト品質を改善し、視認性・可読性を向上させる
- 対象ユーザー: 署名完了後に証明書 PDF を確認・印刷するすべてのユーザー（署名者・文書オーナー）
- スコープ: `server/pdf.ts` の `appendCompletionCertificate` 関数内のレイアウト処理のみ

## 2. User Stories
- As a document owner, I want the completion certificate to be clearly readable, so that I can easily verify signing details at a glance.
- As a signer, I want each signer section to be visually distinct, so that I can confirm my own signing record without confusion.
- As an auditor, I want the hash value to appear on a separate line from its label, so that I can copy and verify it without ambiguity.

## 3. Functional Requirements
1. FR-001: "Signed Content Hash (pre-cert):" ラベルを独立した行に表示し、ハッシュ値をその次の行（valueX インデントあり）に表示する
2. FR-002: "Signer N" ヘッダーを濃紺背景（rgb(0.1, 0.1, 0.4)）+ 白文字のバー形式で表示する（高さ 20pt）
3. FR-003: User-Agent のフォントサイズを 7pt から 8pt に拡大する
4. FR-004: User-Agent のテキスト色を rgb(0.5, 0.5, 0.5) から rgb(0.4, 0.4, 0.4) に濃くする
5. FR-005: User-Agent の切り詰め文字数を 90 文字から 120 文字に拡大する
6. FR-006: User-Agent の行間を 10pt から 11pt に広げる
7. FR-007: Signer ボックスの高さ計算を headerBarHeight（20pt）に合わせて正確に行う

## 4. Non-Functional Requirements
- パフォーマンス: PDF 生成時間に実質的な影響なし（描画命令の追加のみ）
- セキュリティ: 変更なし（証明書内容・ハッシュの正確性に影響を与えない）
- 可観測性: 既存の `[PDF]` ログ出力は維持する

## 5. Data Model Changes
| 対象 | 変更内容 | 備考 |
|---|---|---|
| なし | — | レイアウト変更のみ。DB・スキーマ変更なし |

## 6. API / UI Design
- API: 変更なし（`appendCompletionCertificate` のシグネチャ・引数変更なし）
- UI: 生成される証明書 PDF のビジュアルのみ変更
- 権限: 変更なし

### レイアウト変更詳細

| 要素 | 変更前 | 変更後 |
|---|---|---|
| Hash ラベルと値 | 同一行（ラベルが長いと値と重なる） | ラベル行 → 次行にインデント付き値 |
| Signer N ヘッダー | プレーンテキスト（濃紺文字） | 濃紺背景バー（高さ 20pt）+ 白文字 |
| UA フォントサイズ | 7pt | 8pt |
| UA テキスト色 | rgb(0.5, 0.5, 0.5) | rgb(0.4, 0.4, 0.4) |
| UA 切り詰め | 90文字 | 120文字 |
| UA 行間 | 10pt | 11pt |

## 7. Acceptance Criteria
- [x] AC-001: 証明書の "Signed Content Hash (pre-cert):" ラベルと SHA-256 ハッシュ値が異なる行に表示される
- [x] AC-002: 各 Signer セクションのヘッダー行が濃紺バー + 白文字で表示される
- [x] AC-003: User-Agent が 8pt フォントで表示される
- [x] AC-004: User-Agent のテキスト色が以前より濃い（rgb ≤ 0.4）
- [x] AC-005: User-Agent が 120 文字以内なら切り詰めなしで全文表示される
- [x] AC-006: `pnpm test` が全テストパスする（pdf.integration.test.ts を含む）
- [x] AC-007: `pnpm check` が型エラーなしで通る

## 8. Edge Cases
- 署名者が 0 人の場合: Signer セクションが空になるが、ヘッダーバー描画ループは実行されないため問題なし
- 署名者が多くて自動改ページが発生する場合: `ensureSpace` によりページ追加後もレイアウトは維持される
- User-Agent が 120 文字超の場合: 117 文字 + "..." で切り詰め、wrapText により複数行に折り返し
- User-Agent が null / 空の場合: "N/A" で代替表示（既存動作を維持）

## 9. Cross-Reference
| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| `fix-worm-compliance.md` | completedAt / contentHash の正確性 | 調整なし（内容変更なし） |
| `fix-pdf-rendering-bugs.md` | safeDrawText / wrapText ヘルパー | 調整なし（関数は変更せず利用のみ） |
| `feature-audit-worm.md` | 監査ログと証明書の整合性 | 調整なし |

## 10. Out of Scope
- 証明書の内容（ハッシュ値・タイムスタンプ・署名者情報）の変更
- 日本語 Bold フォント variant の追加
- 多言語対応（ラベルの翻訳）
- 証明書レイアウトのユーザー設定化
- フッターテキストの変更
