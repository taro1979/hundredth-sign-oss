# External Integrations API And CLI

## Scope

Hundredth Sign exposes a generic integration surface for third-party systems,
automation clients, CI jobs, and AI agents. The surface is intentionally not
tailored to a single external product.

External systems must call the Sign API instead of mutating database tables
directly. Sign remains authoritative for signing status, audit logs, WORM
storage, completion certificates, signed PDF generation, and webhook delivery.

## Authentication And Authorization

- REST endpoints live under `/api/integrations/*`.
- Every endpoint requires `Authorization: Bearer <api key>`.
- API keys are generated with the `hsign_sk_` prefix, hashed at rest, scoped,
  expiring, and revocable.
- Default key lifetime is 90 days. The maximum accepted lifetime is 365 days.
- Expired keys return `API_KEY_EXPIRED`; revoked or unknown keys return
  `API_KEY_INVALID`.
- Supported scopes:
  - `documents:read`
  - `documents:write`
  - `documents:send`
  - `documents:download`
  - `webhooks:manage`
  - `api_keys:manage`

The first key can be created from the administrator settings UI or from the host
with:

```bash
pnpm signctl -- api-keys create --local --organization-id 1 --name automation --json
```

After bootstrap, API-key management can be automated only by a key with
`api_keys:manage`.

## Idempotency

Mutating calls accept `Idempotency-Key`.

- Matching repeat: same API key, method, path, and body replays the stored 2xx
  response and sets `idempotency-replayed: true`.
- Mismatched repeat: same key with a different method, path, or body returns
  `IDEMPOTENCY_KEY_CONFLICT`.
- Stored idempotency responses expire after seven days.

Use idempotency keys for document creation, PDF upload, template application,
send, void, API-key creation/revocation, and webhook creation/test operations
when callers may retry after network timeouts.

## REST Endpoints

| Endpoint                                                                    | Scope                | Purpose                                                                                                     |
| --------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `POST /api/integrations/documents`                                          | `documents:write`    | Create a draft document with `title`, optional `description`, and optional `external` reference.            |
| `POST /api/integrations/documents/:id/pdf`                                  | `documents:write`    | Upload `fileName` and `dataBase64` to a draft. PDF validation and the 20 MB limit are enforced server-side. |
| `POST /api/integrations/documents/:id/template`                             | `documents:write`    | Apply a template by `templateId` to a draft document.                                                       |
| `POST /api/integrations/documents/:id/send`                                 | `documents:send`     | Send signers and CC recipients. Requires PDF and fields for each signer index.                              |
| `GET /api/integrations/documents/:id`                                       | `documents:read`     | Read status, external reference, signer statuses, timestamps, and signed-PDF availability.                  |
| `GET /api/integrations/documents/by-external/:system/:entityType/:entityId` | `documents:read`     | Resolve a Sign document from an external-system reference.                                                  |
| `POST /api/integrations/documents/:id/void`                                 | `documents:write`    | Void a sent or declined document. Requires `confirm=true`.                                                  |
| `GET /api/integrations/documents/:id/signed-download-url`                   | `documents:download` | Get a download URL after completion.                                                                        |
| `GET /api/integrations/api-keys`                                            | `api_keys:manage`    | List key metadata, not secrets.                                                                             |
| `POST /api/integrations/api-keys`                                           | `api_keys:manage`    | Create a new key; the secret is returned once.                                                              |
| `POST /api/integrations/api-keys/:id/revoke`                                | `api_keys:manage`    | Revoke a key. Requires `confirm=true`.                                                                      |
| `GET /api/integrations/webhooks`                                            | `webhooks:manage`    | List webhook registrations without secrets.                                                                 |
| `POST /api/integrations/webhooks`                                           | `webhooks:manage`    | Create a webhook and return its secret once.                                                                |
| `POST /api/integrations/webhooks/:id/test`                                  | `webhooks:manage`    | Send an `integration.webhook.test` delivery.                                                                |

## Document Payloads

### Create

```json
{
  "title": "NDA",
  "description": "Optional note",
  "external": {
    "system": "crm",
    "entityType": "deal",
    "entityId": "123",
    "metadata": { "owner": "sales" }
  }
}
```

### Upload PDF

```json
{
  "fileName": "nda.pdf",
  "dataBase64": "JVBERi0x..."
}
```

### Send

```json
{
  "signers": [
    {
      "email": "taro@example.com",
      "name": "Taro Yamada",
      "role": "signer",
      "order": 1,
      "locale": "ja",
      "accessCode": "123456",
      "message": "Please review."
    },
    {
      "email": "legal@example.com",
      "name": "Legal Team",
      "role": "cc",
      "order": 1,
      "locale": "ja"
    }
  ],
  "sequentialRouting": false,
  "expirationDays": 30,
  "reminderDays": 3
}
```

`role` is `signer` or `cc`. At least one signer is required. A draft must have
uploaded PDF content and signature fields assigned for every signer index before
send.

## Webhooks

Webhook deliveries contain JSON:

```json
{
  "eventType": "document.completed",
  "payload": { "documentId": 42 },
  "deliveredAt": "2026-05-13T00:00:00.000Z"
}
```

Headers:

- `x-hundredth-sign-event`: event type.
- `x-hundredth-sign-signature`: `sha256=<hex hmac>`.

The webhook create response returns `secret` and `secretDerivation:
"sha256(secret)"`. Current delivery code signs the raw JSON body with HMAC-SHA256
using `sha256(secret)` as the HMAC key. Receivers should verify the raw request
body with a timing-safe comparison and handle duplicate or delayed deliveries.

Current event types include:

- `document.created`
- `document.sent`
- `document.completed`
- `document.declined`
- `document.voided`
- `signature.viewed`
- `signature.signed`
- `signature.declined`
- `integration.webhook.test`

Failed deliveries are retried by the scheduler with capped exponential backoff.

## CLI

`signctl` is the JSON-first CLI for operators, CI, and AI agents.

Environment variables:

```bash
SIGN_BASE_URL=https://sign.example.com
SIGN_API_KEY=hsign_sk_...
SIGN_OUTPUT=json
```

Available commands:

```bash
pnpm signctl -- documents create --title "NDA" --external-system crm --external-entity-type deal --external-entity-id 123 --json
pnpm signctl -- documents upload-pdf 42 --file ./nda.pdf --json
pnpm signctl -- documents apply-template 42 --template-id 7 --json
pnpm signctl -- documents send 42 --signer "Taro Yamada <taro@example.com>" --idempotency-key send-42-v1 --json
pnpm signctl -- documents status 42 --json
pnpm signctl -- documents by-external --system crm --entity-type deal --entity-id 123 --json
pnpm signctl -- documents wait 42 --status completed --timeout 900 --json
pnpm signctl -- documents download-signed 42 --output ./signed-nda.pdf --json
pnpm signctl -- documents void 42 --confirm --reason duplicate --json
pnpm signctl -- api-keys list --json
pnpm signctl -- api-keys create --name ci --scopes documents:read,documents:write --expires-in-days 90 --json
pnpm signctl -- api-keys revoke 12 --confirm --json
pnpm signctl -- webhooks list --json
pnpm signctl -- webhooks create --name crm --target-url https://example.com/sign-webhook --events document.completed,document.declined --json
pnpm signctl -- webhooks test 3 --json
```

Use `--dry-run` on supported commands to inspect the request without calling the
server. Use `--json` or `SIGN_OUTPUT=json` for machine-readable output.

## Verification

- `pnpm signctl -- --help --json`
- `pnpm test`
- `pnpm check`
