# Feature Specification: 複数人署名後のローディングハング修正

## 1. Overview
- 目的: 複数人署名フローで「1人目署名完了後に送信者・署名済み署名者の画面が無限スピナーになる」問題を根本修正する
- 対象ユーザー: 署名者（公開トークンページ）、送信者（認証済みダッシュボード）
- スコープ: `SignDocument.tsx` の遷移方式変更、`DocumentView.tsx` のローディング改善

## 2. User Stories

- As a signer, I want to see a proper completion screen immediately after signing, so that I know my signature was accepted without getting stuck on a blank spinner.
- As a sender, I want to see the real-time signature progress of my document, so that I know which signers have completed without manually refreshing.
- As an already-signed signer, I want the document view page to load quickly and show live progress, so that I know when remaining signers complete.

## 3. Functional Requirements

### FR-001: SignDocument.tsx — `window.location.href` → wouter SPA ナビゲーション

**現状の問題:**
```tsx
// SignDocument.tsx:866-874
if (request.status === "signed" || request.status === "declined") {
  window.location.href = `/document-view/${token}`;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  );
}
```

`window.location.href` はフルページリロードを引き起こす。その間、Loader2 スピナーが表示され続け、ユーザーには「ハング」に見える。また DocumentView.tsx 側でも React Query キャッシュが空なので初回ロードのスピナーが再度発生する。

**修正方針:**
- `useLocation()` を wouter からインポートし、`navigate(`/document-view/${token}`)` で SPA 遷移する
- SPA 遷移なら React Query の `trpc.signature.getByToken` キャッシュが DocumentView でも使われ、追加ロードなしで即座に表示される
- 遷移トリガーは `useEffect` で行う（render 中の副作用を避けるため）

```tsx
// 修正後（概念コード）
const [, navigate] = useLocation();

useEffect(() => {
  if (!data) return;
  if (request.status === "signed" || request.status === "declined") {
    navigate(`/document-view/${token}`);
  }
}, [data?.request?.status, token, navigate]);

// render 中の早期リターンも維持（遷移中の一瞬に備える）
if (data && (request.status === "signed" || request.status === "declined")) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  );
}
```

### FR-002: DocumentView.tsx — ローディングタイムアウト（10秒）

**現状の問題:**
```tsx
// DocumentView.tsx:144-153
if (isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" />
      <p className="mt-4 text-gray-600">{t("documentView.loading")}</p>
    </div>
  );
}
```

タイムアウトがないため、ネットワーク遅延や一時的な障害で `isLoading` が解消されない場合、スピナーが永続する。

**修正方針:**
- `useState` + `useEffect` で 10秒タイムアウトを実装
- タイムアウト後は「ページを再読み込みする」ボタンを表示（DocumentDetail.tsx の実装と同じパターン）

```tsx
// i18n key は前回の fix-multi-signer-loading-hang で追加済み
// common.loadingTimeout / common.reload を再利用する
const [timedOut, setTimedOut] = useState(false);
useEffect(() => {
  if (!isLoading) { setTimedOut(false); return; }
  const timer = setTimeout(() => setTimedOut(true), 10_000);
  return () => clearTimeout(timer);
}, [isLoading]);

if (isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {timedOut ? (
          <>
            <p className="text-gray-500 mb-4">{t("common.loadingTimeout")}</p>
            <Button onClick={() => window.location.reload()}>{t("common.reload")}</Button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" />
            <p className="mt-4 text-gray-600">{t("documentView.loading")}</p>
          </>
        )}
      </div>
    </div>
  );
}
```

### FR-003: DocumentView.tsx — 複数人署名中のリアルタイムポーリング

**現状の問題:**
```tsx
// DocumentView.tsx:65-74 — status==="completed" の時しかポーリングしない
refetchInterval: (query) => {
  const d = query.state.data;
  if (d && d.document.status === "completed" && !d.document.signedFileUrl) {
    return 10_000; // PDFが生成されるまで
  }
  return false; // status==="sent" の時はポーリングしない ← 問題
},
```

複数人署名中（status = "sent"、1人目署名完了・2人目待機）にポーリングが発生しないため、他の署名者が完了しても画面が自動更新されない。

**修正方針:**
- `status !== "completed"` の場合にもポーリングを追加（10秒ごと、最大 40回 ≈ 6.7分）
- カウンターを `pendingPollCountRef` として分離する

```tsx
const pendingPollCountRef = useRef(0);
// ...
refetchInterval: (query) => {
  const d = query.state.data;
  // (1) 署名完了後 PDF 生成待ちポーリング（既存）
  if (d && d.document.status === "completed" && !d.document.signedFileUrl) {
    pollCountRef.current += 1;
    if (pollCountRef.current > 60) return false;
    return 10_000;
  }
  // (2) 複数人署名中ポーリング（新規）
  if (d && d.document.status !== "completed") {
    pendingPollCountRef.current += 1;
    if (pendingPollCountRef.current > 40) return false; // ~6.7分で停止
    return 10_000;
  }
  pollCountRef.current = 0;
  pendingPollCountRef.current = 0;
  return false;
},
```

### FR-004: 送信者の DocumentDetail.tsx — 前回修正の確認

前回の `fix-multi-signer-loading-hang.md` で以下を実装済み:
- 15秒ローディングタイムアウト + リロードボタン
- AuthenticatedLayout 10秒タイムアウト
- sign mutation 内のメール送信 fire-and-forget 化

追加変更不要。

## 4. Non-Functional Requirements

- パフォーマンス: SPA ナビゲーションにより遷移速度を改善（フルページリロード → 瞬時）
- UX: ローディングが 10秒を超えたら必ずリカバリー手段（リロードボタン）を提供する
- ポーリング上限: DocumentView のポーリングは合計最大 ~16.7分（completed 待ち 10分 + pending 待ち 6.7分）で自動停止

## 5. Data Model Changes

変更なし。

## 6. API / UI Design

- API 変更なし
- UI: DocumentView.tsx の loading 状態を拡張（タイムアウト後のリロードボタン）
- 新規 i18n キーは不要（`common.loadingTimeout` / `common.reload` は前回追加済み）

## 7. Acceptance Criteria

- [ ] AC-001: 1人目署名者がサインを完了後、`/document-view/:token` に **スピナーなし or 一瞬のみ**で遷移する（< 500ms）
- [ ] AC-002: DocumentView が表示され、署名進捗（1/2 署名完了など）が正しく表示される
- [ ] AC-003: DocumentView を 10秒以上ロード中にネットワーク障害が発生した場合、「再読み込み」ボタンが表示される
- [ ] AC-004: DocumentView が表示されている間に 2人目が署名を完了すると、約 10秒以内に進捗バーが 100% に更新される（ポーリング）
- [ ] AC-005: `pnpm test` 全テストパス、`pnpm check` 型エラーなし、`pnpm build` 成功

## 8. 堅牢化要件（実装済み）

<!-- 実装後に追記 -->

## 9. Edge Cases

- `token` が無効な場合: `retry: false` により即エラー表示（変更なし）
- アクセスコードが設定されている場合: DocumentView にも `accessVerified` ゲートが存在（変更なし）
- SPA ナビゲーション後に直接 DocumentView URL をブックマークしてアクセスした場合: 通常の初回ロードになる（FR-002 のタイムアウトが保護）
- 既に `window.location.href` で実装されている他の箇所（ `signMutation.onError` 内）: SignDocument.tsx の別の `window.location.href` も同様に wouter navigate に統一する

## 10. Cross-Reference

| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| `fix-multi-signer-loading-hang.md` | AuthenticatedLayout / DocumentDetail タイムアウト | i18n キー再利用 |
| `fix-flaky-tests.md` | jsdom / vitest 設定 | 変更なし |

## 11. Out of Scope

- 送信者の DocumentDetail ページの修正（前回対応済み）
- SignDocument.tsx の署名後 UI の全面リデザイン
- WebSocket/SSE によるリアルタイムプッシュ（ポーリングで対応）
- `signMutation.onError` 内の `window.location.href` 以外の `window.location.href` の全置換（別タスク）
