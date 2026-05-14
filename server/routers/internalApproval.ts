import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getDocumentById, updateDocument,
  getSignatureRequestsByDocument, updateSignatureRequest,
  getInternalApprovalByToken, getInternalApprovalsByDocument, updateInternalApproval,
  checkAllApproversApproved, getNextPendingApprover,
  createActivityLog, getMembership,
  getOrganizationById, getUserById,
} from "../db";
import {
  sendEmail, buildSignatureRequestEmail, buildCcNotificationEmail,
  buildInternalApprovalEmail, resolveEmailLocale,
} from "../email";
import { appendAuditLog } from "../auditLog";
import { getAppUrlOrThrow } from "./_helpers";

export const internalApprovalRouter = router({
  /** Get approval info by access token */
  getByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const approval = await getInternalApprovalByToken(input.token);
      if (!approval) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.approvals.notFound" });
      }
      const doc = await getDocumentById(approval.documentId);
      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      // AC-007 fix-security-hardening: block access for deactivated organizations
      if (doc.organizationId) {
        const org = await getOrganizationById(doc.organizationId);
        if (org && !(org as any).isActive) {
          throw new TRPCError({ code: "FORBIDDEN", message: "errors.organization.disabled" });
        }
      }
      const allApprovals = await getInternalApprovalsByDocument(approval.documentId);
      return {
        approval: {
          id: approval.id,
          approverEmail: approval.approverEmail,
          approverName: approval.approverName,
          order: approval.order,
          status: approval.status,
          comment: approval.comment,
          decidedAt: approval.decidedAt,
          locale: approval.locale,
        },
        document: {
          id: doc.id,
          title: doc.title,
          description: doc.description,
          status: doc.status,
          fileUrl: doc.fileUrl,
        },
        allApprovals: allApprovals.map(a => ({
          id: a.id,
          approverName: a.approverName,
          approverEmail: a.approverEmail,
          order: a.order,
          status: a.status,
          decidedAt: a.decidedAt,
        })),
      };
    }),

  /** Approve or reject */
  decide: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      decision: z.enum(["approved", "rejected"]),
      comment: z.string().max(2000).optional(),
    }).refine(
      (data) => data.decision !== "rejected" || (data.comment && data.comment.trim().length > 0),
      { message: "errors.approvals.reasonRequired", path: ["comment"] },
    ))
    .mutation(async ({ input, ctx }) => {
      const approval = await getInternalApprovalByToken(input.token);
      if (!approval) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.approvals.notFound" });
      }
      // Idempotency guard (M-2): if same decision was already made, return success
      if (approval.status === input.decision) {
        return { success: true, decision: input.decision, allApproved: false };
      }
      if (approval.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.approvals.alreadyProcessed" });
      }
      const doc = await getDocumentById(approval.documentId);
      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      // AC-009 fix-security-hardening: block for deactivated organizations
      if (doc.organizationId) {
        const org = await getOrganizationById(doc.organizationId);
        if (org && !(org as any).isActive) {
          throw new TRPCError({ code: "FORBIDDEN", message: "errors.organization.disabled" });
        }
      }

      // Update approval record
      await updateInternalApproval(approval.id, {
        status: input.decision,
        comment: input.comment || null,
        decidedAt: new Date(),
      });

      await createActivityLog({
        organizationId: doc.organizationId,
        documentId: approval.documentId,
        action: input.decision === "approved" ? "internal_approval_approved" : "internal_approval_rejected",
        details: input.comment
          ? JSON.stringify({ key: input.decision === "approved" ? "activity.internalApprovalApproved" : "activity.internalApprovalRejectedWithComment", approver: approval.approverName || approval.approverEmail, comment: input.comment })
          : JSON.stringify({ key: input.decision === "approved" ? "activity.internalApprovalApproved" : "activity.internalApprovalRejected", approver: approval.approverName || approval.approverEmail }),
      });
      try {
        await appendAuditLog({
          eventType: input.decision === "approved" ? "approval.approved" : "approval.rejected",
          entityType: "document",
          entityId: approval.documentId,
          organizationId: doc.organizationId ?? undefined,
          actorEmail: approval.approverEmail,
          metadata: { approvalId: approval.id, decision: input.decision, comment: input.comment },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] approval.decide failed:", e); }

      if (input.decision === "rejected") {
        // Rejection: set document back to draft
        await updateDocument(approval.documentId, { status: "draft" });
        await createActivityLog({
          organizationId: doc.organizationId,
          documentId: approval.documentId,
          action: "internal_approval_rejected",
          details: JSON.stringify({ key: "activity.internalApprovalRejectedRevert" }),
        });
        return { success: true, decision: "rejected" as const, allApproved: false };
      }

      // Approved: check if all approvers have approved
      const allApproved = await checkAllApproversApproved(approval.documentId);
      const owner = doc.userId ? await getUserById(doc.userId) : null;
      const senderName = owner?.name || "送信者";

      if (allApproved) {
        // FR-003 fix-quality-improvements: race condition guard — skip if already sent
        const freshDoc = await getDocumentById(approval.documentId);
        if (freshDoc?.status === "sent") {
          return { success: true, decision: "approved" as const, allApproved: true };
        }

        // All approved! Now send to external signers
        const requests = await getSignatureRequestsByDocument(approval.documentId);
        const baseUrl = getAppUrlOrThrow(ctx.req);

        await updateDocument(approval.documentId, { status: "sent" });

        if (doc.sequentialRouting) {
          const firstSigner = requests.find(r => r.recipientRole === "signer");
          if (firstSigner) {
            await updateSignatureRequest(firstSigner.id, { status: "sent" });
            const lang = resolveEmailLocale(firstSigner.locale);
            const signUrl = `${baseUrl}/sign/${firstSigner.accessToken}?lng=${lang}`;
            const emailContent = buildSignatureRequestEmail({
              signerName: firstSigner.signerName || firstSigner.signerEmail,
              senderName,
              documentTitle: doc.title,
              signUrl,
              lang,
            });
            await sendEmail({
              to: firstSigner.signerEmail,
              toName: firstSigner.signerName || undefined,
              ...emailContent,
              type: "signature_request",
              documentId: approval.documentId,
              signatureRequestId: firstSigner.id,
            });
          }
          for (const cc of requests.filter(r => r.recipientRole === "cc")) {
            try {
              await updateSignatureRequest(cc.id, { status: "sent" });
              const ccDashboardUrl = `${baseUrl}/dashboard`;
              const ccEmailContent = buildCcNotificationEmail({
                ccName: cc.signerName || cc.signerEmail,
                senderName,
                documentTitle: doc.title,
                dashboardUrl: ccDashboardUrl,
                lang: resolveEmailLocale(cc.locale),
              });
              await sendEmail({
                to: cc.signerEmail,
                toName: cc.signerName || undefined,
                ...ccEmailContent,
                type: "signature_request",
                documentId: approval.documentId,
                signatureRequestId: cc.id,
              });
            } catch (ccErr) {
              console.error(`[InternalApproval] CC email to ${cc.signerEmail} failed (non-fatal):`, ccErr);
            }
          }
        } else {
          // FR-004 fix-quality-improvements: parallel email sending with Promise.allSettled for error isolation
          await Promise.all(requests.map(req => updateSignatureRequest(req.id, { status: "sent" })));
          const emailResults = await Promise.allSettled(requests.map(async (req) => {
            if (req.recipientRole === "signer") {
              const lang = resolveEmailLocale(req.locale);
              const signUrl = `${baseUrl}/sign/${req.accessToken}?lng=${lang}`;
              const emailContent = buildSignatureRequestEmail({
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
                type: "signature_request",
                documentId: approval.documentId,
                signatureRequestId: req.id,
              });
            } else {
              const ccDashboardUrl = `${baseUrl}/dashboard`;
              const ccEmailContent = buildCcNotificationEmail({
                ccName: req.signerName || req.signerEmail,
                senderName,
                documentTitle: doc.title,
                dashboardUrl: ccDashboardUrl,
                lang: resolveEmailLocale(req.locale),
              });
              await sendEmail({
                to: req.signerEmail,
                toName: req.signerName || undefined,
                ...ccEmailContent,
                type: "signature_request",
                documentId: approval.documentId,
                signatureRequestId: req.id,
              });
            }
          }));
          const failures = emailResults.filter((r): r is PromiseRejectedResult => r.status === "rejected");
          if (failures.length > 0) {
            console.warn(`[EMAIL] ${failures.length}/${emailResults.length} emails failed:`,
              failures.map(f => (f.reason as Error)?.message));
          }
        }

        await createActivityLog({
          organizationId: doc.organizationId,
          documentId: approval.documentId,
          action: "document_sent",
          details: JSON.stringify({ key: "activity.documentSentAfterApproval" }),
        });

        return { success: true, decision: "approved" as const, allApproved: true };
      } else {
        // Not all approved yet, send to next approver
        const nextApprover = await getNextPendingApprover(approval.documentId);
        if (nextApprover) {
          const baseUrl = getAppUrlOrThrow(ctx.req);
          const approvalLang = resolveEmailLocale(nextApprover.locale);
          const approveUrl = `${baseUrl}/approve/${nextApprover.accessToken}?lng=${approvalLang}`;
          const emailContent = buildInternalApprovalEmail({
            approverName: nextApprover.approverName || nextApprover.approverEmail,
            senderName,
            documentTitle: doc.title,
            approveUrl,
            lang: approvalLang,
          });
          await sendEmail({
            to: nextApprover.approverEmail,
            toName: nextApprover.approverName || undefined,
            ...emailContent,
            type: "signature_request",
            documentId: approval.documentId,
          });
        }
        return { success: true, decision: "approved" as const, allApproved: false };
      }
    }),

  /** Get approvals for a document (protected, document owner only) */
  listByDocument: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const doc = await getDocumentById(input.documentId);
      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      // Allow access if: (1) creator, or (2) org owner/manager for same org
      let hasAccess = doc.userId === ctx.user.id;
      if (!hasAccess && doc.organizationId) {
        const membership = await getMembership(ctx.user.id, doc.organizationId);
        if (membership && (membership.role === "owner" || membership.role === "manager")) {
          hasAccess = true;
        }
      }
      if (!hasAccess) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.documents.notFound" });
      }
      return getInternalApprovalsByDocument(input.documentId);
    }),
});
