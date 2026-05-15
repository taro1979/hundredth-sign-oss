# Phase Roadmap

Last updated: 2026-05-12

## Current Direction

Hundredth Sign is now a source-available, noncommercial, self-hosted,
single-workspace electronic signature application. Hosted SaaS features such as
paid plans, quotas, external OAuth, workspace invites, and customer inbox/import
flows are intentionally outside the current product scope.

## Completed Milestones

| Phase | Scope | Status | Period |
|---|---|---|---|
| Phase 1-10 | Core PDF signing MVP | Done | 2025 initial |
| Phase 11-20 | Internal approval, WORM audit logs, platform signature | Done | 2025 middle |
| Phase 21-32 | Templates, scheduling, contacts, UX improvements | Done | 2025 late |
| Phase 33-44 | i18n and regression fixes | Done | 2026 Q1 |
| Phase 45-60 | UI polish, bug fixes, synchronization | Done | 2026-02 to 2026-03 |
| Source-available Refactor | Single workspace, local auth, no commercial hosted-service layer | In progress | 2026-05 |

## Source-Available Roadmap Candidates

| Feature | Category | Summary |
|---|---|---|
| Setup/login E2E coverage | Quality | Cover initial admin setup, password reset, and staff issuance. |
| Self-hosting guide | Documentation | Add installation, `.env`, mail, DB, storage, and backup guidance. |
| Backup/export operations | Operations | Document signed PDF and WORM audit log backup procedures. |
| Import/migration guide | Operations | Explain how existing installs move to the OSS schema. |
| Audit dashboard filters | Core | Add filters and export for WORM audit logs. |
| Bulk send | Core | Send one template to multiple external recipients. |
| Two-factor authentication | Security | Add TOTP-based staff login protection. |

## Decision Rules

| Category | Criteria |
|---|---|
| Core | Required for PDF sending, signing, storage, or audit evidence. |
| Security | Reduces operational or legal risk for self-hosted installs. |
| Operations | Makes self-hosting easier to install, back up, or maintain. |
| Quality | Improves test coverage, reliability, and maintainability. |
