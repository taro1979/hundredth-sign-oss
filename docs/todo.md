# TODO

Current direction: OSS self-hosted, single workspace, free to run, no customer accounts.

## Done In Current Refactor

- Local email/password authentication.
- Initial admin setup.
- Staff creation and staff management.
- Password reset tokens.
- Removed exposed external provider login.
- Removed commercial hosted-service payment code, send limits, exchange rates, inbox, workspace import, and workspace invite flows.
- Kept core PDF signing, templates, contacts, internal approval, WORM storage, and audit logs.

## Next Candidates

- Add E2E coverage for setup/login/password reset/staff management.
- Add a self-hosting installation guide with `.env` examples.
- Add migration guidance for existing hosted installs moving to the OSS schema.
- Add browser E2E smoke coverage for dashboard activity rendering and public page metadata.
- Add admin-facing backup/export guidance for signed PDFs and WORM audit logs.
