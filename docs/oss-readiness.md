# Source-Available Readiness

Use this checklist before publishing or tagging a source-available release.

## Repository Metadata

- `LICENSE` is present and matches `package.json`.
- `README.md` explains that the software is source-available + PolyForm
  Noncommercial, not open source software.
- `README.md` explains the product boundary and quick start.
- `CONTRIBUTING.md`, `SECURITY.md`, and `CODE_OF_CONDUCT.md` are present.
- Issue templates and pull request template are present under `.github/`.
- CI runs install, typecheck, tests, and build with pnpm.
- `Dockerfile`, `docker-compose.yml`, and `docs/docker.md` are present for a
  quick self-hosted trial.

## Supply Chain

- `packageManager` uses pnpm 10.16+.
- `.npmrc` enables `engine-strict=true` and `minimum-release-age`.
- `pnpm-lock.yaml` is committed.
- No npm or yarn lockfile is committed.
- Dependency updates are reviewed with the same test baseline as code changes.

## Secrets And Signing Material

- `.env`, `.env.*`, P12/PFX bundles, PEM files, private keys, and certificates
  are ignored.
- `.env.example` and `.env.e2e.example` contain placeholders only.
- Production operators generate:
  - `JWT_SECRET` with at least 32 random characters.
  - `STORAGE_ENCRYPTION_KEY` with `openssl rand -hex 32`.
  - `PII_ENCRYPTION_KEY` with `openssl rand -hex 32`.
- Production `APP_URL` is the externally reachable HTTPS origin.

## Product Boundary

- The repository remains a single-workspace self-hosted source-available build.
- Hosted SaaS tenant switching, billing, quotas, customer accounts, and import
  layers are not reintroduced.
- Public signing, approval, and document view routes remain token-based.

## Compliance And Audit

- Critical signing, approval, integration, storage, and compliance flows keep
  `activityLogs` and `systemAuditLogs` coverage.
- Signed PDFs are registered in WORM storage.
- Operators have backup guidance for MySQL and PDF/WORM storage.

## Release Verification

Run:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
docker compose config
```

When Docker is available and browser workflows changed, also run:

```bash
pnpm test:e2e:setup
pnpm test:e2e
pnpm test:e2e:teardown
```
