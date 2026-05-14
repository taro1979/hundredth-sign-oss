# Fix Specification: テストバグ修正 (AC-006 delegatedFromEmail / IT-M タイムアウト)

## 1. Overview

- **目的**: `pnpm test` で失敗する2つの既存バグを根本原因から修正する
- **対象ユーザー**: 開発者（CI パイプライン）
- **スコープ**: テストコード2ファイル + vitest 設定1ファイル

## 2. User Stories

- As a developer, I want `pnpm test` to pass consistently, so that false failures don't block development.

## 3. Functional Requirements

1. **FR-001** `routers.test.ts` AC-006: `sign` プロシージャが `getSignatureRequestsByDocument` を2回呼ぶ（line 249: バリデーション用、line 353: PDF生成用）が、テストは `mockResolvedValueOnce` を1回だけ設定している。2回目のモック追加で、PDF生成コールが正しいデータ（original + delegate）を受け取れるようにする。
2. **FR-002** `routers.test.ts` AC-006: 同様に `getSignatureFieldsByDocument` も2回呼ばれる（line 252、line 354）ため、2回目のモックを追加する。
3. **FR-003** `vitest.config.ts`: `fix-flaky-tests.md` FR-001 で指定済みの `hookTimeout: 30000` が現在の設定に未適用のため追加する（IT-M `beforeEach` の `await import("./pdf")` タイムアウト解消）。

## 4. Non-Functional Requirements

- **非侵襲性**: テストのアサーション（期待値）は変更しない。モック設定のみ追加。
- **再現性**: 修正後、`pnpm test` を3回連続でパスすること。
- **プロダクション安全性**: 本番コードへの変更なし。

## 5. Data Model Changes

| 対象 | 変更内容 | 備考 |
|---|---|---|
| なし | データモデル変更なし | — |

## 6. API / UI Design

変更なし（テスト基盤 + vitest 設定のみ）

## 7. Acceptance Criteria

- [ ] AC-001: `npx vitest run server/routers.test.ts` で AC-006 "certificate shows delegatedFromEmail" テストがパスする
- [ ] AC-002: AC-006 テストで `appendCompletionCertificate` が `signerEmail: "delegate@example.com", delegatedFromEmail: "original@example.com"` を含むエントリで呼ばれることを確認
- [ ] AC-003: `npx vitest run server/pdf.integration.test.ts` で IT-M "two signatures with same fontId → font CDN fetched exactly once" がタイムアウトなしでパスする
- [ ] AC-004: `pnpm test` フルスイートが全パスする
- [ ] AC-005: `pnpm check` および `pnpm build` が引き続きパスする

## 8. Root Cause Detail

### Bug 1: AC-006 delegatedFromEmail (routers.test.ts)

**`signature.sign` プロシージャ内の `getSignatureRequestsByDocument` 呼び出し回数:**

| 行番号 | 用途 | テストのモック状況 |
|---|---|---|
| line 249 | バリデーション（署名フィールド有無チェック） | 1回目の `mockResolvedValueOnce` が消費される ✓ |
| line 353 | PDF生成・auditEntries構築 | **モックなし → グローバルデフォルト（status:"sent"単一署名者）が返る** ❌ |

**影響:**
- `auditEntries = signerRequests.filter(r => r.status === "signed")` → 空配列
- `appendCompletionCertificate` が `delegatedFromEmail` なしで呼ばれる
- `expect.objectContaining({ delegatedFromEmail: "original@example.com" })` アサーション失敗

`getSignatureFieldsByDocument` も同様に2回呼ばれる（line 252 と line 354）。

### Bug 2: IT-M タイムアウト (pdf.integration.test.ts / vitest.config.ts)

**`fix-flaky-tests.md` の FR-001 指定内容（実装済みと記録）:**
```
vitest.config.ts に hookTimeout: 30000 追加
```

**実際の vitest.config.ts（現在）:**
```typescript
test: {
  testTimeout: 60000,   // ← 存在
  // hookTimeout: 30000  ← 未追加
  ...
}
```

`describe.skipIf(!FONT_AVAILABLE)("IT-K/L/M")` ブロックの `beforeEach` が
`await import("./pdf")` を実行する際、フルスイート実行時にモジュールキャッシュの
再読み込みが発生し、デフォルトの `hookTimeout: 10000` を超える場合がある。

## 9. 修正内容

### FR-001 + FR-002: routers.test.ts AC-006 テスト修正

`(getSignatureRequestsByDocument as any).mockResolvedValueOnce(...)` を **2回** に増やす:

- 1回目（line 249 のバリデーション用）: 既存のモック設定（original + delegate）
- 2回目（line 353 のPDF生成用）: 同じデータ（original + delegate）を追加

`(getSignatureFieldsByDocument as any).mockResolvedValueOnce(...)` も **2回** に増やす:

- 1回目（line 252 のバリデーション用）: 既存のモック設定
- 2回目（line 354 のPDF生成用）: 同じデータを追加

### FR-003: vitest.config.ts hookTimeout 追加

```typescript
test: {
  testTimeout: 60000,
  hookTimeout: 30000,  // ← 追加: IT-M beforeEach タイムアウト解消
  ...
}
```

## 10. Edge Cases

- `mockResolvedValueOnce` は消費順に返される。2回目の追加は既存の1回目の後に追加すること
- `hookTimeout` は `beforeEach`/`afterEach` に適用。`testTimeout` とは独立した設定
- `getSignatureFieldsByDocument` の2回目モックは、PDF生成で使われるフィールドデータと同じ内容で問題ない

## 11. Cross-Reference

| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| `fix-flaky-tests.md` | IT-M hookTimeout（FR-001 として記録済みだが未適用） | hookTimeout 追加で完了とする |
| `feature-test-strategy.md` | テスト方針（mock は実際の呼び出し回数に合わせる） | 変更なし |

## 12. Out of Scope

- `pdf.ts` のプロダクションコード変更（`_fontLoadPromise` リセット等）
- IT-K1/K2/IT-L 以外の pdf.integration テストの変更
- 署名フロー自体の動作変更
