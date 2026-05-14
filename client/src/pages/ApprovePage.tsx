import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useParams } from "wouter";
import {
  CheckCircle, XCircle, FileText, Clock, AlertCircle, Shield,
  User, Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { resolveSignPageLocale } from "@shared/locales";

export default function ApprovePage() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const { t, i18n } = useTranslation();

  const { data, isLoading, error, refetch } = trpc.internalApproval.getByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLng = urlParams.get("lng") ?? undefined;
    const locale = resolveSignPageLocale(navigator.language || undefined, urlLng ?? data?.approval.locale);
    i18n.changeLanguage(locale);
  }, [data?.approval.locale, i18n]);

  const decideMutation = trpc.internalApproval.decide.useMutation();
  const [comment, setComment] = useState("");
  const [isDeciding, setIsDeciding] = useState(false);
  const [decided, setDecided] = useState<"approved" | "rejected" | null>(null);
  const [allApproved, setAllApproved] = useState(false);

  const handleDecide = async (decision: "approved" | "rejected") => {
    setIsDeciding(true);
    try {
      const result = await decideMutation.mutateAsync({
        token,
        decision,
        comment: comment.trim() || undefined,
      });
      setDecided(decision);
      setAllApproved(result.allApproved);
      toast.success(decision === "approved" ? t("approvalPage.approved") : t("approvalPage.rejected"));
      refetch();
    } catch (err: any) {
      toast.error(err?.message || t("approvalPage.processFailed"));
    } finally {
      setIsDeciding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-gray-500">{t("approvalPage.loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t("approvalPage.notFoundTitle")}</h2>
            <p className="text-gray-500 text-sm">
              {t("approvalPage.notFoundDescription")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { approval, document: doc, allApprovals } = data;
  const isPending = approval.status === "pending" && !decided;
  const isAlreadyDecided = approval.status !== "pending" || decided;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Shield className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="font-bold text-gray-900">{t("approvalPage.title")}</h1>
            <p className="text-xs text-gray-500">{t("approvalPage.footerTagline")}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Document Info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{doc.title}</h2>
                {doc.description && (
                  <p className="text-sm text-gray-500 mt-1">{doc.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                    {t("documents.status.pending_internal_approval")}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Chain */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-700 mb-4">{t("approvalPage.flowTitle")}</h3>
            <div className="space-y-3">
              {allApprovals.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    a.id === approval.id
                      ? "bg-amber-50 border-amber-300"
                      : a.status === "approved"
                      ? "bg-green-50 border-green-200"
                      : a.status === "rejected"
                      ? "bg-red-50 border-red-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                      a.status === "approved"
                        ? "bg-green-500"
                        : a.status === "rejected"
                        ? "bg-red-500"
                        : a.id === approval.id
                        ? "bg-amber-500"
                        : "bg-gray-400"
                    }`}
                  >
                    {a.status === "approved" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : a.status === "rejected" ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {a.approverName || a.approverEmail}
                      {a.id === approval.id && (
                        <span className="text-amber-600 ml-2 text-xs">({t("approvalPage.you")})</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{a.approverEmail}</p>
                  </div>
                  <div>
                    {a.status === "approved" && (
                      <Badge className="bg-green-100 text-green-700 border-green-300">{t("approvalPage.approved")}</Badge>
                    )}
                    {a.status === "rejected" && (
                      <Badge className="bg-red-100 text-red-700 border-red-300">{t("approvalPage.rejected")}</Badge>
                    )}
                    {a.status === "pending" && (
                      <Badge variant="outline" className="text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {t("approvalPage.pending")}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Decision Area */}
        {isPending && (
          <Card className="border-amber-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-gray-900">{t("approvalPage.actionRequiredTitle")}</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t("approvalPage.actionRequiredDescription")}
              </p>

              {doc.fileUrl && (
                <div className="mb-4">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    <FileText className="w-4 h-4" />
                    {t("approvalPage.openPdf")}
                  </a>
                </div>
              )}

              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  {t("approvalPage.commentOptional")}
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("approvalPage.commentPlaceholder")}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => handleDecide("approved")}
                  disabled={isDeciding}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-5"
                >
                  {isDeciding ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-5 h-5 mr-2" />
                  )}
                  {t("approvalPage.approveAction")}
                </Button>
                <Button
                  onClick={() => handleDecide("rejected")}
                  disabled={isDeciding}
                  variant="outline"
                  className="flex-1 border-red-300 text-red-600 hover:bg-red-50 py-5"
                >
                  {isDeciding ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-5 h-5 mr-2" />
                  )}
                  {t("approvalPage.rejectAction")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Already Decided */}
        {isAlreadyDecided && (
          <Card>
            <CardContent className="p-8 text-center">
              {(decided || approval.status) === "approved" ? (
                <>
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{t("approvalPage.approved")}</h3>
                  {allApproved ? (
                    <p className="text-gray-500 text-sm">
                      {t("approvalPage.allApprovedMessage")}
                    </p>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      {t("approvalPage.nextApproverNotified")}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{t("approvalPage.rejected")}</h3>
                  <p className="text-gray-500 text-sm">
                    {t("approvalPage.rejectedMessage")}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12 py-6 text-center text-xs text-gray-400">
        <p>{t("approvalPage.footerTagline")}</p>
      </footer>
    </div>
  );
}
