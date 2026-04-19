"use client";

import Link from "next/link";
import {
  Zap,
  Shield,
  Bot,
  CreditCard,
  TrendingUp,
  Receipt,
  Star,
  BarChart3,
  RefreshCw,
  Lock,
  ArrowRight,
  Check,
  Building2,
  ChevronRight,
} from "lucide-react";

// ── Design tokens (matching app aesthetic) ───────────────────────────────────

const AMBER = "#F5B942";
const AMBER_DIM = "rgba(245,185,66,0.08)";
const AMBER_BORDER = "rgba(245,185,66,0.2)";
const BG = "#09090E";
const SURFACE = "rgba(255,255,255,0.035)";
const BORDER = "rgba(255,255,255,0.06)";

// ── Feature cards ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: RefreshCw,
    title: "Automatic Bank Sync",
    desc: "Every transaction from every account, pulled daily via Plaid. No CSV imports. No manual entry. Ever.",
    tag: "Starter",
    tagColor: "rgba(56,189,248,0.15)",
    tagText: "#38BDF8",
  },
  {
    icon: Bot,
    title: "AI Categorization",
    desc: "A three-stage pipeline — regex rules, local Ollama LLM, then Claude Haiku fallback — categorizes 95%+ of transactions automatically.",
    tag: "All plans",
    tagColor: "rgba(52,211,153,0.12)",
    tagText: "#34D399",
  },
  {
    icon: Star,
    title: "Points & Rewards Optimizer",
    desc: "Know exactly which credit card earns the most points on every purchase. Tracks 6 cards across Amex MR, Chase UR, Capital One Miles, Bilt, Southwest, and Wells Fargo Rewards.",
    tag: "All plans",
    tagColor: "rgba(52,211,153,0.12)",
    tagText: "#34D399",
  },
  {
    icon: BarChart3,
    title: "Budgets & Reports",
    desc: "Set monthly spending limits by category. Visual pace indicators show if you're on track mid-month. Month-over-month reports with category breakdowns.",
    tag: "All plans",
    tagColor: "rgba(52,211,153,0.12)",
    tagText: "#34D399",
  },
  {
    icon: TrendingUp,
    title: "Net Worth Tracking",
    desc: "Daily snapshots of assets and liabilities. Watch your net worth grow over time with investment accounts via SnapTrade.",
    tag: "Pro",
    tagColor: AMBER_DIM,
    tagText: AMBER,
  },
  {
    icon: Bot,
    title: "AI Financial Chat",
    desc: "Ask questions in plain English. 'How much did I spend on restaurants last month?' or 'Which subscriptions are costing me the most?' Powered by Claude Sonnet.",
    tag: "Pro",
    tagColor: AMBER_DIM,
    tagText: AMBER,
  },
  {
    icon: Receipt,
    title: "Subscription Tracking",
    desc: "Hive detects recurring charges automatically and surfaces your total monthly subscription spend so nothing hides in the noise.",
    tag: "All plans",
    tagColor: "rgba(52,211,153,0.12)",
    tagText: "#34D399",
  },
  {
    icon: BarChart3,
    title: "Tax Export",
    desc: "One-click export of deductible transactions by category. Bring your accountant a clean CSV instead of a shoebox of receipts.",
    tag: "All plans",
    tagColor: "rgba(52,211,153,0.12)",
    tagText: "#34D399",
  },
  {
    icon: Shield,
    title: "100% Self-Hosted",
    desc: "Your financial data runs on your hardware. No SaaS company storing your bank credentials or selling your transaction history.",
    tag: "Always",
    tagColor: "rgba(139,92,246,0.12)",
    tagText: "#A78BFA",
  },
];

// ── Pricing plans ─────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Free",
    price: 0,
    period: "forever",
    highlight: false,
    badge: null,
    features: [
      "Full dashboard & analytics",
      "AI transaction categorization",
      "Budget tracking",
      "Points optimizer",
      "Subscription detection",
      "Tax export",
      "Net worth tracking",
      "Self-hosted — your data",
    ],
    locked: [],
    cta: "Get started free",
    ctaHref: "/register",
    ctaStyle: "secondary",
  },
  {
    name: "Starter",
    price: 9,
    period: "per month",
    highlight: false,
    badge: null,
    features: [
      "Everything in Free",
      "Up to 3 connected bank accounts",
      "Automatic daily Plaid sync",
      "Webhook transaction alerts",
    ],
    locked: ["Claude AI chat"],
    cta: "Start Starter",
    ctaHref: "/register",
    ctaStyle: "secondary",
  },
  {
    name: "Pro",
    price: 19,
    period: "per month",
    highlight: true,
    badge: "MOST POPULAR",
    features: [
      "Everything in Starter",
      "Up to 10 connected accounts",
      "Claude Sonnet AI chat",
      "SnapTrade investment accounts",
      "Priority support",
    ],
    locked: [],
    cta: "Start Pro",
    ctaHref: "/register",
    ctaStyle: "primary",
  },
];

// ── How it works steps ────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Deploy in minutes",
    desc: "Clone the repo, copy .env.example, fill in your Plaid and Anthropic keys, run docker compose up. That's it.",
  },
  {
    n: "02",
    title: "Connect your accounts",
    desc: "Use Plaid Link to securely connect your bank accounts and credit cards. Hive pulls the last 2 years of transactions on first sync.",
  },
  {
    n: "03",
    title: "Watch it work",
    desc: "Transactions are categorized automatically every morning. Budgets, points, and insights update in real time.",
  },
  {
    n: "04",
    title: "Ask anything",
    desc: "Chat with your finances using Claude Sonnet. Get instant answers about spending, subscriptions, or where your money went.",
  },
];

// ── Credit card logos (text-based for now) ────────────────────────────────────

const CARDS = [
  { name: "Amex Gold", pts: "4× dining & groceries", color: "#C9920E" },
  { name: "Chase Sapphire", pts: "3× dining & travel", color: "#0061A4" },
  { name: "Bilt Blue", pts: "3× dining, 2× travel", color: "#1A1A2E" },
  { name: "Capital One Venture X", pts: "2× everywhere", color: "#D4212C" },
  { name: "Chase Southwest", pts: "3× SW Flights", color: "#304CB2" },
  { name: "WF Autograph", pts: "3× 8 categories", color: "#CC0000" },
];

// ── Stat strip ────────────────────────────────────────────────────────────────

const STATS = [
  { value: "6", label: "Credit cards tracked" },
  { value: "3-stage", label: "AI categorization pipeline" },
  { value: "95%+", label: "Auto-categorization rate" },
  { value: "100%", label: "Self-hosted, your data" },
];

// ── Components ────────────────────────────────────────────────────────────────

function HiveHex({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-[10px]"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #F5B942 0%, #C9920E 100%)",
        boxShadow: `0 0 0 1px rgba(245,185,66,0.4), 0 4px 16px rgba(245,185,66,0.30)`,
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.52, height: size * 0.52 }}>
        <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" fill="rgba(9,8,7,0.75)" />
        <path d="M12 6L17.2 9V15L12 18L6.8 15V9L12 6Z" fill="rgba(245,185,66,0.35)" />
        <circle cx="12" cy="12" r="2" fill="rgba(9,8,7,0.9)" />
        <circle cx="12" cy="12" r="1" fill="rgba(245,185,66,0.95)" />
      </svg>
    </div>
  );
}

function GlowBg({ color = AMBER, opacity = 0.07, top = true }: { color?: string; opacity?: number; top?: boolean }) {
  return (
    <div
      aria-hidden
      className="absolute left-0 right-0 pointer-events-none"
      style={{
        top: top ? 0 : "auto",
        bottom: top ? "auto" : 0,
        height: 400,
        background: `radial-gradient(ellipse 80% 60% at 50% ${top ? "0%" : "100%"}, ${color.startsWith("#") ? color : color}${Math.round(opacity * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
      }}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ background: BG, color: "#F2EDE8", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(9,9,14,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <HiveHex size={32} />
          <span
            className="text-[15px] font-bold tracking-[0.06em]"
            style={{ color: "#F2EDE8", letterSpacing: "0.08em" }}
          >
            HIVE
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {["Features", "Pricing", "How it works"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              className="text-[13px] font-medium transition-colors duration-150"
              style={{ color: "#7A7268" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#C8BFB4")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#7A7268")}
            >
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:block px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium transition-all duration-150"
            style={{ color: "#7A7268", background: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#C8BFB4"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#7A7268"; }}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="px-3.5 py-1.5 rounded-[8px] text-[13px] font-semibold transition-all duration-150"
            style={{
              background: "linear-gradient(135deg, #F5B942, #C9920E)",
              color: "#09090E",
              boxShadow: "0 2px 8px rgba(245,185,66,0.25)",
            }}
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6 text-center">
        <GlowBg />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-8"
          style={{ background: AMBER_DIM, border: `1px solid ${AMBER_BORDER}` }}>
          <Lock className="w-3 h-3" style={{ color: AMBER }} />
          <span className="text-[11px] font-semibold tracking-[0.1em] uppercase" style={{ color: AMBER }}>
            100% Self-Hosted · Your Data Stays Yours
          </span>
        </div>

        <h1
          className="text-[48px] sm:text-[64px] lg:text-[80px] font-bold leading-[1.05] tracking-[-0.03em] mb-6 mx-auto"
          style={{ maxWidth: 900 }}
        >
          Your finances.{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #FFD166 0%, #F5B942 50%, #C9920E 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Finally intelligent.
          </span>
        </h1>

        <p
          className="text-[17px] sm:text-[19px] leading-relaxed mb-10 mx-auto"
          style={{ color: "#7A7268", maxWidth: 600 }}
        >
          A self-hosted personal finance platform that automatically pulls every transaction,
          categorizes it with AI, tracks your rewards points, and answers any question about
          your money — all running on your hardware.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <Link
            href="/register"
            className="flex items-center gap-2 px-6 py-3 rounded-[10px] text-[15px] font-semibold transition-all duration-150"
            style={{
              background: "linear-gradient(135deg, #F5B942, #C9920E)",
              color: "#09090E",
              boxShadow: "0 4px 20px rgba(245,185,66,0.30)",
            }}
          >
            Start for free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="#how-it-works"
            className="flex items-center gap-2 px-6 py-3 rounded-[10px] text-[15px] font-medium transition-all duration-150"
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              color: "#C8BFB4",
            }}
          >
            See how it works
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Stat strip */}
        <div
          className="inline-grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden mx-auto"
          style={{ border: `1px solid ${BORDER}`, background: BORDER }}
        >
          {STATS.map(({ value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center px-6 py-4"
              style={{ background: "#0D0D14" }}
            >
              <span
                className="text-[22px] font-bold font-mono tracking-tight"
                style={{ color: AMBER }}
              >
                {value}
              </span>
              <span className="text-[11px] mt-0.5 text-center" style={{ color: "#4A4640" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Dashboard preview mockup ─────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div
          className="mx-auto rounded-2xl overflow-hidden"
          style={{
            maxWidth: 960,
            border: `1px solid ${BORDER}`,
            background: "#0D0D14",
            boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,185,66,0.06)",
          }}
        >
          {/* Fake browser bar */}
          <div className="flex items-center gap-1.5 px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
            <div
              className="flex-1 mx-4 px-3 py-1 rounded-md text-[11px] font-mono"
              style={{ background: "rgba(255,255,255,0.04)", color: "#4A4640", textAlign: "center" }}
            >
              hive.zacharyjcollins.com/dashboard
            </div>
          </div>

          {/* Fake dashboard content */}
          <div className="flex">
            {/* Fake sidebar */}
            <div className="w-[160px] shrink-0 p-3 space-y-0.5" style={{ borderRight: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2 px-2 py-1.5 mb-3">
                <HiveHex size={22} />
                <span className="text-[11px] font-bold tracking-widest" style={{ color: "#F2EDE8" }}>HIVE</span>
              </div>
              {["Dashboard", "Transactions", "Budgets", "Optimizer", "Points", "AI Chat"].map((item, i) => (
                <div
                  key={item}
                  className="px-2 py-1.5 rounded-lg flex items-center gap-2"
                  style={{
                    background: i === 0 ? AMBER_DIM : "transparent",
                    color: i === 0 ? AMBER : "#4A4640",
                  }}
                >
                  <div className="w-2 h-2 rounded-sm" style={{ background: i === 0 ? AMBER : "#2C2926" }} />
                  <span className="text-[10px] font-medium">{item}</span>
                </div>
              ))}
            </div>

            {/* Fake main content */}
            <div className="flex-1 p-5 space-y-4">
              {/* KPI row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Net Cash", value: "$8,240", color: AMBER },
                  { label: "Total Assets", value: "$42,100", color: "#34D399" },
                  { label: "Credit Used", value: "$3,860", color: "#F87171" },
                  { label: "Points Value", value: "$1,240", color: "#38BDF8" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="p-3 rounded-xl"
                    style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
                  >
                    <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "#4A4640" }}>{label}</p>
                    <p className="text-[16px] font-bold font-mono" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Two columns */}
              <div className="grid grid-cols-2 gap-3">
                {/* Budget bars */}
                <div className="rounded-xl p-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                  <p className="text-[9px] uppercase tracking-wider mb-3" style={{ color: "#4A4640" }}>Budgets</p>
                  <div className="space-y-2">
                    {[
                      { cat: "Food & Drink", pct: 72, color: "#F97316" },
                      { cat: "Groceries", pct: 45, color: "#34D399" },
                      { cat: "Travel", pct: 91, color: "#38BDF8" },
                      { cat: "Entertainment", pct: 38, color: "#A78BFA" },
                    ].map(({ cat, pct, color }) => (
                      <div key={cat}>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[9px]" style={{ color: "#7A7268" }}>{cat}</span>
                          <span className="text-[9px] font-mono" style={{ color }}>{pct}%</span>
                        </div>
                        <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Points */}
                <div className="rounded-xl p-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                  <p className="text-[9px] uppercase tracking-wider mb-3" style={{ color: "#4A4640" }}>Points Programs</p>
                  <div className="space-y-2">
                    {[
                      { prog: "Chase UR", pts: "87,400 pts", val: "$1,792" },
                      { prog: "Amex MR", pts: "62,100 pts", val: "$1,242" },
                      { prog: "Capital One", pts: "31,500 pts", val: "$583" },
                      { prog: "Bilt Points", pts: "18,900 pts", val: "$397" },
                    ].map(({ prog, pts, val }) => (
                      <div key={prog} className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-medium" style={{ color: "#C8BFB4" }}>{prog}</p>
                          <p className="text-[8px]" style={{ color: "#4A4640" }}>{pts}</p>
                        </div>
                        <p className="text-[10px] font-mono font-semibold" style={{ color: "#34D399" }}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-3" style={{ color: AMBER }}>
              Everything you need
            </p>
            <h2 className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-tight mb-4">
              Finance intelligence,<br />built to run on your terms
            </h2>
            <p className="text-[16px] leading-relaxed mx-auto" style={{ color: "#7A7268", maxWidth: 520 }}>
              Every feature runs on your hardware. No third party ever sees your transaction data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc, tag, tagColor, tagText }) => (
              <div
                key={title}
                className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 group"
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.border = `1px solid ${AMBER_BORDER}`;
                  (e.currentTarget as HTMLDivElement).style.background = AMBER_DIM;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.border = `1px solid ${BORDER}`;
                  (e.currentTarget as HTMLDivElement).style.background = SURFACE;
                }}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                    style={{ background: AMBER_DIM }}
                  >
                    <Icon className="w-4 h-4" style={{ color: AMBER }} strokeWidth={1.8} />
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: tagColor, color: tagText }}
                  >
                    {tag}
                  </span>
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: "#F2EDE8" }}>{title}</h3>
                  <p className="text-[13px] leading-relaxed" style={{ color: "#7A7268" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cards grid ───────────────────────────────────────────────── */}
      <section className="px-6 py-20 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(245,185,66,0.04) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-3" style={{ color: AMBER }}>
              Rewards optimizer
            </p>
            <h2 className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-tight mb-4">
              Know which card to swipe<br />before you swipe it
            </h2>
            <p className="text-[16px] leading-relaxed mx-auto" style={{ color: "#7A7268", maxWidth: 500 }}>
              Hive tracks your full credit card portfolio and tells you which card earns the most
              points on any given purchase — at checkout.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CARDS.map(({ name, pts, color }) => (
              <div
                key={name}
                className="rounded-2xl p-4 flex flex-col gap-2"
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div
                  className="w-8 h-5 rounded-[4px]"
                  style={{ background: color, opacity: 0.7 }}
                />
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: "#F2EDE8" }}>{name}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: AMBER }}>{pts}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[14px] font-semibold transition-all duration-150"
              style={{
                background: AMBER_DIM,
                border: `1px solid ${AMBER_BORDER}`,
                color: AMBER,
              }}
            >
              <Zap className="w-4 h-4" />
              Try the card optimizer
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-3" style={{ color: AMBER }}>
              Simple setup
            </p>
            <h2 className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-tight mb-4">
              Up and running in 10 minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="relative">
                <div
                  className="rounded-2xl p-5 h-full flex flex-col gap-3"
                  style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
                >
                  <p
                    className="text-[11px] font-bold tracking-[0.1em]"
                    style={{ color: AMBER }}
                  >
                    {n}
                  </p>
                  <h3 className="text-[15px] font-semibold" style={{ color: "#F2EDE8" }}>{title}</h3>
                  <p className="text-[13px] leading-relaxed" style={{ color: "#7A7268" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Chat showcase ─────────────────────────────────────────── */}
      <section className="px-6 py-20 relative overflow-hidden">
        <GlowBg color="#7C3AED" opacity={0.05} />
        <div className="max-w-4xl mx-auto relative">
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-3" style={{ color: AMBER }}>
              AI-powered
            </p>
            <h2 className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-tight mb-4">
              Ask your finances anything
            </h2>
            <p className="text-[16px] leading-relaxed mx-auto" style={{ color: "#7A7268", maxWidth: 500 }}>
              Claude Sonnet has full context of your accounts, spending, and goals.
              Just ask.
            </p>
          </div>

          {/* Chat mockup */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${BORDER}`, background: "#0D0D14" }}
          >
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <Bot className="w-4 h-4" style={{ color: AMBER }} />
              <span className="text-[13px] font-medium" style={{ color: "#F2EDE8" }}>AI Chat</span>
              <span
                className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: AMBER_DIM, color: AMBER, border: `1px solid ${AMBER_BORDER}` }}
              >
                Claude Sonnet · Pro
              </span>
            </div>

            <div className="p-5 space-y-4">
              {[
                {
                  role: "user",
                  text: "How much did I spend on restaurants last month, and which card should I use for dining?",
                },
                {
                  role: "assistant",
                  text: "Last month you spent $847 on dining across 23 transactions. Your top spots were Nobu ($180), Uchi ($145), and Aba ($120).\n\nFor dining, your best card is the Amex Gold — it earns 4× Membership Rewards on restaurants, worth ~8¢ per dollar spent. On your $847, that's roughly $68 in rewards value. Chase Sapphire Preferred is a close second at 3× UR.",
                },
                {
                  role: "user",
                  text: "Which of my subscriptions can I cut to save $100/month?",
                },
                {
                  role: "assistant",
                  text: "Here's what I found: You're paying for 3 overlapping streaming services ($47/mo combined). Hulu + Disney+ overlap significantly with your Netflix usage pattern. Cutting either saves $27/mo. Adobe Creative Cloud ($55/mo) shows only 2 logins in the last 90 days. That's your biggest low-usage spend. Cutting both gets you to ~$82/mo saved.",
                },
              ].map(({ role, text }, i) => (
                <div key={i} className={`flex gap-3 ${role === "user" ? "justify-end" : "justify-start"}`}>
                  {role === "assistant" && (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: AMBER_DIM, border: `1px solid ${AMBER_BORDER}` }}
                    >
                      <Bot className="w-3.5 h-3.5" style={{ color: AMBER }} />
                    </div>
                  )}
                  <div
                    className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-line"
                    style={{
                      maxWidth: "75%",
                      background: role === "user" ? AMBER_DIM : SURFACE,
                      border: `1px solid ${role === "user" ? AMBER_BORDER : BORDER}`,
                      color: role === "user" ? "#F2EDE8" : "#C8BFB4",
                    }}
                  >
                    {text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section id="pricing" className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-3" style={{ color: AMBER }}>
              Transparent pricing
            </p>
            <h2 className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-tight mb-4">
              Pay only for what costs money
            </h2>
            <p className="text-[16px] leading-relaxed mx-auto" style={{ color: "#7A7268", maxWidth: 520 }}>
              Local features — AI categorization, budgets, optimizer, reports — are always free.
              You only pay when we connect to paid APIs on your behalf.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map(({ name, price, period, highlight, badge, features, locked, cta, ctaHref }) => (
              <div
                key={name}
                className="rounded-2xl p-6 flex flex-col gap-5 relative"
                style={{
                  background: highlight ? "linear-gradient(145deg, rgba(245,185,66,0.08), rgba(245,185,66,0.03))" : SURFACE,
                  border: highlight ? `1px solid ${AMBER_BORDER}` : `1px solid ${BORDER}`,
                }}
              >
                {badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-bold tracking-[0.1em]"
                    style={{ background: AMBER, color: "#09090E" }}
                  >
                    {badge}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4" style={{ color: AMBER }} strokeWidth={1.5} />
                    <p className="text-[14px] font-bold" style={{ color: "#F2EDE8" }}>{name}</p>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-3">
                    <span className="text-[36px] font-bold font-mono tracking-tight" style={{ color: highlight ? AMBER : "#F2EDE8" }}>
                      ${price}
                    </span>
                    <span className="text-[13px]" style={{ color: "#4A4640" }}>/{period}</span>
                  </div>
                </div>

                <ul className="space-y-2 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#34D399" }} strokeWidth={2.5} />
                      <span className="text-[13px]" style={{ color: "#C8BFB4" }}>{f}</span>
                    </li>
                  ))}
                  {locked.map((f) => (
                    <li key={f} className="flex items-start gap-2 opacity-40">
                      <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#7A7268" }} strokeWidth={2} />
                      <span className="text-[13px] line-through" style={{ color: "#7A7268" }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={ctaHref}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[9px] text-[13px] font-semibold transition-all duration-150"
                  style={
                    highlight
                      ? {
                          background: "linear-gradient(135deg, #F5B942, #C9920E)",
                          color: "#09090E",
                          boxShadow: "0 4px 14px rgba(245,185,66,0.25)",
                        }
                      : {
                          background: SURFACE,
                          border: `1px solid ${BORDER}`,
                          color: "#C8BFB4",
                        }
                  }
                >
                  {cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Self-hosted trust section ─────────────────────────────────── */}
      <section className="px-6 py-20 relative overflow-hidden">
        <GlowBg color="#059669" opacity={0.04} />
        <div className="max-w-3xl mx-auto relative text-center">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6"
            style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}
          >
            <Shield className="w-6 h-6" style={{ color: "#34D399" }} strokeWidth={1.5} />
          </div>
          <h2 className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-tight mb-4">
            Your data never leaves your server
          </h2>
          <p className="text-[16px] leading-relaxed mb-8" style={{ color: "#7A7268" }}>
            Hive runs entirely on your hardware. Your Plaid credentials, bank balances, and
            transaction history are encrypted and stored in your Postgres database — not ours.
            We only touch your data when you use a paid API integration (Plaid, Claude, SnapTrade),
            and even then, only to route the request.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              { icon: Lock, title: "End-to-end encryption", desc: "Plaid access tokens encrypted with Fernet at rest. Auth via httpOnly cookies with TOTP MFA." },
              { icon: Shield, title: "No analytics tracking", desc: "Zero telemetry. No user behavior tracking. No third-party JavaScript on your dashboard." },
              { icon: CreditCard, title: "Plaid-grade bank security", desc: "Bank connections use Plaid's 256-bit TLS and read-only access. Hive never touches your credentials." },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl p-4"
                style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
              >
                <Icon className="w-4 h-4 mb-3" style={{ color: "#34D399" }} strokeWidth={1.5} />
                <p className="text-[13px] font-semibold mb-1.5" style={{ color: "#F2EDE8" }}>{title}</p>
                <p className="text-[12px] leading-relaxed" style={{ color: "#7A7268" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-24 relative overflow-hidden">
        <GlowBg />
        <div className="max-w-2xl mx-auto relative text-center">
          <HiveHex size={56} />
          <h2 className="text-[40px] sm:text-[52px] font-bold tracking-tight leading-tight mt-6 mb-4">
            Take back control of<br />
            <span
              style={{
                background: "linear-gradient(135deg, #FFD166 0%, #F5B942 50%, #C9920E 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              your financial life
            </span>
          </h2>
          <p className="text-[17px] leading-relaxed mb-10" style={{ color: "#7A7268" }}>
            Start free. Connect your accounts. Let Hive handle the rest.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="flex items-center gap-2 px-7 py-3.5 rounded-[10px] text-[15px] font-semibold transition-all duration-150"
              style={{
                background: "linear-gradient(135deg, #F5B942, #C9920E)",
                color: "#09090E",
                boxShadow: "0 4px 24px rgba(245,185,66,0.35)",
              }}
            >
              Get started — it's free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="flex items-center gap-2 px-7 py-3.5 rounded-[10px] text-[15px] font-medium transition-all duration-150"
              style={{
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                color: "#C8BFB4",
              }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer
        className="px-6 py-10"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <HiveHex size={24} />
            <span className="text-[13px] font-bold tracking-widest" style={{ color: "#4A4640" }}>HIVE</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="text-[12px] transition-colors" style={{ color: "#4A4640" }}>Pricing</Link>
            <Link href="/privacy" className="text-[12px] transition-colors" style={{ color: "#4A4640" }}>Privacy</Link>
            <Link href="/login"   className="text-[12px] transition-colors" style={{ color: "#4A4640" }}>Sign in</Link>
          </div>
          <p className="text-[11px]" style={{ color: "#2C2926" }}>
            Self-hosted · Private · Yours
          </p>
        </div>
      </footer>

    </div>
  );
}
