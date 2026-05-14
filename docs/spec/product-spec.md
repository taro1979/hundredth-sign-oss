# Hundredth Sign Product Specification

Last reviewed: 2026-05-14

This is the master product specification for the current OSS self-hosted build.
Feature-specific and fix-specific specifications remain under `docs/spec/`, but
this file is the highest-level source for the implemented product surface.

## 1. Product Definition

Hundredth Sign is a self-hosted electronic contract and signature system for a
single internal workspace. It is optimized for Japanese business workflows while
supporting multilingual recipient communication and public token-based signing.

The current product is not a hosted multi-tenant SaaS. Commercial tenant
switching, customer accounts, payment plans, send limits, workspace import, and
arbitrary mailbox features are outside the OSS product boundary.

Core value:

- Staff can create, send, approve, sign, and archive PDF-based contracts.
- External recipients can sign, decline, delegate, view, and download documents
  without accounts.
- Administrators can operate one workspace, staff accounts, integration keys,
  audit logs, and instance settings.
- The system preserves compliance evidence through activity logs, hash-chained
  WORM audit logs, and WORM signed-PDF storage.
- External systems, CI, and AI agents can operate Sign through a controlled
  REST API and `signctl`, without direct database coupling.

## 2. Source Of Truth

Implementation sources reviewed for this specification:

- Application routes: `client/src/App.tsx`
- Staff shell and settings: `client/src/components/DashboardLayout.tsx`,
  `client/src/pages/OrganizationSettings.tsx`
- Main user flows: `client/src/pages/DocumentNew.tsx`,
  `client/src/pages/Documents.tsx`, `client/src/pages/DocumentDetail.tsx`,
  `client/src/pages/SignDocument.tsx`, `client/src/pages/DocumentView.tsx`,
  `client/src/pages/ApprovePage.tsx`, `client/src/pages/InboxPage.tsx`,
  `client/src/pages/Templates.tsx`, `client/src/pages/Contacts.tsx`
- API boundary: `server/routers/index.ts`, `server/_core/trpc.ts`,
  `server/integrations.ts`
- Persistence: `drizzle/schema.ts`, `drizzle/*.sql`
- Workflow services: `server/db.ts`, `server/pdf.ts`, `server/email.ts`,
  `server/auditLog.ts`, `server/wormStorage.ts`, `server/storage.ts`,
  `server/scheduler.ts`, `server/pdfProxy.ts`
- Shared rules: `shared/validation.ts`, `shared/locales.ts`,
  `shared/const.ts`
- Operator CLI: `scripts/signctl.mjs`
- Test and operations surface: `package.json`, `e2e/*.spec.ts`,
  `server/**/*.test.ts`, `client/src/**/*.test.tsx`

Related documentation:

- Architecture: `docs/architecture.md`
- Business model: `docs/domain/business-model.md`
- Data model: `docs/domain/data-model.md`
- Feature specs: `docs/spec/*.md`
- Current roadmap: `docs/todo.md`

## 3. Users And Roles

| Actor | Authentication | Authority | Notes |
| --- | --- | --- | --- |
| Initial administrator | `/setup` local email/password | Creates the first workspace and admin user | Only available while no users exist. |
| Administrator | `/login` local email/password | Staff management, instance settings, audit logs, API integration keys, document operations | Exposed as `users.staffRole = admin`; may map to legacy owner/manager membership internally. |
| Member | `/login` local email/password | Daily document, template, contact, inbox, and signing work | Exposed as `users.staffRole = member`. |
| Signer | Email token | Signs, declines, delegates, or downloads assigned document | No account required. |
| CC recipient | Email token | Views/downloads document notifications | No account required. |
| Internal approver | Email token and/or staff-linked approval | Approves or rejects before external signing | Approval steps are ordered. |
| Integration client | API key | REST API actions according to scopes | Used by third-party systems, CI, and AI agents. |

The operator UI must expose only administrator and member as staff roles. Legacy
membership values `owner`, `manager`, and `member` remain internal compatibility
details for organization-scoped authorization.

## 4. Product Boundaries

### Included

- Single self-hosted workspace.
- Local email/password staff authentication.
- Initial admin setup.
- Staff profile, locale, password, and staff account management.
- PDF upload, validation, field placement, and template reuse.
- Multi-recipient signing with signer and CC roles.
- Optional sequential routing.
- Optional recipient access codes.
- Optional recipient delegation.
- Optional internal approval before external signing.
- Signature, typed signature font, date, name, initials, and stamp fields.
- Hanko-style stamp generation.
- Completion certificate generation.
- Signed PDF generation and storage.
- WORM audit log and WORM signed-PDF registry.
- Staff pseudo inbox derived from workflow rows.
- Contact categories and contact groups.
- Public manual, legal, privacy, and customization contact pages.
- REST integration API, webhooks, idempotency, and `signctl`.
- Scheduler for reminders, expirations, webhook retries, and audit integrity
  checks.

### Excluded

- Hosted SaaS tenant switching.
- External customer accounts or recipient account inboxes.
- Subscription billing, payment plans, usage limits, or send credits.
- Arbitrary mailbox sending or persisted email inbox content.
- Direct database integration by external systems.
- Physical deletion of WORM records or hash-chain audit rows.

## 5. Application Routes

### Public Routes

| Route | Purpose |
| --- | --- |
| `/` | Public home page. |
| `/login` | Staff sign-in. Redirects setup-sensitive flows as needed. |
| `/setup` | Initial administrator setup while the instance has no users. |
| `/forgot-password` | Password reset request. |
| `/reset-password` | Password reset by token. |
| `/sign/:token` | Token-based signer page. |
| `/document-view/:token` | Token-based document view/download page. |
| `/approve/:token` | Token-based internal approval decision page. |
| `/terms` | Terms page. |
| `/privacy` | Privacy page. |
| `/manual` | Manual top page. |
| `/manual/:chapter` | Manual chapter page. |
| `/manual/terms` | OSS terms for manual/legal use. |
| `/manual/disclaimer` | OSS disclaimer. |
| `/contact` | OSS customization contact page. |
| `/404` | Explicit not-found page. |

### Authenticated Staff Routes

All dashboard routes require `auth.me` to return a staff user. Unauthenticated
users are redirected to `/login?redirect=<path>`.

| Route | Purpose |
| --- | --- |
| `/dashboard` | Statistics and recent activity. |
| `/dashboard/documents` | Document list, filters, reminders, and actions. |
| `/dashboard/documents/new` | Create draft, upload PDF, place fields, add recipients, configure approvals, send. |
| `/dashboard/documents/:id` | Document details, recipients, activity, signed-PDF download, void/copy actions. |
| `/dashboard/inbox` | Staff pseudo inbox generated from signature and approval rows. |
| `/dashboard/inbox/:kind/:id` | Mail-like detail view for an inbox item. |
| `/dashboard/contacts` | Contacts, categories, groups, and group membership. |
| `/dashboard/templates` | Template CRUD, PDF upload, and template field editing. |
| `/dashboard/settings` | Profile, password, instance, staff, integration keys, and audit logs. |
| `/dashboard/organization` | Alias for settings. |
| `/dashboard/audit-log` | Alias for settings audit tab. |

## 6. Authentication And Sessions

Staff authentication is local database-backed email/password authentication.
Sessions use the `app_session_id` cookie and JWT-backed server context. Session
duration is 24 hours.

Required behavior:

- `/setup` is available only before the first user exists.
- `setupAdmin` creates the first user, the single workspace, and the initial
  internal membership.
- `login` validates active users and password hashes.
- `logout` clears the session cookie.
- Password reset stores one-time token hashes, expiry, and usage state.
- Temporary passwords for staff invitations set `mustChangePassword`.
- Staff may update their profile, password, and preferred locale.

Security requirements:

- Passwords are never stored in plaintext.
- Password reset tokens are stored as hashes.
- Inactive staff cannot authenticate.
- Admin-only procedures require `users.staffRole = admin` or `isSuperAdmin`.
- Organization-scoped procedures require active membership and optional IP
  restriction checks.

## 7. Workspace And Staff Management

The OSS build uses one internal organization row as the workspace boundary.
This boundary scopes documents, templates, contacts, audit logs, integration
keys, webhooks, and allowed IPs.

Administrator capabilities:

- Update instance/workspace display settings.
- Create staff accounts with administrator/member role.
- Update staff names, active state, and role.
- Reset staff passwords.
- View staff list.
- Manage integration API keys.
- View and verify WORM audit logs.

Member capabilities:

- Manage own profile/password/locale.
- Create and operate documents, templates, contacts, inbox items, and signing
  workflows within the workspace.

## 8. Document Lifecycle

### Status Model

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

Internal approval statuses:

```text
pending -> approved
pending -> rejected
```

### Draft Creation

A staff user can create a draft directly or from a template. A draft stores the
title, optional description, owner user, workspace, status, and optional
external reference fields.

### PDF Upload

PDF upload requirements:

- Only `application/pdf` is accepted.
- File name must end in `.pdf`.
- Maximum file size is 20 MB.
- Server validates the `%PDF-` magic number.
- Server validates parseability and page count.
- Uploaded file metadata is stored on the document.

### Field Placement

Field placement requirements:

- Fields are stored by page-relative percentages:
  `xPercent`, `yPercent`, `widthPercent`, `heightPercent`.
- Page indexes are zero-based.
- `signerIndex` maps fields to signer order.
- Supported field types are `signature`, `date`, `name`, `initials`, and
  `stamp`.
- A send operation must have fields for every signer index that is required to
  sign.

### Recipients

Recipients can be signers or CC recipients.

Signer fields:

- email
- name
- order
- optional message
- optional access code
- locale

CC recipients receive completion/document links and do not need signer fields.

### Sending

When no internal approval is configured:

1. The server creates signature requests with access tokens.
2. The document moves to `sent`.
3. If sequential routing is disabled, all signers are marked `sent` and emailed.
4. If sequential routing is enabled, the first signer and CC recipients are
   emailed initially.
5. Activity and WORM audit records are appended.

When internal approval is configured:

1. The server creates approval rows and signature request rows.
2. The document moves to `pending_internal_approval`.
3. Only the first pending approver is emailed.
4. External signers are not emailed until all approvers approve.

### Signing

Token-based signer page behavior:

- Resolves document and request by token.
- Marks an eligible request as `viewed`.
- Requires access code verification when an access code hash exists.
- Supports drawn/typed signature and stamp payloads.
- Records signer IP address, user agent, signed timestamp, signature payload,
  font, and stamp payload.
- Appends activity and WORM audit records.
- Emits integration events where applicable.

Completion behavior:

1. When all required signers are signed, the document moves to `completed`.
2. The server embeds signatures/stamps/date/name/initials into the PDF.
3. A completion certificate is appended.
4. Optional platform digital signing and PDF permission locking are applied.
5. The final PDF is stored through WORM storage.
6. Signed-PDF metadata is written to the document.
7. Completion emails are sent to signers and CC recipients.
8. Activity logs, WORM audit logs, and integration events are recorded.

If final PDF generation or WORM storage fails after statuses change, the signing
router attempts to revert the document/request state and records critical
failure audit information.

### Decline

Decline behavior:

- Signer must provide a decline reason.
- Request moves to `declined`.
- Document moves to `declined`.
- Decline notification email is sent.
- Activity log, WORM audit log, and integration event are recorded.

### Delegation

Delegation behavior:

- A signer can delegate a request to a different email/name.
- The request keeps workflow continuity while recording delegated target and
  timestamp.
- The delegated recipient receives a new email link.
- Delegation is audited.

### Voiding And Deleting

Voiding:

- Staff can void an eligible document.
- Integration clients can void `sent` or `declined` documents with
  `confirm=true`.
- Voiding is audited.

Deleting:

- Draft cleanup is allowed where implemented by staff document actions.
- Normal completed workflow artifacts are not physically deleted.
- WORM records and system audit logs are append-only.

## 9. Internal Approval

Internal approval is an ordered pre-signature workflow.

Requirements:

- Staff can attach approvers before external sending.
- Each approver receives a token link.
- Approvers can approve or reject with optional/required comments according to
  action.
- Only the current pending approver should be actionable in an ordered chain.
- Approval locale is stored on the approval row and included in token links.
- Approval pages resolve locale from URL `?lng` before browser preference.

Approval outcomes:

- Approve: row moves to `approved`; next approver is emailed, or the document
  moves to `sent` and external signer routing begins.
- Reject: row moves to `rejected`; document returns to `draft`;
  activity/audit records capture the decision.

## 10. Staff Pseudo Inbox

The staff inbox is not a mailbox table. It is a derived view over existing
workflow rows.

Source rows:

- `signatureRequests` addressed to the staff user's email or claimed user id.
- `internalApprovals` addressed to the staff user's email or claimed user id.

Inbox item types:

- `signature`: signer requests and CC notifications.
- `approval`: internal approval requests.

Behavior:

- `/dashboard/inbox` lists workflow-derived items.
- `/dashboard/inbox/:kind/:id` opens a mail-like detail.
- Action-required counts include pending signer/approval work.
- CTAs forward to `/sign/:token`, `/document-view/:token`, or
  `/approve/:token`.
- No arbitrary compose, read/unread mailbox state, or email-body persistence is
  in scope.

## 11. Templates

Templates are reusable PDF and field definitions scoped to the workspace.

Requirements:

- Staff can list, create, edit, and delete templates.
- Template PDF upload follows PDF validation rules.
- Template fields use the same percentage coordinate system as document fields.
- Creating a document from a template deep-copies fields into the document.
- Template usage count increments when applied.
- Templates can define signer count, category, default expiration, and reminder
  settings.
- Public template listing exists for unauthenticated use where implemented.

## 12. Contacts

Contacts are a workspace address book for recipient selection.

Requirements:

- Staff can create, update, list, and delete contacts.
- Contacts store name, email, company, department, phone, notes, and category.
- Staff can create, update, list, and delete contact categories.
- Staff can create, update, list, and delete contact groups.
- Contacts can be added to or removed from groups.
- Contact-group membership is many-to-many and unique by contact/group pair.

## 13. Audit, WORM, And Compliance

### Activity Logs

`activityLogs` capture normal operational document activity. They are used for
document detail timelines and dashboard recent activity.

### System Audit Logs

`systemAuditLogs` are append-only compliance records.

Requirements:

- Each record includes event type, target entity, workspace context, actor,
  IP/user agent, metadata, previous hash, record hash, and server timestamp.
- Hashes use SHA-256 hash-chain semantics.
- Integrity verification detects tampering or broken chains.
- Audit log inserts must not be removed from workflow code.

### WORM Storage

`worm_records` register immutable signed-PDF artifacts.

Requirements:

- Storage keys are unique.
- Content hash and file size are recorded.
- Overwrite and delete operations are forbidden by service API.
- Optional AES-256-GCM storage encryption records IV, auth tag, and key version.
- Encrypted PDFs are served through `/api/pdf-proxy/:encodedKey?token=<hmac>`.
- Proxy tokens are short-lived HMAC tokens and responses are private/no-store.

## 14. PDF Generation

PDF behavior:

- Uploaded PDFs are validated before workflow use.
- Signature/stamp/date/name/initials fields are embedded into the final PDF.
- CJK-capable fonts are used where needed to avoid tofu/garbled glyphs.
- Completion certificate is appended with signer, audit, and document evidence.
- Optional platform signing uses configured PKCS#12 material or generated
  development material.
- Optional qpdf permission locking may be applied.
- Final signed PDF is stored as the immutable workflow artifact.

## 15. Email And Localization

Email types:

- signature request
- signature complete
- all signed
- signature declined
- reminder
- password reset
- staff invitation

Locale behavior:

- Staff UI locale is stored on `users.locale`.
- Recipient email/page locale is stored on `signatureRequests.locale`.
- Approval email/page locale is stored on `internalApprovals.locale`.
- Signing and approval token URLs include `?lng=<locale>`.
- Public signing/approval pages prioritize URL `?lng`, then stored locale or
  browser language, then fallback.
- UI i18n loads locale JSON files from `client/public/locales`.
- Supported UI locales are defined in `shared/locales.ts`.

Email providers:

- AWS SES is supported through AWS/SES environment variables.
- SMTP fallback is supported through SMTP environment variables.
- Email delivery attempts are recorded in `emailLogs`.

## 16. External Integration API

The integration API is the only supported external automation boundary.
External systems must not write directly to Sign tables.

Authentication:

- Endpoints live under `/api/integrations/*`.
- Every endpoint requires `Authorization: Bearer <api key>`.
- Keys use the `hsign_sk_` prefix.
- Only hashes are stored.
- Keys are scoped, expiring, and revocable.
- Default key lifetime is 90 days; maximum is 365 days.

Scopes:

- `documents:read`
- `documents:write`
- `documents:send`
- `documents:download`
- `webhooks:manage`
- `api_keys:manage`

Endpoints:

| Endpoint | Scope | Purpose |
| --- | --- | --- |
| `POST /api/integrations/documents` | `documents:write` | Create a draft with optional external reference. |
| `POST /api/integrations/documents/:id/pdf` | `documents:write` | Upload base64 PDF to a draft. |
| `POST /api/integrations/documents/:id/template` | `documents:write` | Apply a workspace template. |
| `POST /api/integrations/documents/:id/send` | `documents:send` | Send signer and CC requests. |
| `GET /api/integrations/documents/:id` | `documents:read` | Read document status and signer state. |
| `GET /api/integrations/documents/by-external/:system/:entityType/:entityId` | `documents:read` | Resolve by external reference. |
| `POST /api/integrations/documents/:id/void` | `documents:write` | Void with `confirm=true`. |
| `GET /api/integrations/documents/:id/signed-download-url` | `documents:download` | Get signed-PDF URL after completion. |
| `GET /api/integrations/api-keys` | `api_keys:manage` | List key metadata. |
| `POST /api/integrations/api-keys` | `api_keys:manage` | Create a key and return the secret once. |
| `POST /api/integrations/api-keys/:id/revoke` | `api_keys:manage` | Revoke with `confirm=true`. |
| `GET /api/integrations/webhooks` | `webhooks:manage` | List webhook registrations. |
| `POST /api/integrations/webhooks` | `webhooks:manage` | Create a webhook and return its secret once. |
| `POST /api/integrations/webhooks/:id/test` | `webhooks:manage` | Send a test delivery. |

Idempotency:

- Mutating calls may include `Idempotency-Key`.
- Matching repeat calls replay the stored 2xx response.
- Reuse with a different method/path/body returns conflict.
- Stored responses expire after seven days.

Webhooks:

- Deliveries are JSON bodies with event type, payload, and delivered timestamp.
- Headers include `x-hundredth-sign-event` and
  `x-hundredth-sign-signature`.
- Failed deliveries are retried by the scheduler with capped exponential
  backoff.

Current emitted event types include:

- `document.created`
- `document.sent`
- `document.completed`
- `document.declined`
- `document.voided`
- `signature.viewed`
- `signature.signed`
- `signature.declined`
- `integration.webhook.test`

## 17. CLI

`signctl` is the operator and automation CLI.

Runtime inputs:

- `SIGN_BASE_URL`
- `SIGN_API_KEY`
- `SIGN_OUTPUT`
- `DATABASE_URL` for local API-key bootstrap

Supported command groups:

- `documents create`
- `documents upload-pdf`
- `documents apply-template`
- `documents send`
- `documents status`
- `documents by-external`
- `documents void`
- `documents wait`
- `documents download-signed`
- `api-keys create`
- `api-keys list`
- `api-keys revoke`
- `webhooks create`
- `webhooks list`
- `webhooks test`

The CLI is JSON-first and supports `--json` and selected `--dry-run` modes for
AI/CI-safe operation.

## 18. Runtime And Infrastructure

Technology stack:

- Frontend: React 19, Vite, Tailwind, Radix UI, Wouter, TanStack Query, tRPC.
- Backend: Express, tRPC, Drizzle ORM.
- Database: MySQL.
- PDF: `pdf-lib`, fontkit, optional platform signing.
- Storage: local development fallback and external object/proxy storage support.
- Email: AWS SES or SMTP.
- Rate limiting: in-memory fallback or Redis-backed production limiter.
- Scheduler: in-process intervals.

Startup behavior:

- `checkMigrations()` runs before the server starts.
- Pending or hash-mismatched migrations abort startup.
- Development mode mounts Vite middleware.
- Production mode serves static build assets.
- Preferred port defaults to 3000 and falls forward to the next available port.

Required environment:

- `DATABASE_URL`
- `JWT_SECRET`
- `APP_URL` or `VITE_APP_URL` for correct email links

Important optional environment:

- `PORT`
- `DB_SSL`
- `TRUST_PROXY`
- `REDIS_URL`
- `AWS_SES_ACCESS_KEY_ID`
- `AWS_SES_SECRET_ACCESS_KEY`
- `AWS_SES_REGION`
- `SES_FROM_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `STORAGE_ENCRYPTION_KEY`
- `STORAGE_ENCRYPTION_KEY_PREV`
- `PII_ENCRYPTION_KEY`
- `PII_ENCRYPTION_KEY_PREV`
- `PLATFORM_SIGNING_P12`
- `PLATFORM_SIGNING_PASSPHRASE`
- `MAINTENANCE_MODE`
- `MAINTENANCE_BYPASS_SECRET`
- `MAINTENANCE_ALLOWED_IPS`
- `MAINTENANCE_RETRY_AFTER`
- `SIGN_BASE_URL`
- `SIGN_API_KEY`
- `SIGN_OUTPUT`
- `VITE_ANALYTICS_ENDPOINT`
- `VITE_ANALYTICS_WEBSITE_ID`

## 19. Data Model Summary

The authoritative schema is `drizzle/schema.ts`.

| Area | Tables |
| --- | --- |
| Authentication | `users`, `password_reset_tokens` |
| Workspace | `organizations`, `memberships`, `allowed_ips` |
| Documents | `documents`, `signatureFields`, `signatureRequests`, `internalApprovals` |
| Templates | `templates`, `templateFields` |
| Contacts | `contacts`, `contact_categories`, `contact_groups`, `contact_group_members` |
| Operations | `activityLogs`, `emailLogs`, `faqs`, `inquiries` |
| Compliance | `system_audit_logs`, `worm_records` |
| Integrations | `integration_api_keys`, `integration_webhooks`, `integration_webhook_deliveries`, `integration_idempotency_keys` |

Key constraints:

- `users.email` is unique.
- `memberships(userId, organizationId)` is unique.
- `documents(organizationId, externalSystem, externalEntityType,
  externalEntityId)` is unique for external references.
- `worm_records.storageKey` is unique.
- `integration_api_keys.keyHash` is unique.
- `integration_idempotency_keys(organizationId, apiKeyId, idempotencyKey)` is
  unique.
- `contact_group_members(contactId, groupId)` is unique.

## 20. Non-Functional Requirements

Security:

- Secrets and connection strings must come from environment variables.
- API keys, passwords, and reset tokens must be hashed at rest.
- Access-code verification is rate-limited in production.
- Public recipient flows use high-entropy tokens.
- Optional IP restrictions are enforced at the org procedure boundary.
- Maintenance mode can block requests before normal middleware.

Compliance:

- WORM audit inserts must remain in critical workflows.
- Signed PDFs must be registered in WORM storage.
- Hash-chain integrity checks must be available to admins.
- Activity and system audit logs must preserve actor, entity, IP, user agent,
  and metadata where available.

Reliability:

- Scheduler jobs must isolate per-document/email errors and continue processing.
- Reminder jobs must not advance reminder timestamps when `APP_URL` is missing.
- Integration webhooks must retry failed deliveries.
- Idempotency must protect retryable mutating integration calls.

Localization:

- UI and email locale behavior must be deterministic.
- URL locale parameters on token links must not be overridden by browser
  language.
- Recipient locale must be stored at send time.

AI/CI operability:

- `signctl` output must be machine-readable with `--json`.
- Mutating automation calls should use idempotency keys.
- External systems should use stable external references instead of inspecting
  internal document ids only.

## 21. Verification Matrix

Baseline verification before reporting a change complete:

```bash
pnpm test
pnpm check
```

Additional verification by change type:

| Change Type | Extra Verification |
| --- | --- |
| DB schema or migration | `pnpm db:push` or targeted migration command against the intended database; update `docs/domain/data-model.md`. |
| PDF/signing behavior | Focused Vitest for `server/pdf*.test.ts`, `server/routers*.test.ts`, and signing E2E where environment allows. |
| Public signing/approval UI | Browser or Playwright check for `/sign/:token`, `/document-view/:token`, `/approve/:token`. |
| i18n/email | `server/email*.test.ts`, `server/shared-locales.test.ts`, and locale consistency tests. |
| Integration API/CLI | `pnpm signctl -- --help --json`, `server/integrations.test.ts`, and API-key/webhook tests. |
| Compliance/WORM | `server/auditLog*.test.ts`, `server/wormStorage.test.ts`, integrity verification path. |
| E2E surface | `pnpm test:e2e:setup`, `pnpm test:e2e`, `pnpm test:e2e:teardown` when Docker and `.env.e2e` are available. |

## 22. Known Documentation Gaps

These are documentation quality issues observed while compiling this spec:

- Some legacy docs and source comments contain mojibake. New documentation
  should use clean UTF-8 Japanese or English.
- `docs/spec/` contains many feature/fix specs but did not previously have a
  single master product specification.
- `docs/local-dev.md` should be rewritten in clean Japanese before being treated
  as an operator-grade setup guide.

## 23. Change Control Rules

- Read `docs/architecture.md` and the relevant `docs/spec/*.md` file before
  implementation.
- When `drizzle/schema.ts` changes, update `docs/domain/data-model.md`.
- When user-facing behavior changes, update this master spec or the appropriate
  feature spec.
- Never remove `activityLogs` or `systemAuditLogs` writes from critical workflow
  code without replacing them with equivalent or stronger compliance evidence.
- Do not reintroduce hosted SaaS billing, tenant switching, or external customer
  accounts unless the OSS product boundary is explicitly changed.
- Do not couple external systems directly to Sign database tables; use the API,
  webhooks, and CLI surfaces.
