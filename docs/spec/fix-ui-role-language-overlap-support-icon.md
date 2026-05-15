# Fix Specification: UI バグ修正 — Role/Language 重なり & Support アイコン

## 1. Overview
- 目的: 2 つの UI バグを修正し、視認性・操作性を向上させる
- 対象ユーザー: ダッシュボード利用者（送信者）
- スコープ: フロントエンドのみ（CSS / アイコン変更）。DB・API 変更なし

### 修正履歴
| バージョン | 変更内容 |
|---|---|
| v1 (PR #61) | `sm:grid-cols-3` → `md:grid-cols-3` でブレークポイントを 640px→768px に引き上げ |
| v2 (本仕様) | Bug A を根本修正：グリッドを Company 単独行 + Role/Language 2列行 (`sm:grid-cols-2`) に分割 |

**v1 が不十分だった理由**: コンテンツ幅が `max-w-3xl`（768px）に制約されており、サイドバー（~240px）＋パディングを差し引くと、md ブレークポイント到達時のコンテンツ幅は ~500-600px 程度。3列グリッドの各列が ~170-200px になり、ドロップダウンが依然として重なる。

---

## 2. バグ詳細

### Bug A: 署名者フォームで Role と Language が重なって見える

**場所**: `client/src/pages/DocumentNew.tsx` — Row 2 の 3 列グリッド（line 781）

**現状**:
```
grid-cols-1 sm:grid-cols-3 gap-3
 [Company]  [Role]  [Language]
```
`sm` ブレークポイント（640px）以上で 3 カラム均等表示。Role の SelectContent ドロップダウンが開いたとき、z-index または幅の問題で Language フィールドに重なる。

**原因の仮説**:
- Radix UI の SelectContent が `position: fixed` でレンダリングされるため、隣のフィールドと重なって見える
- または、カラム幅が不均等でラベル・コントロールが視覚的に干渉している

**修正方針（v2 確定）**:
3列グリッドを廃止し、以下の2行構成に変更する:

```
Before (1行3列, md:grid-cols-3):
  [Company (1/3)]  [Role (1/3)]  [Language (1/3)]

After (2行):
  Row A (単独): [Company (全幅)]
  Row B (sm:grid-cols-2): [Role (1/2)]  [Language (1/2)]
```

Company はテキスト入力なので全幅で問題なく、Role と Language は同種のセレクトとして2列に並べる。
`sm:grid-cols-2` は既存の Email+Name 行（line 755）や AccessCode 行（line 820）と同じパターン。

---

### Bug B: サイドバーの Support と Language のアイコンが酷似

**場所**: `client/src/components/DashboardLayout.tsx` — SidebarFooter（line 473–497）

**現状**:
- Support: `LifeBuoy` アイコン（丸形・円状デザイン）
- Language: `Globe` アイコン（丸形・球状デザイン）
- 両者とも円形で区別しにくい
- 縦並びだが左寄せで整列が揃っていない

**修正方針**:
- Support アイコンを `LifeBuoy` → `HelpCircle`（ヘルプ円形。丸だが `?` マークで即座に区別可能）に変更
  - 代替候補: `HeadphonesIcon`（サポートらしさが強い）、`MessageCircleQuestion`
  - **推奨: `HelpCircle`**（lucide-react に存在し、コンテキストが明確）
- SidebarFooter の Support 行と Language セレクターをそれぞれ `items-center` で中央揃えに統一

---

## 3. Functional Requirements

| ID | 要件 |
|---|---|
| FR-001 | 署名者フォームの Row 2 で Role と Language が視覚的に重ならない |
| FR-002 | Role / Language / Company 各フィールドは独立して操作できる |
| FR-003 | サイドバーの Support アイコンが Language（Globe）と明確に区別できる |
| FR-004 | サイドバーフッターの Support 行と Language 行が中央揃え（垂直方向 items-center）で表示される |

---

## 4. Non-Functional Requirements
- パフォーマンス: 影響なし（CSS 変更のみ）
- セキュリティ: 影響なし
- アクセシビリティ: アイコン変更後も `tooltip` / `aria-label` は維持する

---

## 5. Data Model Changes
なし

---

## 6. UI Design

### Bug A の変更後レイアウト（DocumentNew.tsx）

```
Row 2a — Company (full width, 変更不要):
  [Company]

Row 2b — Role + Language (grid-cols-1 sm:grid-cols-2):
  [Role]  [Language]

Row 3 — signer のときのみ (grid-cols-1 sm:grid-cols-2):
  [Access code (Optional)]  [Individual message (Optional)]
```

各列幅の計算: コンテンツ ~600px ÷ 2列 = 300px。十分な幅が確保される。

### Bug B の変更後レイアウト（DashboardLayout.tsx）

- Support アイコン: `LifeBuoy` → `HelpCircle`
- SidebarMenuItem（Support）: 既存スタイルを維持しつつ `items-center` を確認
- LanguageSelector compact: 既存の `w-full` を維持、`flex items-center` で揃える

---

## 7. Acceptance Criteria

- [ ] AC-001: 署名者フォーム（Step 2）で Role と Language のセレクターが視覚的に重ならず、それぞれ独立して操作できる
- [ ] AC-002: モバイル（< 768px）でフォームが 1 列にスタックし、各フィールドが正常に表示される
- [ ] AC-003: サイドバーフッターの Support アイコンが Globe（Language）と異なるアイコンで表示される
- [ ] AC-004: サイドバーフッターの Support 行と Language 行が垂直方向に中央揃えで整列している
- [ ] AC-005: `pnpm test && pnpm check` がパスする

---

## 8. 実装対象ファイル

| ファイル | 変更箇所 |
|---|---|
| `client/src/pages/DocumentNew.tsx` | Row 2 を Company 単独行 + Role/Language 2列行 (`sm:grid-cols-2`) に再構成 |
| `client/src/components/DashboardLayout.tsx` | Support アイコンを `LifeBuoy` → `HelpCircle` に変更、フッター整列を確認 |
| `client/src/components/LanguageSelector.tsx` | 必要に応じて compact モードのラッパーを調整 |

---

## 9. Edge Cases
- サイドバーが collapsed（アイコンのみ）モードのとき: Language セレクターは非表示のため影響なし
- モバイルサイドバー表示時も Support アイコン変更は有効

---

## 10. Cross-Reference

| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| `product-spec.md` (i18n) | Language セレクターの動作仕様 | 変更なし（アイコン・配置のみ） |
| `feature-support-portal-link.md` | Support リンク先 URL | 変更なし（アイコン変更のみ） |

---

## 11. Out of Scope
- Role / Language の機能ロジック変更
- Support リンク先の変更
- モバイル専用レイアウトの全面見直し
- ダークモード対応
