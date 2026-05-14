# Feature Specification: 署名フィールドなしドキュメントの署名完了バグ修正

## 1. Overview
- 目的: date/name/initials のみで signature/stamp フィールドがないドキュメントで署名者が「Finish Signing」を押すと `errors.signature.dataRequired` エラーが出て署名完了できないバグを修正する
- 対象ユーザー: 署名者（外部 signer）
- スコープ: サーバー側 `sign` ミューテーションのバリデーション修正 + フロントエンド `handleSubmitAll` の送信ロジック修正

## 2. User Stories
- As a signer, I want to complete signing a document that only has date/name/initials fields, so that I can finish the signing process without being blocked by a false validation error.
- As a signer, I want to complete signing a document with signature fields, so that my signature data is captured and validated correctly.

## 3. Functional Requirements
1. **FR-001**: ドキュメントの signatureFields に `type = 'signature'` または `type = 'stamp'` のフィールドが 1 件以上ある場合のみ、`signatureDataUrl` / `signatureFont` / `stampDataUrl` のいずれかを必須とする。
2. **FR-002**: signatureFields に signature/stamp 型がない場合（date/name/initials のみ）、署名データなしで署名完了を許可する。
3. **FR-003**: フロントエンドは `signatureEntry` が undefined でも `signMutation.mutate()` を実行する（サーバーに判断を委ねる）。

## 4. Non-Functional Requirements
- パフォーマンス: `sign` ミューテーション内で `getSignatureFieldsByDocument` を 1 回追加呼び出し（既存クエリの増加は最小限）
- セキュリティ: バリデーション要件の緩和は「フィールド型に依存」する条件付き緩和のみ。signature フィールドがある場合の要求は維持する。
- 可観測性: バリデーション失敗時は既存と同じ `TRPCError` で返す（エラーメッセージ変更なし）

## 5. Data Model Changes
| 対象 | 変更内容 | 備考 |
|---|---|---|
| なし | データモデルの変更なし | signatureFields テーブルの `type` カラムを読み取るのみ |

## 6. API / UI Design

### API: `signature.sign` ミューテーション (`server/routers/signature.ts`)

**変更前**:
```typescript
.input(z.object({...}).refine(
  data => (data.signatureDataUrl && data.signatureDataUrl.length > 0) || data.signatureFont || data.stampDataUrl,
  { message: "errors.signature.dataRequired", path: ["signatureDataUrl"] }
))
```

**変更後**:
```typescript
// Zod refine を削除 — バリデーションはミューテーション内で実施
.input(z.object({
  token: z.string().min(1),
  signerEmail: z.string().email("signing.errors.invalidEmail"),
  signatureDataUrl: z.string().max(700_000, "signing.errors.signatureDataTooLarge").optional(),
  signatureFont: signatureFontSchema.optional(),
  stampDataUrl: z.string().max(280_000, "印鑑データが大きすぎます").optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
}))
```

ミューテーション内（email 検証の後、`updateSignatureRequest` の前）に追加:
```typescript
// 条件付きバリデーション: signature/stamp フィールドがある場合のみ署名データを必須とする
const allFields = await getSignatureFieldsByDocument(document.id);
const hasSignatureOrStampField = allFields.some(f => f.type === 'signature' || f.type === 'stamp');
if (hasSignatureOrStampField) {
  const hasSignatureData = (input.signatureDataUrl && input.signatureDataUrl.length > 0)
    || input.signatureFont
    || input.stampDataUrl;
  if (!hasSignatureData) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "errors.signature.dataRequired" });
  }
}
```

### UI: `handleSubmitAll` (`client/src/pages/SignDocument.tsx`)

**変更前**:
```typescript
const signatureEntry = Object.values(fieldSignatures).find(
  s => s.signatureDataUrl || (s.signatureFont && s.signatureFont !== 'noto-sans-jp') || s.stampDataUrl
);
signMutation.mutate({
  token: token || "",
  signerEmail: emailInput,
  signatureDataUrl: signatureEntry?.signatureDataUrl || undefined,
  signatureFont: ...,
  stampDataUrl: signatureEntry?.stampDataUrl || undefined,
});
```

**変更後**: `signatureEntry` が `undefined` でも `mutate` を呼ぶように修正（サーバーが条件判断を担う）。

```typescript
const signatureEntry = Object.values(fieldSignatures).find(
  s => s.signatureDataUrl || (s.signatureFont && s.signatureFont !== 'noto-sans-jp') || s.stampDataUrl
);
// signatureEntry が undefined（signature/stamp フィールドなし）でも送信を許可
signMutation.mutate({
  token: token || "",
  signerEmail: emailInput,
  signatureDataUrl: signatureEntry?.signatureDataUrl || undefined,
  signatureFont: (signatureEntry?.signatureFont && signatureEntry.signatureFont !== 'noto-sans-jp')
    ? signatureEntry.signatureFont as any
    : undefined,
  stampDataUrl: signatureEntry?.stampDataUrl || undefined,
});
```

※ `handleSubmitAll` に `if (!signatureEntry) return;` のようなガードが追加されていれば削除する。

- 権限: 変更なし（publicProcedure のまま、トークンベース認証）

## 7. Acceptance Criteria
- [ ] AC-001: date/name/initials フィールドのみのドキュメントで全フィールド入力後「Finish Signing」をクリックすると、エラーなく署名完了できる
- [ ] AC-002: signature フィールドを含むドキュメントで SignaturePad から署名を入力せずに「Finish Signing」をクリックすると `errors.signature.dataRequired` エラーが返る
- [ ] AC-003: stamp フィールドを含むドキュメントで印鑑データなしで「Finish Signing」をクリックすると `errors.signature.dataRequired` エラーが返る
- [ ] AC-004: signature フィールドを含むドキュメントで正しく署名データを入力した場合、署名完了できる
- [ ] AC-005: `pnpm test` が全パス
- [ ] AC-006: `pnpm check` が通る

## 8. 堅牢化要件（実装済み）
<!-- 実装後に追記 -->

## 9. Edge Cases
- ドキュメントにフィールドが 0 件の場合（フィールドなし）: `hasSignatureOrStampField` が false → 署名データなしで完了可能
- stamp フィールドはあるが signature フィールドはない場合: stampDataUrl が必須（signatureDataUrl/signatureFont は不要）
- signature フィールドはあるが stamp フィールドはない場合: signatureDataUrl か signatureFont のいずれかが必須

## 10. Cross-Reference
| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| `docs/spec/` 署名完了フロー全般 | sign ミューテーション入力バリデーションの変更 | なし（既存仕様の挙動を上位互換で拡張） |
| `server/routers.test.ts` | `signature.sign` の `dataRequired` テストケース | 要更新（refine からミューテーション内バリデーションへ移動） |

## 11. Out of Scope
- フィールドなし/date-only ドキュメントの署名完了証明書 PDF の見た目変更（既存ロジックで null のまま処理される）
- ドキュメント作成時に「signature フィールドが必須」を強制するバリデーション追加
- フロントエンドでの事前バリデーション（サーバーに委ねる方針）
