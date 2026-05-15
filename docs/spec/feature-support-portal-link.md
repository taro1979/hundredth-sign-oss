# Feature Specification: Source-Available Manual And Customization Contact Pages

## Overview

Hundredth Sign source-available + PolyForm Noncommercial distribution does not
expose the previous HelpTicket support portal. The self-hosted build uses
public manual pages and a static paid-customization contact page instead.

## Functional Requirements

1. Remove HelpTicket support links and support URL helpers from the dashboard
   sidebar and public footer.
2. Expose public static routes:
   - `/manual`
   - `/manual/terms`
   - `/manual/disclaimer`
   - `/contact`
3. Keep all visible manual, legal, disclaimer, screenshot-caption, and contact
   copy in locale JSON for `ja`, `en`, `th`, and `zh-CN`.
4. The contact page uses `mailto:infibilitis.th@gmail.com` only. It does not
   include an inquiry API, ticket system, chat widget, or submission form.

## Manual Coverage

The `/manual` page is a GitBook-style reference covering:

- Source-available product model, roles, workspace boundary, recipients, and WORM audit terms.
- Initial setup, required environment values, admin creation, and staff sign-in.
- Dashboard, document list, document creation, recipient settings, field
  placement, and recipient signing.
- Internal approval, templates, contacts, staff management, audit logs, and the
  staff pseudo inbox.
- Operational troubleshooting for login, mail delivery, PDF/signing, and audit
  issues.
- Developer-oriented architecture notes for frontend, backend, shared code,
  Drizzle schema, tRPC boundaries, data flow, and customization safety.

## Screenshot Assets

- Static screenshots live under `client/public/manual/screenshots/`.
- Screenshots are captured from the Japanese E2E seed environment and reused for
  every locale with translated captions.
- The refresh command is `pnpm manual:screenshots`, which runs only
  `e2e/manual-screenshots.spec.ts` with `UPDATE_MANUAL_SCREENSHOTS=1`.
- Normal `pnpm test` does not regenerate screenshots.

Expected screenshots:

- `setup.png`
- `login.png`
- `dashboard.png`
- `documents.png`
- `document-new.png`
- `signing.png`
- `templates.png`
- `contacts.png`
- `settings.png`
- `audit-log.png`
- `inbox.png`

## Source-Available Terms And Disclaimer Coverage

The legal pages explain:

- Noncommercial source-available use is permitted under PolyForm
  Noncommercial. Commercial use requires a separate license agreement.
- Hosting, database, storage, email, backup, monitoring, security, and incident
  response are operator responsibilities.
- General support and individual troubleshooting are not included in the OSS
  distribution.
- Legal validity, compliance, retention, privacy, and security suitability must
  be reviewed by the operating organization.
- The codebase includes AI-assisted code and still requires review, testing,
  acceptance, and operational verification.
- Paid customization is available for business-specific workflows.

## Verification

- Unit coverage checks manual page headings, screenshot image references,
  legal/disclaimer routes, and the mail contact link.
- E2E navigation verifies the footer and dashboard sidebar point to internal OSS
  manual/contact pages instead of HelpTicket.
- Locale consistency keeps the keyset identical across `en`, `ja`, `th`, and
  `zh-CN`, and translation quality tests prevent untranslated English strings in
  non-English locales.

## Out Of Scope

- HelpTicket integration.
- In-app support tickets.
- Embedded chat.
- Backend inquiry submission APIs.
- Runtime CMS or database-backed manual editing.
