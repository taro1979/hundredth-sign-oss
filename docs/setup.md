# Setup Guide

This guide covers a local or self-hosted Hundredth Sign OSS installation.

## 1. Install Prerequisites

- Node.js 22 LTS or newer.
- pnpm 10.x. Corepack is recommended.
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
JWT_SECRET=replace-with-a-long-random-secret
APP_URL=http://localhost:3000
```

Use a long random value for `JWT_SECRET`. Do not reuse development secrets in
production.

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

Open `http://localhost:3000/setup` and create the first administrator. After
setup, staff users sign in at `/login`.

## 5. Production Build

```bash
pnpm build
pnpm start
```

For production, set `NODE_ENV=production`, configure a real `APP_URL`, and use
managed MySQL, mail, storage, backup, and secret management.

