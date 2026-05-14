import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, ExternalLink, Inbox, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "wouter";
import { getDateFnsLocale, getDateFormat } from "@/lib/locale";

const inboxKinds = ["signature", "approval", "cc"] as const;
type InboxKind = (typeof inboxKinds)[number];

function isInboxKind(value: string | undefined): value is InboxKind {
  return inboxKinds.includes(value as InboxKind);
}

function statusKey(kind: InboxKind, status: string) {
  if (kind === "approval") return `inbox.status.approval.${status}`;
  if (kind === "cc") return "inbox.status.cc";
  return `inbox.status.signature.${status}`;
}

function ctaLabelKey(ctaType: string) {
  if (ctaType === "sign") return "inbox.cta.sign";
  if (ctaType === "approve") return "inbox.cta.approve";
  return "inbox.cta.view";
}

export default function InboxDetailPage() {
  const params = useParams<{ kind: string; id: string }>();
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const activeDateLocale = getDateFnsLocale(i18n.language);
  const activeDateFormat = getDateFormat(i18n.language, "dateTime");
  const id = Number(params.id);
  const validInput = isInboxKind(params.kind) && Number.isInteger(id) && id > 0;

  const { data: item, isLoading, isError } = trpc.inbox.get.useQuery(
    { kind: params.kind as InboxKind, id },
    { enabled: validInput, retry: false },
  );

  const handleAction = () => {
    if (!item?.actionUrl) return;
    navigate(item.actionUrl);
  };

  if (!validInput) {
    return (
      <InboxError
        title={t("inbox.notFoundTitle")}
        description={t("inbox.notFoundDesc")}
        backLabel={t("inbox.backToInbox")}
        onBack={() => navigate("/dashboard/inbox")}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-4 text-gray-600">{t("inbox.loadingDetail")}</p>
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <InboxError
        title={t("inbox.notFoundTitle")}
        description={t("inbox.notFoundDesc")}
        backLabel={t("inbox.backToInbox")}
        onBack={() => navigate("/dashboard/inbox")}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Button variant="ghost" className="gap-2" onClick={() => navigate("/dashboard/inbox")}>
            <ArrowLeft className="h-4 w-4" />
            {t("inbox.backToInbox")}
          </Button>
          {item.actionRequired && (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              {t("inbox.actionRequired")}
            </Badge>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="border-b px-6 py-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <Inbox className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-emerald-700">{t(`inbox.kind.${item.kind}`)}</p>
                <h1 className="mt-1 break-words text-2xl font-semibold text-gray-900">{item.subject}</h1>
              </div>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-[96px_1fr]">
              <dt className="text-gray-500">{t("inbox.from")}</dt>
              <dd className="min-w-0 text-gray-900">
                <span>{item.fromName || item.fromEmail || "Hundredth Sign"}</span>
                {item.fromEmail && <span className="ml-2 text-gray-500">{`<${item.fromEmail}>`}</span>}
              </dd>
              <dt className="text-gray-500">{t("inbox.to")}</dt>
              <dd className="min-w-0 text-gray-900">
                <span>{item.toName || item.toEmail}</span>
                <span className="ml-2 text-gray-500">{`<${item.toEmail}>`}</span>
              </dd>
              <dt className="text-gray-500">{t("inbox.date")}</dt>
              <dd className="text-gray-900">
                {format(new Date(item.updatedAt), activeDateFormat, { locale: activeDateLocale })}
              </dd>
              <dt className="text-gray-500">{t("common.status")}</dt>
              <dd>
                <Badge variant="outline" className="gap-1">
                  {item.actionRequired ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                  {t(statusKey(item.kind, item.status), { defaultValue: item.status })}
                </Badge>
              </dd>
            </dl>
          </div>

          <div className="space-y-6 px-6 py-6">
            <div>
              <p className="text-sm font-medium text-gray-500">{t("inbox.document")}</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{item.documentTitle}</p>
            </div>
            <div className="whitespace-pre-wrap rounded-md border bg-gray-50 p-4 text-sm leading-6 text-gray-700">
              {item.body || t(`inbox.detail.defaultBody.${item.kind}`, {
                title: item.documentTitle,
                sender: item.fromName || item.fromEmail || "Hundredth Sign",
              })}
            </div>
            <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => navigate("/dashboard/inbox")}>
                {t("inbox.backToInbox")}
              </Button>
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleAction}>
                <ExternalLink className="h-4 w-4" />
                {t(ctaLabelKey(item.ctaType))}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InboxError({
  title,
  description,
  backLabel,
  onBack,
}: {
  title: string;
  description: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
        <h2 className="mb-2 text-xl font-semibold text-gray-900">{title}</h2>
        <p className="mb-5 text-gray-500">{description}</p>
        <Button onClick={onBack}>{backLabel}</Button>
      </div>
    </div>
  );
}
