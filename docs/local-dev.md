# Local Development

Use this page as the short local workflow reference. For the full installation
guide, see `docs/setup.md`.

## Start

Windows PowerShell:

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env
pnpm db:push
pnpm dev
```

macOS Terminal:

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm db:push
pnpm dev
```

Open the URL shown by the dev server. A fresh database starts at `/setup`.

## Verify

```bash
pnpm test
pnpm check
pnpm build
```

## E2E

```bash
pnpm test:e2e:setup
pnpm test:e2e
pnpm test:e2e:teardown
```

E2E requires Docker and a configured `.env.e2e` file.
