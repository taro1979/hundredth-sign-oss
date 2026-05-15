# Feature Specification: 社内稟議フロー

## 1. Overview

- **目的**: 外部署名者へ送信する前に、社内承認者が順番に承認する「稟議」フローの実装（日本の商習慣への対応）
- **対象ユーザー**: 文書送信者（組織メンバー）、社内承認者（組織メンバーまたは内部関係者）
- **スコープ**: 稟議者設定・メール通知・承認/拒否・自動遷移

## 2. User Stories

- As a member, I want to add internal approvers before sending to external signers, so that my documents get proper review before leaving the company.
- As an approver, I want to approve or reject a document via email link without logging in, so that I can decide quickly.
- As a member, I want to track the approval status of each approver, so that I can follow up on delays.

## 3. Functional Requirements

1. **FR-001** 稟議者設定: 文書作成時に 1 名以上の承認者を追加（approverEmail, approverName, order）
2. **FR-002** 順番承認: 1-based order で昇順に承認依頼。前の承認者が完了するまで次の承認者へ未送信
3. **FR-003** メールアクセス: accessToken（nanoid）付きリンクでログイン不要アクセス
4. **FR-004** 承認: comment 任意、status → approved に更新
5. **FR-005** 拒否: comment 必須、status → rejected に更新、文書ステータス → declined
6. **FR-006** 全承認完了: checkAllApproversApproved が true → 文書ステータス → sent、外部署名依頼メール送信
7. **FR-007** 文書ステータス遷移: draft → pending_internal_approval → sent (全承認後) or declined (拒否後)
8. **FR-008** 通知メール: 承認依頼・承認完了・拒否 のメールを送信（受信者の locale で）

## 4. Non-Functional Requirements

- **セキュリティ**: accessToken はログイン不要だが、nanoid で推測不可能にする
- **冪等性**: 同一トークンで 2 回承認してもエラーにならないように設計（status チェック）
- **可観測性**: 承認・拒否操作を `activityLogs` に記録

## 5. Data Model Changes

| 対象 | フィールド | 備考 |
|---|---|---|
| `internalApprovals` | documentId, approverEmail, order, status(pending/approved/rejected), accessToken, comment, decidedAt | — |
| `documents` | status に `pending_internal_approval` を追加 | 既存テーブル拡張 |

## 6. API / UI Design

**主要 API:**

| エンドポイント | 権限 | 概要 |
|---|---|---|
| `document.send` | orgProcedure | 稟議者設定含む文書送信 |
| `approval.getByToken` | publicProcedure | トークンで承認情報取得 |
| `approval.approve` | publicProcedure | 承認実行 |
| `approval.reject` | publicProcedure | 拒否実行 |
| `document.getApprovals` | orgProcedure | 文書の稟議状況取得 |

**UI 画面:**
- `ApprovePage.tsx` — 承認/拒否ページ（外部アクセス）
- `DocumentDetail.tsx` — 文書詳細に稟議状況を表示

## 7. Acceptance Criteria

- [x] AC-001: 稟議者が 1 名も設定されていない場合は通常の署名フローになる
- [x] AC-002: 順番承認で前の承認者が未承認のとき、後続者へメール未送信
- [x] AC-003: 全承認者が承認後、自動で文書ステータスが sent に遷移し署名依頼メールが送信される
- [x] AC-004: 1 名でも拒否すると文書ステータスが declined に遷移する
- [x] AC-005: 承認ページは accessToken のみでアクセス可能（ログイン不要）
- [ ] AC-006: 拒否時は comment が必須 — **未実装**: 実装は `comment: z.string().max(2000).optional()` であり、拒否時も comment は任意。`routers.test.ts: rejects without comment` テストが comment なしでの成功を確認済み。仕様通りに実装するには `.refine()` による条件付きバリデーション追加が必要

## 8. 堅牢化要件（実装済み）

- 重複承認メールの防止（同一承認者への二重送信ガード）
- 拒否コメント必須化: AC-006 として仕様に記載あるが、現在の実装は `comment` が任意のまま（次期実装候補）

## 9. Edge Cases

- 承認者が社内メンバーでない外部メールアドレスの場合 → メール送信のみ（ログイン不要）
- 文書が void された後に承認者がアクセスした場合 → voided エラーを返す
- 承認者が既に approved/rejected の場合の 2 回目のリクエスト → 現状のステータスを返す（冪等）

## 10. Cross-Reference

| 関連仕様 | 接点 |
|---|---|
| `product-spec.md` §8 Document Lifecycle | 稟議完了後に署名フローが開始 |
| `oss-single-workspace.md` | 文書は organizationId に帰属 |
| `product-spec.md` §6 Authentication And Sessions | 認証・セッション管理 |

## 11. Out of Scope

- 条件分岐稟議（承認者 A が承認したら B に、拒否したら C に分岐）
- 稟議フォームのカスタマイズ（テキスト入力以外のフィールド）
- 稟議期限の設定（現在は期限なし）
