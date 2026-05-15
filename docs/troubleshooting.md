# Troubleshooting

## pnpm Or Corepack Fails On Windows

Use PowerShell as a normal user first:

```powershell
corepack enable
pnpm install
```

If Corepack cache permissions fail, close other terminals and retry from a
fresh PowerShell session. If your environment blocks Corepack, install pnpm
through your standard Node toolchain and rerun `pnpm install`.

## Port 4817 Is Already In Use

The development server prefers port 4817 (chosen to avoid common port
conflicts with other tools such as 3000) and may move to the next available
port. Check the terminal output for the actual URL. You can force a port:

```powershell
$env:PORT="4827"; pnpm dev
```

macOS:

```bash
PORT=4827 pnpm dev
```

## Startup Stops With MigrationCheck

The server checks Drizzle migrations before starting. If it reports pending or
hash-mismatched migrations:

1. Confirm that `DATABASE_URL` points to the intended database.
2. Run `pnpm db:push`.
3. Restart `pnpm dev`.

Do not bypass migration checks in production.

## E2E Setup Fails

Confirm Docker Desktop is running, then copy the E2E environment file:

```powershell
Copy-Item .env.e2e.example .env.e2e
pnpm test:e2e:setup
```

macOS:

```bash
cp .env.e2e.example .env.e2e
pnpm test:e2e:setup
```

If ports `3307`, `1025`, `4818`, or `8025` are already in use, stop the
conflicting service or adjust `docker-compose.e2e.yml` and `.env.e2e`
together.

## Email Links Point To The Wrong Host

Set `APP_URL` to the externally reachable URL of the instance. For local E2E,
`APP_URL` and `BASE_URL` should usually both be `http://localhost:4818`.

## Windows And macOS Script Differences

Project orchestration scripts are Node-based. Avoid adding `bash -lc`, `rm -rf`,
`lsof`, `export FOO=bar`, or inline `KEY=value command` syntax to
`package.json`. Put new multi-step commands under `scripts/`.
