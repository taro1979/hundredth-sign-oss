# OSS Single Workspace Specification

## Scope

Hundredth Sign OSS is a self-hosted electronic contract application for one workspace.

## Requirements

- Staff authentication uses local email/password credentials stored in the database.
- Fresh installs expose setup until the first admin exists.
- Admins can issue staff accounts and temporary passwords.
- Staff can request password reset emails.
- External recipients do not create accounts.
- Recipient signing, decline, PDF view, and final PDF download use signed email tokens.
- Staff can open a pseudo inbox generated from existing signature requests, CC notifications, and internal approvals addressed to their own account.
- PDF upload, field placement, multi-signer routing, templates, contacts, internal approval, WORM storage, and audit logs remain core product behavior.
- Commercial hosted-service payment code, send limits, tenant switching, external customer accounts, arbitrary mailbox sending, workspace import, and workspace invite flows are out of scope.

## Inbox Boundary

- Included: `/dashboard/inbox` for authenticated staff, with action-required counts and links into existing token-based sign, approve, and document-view flows.
- Excluded: external recipient account inboxes, composing or sending arbitrary email from the inbox, read/unread mailbox state, and storing email HTML as a new mailbox record.
- Source of truth: existing `signatureRequests` and `internalApprovals` rows. The inbox is a derived view, not a new persistence model.

## Verification

- `pnpm test`
- `pnpm check`
- Keyword scan for removed commercial hosted-service and import flows.
