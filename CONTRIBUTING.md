# Contributing

Hundredth Sign is a source-available, noncommercial self-hosted electronic
signature system. Changes should preserve the single-workspace product
boundary, auditability, and cross-platform operator workflow.

This repository publishes source code, but the software is not open source
software. Noncommercial use is permitted under the PolyForm Noncommercial
License 1.0.0; commercial use requires a separate commercial license agreement.

## Development Setup

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm db:push
pnpm dev
```

Use PowerShell equivalents on Windows, for example `Copy-Item .env.example .env`.

## Package Manager

Use pnpm through Corepack. This repository pins `packageManager` to pnpm 10.16+
and enables `minimum-release-age` in `.npmrc`.

Do not use `npm install`, `npm ci`, `yarn install`, or `yarn add` for normal
development. If a non-pnpm command is unavoidable for reproduction, explain why
in the issue or pull request.

## Pull Request Checklist

- Keep changes scoped to the requested behavior.
- Add or update focused tests for behavior changes.
- Update `docs/spec/product-spec.md` or the matching feature spec when product
  behavior, routes, API boundaries, or operations change.
- Update `docs/domain/data-model.md` when `drizzle/schema.ts` changes.
- Preserve `activityLogs` and `systemAuditLogs` writes in signing, approval,
  integration, storage, and compliance flows unless an equivalent or stronger
  audit record replaces them.
- Keep scripts portable across Windows PowerShell and macOS Terminal.

Before marking a change ready, run:

```bash
pnpm test
pnpm check
```

Run `pnpm build` for production, bundling, or dependency changes. Run Playwright
E2E tests when browser workflows are affected and Docker is available.

## Security-Sensitive Changes

Do not commit real secrets, API keys, connection strings, certificates, private
keys, or signing material. Use environment variables and document any new
variable in `.env.example`, `docs/setup.md`, and `docs/spec/product-spec.md`.

Security vulnerabilities should be reported using the process in `SECURITY.md`,
not as public issues.
