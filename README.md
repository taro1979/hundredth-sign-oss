# Hundredth Sign OSS

Self-hosted electronic contract and signature system for one internal workspace.
Hundredth Sign is designed for Japanese business workflows, accountless external
recipients, PDF signing, internal approval, immutable audit evidence, and
automation through a controlled API and CLI.

This repository is the OSS distribution. It does not include the hosted SaaS
tenant-switching, billing, quota, workspace import, or customer-account layers.

## Features

- Local email/password staff authentication.
- Initial administrator setup from `/setup`.
- PDF upload, field placement, multi-signer routing, and templates.
- Accountless recipient signing, decline, delegation, and final PDF download.
- Optional internal approval before external signing.
- Contacts, contact categories, and contact groups.
- Staff pseudo inbox generated from signing and approval workflow rows.
- Activity logs, hash-chained WORM audit logs, and WORM signed-PDF records.
- Integration REST API, webhook delivery, idempotency, and `signctl`.
- Multilingual UI and recipient communication.

## Requirements

- Node.js 22 LTS or newer.
- pnpm 10.x via Corepack or a local pnpm install.
- MySQL 8.x.
- Docker Desktop, optional but recommended for E2E tests.
- SMTP, AWS SES, or another configured mail path for real email delivery.
- S3-compatible storage or the local development storage fallback.

Windows PowerShell and macOS Terminal are both supported. Project scripts avoid
shell-specific syntax where practical.

## Quick Start

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env
pnpm db:push
pnpm dev
```

Then open `http://localhost:3000/setup` and create the first administrator.

On macOS, use the same commands with `cp .env.example .env` instead of
`Copy-Item`.

## Common Commands

```bash
pnpm dev              # start the Express + Vite development server
pnpm build            # build frontend and backend production bundles
pnpm start            # start the production build
pnpm test             # run Vitest
pnpm check            # run TypeScript checks
pnpm db:push          # generate and run Drizzle migrations
pnpm signctl -- --help
```

E2E tests require Docker:

```bash
pnpm test:e2e:setup
pnpm test:e2e
pnpm test:e2e:teardown
```

## Documentation

- [Setup guide](docs/setup.md)
- [Operations guide](docs/operations.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Architecture](docs/architecture.md)
- [Product specification](docs/spec/product-spec.md)
- [External API and CLI specification](docs/spec/feature-external-integrations-cli.md)

## Configuration

Copy `.env.example` to `.env` and update the values for your local or production
environment. Required variables are:

- `DATABASE_URL`
- `JWT_SECRET`
- `APP_URL`

Optional variables configure email, storage, Redis, encryption, platform PDF
signing, maintenance mode, and integration CLI defaults.

Never commit real secrets, connection strings, API keys, or private signing
material.

## License

MIT
