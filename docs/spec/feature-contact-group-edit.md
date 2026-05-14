# Feature Specification: Edit Contact ダイアログでのグループ割り当て

## 1. Overview
- 目的: 連絡先の編集ダイアログから直接グループを割り当て・解除できるようにする
- 対象ユーザー: Org メンバー（連絡先管理権限を持つユーザー）
- スコープ: Contacts ページの「Edit Contact」ダイアログ UI のみ。データモデル変更なし。

## 2. User Stories
- As an org member, I want to assign groups to a contact while editing it, so that I don't have to navigate to a separate "Manage Groups" flow.

## 3. Functional Requirements
1. FR-001: Edit Contact ダイアログの Category フィールドの下（Description の上）に Group フィールドを追加する。
2. FR-002: Group フィールドは複数選択可能なマルチセレクトで、同一組織内のすべてのグループを選択肢として表示する。
3. FR-003: 連絡先の編集を開始したとき、その連絡先が既に所属しているグループが選択済み状態で表示される。
4. FR-004: Save ボタン押下時、変更されたグループメンバーシップを同期する（追加分は `addMember`、削除分は `removeMember`）。
5. FR-005: 新規連絡先作成時にもグループ選択可能にする。create 成功後に選択されたグループへのメンバー追加を行う。
6. FR-006: グループが 0 件の場合、「グループがありません」などのメッセージを表示する。

## 4. Non-Functional Requirements
- パフォーマンス: グループ一覧は既に `trpc.contactGroups.list.useQuery()` で取得済みのため、追加のネットワークリクエストは不要。
- セキュリティ: 既存の `addMember`/`removeMember` tRPC エンドポイントを使用。組織スコープは既存実装で担保。
- 可観測性: 既存の toast 通知を活用。グループ操作のエラーは個別に toast で通知する。

## 5. Data Model Changes
| 対象 | 変更内容 | 備考 |
|---|---|---|
| contacts テーブル | なし | グループは contact_group_members テーブルで管理 |
| contact_group_members | なし | 既存の addMember/removeMember を使用 |

## 6. API / UI Design

### API
- 既存エンドポイントをそのまま使用:
  - `trpc.contactGroups.list` — グループ一覧取得
  - `trpc.contactGroups.addMember({ groupId, contactId })` — メンバー追加
  - `trpc.contactGroups.removeMember({ groupId, contactId })` — メンバー削除
- `contacts.list` はすでに各連絡先の `groups: { id, name }[]` を返すため、初期値セットに使用可能。

### UI
- **コンポーネント**: Popover + Checkbox リスト（既存の shadcn/ui コンポーネントを活用）
- **配置**: Category と Group を同一行（`grid grid-cols-2 gap-4`）に並べる
  - Phone 行を単独行にする
  - Category | Group の行を追加
- **トリガー表示**: 選択されたグループ名を `X selected` or グループ名一覧（短い場合）で表示
- **未選択時**: 「グループを選択...」プレースホルダー
- **グループ 0 件**: 「グループがありません」テキスト表示

### 権限
- 既存の `orgProcedure` による組織スコープチェックのみ（変更なし）

## 7. Acceptance Criteria
- [ ] AC-001: Edit Contact ダイアログに Group フィールドが表示される
- [ ] AC-002: Group フィールドを開くと、組織内のグループ一覧がチェックボックス付きで表示される
- [ ] AC-003: 連絡先編集時、既存のグループ所属が選択済み状態で表示される
- [ ] AC-004: グループを追加選択して Save すると、そのグループに連絡先が追加される
- [ ] AC-005: グループのチェックを外して Save すると、そのグループから連絡先が削除される
- [ ] AC-006: 新規連絡先作成時にグループを選択して Create すると、作成後にグループに追加される
- [ ] AC-007: グループが 0 件の場合、適切なメッセージが表示される
- [ ] AC-008: `pnpm check` の型エラーがない
- [ ] AC-009: `pnpm test` が全パス

## 8. 堅牢化要件（実装済み）

## 9. Edge Cases
- 新規連絡先作成後のグループ追加は `create` の `onSuccess` で順次実行する（createMutation の返り値 `id` を使用）
- グループ追加・削除の Promise は `Promise.all` で並列実行してよい（独立した操作のため）
- ダイアログを閉じた場合は `groupIds` を `[]` にリセットする

## 10. Cross-Reference
| 関連仕様 | 接点 | 調整有無 |
|---|---|---|
| oss-single-workspace.md | 組織スコープによるデータ隔離 | なし（既存実装で対応済み） |
| docs/domain/data-model.md | contact_group_members テーブル（N:M） | なし |

## 11. Out of Scope
- グループの新規作成・編集・削除（Manage Groups ダイアログの既存機能）
- バックエンド API の変更
- データモデルの変更
