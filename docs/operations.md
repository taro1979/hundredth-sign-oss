# Operations Guide

## Required Operational Controls

- Keep `.env` and production secrets outside Git.
- Back up MySQL regularly.
- Back up signed PDF storage and WORM registry metadata together.
- Keep `APP_URL` correct so email links point to the deployed instance.
- Monitor mail delivery failures and webhook retry failures.

## Database

Hundredth Sign uses MySQL through Drizzle. Apply schema changes with:

```bash
pnpm db:push
```

Before production upgrades, take a database backup and verify that the target
database is the one referenced by `DATABASE_URL`.

## Signed PDFs And WORM Evidence

Completed signed PDFs are registered as immutable workflow artifacts. The
database and storage backend must be backed up as a pair:

- MySQL tables including `documents`, `signatureRequests`, `system_audit_logs`,
  and `worm_records`.
- The object or local storage that contains uploaded and signed PDFs.

Do not physically delete WORM records or hash-chain audit rows as part of
routine cleanup.

## Email

Configure either AWS SES or SMTP. For local testing, Mailpit is available in
`docker-compose.e2e.yml`.

Important variables:

- `APP_URL`
- `SES_FROM_EMAIL` or `SMTP_FROM_EMAIL`
- Provider host, region, user, and password values.

## Integrations

Use the integration API and `signctl` for automation. Do not write directly to
Sign tables from external systems.

Useful CLI variables:

```env
SIGN_BASE_URL=https://your-sign.example.com
SIGN_API_KEY=hsign_sk_...
SIGN_OUTPUT=json
```

## Verification After Changes

Run at least:

```bash
pnpm test
pnpm check
pnpm build
```

For browser workflow changes, run the E2E setup and Playwright tests when Docker
is available.

