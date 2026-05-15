# TODO

Current direction: source-available + PolyForm Noncommercial, self-hosted,
single workspace, noncommercial use only, no customer accounts.

## Done In Current Refactor

- Local email/password authentication.
- Initial admin setup.
- Staff creation and staff management.
- Password reset tokens.
- Removed exposed external provider login.
- Removed commercial hosted-service payment code, send limits, exchange rates, inbox, workspace import, and workspace invite flows.
- Kept core PDF signing, templates, contacts, internal approval, WORM storage, and audit logs.
- Added source-available contribution, security, code-of-conduct, issue
  template, PR template, CI, Dependabot, and readiness checklist metadata.
- Hardened production startup validation for `JWT_SECRET`, `APP_URL`, and
  encryption key formats.
- Added pnpm 10.16+ and `minimum-release-age` supply-chain guardrails.
- Added Dockerfile, Docker Compose quick start, runtime migration entrypoint,
  and Docker operation notes.

## Next Candidates

- Add E2E coverage for setup/login/password reset/staff management.
- Add migration guidance for existing hosted installs moving to the OSS schema.
- Add browser E2E smoke coverage for dashboard activity rendering and public page metadata.
- Add admin-facing backup/export tooling for signed PDFs and WORM audit logs.
