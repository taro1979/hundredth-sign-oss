# Feature Specification: fix-i18n-template-variable-mismatch

## 1. Overview
- 目的: 翻訳 JSON のテンプレート変数名とコンポーネントが渡す変数名の不一致を修正し、`{{from}} 〜 {{to}}` のような未展開文字列が UI に表示されるバグを解消する
- 対象ユーザー: 全ユーザー（組織設定ページ・監査ログページを閲覧するすべてのロール）
- スコープ: 翻訳ファイル（ja/en/th/zh-CN）の 2 キーのみ

## 2. User Stories
- As a user, I want to see the certificate validity period correctly, so that I know when the certificate expires.
- As a user, I want to see the audit log count correctly, so that I know how many records are being shown.

## 3. Functional Requirements
1. FR-001: `organization.security.certificate.validRange` の `{{from}}` → `{{start}}`、`{{to}}` → `{{end}}` に変更（全ロケール）
2. FR-002: `auditLog.dashboard.showingRange` の `{{from}}` → `{{start}}`、`{{to}}` → `{{end}}` に変更（全ロケール、`{{total}}` はそのまま）

## 4. Non-Functional Requirements
- パフォーマンス: なし（静的 JSON の変更のみ）
- セキュリティ: なし
- 可観測性: なし

## 5. Data Model Changes
変更なし

## 6. API / UI Design
- コンポーネント側は変更しない。`OrganizationSettings.tsx:1207` が `{ start, end }` を渡しており正しい。
- コンポーネント側は変更しない。`AuditLogDashboard.tsx:284` が `{ start, end, total }` を渡しており正しい。

## 7. Acceptance Criteria
- [ ] AC-001: 組織設定の「プラットフォーム署名証明書」有効期間に実際の日付が表示される（`{{from}}` 等が表示されない）
- [ ] AC-002: 監査ログの件数表示に実際の数値が表示される（`{{from}}` 等が表示されない）
- [ ] AC-003: 全 4 ロケール（ja/en/th/zh-CN）で修正されている
- [ ] AC-004: `pnpm test && pnpm check` がパスする

## 8. 堅牢化要件（実装済み）
<!-- なし -->

## 9. Edge Cases
- なし（JSON キーの変数名置換のみ）

## 10. Cross-Reference
| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| `perUnitPrice` (`{{unit}}` / `{{count}}`) | 同種バグ | 別セッションで修正中のためスキップ |

## 11. Out of Scope
- `perUnitPrice` の `{{unit}}` 問題（別セッションで対応中）
- コンポーネント側の変数名変更
