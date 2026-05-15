# Setup Guide

This guide covers a local or self-hosted Hundredth Sign OSS installation.

For a Docker-based quick start, see `docs/docker.md`.

## 1. Install Prerequisites

- Node.js 22 LTS or newer.
- pnpm 10.16 or newer. Corepack is recommended.
- MySQL 8.x.
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

## 2. Configure Environment

Edit `.env` and set at least:

```env
DATABASE_URL=mysql://root:password@127.0.0.1:3306/hundredth_sign
JWT_SECRET=replace-with-at-least-32-random-characters
APP_URL=http://localhost:4817
```

Use a long random value for `JWT_SECRET`. Production startup requires at least
32 characters. Do not reuse development secrets in production.

## 3. Prepare MySQL

Create the database referenced by `DATABASE_URL`.

```sql
CREATE DATABASE hundredth_sign CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then run migrations:

```bash
pnpm db:push
```

## 4. Start The App

```bash
pnpm dev
```

Open `http://localhost:4817/setup` and create the first administrator. After
setup, staff users sign in at `/login`.

## 5. Production Build

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
