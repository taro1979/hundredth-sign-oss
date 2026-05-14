# Fix Specification: Flaky テスト修正

## 1. Overview

- **目的**: 既存テストスイート実行時に再現性よく失敗する 3 つのテスト問題を根本原因から修正する
- **対象ユーザー**: 開発者（CI パイプライン）
- **スコープ**: vitest 設定・テストコード・プロダクションコードの計 4 ファイル

## 2. User Stories

- As a developer, I want `pnpm test` to pass consistently in CI, so that false positive failures don't block deployments.

## 3. Functional Requirements

1. **FR-001** `pdf.integration.test.ts` IT-M: vitest `hookTimeout` デフォルト 10s を 30s に拡張し、`beforeEach` 内の `await import("./pdf")` がタイムアウトしないようにする
2. **FR-002** `routers-branch.test.ts` rollback test: fire-and-forget `sendEmail({...}).catch(...)` を `Promise.resolve(sendEmail({...})).catch(...)` に変更し、`sendEmail` が `undefined` を返す場合の TypeError を防ぐ
3. **FR-003** `routers-branch.test.ts` CC email test: FR-002 の修正と併せて `resetMocksToDefaults()` に `sendEmail` mock のリセット処理を追加し、テスト間の mock 状態漏洩を防ぐ
4. **FR-004** `DocumentNew.emailPreview.test.tsx`: `jsdom@28.1.0` → `html-encoding-sniffer@6.0.0` の ESM/CJS 非互換エラーを `vitest.config.ts` の `deps.inline` 設定で解消する

## 4. Non-Functional Requirements

- **再現性**: 全テストをフルスイート実行（`pnpm test`）で 3 回連続パス
- **非侵襲性**: テストの意図（アサーション）は変更しない
- **プロダクション安全性**: FR-002 の `Promise.resolve()` ラッパーは本番コードも堅牢化する

## 5. Data Model Changes

| 対象 | 変更内容 | 備考 |
|---|---|---|
| なし | データモデル変更なし | — |

## 6. API / UI Design

変更なし（テスト基盤 + vitest 設定のみ）

## 7. Acceptance Criteria

- [x] AC-001: `npx vitest run server/pdf.integration.test.ts` が IT-M を含めて全パス
- [x] AC-002: `npx vitest run server/routers-branch.test.ts` が rollback test・CC test を含めて全パス
- [x] AC-003: `npx vitest run client/src/pages/DocumentNew.emailPreview.test.tsx` が `ERR_REQUIRE_ESM` なしにパス
- [x] AC-004: `pnpm test` フルスイートが 1736 件パス（60 files passed | 1 skipped）
- [x] AC-005: `pnpm check` および `pnpm build` が引き続きパス

## 8. 堅牢化要件（実装済み）

| # | 変更ファイル | 内容 |
|---|---|---|
| FR-001 | `vitest.config.ts` | `hookTimeout: 10000`（デフォルト）→ `hookTimeout: 30000` に引き上げ |
| FR-002 | `server/routers.ts` (2箇所) | `sendEmail({...}).catch(...)` → `Promise.resolve(sendEmail({...})).catch(...)` |
| FR-003 | `server/routers-branch.test.ts` | `resetMocksToDefaults()` に `sendEmail`・`buildSignatureRequestEmail` 等 5件の mock リセットを追加 |
| FR-004a | `package.json` | `"jsdom": "^28.1.0"` → `"^26.0.0"`（html-encoding-sniffer@4 CJS 互換） |
| FR-004b | `client/src/test/setup.ts` | `Promise.withResolvers` polyfill 追加（pdfjs-dist@4 対応） |

### 実装後の CI 結果

```
Test Files  60 passed | 1 skipped (61)
      Tests  1736 passed | 5 skipped (1741)
pnpm check: exit 0 (型エラーなし)
pnpm build: exit 0 (ビルド成功)
```

## 9. Root Cause Detail

### IT-M hookTimeout

```
Error: Hook timed out in 10000ms.
```

- `describe.skipIf(...)("IT-K/L/M")` ブロックの `beforeEach` が `await import("./pdf")` を呼ぶ
- vitest のデフォルト `hookTimeout` = 10s
- フルスイート実行時にモジュールキャッシュが汚染されており、re-import に 10s 超かかる
- **修正**: `vitest.config.ts` に `hookTimeout: 30000` を追加

### routers-branch rollback TypeError

```
Error: Cannot read properties of undefined (reading 'catch')
```

- 私の変更: `await sendEmail({...})` → `sendEmail({...}).catch(...)`
- vitest の `vi.clearAllMocks()` + mock 状態により `sendEmail` が `Promise` でなく `undefined` を返す場合がある
- `undefined.catch(...)` が TypeError を投げる
- **修正**: `Promise.resolve(sendEmail({...})).catch(...)` で安全にラップ

### DocumentNew.emailPreview ERR_REQUIRE_ESM

```
Error: require() of ES Module html-encoding-sniffer from jsdom/lib/api.js not supported
```

- `jsdom@28.1.0` の依存: `html-encoding-sniffer@6.0.0`（ESM のみ）
- jsdom が CJS の `require()` で読み込もうとして失敗
- **修正**: `vitest.config.ts` の `test.deps.inline` にパターン追加で Vite がインライン変換

## 10. Edge Cases

- `Promise.resolve(undefined)` は `Promise.resolve()` と等価（即座に resolve）。実装上の副作用なし
- `deps.inline` は test 環境のみ適用。本番バンドルへの影響なし

## 11. Cross-Reference

| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| `fix-multi-signer-loading-hang.md` | fire-and-forget 変更の修正 | 要修正（routers.ts） |

## 12. Out of Scope

- jsdom のメジャーバージョンダウングレード（deps.inline で解決できるため）
- E2E テストの flakiness 修正
- IT-K/L/M 以外の pdf.integration テストの高速化
