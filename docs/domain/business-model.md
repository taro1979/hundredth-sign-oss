# Business Model

Hundredth Sign is a source-available, noncommercial self-hosted electronic
contract application.

## Roles

| Role          | Scope                            | Responsibilities                                                                                |
| ------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| administrator | Staff workspace                  | Staff management, instance settings, audit logs, API integration keys, and document operations. |
| member        | Staff workspace                  | Daily document, template, contact, inbox, and signing-related work.                             |
| signer        | External recipient               | Receives an email token and signs or declines. No account.                                      |
| cc            | External recipient               | Receives completion notices and document links. No account.                                     |
| approver      | Internal or token-based approver | Approves or rejects before external signing.                                                    |

## Rules

- The product is single-workspace for source-available self-hosting.
- External customers/recipients do not register, log in, or belong to a workspace.
- Internal staff accounts are managed by administrators using email/password.
- The product UI exposes administrator and member only. Legacy internal
  membership values are implementation details and must not be presented as
  operator-facing staff roles.
- There is no commercial hosted-service payment, subscription, or send-limit workflow.
- Signed documents and WORM audit records are retained for compliance.

## Main Workflows

### Send For Signature

1. Staff uploads a PDF.
2. Staff places fields and adds recipients.
3. Recipients receive email links.
4. Signers complete or decline through token access.
5. The final PDF is generated, stored, and emailed.

### Staff Management

1. The initial admin is created during setup.
2. Admins create staff users and issue temporary passwords.
3. Staff can change passwords.
4. Password reset tokens are emailed when requested.

### Compliance

- Every important document action is logged.
- Final PDFs are stored in WORM storage.
- WORM/system audit logs are append-only.
