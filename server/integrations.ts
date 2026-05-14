import type { Express, Request, Response, NextFunction } from "express";
import { createHash, createHmac, randomBytes } from "crypto";
import { z } from "zod";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
import { and, eq, isNull, lte } from "drizzle-orm";
import {
  documents,
  integrationApiKeys,
  integrationIdempotencyKeys,
  integrationWebhookDeliveries,
  integrationWebhooks,
} from "../drizzle/schema";
import {
  createActivityLog,
  createDocument,
  createSignatureRequestsBulk,
  deepCopyTemplateToDocument,
  deleteSignatureRequestsByDocument,
  getDocumentById,
  getSignatureFieldsByDocument,
  getSignatureRequestsByDocument,
  getTemplateById,
  incrementTemplateUsage,
  updateDocument,
  updateSignatureRequest,
} from "./db";
import { getDb } from "./db";
import { storageGet, storagePut } from "./storage";
import { appendAuditLog } from "./auditLog";
import { getClientIp } from "./clientIp";
import { getAppUrlOrThrow } from "./routers/_helpers";
import {
  emailSchema,
  MAX_FILE_SIZE,
  nameSchema,
  validatePdfMagicNumber,
} from "@shared/validation";
import { validatePdf } from "./pdf";
import {
  buildCcNotificationEmail,
  buildSignatureRequestEmail,
  resolveEmailLocale,
  sendEmail,
} from "./email";

const API_KEY_PREFIX = "hsign_sk_";
const API_KEY_DEFAULT_DAYS = 90;
const API_KEY_MAX_DAYS = 365;
const BCRYPT_ROUNDS = 12;
const IDEMPOTENCY_TTL_DAYS = 7;
const WEBHOOK_MAX_ATTEMPTS = 5;

export const INTEGRATION_SCOPES = [
  "documents:read",
  "documents:write",
  "documents:send",
  "documents:download",
  "webhooks:manage",
  "api_keys:manage",
] as const;

type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];

type IntegrationAuth = {
  apiKeyId: number;
  organizationId: number;
  createdByUserId: number | null;
  scopes: IntegrationScope[];
};

type IntegrationRequest = Request & { integrationAuth?: IntegrationAuth };

const externalRefSchema = z.object({
  system: z.string().min(1).max(100),
  entityType: z.string().min(1).max(100),
  entityId: z.string().min(1).max(255),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const signerInputSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  order: z.number().int().min(1).default(1),
  role: z.enum(["signer", "cc"]).default("signer"),
  accessCode: z.string().max(50).optional(),
  message: z.string().max(1000).optional(),
  locale: z.string().max(10).default("ja"),
});

const createDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().nullable(),
  external: externalRefSchema.optional(),
});

const uploadPdfSchema = z.object({
  fileName: z.string().min(1).max(500),
  dataBase64: z.string().min(1),
});

const applyTemplateSchema = z.object({
  templateId: z.number().int().positive(),
});

const sendDocumentSchema = z.object({
  signers: z.array(signerInputSchema).min(1).max(20),
  sequentialRouting: z.boolean().default(false),
  expirationDays: z.number().int().min(1).max(365).nullable().optional(),
  reminderDays: z.number().int().min(1).max(30).nullable().optional(),
});

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.enum(INTEGRATION_SCOPES)).min(1),
  expiresInDays: z.number().int().min(1).max(API_KEY_MAX_DAYS).default(API_KEY_DEFAULT_DAYS),
});

const createWebhookSchema = z.object({
  name: z.string().min(1).max(255),
  targetUrl: z.string().url(),
  events: z.array(z.string().min(1).max(100)).min(1),
});

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

export function generateApiKey(): { apiKey: string; prefix: string; hash: string } {
  const secret = randomBytes(32).toString("base64url");
  const apiKey = `${API_KEY_PREFIX}${secret}`;
  return { apiKey, prefix: apiKey.slice(0, 18), hash: hashApiKey(apiKey) };
}

export function normalizeScopes(scopes: unknown): IntegrationScope[] {
  if (!Array.isArray(scopes)) return [];
  return scopes.filter((scope): scope is IntegrationScope =>
    typeof scope === "string" && (INTEGRATION_SCOPES as readonly string[]).includes(scope),
  );
}

function jsonOk(res: Response, body: Record<string, unknown> = {}, status = 200) {
  res.status(status).json({ ok: true, ...body });
}

function jsonError(res: Response, status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ ok: false, code, message, ...(details === undefined ? {} : { details }) });
}

function asyncRoute(fn: (req: IntegrationRequest, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req as IntegrationRequest, res, next).catch(next);
  };
}

function requireScope(scope: IntegrationScope) {
  return asyncRoute(async (req, res, next) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!token) return jsonError(res, 401, "API_KEY_REQUIRED", "Missing Bearer API key");

    const db = await getDb();
    if (!db) return jsonError(res, 500, "DATABASE_UNAVAILABLE", "Database not available");

    const rows = await db
      .select()
      .from(integrationApiKeys)
      .where(eq(integrationApiKeys.keyHash, hashApiKey(token)))
      .limit(1);
    const key = rows[0];
    if (!key || key.revokedAt) return jsonError(res, 401, "API_KEY_INVALID", "API key is invalid");
    if (new Date(key.expiresAt).getTime() <= Date.now()) {
      return jsonError(res, 401, "API_KEY_EXPIRED", "API key has expired");
    }

    const scopes = normalizeScopes(key.scopes);
    if (!scopes.includes(scope)) {
      return jsonError(res, 403, "INSUFFICIENT_SCOPE", `Missing required scope: ${scope}`);
    }

    await db.update(integrationApiKeys).set({ lastUsedAt: new Date() }).where(eq(integrationApiKeys.id, key.id));
    req.integrationAuth = {
      apiKeyId: key.id,
      organizationId: key.organizationId,
      createdByUserId: key.createdByUserId ?? null,
      scopes,
    };
    next();
  });
}

function hashRequestBody(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body ?? null), "utf8").digest("hex");
}

function idempotencyMiddleware() {
  return asyncRoute(async (req, res, next) => {
    const actor = auth(req);
    const rawKey = req.headers["idempotency-key"];
    const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!idempotencyKey) return next();
    if (idempotencyKey.length > 255) {
      return jsonError(res, 400, "IDEMPOTENCY_KEY_TOO_LONG", "Idempotency-Key must be 255 characters or fewer");
    }

    const db = await getDb();
    if (!db) return jsonError(res, 500, "DATABASE_UNAVAILABLE", "Database not available");

    await db.delete(integrationIdempotencyKeys)
      .where(lte(integrationIdempotencyKeys.expiresAt, new Date()))
      .catch(() => undefined);

    const requestMethod = req.method.toUpperCase();
    const requestPath = req.path;
    const requestHash = hashRequestBody(req.body);
    const existing = (await db.select().from(integrationIdempotencyKeys).where(and(
      eq(integrationIdempotencyKeys.organizationId, actor.organizationId),
      eq(integrationIdempotencyKeys.apiKeyId, actor.apiKeyId),
      eq(integrationIdempotencyKeys.idempotencyKey, idempotencyKey),
    )).limit(1))[0];

    if (existing) {
      if (
        existing.requestMethod !== requestMethod
        || existing.requestPath !== requestPath
        || existing.requestHash !== requestHash
      ) {
        return jsonError(res, 409, "IDEMPOTENCY_KEY_CONFLICT", "Idempotency-Key was already used for a different request");
      }
      res.setHeader("idempotency-replayed", "true");
      res.status(existing.responseStatus).json(existing.responseBody);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void db.insert(integrationIdempotencyKeys).values({
          organizationId: actor.organizationId,
          apiKeyId: actor.apiKeyId,
          idempotencyKey,
          requestMethod,
          requestPath,
          requestHash,
          responseStatus: res.statusCode,
          responseBody: body,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_DAYS * 24 * 60 * 60 * 1000),
        }).catch((error: unknown) => {
          console.error("[Integrations] failed to store idempotency response:", error);
        });
      }
      return originalJson(body);
    }) as Response["json"];

    next();
  });
}

function auth(req: IntegrationRequest): IntegrationAuth {
  if (!req.integrationAuth) throw new Error("Integration auth missing");
  return req.integrationAuth;
}

function parseBody<T>(schema: z.ZodType<T>, res: Response, body: unknown): T | undefined {
  const result = schema.safeParse(body);
  if (!result.success) {
    jsonError(res, 400, "VALIDATION_ERROR", "Request validation failed", result.error.issues);
    return undefined;
  }
  return result.data;
}

async function getOwnedDocument(id: number, organizationId: number) {
  const doc = await getDocumentById(id);
  if (!doc || doc.organizationId !== organizationId) return undefined;
  return doc;
}

function nextWebhookAttemptAt(attemptCount: number): Date | null {
  if (attemptCount >= WEBHOOK_MAX_ATTEMPTS) return null;
  const delayMinutes = Math.min(60, 5 * (2 ** Math.max(0, attemptCount - 1)));
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

async function deliverIntegrationWebhook(
  db: Awaited<ReturnType<typeof getDb>>,
  webhook: typeof integrationWebhooks.$inferSelect,
  deliveryId: number,
  eventType: string,
  payload: Record<string, unknown>,
  attemptCount: number,
) {
  if (!db) return;
  const body = JSON.stringify({ eventType, payload, deliveredAt: new Date().toISOString() });
  const signature = createHmac("sha256", webhook.secretHash).update(body).digest("hex");
  try {
    const response = await fetch(webhook.targetUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hundredth-sign-event": eventType,
        "x-hundredth-sign-signature": `sha256=${signature}`,
      },
      body,
    });
    const delivered = response.ok;
    await db.update(integrationWebhookDeliveries).set({
      status: delivered ? "delivered" : "failed",
      attemptCount,
      lastStatusCode: response.status,
      lastError: delivered ? null : await response.text().catch(() => response.statusText),
      deliveredAt: delivered ? new Date() : null,
      nextAttemptAt: delivered ? null : nextWebhookAttemptAt(attemptCount),
    }).where(eq(integrationWebhookDeliveries.id, deliveryId));
  } catch (error) {
    await db.update(integrationWebhookDeliveries).set({
      status: "failed",
      attemptCount,
      lastError: error instanceof Error ? error.message : String(error),
      nextAttemptAt: nextWebhookAttemptAt(attemptCount),
    }).where(eq(integrationWebhookDeliveries.id, deliveryId));
  }
}

export async function emitIntegrationEvent(organizationId: number, eventType: string, payload: Record<string, unknown>) {
  try {
    const db = await getDb();
    if (!db) return;
    if (typeof (db as { select?: unknown }).select !== "function") return;
    const webhooks = await db
      .select()
      .from(integrationWebhooks)
      .where(and(eq(integrationWebhooks.organizationId, organizationId), eq(integrationWebhooks.isActive, true)));

    await Promise.all(webhooks
      .filter(webhook => Array.isArray(webhook.events) && (webhook.events as string[]).includes(eventType))
      .map(async webhook => {
        const insertResult = await db.insert(integrationWebhookDeliveries).values({
          webhookId: webhook.id,
          organizationId,
          eventType,
          payload,
          status: "pending",
        });
        const deliveryId = Number(insertResult[0].insertId);
        await deliverIntegrationWebhook(db, webhook, deliveryId, eventType, payload, 1);
      }));
  } catch (error) {
    console.error("[Integrations] webhook event emission failed:", error);
  }
}

export async function processIntegrationWebhookRetries(limit = 25) {
  const db = await getDb();
  if (!db) return { processed: 0, delivered: 0, failed: 0 };
  const dueDeliveries = await db
    .select()
    .from(integrationWebhookDeliveries)
    .where(and(
      eq(integrationWebhookDeliveries.status, "failed"),
      lte(integrationWebhookDeliveries.nextAttemptAt, new Date()),
    ))
    .limit(limit);

  let delivered = 0;
  let failed = 0;
  for (const delivery of dueDeliveries) {
    if (delivery.attemptCount >= WEBHOOK_MAX_ATTEMPTS) {
      await db.update(integrationWebhookDeliveries)
        .set({ nextAttemptAt: null })
        .where(eq(integrationWebhookDeliveries.id, delivery.id));
      failed++;
      continue;
    }
    const webhook = (await db
      .select()
      .from(integrationWebhooks)
      .where(and(
        eq(integrationWebhooks.id, delivery.webhookId),
        eq(integrationWebhooks.isActive, true),
      ))
      .limit(1))[0];
    if (!webhook) {
      await db.update(integrationWebhookDeliveries)
        .set({ nextAttemptAt: null, lastError: "Webhook is inactive or missing" })
        .where(eq(integrationWebhookDeliveries.id, delivery.id));
      failed++;
      continue;
    }
    await deliverIntegrationWebhook(
      db,
      webhook,
      delivery.id,
      delivery.eventType,
      delivery.payload as Record<string, unknown>,
      delivery.attemptCount + 1,
    );
    const refreshed = (await db
      .select()
      .from(integrationWebhookDeliveries)
      .where(eq(integrationWebhookDeliveries.id, delivery.id))
      .limit(1))[0];
    if (refreshed?.status === "delivered") delivered++;
    else failed++;
  }
  return { processed: dueDeliveries.length, delivered, failed };
}

async function serializeDocument(documentId: number) {
  const doc = await getDocumentById(documentId);
  if (!doc) return null;
  const requests = await getSignatureRequestsByDocument(documentId);
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    pageCount: doc.pageCount,
    external: doc.externalSystem ? {
      system: doc.externalSystem,
      entityType: doc.externalEntityType,
      entityId: doc.externalEntityId,
      metadata: doc.externalMetadata,
    } : null,
    signedPdfAvailable: Boolean(doc.signedFileKey || doc.signedFileUrl),
    signers: requests.map(request => ({
      id: request.id,
      email: request.signerEmail,
      name: request.signerName,
      role: request.recipientRole,
      order: request.order,
      status: request.status,
      signedAt: request.signedAt,
      declinedAt: request.declinedAt,
      locale: request.locale,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    completedAt: doc.completedAt,
  };
}

export function registerIntegrationRoutes(app: Express) {
  const idempotent = idempotencyMiddleware();

  app.post("/api/integrations/documents", requireScope("documents:write"), idempotent, asyncRoute(async (req, res) => {
    const input = parseBody(createDocumentSchema, res, req.body);
    if (!input) return;
    const actor = auth(req);

    const id = await createDocument({
      title: input.title,
      description: input.description ?? null,
      userId: actor.createdByUserId ?? 0,
      organizationId: actor.organizationId,
      status: "draft",
      externalSystem: input.external?.system ?? null,
      externalEntityType: input.external?.entityType ?? null,
      externalEntityId: input.external?.entityId ?? null,
      externalMetadata: input.external?.metadata ?? null,
    });
    await createActivityLog({
      organizationId: actor.organizationId,
      documentId: id,
      userId: actor.createdByUserId ?? undefined,
      action: "integration_document_created",
      details: JSON.stringify({ external: input.external ?? null }),
      ipAddress: getClientIp(req) ?? undefined,
      userAgent: req.headers["user-agent"],
    });
    await appendAuditLog({
      eventType: "document.created",
      entityType: "document",
      entityId: id,
      organizationId: actor.organizationId,
      actorUserId: actor.createdByUserId ?? undefined,
      ipAddress: getClientIp(req) ?? undefined,
      userAgent: req.headers["user-agent"],
      metadata: { source: "integration_api", apiKeyId: actor.apiKeyId, external: input.external ?? null },
    });
    await emitIntegrationEvent(actor.organizationId, "document.created", { documentId: id, external: input.external ?? null });
    jsonOk(res, { documentId: id, document: await serializeDocument(id) }, 201);
  }));

  app.post("/api/integrations/documents/:id/pdf", requireScope("documents:write"), idempotent, asyncRoute(async (req, res) => {
    const input = parseBody(uploadPdfSchema, res, req.body);
    if (!input) return;
    const actor = auth(req);
    const documentId = Number(req.params.id);
    const doc = await getOwnedDocument(documentId, actor.organizationId);
    if (!doc) return jsonError(res, 404, "DOCUMENT_NOT_FOUND", "Document not found");
    if (doc.status !== "draft") return jsonError(res, 400, "DOCUMENT_NOT_EDITABLE", "Only draft documents can receive a PDF");

    const buffer = Buffer.from(input.dataBase64, "base64");
    if (buffer.length > MAX_FILE_SIZE) return jsonError(res, 400, "FILE_TOO_LARGE", "PDF file is too large");
    const magic = validatePdfMagicNumber(buffer);
    if (!magic.valid) return jsonError(res, 400, "INVALID_PDF", magic.error ?? "Invalid PDF");
    const pdf = await validatePdf(buffer);
    if (!pdf.valid) return jsonError(res, 400, "INVALID_PDF", pdf.error ?? "Invalid PDF");

    const storage = await storagePut(
      `organizations/${actor.organizationId}/documents/${Date.now()}-${nanoid(8)}.pdf`,
      buffer,
      "application/pdf",
    );
    await updateDocument(documentId, {
      fileUrl: storage.url,
      fileKey: storage.key,
      fileName: input.fileName,
      fileSize: buffer.length,
      mimeType: "application/pdf",
      pageCount: pdf.pageCount,
    });
    await createActivityLog({
      organizationId: actor.organizationId,
      documentId,
      userId: actor.createdByUserId ?? undefined,
      action: "integration_document_pdf_uploaded",
      details: JSON.stringify({ fileName: input.fileName, fileSize: buffer.length }),
      ipAddress: getClientIp(req) ?? undefined,
      userAgent: req.headers["user-agent"],
    });
    await appendAuditLog({
      eventType: "document.uploaded",
      entityType: "document",
      entityId: documentId,
      organizationId: actor.organizationId,
      actorUserId: actor.createdByUserId ?? undefined,
      ipAddress: getClientIp(req) ?? undefined,
      userAgent: req.headers["user-agent"],
      metadata: { source: "integration_api", apiKeyId: actor.apiKeyId, fileName: input.fileName, fileSize: buffer.length },
    });
    jsonOk(res, { document: await serializeDocument(documentId) });
  }));

  app.post("/api/integrations/documents/:id/template", requireScope("documents:write"), idempotent, asyncRoute(async (req, res) => {
    const input = parseBody(applyTemplateSchema, res, req.body);
    if (!input) return;
    const actor = auth(req);
    const documentId = Number(req.params.id);
    const doc = await getOwnedDocument(documentId, actor.organizationId);
    if (!doc) return jsonError(res, 404, "DOCUMENT_NOT_FOUND", "Document not found");
    if (doc.status !== "draft") return jsonError(res, 400, "DOCUMENT_NOT_EDITABLE", "Only draft documents can receive a template");

    const template = await getTemplateById(input.templateId);
    if (!template || template.organizationId !== actor.organizationId) {
      return jsonError(res, 404, "TEMPLATE_NOT_FOUND", "Template not found");
    }
    await deepCopyTemplateToDocument(input.templateId, documentId);
    await incrementTemplateUsage(input.templateId);
    await updateDocument(documentId, { sourceTemplateId: input.templateId });
    jsonOk(res, { document: await serializeDocument(documentId) });
  }));

  app.post("/api/integrations/documents/:id/send", requireScope("documents:send"), idempotent, asyncRoute(async (req, res) => {
    const input = parseBody(sendDocumentSchema, res, req.body);
    if (!input) return;
    const actor = auth(req);
    const documentId = Number(req.params.id);
    const doc = await getOwnedDocument(documentId, actor.organizationId);
    if (!doc) return jsonError(res, 404, "DOCUMENT_NOT_FOUND", "Document not found");
    if (doc.status !== "draft") return jsonError(res, 400, "DOCUMENT_NOT_SENDABLE", "Only draft documents can be sent");
    if (!doc.fileUrl) return jsonError(res, 400, "PDF_REQUIRED", "PDF is required before sending");

    const signers = input.signers.filter(s => s.role === "signer");
    if (signers.length === 0) return jsonError(res, 400, "SIGNER_REQUIRED", "At least one signer is required");
    const fields = await getSignatureFieldsByDocument(documentId);
    const signerIndices = new Set(fields.map(field => field.signerIndex));
    for (let index = 0; index < signers.length; index++) {
      if (!signerIndices.has(index)) {
        return jsonError(res, 400, "SIGNER_FIELD_REQUIRED", `Missing fields for signer index ${index}`);
      }
    }

    await deleteSignatureRequestsByDocument(documentId);
    await createSignatureRequestsBulk(await Promise.all(input.signers.map(async signer => ({
      documentId,
      signerEmail: signer.email,
      signerName: signer.name,
      recipientRole: signer.role,
      order: signer.order,
      status: "pending" as const,
      accessToken: nanoid(48),
      accessCode: signer.accessCode ? await bcrypt.hash(signer.accessCode, BCRYPT_ROUNDS) : null,
      message: signer.message ?? null,
      locale: signer.locale,
    }))));

    const expiresAt = input.expirationDays
      ? new Date(Date.now() + input.expirationDays * 24 * 60 * 60 * 1000)
      : null;
    const nextReminderAt = input.reminderDays
      ? new Date(Date.now() + input.reminderDays * 24 * 60 * 60 * 1000)
      : null;
    await updateDocument(documentId, {
      status: "sent",
      sequentialRouting: input.sequentialRouting,
      expirationDays: input.expirationDays ?? null,
      reminderDays: input.reminderDays ?? null,
      expiresAt,
      nextReminderAt,
    });

    const createdRequests = await getSignatureRequestsByDocument(documentId);
    const baseUrl = getAppUrlOrThrow(req);
    const requestTargets = input.sequentialRouting
      ? createdRequests.filter(request => request.recipientRole === "cc" || request.id === createdRequests.find(r => r.recipientRole === "signer")?.id)
      : createdRequests;

    await Promise.allSettled(requestTargets.map(async request => {
      await updateSignatureRequest(request.id, { status: "sent" });
      const lang = resolveEmailLocale(request.locale);
      if (request.recipientRole === "signer") {
        const signUrl = `${baseUrl}/sign/${request.accessToken}?lng=${lang}`;
        const email = buildSignatureRequestEmail({
          signerName: request.signerName || request.signerEmail,
          senderName: "Hundredth Sign",
          documentTitle: doc.title,
          message: request.message || undefined,
          signUrl,
          lang,
        });
        await sendEmail({ to: request.signerEmail, toName: request.signerName || undefined, ...email, type: "signature_request", documentId, signatureRequestId: request.id });
      } else {
        const email = buildCcNotificationEmail({
          ccName: request.signerName || request.signerEmail,
          senderName: "Hundredth Sign",
          documentTitle: doc.title,
          dashboardUrl: `${baseUrl}/document-view/${request.accessToken}`,
          lang,
        });
        await sendEmail({ to: request.signerEmail, toName: request.signerName || undefined, ...email, type: "signature_request", documentId, signatureRequestId: request.id });
      }
    }));

    await createActivityLog({
      organizationId: actor.organizationId,
      documentId,
      userId: actor.createdByUserId ?? undefined,
      action: "integration_document_sent",
      details: JSON.stringify({ count: createdRequests.length, sequentialRouting: input.sequentialRouting }),
      ipAddress: getClientIp(req) ?? undefined,
      userAgent: req.headers["user-agent"],
    });
    await appendAuditLog({
      eventType: "document.sent",
      entityType: "document",
      entityId: documentId,
      organizationId: actor.organizationId,
      actorUserId: actor.createdByUserId ?? undefined,
      ipAddress: getClientIp(req) ?? undefined,
      userAgent: req.headers["user-agent"],
      metadata: { source: "integration_api", apiKeyId: actor.apiKeyId, recipientCount: createdRequests.length, sequentialRouting: input.sequentialRouting },
    });
    await emitIntegrationEvent(actor.organizationId, "document.sent", { documentId, document: await serializeDocument(documentId) });
    jsonOk(res, { document: await serializeDocument(documentId) });
  }));

  app.get("/api/integrations/documents/:id", requireScope("documents:read"), asyncRoute(async (req, res) => {
    const actor = auth(req);
    const documentId = Number(req.params.id);
    const doc = await getOwnedDocument(documentId, actor.organizationId);
    if (!doc) return jsonError(res, 404, "DOCUMENT_NOT_FOUND", "Document not found");
    jsonOk(res, { document: await serializeDocument(documentId) });
  }));

  app.get("/api/integrations/documents/by-external/:system/:entityType/:entityId", requireScope("documents:read"), asyncRoute(async (req, res) => {
    const actor = auth(req);
    const db = await getDb();
    if (!db) return jsonError(res, 500, "DATABASE_UNAVAILABLE", "Database not available");
    const rows = await db.select().from(documents).where(and(
      eq(documents.organizationId, actor.organizationId),
      eq(documents.externalSystem, req.params.system),
      eq(documents.externalEntityType, req.params.entityType),
      eq(documents.externalEntityId, req.params.entityId),
    )).limit(1);
    if (!rows[0]) return jsonError(res, 404, "DOCUMENT_NOT_FOUND", "Document not found");
    jsonOk(res, { document: await serializeDocument(rows[0].id) });
  }));

  app.post("/api/integrations/documents/:id/void", requireScope("documents:write"), idempotent, asyncRoute(async (req, res) => {
    if (req.query.confirm !== "true" && req.body?.confirm !== true) {
      return jsonError(res, 400, "CONFIRM_REQUIRED", "Void requires confirm=true");
    }
    const actor = auth(req);
    const documentId = Number(req.params.id);
    const doc = await getOwnedDocument(documentId, actor.organizationId);
    if (!doc) return jsonError(res, 404, "DOCUMENT_NOT_FOUND", "Document not found");
    if (!["sent", "declined"].includes(doc.status)) {
      return jsonError(res, 400, "DOCUMENT_NOT_VOIDABLE", "Only sent or declined documents can be voided");
    }
    await updateDocument(documentId, { status: "voided" });
    await createActivityLog({
      organizationId: actor.organizationId,
      documentId,
      userId: actor.createdByUserId ?? undefined,
      action: "integration_document_voided",
      details: JSON.stringify({ reason: req.body?.reason ?? null }),
      ipAddress: getClientIp(req) ?? undefined,
      userAgent: req.headers["user-agent"],
    });
    await appendAuditLog({
      eventType: "document.voided",
      entityType: "document",
      entityId: documentId,
      organizationId: actor.organizationId,
      actorUserId: actor.createdByUserId ?? undefined,
      metadata: { source: "integration_api", apiKeyId: actor.apiKeyId, reason: req.body?.reason ?? null },
    });
    await emitIntegrationEvent(actor.organizationId, "document.voided", { documentId, reason: req.body?.reason ?? null });
    jsonOk(res, { document: await serializeDocument(documentId) });
  }));

  app.get("/api/integrations/documents/:id/signed-download-url", requireScope("documents:download"), asyncRoute(async (req, res) => {
    const actor = auth(req);
    const documentId = Number(req.params.id);
    const doc = await getOwnedDocument(documentId, actor.organizationId);
    if (!doc) return jsonError(res, 404, "DOCUMENT_NOT_FOUND", "Document not found");
    if (doc.status !== "completed" || (!doc.signedFileKey && !doc.signedFileUrl)) {
      return jsonError(res, 400, "SIGNED_PDF_NOT_READY", "Signed PDF is not ready");
    }
    const url = doc.signedFileKey ? (await storageGet(doc.signedFileKey)).url : doc.signedFileUrl;
    jsonOk(res, { documentId, url });
  }));

  app.get("/api/integrations/api-keys", requireScope("api_keys:manage"), asyncRoute(async (req, res) => {
    const actor = auth(req);
    const db = await getDb();
    if (!db) return jsonError(res, 500, "DATABASE_UNAVAILABLE", "Database not available");
    const keys = await db.select().from(integrationApiKeys).where(eq(integrationApiKeys.organizationId, actor.organizationId));
    jsonOk(res, {
      apiKeys: keys.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scopes: normalizeScopes(key.scopes),
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        revokedAt: key.revokedAt,
        createdAt: key.createdAt,
      })),
    });
  }));

  app.post("/api/integrations/api-keys", requireScope("api_keys:manage"), idempotent, asyncRoute(async (req, res) => {
    const input = parseBody(createApiKeySchema, res, req.body);
    if (!input) return;
    const actor = auth(req);
    const db = await getDb();
    if (!db) return jsonError(res, 500, "DATABASE_UNAVAILABLE", "Database not available");
    const generated = generateApiKey();
    const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
    const result = await db.insert(integrationApiKeys).values({
      organizationId: actor.organizationId,
      createdByUserId: actor.createdByUserId,
      name: input.name,
      keyPrefix: generated.prefix,
      keyHash: generated.hash,
      scopes: input.scopes,
      expiresAt,
    });
    const id = Number(result[0].insertId);
    await appendAuditLog({
      eventType: "integration.api_key.created",
      entityType: "integration_api_key",
      entityId: id,
      organizationId: actor.organizationId,
      actorUserId: actor.createdByUserId ?? undefined,
      metadata: { source: "integration_api", apiKeyId: actor.apiKeyId, name: input.name, scopes: input.scopes, expiresAt: expiresAt.toISOString() },
    });
    jsonOk(res, { apiKey: generated.apiKey, id, keyPrefix: generated.prefix, expiresAt }, 201);
  }));

  app.post("/api/integrations/api-keys/:id/revoke", requireScope("api_keys:manage"), idempotent, asyncRoute(async (req, res) => {
    if (req.query.confirm !== "true" && req.body?.confirm !== true) {
      return jsonError(res, 400, "CONFIRM_REQUIRED", "Revoke requires confirm=true");
    }
    const actor = auth(req);
    const db = await getDb();
    if (!db) return jsonError(res, 500, "DATABASE_UNAVAILABLE", "Database not available");
    const id = Number(req.params.id);
    await db.update(integrationApiKeys).set({ revokedAt: new Date() }).where(and(
      eq(integrationApiKeys.id, id),
      eq(integrationApiKeys.organizationId, actor.organizationId),
      isNull(integrationApiKeys.revokedAt),
    ));
    await appendAuditLog({
      eventType: "integration.api_key.revoked",
      entityType: "integration_api_key",
      entityId: id,
      organizationId: actor.organizationId,
      actorUserId: actor.createdByUserId ?? undefined,
      metadata: { source: "integration_api", apiKeyId: actor.apiKeyId },
    });
    jsonOk(res, { id, revoked: true });
  }));

  app.get("/api/integrations/webhooks", requireScope("webhooks:manage"), asyncRoute(async (req, res) => {
    const actor = auth(req);
    const db = await getDb();
    if (!db) return jsonError(res, 500, "DATABASE_UNAVAILABLE", "Database not available");
    const rows = await db.select().from(integrationWebhooks).where(eq(integrationWebhooks.organizationId, actor.organizationId));
    jsonOk(res, { webhooks: rows.map(row => ({ ...row, secretHash: undefined })) });
  }));

  app.post("/api/integrations/webhooks", requireScope("webhooks:manage"), idempotent, asyncRoute(async (req, res) => {
    const input = parseBody(createWebhookSchema, res, req.body);
    if (!input) return;
    const actor = auth(req);
    const db = await getDb();
    if (!db) return jsonError(res, 500, "DATABASE_UNAVAILABLE", "Database not available");
    const secret = randomBytes(32).toString("base64url");
    const secretHash = createHash("sha256").update(secret).digest("hex");
    const result = await db.insert(integrationWebhooks).values({
      organizationId: actor.organizationId,
      name: input.name,
      targetUrl: input.targetUrl,
      secretHash,
      events: input.events,
      isActive: true,
      createdByApiKeyId: actor.apiKeyId,
    });
    const id = Number(result[0].insertId);
    await appendAuditLog({
      eventType: "integration.webhook.created",
      entityType: "integration_webhook",
      entityId: id,
      organizationId: actor.organizationId,
      actorUserId: actor.createdByUserId ?? undefined,
      metadata: { source: "integration_api", apiKeyId: actor.apiKeyId, events: input.events },
    });
    jsonOk(res, { id, secret, secretDerivation: "sha256(secret)", events: input.events }, 201);
  }));

  app.post("/api/integrations/webhooks/:id/test", requireScope("webhooks:manage"), idempotent, asyncRoute(async (req, res) => {
    const actor = auth(req);
    const db = await getDb();
    if (!db) return jsonError(res, 500, "DATABASE_UNAVAILABLE", "Database not available");
    const webhookId = Number(req.params.id);
    const webhook = (await db.select().from(integrationWebhooks).where(and(
      eq(integrationWebhooks.id, webhookId),
      eq(integrationWebhooks.organizationId, actor.organizationId),
      eq(integrationWebhooks.isActive, true),
    )).limit(1))[0];
    if (!webhook) return jsonError(res, 404, "WEBHOOK_NOT_FOUND", "Webhook not found");
    const payload = {
      webhookId,
      testedAt: new Date().toISOString(),
    };
    const insertResult = await db.insert(integrationWebhookDeliveries).values({
      webhookId,
      organizationId: actor.organizationId,
      eventType: "integration.webhook.test",
      payload,
      status: "pending",
    });
    await deliverIntegrationWebhook(db, webhook, Number(insertResult[0].insertId), "integration.webhook.test", payload, 1);
    await appendAuditLog({
      eventType: "integration.webhook.tested",
      entityType: "integration_webhook",
      entityId: webhookId,
      organizationId: actor.organizationId,
      actorUserId: actor.createdByUserId ?? undefined,
      metadata: { source: "integration_api", apiKeyId: actor.apiKeyId },
    });
    jsonOk(res, { tested: true });
  }));
}

export async function createLocalIntegrationApiKey(input: {
  organizationId: number;
  createdByUserId?: number | null;
  name: string;
  scopes: IntegrationScope[];
  expiresInDays?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const expiresInDays = input.expiresInDays ?? API_KEY_DEFAULT_DAYS;
  if (expiresInDays < 1 || expiresInDays > API_KEY_MAX_DAYS) {
    throw new Error(`expiresInDays must be between 1 and ${API_KEY_MAX_DAYS}`);
  }
  const generated = generateApiKey();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  const result = await db.insert(integrationApiKeys).values({
    organizationId: input.organizationId,
    createdByUserId: input.createdByUserId ?? null,
    name: input.name,
    keyPrefix: generated.prefix,
    keyHash: generated.hash,
    scopes: input.scopes,
    expiresAt,
  });
  return {
    id: Number(result[0].insertId),
    apiKey: generated.apiKey,
    keyPrefix: generated.prefix,
    expiresAt,
  };
}
