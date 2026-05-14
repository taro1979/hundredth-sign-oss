import ManualLayout from "./ManualLayout";
import { useTranslation } from "react-i18next";

const disclaimerSections = [
  {
    titleKey: "manual.disclaimer.sections.warranty.title",
    bodyKeys: [
      "manual.disclaimer.sections.warranty.body.0",
      "manual.disclaimer.sections.warranty.body.1",
      "manual.disclaimer.sections.warranty.body.2",
      "manual.disclaimer.sections.warranty.body.3",
    ],
  },
  {
    titleKey: "manual.disclaimer.sections.legal.title",
    bodyKeys: [
      "manual.disclaimer.sections.legal.body.0",
      "manual.disclaimer.sections.legal.body.1",
      "manual.disclaimer.sections.legal.body.2",
      "manual.disclaimer.sections.legal.body.3",
    ],
  },
  {
    titleKey: "manual.disclaimer.sections.compliance.title",
    bodyKeys: [
      "manual.disclaimer.sections.compliance.body.0",
      "manual.disclaimer.sections.compliance.body.1",
      "manual.disclaimer.sections.compliance.body.2",
      "manual.disclaimer.sections.compliance.body.3",
    ],
  },
  {
    titleKey: "manual.disclaimer.sections.security.title",
    bodyKeys: [
      "manual.disclaimer.sections.security.body.0",
      "manual.disclaimer.sections.security.body.1",
      "manual.disclaimer.sections.security.body.2",
      "manual.disclaimer.sections.security.body.3",
    ],
  },
  {
    titleKey: "manual.disclaimer.sections.data.title",
    bodyKeys: [
      "manual.disclaimer.sections.data.body.0",
      "manual.disclaimer.sections.data.body.1",
      "manual.disclaimer.sections.data.body.2",
      "manual.disclaimer.sections.data.body.3",
    ],
  },
  {
    titleKey: "manual.disclaimer.sections.integrations.title",
    bodyKeys: [
      "manual.disclaimer.sections.integrations.body.0",
      "manual.disclaimer.sections.integrations.body.1",
      "manual.disclaimer.sections.integrations.body.2",
    ],
  },
  {
    titleKey: "manual.disclaimer.sections.ai.title",
    bodyKeys: [
      "manual.disclaimer.sections.ai.body.0",
      "manual.disclaimer.sections.ai.body.1",
      "manual.disclaimer.sections.ai.body.2",
    ],
  },
  {
    titleKey: "manual.disclaimer.sections.customization.title",
    bodyKeys: [
      "manual.disclaimer.sections.customization.body.0",
      "manual.disclaimer.sections.customization.body.1",
      "manual.disclaimer.sections.customization.body.2",
    ],
  },
  {
    titleKey: "manual.disclaimer.sections.references.title",
    bodyKeys: [
      "manual.disclaimer.sections.references.body.0",
      "manual.disclaimer.sections.references.body.1",
      "manual.disclaimer.sections.references.body.2",
    ],
  },
];

export default function ManualDisclaimerPage() {
  const { t } = useTranslation();

  return (
    <ManualLayout
      activePath="/manual/disclaimer"
      eyebrowKey="manual.disclaimer.eyebrow"
      titleKey="manual.disclaimer.title"
      descriptionKey="manual.disclaimer.description"
    >
      <div className="grid gap-8">
        {disclaimerSections.map(section => (
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
