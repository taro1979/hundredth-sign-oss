import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { hasConsented, setConsent } from "@/lib/cookieConsent";

export default function CookieConsentBanner() {
  const { t } = useTranslation();
  // Lazy initializer avoids flash: banner is shown/hidden synchronously on first render
  const [visible, setVisible] = useState(() => !hasConsented());

  if (!visible) return null;

  function handleAcceptAll() {
    setConsent(true);
    setVisible(false);
  }

  function handleEssentialOnly() {
    setConsent(false);
    setVisible(false);
  }

  return (
    <div
      role="banner"
      aria-label={t("cookieConsent.ariaLabel")}
      className="fixed bottom-0 inset-x-0 z-50 bg-slate-900 text-white shadow-2xl border-t border-slate-700"
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="flex-1 text-sm text-slate-300 leading-relaxed">
          {t("cookieConsent.message")}{" "}
          <Link href="/privacy" className="underline text-emerald-400 hover:text-emerald-300">
            {t("cookieConsent.learnMore")}
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleEssentialOnly}
            className="px-4 py-2 text-sm rounded-lg border border-slate-500 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            {t("cookieConsent.essentialOnly")}
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            {t("cookieConsent.acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}
