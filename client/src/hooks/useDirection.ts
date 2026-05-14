/**
 * Hook to manage document direction (LTR/RTL) based on current language
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLocale } from "@/lib/i18n";

export function useDirection() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const isRtl = isRtlLocale(i18n.language);
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
}
