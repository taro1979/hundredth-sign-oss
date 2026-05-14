import { z } from "zod";
import { orgManagerProcedure, router } from "../_core/trpc";
import { getAuditLogsPaginated, getAuditLogCount, verifyHashChainIntegrity, getAuditLogsByEntity } from "../auditLog";
import { getCertificateInfo } from "../platformSignature";

export const auditLogRouter = router({
  /** Get paginated audit logs with filters (org owner/manager) */
  list: orgManagerProcedure
    .input(z.object({
      eventType: z.string().optional(),
      entityType: z.string().optional(),
      startMs: z.number().optional(),
      endMs: z.number().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      return getAuditLogsPaginated({ ...input, organizationId: orgId });
    }),

  /** Get audit log count (org owner/manager) */
  count: orgManagerProcedure.query(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    return { count: await getAuditLogCount(orgId) };
  }),

  /** Verify hash chain integrity (org owner/manager) */
  verifyIntegrity: orgManagerProcedure.mutation(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    return verifyHashChainIntegrity(orgId);
  }),

  /** Get audit logs for a specific entity (org owner/manager) */
  byEntity: orgManagerProcedure
    .input(z.object({
      entityType: z.string(),
      entityId: z.number(),
      limit: z.number().int().min(1).max(500).default(100),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      return getAuditLogsByEntity(input.entityType as any, input.entityId, orgId, input.limit);
    }),

  /** Get platform certificate info (org owner/manager) */
  certificateInfo: orgManagerProcedure.query(async ({ ctx }) => {
    return getCertificateInfo();
  }),
});
