import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { orgProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createTemplate, getTemplateById, getPublicTemplates,
  updateTemplate, deleteTemplate,
  upsertTemplateFields, getTemplateFieldsByTemplate,
} from "../db";
import {
  documentTitleSchema, documentDescriptionSchema,
  ALLOWED_MIME_TYPES, MAX_FILE_SIZE,
  signatureFieldsArraySchema,
  validatePdfMagicNumber,
} from "@shared/validation";
import { storagePut } from "../storage";
import { validatePdf } from "../pdf";
import { appendAuditLog } from "../auditLog";

/** Ensure member-role users can only manage their own templates */
function assertTemplateAccess(tmpl: { userId: number | null }, orgRole: string, userId: number) {
  if (orgRole === "member" && tmpl.userId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "errors.templates.ownTemplatesOnly" });
  }
}

export const templatesRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    const { getTemplatesByOrg } = await import("../db");
    return getTemplatesByOrg(orgId);
  }),

  getById: orgProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const tmpl = await getTemplateById(input.id);
      if (!tmpl || (tmpl.organizationId !== orgId && !tmpl.isPublic)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.templates.notFound" });
      }
      const fields = await getTemplateFieldsByTemplate(input.id);
      return { ...tmpl, templateFields: fields };
    }),

  public: publicProcedure.query(async () => {
    return getPublicTemplates();
  }),

  create: orgProcedure
    .input(z.object({
      title: documentTitleSchema,
      description: documentDescriptionSchema,
      category: z.string().max(100).optional(),
      isPublic: z.boolean().optional(),
      signerCount: z.number().int().min(1).max(20).optional(),
      defaultExpirationDays: z.number().int().min(1).max(365).nullable().optional(),
      defaultReminderDays: z.number().int().min(1).max(30).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;

      const id = await createTemplate({
        userId: ctx.user!.id,
        organizationId: orgId,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? null,
        isPublic: input.isPublic ?? false,
        signerCount: input.signerCount ?? 1,
        defaultExpirationDays: input.defaultExpirationDays ?? null,
        defaultReminderDays: input.defaultReminderDays ?? null,
      });
      try {
        await appendAuditLog({
          eventType: "template.created",
          entityType: "template",
          entityId: id,
          organizationId: orgId,
          actorUserId: ctx.user!.id,
          metadata: { title: input.title },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] template.created failed:", e); }
      return { id };
    }),

  uploadPdf: orgProcedure
    .input(z.object({
      templateId: z.number(),
      fileName: z.string().min(1),
      fileBase64: z.string().min(1),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const tmpl = await getTemplateById(input.templateId);
      if (!tmpl || tmpl.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.templates.notFound" });
      }
      assertTemplateAccess(tmpl, orgRole, ctx.user!.id);
      if (!ALLOWED_MIME_TYPES.includes(input.mimeType as any)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.templates.pdfOnly" });
      }
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.templates.fileTooLarge" });
      }
      // Magic number check: reject MIME-spoofed files
      const magicCheck = validatePdfMagicNumber(buffer);
      if (!magicCheck.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.templates.invalidPdf" });
      }
      const validation = await validatePdf(buffer);
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.templates.invalidPdf" });
      }
      const suffix = nanoid(8);
      const fileKey = `organizations/${orgId}/templates/${Date.now()}-${suffix}.pdf`;
      const { url } = await storagePut(fileKey, buffer, "application/pdf");
      await updateTemplate(input.templateId, {
        fileUrl: url,
        fileKey,
        fileName: input.fileName,
        pageCount: validation.pageCount ?? 0,
      });
      return { url, fileKey, pageCount: validation.pageCount ?? 0 };
    }),

  /** Save template signature field positions (normalized table) */
  saveFields: orgProcedure
    .input(z.object({
      templateId: z.number(),
      fields: signatureFieldsArraySchema,
      signerCount: z.number().int().min(1).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const tmpl = await getTemplateById(input.templateId);
      if (!tmpl || tmpl.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.templates.notFound" });
      }
      assertTemplateAccess(tmpl, orgRole, ctx.user!.id);
      await upsertTemplateFields(input.templateId, input.fields.map(f => ({
        templateId: input.templateId,
        clientId: f.id,
        page: f.page,
        xPercent: f.x,
        yPercent: f.y,
        widthPercent: f.width,
        heightPercent: f.height,
        signerIndex: f.signerIndex,
        type: f.type,
        label: f.label ?? null,
        required: true,
      })));
      await updateTemplate(input.templateId, { signerCount: input.signerCount });
      return { success: true };
    }),

  update: orgProcedure
    .input(z.object({
      id: z.number(),
      title: documentTitleSchema.optional(),
      description: documentDescriptionSchema,
      category: z.string().max(100).optional(),
      isPublic: z.boolean().optional(),
      defaultExpirationDays: z.number().int().min(1).max(365).nullable().optional(),
      defaultReminderDays: z.number().int().min(1).max(30).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const tmpl = await getTemplateById(input.id);
      if (!tmpl || tmpl.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.templates.notFound" });
      }
      assertTemplateAccess(tmpl, orgRole, ctx.user!.id);
      const { id, ...data } = input;
      await updateTemplate(id, data);
      try {
        await appendAuditLog({
          eventType: "template.updated",
          entityType: "template",
          entityId: id,
          organizationId: orgId,
          actorUserId: ctx.user!.id,
          metadata: { title: input.title },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] template.updated failed:", e); }
      return { success: true };
    }),

  delete: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const tmpl = await getTemplateById(input.id);
      if (!tmpl || tmpl.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.templates.notFound" });
      }
      assertTemplateAccess(tmpl, orgRole, ctx.user!.id);
      await deleteTemplate(input.id);
      try {
        await appendAuditLog({
          eventType: "template.deleted",
          entityType: "template",
          entityId: input.id,
          organizationId: orgId,
          actorUserId: ctx.user!.id,
          metadata: { title: tmpl.title },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] template.deleted failed:", e); }
      return { success: true };
    }),
});
