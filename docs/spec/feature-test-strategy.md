# Feature Specification: テスト戦略

## 1. Overview

- **目的**: プロジェクト全体のテスト方針・カバレッジ目標・層別戦略を定義
- **対象**: 開発者、CI/CD パイプライン
- **スコープ**: ユニットテスト、インテグレーションテスト、E2E テスト

## 2. テスト層と目標

| 層 | ツール | カバレッジ目標 | 主な対象 |
|---|---|---|---|
| Unit | Vitest | ≥ 95% (statements) | ロジック、バリデーション、ヘルパー関数 |
| Integration | Vitest + 実 DB | — | PDF 生成、メール送信、DB 操作 |
| E2E | Playwright | 主要フロー 100% | 署名フロー、稟議、テンプレート、i18n |
| React Smoke | Vitest + @testing-library/react | ≥ 10 コンポーネント | 主要 UI コンポーネントのレンダリング |

## 3. カバレッジ方針

### Vitest 設定（vitest.config.ts）
- `coverage.thresholds`: statements ≥ 95%
- テストファイル: `**/*.test.ts`, `**/*.test.tsx`
- インテグレーションテスト: `**/*.integration.test.ts`（DB 必要）

### テスト命名規則
- ユニット: `{module}.test.ts`
- インテグレーション: `{module}.integration.test.ts`
- E2E: `e2e/{feature}.spec.ts`

## 4. 主要テスト対象

### サーバー側
- `server/routers.ts` — 全 tRPC エンドポイントのモックテスト
- `server/pdf.ts` — PDF 署名埋め込み（フォント・座標変換・証明書）
- `server/db.ts` — DB アクセス関数
- `server/email.ts` — メール送信
- `server/scheduler.ts` — リマインダー・期限切れ処理
- `server/i18nAudit.ts` — 翻訳キー検証

### クライアント側
- `client/src/components/SignaturePad.tsx` — 署名パッド（フォント選択含む）
- `client/src/components/DashboardLayout.tsx` — レイアウト
- `client/src/components/Footer.tsx` — フッター
- `client/src/const.ts` — 定数・設定値

### i18n テスト
- `server/i18n-consistency.test.ts` — 4 言語の翻訳キーセット一致性
- `server/i18n-translation-quality.test.ts` — 未翻訳・アンチパターン検出
- `server/ui-hardcoded-copy.test.ts` — UI ハードコード文字列の静的検証

## 5. E2E テスト環境

- Docker MySQL + Playwright（`feature-e2e-local.md` 参照）
- コマンド: `pnpm test:e2e:setup` → `pnpm test:e2e` → `pnpm test:e2e:teardown`
- 本番コード変更ゼロ（テスト専用設定）

## 6. Acceptance Criteria

- [x] AC-001: `pnpm test` で全ユニット・インテグレーションテストがパス
- [x] AC-002: statements カバレッジ ≥ 95%
- [x] AC-003: 主要フロー（署名・稟議・テンプレート）の E2E テストが存在
- [x] AC-004: i18n 整合性テストがパス（翻訳キー一致・ハードコード検出）
- [x] AC-005: React コンポーネント smoke テスト ≥ 10 件

## 7. Cross-Reference

| 関連仕様 | 接点 |
|---|---|
| `feature-e2e-local.md` | E2E 環境構築の詳細 |
| `oss-single-workspace.md` | OSS単一ワークスペース化後の主要E2E対象 |

## 8. Out of Scope

- パフォーマンステスト / 負荷テスト
- ビジュアルリグレッションテスト
- テスト自動生成ツール
