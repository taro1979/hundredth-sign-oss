# Feature Specification: 監査・WORM ストレージ（電帳法対応）

## 1. Overview

- **目的**: 電子帳簿保存法（電帳法）の「訂正・削除ができないシステム」要件を満たす不変監査ログと WORM ファイルストレージの実装
- **対象ユーザー**: システム管理者、コンプライアンス担当者
- **スコープ**: WORM 監査ログ（ハッシュチェーン）・WORM ファイルストレージ（S3）・監査ダッシュボード

## 2. User Stories

- As a compliance officer, I want an immutable audit trail of all document actions, so that I can demonstrate legal compliance.
- As an admin, I want to verify the integrity of audit logs, so that I can detect tampering.
- As a member, I want to view the activity history of a document, so that I can track who signed when.

## 3. Functional Requirements

### WORM 監査ログ

1. **FR-001** 不変記録: `system_audit_logs` テーブルは INSERT のみ（UPDATE / DELETE なし）
2. **FR-002** ハッシュチェーン: 各レコードは `previousHash`（直前レコードの SHA-256）と `recordHash`（自身の SHA-256）を持つ
3. **FR-003** タイムスタンプ: `serverTimestamp`（ミリ秒精度）を NTP 同期サーバー時刻で記録
4. **FR-004** 整合性検証: `verifyHashChainIntegrity` で全チェーンを検証できる
5. **FR-005** 記録内容: eventType, entityType, entityId, organizationId, actorUserId, actorEmail, ipAddress, userAgent, metadata（JSON）
6. **FR-006** イベント種別（eventType、ドット記法）:
   - Document: `document.created`, `document.uploaded`, `document.sent`, `document.viewed`, `document.completed`, `document.voided`, `document.deleted`
   - Signature: `signature.viewed`, `signature.signed`, `signature.declined`, `signature.reminded`
   - Auth: `auth.email_verified`, `auth.access_code_verified`
   - PDF: `pdf.signed`, `pdf.stored_worm`, `pdf.certificate_appended`
   - Organization: `org.created`, `org.updated`, `org.member_removed`, `org.role_changed`
   - Template: `template.created`, `template.updated`, `template.deleted`
   - Approval: `approval.requested`, `approval.approved`, `approval.rejected`

### WORM ファイルストレージ

7. **FR-007** S3 WORM: 署名済み PDF を `worm/{orgId}/doc-{docId}/{timestamp}-signed.pdf` で S3 に保存
8. **FR-008** DB 登録: S3 保存成功後に `worm_records` に INSERT（`storageKey` UNIQUE 制約で二重保存を物理防止）
9. **FR-009** ハッシュ検証: ファイルの SHA-256 を計算・保存して後から検証可能
10. **FR-010** 不変性: `worm_records` の既存レコードは UPDATE / DELETE 不可（設計上の制約）

### 通常監査ログ（activityLogs）

11. **FR-011** 通常ログ: 文書操作全般を `activityLogs` に記録（UPDATE 可、証跡として使用）
12. **FR-012** 取得: `getActivityLogsByDocument` で文書の操作履歴を取得

## 4. Non-Functional Requirements

- **整合性**: WORM ログのハッシュチェーンが途切れた場合に検出可能
- **パフォーマンス**: 署名完了時の WORM 書き込みは非同期で実行しない（完了処理の一部として同期実行）
- **可用性**: S3 書き込み失敗時はエラーを返し、DB には記録しない

## 5. Data Model Changes

| 対象 | 変更内容 | 備考 |
|---|---|---|
| `system_audit_logs` | bigint PK, eventType, previousHash, recordHash, serverTimestamp | WORM テーブル |
| `worm_records` | storageKey UNIQUE, contentHash, fileSizeBytes, documentId, organizationId | WORM ファイル登録 |
| `activityLogs` | documentId, organizationId, action, ipAddress, userAgent | 通常ログ |

## 6. API / UI Design

**主要 API:**

| エンドポイント | 権限 | 概要 |
|---|---|---|
| `audit.getByDocument` | orgProcedure | 文書の監査ログ取得 |
| `audit.getByOrg` | orgProcedure | 組織の監査ログ一覧 |
| `audit.getPaginated` | superAdminProcedure | ページネーション付き取得 |
| `audit.verifyIntegrity` | superAdminProcedure | ハッシュチェーン整合性検証 |
| `document.getActivityLogs` | orgProcedure | 文書アクティビティ履歴 |

**UI 画面:**
- `OrganizationSettings.tsx` 内の監査ログタブ — 監査ログ一覧・フィルタ・整合性チェック（旧 `AuditLogDashboard.tsx` から統合済み）

## 7. Acceptance Criteria

- [x] AC-001: `system_audit_logs` に UPDATE / DELETE を実行するコードが存在しない
- [x] AC-002: `worm_records.storageKey` に UNIQUE 制約があり、同一キーの二重書き込みで DB エラーが発生する
- [x] AC-003: `verifyHashChainIntegrity` が改ざんされたレコードを検出できる
- [x] AC-004: 署名完了後に `worm_records` にレコードが作成される
- [x] AC-005: 監査ログに IP アドレス・ユーザーエージェントが記録される

## 8. 堅牢化要件（実装済み）

以下は開発中に発見・修正された WORM 準拠の問題。全て実装済み。

### WORM コンプライアンス修正
- `activityLogs` に対する DELETE 操作を全て除去（WORM 設計違反の修正）
- 子レコード削除時の参照整合性対応（CASCADE ではなく論理削除）
- 完了証明書のタイムスタンプを `signedAt` と一致させる修正
- documentId の監査ログへの正確な記録
- 監査ログ書き込み失敗時のエラーハンドリング強化（silent failure 防止）
- 委譲チェーン（A→B）の完了証明書への記録追加

### 残存バグ修正
- PDF lock（qpdf）失敗時の監査ログ記録
- 完了証明書ハッシュの不一致修正（contentHash オプション埋め込み）

## 9. Edge Cases

- ハッシュチェーンの先頭レコード（`previousHash = null`）は genesis レコードとして扱う
- S3 書き込みと `worm_records` INSERT の間で障害が発生した場合 → S3 に孤立ファイルが残る可能性（S3 Object Tagging による対応を検討）
- 整合性検証は全レコードをフルスキャンするため、レコード数増加時のパフォーマンス劣化に注意
- 委譲チェーンでは元署名者・委譲先の両方が完了証明書に記載される

## 10. Cross-Reference

| 関連仕様 | 接点 |
|---|---|
| `product-spec.md` §8 Document Lifecycle | 署名完了時に WORM 記録 |
| `oss-single-workspace.md` | 監査ログに internal workspace の organizationId を含む |

## 11. Out of Scope

- 外部タイムスタンプ局（TSA）との連携
- 証跡の外部エクスポート（PDF / CSV）
- 監査ログの検索・フィルタ機能強化（次期フェーズ）
