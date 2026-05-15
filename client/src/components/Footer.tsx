import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import LanguageSelector from "@/components/LanguageSelector";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-[#0F172A]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <div className="text-lg font-semibold tracking-tight text-white">
              Hundredth Sign
            </div>
            <p className="mt-4 text-sm text-gray-400 leading-relaxed max-w-sm [text-wrap:pretty]">
              {t("footer.tagline")}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-gray-500 max-w-sm [text-wrap:pretty]">
              {t("footer.licenseNotice")}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
              {t("footer.product")}
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="#features"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {t("landing.navFeatures")}
                </a>
              </li>
              <li>
                <a
                  href="#security"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {t("footer.security")}
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {t("landing.navFaq")}
                </a>
              </li>
              <li>
                <Link
                  href="/manual"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {t("footer.manual")}
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {t("footer.customizationContact")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
              {t("footer.legal")}
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {t("footer.privacy")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Language */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
              {t("footer.language")}
            </h4>
            <LanguageSelector compact variant="dark" />
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} {t("landing.pageTitle")}
          </p>
          <p className="text-xs text-gray-500">{t("footer.madeIn")}</p>
        </div>
      </div>
    </footer>
  );
}
