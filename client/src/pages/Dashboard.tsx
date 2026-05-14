import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { FileText, Users, CheckCircle, Clock, Plus, Send, FolderOpen, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { getDateFnsLocale, getDateFormat } from "@/lib/locale";
import { parseActivityDetails } from "@/lib/activityDetails";

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: activities, isLoading: activitiesLoading } = trpc.dashboard.recentActivity.useQuery();
  const { t, i18n } = useTranslation();

  const activeDateLocale = getDateFnsLocale(i18n.language);
  const activeDateFormat = getDateFormat(i18n.language, "dateTime");

  const statCards = [
    { title: t("dashboard.totalDocuments"), value: stats?.totalDocuments ?? 0, icon: FileText, bg: "bg-emerald-50", text: "text-emerald-700" },
    { title: t("dashboard.pendingSignatures"), value: stats?.pendingSignatures ?? 0, icon: Clock, bg: "bg-amber-50", text: "text-amber-700" },
    { title: t("dashboard.completedDocuments"), value: stats?.completedDocuments ?? 0, icon: CheckCircle, bg: "bg-green-50", text: "text-green-700" },
    { title: t("documents.drafts"), value: stats?.draftDocuments ?? 0, icon: Users, bg: "bg-slate-50", text: "text-slate-700" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Welcome area — clean, no hype */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {t("dashboard.welcome")}、{user?.name ?? t("common.user")}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {t("dashboard.welcomeMessage")}
              </p>
            </div>
            <Button
              onClick={() => navigate("/dashboard/documents/new")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm"
            >
              <Plus className="w-4 h-4 me-2" />
              {t("documents.new")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <Card key={stat.title} className="bg-white shadow-sm border-0 ring-1 ring-gray-100">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.title}</p>
                    <p className="text-3xl font-bold mt-2 text-gray-900">
                      {statsLoading ? (
                        <span className="inline-block w-10 h-8 bg-gray-100 rounded animate-pulse" />
                      ) : stat.value}
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.text}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">{t("dashboard.quickActions")}</h2>
            <div className="space-y-2">
              {[
                { icon: Plus, label: t("dashboard.newDocument"), path: "/dashboard/documents/new", accent: true },
                { icon: FolderOpen, label: t("dashboard.viewAll"), path: "/dashboard/documents" },
                { icon: Users, label: t("contacts.title"), path: "/dashboard/contacts" },
                { icon: FileText, label: t("nav.templates"), path: "/dashboard/templates" },
              ].map((action) => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                    action.accent
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200/50"
                      : "bg-white text-gray-700 hover:bg-gray-50 ring-1 ring-gray-100"
                  }`}
                >
                  <action.icon className={`w-4 h-4 ${action.accent ? "text-emerald-600" : "text-gray-400"}`} />
                  <span className="flex-1 text-start">{action.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">{t("dashboard.recentDocuments")}</h2>
            <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-100">
              <CardContent className="p-0">
                {activitiesLoading ? (
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse flex items-center gap-4">
                        <div className="w-9 h-9 bg-gray-100 rounded-xl" />
                        <div className="flex-1">
                          <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-gray-100 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activities && activities.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {activities.slice(0, 8).map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                        <div className={`p-2 rounded-lg mt-0.5 ${
                          activity.action.includes("signed") ? "bg-green-50" :
                          activity.action.includes("sent") || activity.action.includes("requested") ? "bg-blue-50" :
                          activity.action.includes("created") ? "bg-emerald-50" : "bg-gray-50"
                        }`}>
                          {activity.action.includes("created") ? (
                            <Plus className="w-3.5 h-3.5 text-emerald-600" />
                          ) : activity.action.includes("signed") ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          ) : activity.action.includes("sent") || activity.action.includes("requested") ? (
                            <Send className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 leading-snug">
                            {parseActivityDetails(activity.details, t, activity.action)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {format(new Date(activity.createdAt), activeDateFormat, { locale: activeDateLocale })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 px-6">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-7 h-7 text-emerald-400" />
                    </div>
                    <p className="text-gray-600 font-medium">{t("common.noData")}</p>
                    <p className="text-sm text-gray-400 mt-1">{t("documents.createFirst")}</p>
                    <Button
                      onClick={() => navigate("/dashboard/documents/new")}
                      className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 me-2" />
                      {t("documents.new")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
