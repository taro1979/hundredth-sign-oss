import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import PdfViewer from "@/components/PdfViewer";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  Lock,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

function getStatusMap(t: (key: string, options?: Record<string, unknown>) => string): Record<string, { label: string; color: string; icon: React.ReactNode }> {
  return {
    pending: { label: t("documents.status.pending"), color: "bg-gray-100 text-gray-700", icon: <Clock className="w-3 h-3" /> },
    sent: { label: t("documents.status.sent"), color: "bg-blue-50 text-blue-700", icon: <Clock className="w-3 h-3" /> },
    viewed: { label: t("documents.status.viewed"), color: "bg-yellow-50 text-yellow-700", icon: <Eye className="w-3 h-3" /> },
    signed: { label: t("documents.status.signed"), color: "bg-green-50 text-green-700", icon: <CheckCircle2 className="w-3 h-3" /> },
    declined: { label: t("documents.status.declined"), color: "bg-red-50 text-red-700", icon: <XCircle className="w-3 h-3" /> },
    expired: { label: t("documents.status.expired"), color: "bg-orange-50 text-orange-700", icon: <Clock className="w-3 h-3" /> },
  };
}

export default function DocumentView() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const statusMap = getStatusMap(t);
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [accessVerified, setAccessVerified] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const pollCountRef = useRef(0);
  const pendingPollCountRef = useRef(0);

  const { data, isLoading, error } = trpc.signature.getByToken.useQuery(
    { token: token || "" },
    {
      enabled: !!token,
      retry: false,
      refetchInterval: (query) => {
        const current = query.state.data;
        if (current && current.document.status === "completed" && !current.document.signedFileUrl) {
          pollCountRef.current += 1;
          return pollCountRef.current > 60 ? false : 10_000;
        }
        if (current && current.document.status !== "completed") {
          pendingPollCountRef.current += 1;
          return pendingPollCountRef.current > 40 ? false : 10_000;
        }
        return false;
      },
    },
  );

  useEffect(() => {
    if (!isLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setLoadingTimedOut(true), 10_000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const verifyAccessCodeMutation = trpc.signature.verifyAccessCode.useMutation({
    onSuccess: () => {
      setAccessVerified(true);
      toast.success(t("documentView.accessVerified"));
    },
    onError: (err: { message: string }) => toast.error(t(err.message, { defaultValue: err.message })),
  });

  const downloadSignedMutation = trpc.signature.downloadSignedByToken.useQuery(
    { token: token || "" },
    { enabled: !!token && !!data?.document.signedFileUrl },
  );

  const handleDownload = () => {
    if (!data) return;
    const url = downloadSignedMutation.data?.url || data.document.signedFileUrl || data.document.fileUrl;
    if (!url) {
      toast.error(t("documentView.noDownloadableFile"));
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.document.title || "document"}${data.document.signedFileUrl ? "_signed" : ""}.pdf`;
    link.click();
    toast.success(t("documents.downloadSuccess"));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          {loadingTimedOut ? (
            <>
              <p className="mb-4 text-gray-500">{t("common.loadingTimeout")}</p>
              <Button onClick={() => window.location.reload()}>{t("common.reload")}</Button>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
              <p className="mt-4 text-gray-600">{t("documentView.loading")}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
            <h2 className="mb-2 text-xl font-bold">{t("documentView.accessDenied")}</h2>
            <p className="text-gray-600">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { request, document: doc, allRecipients } = data;

  if (request.hasAccessCode && !accessVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="mx-auto mb-2 h-12 w-12 text-emerald-600" />
            <CardTitle>{t("signing.enterAccessCode")}</CardTitle>
            <CardDescription>{t("documentView.accessCodeRequired")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="password"
              placeholder={t("signing.enterAccessCode")}
              className="w-full rounded-md border px-3 py-2"
              value={accessCodeInput}
              onChange={(event) => setAccessCodeInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && accessCodeInput.trim()) {
                  verifyAccessCodeMutation.mutate({ token: token || "", accessCode: accessCodeInput.trim() });
                }
              }}
            />
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={!accessCodeInput.trim() || verifyAccessCodeMutation.isPending}
              onClick={() => verifyAccessCodeMutation.mutate({ token: token || "", accessCode: accessCodeInput.trim() })}
            >
              {verifyAccessCodeMutation.isPending ? t("documentView.verifying") : t("common.confirm")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const signerRecipients = allRecipients?.filter(r => r.recipientRole === "signer") ?? [];
  const signedCount = signerRecipients.filter(r => r.status === "signed").length;
  const totalSigners = signerRecipients.length;
  const progressPercent = totalSigners > 0 ? Math.round((signedCount / totalSigners) * 100) : 0;
  const isCompleted = doc.status === "completed";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{doc.title}</h1>
              <p className="text-sm text-gray-500">
                {isCompleted
                  ? t("documentView.allSigned")
                  : t("documentView.signProgress", { signed: signedCount, total: totalSigners })}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleDownload} disabled={!doc.signedFileUrl && !doc.fileUrl}>
            <Download className="mr-2 h-4 w-4" />
            {doc.signedFileUrl ? t("signing.downloadSignedPdf") : t("common.download")}
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <PdfViewer url={doc.signedFileUrl || doc.fileUrl || ""} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-emerald-600" />
                {t("documentView.progressTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-gray-600">{t("documentView.signedCount", { signed: signedCount, total: totalSigners })}</span>
                  <span className="font-medium text-emerald-600">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              <div className="space-y-2">
                {allRecipients?.map((recipient, index) => {
                  const status = statusMap[recipient.status] || statusMap.pending;
                  return (
                    <div key={recipient.id} className="flex items-center justify-between border-b py-2 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                          recipient.status === "signed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{recipient.signerName || recipient.signerEmail}</p>
                          <p className="text-xs text-gray-500">
                            {recipient.recipientRole === "signer" ? t("documents.role.signer") : t("documents.role.cc")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={`${status.color} text-xs`}>
                        <span className="mr-1">{status.icon}</span>
                        {status.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-emerald-600" />
                {t("documents.info")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t("common.status")}</span>
                <Badge variant="secondary" className={isCompleted ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}>
                  {isCompleted ? t("documents.status.completed") : t("documentView.inProgress")}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("documentView.yourSignature")}</span>
                <Badge
                  variant="secondary"
                  className={
                    request.status === "signed" ? "bg-green-50 text-green-700" :
                    request.status === "declined" ? "bg-red-50 text-red-700" :
                    "bg-blue-50 text-blue-700"
                  }
                >
                  {request.status === "signed"
                    ? t("documents.status.signed")
                    : request.status === "declined"
                    ? t("documents.status.declined")
                    : t("documents.status.sent")}
                </Badge>
              </div>
              {doc.description && (
                <div>
                  <span className="mb-1 block text-gray-500">{t("common.description")}</span>
                  <p className="text-gray-700">{doc.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={handleDownload}
                disabled={!doc.signedFileUrl && !doc.fileUrl}
              >
                <Download className="mr-2 h-4 w-4" />
                {doc.signedFileUrl ? t("signing.downloadSignedPdf") : t("documentView.downloadOriginalPdf")}
              </Button>
              {!doc.signedFileUrl && isCompleted && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
                    <p className="text-xs text-blue-700">{t("signing.generatingSignedPdf")}</p>
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
                この文書の閲覧とPDF取得にアカウント登録は不要です。
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
