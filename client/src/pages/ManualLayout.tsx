import {
  BookOpen,
  ClipboardCheck,
  Code2,
  Database,
  FileText,
  Gauge,
  HelpCircle,
  Inbox,
  Languages,
  LucideIcon,
  Mail,
  Network,
  Route,
  Scale,
  Send,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Stamp,
  TerminalSquare,
  UserCog,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

type ManualNavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
};

const manualNavItems: ManualNavItem[] = [
  { href: "/manual", labelKey: "manual.nav.intro", icon: BookOpen },
  { href: "/manual/users-routes", labelKey: "manual.nav.usersRoutes", icon: Route },
  { href: "/manual/setup", labelKey: "manual.nav.setup", icon: ServerCog },
  { href: "/manual/auth-staff", labelKey: "manual.nav.authStaff", icon: UserCog },
  { href: "/manual/dashboard", labelKey: "manual.nav.dashboard", icon: Gauge },
  { href: "/manual/documents", labelKey: "manual.nav.documents", icon: FileText },
  { href: "/manual/signing", labelKey: "manual.nav.signing", icon: Send },
  {
    href: "/manual/internal-approval",
    labelKey: "manual.nav.internalApproval",
    icon: ClipboardCheck,
  },
  { href: "/manual/inbox", labelKey: "manual.nav.inbox", icon: Inbox },
  { href: "/manual/templates", labelKey: "manual.nav.templates", icon: Stamp },
  { href: "/manual/contacts", labelKey: "manual.nav.contacts", icon: Users },
  { href: "/manual/compliance", labelKey: "manual.nav.compliance", icon: ShieldCheck },
  { href: "/manual/email-locales", labelKey: "manual.nav.emailLocales", icon: Languages },
  { href: "/manual/api", labelKey: "manual.nav.api", icon: Network },
  { href: "/manual/cli", labelKey: "manual.nav.cli", icon: TerminalSquare },
  { href: "/manual/data-model", labelKey: "manual.nav.dataModel", icon: Database },
  { href: "/manual/operations", labelKey: "manual.nav.operations", icon: HelpCircle },
  { href: "/manual/developer", labelKey: "manual.nav.developer", icon: Code2 },
  { href: "/manual/terms", labelKey: "manual.nav.terms", icon: Scale },
  { href: "/manual/disclaimer", labelKey: "manual.nav.disclaimer", icon: ShieldAlert },
  { href: "/contact", labelKey: "manual.nav.contact", icon: Mail },
];

export function ManualLayout({
  activePath: _activePath,
  eyebrow,
  eyebrowKey,
  title,
  titleKey,
  description,
  descriptionKey,
  children,
}: {
  activePath?: string;
  eyebrow?: string;
  eyebrowKey?: string;
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const resolvedEyebrow = eyebrow ?? (eyebrowKey ? t(eyebrowKey) : "");
  const resolvedTitle = title ?? (titleKey ? t(titleKey) : "");
  const resolvedDescription = description ?? (descriptionKey ? t(descriptionKey) : "");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:px-8">
        <aside className="lg:w-72 lg:shrink-0">
          <div className="sticky top-24 rounded-md border bg-card p-3 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <div className="mb-3 px-2">
              <p className="text-sm font-semibold text-muted-foreground">{t("manual.nav.title")}</p>
            </div>
            <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-x-visible lg:pb-0">
              {manualNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground lg:min-w-0"
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <article className="min-w-0 flex-1">
          <div className="mb-8 border-b pb-8">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">{resolvedEyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{resolvedTitle}</h1>
            <p className="mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">{resolvedDescription}</p>
          </div>
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}

export default ManualLayout;
