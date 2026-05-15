# Setup Guide

This guide covers two installation paths for Hundredth Sign OSS:

- **Path A: Docker Compose** — recommended for evaluation and self-hosting.
  Bundled MySQL, no Node.js/pnpm required on the host.
- **Path B: Local Node.js (pnpm)** — for active development and contributions
  that need to run `pnpm dev`, edit source, and rerun tests.

For deeper Docker operations (backups, production notes, common commands), see
`docs/docker.md`.

---

## Path A: Docker Compose (Recommended)

### A-1. Install Prerequisites

- Docker Desktop or another Docker Compose compatible runtime.

### A-2. Prepare Environment

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS Terminal:

```bash
cp .env.example .env
```

Edit `.env` and set at least `JWT_SECRET` (32+ random characters) and a
non-default `MYSQL_ROOT_PASSWORD`. For a throwaway evaluation, the bundled
defaults are sufficient.

### A-3. Start The Stack

```bash
docker compose up --build
```

Compose starts the app and MySQL, waits for the database, and applies
committed migrations.

### A-4. Open The App

Open `http://localhost:4817/setup` and create the first administrator. After
setup, staff users sign in at `/login`.

To stop the stack:

```bash
docker compose down
```

See `docs/docker.md` for backups, production notes, and `APP_PORT` tuning.

---

## Path B: Local Node.js (pnpm) — for Development

Use this path when you need to edit source, run `pnpm dev`, or run unit tests
quickly without rebuilding a Docker image.

### B-1. Install Prerequisites

- Node.js 22 LTS or newer.
- pnpm 10.16 or newer. Corepack is recommended.
- MySQL 8.x (managed locally or via Docker).
- Docker Desktop if you want to run E2E tests.

Windows PowerShell:

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env
```

macOS Terminal:

```bash
corepack enable
pnpm install
cp .env.example .env
```

### B-2. Configure Environment

Edit `.env` and set at least:

```env
DATABASE_URL=mysql://root:password@127.0.0.1:3306/hundredth_sign
JWT_SECRET=replace-with-at-least-32-random-characters
APP_URL=http://localhost:4817
```

Use a long random value for `JWT_SECRET`. Production startup requires at least
32 characters. Do not reuse development secrets in production.

### B-3. Prepare MySQL

Create the database referenced by `DATABASE_URL`.

```sql
CREATE DATABASE hundredth_sign CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then run migrations:

```bash
pnpm db:push
```

### B-4. Start The App

```bash
pnpm dev
```

Open `http://localhost:4817/setup` and create the first administrator. After
setup, staff users sign in at `/login`.

### B-5. Production Build (without Docker)

```bash
pnpm build
pnpm start
```

For production, set `NODE_ENV=production`, configure a real HTTPS `APP_URL`,
and use managed MySQL, mail, storage, backup, and secret management.

Recommended production secrets:

```bash
openssl rand -base64 48  # JWT_SECRET
openssl rand -hex 32     # STORAGE_ENCRYPTION_KEY
openssl rand -hex 32     # PII_ENCRYPTION_KEY
```
