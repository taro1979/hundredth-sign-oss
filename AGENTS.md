# Repository Instructions

Hundredth Sign OSS is a self-hosted electronic signature application for a
single workspace. It uses React, Vite, Express, tRPC, Drizzle, and MySQL.

## Read First

- `README.md` for installation and common commands.
- `docs/architecture.md` for application boundaries and data flow.
- `docs/spec/product-spec.md` for the current product surface.
- The matching file under `docs/spec/` before changing a specific feature.

## Project Layout

```text
client/     React frontend
server/     Express and tRPC backend
shared/     Shared validation, locales, and types
drizzle/    MySQL schema and migrations
scripts/    Cross-platform operator and maintenance scripts
docs/       Product, setup, operations, and architecture docs
e2e/        Playwright tests and E2E seed data
```

## Standard Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm test
pnpm check
pnpm db:push
pnpm test:e2e:setup
pnpm test:e2e
pnpm test:e2e:teardown
```

## Critical Rules

- Do not hard-code secrets, API keys, connection strings, or signing material.
  Read them from environment variables.
- If `drizzle/schema.ts` changes, update `docs/domain/data-model.md`.
- If product behavior, public routes, API boundaries, or operations change,
  update `docs/spec/product-spec.md` or the matching feature spec.
- Do not remove `activityLogs` or `systemAuditLogs` inserts from critical
  signing, approval, integration, storage, or compliance flows unless an
  equivalent or stronger audit record replaces them.
- Keep scripts usable from both Windows PowerShell and macOS Terminal. Avoid
  shell-only syntax in `package.json`; use Node scripts for orchestration.
- Before reporting implementation complete, run `pnpm test` and `pnpm check`.

