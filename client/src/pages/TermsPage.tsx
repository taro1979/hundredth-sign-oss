import { useTranslation } from "react-i18next";
import LegalPageLayout from "@/components/LegalPageLayout";

export default function TermsPage() {
  const { t } = useTranslation();

  const sections = [
    "acceptance",
    "serviceDescription",
    "electronicSignatures",
    "userObligations",
    "prohibited",
    "intellectualProperty",
    "privacy",
    "limitation",
    "termination",
    "governingLaw",
    "changes",
  ] as const;

  return (
    <LegalPageLayout>
      <h1>{t("legal.terms.title")}</h1>
      <p className="text-sm text-slate-500">{t("legal.terms.lastUpdated")}</p>

      {sections.map((key) => (
        <section key={key}>
          <h2>{t(`legal.terms.sections.${key}.title`)}</h2>
          <p>{t(`legal.terms.sections.${key}.body`)}</p>
        </section>
      ))}
    </LegalPageLayout>
  );
}
