# Architecture

Hundredth Sign is now an OSS, self-hosted electronic contract system for a single workspace.

## Product Shape

- Internal staff sign in with database-managed email and password.
- The first administrator is created from `/setup`.
- Administrators can create and manage staff accounts. The OSS UI exposes only
  two staff roles: administrator and member.
- External recipients never need accounts. They receive email links and use signed tokens to view, sign, decline, and download documents.
- Commercial hosted-service features, tenant switching, external customer accounts, workspace import, and arbitrary mailbox sending are removed.
- Authenticated staff keep a pseudo inbox at `/dashboard/inbox`; it is generated from `signatureRequests` and `internalApprovals` so staff can act on requests addressed to their own email even when SMTP delivery is unavailable.
- `organizations` and `memberships` remain as internal workspace boundaries for
  documents, templates, contacts, IP restrictions, and audit logs. They are not
  exposed as a tenant-switching product model. Legacy membership values can
  still appear internally, but operators should see administrator/member only.

## Layers

```text
client/     React + Vite frontend
server/     Express + tRPC backend
shared/     Shared validation, locales, and utility types
drizzle/    MySQL schema
docs/       OSS self-hosting and domain documentation
```

## Core Flows

### Staff Authentication

1. A fresh install starts at `/setup`.
2. The initial admin creates a local email/password account.
3. Later sign-ins use `/login`.
4. Password reset uses a database token sent by email.
5. Staff accounts are managed from dashboard settings.

### Document Signing

1. A staff user uploads a PDF and places fields by page-relative coordinates.
2. The staff user adds signers and optional CC recipients.
3. The server creates `signatureRequests` with access tokens and sends email links.
4. Recipients open the token link without logging in.
5. Signers view the PDF, sign or decline, and the server records the action.
6. When all required signers finish, the server embeds signatures, creates a completion certificate, stores the final PDF in WORM storage, and emails completion notices.

### Internal Approval

1. A staff user can add internal approvers before external signing.
2. Approvers receive token links by email.
3. Approval completion moves the document to external signing.
4. Rejection stops the flow and records the decision.

### Staff Pseudo Inbox

1. Staff open `/dashboard/inbox` from the left navigation.
2. The inbox does not store mail. It lists signature requests, CC notifications, and internal approvals addressed to the logged-in staff user.
3. Pending signature and current pending approval items are counted as action required.
4. Each item opens a mail-like detail view whose CTA forwards to the existing token pages for signing, approval, or document viewing.

### Audit And Compliance

- `activityLogs` record normal document activity.
- `systemAuditLogs` are append-only WORM audit records with a hash chain.
- Signed PDFs are stored through WORM storage.
- Audit inserts must not be removed or bypassed.

### External Integrations

1. A staff-created integration API key authorizes a third-party system or automation client.
2. The external system creates a draft document through `/api/integrations/documents`.
3. It uploads the PDF, optionally applies a Sign template, and sends the document for signature.
4. Sign remains the source of truth for signing status, audit logs, WORM storage, and signed PDF generation.
5. Mutating calls can use `Idempotency-Key` so AI/CI clients can safely retry create, send, void, API-key, and webhook operations.
6. Webhooks notify the external system about document and signature lifecycle events; failed deliveries are retried by the scheduler.

## API Boundaries

- `publicProcedure`: public pages and token-based recipient flows.
- `protectedProcedure`: authenticated staff.
- `orgProcedure`: authenticated staff scoped to the single internal workspace.
- `adminProcedure`: authenticated staff with `users.staffRole = "admin"` or
  `isSuperAdmin`.
- `orgManagerProcedure`: internal membership manager/owner boundary used by
  shared organization-scoped admin operations.
- `orgOwnerProcedure`: legacy name for administrator-only workspace settings;
  the OSS product does not expose an owner role in the staff UI.
- `superAdminProcedure`: system-level maintenance.
- `/api/integrations/*`: API-key authenticated REST endpoints for third-party systems and `signctl`.
- `organization.*IntegrationApiKey`: administrator-only tRPC procedures for
  bootstrapping and revoking integration API keys from the settings UI.

## Infrastructure

- Database: MySQL via Drizzle ORM.
- Storage: local fallback for development, S3/proxy-compatible storage for deployment.
- Email: AWS SES or configured SMTP fallback.
- PDF: `pdf-lib`, optional platform signing, optional qpdf permission lock.
- Encryption: optional AES-256-GCM for stored PDFs and PII fields.

## Required Environment

- `DATABASE_URL`
- `JWT_SECRET`
- `APP_URL`

Optional:

- `DB_SSL=true`
- `STORAGE_ENCRYPTION_KEY`
- `PII_ENCRYPTION_KEY`
- `AWS_*` / SES settings
- `STORAGE_PROXY_URL` / `STORAGE_PROXY_API_KEY` if using an external storage proxy
