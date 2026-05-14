import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Send,
  PenTool,
  Shield,
  Users,
  BarChart3,
  Stamp,
  Globe,
} from "lucide-react";

const features = [
  { icon: FileText, titleKey: "features.createTitle", descKey: "features.createDesc" },
  { icon: Send, titleKey: "features.sendTitle", descKey: "features.sendDesc" },
  { icon: PenTool, titleKey: "features.signTitle", descKey: "features.signDesc" },
  { icon: Stamp, titleKey: "features.stampTitle", descKey: "features.stampDesc" },
  { icon: Users, titleKey: "features.contactsTitle", descKey: "features.contactsDesc" },
  { icon: Shield, titleKey: "features.complianceTitle", descKey: "features.complianceDesc" },
  { icon: Globe, titleKey: "features.i18nTitle", descKey: "features.i18nDesc" },
  { icon: BarChart3, titleKey: "features.auditTitle", descKey: "features.auditDesc" },
];

export default function FeaturesSection() {
  const { ref, inView } = useInView({ threshold: 0.05 });
  const { t } = useTranslation();

  return (
    <section id="features" ref={ref as React.Ref<HTMLElement>} className="relative py-20 lg:py-28 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mb-14"
        >
          <p className="text-sm font-semibold text-emerald-600 tracking-wide mb-3">
            {t("features.badge")}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {t("features.sectionTitle")}
            <span className="text-emerald-600">{t("features.sectionTitleAccent")}</span>
          </h2>
          <p className="text-gray-500 mt-4 text-base leading-relaxed [text-wrap:pretty]">
            {t("features.sectionSubtitle")}
          </p>
        </motion.div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100 rounded-2xl overflow-hidden border border-gray-100">
          {features.map((feature, i) => (
            <motion.div
              key={feature.titleKey}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.05 * (i + 1) }}
              className="bg-white p-6 lg:p-7 hover:bg-gray-50/50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">
                <feature.icon className="w-4.5 h-4.5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                {t(feature.titleKey)}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {t(feature.descKey)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
