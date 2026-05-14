import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import LanguageSelector from "@/components/LanguageSelector";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { label: t("landing.navFeatures"), href: "#features" },
    { label: t("landing.navFaq"), href: "#faq" },
  ];
  const showHomeNav = location === "/";

  // Transparent on hero, solid white on scroll
  const headerBg = scrolled
    ? "bg-white/95 backdrop-blur-xl border-b border-gray-200/50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    : "bg-transparent";

  const navTextColor = "text-gray-500 hover:text-gray-900 hover:bg-gray-50/80";
  const ctaTextColor = "text-gray-600 hover:text-gray-900";
  const mobileButtonColor = "text-gray-600 hover:text-gray-900";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBg}`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-20 pt-3">
        {/* Logo */}
        <a href="/" className="flex items-center gap-0 shrink-0">
          <span className="text-lg font-semibold tracking-tight text-gray-950">
            Hundredth Sign
          </span>
        </a>

        {/* Desktop Nav */}
        {showHomeNav ? (
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`px-4 py-2 text-sm transition-colors font-medium rounded-lg ${navTextColor}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : (
          <div className="hidden md:block" />
        )}

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSelector compact variant="light" />
          {isAuthenticated ? (
            <button
              onClick={() => navigate("/dashboard")}
              className={`text-sm transition-colors font-medium px-3 py-2 ${ctaTextColor}`}
            >
              {t("nav.dashboard")}
            </button>
          ) : (
            <a
              href={getLoginUrl()}
              className={`text-sm transition-colors font-medium px-3 py-2 ${ctaTextColor}`}
            >
              {t("nav.login")}
            </a>
          )}
          <a
            href={isAuthenticated ? "/dashboard" : getLoginUrl()}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md"
          >
            {t("landing.getStarted")}
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          className={`md:hidden p-2 rounded-lg ${mobileButtonColor}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white/98 backdrop-blur-xl border-b border-gray-200/50 overflow-hidden"
          >
            <div className="px-6 py-4 space-y-1">
              {showHomeNav
                ? navItems.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={(e) => {
                        e.preventDefault();
                        setMobileMenuOpen(false);
                        setTimeout(() => {
                          document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth" });
                        }, 300);
                      }}
                      className="block px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
                    >
                      {item.label}
                    </a>
                  ))
                : null}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <LanguageSelector compact variant="light" />
                {isAuthenticated ? (
                  <button
                    onClick={() => { navigate("/dashboard"); setMobileMenuOpen(false); }}
                    className="block w-full text-start px-3 py-2 text-sm text-emerald-700 font-semibold"
                  >
                    {t("nav.dashboard")}
                  </button>
                ) : (
                  <a href={getLoginUrl()} className="block px-3 py-2 text-sm text-gray-600">
                    {t("nav.login")}
                  </a>
                )}
                <a
                  href={isAuthenticated ? "/dashboard" : getLoginUrl()}
                  className="block text-center px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  {t("landing.getStarted")}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
