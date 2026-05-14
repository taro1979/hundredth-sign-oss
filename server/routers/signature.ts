import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";

import { publicProcedure, router } from "../_core/trpc";
import {
  getUserById,
  getDocumentById, updateDocument,
  getSignatureFieldsByDocument,
  createSignatureRequest, getSignatureRequestsByDocument,
  getSignatureRequestByToken, updateSignatureRequest,
  checkAllSignersSigned, getNextPendingSigner,
  getOrganizationById,
  createActivityLog,
} from "../db";
import {
  signatureFontSchema,
  declineReasonSchema,
  SIGNATURE_FONT_OPTIONS,
  emailSchema, nameSchema,
} from "@shared/validation";
import { storageGet } from "../storage";
import {
  embedSignaturesIntoPdf, appendCompletionCertificate, applyPdfPermissionLock,
} from "../pdf";
import type { SignatureField as PdfSignatureField, SignatureData as PdfSignatureData, AuditEntry } from "../pdf";
import { generateStampDataUrl } from "../stampService";
import {
  sendEmail,
  buildSignatureRequestEmail, buildSignatureCompleteEmail, buildDeclinedEmail,
  buildAllSignedEmail, buildCcNotificationEmail, resolveEmailLocale,
} from "../email";
import { signPdfWithPlatformKey, getCertificateInfo } from "../platformSignature";
import { wormStorePdf } from "../wormStorage";
import { appendAuditLog } from "../auditLog";
import type { AuditEventType, EntityType } from "../auditLog";
import { getClientIp } from "../clientIp";
import { getDb } from "../db";
import { eq, and, ne } from "drizzle-orm";
import { documents } from "../../drizzle/schema";
import { getAppUrlOrThrow, assertSignerOwnership } from "./_helpers";
import { emailsMatch } from "@shared/email";
import { wormRecords as wormRecordsTable } from "../../drizzle/schema";
import { generateProxyToken } from "../storageEncryption";
import { emitIntegrationEvent } from "../integrations";

export const signatureRouter = router({
  /** Get signing info by access token */
  getByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const result = await getSignatureRequestByToken(input.token);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "signing.errors.requestNotFound" });
      }
      const { request, document } = result;
      if (["voided", "expired", "declined"].includes(document.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.documents.voided" });
      }

      // AC-006 fix-authorization-idor: block signing for deactivated organizations
      if (document.organizationId) {
        const org = await getOrganizationById(document.organizationId);
        if (org && !(org as any).isActive) {
          throw new TRPCError({ code: "FORBIDDEN", message: "errors.organization.disabled" });
        }
      }

      // If access code is required and not yet verified, return minimal info only (H-11 fix)
      if (request.accessCode && !(request as any).accessCodeVerified) {
        return {
          requiresAccessCode: true,
          request: {
            id: request.id,
            signerEmail: request.signerEmail,
            signerName: request.signerName,
            status: request.status,
            recipientRole: request.recipientRole,
            message: null,
            hasAccessCode: true,
          },
          document: {
            id: document.id,
            title: document.title,
            description: null,
            fileUrl: null,
            pageCount: null,
            status: document.status,
            signedFileUrl: null,
          },
          assignedFields: [],
          signerIndex: -1,
          allRecipients: [],
        };
      }

      if (request.recipientRole === "signer" && request.status === "sent") {
        const viewedAt = new Date();
        const ipAddress = getClientIp(ctx.req);
        const userAgent = ctx.req.headers["user-agent"] || null;
        await updateSignatureRequest(request.id, { status: "viewed" });
        await createActivityLog({
          organizationId: document.organizationId,
          documentId: document.id,
          actorEmail: request.signerEmail,
          action: "signature_viewed",
          details: JSON.stringify({ key: "activity.signatureViewed", signer: request.signerName || request.signerEmail }),
          ipAddress: ipAddress || undefined,
          userAgent: userAgent || undefined,
        });
        try {
          await appendAuditLog({
            eventType: "signature.viewed",
            entityType: "signature_request",
            entityId: request.id,
            organizationId: document.organizationId ?? undefined,
            actorEmail: request.signerEmail,
            ipAddress: ipAddress || undefined,
            userAgent: userAgent || undefined,
            metadata: { documentId: document.id, signerName: request.signerName, viewedAt: viewedAt.toISOString() },
          });
        } catch (e) { console.error("[AUDIT_LOG_FAILURE] signature.viewed failed:", e); }
        if (document.organizationId) {
          await emitIntegrationEvent(document.organizationId, "signature.viewed", {
            documentId: document.id,
            signatureRequestId: request.id,
            signerEmail: request.signerEmail,
            viewedAt: viewedAt.toISOString(),
          });
        }
        request.status = "viewed";
      }

      // Get signature fields assigned to this signer
      const allFields = await getSignatureFieldsByDocument(document.id);
      const allRequests = await getSignatureRequestsByDocument(document.id);
      // Find this signer's index
      const signerOnlyRequests = allRequests.filter(r => r.recipientRole === "signer");
      const signerIndex = signerOnlyRequests.findIndex(r => r.id === request.id);
      const assignedFields = allFields.filter(f => f.signerIndex === signerIndex);

      return {
        requiresAccessCode: false,
        request: {
          id: request.id,
          signerEmail: request.signerEmail,
          signerName: request.signerName,
          status: request.status,
          recipientRole: request.recipientRole,
          message: request.message,
          hasAccessCode: !!request.accessCode,
        },
        document: {
          id: document.id,
          title: document.title,
          description: document.description,
          fileUrl: document.fileUrl,
          pageCount: document.pageCount,
          status: document.status,
          signedFileUrl: document.signedFileUrl,
        },
        assignedFields,
        signerIndex,
        // All recipients for progress display
        allRecipients: allRequests.map(r => ({
          id: r.id,
          signerName: r.signerName,
          signerEmail: r.signerEmail,
          status: r.status,
          recipientRole: r.recipientRole,
          signedAt: r.signedAt,
        })),
      };
    }),

  /** Verify access code before viewing document */
  verifyAccessCode: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      accessCode: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const result = await getSignatureRequestByToken(input.token);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "signing.errors.requestNotFound" });
      }
      if (!result.request.accessCode) {
        return { verified: true };
      }
      // Timing-safe comparison using bcrypt.compare
      const isMatch = await bcrypt.compare(input.accessCode, result.request.accessCode);
      if (!isMatch) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "signing.errors.invalidAccessCode" });
      }
      try {
        await appendAuditLog({
          eventType: "auth.access_code_verified",
          entityType: "signature_request",
          entityId: result.request.id,
          organizationId: result.document.organizationId ?? undefined,
          metadata: { documentId: result.document.id },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] auth.access_code_verified failed:", e); }
      return { verified: true };
    }),

  /** Submit signature */
  sign: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      signerEmail: z.string().email("signing.errors.invalidEmail"),
      signatureDataUrl: z.string().max(700_000, "signing.errors.signatureDataTooLarge").optional(),
      signatureFont: signatureFontSchema.optional(),
      stampDataUrl: z.string().max(280_000, "signing.errors.stampDataTooLarge").optional(),
      ipAddress: z.string().optional(),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const baseUrl = getAppUrlOrThrow(ctx.req);

      // Extract IP address safely via trusted-proxy-aware utility
      const reqIpAddress = getClientIp(ctx.req);
      const reqUserAgent = ctx.req.headers['user-agent'] || null;

      const result = await getSignatureRequestByToken(input.token);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "signing.errors.requestNotFound" });
      }
      const { request, document } = result;
      if (request.status === "signed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "signing.errors.alreadySigned" });
      }
      if (request.status === "declined") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.signature.alreadyDeclined" });
      }
      if (request.recipientRole === "cc") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "signing.errors.ccCannotSign" });
      }
      // Block signatures on terminal-state documents (including completed)
      if (["completed", "voided", "expired", "declined"].includes(document.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "signing.errors.documentNotSignable" });
      }
      // Block signatures on delegated requests
      if (request.delegatedToEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.signature.delegated" });
      }
      // Check expiration directly (don't wait for scheduler)
      if (document.expiresAt && new Date(document.expiresAt) < new Date()) {
        await updateDocument(document.id, { status: "expired" });
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.signature.expired" });
      }
      // AC-006 fix-authorization-idor: block signing for deactivated organizations
      if (document.organizationId) {
        const org = await getOrganizationById(document.organizationId);
        if (org && !(org as any).isActive) {
          throw new TRPCError({ code: "FORBIDDEN", message: "errors.organization.disabled" });
        }
      }

      // Email verification: ensure the provided email matches the intended signer
      // Supports Gmail-style aliases (user+tag@gmail.com 竕｡ user@gmail.com)
      if (!emailsMatch(input.signerEmail, request.signerEmail)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "errors.signature.invalidEmail",
        });
      }

      // Conditional signature data validation: only require signature data if this signer's
      // assigned fields include a signature or stamp field.
      // Documents with only date/name/initials fields can be signed without providing image data.
      const allRequestsForValidation = await getSignatureRequestsByDocument(document.id);
      const signerOnlyRequests = allRequestsForValidation.filter(r => r.recipientRole === "signer");
      const signerIndex = signerOnlyRequests.findIndex(r => r.id === request.id);
      const allFieldsForValidation = await getSignatureFieldsByDocument(document.id);
      const assignedFields = signerIndex >= 0
        ? allFieldsForValidation.filter(f => f.signerIndex === signerIndex)
        : allFieldsForValidation;
      const hasSignatureOrStampField = assignedFields.some(f => f.type === "signature" || f.type === "stamp");
      if (hasSignatureOrStampField) {
        const hasSignatureData = (input.signatureDataUrl && input.signatureDataUrl.length > 0)
          || input.signatureFont
          || input.stampDataUrl;
        if (!hasSignatureData) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "errors.signature.dataRequired" });
        }
      }

      // Claim signerUserId for logged-in users whose email matches (including aliases).
      // This enables workspace-save ownership checks without waiting for a separate login claim.
      const shouldClaimUser = ctx.user?.id
        && !request.signerUserId
        && emailsMatch(ctx.user.email, request.signerEmail);

      // Mark as signed with audit trail data (server-extracted IP/UA)
      await updateSignatureRequest(request.id, {
        status: "signed",
        signatureDataUrl: input.signatureDataUrl || null,
        signatureFont: input.signatureFont || null,
        stampDataUrl: input.stampDataUrl || null,
        signedAt: new Date(),
        signerIpAddress: reqIpAddress,
        signerUserAgent: reqUserAgent,
        ...(shouldClaimUser ? { signerUserId: ctx.user!.id } : {}),
      });

      await createActivityLog({
        organizationId: document.organizationId,
        documentId: document.id,
        actorEmail: request.signerEmail,
        action: "signature_signed",
        details: JSON.stringify({ key: "activity.signatureSigned", signer: request.signerName || request.signerEmail }),
        ipAddress: reqIpAddress || undefined,
        userAgent: reqUserAgent || undefined,
      });
      try {
        await appendAuditLog({
          eventType: "signature.signed",
          entityType: "signature_request",
          entityId: request.id,
          organizationId: document.organizationId ?? undefined,
          actorEmail: request.signerEmail,
          ipAddress: reqIpAddress || undefined,
          userAgent: reqUserAgent || undefined,
          metadata: { documentId: document.id, signerName: request.signerName },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] signature.signed failed:", e); }
      if (document.organizationId) {
        await emitIntegrationEvent(document.organizationId, "signature.signed", {
          documentId: document.id,
          signatureRequestId: request.id,
          signerEmail: request.signerEmail,
          signedAt: new Date().toISOString(),
        });
      }

      // Notify document owner (non-fatal: email failure must not break document completion)
      const owner = await getUserById(document.userId);
      try {
        if (owner?.email) {
          const emailContent = buildSignatureCompleteEmail({
            senderName: owner.name || "Sender",
            signerName: request.signerName || request.signerEmail,
            documentTitle: document.title,
            dashboardUrl: `${baseUrl}/dashboard/documents/${document.id}`,
            lang: resolveEmailLocale((owner as any).locale),
          });
          await sendEmail({
            to: owner.email,
            toName: owner.name || undefined,
            ...emailContent,
            type: "signature_complete",
            documentId: document.id,
            signatureRequestId: request.id,
          });
        }
      } catch (emailErr) {
        console.error(`[Signature] Owner notification email failed (non-fatal):`, emailErr);
      }

      // Check if all signers have signed
      const allSigned = await checkAllSignersSigned(document.id);
      if (allSigned) {
        // 笏笏 Race-condition guard 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
        // Multiple signers finishing concurrently can both see allSigned=true.
        // We use an optimistic-lock state transition: atomically UPDATE the
        // document status from 'sent' to 'completed' and only proceed with
        // PDF generation if exactly 1 row was affected.  This guarantees the
        // heavy work (PDF build, WORM store, emails) runs at most once.
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const lockResult = await db.update(documents)
          .set({ status: "completed", completedAt: new Date() })
          .where(
            and(
              eq(documents.id, document.id),
              // Only transition from a non-completed status
              ne(documents.status, "completed"),
            ),
          );
        const rowsAffected = (lockResult as any)?.[0]?.affectedRows ?? 0;
        if (rowsAffected === 0) {
          // Another process already moved this document to 'completed'.
          console.log(`[Signature] Document ${document.id} already completed by another process, skipping PDF generation.`);
          return { success: true, allSigned };
        }

        let signedPdfBuffer: Buffer | undefined;
        try {
          // Generate signed PDF
          const allRequests = await getSignatureRequestsByDocument(document.id);
          const allFields = await getSignatureFieldsByDocument(document.id);
          const signerRequests = allRequests.filter(r => r.recipientRole === "signer" && !r.delegatedToEmail);

          // Build PdfSignatureField[] and PdfSignatureData[] for pdf.ts
          const pdfFields: PdfSignatureField[] = allFields.map(f => ({
            id: f.clientId,
            page: f.page,
            x: Number(f.xPercent),
            y: Number(f.yPercent),
            width: Number(f.widthPercent),
            height: Number(f.heightPercent),
            signerIndex: f.signerIndex,
            type: (f.type as "signature" | "date" | "name" | "initials" | "stamp") || "signature",
            label: f.label ?? undefined,
          }));

          const pdfSignatures: PdfSignatureData[] = [];
          for (const req of signerRequests) {
            // Include signatures that have either a drawn image, font selection, or stamp
            if (!req.signatureDataUrl && !req.signatureFont && !req.stampDataUrl) continue;
            const signerIdx = signerRequests.indexOf(req);
            const signerFields = allFields.filter(f => f.signerIndex === signerIdx);
            for (const sf of signerFields) {
              pdfSignatures.push({
                fieldId: sf.clientId,
                signerName: req.signerName || req.signerEmail,
                signatureDataUrl: req.signatureDataUrl || undefined,
                signatureFont: req.signatureFont || undefined,
                stampDataUrl: req.stampDataUrl || undefined,
                signedAt: req.signedAt || new Date(),
              });
            }
          }

          // Step 1: Embed signatures into PDF
          // Get fresh download URL 窶・document.fileUrl may be an expired presigned URL
          let pdfUrlForSigning = document.fileUrl!;
          if (document.fileKey) {
            const { url: freshUrl } = await storageGet(document.fileKey);
            pdfUrlForSigning = freshUrl;
          }
          signedPdfBuffer = await embedSignaturesIntoPdf(pdfUrlForSigning, pdfFields, pdfSignatures);

          // Step 2: Append completion certificate with audit trail
          const auditEntries: AuditEntry[] = signerRequests
            .filter(r => r.status === "signed")
            .map(r => {
              // Find if this signer was delegated from someone else (M-22)
              const delegator = allRequests.find(
                orig => emailsMatch(orig.delegatedToEmail, r.signerEmail)
              );
              return {
                signerName: r.signerName || r.signerEmail,
                signerEmail: r.signerEmail,
                ipAddress: r.signerIpAddress || null,
                userAgent: r.signerUserAgent || null,
                signedAt: r.signedAt || new Date(),
                action: "signed",
                delegatedFromEmail: delegator?.signerEmail || null,
              };
            });

          const completionTime = new Date();
          // AC-004 fix-worm-compliance: pre-compute document hash before appending certificate
          // (WORM contentHash is generated after certificate, so we hash the signed PDF here)
          const { createHash } = await import("crypto");
          const documentHash = createHash("sha256").update(signedPdfBuffer).digest("hex");
          signedPdfBuffer = await appendCompletionCertificate(
            signedPdfBuffer,
            document.title,
            auditEntries,
            { completedAt: completionTime, contentHash: documentHash },
          );

          // Step 2.5: Apply PDF permission lock (謾ｹ縺悶ｓ髦ｲ豁｢)
          const lockResult = await applyPdfPermissionLock(signedPdfBuffer);
          signedPdfBuffer = lockResult.buffer;
          if (lockResult.locked) {
            console.log(`[Signature] PDF permission lock applied to document ${document.id}`);
          } else {
            console.warn(`[Signature] PDF permission lock unavailable for document ${document.id}, continuing without`);
            // WORM compliance: record that permission lock was not applied
            await appendAuditLog({
              eventType: "pdf.permission_lock_failed",
              entityType: "document",
              entityId: document.id,
              organizationId: document.organizationId ?? undefined,
              actorUserId: document.userId,
              metadata: { reason: "qpdf unavailable or failed; PDF stored without permission restrictions" },
            });
          }

          // Step 3: Apply platform digital signature (遶倶ｼ壻ｺｺ蝙矩崕蟄千ｽｲ蜷・
          try {
            signedPdfBuffer = await signPdfWithPlatformKey(signedPdfBuffer, {
              reason: `髮ｻ蟄千ｽｲ蜷阪・繝ｩ繝・ヨ繝輔か繝ｼ繝縺ｫ繧医ｋ遶倶ｼ壻ｺｺ蝙狗ｽｲ蜷・- ${document.title}`,
              location: "Tokyo, Japan",
              documentTitle: document.title,
            });
            console.log(`[Signature] Platform digital signature applied to document ${document.id}`);

            // Record platform signature in audit log
            await appendAuditLog({
              eventType: "pdf.signed",
              entityType: "document",
              entityId: document.id,
              organizationId: document.organizationId ?? undefined,
              actorUserId: document.userId,
              metadata: {
                signatureType: "platform_witness",
                certificateInfo: getCertificateInfo(),
                documentTitle: document.title,
              },
            });
          } catch (signErr) {
            console.warn(`[Signature] Platform signature failed for document ${document.id}, continuing without:`, signErr);
          }

          // Step 4: Store in WORM storage (荳榊､峨せ繝医Ξ繝ｼ繧ｸ)
          // WORM菫晏ｭ倥・髮ｻ蟶ｳ豕輔さ繝ｳ繝励Λ繧､繧｢繝ｳ繧ｹ荳雁ｿ・医ょ､ｱ謨励＠縺溷ｴ蜷医・謾ｹ縺悶ｓ蜿ｯ閭ｽ縺ｪ
          // 騾壼ｸｸ繧ｹ繝医Ξ繝ｼ繧ｸ縺ｸ縺ｮ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ繧定｡後ｏ縺壹∽ｾ句､悶ｒ繧ｹ繝ｭ繝ｼ縺励※
          // 繝峨く繝･繝｡繝ｳ繝医ｒcompleted迥ｶ諷九↓縺励↑縺・ｼ亥ｾ檎ｶ壹・catch繝悶Ο繝・け縺ｧ蜃ｦ逅・ｼ峨・
          let signedUrl: string;
          let signedKey: string;
          const wormResult = await wormStorePdf(
            signedPdfBuffer,
            document.id,
            document.organizationId ?? null,
            document.userId,
            {
              documentTitle: document.title,
              signerCount: signerRequests.filter(r => r.status === "signed").length,
              completedAt: new Date().toISOString(),
            },
          );
          signedUrl = wormResult.url;
          signedKey = wormResult.key;
          console.log(`[Signature] PDF stored in WORM: ${signedKey} (hash: ${wormResult.contentHash.substring(0, 16)}...)`);

          // W-10: Record final PDF hash (includes certificate + lock + platform signature)
          // This is the authoritative hash for document verification against the stored WORM PDF.
          await appendAuditLog({
            eventType: "pdf.worm_stored",
            entityType: "document",
            entityId: document.id,
            organizationId: document.organizationId ?? undefined,
            actorUserId: document.userId,
            metadata: { finalPdfHash: wormResult.contentHash, wormKey: wormResult.key },
          });

          // Update document with signed file info (status already set to 'completed' by lock above)
          await updateDocument(document.id, {
            signedFileUrl: signedUrl,
            signedFileKey: signedKey,
          });
          console.log(`[Signature] Document ${document.id} completed with signedFileUrl: ${signedUrl}`);

          // Post-save operations: audit log, email, activity log
          // These are wrapped individually so failures don't affect the signed PDF result
          try {
            await appendAuditLog({
              eventType: "document.completed",
              entityType: "document",
              entityId: document.id,
              organizationId: document.organizationId ?? undefined,
              actorUserId: document.userId,
              metadata: {
                documentTitle: document.title,
                signedFileKey: signedKey,
                signerCount: signerRequests.filter(r => r.status === "signed").length,
                completedAt: new Date().toISOString(),
              },
            });
          } catch (auditErr) {
            console.error("[Signature] Audit log failed (non-fatal):", auditErr);
          }
          if (document.organizationId) {
            await emitIntegrationEvent(document.organizationId, "document.completed", {
              documentId: document.id,
              signedFileKey: signedKey,
              completedAt: new Date().toISOString(),
            });
          }

          try {
            if (owner?.email) {
              const emailContent = buildAllSignedEmail({
                senderName: owner.name || "Sender",
                documentTitle: document.title,
                downloadUrl: `${baseUrl}/dashboard/documents/${document.id}`,
                lang: resolveEmailLocale((owner as any).locale),
              });
              await sendEmail({
                to: owner.email,
                toName: owner.name || undefined,
                ...emailContent,
                type: "all_signed",
                documentId: document.id,
              });
            }
           } catch (emailErr) {
            console.error("[Signature] Completion email failed (non-fatal):", emailErr);
          }

          // Notify CC recipients about document completion
          try {
            const ccRecipients = allRequests.filter(r => r.recipientRole === "cc");
            for (const cc of ccRecipients) {
              const ccEmailContent = buildAllSignedEmail({
                senderName: owner?.name || "Sender",
                documentTitle: document.title,
                downloadUrl: `${baseUrl}/document-view/${cc.accessToken}`,
                lang: resolveEmailLocale(cc.locale),
              });
              await sendEmail({
                to: cc.signerEmail,
                toName: cc.signerName || undefined,
                ...ccEmailContent,
                type: "all_signed",
                documentId: document.id,
              });
            }
          } catch (ccErr) {
            console.error("[Signature] CC completion notification failed (non-fatal):", ccErr);
          }

          try {
            await createActivityLog({
              organizationId: document.organizationId,
              documentId: document.id,
              action: "document_completed",
              details: JSON.stringify({ key: "activity.documentCompleted" }),
            });
          } catch (actErr) {
            console.error("[Signature] Activity log failed (non-fatal):", actErr);
          }

        } catch (e) {
          console.error("[Signature] Failed to generate signed PDF or WORM storage:", e);
          // PDF逕滓・縺ｾ縺溘・WORM菫晏ｭ倥↓螟ｱ謨励＠縺溷ｴ蜷医√ラ繧ｭ繝･繝｡繝ｳ繝医・繧ｹ繝・・繧ｿ繧ｹ繧・
          // 'sent' 縺ｫ謌ｻ縺呻ｼ・ompleted縺ｮ縺ｾ縺ｾ縺ｫ縺励↑縺・ｼ峨る崕蟶ｳ豕輔さ繝ｳ繝励Λ繧､繧｢繝ｳ繧ｹ荳翫・
          // WORM菫晏ｭ倥↑縺励〒completed縺ｫ縺吶ｋ縺薙→縺ｯ險ｱ蜿ｯ縺輔ｌ縺ｪ縺・・
          try {
            await updateDocument(document.id, {
              status: "sent",
              completedAt: null,
            });
            // 鄂ｲ蜷崎・・signatureRequest繧よ悴鄂ｲ蜷咲憾諷九↓繝ｭ繝ｼ繝ｫ繝舌ャ繧ｯ
            // 縺薙ｌ縺後↑縺・→縲後☆縺ｧ縺ｫ鄂ｲ蜷肴ｸ医∩縲阪→蛻､螳壹＆繧悟・隧ｦ陦御ｸ榊庄閭ｽ縺ｫ縺ｪ繧・
            await updateSignatureRequest(request.id, {
              status: "sent",
              signatureDataUrl: null,
              signatureFont: null,
              stampDataUrl: null,
              signedAt: null,
              signerIpAddress: null,
              signerUserAgent: null,
            });
            console.warn(`[Signature] Document ${document.id} and request ${request.id} reverted to 'sent' status due to PDF/WORM failure.`);
          } catch (revertErr) {
            console.error(`[Signature] CRITICAL: Failed to revert document ${document.id} / request ${request.id} status:`, revertErr);
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "errors.signature.pdfGenerationFailed",
          });
        }
      } else if (document.sequentialRouting) {
        // Sequential routing: notify next signer
        const nextSigner = await getNextPendingSigner(document.id);
        if (nextSigner && nextSigner.status === "pending") {
          await updateSignatureRequest(nextSigner.id, { status: "sent" });
          const lang = resolveEmailLocale(nextSigner.locale);
          const signUrl = `${baseUrl}/sign/${nextSigner.accessToken}?lng=${lang}`;
          const emailContent = buildSignatureRequestEmail({
            signerName: nextSigner.signerName || nextSigner.signerEmail,
            senderName: owner?.name || "Sender",
            documentTitle: document.title,
            signUrl,
            lang,
          });
          await sendEmail({
            to: nextSigner.signerEmail,
            toName: nextSigner.signerName || undefined,
            ...emailContent,
            type: "signature_request",
            documentId: document.id,
            signatureRequestId: nextSigner.id,
          });
          await createActivityLog({
            organizationId: document.organizationId,
            documentId: document.id,
            action: "next_signer_notified",
            details: JSON.stringify({ key: "activity.nextSignerNotified", signer: nextSigner.signerName || nextSigner.signerEmail }),
          });
        }
      }

      return { success: true, allSigned };
    }),

  /** Decline signing */
  decline: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      reason: declineReasonSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const baseUrl = getAppUrlOrThrow(ctx.req);
      const result = await getSignatureRequestByToken(input.token);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "signing.errors.requestNotFound" });
      }
      const { request, document } = result;
      if (request.status === "signed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "signing.errors.alreadySigned" });
      }
      if (request.status === "declined") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.signature.requestAlreadyDeclined" });
      }
      // Block decline on terminal-state documents
      if (["completed", "voided", "expired", "declined"].includes(document.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.signature.documentNotDeclinable" });
      }
      // AC-006 fix-authorization-idor: block decline for deactivated organizations
      if (document.organizationId) {
        const org = await getOrganizationById(document.organizationId);
        if (org && !(org as any).isActive) {
          throw new TRPCError({ code: "FORBIDDEN", message: "errors.organization.disabled" });
        }
      }

      await updateSignatureRequest(request.id, {
        status: "declined",
        declinedAt: new Date(),
        declineReason: input.reason,
      });
      await updateDocument(document.id, { status: "declined" });

      await createActivityLog({
        organizationId: document.organizationId,
        documentId: document.id,
        actorEmail: request.signerEmail,
        action: "signature_declined",
        details: JSON.stringify({ key: "activity.signatureDeclined", signer: request.signerName || request.signerEmail, reason: input.reason }),
      });

      const owner = await getUserById(document.userId);
      if (owner?.email) {
        const emailContent = buildDeclinedEmail({
          senderName: owner.name || "Sender",
          signerName: request.signerName || request.signerEmail,
          documentTitle: document.title,
          reason: input.reason,
          dashboardUrl: `${baseUrl}/dashboard/documents/${document.id}`,
          lang: resolveEmailLocale((owner as any).locale),
        });
        await sendEmail({
          to: owner.email,
          toName: owner.name || undefined,
          ...emailContent,
          type: "signature_declined",
          documentId: document.id,
          signatureRequestId: request.id,
        });
      }

      try {
        await appendAuditLog({
          eventType: "signature.declined",
          entityType: "signature_request",
          entityId: request.id,
          organizationId: document.organizationId ?? undefined,
          actorEmail: request.signerEmail,
          metadata: { documentId: document.id, reason: input.reason },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] signature.declined failed:", e); }
      if (document.organizationId) {
        await emitIntegrationEvent(document.organizationId, "document.declined", {
          documentId: document.id,
          signatureRequestId: request.id,
          signerEmail: request.signerEmail,
          reason: input.reason,
        });
      }
      return { success: true };
    }),

  /** Delegate signing to another person */
  delegate: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      delegateEmail: emailSchema,
      delegateName: nameSchema,
      reason: z.string().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const baseUrl = getAppUrlOrThrow(ctx.req);
      const result = await getSignatureRequestByToken(input.token);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "signing.errors.requestNotFound" });
      }
      const { request, document } = result;
      if (request.status === "signed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "signing.errors.alreadySigned" });
      }
      // Block delegation on already-delegated requests
      if (request.delegatedToEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.signature.alreadyDelegated" });
      }
      if (["completed", "voided", "expired", "declined"].includes(document.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.signature.documentNotDelegatable" });
      }
      // AC-006 fix-authorization-idor: block delegate for deactivated organizations
      if (document.organizationId) {
        const org = await getOrganizationById(document.organizationId);
        if (org && !(org as any).isActive) {
          throw new TRPCError({ code: "FORBIDDEN", message: "errors.organization.disabled" });
        }
      }

      // Mark original request as delegated
      await updateSignatureRequest(request.id, {
        delegatedToEmail: input.delegateEmail,
        delegatedToName: input.delegateName,
        delegatedAt: new Date(),
      });

      // Create new signature request for the delegate (inherit order and accessCode)
      const delegateToken = nanoid(64);
      await createSignatureRequest({
        documentId: document.id,
        signerEmail: input.delegateEmail,
        signerName: input.delegateName,
        recipientRole: "signer",
        order: request.order,
        status: request.status === "pending" ? "pending" : "sent",
        accessToken: delegateToken,
        accessCode: request.accessCode,  // Inherit accessCode hash
        message: request.message,
      });

      // Send email to delegate
      const owner = await getUserById(document.userId);
      const lang = resolveEmailLocale(request.locale);
      const signUrl = `${baseUrl}/sign/${delegateToken}?lng=${lang}`;
      const emailContent = buildSignatureRequestEmail({
        signerName: input.delegateName,
        senderName: request.signerName || request.signerEmail,
        documentTitle: document.title,
        signUrl,
        lang,
      });
      await sendEmail({
        to: input.delegateEmail,
        toName: input.delegateName,
        ...emailContent,
        type: "signature_request",
        documentId: document.id,
      });

      await createActivityLog({
        organizationId: document.organizationId,
        documentId: document.id,
        actorEmail: request.signerEmail,
        action: "signature_delegated",
        details: JSON.stringify({ key: "activity.signatureDelegated", signer: request.signerName || request.signerEmail, delegateName: input.delegateName, delegateEmail: input.delegateEmail }),
      });

      try {
        await appendAuditLog({
          eventType: "signature.delegated",
          entityType: "signature_request",
          entityId: request.id,
          organizationId: document.organizationId ?? undefined,
          actorEmail: request.signerEmail,
          metadata: { documentId: document.id, action: "delegated", delegateEmail: input.delegateEmail, delegateName: input.delegateName },
        });
      } catch (e) { console.error("[AUDIT_LOG_FAILURE] signature.delegated failed:", e); }
      return { success: true };
    }),

  /** Download signed PDF by token (for guest/signer access) */
  downloadSignedByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const result = await getSignatureRequestByToken(input.token);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "signing.errors.requestNotFound" });
      }
      const { request, document } = result;
      // If authenticated, verify the caller is the signer for this token (cross-org access prevention)
      if (ctx.user) {
        assertSignerOwnership(request, ctx.user, "signing.errors.pdfAccessDenied");
      }
      // Only allow download if this signer has signed or document is completed
      if (request.status !== "signed" && document.status !== "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.signature.signedPdfNotAvailable" });
      }
      if (!document.signedFileUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "errors.signature.signedPdfNotGenerated" });
      }
      // Check if the WORM record is encrypted 竊・return proxy URL
      if (document.signedFileKey) {
        const db = await getDb();
        if (db) {
          const [wr] = await db.select({ encryptionIv: wormRecordsTable.encryptionIv })
            .from(wormRecordsTable)
            .where(eq(wormRecordsTable.storageKey, document.signedFileKey))
            .limit(1);
          if (wr?.encryptionIv) {
            const proxyToken = generateProxyToken(document.signedFileKey);
            return { url: `/api/pdf-proxy/${encodeURIComponent(document.signedFileKey)}?token=${proxyToken}`, title: document.title };
          }
        }
        // Non-encrypted: get fresh presigned URL
        const { url } = await storageGet(document.signedFileKey);
        return { url, title: document.title };
      }
      // Legacy: no signedFileKey
      return { url: document.signedFileUrl, title: document.title };
    }),

  fonts: publicProcedure.query(() => SIGNATURE_FONT_OPTIONS),

  /** Generate stamp (hanko) image from name */
  generateStamp: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(10),
      size: z.number().min(50).max(500).default(200),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#d32f2f"),
      style: z.enum(["circle", "square"]).default("circle"),
    }))
    .mutation(async ({ input }) => {
      try {
        const dataUrl = generateStampDataUrl({
          name: input.name,
          size: input.size,
          color: input.color,
          style: input.style,
        });
        return { dataUrl };
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: e.message ?? "errors.signature.stampGenerationFailed" });
      }
    }),

});
