import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { useTranslation } from "react-i18next";
import { Shield, Lock, FileCheck, Scale, Globe, Eye, BrainCog, ShieldCheck } from "lucide-react";

export default function SecuritySection() {
  const { ref, inView } = useInView({ threshold: 0.05 });
  const { t } = useTranslation();

  const cards = [
    {
      icon: <Lock className="w-5 h-5" />,
      title: t("security.tls"),
      description: t("security.tlsDesc"),
      tag: "TLS 1.3 / AES-256",
    },
    {
      icon: <BrainCog className="w-5 h-5" />,
      title: t("security.zeroAI"),
      description: t("security.zeroAIDesc"),
      highlight: true,
      tag: t("security.zeroAITag"),
    },
    {
      icon: <Eye className="w-5 h-5" />,
      title: t("security.audit"),
      description: t("security.auditDesc"),
      tag: t("security.auditTag"),
    },
    {
      icon: <FileCheck className="w-5 h-5" />,
      title: t("security.tamper"),
      description: t("security.tamperDesc"),
      tag: t("security.tamperTag"),
    },
    {
      icon: <Scale className="w-5 h-5" />,
      title: t("security.law"),
      description: t("security.lawDesc"),
      tag: t("security.lawTag"),
    },
    {
      icon: <Globe className="w-5 h-5" />,
      title: t("security.global"),
      description: t("security.globalDesc"),
      tag: t("security.globalTag"),
    },
  ];

  return (
    <section id="security" ref={ref as React.Ref<HTMLElement>} className="relative py-20 lg:py-28 bg-[#0B1120] overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/[0.03] rounded-full blur-[150px]" />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header with central shield */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          {/* Shield icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6"
          >
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </motion.div>

          <p className="text-sm font-semibold text-emerald-400 tracking-wide mb-3">
            {t("security.badge")}
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight max-w-3xl mx-auto">
            {t("security.title")}
          </h2>
          <p className="text-gray-400 mt-5 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto [text-wrap:pretty]">
            {t("security.subtitle")}
          </p>

          {/* Trust badges row */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            {[
              { label: t("security.badgeTLS"), icon: <Lock className="w-3 h-3" /> },
              { label: t("security.badgeAES"), icon: <Shield className="w-3 h-3" /> },
              { label: t("security.badgeLaw"), icon: <Scale className="w-3 h-3" /> },
              { label: t("security.badgeZeroAI"), icon: <BrainCog className="w-3 h-3" /> },
            ].map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-gray-300"
              >
                <span className="text-emerald-400">{badge.icon}</span>
                {badge.label}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Feature cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.06 * (i + 1) + 0.3 }}
              className={`group relative p-6 rounded-xl border transition-all duration-300 ${
                card.highlight
                  ? "bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/[0.15]"
                  : "bg-white/[0.04] border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.06]"
              }`}
            >
              {/* Tag */}
              {card.tag && (
                <span className={`absolute top-4 right-4 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  card.highlight
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-white/[0.08] text-gray-500"
                }`}>
                  {card.tag}
                </span>
              )}

              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors ${
                card.highlight
                  ? "bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30"
                  : "bg-white/[0.08] text-gray-300 group-hover:bg-white/[0.12]"
              }`}>
                {card.icon}
              </div>
              <h3 className={`text-sm font-semibold mb-2 ${card.highlight ? "text-emerald-300" : "text-white"}`}>
                {card.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">{card.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Bottom reassurance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-gray-500 leading-relaxed max-w-xl mx-auto [text-wrap:pretty]">
            {t("security.bottomNote")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
