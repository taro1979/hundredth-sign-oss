# Security Policy

## Supported Versions

Security fixes are made on the default branch. Operators should run the latest
released commit or tag available from this repository.

## Reporting A Vulnerability

Please do not open a public GitHub issue for a suspected vulnerability.

Use GitHub private vulnerability reporting if it is enabled for the repository.
If private reporting is not available, contact the repository maintainers through
the private channel listed in the GitHub repository profile or organization
profile.

Include:

- Affected commit, tag, or deployment version.
- Clear reproduction steps.
- Impact and reachable attack scenario.
- Whether secrets, signing material, PDFs, audit logs, or integration keys may
  be exposed or modified.

## Operator Guidance

- Set `JWT_SECRET` to at least 32 random characters.
- Set `APP_URL` to the externally reachable HTTPS origin in production.
- Keep `.env`, certificates, P12 bundles, and private keys outside Git.
- Use `STORAGE_ENCRYPTION_KEY` and `PII_ENCRYPTION_KEY` as 64-character hex
  values generated with `openssl rand -hex 32`.
- Back up MySQL and PDF/WORM storage together.
- Rotate integration API keys after any suspected exposure.
