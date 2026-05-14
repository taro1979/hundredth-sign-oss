import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { useTranslation } from "react-i18next";
import { Cpu, TrendingDown, Users, Zap } from "lucide-react";

const WHY_IMAGE_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663366197343/CcWjorDvWVWfSvzg7uypMv/why-cafe-woman-v2-3QG9sopWJg3uecy6v8JCjk.webp";

export default function WhySection() {
  const { ref, inView } = useInView({ threshold: 0.1 });
  const { t } = useTranslation();

  const points = [
    { icon: Cpu,          title: t("why.aiTitle"),       desc: t("why.aiDesc")       },
    { icon: TrendingDown, title: t("why.noSalesTitle"),  desc: t("why.noSalesDesc")  },
    { icon: Users,        title: t("why.noPerSeatTitle"),desc: t("why.noPerSeatDesc") },
    { icon: Zap,          title: t("why.passOnTitle"),   desc: t("why.passOnDesc")   },
  ];

  return (
    <section ref={ref as React.Ref<HTMLElement>} className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-start">

          {/* Left: lifestyle photo */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative"
          >
            <div className="rounded-2xl overflow-hidden shadow-xl">
              <img
                src={WHY_IMAGE_URL}
                alt=""
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
            {/* Decorative accent */}
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-emerald-100 rounded-2xl -z-10" />
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-emerald-50 rounded-xl -z-10" />
          </motion.div>

          {/* Right: title + feature cards */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
            >
              <p className="text-sm font-semibold text-emerald-600 tracking-wide mb-3">
                {t("why.badge")}
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight leading-tight">
                {t("why.title")}
              </h2>
              <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-500 tracking-tight leading-tight">
                {t("why.titleSub")}
              </p>
              <p className="mt-5 text-base text-gray-500 leading-relaxed [text-wrap:pretty]">
                {t("why.description")}
              </p>
            </motion.div>

            <div className="mt-10 grid sm:grid-cols-2 gap-6">
              {points.map((point, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.1 * (i + 1) }}
                  className="group"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
                    <point.icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">{point.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{point.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
