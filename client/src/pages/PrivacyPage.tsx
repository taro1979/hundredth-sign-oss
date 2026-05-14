import { useTranslation } from "react-i18next";
import LegalPageLayout from "@/components/LegalPageLayout";

export default function PrivacyPage() {
  const { t } = useTranslation();

  const sections = [
    "overview",
    "dataCollected",
    "purpose",
    "thirdParty",
    "cookies",
    "retention",
    "rights",
    "security",
    "contact",
  ] as const;

  return (
    <LegalPageLayout>
      <h1>{t("legal.privacy.title")}</h1>
      <p className="text-sm text-slate-500">{t("legal.privacy.lastUpdated")}</p>

      {sections.map((key) => (
        <section key={key}>
          <h2>{t(`legal.privacy.sections.${key}.title`)}</h2>
          <p>{t(`legal.privacy.sections.${key}.body`)}</p>
        </section>
      ))}
    </LegalPageLayout>
  );
}
