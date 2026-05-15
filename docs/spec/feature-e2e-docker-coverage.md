# Feature Specification: E2E テスト Docker 環境整備 + カバレッジ 90%+

## 1. Overview

- **目的**: E2E テストをポータブルな Docker 環境で安定実行し、カバレッジ 90% 以上を定量的に証明できるようにする
- **対象ユーザー**: 開発者、CI パイプライン
- **スコープ**: playwright.config.ts の NVM パス修正、カバレッジ計装（クライアント + サーバー）、カバレッジ収集スクリプト追加

## 2. User Stories

- As a developer, I want E2E tests to run without a hardcoded NVM path, so that any machine can execute them.
- As a developer, I want to see which code paths are covered by E2E tests, so that I can identify untested user flows.
- As a CI system, I want E2E tests to fail if coverage drops below 90%, so that regressions are caught automatically.

## 3. 現状と問題

| 項目 | 現状 | 問題 |
|------|------|------|
| MySQL | Docker ✅ | 問題なし |
| App Server 起動 | `playwright.config.ts` の `webServer` で起動 | NVM パスがハードコード（`/Users/yasuaki/.nvm/...`）→ 他マシン・CI で失敗 |
| カバレッジ計測 | なし | E2E から何%のコードを実行しているか不明 |
| テストケース数 | 98+ テスト | 90% 達成の根拠がない |

## 4. Functional Requirements

### FR-001: playwright.config.ts の NVM パス修正

`webServer.command` の NVM ハードコードパスを除去し、`pnpm exec` 経由で実行する。

```typescript
// Before（ハードコード）
command: "bash -lc 'export PATH=/Users/yasuaki/.nvm/.../bin:$PATH; ... tsx server/_core/index.ts'",

// After（ポータブル）
command: "NODE_ENV=development dotenv -e .env.e2e -- pnpm exec tsx server/_core/index.ts",
```

### FR-002: クライアントサイド カバレッジ計装

Playwright の `page.coverage` API（V8 coverage）を使用して Chromium セッション中の JavaScript カバレッジを収集する。

#### 実装方針

1. `e2e/fixtures.ts` の各 fixture で `page.coverage.startJSCoverage()` を呼び出す
2. テスト終了後に `page.coverage.stopJSCoverage()` で収集
3. istanbul/v8-to-istanbul でフォーマット変換し JSON/LCOV レポート生成

#### 対象ファイル

- `client/src/**/*.{ts,tsx}` — フロントエンドコード（トランスパイル済み JS に対応）
- 除外: `node_modules/`, `e2e/`, テストファイル

### FR-003: サーバーサイド カバレッジ計装

`NODE_V8_COVERAGE` 環境変数を使用して Node.js V8 カバレッジを収集する。

```bash
# .env.e2e への追加
NODE_V8_COVERAGE=./coverage/e2e-server
```

Playwright テスト完了後に `c8 report` でレポート生成。

### FR-004: カバレッジ収集スクリプト追加

`package.json` に以下を追加:

```json
{
  "test:e2e:coverage": "dotenv -e .env.e2e -- playwright test --reporter=html,json",
  "test:e2e:report": "c8 report --include='server/**/*.ts' --exclude='**/*.test.ts' --reporter=html --reporter=text"
}
```

### FR-005: カバレッジ閾値設定

`playwright.config.ts` または専用 `c8.config.js` でカバレッジ閾値を設定:

```javascript
// c8.config.js
module.exports = {
  all: true,
  include: ["server/**/*.ts", "client/src/**/*.ts"],
  exclude: ["**/*.test.ts", "**/*.spec.ts", "e2e/**", "node_modules/**"],
  branches: 90,
  lines: 90,
  functions: 90,
  statements: 90,
  reporter: ["text", "html", "lcov"],
};
```

### FR-006: カバレッジ不足テストケースの補完

既存 98+ テストケースで 90% に達しない箇所を特定し、追加テストを作成する。

優先カバレッジ対象:
- 署名フロー完全シナリオ（順次署名、並列署名）
- ワークスペース保存フロー（import-preference）
- 稟議フロー（承認・否決）
- エラーパス（無効トークン、期限切れ、アクセスコード不一致）

## 5. Non-Functional Requirements

- **ポータビリティ**: NVM パスを含まない。`pnpm` のみあれば動作
- **CI対応**: GitHub Actions / Docker 環境でコマンド 2 本で実行可能
  ```bash
  pnpm test:e2e:setup
  pnpm test:e2e:coverage
  ```
- **パフォーマンス**: カバレッジ収集によるテスト時間増加 < 20%

## 6. Data Model Changes

なし（テスト・設定ファイルのみ変更）

## 7. API / UI Design

変更なし

## 8. Implementation Details

### 8-1. 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `playwright.config.ts` | 修正 | NVM ハードコードパス除去 |
| `e2e/fixtures.ts` | 修正 | V8 カバレッジ収集ロジック追加 |
| `package.json` | 修正 | `test:e2e:coverage`, `test:e2e:report` スクリプト追加 |
| `c8.config.js` | 新規 | カバレッジ閾値設定（branches/lines/functions/statements: 90%） |
| `.env.e2e` | 修正 | `NODE_V8_COVERAGE=./coverage/e2e-server` 追加 |

### 8-2. Playwright V8 Coverage 収集パターン

```typescript
// e2e/fixtures.ts（修正後）
ownerPage: async ({ browser }, use) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.coverage.startJSCoverage();

  // ... 既存の cookie セット処理 ...

  await use(page);

  const coverage = await page.coverage.stopJSCoverage();
  // coverage を global state に蓄積（テスト全体で集約）
  await ctx.close();
},
```

### 8-3. カバレッジレポート出力先

```
coverage/
  e2e-client/     ← Playwright V8 coverage (クライアント JS)
  e2e-server/     ← NODE_V8_COVERAGE (サーバー Node.js)
  combined/       ← c8 report の最終出力
    index.html    ← HTML レポート
    lcov.info     ← LCOV 形式（CI ツール連携用）
```

## 9. Acceptance Criteria

- [ ] AC-001: `pnpm test:e2e:setup && pnpm test:e2e` が NVM パスなしで実行できる（`/Users/yasuaki` を含まない）
- [ ] AC-002: `pnpm test:e2e:coverage` 実行後に `coverage/` ディレクトリが生成される
- [ ] AC-003: クライアントサイドカバレッジ（statements）が 90% 以上
- [ ] AC-004: サーバーサイドカバレッジ（statements）が 90% 以上
- [ ] AC-005: カバレッジ閾値未達時に CI が失敗する（`c8` の `--check-coverage` フラグ）
- [ ] AC-006: 既存 98+ テストケースが全てパスし続ける（デグレなし）
- [ ] AC-007: `pnpm test:e2e:teardown` でカバレッジディレクトリも含めてクリーンアップされる

## 10. Edge Cases

- `page.coverage` は Chromium のみ対応（Firefox/WebKit 未対応）→ `projects: [chromium]` のみの現行設定と整合
- `NODE_V8_COVERAGE` はサーバープロセス終了時に書き込まれる → Playwright の `webServer` プロセスが正常終了することを確認
- カバレッジ収集によりテストが遅くなる場合 → `timeout: 30_000` を `45_000` に拡張

## 11. Cross-Reference

| 関連仕様 | 接点 | 調整有無 |
|---------|------|---------|
| `feature-e2e-local.md` | FR-001〜FR-007 の基盤実装（既完了） | playwright.config.ts の修正のみ |
| `feature-test-coverage-full.md` | ユニットテストカバレッジ 95% 達成済み | E2E カバレッジは独立計測 |
| `docs/spec/fix-sign-url-locale-param.md` | signUrl locale パラメータ — E2E テストで URL に `?lng=th` が含まれることも検証可能 | 新規 E2E テスト追加候補 |

## 12. Out of Scope

- アプリサーバーの Docker 化はこの E2E カバレッジ仕様の範囲外。OSS 配布用の Dockerfile / Compose は
  `docs/docker.md` を参照。
- GitHub Actions ワークフロー定義 → 別タスク
- Firefox / WebKit カバレッジ → Chromium のみで十分
- メール送信・Stripe Webhook の E2E テスト → 外部サービス依存のため除外

## 13. レビュー用サマリー

### 目的
E2E テスト環境の NVM 依存を除去しポータブル化し、カバレッジ計測で 90% 達成を定量証明する。

### 主要要件
1. playwright.config.ts から `/Users/yasuaki` ハードコードパスを除去
2. Playwright V8 Coverage API でクライアント JS カバレッジを収集
3. `NODE_V8_COVERAGE` でサーバー Node.js カバレッジを収集
4. `c8` で 90% 閾値チェック + HTML/LCOV レポート生成

### 既存実装への影響
- `playwright.config.ts`: `webServer.command` の 1 行修正のみ
- `e2e/fixtures.ts`: `startJSCoverage` / `stopJSCoverage` 追加
- 既存テストロジック: 変更なし

### トレードオフ
- カバレッジ収集によるテスト実行時間 +10〜20%（許容範囲内）
- E2E カバレッジ対応ではアプリサーバーの Docker 化を扱わない。OSS 配布用 Docker 対応は別導線。

### Out of Scope
- E2E カバレッジ専用のアプリサーバー Docker 化
- CI/CD ワークフロー定義
- Firefox/WebKit カバレッジ
