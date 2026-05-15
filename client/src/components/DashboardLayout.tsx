import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  type SupportedLocale,
} from "@/lib/i18n";
import { resolveUiLocale } from "@shared/locales";
import {
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  FolderOpen,
  Globe,
  Home,
  Inbox,
  LayoutTemplate,
  LogOut,
  PanelLeft,
  Plus,
  Settings,
  Upload,
  User,
  Users,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

type NavItem = {
  labelKey: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { labelKey: "nav.dashboard", path: "/dashboard", icon: Home },
  { labelKey: "nav.documents", path: "/dashboard/documents", icon: FileText },
  { labelKey: "nav.inbox", path: "/dashboard/inbox", icon: Inbox },
  { labelKey: "nav.contacts", path: "/dashboard/contacts", icon: Users },
  { labelKey: "nav.templates", path: "/dashboard/templates", icon: FolderOpen },
  { labelKey: "nav.settings", path: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const { t, i18n } = useTranslation();
  const currentLocale = resolveUiLocale(i18n.language) as SupportedLocale;
  const utils = trpc.useUtils();
  const updateLocale = trpc.user.updateLocale.useMutation({
    onMutate: ({ locale }: { locale: string }) => {
      const nextLocale = resolveUiLocale(locale) as SupportedLocale;
      utils.auth.me.setData(undefined, (current: typeof user | undefined) =>
        current ? { ...current, locale: nextLocale } : current
      );
    },
  });
  const { data: inboxCount = 0 } = trpc.inbox.countActionRequired.useQuery(
    undefined,
    {
      enabled: Boolean(user?.email),
      refetchInterval: 60_000,
      retry: false,
    }
  );

  useEffect(() => {
    if (!user?.locale) return;
    const savedLocale = resolveUiLocale(user.locale) as SupportedLocale;
    if (savedLocale !== currentLocale) {
      i18n.changeLanguage(savedLocale);
    }
  }, [currentLocale, i18n, user?.locale]);

  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : (user?.email?.slice(0, 2).toUpperCase() ?? "U");

  const activeNavItem = useMemo(() => {
    return navItems.find(item => {
      if (item.path === "/dashboard") return location === "/dashboard";
      return location === item.path || location.startsWith(`${item.path}/`);
    });
  }, [location]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleLocaleChange = (locale: SupportedLocale) => {
    i18n.changeLanguage(locale);
    updateLocale.mutate({ locale });
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0">
        <SidebarHeader className="px-2 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={toggleSidebar}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isCollapsed ? t("common.open") : t("common.close")}
            >
              <PanelLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            {!isCollapsed && (
              <button
                onClick={() => navigate("/dashboard")}
                className="min-w-0 text-left focus:outline-none"
              >
                <div className="text-sm font-semibold tracking-tight text-foreground">
                  Hundredth Sign
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("dashboard.brandSubtitle")}
                </div>
              </button>
            )}
          </div>
        </SidebarHeader>

        <SidebarGroup className="px-2 py-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className={`gap-2 bg-emerald-600 text-white hover:bg-emerald-700 ${
                  isCollapsed
                    ? "mx-auto h-9 w-9 justify-center px-0"
                    : "w-full justify-start"
                }`}
              >
                <Plus className="h-4 w-4 shrink-0" />
                {!isCollapsed && (
                  <>
                    <span>{t("common.create")}</span>
                    <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-70" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isCollapsed ? "right" : "bottom"}
              align="start"
              className="w-56"
            >
              <DropdownMenuItem
                onClick={() => navigate("/dashboard/documents/new")}
                className="gap-3 py-2.5"
              >
                <Upload className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium">
                    {t("dashboard.newDocUpload")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.newDocUploadDesc")}
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/dashboard/templates")}
                className="gap-3 py-2.5"
              >
                <LayoutTemplate className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">
                    {t("dashboard.newDocTemplate")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.newDocTemplateDesc")}
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarGroup>

        <SidebarContent className="mt-1 gap-0">
          <SidebarMenu className="px-2 py-1">
            {navItems.map(item => {
              const isActive =
                item.path === "/dashboard"
                  ? location === "/dashboard"
                  : location === item.path ||
                    location.startsWith(`${item.path}/`);
              const badgeCount =
                item.path === "/dashboard/inbox" ? inboxCount : 0;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => navigate(item.path)}
                    tooltip={t(item.labelKey)}
                    className="h-9 font-normal"
                  >
                    <item.icon
                      className={`h-4 w-4 shrink-0 ${isActive ? "text-emerald-600" : ""}`}
                    />
                    <span className="flex-1">{t(item.labelKey)}</span>
                    {badgeCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-xs font-medium text-white">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="gap-0 p-2">
          <SidebarMenu className="gap-0">
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t("nav.manual")}
                onClick={() => navigate("/manual")}
                className="h-9 font-normal text-muted-foreground hover:text-foreground"
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span>{t("nav.manual")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {!isCollapsed && (
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton className="h-9 font-normal text-muted-foreground hover:text-foreground">
                      <Globe className="h-4 w-4 shrink-0" />
                      <span>{LOCALE_LABELS[currentLocale]}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="start"
                    className="min-w-[160px]"
                  >
                    {SUPPORTED_LOCALES.map(locale => (
                      <DropdownMenuItem
                        key={locale}
                        onClick={() => handleLocaleChange(locale)}
                      >
                        {locale === currentLocale && (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        {locale !== currentLocale && (
                          <span className="mr-2 h-4 w-4" />
                        )}
                        {LOCALE_LABELS[locale]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            )}
          </SidebarMenu>

          <Separator className="my-2" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-8 w-8 shrink-0 border">
                  <AvatarFallback className="bg-emerald-100 text-xs font-semibold text-emerald-700">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-none">
                      {user?.name || user?.email || "-"}
                    </p>
                    {user?.name && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    )}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={isCollapsed ? "start" : "end"}
              side={isCollapsed ? "right" : "top"}
              className="w-48"
            >
              <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
                <User className="me-2 h-4 w-4" />
                {t("nav.profile")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("nav.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {isMobile && (
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="text-sm font-medium tracking-tight text-foreground">
                {activeNavItem ? t(activeNavItem.labelKey) : "Menu"}
              </span>
            </div>
            <Button
              size="icon"
              className="h-8 w-8 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => navigate("/dashboard/documents/new")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
        {children}
      </SidebarInset>
    </>
  );
}
