/**
 * Scheduler for automatic reminder emails and document expiration.
 * Runs periodically (every 15 minutes) to:
 * 1. Send reminder emails for documents with nextReminderAt in the past
 * 2. Auto-expire documents that have passed their expiresAt date
 * Also runs every 6 hours to:
 * 3. Verify hash chain integrity of immutable audit logs (H-04)
 */
import {
  getDocumentsNeedingReminder,
  getDocumentsNeedingExpiration,
  getPendingSignatureRequests,
  updateDocument,
  getDocumentById,
  getUserById,
  createActivityLog,
} from "./db";
import { sendEmail } from "./email";
import { buildReminderEmail, resolveEmailLocale } from "./email";
import { ENV } from "./_core/env";
import { verifyHashChainIntegrity, appendAuditLog } from "./auditLog";
import { processIntegrationWebhookRetries } from "./integrations";

const SCHEDULER_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
export const INTEGRITY_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function processReminders() {
  // Early return: without APP_URL the scheduler cannot build email links.
  // Do NOT update nextReminderAt so reminders are retried once APP_URL is set.
  if (!ENV.appUrl) {
    console.warn("[SCHEDULER] Skipping all reminders: APP_URL is not configured. Reminders will be retried once APP_URL is set.");
    return;
  }

  try {
    const docs = await getDocumentsNeedingReminder();
    for (const doc of docs) {
      try {
        const pendingRequests = await getPendingSignatureRequests(doc.id);
        if (pendingRequests.length === 0) continue;

        // Get document owner for sender name
        const owner = doc.userId ? await getUserById(doc.userId) : null;
        const senderName = owner?.name || "送信者";

        for (const req of pendingRequests) {
          const locale = resolveEmailLocale((req as any).locale);
          const signUrl = `${ENV.appUrl}/sign/${req.accessToken}?lng=${locale}`;
          const emailContent = buildReminderEmail({
            signerName: req.signerName || req.signerEmail,
            senderName,
            documentTitle: doc.title,
            signUrl,
            lang: locale,
          });
          try {
            await sendEmail({
              to: req.signerEmail,
              toName: req.signerName || undefined,
              ...emailContent,
              type: "reminder",
              documentId: doc.id,
              signatureRequestId: req.id,
            });
          } catch (emailErr) {
            console.error(`[Scheduler] Failed to send reminder email to ${req.signerEmail}:`, emailErr);
            // Continue with next signer (error isolation)
          }
        }

        // Update nextReminderAt to the next interval
        // Guard: reminderDays=0 is falsy but would loop if not checked explicitly
        const nextReminderAt = (doc.reminderDays ?? 0) > 0
          ? new Date(Date.now() + doc.reminderDays! * 24 * 60 * 60 * 1000)
          : null;
        await updateDocument(doc.id, { nextReminderAt });

        await createActivityLog({
          organizationId: doc.organizationId,
          documentId: doc.id,
          userId: doc.userId,
          action: "reminder_sent",
          details: JSON.stringify({ key: "activity.autoReminderSent", count: pendingRequests.length }),
        });

        console.log(`[Scheduler] Reminder sent for document ${doc.id} to ${pendingRequests.length} signers`);
      } catch (err) {
        console.error(`[Scheduler] Failed to process reminder for document ${doc.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Scheduler] Error processing reminders:", err);
  }
}

export async function processExpirations() {
  try {
    const docs = await getDocumentsNeedingExpiration();
    for (const doc of docs) {
      try {
        await updateDocument(doc.id, { status: "expired" });
        await createActivityLog({
          organizationId: doc.organizationId,
          documentId: doc.id,
          userId: doc.userId,
          action: "document_expired",
          details: JSON.stringify({ key: "activity.documentExpired" }),
        });
        console.log(`[Scheduler] Document ${doc.id} expired due to expiration date`);
      } catch (err) {
        console.error(`[Scheduler] Failed to expire document ${doc.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Scheduler] Error processing expirations:", err);
  }
}

/**
 * Verify hash chain integrity of system_audit_logs.
 * Runs every 6 hours. Records a broken-chain audit event if tampering is detected.
 */
export async function processIntegrityCheck(): Promise<void> {
  try {
    const report = await verifyHashChainIntegrity();
    if (report.isIntact) {
      console.log(
        `[INTEGRITY] Hash chain verification passed: ${report.totalRecords} records, all intact`
      );
    } else {
      console.error(
        `[INTEGRITY] ⚠️ Hash chain BROKEN at record ID ${report.brokenAt}. ` +
        `${report.verifiedRecords}/${report.totalRecords} verified`
      );
      // Record the integrity breach in the audit log itself
      await appendAuditLog({
        eventType: "integrity.chain_broken",
        metadata: {
          brokenAt: report.brokenAt,
          totalRecords: report.totalRecords,
          verifiedRecords: report.verifiedRecords,
        },
      }).catch((e: unknown) => {
        console.error("[INTEGRITY] Failed to record breach audit event:", e);
      });
    }
  } catch (err) {
    console.error("[INTEGRITY] Hash chain verification failed with error:", err);
  }
}

export function startScheduler() {
  console.log("[Scheduler] Starting automatic reminder & expiration scheduler (interval: 15min)");
  // Run immediately on startup
  processReminders().catch(console.error);
  processExpirations().catch(console.error);
  processIntegrationWebhookRetries().catch(console.error);
  // Then run periodically
  setInterval(() => {
    processReminders().catch(console.error);
    processExpirations().catch(console.error);
    processIntegrationWebhookRetries().catch(console.error);
  }, SCHEDULER_INTERVAL_MS);

  // Hash chain integrity check: every 6 hours (not on startup to avoid slow boot)
  console.log("[Scheduler] Hash chain integrity check scheduled (interval: 6h)");
  setInterval(() => {
    processIntegrityCheck().catch(console.error);
  }, INTEGRITY_CHECK_INTERVAL_MS);
}
