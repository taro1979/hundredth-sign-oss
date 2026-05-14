import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Clock, Eye, Inbox, MailOpen, PenLine, Search, Stamp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { getDateFnsLocale, getDateFormat } from "@/lib/locale";

type InboxItem = {
  kind: "signature" | "approval" | "cc";
  id: number;
  documentTitle: string;
  fromName: string | null;
  fromEmail: string | null;
  subject: string;
  bodyPreview: string | null;
  status: string;
  actionRequired: boolean;
  updatedAt: Date | string;
};

type InboxFilter = "actionRequired" | "all";

function kindIcon(kind: InboxItem["kind"]) {
  if (kind === "approval") return Stamp;
  if (kind === "cc") return Eye;
  return PenLine;
}

function statusTone(item: InboxItem) {
  if (item.actionRequired) return "bg-blue-50 text-blue-700 border-blue-200";
  if (["signed", "approved"].includes(item.status)) return "bg-green-50 text-green-700 border-green-200";
  if (["declined", "rejected", "expired"].includes(item.status)) return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function statusKey(item: InboxItem) {
  if (item.kind === "approval") return `inbox.status.approval.${item.status}`;
  if (item.kind === "cc") return "inbox.status.cc";
  return `inbox.status.signature.${item.status}`;
}

export default function InboxPage() {
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("actionRequired");
  const activeDateLocale = getDateFnsLocale(i18n.language);
  const activeDateFormat = getDateFormat(i18n.language, "dateTime");
  const utils = trpc.useUtils();
  const { data: items = [], isLoading, isError } = trpc.inbox.list.useQuery(undefined, {
    retry: false,
  });

  const actionRequiredCount = useMemo(
    () => items.filter((item) => item.actionRequired).length,
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => filter === "all" || item.actionRequired)
      .filter((item) => {
        if (!q) return true;
        return [
          item.documentTitle,
          item.subject,
          item.fromName,
          item.fromEmail,
          item.bodyPreview,
        ].some((value) => value?.toLowerCase().includes(q));
      });
  }, [filter, items, searchQuery]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                <Inbox className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{t("nav.inbox")}</h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  {actionRequiredCount > 0
                    ? t("inbox.pendingCount", { count: actionRequiredCount })
                    : t("inbox.noPending")}
                </p>
              </div>
            </div>
            <div className="flex rounded-md border bg-white p-1">
              <button
                className={`rounded px-3 py-1.5 text-sm ${filter === "actionRequired" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                onClick={() => setFilter("actionRequired")}
              >
                {t("inbox.filterActionRequired")}
              </button>
              <button
                className={`rounded px-3 py-1.5 text-sm ${filter === "all" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                onClick={() => setFilter("all")}
              >
                {t("inbox.filterAll")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="bg-white pl-9"
            placeholder={t("inbox.searchPlaceholder")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        {isLoading ? (
          <InboxLoadingState t={t} isLoading={isLoading} />
        ) : isError ? (
          <div className="rounded-lg border bg-white py-16 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">{t("errors.serverError")}</h3>
            <p className="mb-4 text-gray-500">{t("errors.tryAgain")}</p>
            <Button variant="outline" onClick={() => utils.inbox.list.invalidate()}>
              {t("errors.tryAgain")}
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-lg border bg-white py-16 text-center">
            <MailOpen className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              {searchQuery ? t("inbox.noResults") : t("inbox.empty")}
            </h3>
            <p className="text-gray-500">
              {searchQuery ? t("inbox.noResultsDesc") : t("inbox.emptyDesc")}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="grid grid-cols-[1fr_140px_170px] gap-4 border-b bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 max-md:hidden">
              <span>{t("inbox.colMessage")}</span>
              <span>{t("inbox.colStatus")}</span>
              <span>{t("inbox.colUpdated")}</span>
            </div>
            {filteredItems.map((item) => {
              const Icon = kindIcon(item.kind);
              return (
                <button
                  key={`${item.kind}:${item.id}`}
                  className="grid w-full grid-cols-[1fr_140px_170px] gap-4 border-b px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-gray-50 max-md:grid-cols-1 max-md:gap-2"
                  onClick={() => navigate(`/dashboard/inbox/${item.kind}/${item.id}`)}
                >
                  <div className="flex min-w-0 gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {item.actionRequired && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />}
                        <p className="truncate font-medium text-gray-900">{item.subject}</p>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-gray-500">
                        {item.fromName || item.fromEmail || "Hundredth Sign"}
                      </p>
                      <p className="mt-1 truncate text-sm text-gray-500">
                        {item.bodyPreview || t(`inbox.preview.${item.kind}`, { title: item.documentTitle })}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Badge variant="outline" className={statusTone(item)}>
                      {item.actionRequired ? <Clock className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {t(statusKey(item), { defaultValue: item.status })}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500">
                    {format(new Date(item.updatedAt), activeDateFormat, { locale: activeDateLocale })}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function InboxLoadingState({ t, isLoading }: { t: (key: string) => string; isLoading: boolean }) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 15_000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (timedOut) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center">
        <p className="mb-4 text-gray-500">{t("common.loadingTimeout")}</p>
        <Button onClick={() => window.location.reload()}>{t("common.reload")}</Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-12 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
    </div>
  );
}
