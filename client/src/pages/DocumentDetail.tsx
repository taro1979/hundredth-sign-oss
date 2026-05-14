import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Send, FileText, Clock, CheckCircle, XCircle,
  User, Download, Ban, Loader2, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import PdfViewer from "@/components/PdfViewer";
import { getDateFnsLocale, getDateFormat } from "@/lib/locale";
import { parseActivityDetails } from "@/lib/activityDetails";


export default function DocumentDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const docId = parseInt(params.id ?? "0");

  const activeDateLocale = getDateFnsLocale(i18n.language);
  const activeDateFormat = getDateFormat(i18n.language, "dateTime");
  const activeShortDateFormat = getDateFormat(i18n.language, "shortDateTime");

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof FileText; color: string }> = {
    draft: { label: t("documents.status.draft"), variant: "secondary", icon: FileText, color: "text-gray-600" },
    sent: { label: t("documents.status.sent"), variant: "default", icon: Send, color: "text-blue-600" },
    completed: { label: t("documents.status.completed"), variant: "default", icon: CheckCircle, color: "text-green-600" },
    declined: { label: t("documents.status.declined"), variant: "destructive", icon: XCircle, color: "text-red-600" },
    voided: { label: t("documents.status.voided"), variant: "destructive", icon: Ban, color: "text-gray-600" },
    expired: { label: t("documents.status.expired"), variant: "destructive", icon: Clock, color: "text-orange-600" },
    signed: { label: t("documents.status.completed"), variant: "default", icon: CheckCircle, color: "text-green-600" },
    pending: { label: t("documents.status.pending_approval"), variant: "outline", icon: Clock, color: "text-yellow-600" },
    pending_internal_approval: { label: t("documents.status.pending_internal_approval"), variant: "outline", icon: Clock, color: "text-amber-600" },
  };

  const pollCountRef = useRef(0);
  const { data: doc, isLoading, isError, error } = trpc.documents.getById.useQuery(
    { id: docId },
    {
      enabled: docId > 0,
      retry: false,
      // Poll every 10s while document is completed but signedFileUrl not yet available
      // Stop after 60 polls (~10 min) to avoid exhausting rate limit
      refetchInterval: (query) => {
        const d = query.state.data;
        if (d && d.status === "completed" && !d.signedFileUrl) {
          pollCountRef.current += 1;
          if (pollCountRef.current > 60) return false;
          return 10_000;
        }
        pollCountRef.current = 0;
        return false;
      },
    }
  );

  // Void dialog
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  const voidMutation = trpc.documents.void.useMutation({
    onSuccess: () => {
      toast.success(t("documents.voidSuccess"));
      setVoidDialogOpen(false);
      utils.documents.getById.invalidate({ id: docId });
    },
    onError: (err: { message: string }) => toast.error(t(err.message, { defaultValue: err.message })),
  });

  const { data: signedPdf } = trpc.documents.downloadSigned.useQuery(
    { id: docId },
    { enabled: doc?.status === "completed" && !!doc?.signedFileUrl }
  );

  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (!isLoading) { setLoadingTimedOut(false); return; }
    const timer = setTimeout(() => setLoadingTimedOut(true), 15_000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading) {
    if (loadingTimedOut) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">{t("common.loadingTimeout")}</p>
            <Button onClick={() => window.location.reload()}>{t("common.reload")}</Button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError) {
    const isNotFound = error?.message?.includes("NOT_FOUND") || error?.message?.includes("notFound");
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("errors.error")}</h2>
          <p className="text-gray-500 mb-4">
            {isNotFound ? t("errors.documents.notFound") : t("errors.serverError")}
          </p>
          <Button onClick={() => navigate("/dashboard/documents")}>
            {t("documents.backToList")}
          </Button>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{t("documents.noDocuments")}</p>
          <Button onClick={() => navigate("/dashboard/documents")}>{t("documents.backToList")}</Button>
        </div>
      </div>
    );
  }

  const status = statusMap[doc.status] ?? { label: doc.status, variant: "secondary" as const, icon: FileText, color: "text-gray-600" };
  const sigRequests = doc.signatureRequests || [];
  const activityLogs = doc.activityLogs || [];
  const existingFields = doc.signatureFields || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard/documents")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("documents.backToList")}
          </Button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{doc.title}</h1>
              {doc.description && <p className="text-gray-500 mt-1">{doc.description}</p>}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={status.variant} className="text-sm px-3 py-1">
                {status.label}
              </Badge>

              {/* Draft: Navigate to wizard to continue editing */}
              {doc.status === "draft" && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => navigate(`/dashboard/documents/new?draftId=${docId}`)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {doc.fileUrl ? t("documents.create.send") : t("documents.continueEdit")}
                </Button>
              )}

              {/* Sent/Declined: Void */}
              {(doc.status === "sent" || doc.status === "declined") && (
                <Button variant="outline" className="text-red-600 border-red-300" onClick={() => setVoidDialogOpen(true)}>
                  <Ban className="w-4 h-4 mr-2" />
                  {t("documents.detail.voidDocument")}
                </Button>
              )}

              {/* Completed: Download */}
              {doc.status === "completed" && signedPdf?.url && (
                <a href={signedPdf.url} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Download className="w-4 h-4 mr-2" />
                    {t("documents.detail.downloadSigned")}
                  </Button>
                </a>
              )}
              {doc.status === "completed" && !doc.signedFileUrl && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("signing.generatingSignedPdf")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* PDF Preview (read-only) */}
            {doc.fileUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {t("documents.preview")}
                    {existingFields.length > 0 && (
                      <Badge variant="outline" className="ml-2">{t("documents.create.placedFields", { count: existingFields.length })}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PdfViewer
                    url={doc.signedFileUrl || doc.fileUrl}
                    className="rounded-lg overflow-hidden"
                    overlayContent={(pageIndex: number) => (
                      <>
                        {existingFields
                          .filter((f: any) => f.page === pageIndex)
                          .map((field: any, i: number) => (
                            <div
                              key={field.id || i}
                              className="absolute border-2 border-emerald-600 bg-emerald-100/30 rounded flex items-center justify-center"
                              style={{
                                left: `${Number(field.xPercent)}%`,
                                top: `${Number(field.yPercent)}%`,
                                width: `${Number(field.widthPercent)}%`,
                                height: `${Number(field.heightPercent)}%`,
                              }}
                            >
                              <span className="text-xs text-emerald-600 font-medium">
                                {field.type === "signature" ? t("signing.signHere") : field.type === "date" ? t("signing.dateHere") : field.type === "name" ? t("signing.nameHere") : t("signing.initialHere")}
                              </span>
                            </div>
                          ))}
                      </>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* No PDF yet - guide to wizard */}
            {!doc.fileUrl && doc.status === "draft" && (
              <Card>
                <CardContent className="py-16 text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("templates.uploadPdf")}</h3>
                  <p className="text-gray-500 mb-6">{t("documents.create.uploadPdf")}</p>
                  <Button
                    onClick={() => navigate(`/dashboard/documents/new?draftId=${docId}`)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {t("documents.continueEdit")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Document Info */}
            <Card>
              <CardHeader><CardTitle>{t("documents.info")}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">{t("common.title")}</p>
                    <p className="font-medium">{doc.fileName ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t("common.description")}</p>
                    <p className="font-medium">{doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(2)} MB` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t("common.createdAt")}</p>
                    <p className="font-medium">{format(new Date(doc.createdAt), activeDateFormat, { locale: activeDateLocale })}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t("common.updatedAt")}</p>
                    <p className="font-medium">{format(new Date(doc.updatedAt), activeDateFormat, { locale: activeDateLocale })}</p>
                  </div>
                  {doc.expirationDays && (
                    <div>
                      <p className="text-sm text-gray-500">{t("documents.create.expirationDays")}</p>
                      <p className="font-medium">{doc.expirationDays}</p>
                    </div>
                  )}
                  {doc.reminderDays && (
                    <div>
                      <p className="text-sm text-gray-500">{t("documents.create.reminderDays")}</p>
                      <p className="font-medium">{doc.reminderDays}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Signature Requests */}
            {sigRequests.length > 0 && (
              <Card>
                <CardHeader><CardTitle>{t("documents.recipients")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sigRequests.map((req: any) => {
                      const reqStatus = statusMap[req.status] ?? { label: req.status, variant: "secondary" as const, color: "text-gray-600" };
                      return (
                        <div key={req.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-full border">
                              <User className="w-4 h-4 text-gray-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{req.signerName ?? req.signerEmail}</p>
                                <Badge variant="outline" className="text-xs">
                                  {req.recipientRole === "cc" ? t("documents.role.cc") : req.recipientRole === "approver" ? t("documents.role.approver") : t("documents.role.signer")}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-500">{req.signerEmail}</p>
                              {req.order > 1 && <p className="text-xs text-gray-400">{t("documents.create.order")}: {req.order}</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={reqStatus.variant}>{reqStatus.label}</Badge>
                            {req.signedAt && (
                              <p className="text-xs text-gray-500 mt-1">
                                {format(new Date(req.signedAt), activeShortDateFormat, { locale: activeDateLocale })}
                              </p>
                            )}
                            {req.declineReason && (
                              <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate">{req.declineReason}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar: Activity Log */}
          <div>
            <Card>
              <CardHeader><CardTitle>{t("documents.activityTab")}</CardTitle></CardHeader>
              <CardContent>
                {activityLogs.length > 0 ? (
                  <div className="space-y-4">
                    {activityLogs.map((log: any) => (
                      <div key={log.id} className="flex gap-3">
                        <div className="w-2 h-2 mt-2 rounded-full bg-emerald-400 shrink-0" />
                        <div>
                          <p className="text-sm">{parseActivityDetails(log.details, t, log.action)}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(log.createdAt), activeShortDateFormat, { locale: activeDateLocale })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">{t("common.noData")}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Void Dialog */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("documents.detail.voidDocument")}</DialogTitle>
            <DialogDescription>{t("documents.voidConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => voidMutation.mutate({ id: docId })} disabled={voidMutation.isPending}>
              {voidMutation.isPending ? t("common.loading") : t("documents.detail.voidDocument")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
