#!/usr/bin/env node

import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createConnection } from "mysql2/promise.js";

const API_KEY_PREFIX = "hsign_sk_";
const DEFAULT_OUTPUT = process.env.SIGN_OUTPUT || "text";
const DEFAULT_BASE_URL = process.env.SIGN_BASE_URL || "http://localhost:3000";
const DEFAULT_API_KEY = process.env.SIGN_API_KEY || "";
const DEFAULT_EXPIRES_IN_DAYS = 90;
const MAX_EXPIRES_IN_DAYS = 365;

function parseArgs(argv) {
  const args = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item === "--") continue;
    if (!item.startsWith("--")) {
      args.push(item);
      continue;
    }
    const [rawKey, inlineValue] = item.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    const assign = value => {
      if (opts[key] === undefined) {
        opts[key] = value;
      } else if (Array.isArray(opts[key])) {
        opts[key].push(value);
      } else {
        opts[key] = [opts[key], value];
      }
    };
    if (inlineValue !== undefined) {
      assign(inlineValue);
    } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      assign(argv[++i]);
    } else {
      opts[key] = true;
    }
  }
  return { args, opts };
}

function output(data, opts = {}) {
  const asJson = opts.json || DEFAULT_OUTPUT === "json";
  if (asJson) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  if (data.ok === false) {
    process.stderr.write(`${data.code}: ${data.message}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function fail(code, message, opts, status = 1, details) {
  output(
    { ok: false, code, message, ...(details === undefined ? {} : { details }) },
    opts
  );
  process.exit(status);
}

function hashApiKey(apiKey) {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

function generateApiKey() {
  const apiKey = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { apiKey, prefix: apiKey.slice(0, 18), hash: hashApiKey(apiKey) };
}

function parseScopes(value) {
  return String(value || "")
    .split(",")
    .map(scope => scope.trim())
    .filter(Boolean);
}

function requireValue(opts, key) {
  const value = opts[key];
  if (value === undefined || value === true || value === "") {
    throw new Error(
      `Missing --${key.replace(/[A-Z]/g, ch => `-${ch.toLowerCase()}`)}`
    );
  }
  return String(value);
}

async function request(method, path, body, opts) {
  const baseUrl = String(opts.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const apiKey = String(opts.apiKey || DEFAULT_API_KEY);
  if (!apiKey)
    fail("API_KEY_REQUIRED", "Set SIGN_API_KEY or pass --api-key", opts);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...(opts.idempotencyKey
        ? { "idempotency-key": String(opts.idempotencyKey) }
        : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {
      ok: false,
      code: "INVALID_RESPONSE",
      message: text || response.statusText,
    };
  }
  if (!response.ok) {
    output(json, opts);
    process.exit(1);
  }
  return json;
}

async function createLocalApiKey(opts) {
  const databaseUrl = process.env.DATABASE_URL || opts.databaseUrl;
  if (!databaseUrl)
    fail(
      "DATABASE_URL_REQUIRED",
      "Set DATABASE_URL or pass --database-url for --local",
      opts
    );
  const organizationId = Number(requireValue(opts, "organizationId"));
  const name = requireValue(opts, "name");
  const scopes = parseScopes(
    opts.scopes ||
      "documents:read,documents:write,documents:send,documents:download,webhooks:manage,api_keys:manage"
  );
  const expiresInDays = Number(opts.expiresInDays || DEFAULT_EXPIRES_IN_DAYS);
  if (
    !Number.isInteger(expiresInDays) ||
    expiresInDays < 1 ||
    expiresInDays > MAX_EXPIRES_IN_DAYS
  ) {
    fail(
      "INVALID_EXPIRES_IN_DAYS",
      `--expires-in-days must be between 1 and ${MAX_EXPIRES_IN_DAYS}`,
      opts
    );
  }
  const generated = generateApiKey();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  const conn = await createConnection(databaseUrl);
  try {
    const [result] = await conn.execute(
      "INSERT INTO integration_api_keys (organizationId, createdByUserId, name, keyPrefix, keyHash, scopes, expiresAt) VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), ?)",
      [
        organizationId,
        opts.createdByUserId ? Number(opts.createdByUserId) : null,
        name,
        generated.prefix,
        generated.hash,
        JSON.stringify(scopes),
        expiresAt,
      ]
    );
    return {
      ok: true,
      id: result.insertId,
      apiKey: generated.apiKey,
      keyPrefix: generated.prefix,
      scopes,
      expiresAt: expiresAt.toISOString(),
    };
  } finally {
    await conn.end();
  }
}

async function main() {
  const { args, opts } = parseArgs(process.argv.slice(2));
  const [group, command, ...rest] = args;
  opts.json = Boolean(opts.json);

  if (!group || opts.help) {
    output(
      {
        ok: true,
        usage: [
          "signctl documents create --title <title> [--external-system crm --external-entity-type deal --external-entity-id 123] --json",
          "signctl documents upload-pdf <document-id> --file ./contract.pdf --json",
          "signctl documents apply-template <document-id> --template-id 1 --json",
          "signctl documents send <document-id> --signer 'Name <email@example.com>' --json",
          "signctl documents status <document-id> --json",
          "signctl documents by-external --system crm --entity-type deal --entity-id 123 --json",
          "signctl documents void <document-id> --confirm [--reason 'duplicate'] --json",
          "signctl documents wait <document-id> --status completed --timeout 300 --json",
          "signctl documents download-signed <document-id> --output ./signed.pdf --json",
          "signctl api-keys create --local --organization-id 1 --name automation --json",
          "signctl api-keys list --json",
          "signctl api-keys revoke <key-id> --confirm --json",
          "signctl webhooks create --name ops --target-url https://example.com/webhook --events document.completed,document.declined --json",
        ],
      },
      opts
    );
    return;
  }

  if (group === "documents" && command === "create") {
    const external = opts.externalSystem
      ? {
          system: String(opts.externalSystem),
          entityType: String(opts.externalEntityType || "entity"),
          entityId: requireValue(opts, "externalEntityId"),
        }
      : undefined;
    const body = {
      title: requireValue(opts, "title"),
      description: opts.description || undefined,
      external,
    };
    if (opts.dryRun)
      return output({ ok: true, dryRun: true, request: body }, opts);
    return output(
      await request("POST", "/api/integrations/documents", body, opts),
      opts
    );
  }

  if (group === "documents" && command === "upload-pdf") {
    const documentId = rest[0];
    const file = requireValue(opts, "file");
    const buffer = fs.readFileSync(file);
    const body = {
      fileName: opts.fileName || file.split(/[\\/]/).pop(),
      dataBase64: buffer.toString("base64"),
    };
    if (opts.dryRun)
      return output(
        {
          ok: true,
          dryRun: true,
          documentId,
          fileName: body.fileName,
          bytes: buffer.length,
        },
        opts
      );
    return output(
      await request(
        "POST",
        `/api/integrations/documents/${documentId}/pdf`,
        body,
        opts
      ),
      opts
    );
  }

  if (group === "documents" && command === "apply-template") {
    const documentId = rest[0];
    const body = { templateId: Number(requireValue(opts, "templateId")) };
    if (opts.dryRun)
      return output(
        { ok: true, dryRun: true, documentId, request: body },
        opts
      );
    return output(
      await request(
        "POST",
        `/api/integrations/documents/${documentId}/template`,
        body,
        opts
      ),
      opts
    );
  }

  if (group === "documents" && command === "send") {
    const documentId = rest[0];
    const signerValues = Array.isArray(opts.signer)
      ? opts.signer
      : [opts.signer].filter(Boolean);
    const signers = signerValues.map(parseSigner);
    const body = {
      signers,
      sequentialRouting: Boolean(opts.sequentialRouting),
    };
    if (opts.dryRun)
      return output(
        { ok: true, dryRun: true, documentId, request: body },
        opts
      );
    return output(
      await request(
        "POST",
        `/api/integrations/documents/${documentId}/send`,
        body,
        opts
      ),
      opts
    );
  }

  if (group === "documents" && command === "status") {
    const documentId = rest[0];
    return output(
      await request(
        "GET",
        `/api/integrations/documents/${documentId}`,
        undefined,
        opts
      ),
      opts
    );
  }

  if (group === "documents" && command === "by-external") {
    const system = encodeURIComponent(requireValue(opts, "system"));
    const entityType = encodeURIComponent(requireValue(opts, "entityType"));
    const entityId = encodeURIComponent(requireValue(opts, "entityId"));
    return output(
      await request(
        "GET",
        `/api/integrations/documents/by-external/${system}/${entityType}/${entityId}`,
        undefined,
        opts
      ),
      opts
    );
  }

  if (group === "documents" && command === "void") {
    const documentId = rest[0];
    if (!opts.confirm)
      fail("CONFIRM_REQUIRED", "documents void requires --confirm", opts);
    const body = { confirm: true, reason: opts.reason || undefined };
    if (opts.dryRun)
      return output(
        { ok: true, dryRun: true, documentId, request: body },
        opts
      );
    return output(
      await request(
        "POST",
        `/api/integrations/documents/${documentId}/void`,
        body,
        opts
      ),
      opts
    );
  }

  if (group === "documents" && command === "wait") {
    const documentId = rest[0];
    const targetStatus = String(opts.status || "completed");
    const timeoutMs = Number(opts.timeout || 300) * 1000;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const result = await request(
        "GET",
        `/api/integrations/documents/${documentId}`,
        undefined,
        opts
      );
      const status = result.document?.status;
      if (
        status === targetStatus ||
        ["declined", "voided", "expired"].includes(status)
      )
        return output(result, opts);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    fail(
      "WAIT_TIMEOUT",
      `Timed out waiting for document ${documentId} to reach ${targetStatus}`,
      opts
    );
  }

  if (group === "documents" && command === "download-signed") {
    const documentId = rest[0];
    const out = requireValue(opts, "output");
    if (opts.dryRun) {
      return output(
        {
          ok: true,
          dryRun: true,
          documentId,
          output: out,
          request: {
            method: "GET",
            path: `/api/integrations/documents/${documentId}/signed-download-url`,
          },
        },
        opts
      );
    }
    const result = await request(
      "GET",
      `/api/integrations/documents/${documentId}/signed-download-url`,
      undefined,
      opts
    );
    const response = await fetch(result.url);
    if (!response.ok)
      fail(
        "DOWNLOAD_FAILED",
        `${response.status} ${response.statusText}`,
        opts
      );
    fs.writeFileSync(out, Buffer.from(await response.arrayBuffer()));
    return output({ ok: true, documentId, output: out }, opts);
  }

  if (group === "api-keys" && command === "create") {
    if (opts.local) {
      if (opts.dryRun) {
        return output(
          {
            ok: true,
            dryRun: true,
            local: true,
            organizationId: Number(requireValue(opts, "organizationId")),
            name: requireValue(opts, "name"),
            scopes: parseScopes(
              opts.scopes ||
                "documents:read,documents:write,documents:send,documents:download,webhooks:manage,api_keys:manage"
            ),
            expiresInDays: Number(
              opts.expiresInDays || DEFAULT_EXPIRES_IN_DAYS
            ),
          },
          opts
        );
      }
      return output(await createLocalApiKey(opts), opts);
    }
    const body = {
      name: requireValue(opts, "name"),
      scopes: parseScopes(opts.scopes),
      expiresInDays: Number(opts.expiresInDays || DEFAULT_EXPIRES_IN_DAYS),
    };
    if (opts.dryRun)
      return output({ ok: true, dryRun: true, request: body }, opts);
    return output(
      await request("POST", "/api/integrations/api-keys", body, opts),
      opts
    );
  }

  if (group === "api-keys" && command === "list") {
    return output(
      await request("GET", "/api/integrations/api-keys", undefined, opts),
      opts
    );
  }

  if (group === "api-keys" && command === "revoke") {
    if (!opts.confirm)
      fail("CONFIRM_REQUIRED", "api-keys revoke requires --confirm", opts);
    if (opts.dryRun)
      return output(
        { ok: true, dryRun: true, keyId: rest[0], request: { confirm: true } },
        opts
      );
    return output(
      await request(
        "POST",
        `/api/integrations/api-keys/${rest[0]}/revoke`,
        { confirm: true },
        opts
      ),
      opts
    );
  }

  if (group === "webhooks" && command === "list") {
    return output(
      await request("GET", "/api/integrations/webhooks", undefined, opts),
      opts
    );
  }

  if (group === "webhooks" && command === "create") {
    const body = {
      name: requireValue(opts, "name"),
      targetUrl: requireValue(opts, "targetUrl"),
      events: parseScopes(requireValue(opts, "events")),
    };
    if (opts.dryRun)
      return output({ ok: true, dryRun: true, request: body }, opts);
    return output(
      await request("POST", "/api/integrations/webhooks", body, opts),
      opts
    );
  }

  if (group === "webhooks" && command === "test") {
    if (opts.dryRun)
      return output(
        { ok: true, dryRun: true, webhookId: rest[0], request: {} },
        opts
      );
    return output(
      await request(
        "POST",
        `/api/integrations/webhooks/${rest[0]}/test`,
        {},
        opts
      ),
      opts
    );
  }

  fail(
    "UNKNOWN_COMMAND",
    `Unknown command: ${[group, command].filter(Boolean).join(" ")}`,
    opts
  );
}

function parseSigner(value) {
  const match = String(value).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match)
    return {
      name: match[1],
      email: match[2],
      role: "signer",
      order: 1,
      locale: "ja",
    };
  throw new Error("Signer must be formatted as 'Name <email@example.com>'");
}

main().catch(error => {
  output(
    {
      ok: false,
      code: "SIGNCTL_ERROR",
      message: error instanceof Error ? error.message : String(error),
    },
    { json: DEFAULT_OUTPUT === "json" }
  );
  process.exit(1);
});
