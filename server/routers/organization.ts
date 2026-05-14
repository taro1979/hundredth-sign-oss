import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { protectedProcedure, orgOwnerProcedure, router } from "../_core/trpc";
import {
  getOrganizationsByUser,
  getOrganizationById,
  updateOrganization,
  getActiveAllowedIps,
  createAllowedIp,
  deactivateAllowedIp,
  getDb,
} from "../db";
import { appendAuditLog } from "../auditLog";
import { integrationApiKeys } from "../../drizzle/schema";
import { generateApiKey, INTEGRATION_SCOPES, normalizeScopes } from "../integrations";

const createIntegrationApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.enum(INTEGRATION_SCOPES)).min(1),
  expiresInDays: z.number().int().min(1).max(365).default(90),
});

export const organizationRouter = router({
  /**
   * List the single self-hosted workspace available to the current staff user.
   * The DB still stores an organization row as the internal workspace boundary
   * for existing document, template, contact, and audit-log joins.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return getOrganizationsByUser(ctx.user.id);
  }),

  /** Get the current self-hosted workspace settings. */
  get: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgs = await getOrganizationsByUser(ctx.user.id);
      const hasAccess = orgs.some(({ org }) => org.id === input.orgId);
      if (!hasAccess) {
        throw new TRPCError({ code: "FORBIDDEN", message: "errors.organization.accessDenied" });
      }

      const org = await getOrganizationById(input.orgId);
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.organization.notFound" });
      }

      return {
        org,
        quota: {
          allowed: true,
          used: 0,
          limit: null,
          remaining: null,
          resetAt: null,
          source: "self_hosted" as const,
        },
      };
    }),

  /** Update self-hosted workspace settings. */
  update: orgOwnerProcedure
    .input(z.object({
      name: z.string().min(1).max(255).optional(),
      domain: z.string().max(255).optional(),
      logoUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      await updateOrganization(orgId, input);
      try {
        await appendAuditLog({
          eventType: "org.updated",
          entityType: "organization",
          entityId: orgId,
          organizationId: orgId,
          actorUserId: ctx.user.id,
          metadata: { updates: input },
        });
      } catch (e) {
        console.error("[AUDIT_LOG_FAILURE] org.updated failed:", e);
      }
      return { success: true };
    }),

  /** List active IP restrictions for the self-hosted workspace. */
  getIpRestrictions: orgOwnerProcedure.query(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    return getActiveAllowedIps(orgId);
  }),

  /** Add an allowed IP address. */
  addAllowedIp: orgOwnerProcedure
    .input(z.object({
      ipAddress: z.string().min(1).max(45),
      label: z.string().max(255).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      return createAllowedIp({
        organizationId: orgId,
        ipAddress: input.ipAddress,
        label: input.label ?? null,
        createdByUserId: ctx.user.id,
      });
    }),

  /** Remove an allowed IP entry. */
  removeAllowedIp: orgOwnerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      await deactivateAllowedIp(input.id, orgId);
      return { success: true };
    }),

  listIntegrationApiKeys: orgOwnerProcedure.query(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const rows = await db.select().from(integrationApiKeys).where(eq(integrationApiKeys.organizationId, orgId));
    return rows.map(key => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: normalizeScopes(key.scopes),
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
      createdAt: key.createdAt,
    }));
  }),

  createIntegrationApiKey: orgOwnerProcedure
    .input(createIntegrationApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const generated = generateApiKey();
      const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
      const result = await db.insert(integrationApiKeys).values({
        organizationId: orgId,
        createdByUserId: ctx.user.id,
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
        organizationId: orgId,
        actorUserId: ctx.user.id,
        metadata: { source: "staff_ui", name: input.name, scopes: input.scopes, expiresAt: expiresAt.toISOString() },
      });
      return { id, apiKey: generated.apiKey, keyPrefix: generated.prefix, expiresAt };
    }),

  revokeIntegrationApiKey: orgOwnerProcedure
    .input(z.object({ id: z.number(), confirm: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.update(integrationApiKeys).set({ revokedAt: new Date() }).where(and(
        eq(integrationApiKeys.id, input.id),
        eq(integrationApiKeys.organizationId, orgId),
        isNull(integrationApiKeys.revokedAt),
      ));
      await appendAuditLog({
        eventType: "integration.api_key.revoked",
        entityType: "integration_api_key",
        entityId: input.id,
        organizationId: orgId,
        actorUserId: ctx.user.id,
        metadata: { source: "staff_ui" },
      });
      return { success: true };
    }),
});
