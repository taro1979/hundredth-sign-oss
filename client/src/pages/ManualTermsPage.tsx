import ManualLayout from "./ManualLayout";
import { useTranslation } from "react-i18next";

const termsSections = [
  {
    titleKey: "manual.terms.sections.scope.title",
    bodyKeys: [
      "manual.terms.sections.scope.body.0",
      "manual.terms.sections.scope.body.1",
      "manual.terms.sections.scope.body.2",
    ],
  },
  {
    titleKey: "manual.terms.sections.license.title",
    bodyKeys: [
      "manual.terms.sections.license.body.0",
      "manual.terms.sections.license.body.1",
      "manual.terms.sections.license.body.2",
    ],
  },
  {
    titleKey: "manual.terms.sections.operator.title",
    bodyKeys: [
      "manual.terms.sections.operator.body.0",
      "manual.terms.sections.operator.body.1",
      "manual.terms.sections.operator.body.2",
      "manual.terms.sections.operator.body.3",
    ],
  },
  {
    titleKey: "manual.terms.sections.accounts.title",
    bodyKeys: [
      "manual.terms.sections.accounts.body.0",
      "manual.terms.sections.accounts.body.1",
      "manual.terms.sections.accounts.body.2",
    ],
  },
  {
    titleKey: "manual.terms.sections.integrations.title",
    bodyKeys: [
      "manual.terms.sections.integrations.body.0",
      "manual.terms.sections.integrations.body.1",
      "manual.terms.sections.integrations.body.2",
    ],
  },
  {
    titleKey: "manual.terms.sections.data.title",
    bodyKeys: [
      "manual.terms.sections.data.body.0",
      "manual.terms.sections.data.body.1",
      "manual.terms.sections.data.body.2",
      "manual.terms.sections.data.body.3",
    ],
  },
  {
    titleKey: "manual.terms.sections.compliance.title",
    bodyKeys: [
      "manual.terms.sections.compliance.body.0",
      "manual.terms.sections.compliance.body.1",
      "manual.terms.sections.compliance.body.2",
      "manual.terms.sections.compliance.body.3",
    ],
  },
  {
    titleKey: "manual.terms.sections.prohibited.title",
    bodyKeys: [
      "manual.terms.sections.prohibited.body.0",
      "manual.terms.sections.prohibited.body.1",
      "manual.terms.sections.prohibited.body.2",
    ],
  },
  {
    titleKey: "manual.terms.sections.noSupport.title",
    bodyKeys: [
      "manual.terms.sections.noSupport.body.0",
      "manual.terms.sections.noSupport.body.1",
      "manual.terms.sections.noSupport.body.2",
    ],
  },
  {
    titleKey: "manual.terms.sections.customization.title",
    bodyKeys: [
      "manual.terms.sections.customization.body.0",
      "manual.terms.sections.customization.body.1",
      "manual.terms.sections.customization.body.2",
    ],
  },
  {
    titleKey: "manual.terms.sections.changes.title",
    bodyKeys: [
      "manual.terms.sections.changes.body.0",
      "manual.terms.sections.changes.body.1",
      "manual.terms.sections.changes.body.2",
    ],
  },
];

export default function ManualTermsPage() {
  const { t } = useTranslation();

  return (
    <ManualLayout
      activePath="/manual/terms"
      eyebrowKey="manual.terms.eyebrow"
      titleKey="manual.terms.title"
      descriptionKey="manual.terms.description"
    >
      <div className="grid gap-8">
        {termsSections.map(section => (
          <section
            key={section.titleKey}
            className="border-b border-slate-200 pb-8 last:border-b-0"
          >
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              {t(section.titleKey)}
            </h2>
            <div className="mt-4 space-y-4 text-base leading-7 text-slate-700">
              {section.bodyKeys.map(key => (
                <p key={key}>{t(key)}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ManualLayout>
  );
}
