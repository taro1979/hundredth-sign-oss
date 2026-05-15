# Hundredth Sign

Self-hosted electronic contract and signature system for one internal workspace.
Hundredth Sign is designed for Japanese business workflows, accountless external
recipients, PDF signing, internal approval, immutable audit evidence, and
automation through a controlled API and CLI.

This repository is source-available + PolyForm Noncommercial. The source code is
published, but this software is not open source software. Noncommercial use is
permitted only under the PolyForm Noncommercial License 1.0.0. Commercial use
requires a separate commercial license agreement.

This distribution does not include the hosted SaaS tenant-switching, billing,
quota, workspace import, or customer-account layers.

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

- Docker Desktop or another Docker Compose compatible runtime for the quickest
  evaluation path.
- Node.js 22 LTS or newer.
- pnpm 10.16 or newer via Corepack or a local pnpm install.
- MySQL 8.x.
- SMTP, AWS SES, or another configured mail path for real email delivery.
- S3-compatible storage or the local development storage fallback.

Windows PowerShell and macOS Terminal are both supported. Project scripts avoid
shell-specific syntax where practical.

## Quick Start

```bash
docker compose up --build
```

Then open `http://localhost:3000/setup` and create the first administrator. The
Compose stack starts the production app and MySQL, waits for the database,
applies committed SQL migrations, and keeps MySQL plus local PDF uploads in
Docker volumes.

Use this path for evaluation and self-hosting smoke tests. For production,
review [Docker guide](docs/docker.md), set real secrets, configure HTTPS
`APP_URL`, and back up the database and PDF storage together.

## Development Quick Start

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
- [Docker guide](docs/docker.md)
- [Operations guide](docs/operations.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Architecture](docs/architecture.md)
- [Product specification](docs/spec/product-spec.md)
- [External API and CLI specification](docs/spec/feature-external-integrations-cli.md)
- [Source-available readiness checklist](docs/oss-readiness.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

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

For production, `JWT_SECRET` must be at least 32 random characters and `APP_URL`
must be a valid HTTP(S) URL. Encryption keys, when set, must be 64-character hex
strings generated with `openssl rand -hex 32`.

## License

source-available + PolyForm Noncommercial

This software is source-available under the
[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0).
The source code is published, but this software is not open source software.
Noncommercial use only is permitted. Commercial use requires a separate license
agreement.

## GitHub Repository Metadata

Recommended GitHub About settings:

- Description: `Source-available electronic signature app for one self-hosted workspace. PolyForm Noncommercial; not open source software.`
- Topics: `electronic-signature`, `digital-signature`, `self-hosted`, `source-available`, `polyform-noncommercial`, `react`, `vite`, `express`, `trpc`, `drizzle`, `mysql`
- License display: use the repository `LICENSE`; this software is not open
  source software.
