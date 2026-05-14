import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";

/** Bcrypt cost factor — 12 rounds balances security and latency (~250ms). */
const BCRYPT_ROUNDS = 12;

import { orgProcedure, router } from "../_core/trpc";
import {
  createDocument, getDocumentById, updateDocument, deleteDocument,
  upsertSignatureFields, getSignatureFieldsByDocument,
  createSignatureRequest, createSignatureRequestsBulk, getSignatureRequestsByDocument,
  updateSignatureRequest, deleteSignatureRequestsByDocument,
  getTemplateById, deepCopyTemplateToDocument, incrementTemplateUsage,
  createActivityLog, getActivityLogsByDocument,
  createInternalApprovalsBulk, getInternalApprovalsByDocument,
  deleteInternalApprovalsByDocument, getNextPendingApprover,
  getPendingSignatureRequests,
  getOrganizationById,
} from "../db";
import {
  documentTitleSchema, documentDescriptionSchema,
  ALLOWED_MIME_TYPES, MAX_FILE_SIZE,
  signatureFieldsArraySchema,
  emailSchema, nameSchema,
  validatePdfMagicNumber,
} from "@shared/validation";
import { storagePut } from "../storage";
import { validatePdf } from "../pdf";
import { sendEmail, buildSignatureRequestEmail, buildCcNotificationEmail, buildInternalApprovalEmail, buildReminderEmail, resolveEmailLocale } from "../email";
import { appendAuditLog } from "../auditLog";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { documents } from "../../drizzle/schema";
import { getAppUrlOrThrow } from "./_helpers";
import { wormRecords as wormRecordsTable } from "../../drizzle/schema";
import { generateProxyToken } from "../storageEncryption";
import { storageGet } from "../storage";

/** Ensure member-role users can only manage their own documents */
function assertDocumentAccess(doc: { userId: number | null }, orgRole: string, userId: number) {
  if (orgRole === "member" && doc.userId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "errors.documents.ownDocumentsOnly",
    });
  }
}

export const documentsRouter = router({
  list: orgProcedure
    .query(async ({ ctx }) => {
      const orgId = (ctx as any).org.organizationId;
      const orgRole = (ctx as any).org.membership?.role as string;
      const { getDocumentsByOrg } = await import("../db");
      // member can only see their own documents; owner/manager see all
      const userId = orgRole === "member" ? ctx.user!.id : undefined;
      return getDocumentsByOrg(orgId, userId);
    }),

  getById: orgProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId;
      const orgRole = (ctx as any).org.membership?.role as string;
      const doc = await getDocumentById(input.id);
      if (!doc || doc.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      assertDocumentAccess(doc, orgRole, ctx.user!.id);
      const fields = await getSignatureFieldsByDocument(input.id);
      const requests = await getSignatureRequestsByDocument(input.id);
      const logs = await getActivityLogsByDocument(input.id);
      const internalApprovals = await getInternalApprovalsByDocument(input.id);
      return { ...doc, signatureFields: fields, signatureRequests: requests, activityLogs: logs, internalApprovals };
    }),

  create: orgProcedure
    .input(z.object({
      title: documentTitleSchema,
      description: documentDescriptionSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const id = await createDocument({
        userId: ctx.user!.id,
        organizationId: orgId,
        title: input.title,
        description: input.description ?? null,
        status: "draft",
      });
      await createActivityLog({
        organizationId: orgId,
        documentId: id,
        userId: ctx.user!.id,
        action: "document_created",
        details: JSON.stringify({ key: "activity.documentCreated", title: input.title }),
      });
      try {
        await appendAuditLog({
          eventType: "document.created",
          entityType: "document",
          entityId: id,
          organizationId: orgId,
          actorUserId: ctx.user!.id,
          metadata: { title: input.title },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] document.created failed:", e); }
      return { id };
    }),

  /** Create document from template (deep copy) */
  createFromTemplate: orgProcedure
    .input(z.object({
      templateId: z.number(),
      title: documentTitleSchema,
      description: documentDescriptionSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const tmpl = await getTemplateById(input.templateId);
      if (!tmpl) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.templates.notFound" });
      }
      // Only allow access to templates in the same org or public templates
      if (tmpl.organizationId !== orgId && !tmpl.isPublic) {
        throw new TRPCError({ code: "FORBIDDEN", message: "errors.templates.accessDenied" });
      }
      // Create document with template's PDF
      const docId = await createDocument({
        userId: ctx.user!.id,
        organizationId: orgId,
        title: input.title,
        description: input.description ?? tmpl.description ?? null,
        fileUrl: tmpl.fileUrl,
        fileKey: tmpl.fileKey,
        fileName: tmpl.fileName,
        pageCount: tmpl.pageCount ?? 0,
        sourceTemplateId: tmpl.id,
        expirationDays: tmpl.defaultExpirationDays,
        reminderDays: tmpl.defaultReminderDays,
        status: "draft",
      });
      // Deep copy template fields → document signature fields
      await deepCopyTemplateToDocument(tmpl.id, docId);
      await incrementTemplateUsage(tmpl.id);
      await createActivityLog({
        organizationId: orgId,
        documentId: docId,
        userId: ctx.user!.id,
        action: "document_created_from_template",
        details: JSON.stringify({ key: "activity.documentCreatedFromTemplate", title: tmpl.title }),
      });
      try {
        await appendAuditLog({
          eventType: "document.created",
          entityType: "document",
          entityId: docId,
          organizationId: orgId,
          actorUserId: ctx.user!.id,
          metadata: { title: input.title, sourceTemplateId: tmpl.id },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] document.created (template) failed:", e); }
      return { id: docId };
    }),

  uploadPdf: orgProcedure
    .input(z.object({
      documentId: z.number(),
      fileName: z.string().min(1),
      fileBase64: z.string().min(1),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const doc = await getDocumentById(input.documentId);
      if (!doc || doc.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      assertDocumentAccess(doc, orgRole, ctx.user!.id);
      if (doc.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.draftOnlyPdf" });
      }
      if (!ALLOWED_MIME_TYPES.includes(input.mimeType as any)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.pdfOnly" });
      }
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.fileTooLarge" });
      }
      // Magic number check: reject files that claim to be PDF but aren't (MIME spoofing guard)
      const magicCheck = validatePdfMagicNumber(buffer);
      if (!magicCheck.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.invalidPdf" });
      }
      const validation = await validatePdf(buffer);
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.invalidPdf" });
      }
      const suffix = nanoid(8);
      const fileKey = `organizations/${orgId}/documents/${Date.now()}-${suffix}.pdf`;
      const { url } = await storagePut(fileKey, buffer, "application/pdf");
      await updateDocument(input.documentId, {
        fileUrl: url,
        fileKey,
        fileName: input.fileName,
        fileSize: buffer.length,
        mimeType: input.mimeType,
        pageCount: validation.pageCount ?? 0,
      });
      try {
        await appendAuditLog({
          eventType: "document.uploaded",
          entityType: "document",
          entityId: input.documentId,
          organizationId: doc.organizationId ?? undefined,
          actorUserId: ctx.user!.id,
          metadata: { fileName: input.fileName, fileSize: buffer.length, pageCount: validation.pageCount },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] document.uploaded failed:", e); }
      return { url, fileKey, pageCount: validation.pageCount ?? 0 };
    }),

  /** Save signature field positions (draft save) */
  saveFields: orgProcedure
    .input(z.object({
      documentId: z.number(),
      fields: signatureFieldsArraySchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const doc = await getDocumentById(input.documentId);
      if (!doc || doc.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      assertDocumentAccess(doc, orgRole, ctx.user!.id);
      if (doc.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.sentNotEditable" });
      }
      await upsertSignatureFields(input.documentId, input.fields.map(f => ({
        documentId: input.documentId,
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
      return { success: true };
    }),

  /** Update document metadata (title, description, settings) */
  update: orgProcedure
    .input(z.object({
      id: z.number(),
      title: documentTitleSchema.optional(),
      description: documentDescriptionSchema,
      sequentialRouting: z.boolean().optional(),
      expirationDays: z.number().int().min(1).max(365).nullable().optional(),
      reminderDays: z.number().int().min(1).max(30).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const doc = await getDocumentById(input.id);
      if (!doc || doc.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      // Members can only update their own documents; owner/manager can update any
      if (orgRole === "member" && doc.userId !== ctx.user!.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "errors.documents.noEditPermission" });
      }
      if (doc.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.sentNotEditable" });
      }
      const { id, ...data } = input;
      await updateDocument(id, data);
      return { success: true };
    }),

  /** Send document for signing */
  sendForSignature: orgProcedure
    .input(z.object({
      documentId: z.number(),
      signers: z.array(z.object({
        email: emailSchema,
        name: nameSchema,
        order: z.number().int().min(0).default(1),
        role: z.enum(["signer", "cc"]).default("signer"),
        accessCode: z.string().max(50).optional(),
        message: z.string().max(1000).optional(),
        locale: z.string().max(10).default("ja"),
      })).min(1).max(20),
      sequentialRouting: z.boolean().default(false),
      expirationDays: z.number().int().min(1).max(365).nullable().optional(),
      reminderDays: z.number().int().min(1).max(30).nullable().optional(),
      internalApproval: z.object({
        approvers: z.array(z.object({
          email: emailSchema,
          name: nameSchema,
          order: z.number().int().min(1),
        })).min(1).max(10),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const doc = await getDocumentById(input.documentId);
      if (!doc || doc.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      assertDocumentAccess(doc, orgRole, ctx.user!.id);
      if (doc.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.draftOnlySend" });
      }
      if (!doc.fileUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.pdfRequired" });
      }
      // Validate that at least one signer exists
      const signers = input.signers.filter(s => s.role === "signer");
      if (signers.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.signerRequired" });
      }
      // Validate signature fields exist for each signer
      const fields = await getSignatureFieldsByDocument(input.documentId);
      const signerIndices = new Set(fields.map(f => f.signerIndex));
      for (let i = 0; i < signers.length; i++) {
        if (!signerIndices.has(i)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "errors.documents.signerFieldRequired",
          });
        }
      }

      // Calculate expiration
      const expiresAt = input.expirationDays
        ? new Date(Date.now() + input.expirationDays * 24 * 60 * 60 * 1000)
        : null;
      const nextReminderAt = input.reminderDays
        ? new Date(Date.now() + input.reminderDays * 24 * 60 * 60 * 1000)
        : null;

      // Delete existing requests (re-send scenario)
      await deleteSignatureRequestsByDocument(input.documentId);

      // Create signature requests
      // Hash access codes with bcrypt sequentially to avoid blocking the event loop.
      // bcrypt.hash (12 rounds) is CPU-intensive; running N hashes in parallel via
      // Promise.all starves the libuv thread-pool and blocks all other I/O (DoS risk).
      const requestsData: Array<{
        documentId: number;
        signerEmail: string;
        signerName: string;
        recipientRole: "signer" | "cc";
        order: number;
        status: "pending";
        accessToken: string;
        accessCode: string | null;
        message: string | null;
        locale: string;
      }> = [];
      for (const s of input.signers) {
        requestsData.push({
          documentId: input.documentId,
          signerEmail: s.email,
          signerName: s.name,
          recipientRole: s.role as "signer" | "cc",
          order: s.order,
          status: "pending" as const,
          accessToken: nanoid(48),
          accessCode: s.accessCode ? await bcrypt.hash(s.accessCode, BCRYPT_ROUNDS) : null,
          message: s.message || null,
          locale: s.locale || "ja",
        });
      }
      await createSignatureRequestsBulk(requestsData);

      // Handle internal approval flow
      const hasInternalApproval = input.internalApproval && input.internalApproval.approvers.length > 0;
      const issuerLocale = resolveEmailLocale(ctx.user.locale);

      if (hasInternalApproval) {
        // Create internal approval records
        await deleteInternalApprovalsByDocument(input.documentId);
        const approvalData = input.internalApproval!.approvers.map(a => ({
          documentId: input.documentId,
          approverEmail: a.email,
          approverName: a.name,
          order: a.order,
          status: "pending" as const,
          accessToken: nanoid(48),
          locale: issuerLocale,
        }));
        await createInternalApprovalsBulk(approvalData);

        // Set document status to pending_internal_approval
        await updateDocument(input.documentId, {
          status: "pending_internal_approval",
          sequentialRouting: input.sequentialRouting,
          expirationDays: input.expirationDays ?? null,
          reminderDays: input.reminderDays ?? null,
          expiresAt,
          nextReminderAt,
        });

        // Send approval request to first approver
        const firstApprover = await getNextPendingApprover(input.documentId);
        if (firstApprover) {
          const baseUrl = getAppUrlOrThrow(ctx.req);
          const approvalLang = resolveEmailLocale(firstApprover.locale);
          const approveUrl = `${baseUrl}/approve/${firstApprover.accessToken}?lng=${approvalLang}`;
          const emailContent = buildInternalApprovalEmail({
            approverName: firstApprover.approverName || firstApprover.approverEmail,
            senderName: ctx.user.name || "送信者",
            documentTitle: doc.title,
            approveUrl,
            lang: approvalLang,
          });
          await sendEmail({
            to: firstApprover.approverEmail,
            toName: firstApprover.approverName || undefined,
            ...emailContent,
            type: "signature_request",
            documentId: input.documentId,
          });
        }

        await createActivityLog({
          organizationId: orgId,
          documentId: input.documentId,
          userId: ctx.user.id,
          action: "internal_approval_started",
          details: JSON.stringify({ key: "activity.internalApprovalStarted", count: input.internalApproval!.approvers.length }),
        });

        return { success: true, requestCount: requestsData.length, pendingApproval: true };
      }

      // No internal approval - send directly
      // Update document status and settings
      await updateDocument(input.documentId, {
        status: "sent",
        sequentialRouting: input.sequentialRouting,
        expirationDays: input.expirationDays ?? null,
        reminderDays: input.reminderDays ?? null,
        expiresAt,
        nextReminderAt,
      });

      // Re-fetch created requests to get their IDs and tokens
      const createdRequests = await getSignatureRequestsByDocument(input.documentId);
      const owner = ctx.user;
      const baseUrl = getAppUrlOrThrow(ctx.req);

      if (input.sequentialRouting) {
        // Sequential: only send to first signer
        const firstSigner = createdRequests.find(r => r.recipientRole === "signer");
        if (firstSigner) {
          await updateSignatureRequest(firstSigner.id, { status: "sent" });
          const lang = resolveEmailLocale(firstSigner.locale);
          const signUrl = `${baseUrl}/sign/${firstSigner.accessToken}?lng=${lang}`;
          const emailContent = buildSignatureRequestEmail({
            signerName: firstSigner.signerName || firstSigner.signerEmail,
            senderName: owner.name || "送信者",
            documentTitle: doc.title,
            message: firstSigner.message || undefined,
            signUrl,
            lang,
          });
          await sendEmail({
            to: firstSigner.signerEmail,
            toName: firstSigner.signerName || undefined,
            ...emailContent,
            type: "signature_request",
            documentId: input.documentId,
            signatureRequestId: firstSigner.id,
          });
        }
        // Send CC notifications
        for (const cc of createdRequests.filter(r => r.recipientRole === "cc")) {
          try {
            await updateSignatureRequest(cc.id, { status: "sent" });
            const ccDashboardUrl = `${baseUrl}/dashboard`;
            const ccEmailContent = buildCcNotificationEmail({
              ccName: cc.signerName || cc.signerEmail,
              senderName: owner.name || "送信者",
              documentTitle: doc.title,
              dashboardUrl: ccDashboardUrl,
              lang: resolveEmailLocale(cc.locale),
            });
            await sendEmail({
              to: cc.signerEmail,
              toName: cc.signerName || undefined,
              ...ccEmailContent,
              type: "signature_request",
              documentId: input.documentId,
              signatureRequestId: cc.id,
            });
          } catch (ccErr) {
            console.error(`[SendForSignature] CC email to ${cc.signerEmail} failed (non-fatal):`, ccErr);
          }
        }
      } else {
        // Parallel: send to all signers at once
        // AC-004 fix-email-notification: use Promise.allSettled to isolate email failures
        const emailSendTasks = createdRequests.map(async (req) => {
          if (req.recipientRole === "signer") {
            await updateSignatureRequest(req.id, { status: "sent" });
            const lang = resolveEmailLocale(req.locale);
            const signUrl = `${baseUrl}/sign/${req.accessToken}?lng=${lang}`;
            const emailContent = buildSignatureRequestEmail({
              signerName: req.signerName || req.signerEmail,
              senderName: owner.name || "送信者",
              documentTitle: doc.title,
              message: req.message || undefined,
              signUrl,
              lang,
            });
            await sendEmail({
              to: req.signerEmail,
              toName: req.signerName || undefined,
              ...emailContent,
              type: "signature_request",
              documentId: input.documentId,
              signatureRequestId: req.id,
            });
          } else {
            // CC受信者への通知メール送信
            await updateSignatureRequest(req.id, { status: "sent" });
            const ccDashboardUrl = `${baseUrl}/dashboard`;
            const ccEmailContent = buildCcNotificationEmail({
              ccName: req.signerName || req.signerEmail,
              senderName: owner.name || "送信者",
              documentTitle: doc.title,
              dashboardUrl: ccDashboardUrl,
              lang: resolveEmailLocale(req.locale),
            });
            await sendEmail({
              to: req.signerEmail,
              toName: req.signerName || undefined,
              ...ccEmailContent,
              type: "signature_request",
              documentId: input.documentId,
              signatureRequestId: req.id,
            });
          }
        });
        const emailResults = await Promise.allSettled(emailSendTasks);
        const emailFailures = emailResults.filter(r => r.status === "rejected");
        if (emailFailures.length > 0) {
          console.error(`[SendForSignature] ${emailFailures.length}/${createdRequests.length} emails failed (non-fatal):`,
            emailFailures.map(r => (r as PromiseRejectedResult).reason));
        }
      }

      await createActivityLog({
        organizationId: orgId,
        documentId: input.documentId,
        userId: ctx.user!.id,
        action: "document_sent",
        details: JSON.stringify({ key: "activity.documentSent", count: createdRequests.length }),
      });

      try {
        await appendAuditLog({
          eventType: "document.sent",
          entityType: "document",
          entityId: input.documentId,
          organizationId: doc.organizationId ?? undefined,
          actorUserId: ctx.user.id,
          metadata: { recipientCount: createdRequests.length, sequentialRouting: input.sequentialRouting },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] document.sent failed:", e); }
      return { success: true, requestCount: createdRequests.length };
    }),

  /** Void (cancel) a sent document */
  void: orgProcedure
    .input(z.object({ id: z.number(), reason: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const doc = await getDocumentById(input.id);
      if (!doc || doc.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      // Members can only void their own documents
      if (orgRole === "member" && doc.userId !== ctx.user!.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "errors.documents.noVoidPermission" });
      }
      if (!["sent", "declined"].includes(doc.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.voidStatusInvalid" });
      }
      await updateDocument(input.id, { status: "voided" });
      await createActivityLog({
        organizationId: orgId,
        documentId: input.id,
        userId: ctx.user!.id,
        action: "document_voided",
        details: input.reason
          ? JSON.stringify({ key: "activity.documentVoidedWithReason", reason: input.reason })
          : JSON.stringify({ key: "activity.documentVoided" }),
      });
      try {
        await appendAuditLog({
          eventType: "document.voided",
          entityType: "document",
          entityId: input.id,
          organizationId: orgId,
          actorUserId: ctx.user!.id,
          metadata: { reason: input.reason },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] document.voided failed:", e); }
      return { success: true };
    }),

  delete: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const doc = await getDocumentById(input.id);
      if (!doc || doc.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      // Members can only delete their own documents; owner/manager can delete any
      if (orgRole === "member" && doc.userId !== ctx.user!.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "errors.documents.noDeletePermission" });
      }
      await deleteInternalApprovalsByDocument(input.id);
      await deleteDocument(input.id);
      try {
        await appendAuditLog({
          eventType: "document.deleted",
          entityType: "document",
          entityId: input.id,
          organizationId: orgId,
          actorUserId: ctx.user!.id,
          metadata: { title: doc.title },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] document.deleted failed:", e); }
      return { success: true };
    }),

  /** Resend reminder to pending signers */
  resendReminder: orgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const doc = await getDocumentById(input.id);
      if (!doc || doc.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      // Members can only send reminders for their own documents
      if (orgRole === "member" && doc.userId !== ctx.user!.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "errors.documents.noReminderPermission" });
      }
      if (doc.status !== "sent") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.reminderStatusInvalid" });
      }
      const pendingRequests = await getPendingSignatureRequests(input.id);
      if (pendingRequests.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.noUnsignedRecipients" });
      }
      const baseUrl = getAppUrlOrThrow(ctx.req);
      const senderName = ctx.user!.name || "送信者";
      for (const req of pendingRequests) {
        const lang = resolveEmailLocale(req.locale);
        const signUrl = `${baseUrl}/sign/${req.accessToken}?lng=${lang}`;
        const emailContent = buildReminderEmail({
          signerName: req.signerName || req.signerEmail,
          senderName,
          documentTitle: doc.title,
          signUrl,
          lang,
        });
        await sendEmail({
          to: req.signerEmail,
          toName: req.signerName || undefined,
          ...emailContent,
          type: "reminder",
          documentId: input.id,
          signatureRequestId: req.id,
        });
      }
      await createActivityLog({
        organizationId: orgId,
        documentId: input.id,
        userId: ctx.user!.id,
        action: "reminder_sent",
        details: JSON.stringify({ key: "activity.reminderSent", count: pendingRequests.length }),
      });
      return { success: true, sentCount: pendingRequests.length };
    }),

  /** Download signed PDF (supports AES-256-GCM encrypted WORM storage) */
  downloadSigned: orgProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const orgRole = (ctx as any).org.membership?.role as string;
      const doc = await getDocumentById(input.id);
      if (!doc || doc.organizationId !== orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      assertDocumentAccess(doc, orgRole, ctx.user!.id);
      if (!doc.signedFileUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.signedPdfNotReady" });
      }
      // Check if the WORM record is encrypted → return proxy URL
      if (doc.signedFileKey) {
        const db = await getDb();
        if (db) {
          const [wr] = await db.select({ encryptionIv: wormRecordsTable.encryptionIv })
            .from(wormRecordsTable)
            .where(eq(wormRecordsTable.storageKey, doc.signedFileKey))
            .limit(1);
          if (wr?.encryptionIv) {
            const token = generateProxyToken(doc.signedFileKey);
            return { url: `/api/pdf-proxy/${encodeURIComponent(doc.signedFileKey)}?token=${token}` };
          }
        }
        // Non-encrypted: get fresh presigned URL from storage
        const { url } = await storageGet(doc.signedFileKey);
        return { url };
      }
      // Legacy: no signedFileKey, use stored URL directly
      return { url: doc.signedFileUrl };
    }),
});
