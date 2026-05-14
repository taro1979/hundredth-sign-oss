import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { orgProcedure, router } from "../_core/trpc";
import {
  claimInternalApprovalsByEmail,
  claimSignatureRequestsByEmail,
  getInternalApprovalInboxEntriesForUser,
  getInternalApprovalsByDocument,
  getSignatureInboxEntriesForUser,
} from "../db";
import { resolveEmailLocaleCode } from "@shared/locales";

const inboxKindSchema = z.enum(["signature", "approval", "cc"]);

type InboxKind = z.infer<typeof inboxKindSchema>;
type InboxCtaType = "sign" | "approve" | "view";
type InboxItem = {
  kind: InboxKind;
  id: number;
  documentId: number;
  documentTitle: string;
  fromName: string | null;
  fromEmail: string | null;
  toName: string | null;
  toEmail: string;
  subject: string;
  bodyPreview: string | null;
  body: string | null;
  status: string;
  actionRequired: boolean;
  ctaType: InboxCtaType;
  actionUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

const visibleSignatureStatuses = new Set(["sent", "viewed", "signed", "declined", "expired"]);

function actorName(owner: { name: string | null; email: string | null } | null) {
  return owner?.name || owner?.email || "Hundredth Sign";
}

function actionUrl(path: "sign" | "approve" | "document-view", token: string | null, locale?: string | null) {
  const lang = resolveEmailLocaleCode(locale);
  return token ? `/${path}/${token}?lng=${lang}` : "/dashboard/inbox";
}

async function buildInboxItems(
  user: { id: number; email: string | null; locale?: string | null },
  organizationId: number,
): Promise<InboxItem[]> {
  if (!user.email) return [];

  await Promise.all([
    claimSignatureRequestsByEmail(user.email, user.id),
    claimInternalApprovalsByEmail(user.email, user.id),
  ]);

  const [signatureRows, approvalRows] = await Promise.all([
    getSignatureInboxEntriesForUser(user.email, user.id, organizationId),
    getInternalApprovalInboxEntriesForUser(user.email, user.id, organizationId),
  ]);

  const approvalCache = new Map<number, Awaited<ReturnType<typeof getInternalApprovalsByDocument>>>();
  async function isCurrentPendingApproval(documentId: number, approvalId: number) {
    let approvals = approvalCache.get(documentId);
    if (!approvals) {
      approvals = await getInternalApprovalsByDocument(documentId);
      approvalCache.set(documentId, approvals);
    }
    const next = approvals
      .filter((approval) => approval.status === "pending")
      .sort((a, b) => (a.order - b.order) || (a.id - b.id))[0];
    return next?.id === approvalId;
  }

  const signatureItems: InboxItem[] = signatureRows
    .filter(({ request }) => visibleSignatureStatuses.has(request.status))
    .map(({ request, document, owner }) => {
      const kind: InboxKind = request.recipientRole === "cc" ? "cc" : "signature";
      const actionRequired = kind === "signature" && ["sent", "viewed"].includes(request.status);
      const ctaType: InboxCtaType = actionRequired ? "sign" : "view";
      const target = ctaType === "sign" ? "sign" : "document-view";
      const subjectPrefix = kind === "cc" ? "CC" : "Signature request";
      return {
        kind,
        id: request.id,
        documentId: document.id,
        documentTitle: document.title,
        fromName: actorName(owner),
        fromEmail: owner?.email ?? null,
        toName: request.signerName,
        toEmail: request.signerEmail,
        subject: `${subjectPrefix}: ${document.title}`,
        bodyPreview: request.message,
        body: request.message,
        status: request.status,
        actionRequired,
        ctaType,
        actionUrl: actionUrl(target, request.accessToken, request.locale),
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      };
    });

  const approvalItems: InboxItem[] = [];
  for (const { approval, document, owner } of approvalRows) {
    const isPending = approval.status === "pending";
    if (isPending) {
      if (document.status !== "pending_internal_approval") continue;
      if (!(await isCurrentPendingApproval(document.id, approval.id))) continue;
    }
    approvalItems.push({
      kind: "approval",
      id: approval.id,
      documentId: document.id,
      documentTitle: document.title,
      fromName: actorName(owner),
      fromEmail: owner?.email ?? null,
      toName: approval.approverName,
      toEmail: approval.approverEmail,
      subject: `Approval request: ${document.title}`,
      bodyPreview: approval.comment,
      body: approval.comment,
      status: approval.status,
      actionRequired: isPending,
      ctaType: isPending ? "approve" : "view",
      actionUrl: actionUrl("approve", approval.accessToken, user.locale ?? "ja"),
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt,
    });
  }

  return [...signatureItems, ...approvalItems].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export const inboxRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    return buildInboxItems(ctx.user, orgId);
  }),

  countActionRequired: orgProcedure.query(async ({ ctx }) => {
    const orgId = (ctx as any).org.organizationId as number;
    const items = await buildInboxItems(ctx.user, orgId);
    return items.filter((item) => item.actionRequired).length;
  }),

  get: orgProcedure
    .input(z.object({ kind: inboxKindSchema, id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const orgId = (ctx as any).org.organizationId as number;
      const items = await buildInboxItems(ctx.user, orgId);
      const item = items.find((candidate) => candidate.kind === input.kind && candidate.id === input.id);
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "errors.inbox.notFound" });
      }
      return item;
    }),
});
