import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import {
  Plus, FileText, MoreVertical, Trash2, Eye, Download,
  Search, Send, CheckCircle2, PenLine, ChevronDown,
  X, Clock, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { getDateFnsLocale, getDateFormat } from "@/lib/locale";

// Sidebar categories matching Hundredth Sign's envelope view
type ViewCategory = "sent" | "completed" | "action_required" | "drafts" | "all";

const RAW_TRANSLATION_KEY_PATTERN =
  /^\s*(documents|common|templates|nav|landing|dashboard|organization|contacts|signing)\.[A-Za-z0-9_.-]+\s*$/i;

const SIDEBAR_ITEMS: { id: ViewCategory; labelKey: string; icon: React.ReactNode }[] = [
  { id: "sent", labelKey: "documents.sent", icon: <Send className="w-4 h-4" /> },
  { id: "completed", labelKey: "documents.completed", icon: <CheckCircle2 className="w-4 h-4" /> },
  { id: "action_required", labelKey: "documents.actionRequired", icon: <PenLine className="w-4 h-4" /> },
  { id: "drafts", labelKey: "documents.drafts", icon: <FileText className="w-4 h-4" /> },
];


export default function Documents() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const safeT = (key: string, fallback: string) => {
    const translated = t(key, { defaultValue: fallback });
    return translated === key ? fallback : translated;
  };
  const normalizeFileName = (value: string | null | undefined): string | null => {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    return RAW_TRANSLATION_KEY_PATTERN.test(normalized) ? null : normalized;
  };

  const activeDateLocale = getDateFnsLocale(i18n.language);
  const activeDateFormat = getDateFormat(i18n.language, "date");
  const activeTimeFormat = getDateFormat(i18n.language, "time");

  const STATUS_DISPLAY = useMemo(() => ({
    draft: { label: t("documents.status.draft"), color: "text-gray-600", bgColor: "bg-gray-100", icon: <FileText className="w-3.5 h-3.5" /> },
    sent: { label: t("documents.status.sent"), color: "text-blue-600", bgColor: "bg-blue-50", icon: <Send className="w-3.5 h-3.5" /> },
    completed: { label: t("documents.status.completed"), color: "text-green-600", bgColor: "bg-green-50", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    declined: { label: t("documents.status.declined"), color: "text-red-600", bgColor: "bg-red-50", icon: <X className="w-3.5 h-3.5" /> },
    voided: { label: t("documents.status.voided"), color: "text-gray-500", bgColor: "bg-gray-100", icon: <X className="w-3.5 h-3.5" /> },
    expired: { label: t("documents.status.expired"), color: "text-orange-600", bgColor: "bg-orange-50", icon: <X className="w-3.5 h-3.5" /> },
    pending_internal_approval: { label: t("documents.status.pending_internal_approval"), color: "text-amber-600", bgColor: "bg-amber-50", icon: <Clock className="w-3.5 h-3.5" /> },
  }), [t]);

  const DATE_FILTER_OPTIONS = useMemo(() => [
    { value: "all", label: t("documents.dateFilter.all") },
    { value: "7d", label: t("documents.dateFilter.7d") },
    { value: "30d", label: t("documents.dateFilter.30d") },
    { value: "90d", label: t("documents.dateFilter.90d") },
    { value: "6m", label: t("documents.dateFilter.6m") },
    { value: "1y", label: t("documents.dateFilter.1y") },
  ], [t]);
  const [activeView, setActiveView] = useState<ViewCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const { data: documents, isLoading, isError } = trpc.documents.list.useQuery();

  const deleteMutation = trpc.documents.delete.useMutation();
  const resendReminderMutation = trpc.documents.resendReminder.useMutation({
    onSuccess: () => {
      toast.success(t("documents.sendReminderSuccess"));
    },
    onError: (err) => toast.error(t(err.message, { defaultValue: err.message })),
  });
  const utils = trpc.useUtils();

  // Filter documents based on active view, search, date, and status
  const filteredDocs = useMemo(() => {
    if (!documents) return [];

    let docs = [...documents];

    // View category filter
    switch (activeView) {
      case "sent":
        docs = docs.filter(d => d.status === "sent");
        break;
      case "completed":
        docs = docs.filter(d => d.status === "completed");
        break;
      case "action_required":
        docs = docs.filter(d => d.status === "sent" || d.status === "declined");
        break;
      case "drafts":
        docs = docs.filter(d => d.status === "draft");
        break;
      case "all":
      default:
        break;
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.fileName?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      docs = docs.filter(d => d.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = Date.now();
      const msMap: Record<string, number> = {
        "7d": 7 * 86400000,
        "30d": 30 * 86400000,
        "90d": 90 * 86400000,
        "6m": 180 * 86400000,
        "1y": 365 * 86400000,
      };
      const cutoff = now - (msMap[dateFilter] ?? 0);
      docs = docs.filter(d => new Date(d.updatedAt).getTime() >= cutoff);
    }

    return docs;
  }, [documents, activeView, searchQuery, dateFilter, statusFilter]);

  const selectedVisibleDocs = useMemo(
    () => filteredDocs.filter(doc => selectedDocs.has(doc.id)),
    [filteredDocs, selectedDocs],
  );

  const toggleDocSelection = (id: number) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSelection = () => {
    setSelectedDocs(prev => {
      const visibleIds = filteredDocs.map(d => d.id);
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => prev.has(id));
      if (allVisibleSelected) {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      }
      return new Set([...Array.from(prev), ...visibleIds]);
    });
  };

  const handleDeleteDocument = async (id: number) => {
    if (!window.confirm(t("documents.deleteConfirmPermanent"))) return;
    try {
      await deleteMutation.mutateAsync({ id });
      setSelectedDocs(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success(t("documents.deleteSuccess"));
      await utils.documents.list.invalidate();
    } catch (err: any) {
      toast.error(t(err?.message, { defaultValue: t("documents.deleteFailed") }));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVisibleDocs.length === 0) return;
    if (!window.confirm(t("documents.deleteConfirmPermanent"))) return;
    const ids = selectedVisibleDocs.map(doc => doc.id);
    try {
      for (const id of ids) {
        await deleteMutation.mutateAsync({ id });
      }
      setSelectedDocs(new Set());
      toast.success(t("documents.deleteSuccess"));
      await utils.documents.list.invalidate();
    } catch (err: any) {
      toast.error(t(err?.message, { defaultValue: t("documents.deleteFailed") }));
      await utils.documents.list.invalidate();
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("all");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchQuery || dateFilter !== "all" || statusFilter !== "all";

  // Count for sidebar badges
  const counts = useMemo(() => {
    if (!documents) return { sent: 0, completed: 0, action_required: 0, drafts: 0, all: 0 };
    return {
      sent: documents.filter(d => d.status === "sent").length,
      completed: documents.filter(d => d.status === "completed").length,
      action_required: documents.filter(d => d.status === "sent" || d.status === "declined").length,
      drafts: documents.filter(d => d.status === "draft").length,
      all: documents.length,
    };
  }, [documents]);

  const viewTitle = activeView === "all" ? t("documents.all") : t(SIDEBAR_ITEMS.find(i => i.id === activeView)?.labelKey ?? "documents.all");

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {activeView === "all" ? t("documents.all") : viewTitle}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {counts.all}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-52 flex-shrink-0 hidden lg:block">
            <div className="bg-white rounded-lg border p-3">
          <div className="mb-2">
            <button
              onClick={() => { setActiveView("all"); setSelectedDocs(new Set()); }}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === "all"
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>{t("documents.all")}</span>
              <span className="text-xs text-gray-400">{counts.all}</span>
            </button>
          </div>

          <div className="space-y-0.5">
            <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t("common.status")}
            </p>
            {SIDEBAR_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveView(item.id); setSelectedDocs(new Set()); }}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm transition-colors ${
                  activeView === item.id
                    ? "bg-emerald-50 text-emerald-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{t(item.labelKey)}</span>
                </div>
                {counts[item.id] > 0 && (
                  <span className={`text-xs ${activeView === item.id ? "text-emerald-500" : "text-gray-400"}`}>
                    {counts[item.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Search & Filters Bar */}
            <div className="bg-white rounded-lg border p-4 mb-4">
              <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={safeT("documents.searchPlaceholder", "譁・嶌繧呈､懃ｴ｢...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder={t("common.date")} />
              </SelectTrigger>
              <SelectContent>
                {DATE_FILTER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeView === "all" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder={t("common.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")} ({t("common.status")})</SelectItem>
                  <SelectItem value="draft">{t("documents.status.draft")}</SelectItem>
                  <SelectItem value="sent">{t("documents.status.sent")}</SelectItem>
                  <SelectItem value="completed">{t("documents.status.completed")}</SelectItem>
                  <SelectItem value="declined">{t("documents.status.declined")}</SelectItem>
                  <SelectItem value="voided">{t("documents.status.voided")}</SelectItem>
                  <SelectItem value="pending_internal_approval">{t("documents.status.pending_internal_approval")}</SelectItem>
                </SelectContent>
              </Select>
            )}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500 h-9">
                {safeT("documents.filterClear", t("common.filter"))}
              </Button>
            )}

            {selectedVisibleDocs.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={deleteMutation.isPending}
                className="h-9"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t("documents.bulkDeleteSelected", { count: selectedVisibleDocs.length })}
              </Button>
            )}
              </div>
            </div>

            {/* Mobile Category Tabs */}
            <div className="lg:hidden bg-white rounded-lg border overflow-x-auto mb-4">
          <div className="flex px-4 gap-1">
            <button
              onClick={() => setActiveView("all")}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${
                activeView === "all" ? "border-emerald-600 text-emerald-700 font-medium" : "border-transparent text-gray-500"
              }`}
            >
              {t("documents.all")}
            </button>
            {SIDEBAR_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${
                  activeView === item.id ? "border-emerald-600 text-emerald-700 font-medium" : "border-transparent text-gray-500"
                }`}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
            </div>

            {/* Table */}
            <div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 bg-gray-200 rounded" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                    </div>
                    <div className="h-6 w-16 bg-gray-200 rounded-full" />
                    <div className="h-4 w-24 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="bg-white rounded-lg border py-16 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("errors.serverError")}</h3>
              <p className="text-gray-500 mb-4">{t("errors.tryAgain")}</p>
              <Button variant="outline" onClick={() => utils.documents.list.invalidate()}>
                {t("errors.tryAgain")}
              </Button>
            </div>
          ) : filteredDocs.length > 0 ? (
            <div className="bg-white rounded-lg border overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[auto_1fr_140px_160px_170px] gap-4 px-4 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="flex items-center">
                  <Checkbox
                    checked={selectedVisibleDocs.length === filteredDocs.length && filteredDocs.length > 0}
                    onCheckedChange={toggleAllSelection}
                  />
                </div>
                <span>{t("documents.colDocument")}</span>
                <span>{t("common.status")}</span>
                <span className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                  {t("common.updatedAt")} <ChevronDown className="w-3 h-3" />
                </span>
                <span className="text-right">{t("common.actions")}</span>
              </div>

              {/* Table Rows */}
              {filteredDocs.map(doc => {
                const status = STATUS_DISPLAY[doc.status] ?? { label: doc.status, color: "text-gray-600", bgColor: "bg-gray-100", icon: null };
                const isSelected = selectedDocs.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    className={`grid grid-cols-[auto_1fr_140px_160px_170px] gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer items-center transition-colors ${
                      isSelected ? "bg-emerald-50/50" : ""
                    }`}
                    onClick={() => navigate(`/dashboard/documents/${doc.id}`)}
                  >
                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleDocSelection(doc.id)}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {normalizeFileName(doc.fileName) ?? safeT("documents.noPdf", "PDF N/A")}
                      </p>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(doc.updatedAt), activeDateFormat, { locale: activeDateLocale })}
                      <br />
                      <span className="text-xs">{format(new Date(doc.updatedAt), activeTimeFormat, { locale: activeDateLocale })}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {doc.status === "completed" && doc.signedFileUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => window.open(doc.signedFileUrl!, "_blank")}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          {t("common.download")}
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/documents/${doc.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            {safeT("documents.detailView", t("common.edit"))}
                          </DropdownMenuItem>
                          {doc.status === "sent" && (
                            <DropdownMenuItem
                              onClick={() => {
                                resendReminderMutation.mutate({ id: doc.id });
                              }}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              {safeT("documents.resendReminder", t("documents.detail.resend"))}
                            </DropdownMenuItem>
                          )}
                          {doc.status === "draft" && (
                            <DropdownMenuItem onClick={() => navigate(`/dashboard/documents/new?draftId=${doc.id}`)}>
                              <PenLine className="w-4 h-4 mr-2" />
                              {safeT("documents.continueEdit", t("common.edit"))}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-red-600"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              void handleDeleteDocument(doc.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={hasActiveFilters ? t("common.noData") : t("documents.noDocuments")}
              description={hasActiveFilters ? t("documents.filterClear") : t("documents.createFirst")}
              action={!hasActiveFilters ? (
                <Button onClick={() => navigate("/dashboard/documents/new")} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("documents.new")}
                </Button>
              ) : undefined}
            />
          )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
// eslint-disable-next-line
function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border py-16 text-center">
      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6">{description}</p>
      {action}
    </div>
  );
}
