import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { useTranslation } from "react-i18next";
import { Shield, Lock, FileCheck, Scale } from "lucide-react";

const TRUST_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663366197343/CcWjorDvWVWfSvzg7uypMv/trust-diverse-team-d3VE2MYti3xh45eYJ4TzHt.webp";

export default function TrustSection() {
  const { ref, inView } = useInView({ threshold: 0.1 });
  const { t } = useTranslation();

  const trustItems = [
    {
      icon: Lock,
      title: t("trust.encryptionTitle"),
      desc: t("trust.encryptionDesc"),
    },
    {
      icon: FileCheck,
      title: t("trust.complianceTitle"),
      desc: t("trust.complianceDesc"),
    },
    {
      icon: Scale,
      title: t("trust.legalTitle"),
      desc: t("trust.legalDesc"),
    },
    {
      icon: Shield,
      title: t("trust.auditTitle"),
      desc: t("trust.auditDesc"),
    },
  ];

  return (
    <section ref={ref as React.Ref<HTMLElement>} className="relative py-20 lg:py-32 bg-white overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-5 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Trust content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-gray-900 leading-tight tracking-tight">
              {t("trust.title")}
            </h2>
            <p className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-emerald-600 leading-tight tracking-tight">
              {t("trust.titleAccent")}
            </p>
            <p className="mt-5 text-base text-gray-500 leading-relaxed max-w-md [text-wrap:pretty]">
              {t("trust.subtitle")}
            </p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {trustItems.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                  className="group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
                    <item.icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: Photo with overlapping UI card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="relative">
              <img
                src={TRUST_IMAGE}
                alt=""
                className="w-full h-[350px] sm:h-[420px] lg:h-[480px] object-cover rounded-2xl"
              />
              {/* Overlapping UI card — product mockup overlay */}
              <motion.div
                initial={{ opacity: 0, y: 30, x: -30 }}
                animate={inView ? { opacity: 1, y: 0, x: 0 } : {}}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="absolute -bottom-6 -left-4 sm:left-[-20px] bg-white rounded-xl shadow-2xl shadow-black/10 p-4 sm:p-5 max-w-[240px] sm:max-w-[280px] border border-gray-100"
              >
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
                  <span className="text-sm font-extrabold tracking-tight text-gray-950">Hundredth Sign</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: t("trust.mockupSign"), color: "bg-emerald-500" },
                    { label: t("trust.mockupStamp"), color: "bg-teal-500" },
                    { label: t("trust.mockupDate"), color: "bg-cyan-500" },
                    { label: t("trust.mockupName"), color: "bg-blue-500" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-sm ${item.color}`} />
                      <span className="text-xs text-gray-600">{item.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
