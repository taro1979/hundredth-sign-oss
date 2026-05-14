import { motion } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Check,
  Users,
  Shield,
  Globe,
  Lock,
  FileText,
  Clock,
  PenLine,
  BookOpen,
  BarChart3,
  Settings,
  ChevronRight,
} from "lucide-react";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80";

const HERO_MOCKUP_IMAGE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663366197343/CcWjorDvWVWfSvzg7uypMv/hero-mockup-transparent-v3_c9cdbd64.png";
const APP_DOMAIN = "app.hundredthsign.com";

// ── Multi-Device Product Mockup ────────────────────────────────────────────
// Layout: Desktop (left, back) · Tablet landscape (middle-right) · Phone portrait (far-right front)
// All devices bottom-aligned — MoneyForward-inspired "devices on a table" look

function MultiDeviceMockup() {
  const { t } = useTranslation();

  const sidebarNav = [
    { Icon: FileText,  label: t("landing.mockupNavDocs"),      active: true  },
    { Icon: Users,     label: t("landing.mockupNavContacts"),   active: false },
    { Icon: BookOpen,  label: t("landing.mockupNavTemplates"),  active: false },
    { Icon: BarChart3, label: t("landing.mockupNavAudit"),      active: false },
  ];

  const signers = [
    { name: t("landing.mockupSigner1Name"), done: true  },
    { name: t("landing.mockupSigner2Name"), done: true  },
    { name: t("landing.mockupSigner3Name"), done: false },
  ];

  const shadow = "0 0 0 1px rgba(0,0,0,0.07), 0 8px 20px -4px rgba(0,0,0,0.10), 0 24px 48px -10px rgba(0,0,0,0.14)";

  return (
    <div className="relative w-full select-none text-left" style={{ height: "380px" }}>

      {/* ── Desktop Monitor (left, back, z-10) ── */}
      <div className="absolute bottom-0 left-0 w-[62%] z-10">
        {/* Screen */}
        <div
          className="rounded-xl overflow-hidden bg-white border-[8px] border-gray-200"
          style={{ boxShadow: shadow }}
        >
        {/* macOS chrome */}
        <div className="bg-[#EBEBEB] border-b border-black/[0.06] px-3 py-2 flex items-center gap-2.5">
          <div className="flex gap-1 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 bg-white/80 rounded border border-black/[0.08] px-2 py-0.5 text-[10px] text-gray-400 flex items-center gap-1">
            <Lock className="w-2 h-2 text-emerald-500 shrink-0" />
            {APP_DOMAIN}
          </div>
        </div>
        {/* App shell */}
        <div className="flex" style={{ height: "185px" }}>
          {/* Sidebar */}
          <div className="w-[105px] shrink-0 border-r border-gray-100 bg-[#FAFAFA] py-2.5 px-1.5 flex flex-col gap-0.5">
            <div className="flex items-center px-1.5 py-1 mb-0.5">
              <span className="text-[8px] font-semibold text-gray-500">Hundredth Sign</span>
            </div>
            {sidebarNav.map(({ Icon, label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-[9px] font-medium whitespace-nowrap overflow-hidden ${
                  active ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30" : "text-gray-400"
                }`}
              >
                <Icon className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{label}</span>
              </div>
            ))}
            <div className="mt-auto">
              <div className="flex items-center gap-1.5 px-1.5 py-1.5 text-[9px] text-gray-400">
                <Settings className="w-2.5 h-2.5 shrink-0" />
                {t("landing.mockupNavSettings")}
              </div>
            </div>
          </div>
          {/* Main content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
              <div className="flex items-center gap-1 text-[9.5px] min-w-0">
                <span className="text-gray-400 shrink-0">{t("landing.mockupDocList")}</span>
                <ChevronRight className="w-2.5 h-2.5 text-gray-300 shrink-0" />
                <span className="text-gray-700 font-semibold truncate">{t("landing.mockupDocTitle")}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <div className="flex items-center gap-0.5 text-[8.5px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70 font-medium whitespace-nowrap">
                  <Clock className="w-2 h-2 shrink-0" />
                  {t("landing.mockupStatusCollecting")}
                </div>
                <button className="text-[9px] font-semibold px-2 py-0.5 bg-emerald-600 text-white rounded-md whitespace-nowrap">
                  {t("landing.mockupRemind")}
                </button>
              </div>
            </div>
            {/* Signing progress */}
            <div className="px-3 py-2 border-b border-gray-100/80">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-semibold text-gray-500">{t("landing.mockupSignProgress")}</span>
                <span className="text-[9px] font-bold text-emerald-600">{t("landing.mockupProgressFmt")}</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: "66.6%" }} />
              </div>
              <div className="flex items-center gap-3">
                {signers.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <div className="relative shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        s.done ? "bg-emerald-500 text-white" : "bg-white border-2 border-dashed border-gray-200 text-gray-300"
                      }`}>{s.name}</div>
                      {s.done && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-white border border-emerald-100 flex items-center justify-center">
                          <Check className="w-1.5 h-1.5 text-emerald-500" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[8.5px] font-semibold text-gray-700 leading-none">{s.name}</p>
                      <p className={`text-[7.5px] mt-0.5 ${s.done ? "text-emerald-500 font-medium" : "text-gray-300"}`}>
                        {s.done ? t("landing.mockupSignerSigned") : t("landing.mockupSignerPending")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* PDF preview */}
            <div className="flex-1 bg-gray-50/50 px-3 py-2.5">
              <div className="h-full rounded-lg border border-gray-100 bg-white p-3 relative shadow-sm overflow-hidden">
                <div className="space-y-1.5">
                  <div className="h-1.5 bg-gray-800/10 rounded-full w-2/3" />
                  <div className="h-1 bg-gray-200/70 rounded-full w-full mt-2" />
                  <div className="h-1 bg-gray-200/70 rounded-full w-[92%]" />
                  <div className="h-1 bg-gray-200/70 rounded-full w-full" />
                  <div className="h-1 bg-gray-200/70 rounded-full w-4/5" />
                  <div className="h-1 bg-gray-200/70 rounded-full w-full" />
                  <div className="h-1 bg-gray-200/70 rounded-full w-[88%]" />
                </div>
                <div className="absolute bottom-2 inset-x-2">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60">
                    <PenLine className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                    <p className="text-[8.5px] font-semibold text-emerald-700 truncate flex-1">{t("landing.mockupSignAreaLabel")}</p>
                    <div className="flex items-center gap-0.5 text-[7.5px] text-amber-600 font-medium bg-amber-50 px-1 py-0.5 rounded-full border border-amber-200/60 shrink-0">
                      <Clock className="w-1.5 h-1.5 shrink-0" />
                      {t("landing.mockupWaiting")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>{/* /screen */}
        {/* Monitor stand */}
        <div className="flex flex-col items-center" aria-hidden="true">
          <div className="w-[14%] h-4 bg-gradient-to-b from-gray-200 to-gray-300/80" />
          <div className="w-[48%] h-[5px] bg-gradient-to-b from-gray-200 to-gray-300 rounded-full shadow-sm" />
        </div>
      </div>{/* /monitor wrapper */}

      {/* ── Tablet (landscape, middle-right, z-20) ── */}
      {/* Sits to the right of the desktop, bottom-aligned, slight overlap with desktop */}
      <div
        className="absolute bottom-0 z-20 overflow-hidden bg-white rounded-[14px] border-[5px] border-gray-800"
        style={{ right: "17%", width: "44%", boxShadow: shadow }}
      >
        {/* Landscape status bar */}
        <div className="bg-gray-800 h-3 flex items-center justify-between px-4">
          <span className="text-[6px] text-gray-500 font-medium tabular-nums">9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-3.5 h-1 bg-gray-600 rounded-sm" />
            <div className="w-1.5 h-1 bg-gray-600 rounded-sm" />
          </div>
        </div>
        {/* App header */}
        <div className="bg-white border-b border-gray-100 px-3 py-2 flex items-center justify-between">
          <span className="text-[7.5px] font-semibold text-gray-500">Hundredth Sign</span>
          <span className="text-[7.5px] font-semibold px-2 py-0.5 bg-emerald-600 text-white rounded-md whitespace-nowrap">
            {t("landing.mockupTabletNewDoc")}
          </span>
        </div>
        {/* Landscape document grid — 2 columns */}
        <div className="bg-gray-50 p-2 grid grid-cols-2 gap-1.5" style={{ height: "110px" }}>
          {[
            { title: t("landing.mockupDocTitle"),  badge: t("landing.mockupStatusCollecting"), cls: "bg-amber-100 text-amber-700" },
            { title: t("landing.mockupDocTitleNda"), badge: t("landing.mockupSignerSigned"), cls: "bg-emerald-100 text-emerald-700" },
            { title: t("landing.mockupDocTitleDev"), badge: t("landing.mockupSignerPending"), cls: "bg-gray-100 text-gray-500" },
            { title: t("landing.mockupDocTitleMaster"), badge: t("landing.mockupSignerSigned"), cls: "bg-emerald-100 text-emerald-700" },
          ].map((doc, i) => (
            <div key={i} className="bg-white rounded-lg px-2 py-1.5 border border-gray-100 flex items-center gap-1.5 shadow-sm overflow-hidden">
              <FileText className="w-2.5 h-2.5 text-gray-400 shrink-0" />
              <span className="text-[7.5px] text-gray-700 truncate flex-1 min-w-0">{doc.title}</span>
              <span className={`text-[6.5px] px-1 py-0.5 rounded-full font-medium shrink-0 whitespace-nowrap ${doc.cls}`}>{doc.badge}</span>
            </div>
          ))}
        </div>
        {/* Bottom tab bar */}
        <div className="bg-white border-t border-gray-100 px-4 py-1.5 flex justify-around">
          {[FileText, Users, BarChart3].map((Icon, i) => (
            <div key={i} className={`flex items-center ${i === 0 ? "text-emerald-600" : "text-gray-300"}`}>
              <Icon className="w-3 h-3" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Phone (portrait, front-right, z-30) ── */}
      {/* Sits to the right of the tablet, bottom-aligned, frontmost layer */}
      <div
        className="absolute bottom-0 right-0 z-30 w-[18%] rounded-[26px] overflow-hidden bg-white border-[5px] border-gray-900"
        style={{ boxShadow: shadow }}
      >
        {/* Dynamic island */}
        <div className="bg-gray-900 h-5 flex items-center justify-center">
          <div className="w-8 h-1.5 bg-gray-800 rounded-full" />
        </div>
        {/* Notification screen */}
        <div className="bg-gray-50 p-2 space-y-1.5">
          <p className="text-[7.5px] font-bold text-gray-500 px-0.5">{t("landing.mockupPhoneNotif")}</p>
          {/* Sign request notification */}
          <div className="bg-white border border-gray-100 rounded-xl p-2 shadow-sm">
            <div className="flex items-start gap-1.5">
              <div className="w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <PenLine className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[7.5px] font-semibold text-gray-800 leading-tight">{t("landing.mockupPhoneSignRequest")}</p>
                <p className="text-[6.5px] text-gray-400 mt-0.5 truncate">{t("landing.mockupNotificationDoc")}</p>
              </div>
            </div>
            <button className="mt-1.5 w-full text-[7px] font-semibold py-1 bg-emerald-600 text-white rounded-lg">
              {t("landing.mockupPhoneSignBtn")}
            </button>
          </div>
          {/* Signed completion notification */}
          <div className="bg-white border border-gray-100 rounded-xl p-2 shadow-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[7.5px] font-semibold text-gray-800 leading-tight truncate">
                  {t("landing.mockupPhoneSignedFmt", { name: t("landing.mockupSigner1Name") })}
                </p>
                <p className="text-[6.5px] text-gray-400">{t("landing.mockupPhone3min")}</p>
              </div>
            </div>
          </div>
        </div>
        {/* Home indicator */}
        <div className="bg-gray-50 pb-2 flex justify-center">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>
      </div>

    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function HeroSection() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  return (
    <>
      {/* ── Part 1: Two-column Hero (MoneyForward style) ── */}
      <section className="relative bg-white min-h-svh flex flex-col justify-center pt-20 pb-12" style={{ overflow: "clip" }}>
        {/* ── Decorative background ── */}
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(16,185,129,0.18) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Glow: top-left (large, brand-colored) */}
        <div className="absolute -top-32 -left-40 w-[560px] h-[560px] rounded-full bg-emerald-200/60 blur-[110px] pointer-events-none" />
        {/* Glow: center-right (behind the device mockup) */}
        <div className="absolute top-1/2 right-[-80px] -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-emerald-100/80 blur-[90px] pointer-events-none" />
        {/* Glow: bottom-left (subtle) */}
        <div className="absolute bottom-[-60px] left-1/4 w-[340px] h-[340px] rounded-full bg-emerald-200/30 blur-[90px] pointer-events-none" />
        {/* Bottom fade — smoothly dissolves into Part 2 (no hard edge) */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-white pointer-events-none z-[1]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* ── Left: Copy ── */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Headline */}
              <h1 className="text-[2rem] sm:text-[2.5rem] lg:text-[2.25rem] xl:text-[2.5rem] font-bold text-gray-900 leading-[1.2] tracking-tight">
                {t("landing.heroDeclaration")}
              </h1>

              {/* Price – cost-leader emphasis */}
              <div className="mt-8 flex flex-col gap-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-px w-8 bg-emerald-200" />
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-[0.15em]">
                    {t("landing.heroTeamLabel")}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl sm:text-6xl xl:text-7xl font-black text-gray-900 tracking-tight tabular-nums">
                    Free
                  </span>
                  <span className="text-xl text-gray-400 font-medium">
                    Self-hosted
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-500">
                  <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  Free to self-host, no customer accounts, no vendor lock-in
                </p>
              </div>

              {/* CTA */}
              <div className="mt-8 flex flex-col sm:flex-row items-start gap-3">
                <button
                  onClick={handleGetStarted}
                  className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20"
                >
                  {isAuthenticated ? t("landing.goToDashboard") : t("landing.getStarted")}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-gray-600 rounded-xl border border-gray-200 hover:border-gray-300 hover:text-gray-900 transition-all bg-white"
                >
                  {t("landing.learnMore")}
                </a>
              </div>

              {/* Trust bullets */}
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {t("landing.noCreditCard")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {t("landing.noPerSeat")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {t("landing.allFeatures")}
                </span>
              </div>
            </motion.div>

            {/* ── Right: Multi-device mockup ── */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block"
            >
              <img
                src={HERO_MOCKUP_IMAGE}
                alt=""
                className="w-full h-auto drop-shadow-2xl"
              />
            </motion.div>

          </div>
        </div>

      </section>

      {/* ── Part 2: Value props + stock photo ── */}
      <section className="relative bg-white py-20 lg:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left: copy */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7 }}
              className="max-w-xl"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-700 tracking-wide">
                  {t("landing.heroBadge")}
                </span>
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                {t("landing.heroRevealTitle")}
              </h2>
              <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed">
                {t("landing.heroRevealSub")}
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { Icon: Users,  title: t("landing.diffTeam"),     desc: t("landing.diffTeamDesc")     },
                  { Icon: Shield, title: t("landing.diffSecurity"),  desc: t("landing.diffSecurityDesc") },
                  { Icon: Globe,  title: t("landing.diffGlobal"),    desc: t("landing.diffGlobalDesc")   },
                ].map(({ Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: stock photo + floating cards */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-gray-900/10">
                <img
                  src={HERO_IMAGE}
                  alt=""
                  className="w-full h-[360px] sm:h-[420px] lg:h-[480px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
              </div>
              {/* Floating: signed notification */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="absolute -bottom-5 -left-4 sm:-left-6 bg-white rounded-xl shadow-xl shadow-gray-900/10 border border-gray-100 p-4 max-w-[240px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{t("landing.mockupTitle")}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{t("landing.mockupTime")}</p>
                  </div>
                </div>
              </motion.div>
              {/* Floating: cost comparison */}
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="absolute -top-4 -right-4 sm:-right-6 bg-gray-900 rounded-xl shadow-xl p-4 max-w-[220px]"
              >
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                  {t("landing.mockupCostLabel")}
                </p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <p className="text-2xl font-bold text-white">Free</p>
                  <span className="text-xs text-gray-400 font-normal">OSS</span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-500">{t("landing.mockupVsEnterprise")}</span>
                    <span className="text-emerald-400 font-bold">OSS</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-0.5">
                    <span className="text-gray-500">{t("landing.mockupVsBudget")}</span>
                    <span className="text-emerald-400 font-bold">{t("landing.mockupNoAccount")}</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
