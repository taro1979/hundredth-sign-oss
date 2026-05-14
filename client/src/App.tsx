import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import DocumentNew from "./pages/DocumentNew";
import DocumentDetail from "./pages/DocumentDetail";
import InboxPage from "./pages/InboxPage";
import InboxDetailPage from "./pages/InboxDetailPage";
import Contacts from "./pages/Contacts";
import Templates from "./pages/Templates";
import SignDocument from "./pages/SignDocument";
import DocumentView from "./pages/DocumentView";
import ApprovePage from "./pages/ApprovePage";
import DashboardLayout from "./components/DashboardLayout";
import OrganizationSettings from "./pages/OrganizationSettings";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import ManualPage, { ManualChapterPage } from "./pages/ManualPage";
import ManualTermsPage from "./pages/ManualTermsPage";
import ManualDisclaimerPage from "./pages/ManualDisclaimerPage";
import OssCustomizationContactPage from "./pages/OssCustomizationContactPage";
import CookieConsentBanner from "./components/CookieConsentBanner";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import { useDirection } from "@/hooks/useDirection";
import { Suspense, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    if (timedOut) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">{t("common.loadingTimeout")}</p>
            <button
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              onClick={() => window.location.reload()}
            >
              {t("common.reload")}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAuthenticated) {
    window.location.href = getLoginUrl(window.location.pathname);
    return null;
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/setup" component={Setup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      {/* Public signing page - no auth required */}
      <Route path="/sign/:token" component={SignDocument} />
      {/* Public document view page - no auth required */}
      <Route path="/document-view/:token" component={DocumentView} />
      {/* Public approval page - no auth required */}
      <Route path="/approve/:token" component={ApprovePage} />
      {/* Authenticated dashboard routes */}
      <Route path="/dashboard">
        <AuthenticatedLayout>
          <Dashboard />
        </AuthenticatedLayout>
      </Route>
      <Route path="/dashboard/documents">
        <AuthenticatedLayout>
          <Documents />
        </AuthenticatedLayout>
      </Route>
      <Route path="/dashboard/documents/new">
        <AuthenticatedLayout>
          <DocumentNew />
        </AuthenticatedLayout>
      </Route>
      <Route path="/dashboard/documents/:id">
        {() => (
          <AuthenticatedLayout>
            <DocumentDetail />
          </AuthenticatedLayout>
        )}
      </Route>
      <Route path="/dashboard/inbox/:kind/:id">
        <AuthenticatedLayout>
          <InboxDetailPage />
        </AuthenticatedLayout>
      </Route>
      <Route path="/dashboard/inbox">
        <AuthenticatedLayout>
          <InboxPage />
        </AuthenticatedLayout>
      </Route>
      <Route path="/dashboard/contacts">
        <AuthenticatedLayout>
          <Contacts />
        </AuthenticatedLayout>
      </Route>
      <Route path="/dashboard/templates">
        <AuthenticatedLayout>
          <Templates />
        </AuthenticatedLayout>
      </Route>
      <Route path="/dashboard/settings">
        <AuthenticatedLayout>
          <OrganizationSettings />
        </AuthenticatedLayout>
      </Route>
      <Route path="/dashboard/organization">
        <AuthenticatedLayout>
          <OrganizationSettings />
        </AuthenticatedLayout>
      </Route>
      <Route path="/dashboard/audit-log">
        <AuthenticatedLayout>
          <OrganizationSettings />
        </AuthenticatedLayout>
      </Route>
      {/* Legal pages */}
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/manual" component={ManualPage} />
      <Route path="/manual/terms" component={ManualTermsPage} />
      <Route path="/manual/disclaimer" component={ManualDisclaimerPage} />
      <Route path="/manual/:chapter">
        {params => <ManualChapterPage chapterId={params.chapter} />}
      </Route>
      <Route path="/contact" component={OssCustomizationContactPage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function DirectionManager({ children }: { children: React.ReactNode }) {
  useDirection();
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        }
      >
        <ThemeProvider defaultTheme="light">
          <DirectionManager>
            <TooltipProvider>
              <Toaster />
              <Router />
              <CookieConsentBanner />
            </TooltipProvider>
          </DirectionManager>
        </ThemeProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
