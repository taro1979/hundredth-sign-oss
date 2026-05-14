import ManualLayout from "./ManualLayout";
import { CheckCircle2, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

const contactEmail = "infibilitis.th@gmail.com";

export default function OssCustomizationContactPage() {
  const { t } = useTranslation();
  const requestKeys = [
    "ossContact.requestItems.0",
    "ossContact.requestItems.1",
    "ossContact.requestItems.2",
    "ossContact.requestItems.3",
  ];

  return (
    <ManualLayout
      activePath="/contact"
      eyebrowKey="ossContact.eyebrow"
      titleKey="ossContact.title"
      descriptionKey="ossContact.description"
    >
      <div className="max-w-3xl space-y-8">
        <section className="space-y-4 text-base leading-7 text-slate-700">
          <p>{t("ossContact.body.0")}</p>
          <p>{t("ossContact.body.1")}</p>
          <p>{t("ossContact.body.2")}</p>
          <p>{t("ossContact.body.3")}</p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-950">
            {t("ossContact.requestTitle")}
          </h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
            {requestKeys.map(key => (
              <li key={key} className="flex gap-3">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-xl font-semibold text-slate-950">
            {t("ossContact.emailTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {t("ossContact.emailDescription")}
          </p>
          <a
            href={`mailto:${contactEmail}`}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <Mail className="h-4 w-4" />
            <span>{contactEmail}</span>
          </a>
        </section>
      </div>
    </ManualLayout>
  );
}
