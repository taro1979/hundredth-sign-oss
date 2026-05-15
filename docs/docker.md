# Docker Guide

This guide is for quickly running the OSS app with Docker Compose. It is a
self-hosting starter, not a full production platform.

## Quick Start

```bash
docker compose up --build
```

Then open:

```text
http://localhost:4817/setup
```

Compose starts:

- `app`: the production Node.js build.
- `mysql`: MySQL 8.4 with UTF-8 defaults.
- `mysql-data`: persistent database volume.
- `local-uploads`: persistent local PDF storage volume for development and
  small self-hosted trials.

The app container waits for MySQL, applies committed SQL migrations when
`SIGN_RUN_MIGRATIONS=true`, then starts `node dist/index.js`.

## Configuration

For local evaluation, Compose provides safe placeholders. For anything beyond a
throwaway environment, set real values in your shell or in a private `.env`
file that is not committed.

Important variables:

```env
MYSQL_ROOT_PASSWORD=replace-with-a-strong-database-password
MYSQL_DATABASE=hundredth_sign
JWT_SECRET=replace-with-at-least-32-random-characters
APP_URL=https://your-sign.example.com
APP_PORT=4817
SIGN_RUN_MIGRATIONS=true
```

Recommended production secret generation:

```bash
openssl rand -base64 48  # JWT_SECRET
openssl rand -hex 32     # STORAGE_ENCRYPTION_KEY
openssl rand -hex 32     # PII_ENCRYPTION_KEY
```

When set, `STORAGE_ENCRYPTION_KEY`, `STORAGE_ENCRYPTION_KEY_PREV`,
`PII_ENCRYPTION_KEY`, and `PII_ENCRYPTION_KEY_PREV` must be 64-character hex
strings.

## Production Notes

For a real deployment:

- Put a TLS reverse proxy in front of the app and set `APP_URL` to the public
  HTTPS origin.
- Replace the Compose MySQL service with managed MySQL or a hardened database
  host if possible.
- Configure SMTP or AWS SES for real email delivery.
- Configure external object storage or back up `local-uploads` with the
  database.
- Set `STORAGE_ENCRYPTION_KEY` and `PII_ENCRYPTION_KEY`.
- Set `TRUST_PROXY` to the exact proxy CIDR/IP list when running behind a
  reverse proxy.
- Keep `SIGN_RUN_MIGRATIONS=false` if database migrations are handled by a
  separate deployment job.

## Backups

Back up `mysql-data` and `local-uploads` together. Signed PDF records and WORM
audit metadata are meaningful only when the database and PDF storage are kept in
sync.

Example logical backup:

```bash
docker compose exec mysql mysqldump -uroot -p hundredth_sign > hundredth_sign.sql
```

Also snapshot or export the `local-uploads` volume if local storage is used.

## Common Commands

```bash
docker compose up --build
docker compose down
docker compose logs -f app
docker compose exec mysql mysql -uroot -p hundredth_sign
```

Remove local Docker data only when you intentionally want a clean instance:

```bash
docker compose down --volumes
```
