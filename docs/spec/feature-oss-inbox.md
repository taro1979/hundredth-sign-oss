# Source-Available Pseudo Inbox Specification

## Summary

The source-available self-hosted build includes a staff-only pseudo inbox at `/dashboard/inbox`.
It is not a mail client and does not introduce mailbox storage. Inbox items are derived from existing workflow rows so staff can handle requests addressed to their own email inside the admin UI.

## Source Rows

- Signature items come from `signatureRequests` where the logged-in staff user matches `signerUserId` or `signerEmail`.
- Internal approval items come from `internalApprovals` where the logged-in staff user matches `approverUserId` or `approverEmail`.
- Email alias claiming follows the existing signature request claim behavior; internal approvals use the same matching approach.
- Results are scoped to the current internal workspace organization.

## Item Types

- `signature`: signer requests with `sent`, `viewed`, `signed`, `declined`, or `expired` status.
- `approval`: internal approval requests. Pending requests are shown only when it is the approver's current turn; approved and rejected rows are shown as history.
- `cc`: CC signature request rows. They are display-only and never action-required.

## Actions

- Pending signature items link to `/sign/:token`.
- Pending approval items link to `/approve/:token`.
- CC and completed signature items link to `/document-view/:token`.
- Completed approval history links to the existing approval token page.

## Out Of Scope

- Sending new email from the inbox.
- Creating arbitrary message drafts.
- Read/unread state.
- Storing rendered email HTML.
- External customer accounts or a customer mailbox.
