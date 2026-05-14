/**
 * Language selector dropdown component
 * Shows UI-supported languages with native names
 */
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, LOCALE_LABELS, type SupportedLocale } from "@/lib/i18n";
import { resolveUiLocale } from "@shared/locales";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

interface LanguageSelectorProps {
  compact?: boolean;
  className?: string;
  variant?: "light" | "dark";
}

export default function LanguageSelector({ compact = false, className = "", variant = "light" }: LanguageSelectorProps) {
  const { i18n } = useTranslation();

  const handleChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  const currentLocale = resolveUiLocale(i18n.language) as SupportedLocale;

  const darkStyles = variant === "dark"
    ? "text-white/80 hover:text-white hover:bg-white/10"
    : "hover:bg-accent/50";

  if (compact) {
    return (
      <Select value={currentLocale} onValueChange={handleChange}>
        <SelectTrigger className={`w-auto gap-1.5 border-none bg-transparent transition-colors ${darkStyles} ${className}`}>
          <Globe className="h-4 w-4 opacity-70" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[400px]">
          {SUPPORTED_LOCALES.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {LOCALE_LABELS[locale]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={currentLocale} onValueChange={handleChange}>
      <SelectTrigger className={`w-[180px] ${className}`}>
        <Globe className="h-4 w-4 me-2 opacity-70" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {SUPPORTED_LOCALES.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
