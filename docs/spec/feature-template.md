# Feature Specification: テンプレート管理

## 1. Overview

- **目的**: よく使う文書のひな形（PDF + 署名フィールド定義）をテンプレートとして保存・再利用し、文書作成の効率化を図る
- **対象ユーザー**: 組織メンバー（文書送信者）
- **スコープ**: テンプレート CRUD・PDF アップロード・署名フィールド定義・テンプレートから文書作成（ディープコピー）

## 2. User Stories

- As a member, I want to save a frequently-used document as a template, so that I can quickly create new documents from it.
- As a member, I want to define signature field positions on a template, so that I don't have to place them every time.
- As a member, I want to create a document from a template, so that fields and settings are pre-filled.
- As a member, I want to browse public templates shared by others, so that I can find useful starting points.

## 3. Functional Requirements

1. **FR-001** テンプレート作成: title, description, category, signerCount, defaultExpirationDays, defaultReminderDays を設定
2. **FR-002** PDF アップロード: テンプレートに PDF を紐付け（S3 保存、20MB 制限、PDF のみ）
3. **FR-003** 署名フィールド定義: ドラッグ & ドロップで配置。`templateFields` テーブルにパーセント座標で保存
4. **FR-004** フィールドタイプ: signature / date / name / initials / stamp
5. **FR-005** テンプレート更新: title, description, category, isPublic, defaultExpirationDays, defaultReminderDays を変更可能
6. **FR-006** テンプレート削除: 物理削除（関連 templateFields も CASCADE）
7. **FR-007** 公開テンプレート: `isPublic = true` のテンプレートはログイン不要で一覧取得可能
8. **FR-008** ディープコピー: テンプレートから文書作成時に `deepCopyTemplateToDocument` で templateFields → signatureFields にコピー
9. **FR-009** 使用回数: テンプレートから文書を作成するたびに `usageCount` を INCREMENT
10. **FR-010** アクセス制御: 同一組織メンバーのみがテンプレートを参照・編集可能（`orgProcedure`）。ただし公開テンプレートは例外

## 4. Non-Functional Requirements

- **セキュリティ**: 他組織のテンプレートは `organizationId` フィルタで非表示（公開テンプレート除く）
- **可観測性**: 作成・更新・削除を `systemAuditLogs` に記録（`template.created`, `template.updated`, `template.deleted`）

## 5. Data Model Changes

| 対象 | 主なフィールド | 備考 |
|---|---|---|
| `templates` | id, userId, organizationId, title, fileUrl, fileKey, pageCount, signerCount, isPublic, usageCount, defaultExpirationDays, defaultReminderDays | — |
| `templateFields` | templateId, clientId, page, xPercent, yPercent, widthPercent, heightPercent, signerIndex, type, label, required | パーセント座標 |

## 6. API / UI Design

**主要 API（tRPC routers.ts `templates` ルーター）:**

| エンドポイント | 権限 | 概要 |
|---|---|---|
| `templates.list` | orgProcedure | 組織のテンプレート一覧取得 |
| `templates.getById` | protectedProcedure | テンプレート詳細取得（組織メンバー or 公開テンプレート） |
| `templates.public` | publicProcedure | 公開テンプレート一覧 |
| `templates.create` | orgProcedure | テンプレート作成 |
| `templates.uploadPdf` | orgProcedure | テンプレートに PDF アップロード |
| `templates.saveFields` | orgProcedure | 署名フィールド定義を保存 |
| `templates.update` | orgProcedure | テンプレート情報更新 |
| `templates.delete` | orgProcedure | テンプレート削除 |

**UI 画面:**
- `Templates.tsx` — テンプレート一覧・検索
- `DocumentNew.tsx` — テンプレートから文書作成（テンプレート選択 UI を含む）

## 7. Acceptance Criteria

- [x] AC-001: PDF のみアップロード可（MIME + 拡張子チェック）、20MB 制限
- [x] AC-002: 署名フィールドがパーセント座標で保存される
- [x] AC-003: テンプレートから文書作成時に templateFields が signatureFields にコピーされる
- [x] AC-004: 他組織のテンプレートは API から取得不可（公開テンプレート除く）
- [x] AC-005: テンプレート作成・更新・削除が `systemAuditLogs` に記録される
- [x] AC-006: テンプレートから文書作成時に `usageCount` が加算される

## 8. Edge Cases

- テンプレートに PDF が未アップロードの状態で文書作成を試みた場合 → エラー
- テンプレート削除後に、そのテンプレートから作成済みの文書は影響を受けない（`sourceTemplateId` は参照のみ）
- 公開テンプレートのアクセス制御: 他組織ユーザーは参照可能だが編集・削除は不可

## 9. Cross-Reference

| 関連仕様 | 接点 |
|---|---|
| `product-spec.md` §8 Document Lifecycle | テンプレートから文書作成（ディープコピー） |
| `oss-single-workspace.md` | テンプレートは organizationId に帰属 |
| `feature-audit-worm.md` | テンプレート操作が監査ログに記録される |

## 10. Out of Scope

- テンプレートのバージョン管理
- テンプレートマーケットプレイス（組織間共有）
- テンプレートの受信者プリセット（定型の署名者リスト）
