# Fix Specification: PDF署名の「X」文字化け（CJK文字 × Latin専用フォント）

## 1. Overview

- **目的**: 日本語など CJK 文字を含む署名者名で「タイプ署名」を使用した際、生成 PDF に「X」（.notdef グリフ）が表示されるバグを修正する
- **対象ユーザー**: 日本語名の署名者（Dancing Script / Great Vibes 等 Latin 専用フォントを選択した場合）
- **スコープ**: `server/pdf.ts` の署名描画ロジック（`embedSignaturesIntoPdf` 内の `signature` フィールド処理）。署名フロー全体の挙動は `docs/spec/product-spec.md` の Signing flow セクションを参照。

## 2. User Stories

- As a signer, I want my Japanese name to appear correctly in the signed PDF, so that the document is readable and valid.

## 3. Problem Analysis

### 3.1 バグ導入元

コミット **99ebad5**（2026-03-12, "fix: preserve selected signature font in generated PDFs"）が導入。

### 3.2 再現条件

以下 **全て** を満たす場合にバグ発生:

| 条件 | 値 |
|---|---|
| 署名モード | タイプ（type モード） |
| 選択フォント | Dancing Script / Great Vibes / Pacifico / Sacramento / Allura（Latin 専用） |
| 署名者名 | CJK 文字（日本語・中国語など）を含む |

> **Klee One は日本語対応フォントのため影響なし。**
> **手書き（draw モード）・はんこ（stamp モード）は PNG のみ送信するため影響なし。**

### 3.3 根本原因

```
現在のロジック（バグあり）:

if (sig.signatureFont) {
  fontBytes = loadSignatureFontBytes(sig.signatureFont)   // 成功（Dancing Script は取得できる）
  embedFont(fontBytes)                                     // 成功（フォント埋め込み自体は成功）
  safeDrawText("山田太郎", font=Dancing Script)            // ← ここが問題
    └─ Drawing Script に CJK グリフが存在しない
    └─ pdf-lib は例外を投げず .notdef グリフ（X/□）を描画
    └─ safeDrawText の catch には到達しない
  renderedTextSignature = true                             // PNG フォールバックがスキップされる
}
```

**pdf-lib は missing glyph に対して例外を投げず `.notdef` グリフを描画する**。
そのため `safeDrawText` の例外ベース・フォールバックは機能しない。

### 3.4 なぜ過去の修正（subset 切替）で治らなかったか

| 過去の修正 | 内容 | 効かない理由 |
|---|---|---|
| 405b342 | `subset: true → false` | フォント埋め込み方式の問題ではなく、Latin フォントへの CJK テキスト描画の問題 |
| 88304bc | `subset: false → true` | 同上 |

### 3.5 クライアント側で問題が起きない理由

ブラウザの Canvas は **フォントフォールバック機能**を持ち、Dancing Script で CJK 文字を描画しようとすると自動的にシステムの CJK フォントを使用して PNG を生成する。
この PNG（`signatureDataUrl`）は CJK 文字を正しく表示しているが、PDF 生成時に使われていない。

## 4. Functional Requirements

1. **FR-PDF-001**: `sig.signatureDataUrl`（有効な PNG）が存在する場合は、`sig.signatureFont` の有無にかかわらず **PNG 画像を使用**する
2. **FR-PDF-002**: `sig.signatureDataUrl` が存在しない（または無効）かつ `sig.signatureFont` が存在する場合のみ、フォントテキスト描画を試行する
3. **FR-PDF-003**: フォントテキスト描画も失敗した場合（フォント取得失敗・例外）、`japaneseFont`（Noto Sans JP）で `signerName` をテキスト描画する
4. **FR-PDF-004**: 署名下の日付テキスト描画（`japaneseFont` 使用）は現行のまま維持する

### 優先順位の変更

| 優先度 | Before（バグあり） | After（修正後） |
|---|---|---|
| 1st | `signatureFont` でテキスト描画 | `signatureDataUrl` で PNG 画像描画 |
| 2nd | `signatureDataUrl` で PNG 画像 | `signatureFont` でテキスト描画 |
| 3rd | `japaneseFont` でテキスト描画 | `japaneseFont` でテキスト描画 |

> **PNG 優先の根拠**: PNG はブラウザがフォントフォールバック込みで正確に描画した結果であり、CJK/Latin を問わず常に正しく表示される。フォントテキスト描画は PNG がない場合の最終手段とする。

## 5. Data Model Changes

なし（DB スキーマ変更なし）

## 6. API / UI Design

**変更対象ファイル**: `server/pdf.ts` のみ

```typescript
// 修正後のロジック（server/pdf.ts, field.type === "signature" ブロック）

} else if (field.type === "signature") {
  // PNG 優先: signatureDataUrl が有効な PNG なら必ずそれを使う
  if (sig.signatureDataUrl?.startsWith("data:image/png")) {
    try {
      const base64Data = sig.signatureDataUrl.split(",")[1];
      if (base64Data) {
        const imgBytes = Buffer.from(base64Data, "base64");
        const pngImage = await pdfDoc.embedPng(imgBytes);
        const scaledDims = pngImage.scaleToFit(fieldWidth, fieldHeight);
        page.drawImage(pngImage, {
          x: x + (fieldWidth - scaledDims.width) / 2,
          y: y + (fieldHeight - scaledDims.height) / 2,
          width: scaledDims.width,
          height: scaledDims.height,
        });
        console.log(`[PDF] Signature image rendered at (...)`);
      }
    } catch (e) {
      // PNG 埋め込み失敗 → テキストフォールバック
      console.warn("[PDF] Failed to embed signature image, falling back to text:", e);
      safeDrawText(page, sig.signerName, { ..., font: japaneseFont, ... });
    }
  } else if (sig.signatureFont) {
    // PNG がない場合のみフォントテキスト描画を試行
    try {
      const fontBytes = await loadSignatureFontBytes(sig.signatureFont);
      if (fontBytes) {
        const signatureFont = await pdfDoc.embedFont(fontBytes, { subset: false });
        safeDrawText(page, sig.signerName, { ..., font: signatureFont, ... });
      } else {
        safeDrawText(page, sig.signerName, { ..., font: japaneseFont, ... });
      }
    } catch {
      safeDrawText(page, sig.signerName, { ..., font: japaneseFont, ... });
    }
  } else {
    // PNG も signatureFont もない場合
    safeDrawText(page, sig.signerName, { ..., font: japaneseFont, ... });
  }
  // 日付描画は変更なし
```

## 7. Acceptance Criteria

- [ ] **AC-FIX-001**: タイプ署名で日本語名（例:「山田太郎」）を Dancing Script で署名 → 生成 PDF に署名者名が正しく表示される（X/□ が表示されない）
- [ ] **AC-FIX-002**: タイプ署名で日本語名を Klee One で署名 → 生成 PDF に署名者名が正しく表示される（Klee One は CJK 対応のため、テキスト描画されてもよい）
- [ ] **AC-FIX-003**: タイプ署名でアルファベット名（例: "John Smith"）を Dancing Script で署名 → 生成 PDF に Dancing Script 風の署名が表示される（PNG 画像が使われるため、ブラウザが Dancing Script で描画した PNG が埋め込まれる）
- [ ] **AC-FIX-004**: 手書き署名（draw モード）→ 生成 PDF に手書き PNG が正しく表示される（既存動作に変化なし）
- [ ] **AC-FIX-005**: はんこ（stamp モード）→ 生成 PDF にはんこ画像が正しく表示される（既存動作に変化なし）
- [ ] **AC-FIX-006**: `signatureDataUrl` が `null` または `undefined` かつ `signatureFont` が存在 → フォントテキスト描画が実行される
- [ ] **AC-FIX-007**: PNG 埋め込みが例外で失敗 → `japaneseFont` でテキストフォールバック描画が実行される（PDF 生成はクラッシュしない）
- [ ] **AC-FIX-008**: 日付テキスト描画（`japaneseFont`）は全ケースで引き続き正常に表示される
- [ ] **AC-FIX-009**: 既存テスト（`server/pdf.test.ts`）が全てパスする

## 8. 署名描画ロジックの変更点

本修正で `embedSignaturesIntoPdf` の挙動が以下のように変わる。署名フロー全体の現行仕様は `docs/spec/product-spec.md` (Signing flow) を参照:

| 項目 | 修正前（バグあり） | 修正後 |
|---|---|---|
| 描画優先順位 | PDF 生成時は signatureFont がある場合にフォント描画を優先し、フォント取得/埋め込み失敗時は signatureDataUrl（PNG）へフォールバック | PDF 生成時は signatureDataUrl（PNG）が存在する場合は PNG 画像を優先。PNG が存在しない場合のみ signatureFont でフォント描画を試行し、それも失敗した場合は japaneseFont でテキスト描画 |
| 両方存在時の挙動 | signatureFont と signatureDataUrl の両方が存在する場合、通常時はフォント描画を採用 | signatureFont と signatureDataUrl の両方が存在する場合、PNG 画像を採用（ブラウザのフォントフォールバックにより CJK/Latin 問わず正確に描画されているため） |
| 受け入れ基準 | PDF 生成はフォント描画を優先し、失敗時のみ PNG にフォールバック | PDF 生成は PNG 画像を優先し、PNG がない場合のみフォント描画を試行 |

## 9. Edge Cases

| ケース | 期待動作 |
|---|---|
| `signatureDataUrl` が `data:image/jpeg` など PNG 以外 | PNG 判定に失敗 → フォント/テキスト描画にフォールバック |
| `signatureDataUrl` が空文字 / `null` | PNG 判定に失敗 → フォント/テキスト描画にフォールバック |
| `signatureDataUrl` の base64 データが破損 | `embedPng` が例外 → `japaneseFont` テキストフォールバック |
| `signatureFont` = `"klee-one"`（CJK 対応）かつ `signatureDataUrl` あり | PNG が優先されるため、Klee One テキストではなく PNG が埋め込まれる（意図通り） |
| フォント CDN 障害（`loadSignatureFontBytes` が `null` を返す）| `japaneseFont` でテキスト描画（変化なし） |
| 手書き・はんこ モード | 常に PNG のみ保持するため、このケースは発生しない |

## 10. Cross-Reference

| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| `product-spec.md` (Signing flow) | 署名描画優先順位を本修正に合わせる（詳細は本仕様書 §8 を参照） | **本仕様書 §8 を反映済み** |
| `fix-post-sign-loading-hang.md` | PDF 生成フロー共通 | 変更なし |
| `product-spec.md` (Encryption at rest) | PDF 生成後の暗号化保存フロー | 変更なし |

## 11. Out of Scope

- クライアント側（`SignaturePad.tsx`、`SignDocument.tsx`）の変更 — ブラウザ側は正しく動作している
- DBスキーマ変更 — `signatureDataUrl` は引き続き保存される
- フォント選択 UI の変更 — Latin フォントを CJK フォントに置き換えることはしない
- Latin 名を Latin フォントでテキスト描画したい場合の制御 — PNG に内包されているため自動的に適用される
