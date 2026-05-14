import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";

const CTA_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663366197343/CcWjorDvWVWfSvzg7uypMv/trust-meeting-v2_90311c41.png";

export default function CTASection() {
  const { ref, inView } = useInView({ threshold: 0.2 });
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const handleCTA = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  return (
    <section ref={ref as React.Ref<HTMLElement>} className="py-16 lg:py-20 bg-white">
      <div className="max-w-[1280px] mx-auto px-5 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="relative rounded-3xl overflow-hidden bg-emerald-600"
        >
          <div className="grid lg:grid-cols-2 items-center">
            {/* Left: Text content */}
            <div className="p-10 sm:p-12 lg:p-16">
              <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white leading-tight tracking-tight break-keep">
                {t("cta.title")}
              </h2>
              <p className="mt-4 text-emerald-100 text-base leading-relaxed max-w-md [text-wrap:pretty]">
                {t("cta.subtitle")}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleCTA}
                  className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-emerald-700 text-sm font-semibold rounded-lg hover:bg-emerald-50 transition-all"
                >
                  {t("landing.getStarted")}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <a
                  href="#faq"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white border border-white/30 rounded-lg hover:bg-white/10 transition-all"
                >
                  {t("landing.navFaq")}
                </a>
              </div>
            </div>

            {/* Right: Photo with geometric frame */}
            <div className="relative hidden lg:block h-full min-h-[360px]">
              <img
                src={CTA_IMAGE}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute top-8 right-8 bottom-8 left-8 border-2 border-white/20 rounded-xl" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
