# Data Model

The source of truth is `drizzle/schema.ts`. This document summarizes the current OSS single-workspace model.

## Authentication

| Entity             | Table                   | Purpose                                                                                                                        |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| User               | `users`                 | Staff account. Email is unique. Password hashes are stored in `passwordHash`; UI/email default language is stored in `locale`. |
| PasswordResetToken | `password_reset_tokens` | One-time password reset token hashes with expiry and usage tracking.                                                           |

## Workspace And Staff

| Entity       | Table           | Purpose                                                                                                                                                                |
| ------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization | `organizations` | Internal single workspace boundary. Not a tenant selection UX.                                                                                                         |
| Membership   | `memberships`   | Internal workspace membership boundary. Legacy values include owner, manager, and member, but the OSS staff UI exposes administrator/member through `users.staffRole`. |
| AllowedIp    | `allowed_ips`   | Optional workspace-level IP restrictions.                                                                                                                              |

`memberships(userId, organizationId)` is unique to prevent duplicate staff rows.
Operator-facing staff authority is stored on `users.staffRole` as `admin` or
`member`. New staff administrators are mirrored to an internal manager
membership for organization-scoped checks; the initial setup administrator may
still hold the legacy owner membership for migration compatibility.

## Signature Workflow

| Entity           | Table                | Purpose                                                                                                  |
| ---------------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| Document         | `documents`          | One PDF envelope and its lifecycle. Scoped by `organizationId`.                                          |
| SignatureField   | `signature_fields`   | Page-relative field placement.                                                                           |
| SignatureRequest | `signature_requests` | One recipient request. Token-based external access. Recipient email/page language is stored in `locale`. |
| InternalApproval | `internal_approvals` | Internal approval steps before external signing. Approval email/page language is stored in `locale`.     |
| WormRecord       | `worm_records`       | Immutable signed-PDF storage registry.                                                                   |

Documents may optionally carry an external reference for third-party integrations:
`externalSystem`, `externalEntityType`, `externalEntityId`, and `externalMetadata`.
These fields are identifiers only; external systems must still use the Sign API for workflow mutations.

Document statuses:

```text
draft -> pending_internal_approval -> sent -> completed
draft -> sent -> declined | voided | expired
```

Signature request statuses:

```text
pending -> sent -> viewed -> signed
pending -> sent -> viewed -> declined
pending -> sent -> expired
```

- Signature field coordinates use page-relative percentages (`xPercent`, `yPercent`,
  `widthPercent`, `heightPercent`) so placement is independent of zoom and PDF
  rendering resolution.
- Signature image payloads are stored directly on `signature_requests` as
  `signatureDataUrl` / `stampDataUrl`; both columns are `MEDIUMTEXT` to support
  base64 PNG payloads larger than MySQL `TEXT`.
- Staff inbox messages are pseudo inbox items derived from `signature_requests`
  and `internal_approvals`; there is no separate recipient mailbox table.

## Reusable Data

| Entity             | Table                   | Purpose                           |
| ------------------ | ----------------------- | --------------------------------- |
| Template           | `templates`             | Reusable PDF/template definition. |
| TemplateField      | `template_fields`       | Field placement for templates.    |
| Contact            | `contacts`              | Workspace address book entry.     |
| ContactCategory    | `contact_categories`    | User-defined contact category.    |
| ContactGroup       | `contact_groups`        | Contact grouping.                 |
| ContactGroupMember | `contact_group_members` | Contact-group join table.         |

## Logs And Support

| Entity         | Table               | Purpose                         |
| -------------- | ------------------- | ------------------------------- |
| ActivityLog    | `activity_logs`     | Operational activity log.       |
| SystemAuditLog | `system_audit_logs` | WORM audit log with hash chain. |
| EmailLog       | `email_logs`        | Email delivery record.          |
| FAQ            | `faqs`              | Public/support FAQ content.     |
| Inquiry        | `inquiries`         | Public inquiry records.         |

## External Integrations

| Entity                     | Table                            | Purpose                                                                                          |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| IntegrationApiKey          | `integration_api_keys`           | Hashed, scoped, expiring API keys for external systems and automation clients.                   |
| IntegrationWebhook         | `integration_webhooks`           | HMAC-signed webhook endpoints subscribed to document/signature events.                           |
| IntegrationWebhookDelivery | `integration_webhook_deliveries` | Delivery attempt log and retry state for integration webhooks.                                   |
| IntegrationIdempotencyKey  | `integration_idempotency_keys`   | Seven-day replay cache for successful mutating integration API calls keyed by `Idempotency-Key`. |

API keys always require `expiresAt`; the default creation window is 90 days and the maximum is 365 days. Expired or revoked keys cannot call integration endpoints.
Mutating integration requests may use `Idempotency-Key`; repeated matching requests replay the stored 2xx response, while the same key with a different method, path, or body is rejected.

`system_audit_logs` records include `previousHash` and `recordHash` for
tamper detection. `worm_records.encryptionIv`, `encryptionTag`, and `keyVersion`
track optional AES-256-GCM storage encryption; null encryption fields indicate an
unencrypted or pre-rotation record.

## Removed From OSS Build

Commercial hosted-service tables, workspace invite tables, recipient import
tables, payment provider tracking, import preference columns, and monthly send
counters are intentionally absent from the OSS schema. The OSS staff inbox does
not add a mailbox table because it is generated from the workflow request rows.

## Deletion Policy

- Documents are voided rather than physically deleted in normal workflows.
- `system_audit_logs` and `worm_records` are append-only.
- Staff membership is deactivated with `isActive = false`.
- Contacts and templates may be physically deleted when not protected by workflow rules.
