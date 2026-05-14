# Fix: getAuditLogsByEntity の organizationId フィルタ欠落

## 1. Overview

### 目的
`getAuditLogsByEntity()` のDBクエリに `organizationId` フィルタがなく、アプリケーションレイヤーのみで組織分離を行っている問題を修正する。

### 背景・発見経緯
「最近の文書」テナント分離セキュリティ調査（2026-03-17）の中で発見。
`auditLog.byEntity` エンドポイントは以下の構造になっている：

```typescript
// server/auditLog.ts:364
export async function getAuditLogsByEntity(entityType, entityId, limit = 100) {
  return db.select().from(systemAuditLogs)
    .where(and(
      eq(systemAuditLogs.entityType, entityType),
      eq(systemAuditLogs.entityId, entityId),
      // ← organizationId フィルタなし
    ));
}

// server/routers/auditLog.ts:43-44
const logs = await getAuditLogsByEntity(input.entityType, input.entityId, input.limit);
return logs.filter(log => log.organizationId === orgId);  // アプリレイヤーのみ
```

### 現在の実害
- ルーターの `.filter()` でクライアントへの漏洩は発生しない（現状は安全）
- ただし DB クエリが全組織の同一 entityId/entityType のログを取得してからフィルタしており、Defense-in-depth 違反

### 対象ファイル
- `server/auditLog.ts`
- `server/routers/auditLog.ts`
- `server/auditLog.test.ts`

---

## 2. User Stories

- **as an** org owner/manager, **I want** audit logs for a specific entity, **so that** I see only logs belonging to my organization.

---

## 3. Functional Requirements

### FR-001: DB クエリに organizationId フィルタを追加
`getAuditLogsByEntity()` のシグネチャに `organizationId: number` を追加し、WHERE 句に `eq(systemAuditLogs.organizationId, organizationId)` を含める。

### FR-002: ルーター側の冗長フィルタを削除
`auditLog.byEntity` ルーターの `.filter(log => log.organizationId === orgId)` をDBフィルタ化後に削除する。

### FR-003: シグネチャ変更の一貫性
`getAuditLogsByEntity()` を呼び出している箇所が他にあれば、同様に `organizationId` を渡すように修正する。

---

## 4. Non-Functional Requirements

- テスト変更は既存テストの削除・アサーション弱化を行わない
- `pnpm test && pnpm check && pnpm build` が全てパスすること

---

## 5. Data Model Changes

なし（スキーマ変更不要）

---

## 6. API Design

### 変更前

```typescript
// server/auditLog.ts
export async function getAuditLogsByEntity(
  entityType: EntityType,
  entityId: number,
  limit = 100,
)

// server/routers/auditLog.ts
const logs = await getAuditLogsByEntity(input.entityType as any, input.entityId, input.limit);
return logs.filter(log => log.organizationId === orgId);
```

### 変更後

```typescript
// server/auditLog.ts
export async function getAuditLogsByEntity(
  entityType: EntityType,
  entityId: number,
  organizationId: number,   // 追加（必須）
  limit = 100,
)
// WHERE: entityType = ? AND entityId = ? AND organizationId = ?

// server/routers/auditLog.ts
return getAuditLogsByEntity(input.entityType as any, input.entityId, orgId, input.limit);
// .filter() 不要になるため削除
```

---

## 7. Acceptance Criteria

- [ ] **AC-001**: `getAuditLogsByEntity` の WHERE 句に `organizationId` フィルタが含まれる
- [ ] **AC-002**: `auditLog.byEntity` ルーターがアプリレイヤーの `.filter()` を持たない
- [ ] **AC-003**: `auditLog.test.ts` の `getAuditLogsByEntity` テストが `organizationId` 引数込みで正常パスする
- [ ] **AC-004**: `auditLog.test.ts` に「organizationId フィルタが WHERE 句に含まれること」を検証するテストケースが存在する
- [ ] **AC-005**: `pnpm test && pnpm check && pnpm build` が全てパスする

---

## 8. Edge Cases

- `getAuditLogsByEntity` を呼び出す箇所が複数ある場合、すべて `organizationId` を渡すこと（型エラーで検出できる）
- `auditLog.test.ts:343` の既存テスト `getAuditLogsByEntity("document", 1)` は引数が変わるため更新が必要

---

## 9. Cross-Reference

- 関連仕様: `docs/spec/feature-audit-worm.md` — WORM 監査ログ全体仕様
- 関連仕様: `docs/spec/feature-security-encryption.md` — セキュリティ全領域マップ
- 実装: `server/auditLog.ts:364-382`
- 実装: `server/routers/auditLog.ts:35-45`
- テスト: `server/auditLog.test.ts:328-372`

---

## 10. Out of Scope

- `activityLogs` の組織分離（別テーブル・別クエリ群、既存でフィルタ済み）
- `getAuditLogsByOrg`, `getAuditLogsPaginated` など他の監査ログクエリ（すでに organizationId フィルタ実装済み）
- 監査ログ PII 暗号化（`docs/spec/feature-security-encryption.md` の P2 課題として別管理）
