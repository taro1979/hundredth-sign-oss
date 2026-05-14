import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { useTranslation } from "react-i18next";
import {
  Check,
  X,
  Minus,
  TrendingDown,
  DollarSign,
  Users,
  Zap,
  Shield,
  Brain,
  Globe,
  type LucideIcon,
} from "lucide-react";

/* ── Status icon helper ── */
function StatusIcon({ status }: { status: "yes" | "no" | "partial" }) {
  if (status === "yes") {
    return <Check className="w-5 h-5 text-emerald-500" />;
  }
  if (status === "no") {
    return <X className="w-5 h-5 text-red-400" />;
  }
  return <Minus className="w-5 h-5 text-amber-400" />;
}

export default function ComparisonSection() {
  const { ref, inView } = useInView({ threshold: 0.05 });
  const { t } = useTranslation();

  const featureRows: {
    Icon: LucideIcon;
    label: string;
    enterprise: { status: "yes" | "no" | "partial"; note: string };
    budget: { status: "yes" | "no" | "partial"; note: string };
    hundredth: { status: "yes" | "no" | "partial"; note: string };
  }[] = [
    {
      Icon: DollarSign,
      label: t("comparison.price1000"),
      enterprise: { status: "no", note: t("comparison.priceEnterprise") },
      budget: { status: "partial", note: t("comparison.priceBudget") },
      hundredth: { status: "yes", note: t("comparison.priceHundredth") },
    },
    {
      Icon: Users,
      label: t("comparison.perSeat"),
      enterprise: { status: "no", note: t("comparison.perSeatEnterprise") },
      budget: { status: "partial", note: t("comparison.perSeatBudget") },
      hundredth: { status: "yes", note: t("comparison.perSeatHundredth") },
    },
    {
      Icon: Zap,
      label: t("comparison.features"),
      enterprise: { status: "partial", note: t("comparison.featuresEnterprise") },
      budget: { status: "partial", note: t("comparison.featuresBudget") },
      hundredth: { status: "yes", note: t("comparison.featuresHundredth") },
    },
    {
      Icon: Shield,
      label: t("comparison.auditLog"),
      enterprise: { status: "yes", note: t("comparison.auditLogEnterprise") },
      budget: { status: "partial", note: t("comparison.auditLogBudget") },
      hundredth: { status: "yes", note: t("comparison.auditLogHundredth") },
    },
    {
      Icon: Brain,
      label: t("comparison.zeroAI"),
      enterprise: { status: "no", note: t("comparison.zeroAIEnterprise") },
      budget: { status: "no", note: t("comparison.zeroAIBudget") },
      hundredth: { status: "yes", note: t("comparison.zeroAIHundredth") },
    },
    {
      Icon: Globe,
      label: t("comparison.i18n"),
      enterprise: { status: "yes", note: t("comparison.i18nEnterprise") },
      budget: { status: "partial", note: t("comparison.i18nBudget") },
      hundredth: { status: "yes", note: t("comparison.i18nHundredth") },
    },
  ];

  return (
    <section
      ref={ref as React.Ref<HTMLElement>}
      className="relative py-24 lg:py-32 bg-gray-50 overflow-hidden"
    >
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200/60 mb-6">
            <TrendingDown className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">
              {t("comparison.badge")}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
            {t("comparison.title")}
          </h2>
          <p className="text-gray-500 mt-4 text-base leading-relaxed max-w-2xl mx-auto [text-wrap:pretty]">
            {t("comparison.subtitle")}
          </p>
        </motion.div>

        {/* ── Feature comparison table ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg shadow-gray-900/5 border border-gray-200/80 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-gray-200">
                  {/* Feature column header */}
                  <th className="py-5 px-6 text-left w-[30%] bg-gray-50">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {t("comparison.featureLabel")}
                    </span>
                  </th>
                  {/* Enterprise */}
                  <th className="py-5 px-5 text-center w-[23%] bg-white">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t("comparison.colEnterprise")}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 font-normal normal-case">
                      {t("comparison.colEnterpriseNote")}
                    </div>
                  </th>
                  {/* Budget */}
                  <th className="py-5 px-5 text-center w-[23%] bg-white">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t("comparison.colBudget")}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 font-normal normal-case">
                      {t("comparison.colBudgetNote")}
                    </div>
                  </th>
                  {/* Hundredth Sign — solid emerald header, no gradient */}
                  <th className="py-5 px-5 text-center w-[24%] bg-emerald-600">
                    <div className="flex justify-center mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/20">
                        <span className="text-[10px] font-bold text-white">
                          {t("comparison.recommended")}
                        </span>
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white uppercase tracking-wider">
                      Hundredth Sign
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {featureRows.map(({ Icon, ...row }, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.06 }}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    {/* Feature label — plain gray cell, no gradient */}
                    <td className="py-5 px-6 bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-gray-500" />
                        </div>
                        <span className="text-sm font-semibold text-gray-800 leading-tight">
                          {row.label}
                        </span>
                      </div>
                    </td>
                    {/* Enterprise */}
                    <td className="py-5 px-5 text-center bg-white">
                      <div className="flex flex-col items-center gap-2">
                        <StatusIcon status={row.enterprise.status} />
                        <span className="text-xs text-gray-500 leading-tight">
                          {row.enterprise.note}
                        </span>
                      </div>
                    </td>
                    {/* Budget */}
                    <td className="py-5 px-5 text-center bg-white">
                      <div className="flex flex-col items-center gap-2">
                        <StatusIcon status={row.budget.status} />
                        <span className="text-xs text-gray-500 leading-tight">
                          {row.budget.note}
                        </span>
                      </div>
                    </td>
                    {/* Hundredth Sign */}
                    <td className="py-5 px-5 text-center bg-emerald-50">
                      <div className="flex flex-col items-center gap-2">
                        <StatusIcon status={row.hundredth.status} />
                        <span className="text-xs font-semibold text-emerald-700 leading-tight">
                          {row.hundredth.note}
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center text-xs text-gray-400 mt-8 max-w-2xl mx-auto leading-relaxed"
        >
          {t("comparison.note")}
        </motion.p>
      </div>
    </section>
  );
}
