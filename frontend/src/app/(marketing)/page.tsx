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
  Lock,
  ArrowRight,
  Check,
  Server,
  Cloud,
  ChevronRight,
  GitBranch,
  RefreshCw,
  DollarSign,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const A = "#F5B942";
const A_DIM = "rgba(245,185,66,0.08)";
const A_BORDER = "rgba(245,185,66,0.18)";
const BG = "#09090E";
const SURFACE = "rgba(255,255,255,0.035)";
const BORDER = "rgba(255,255,255,0.055)";

// ── Sub-components ────────────────────────────────────────────────────────────

function HiveHex({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0,
        background: "linear-gradient(135deg,#F5B942 0%,#C9920E 100%)",
        boxShadow: `0 0 0 1px rgba(245,185,66,.4),0 4px 16px rgba(245,185,66,.28)`,
        borderRadius: Math.round(size * 0.26),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.52, height: size * 0.52 }}>
        <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" fill="rgba(9,8,7,.75)" />
        <path d="M12 6L17.2 9V15L12 18L6.8 15V9L12 6Z" fill="rgba(245,185,66,.35)" />
        <circle cx="12" cy="12" r="2" fill="rgba(9,8,7,.9)" />
        <circle cx="12" cy="12" r="1" fill="rgba(245,185,66,.95)" />
      </svg>
    </div>
  );
}

function Tag({
  children,
  color = A,
  bg = A_DIM,
  border = A_BORDER,
}: {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  border?: string;
}) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-3" style={{ color: A }}>
      {children}
    </p>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: RefreshCw,
    title: "Automatic Bank Sync",
    desc: "Every transaction from every account, pulled daily via Plaid. No CSV imports. No manual entry. Works across 12,000+ banks.",
  },
  {
    icon: Bot,
    title: "3-Stage AI Categorization",
    desc: "Regex rules catch the obvious. A local Ollama model handles the rest. Claude Haiku cleans up edge cases. 95%+ accuracy, zero human review.",
  },
  {
    icon: Star,
    title: "Points & Rewards Optimizer",
    desc: "Tracks Amex MR, Chase UR, Capital One Miles, Bilt, Southwest Rapid Rewards, and Wells Fargo Rewards. Tells you which card earns the most on every purchase.",
  },
  {
    icon: BarChart3,
    title: "Budgets & Pace Tracking",
    desc: "Set monthly limits by category. Mid-month pace indicators show if you're on track before it's too late to adjust.",
  },
  {
    icon: Receipt,
    title: "Subscription Detection",
    desc: "Automatically surfaces recurring charges and your total monthly subscription spend. Nothing hides in the noise.",
  },
  {
    icon: TrendingUp,
    title: "Net Worth Over Time",
    desc: "Daily balance snapshots across checking, savings, credit cards, and investments. Watch the trend, not just the number.",
  },
  {
    icon: Bot,
    title: "Claude Sonnet AI Chat",
    desc: "'How much did I spend on restaurants in March?' Ask in plain English. Get exact answers backed by your actual transaction history.",
  },
  {
    icon: BarChart3,
    title: "Reports & Tax Export",
    desc: "Month-over-month category breakdowns and one-click CSV export of deductible transactions. Clean data for your accountant.",
  },
  {
    icon: Shield,
    title: "No Ads. No Data Sales.",
    desc: "There's no advertising business model here. Your transaction data is never sold, shared, or used to train models you don't control.",
  },
];

const CARDS = [
  { name: "Amex Gold",         pts: "4× dining & groceries",  color: "#B8860B" },
  { name: "Chase Sapphire",    pts: "3× dining & travel",     color: "#1A508B" },
  { name: "Bilt Blue",         pts: "3× dining, 2× travel",   color: "#2D2D3A" },
  { name: "Capital One Venture X", pts: "2× everywhere",      color: "#8B0000" },
  { name: "Chase Southwest",   pts: "3× SW Flights",          color: "#1B3A8A" },
  { name: "WF Autograph",      pts: "3× across 8 categories", color: "#8B0000" },
];

const MANAGED_FEATURES = [
  "All features, always up to date",
  "Plaid bank sync included",
  "Claude AI chat (Pro)",
  "Hosted on private infrastructure",
  "Backups & monitoring handled",
  "No DevOps required",
];

const SELFHOST_FEATURES = [
  "Full source code on GitHub",
  "Run on your own hardware",
  "Use your own API keys",
  "No monthly fee, ever",
  "Docker Compose setup",
  "Complete data ownership",
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ background: BG, color: "#F2EDE8", fontFamily: "system-ui,-apple-system,sans-serif" }}>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5"
        style={{
          background: "rgba(9,9,14,0.88)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <HiveHex size={30} />
          <span className="text-[14px] font-bold tracking-[0.08em]" style={{ color: "#F2EDE8" }}>
            HIVE
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-7">
          {[["#features", "Features"], ["#how-it-works", "How it works"], ["#pricing", "Pricing"]].map(([href, label]) => (
            <a
              key={label}
              href={href}
              className="text-[13px] font-medium transition-colors duration-150"
              style={{ color: "#5A5450" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#C8BFB4")}
              onMouseLeave={e => (e.currentTarget.style.color = "#5A5450")}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:block px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-150"
            style={{ color: "#5A5450" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#C8BFB4")}
            onMouseLeave={e => (e.currentTarget.style.color = "#5A5450")}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-150"
            style={{
              background: "linear-gradient(135deg,#F5B942,#C9920E)",
              color: "#09090E",
              boxShadow: "0 2px 10px rgba(245,185,66,.25)",
            }}
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6 text-center">
        <div
          aria-hidden
          className="absolute left-0 right-0 top-0 h-[500px] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% 0%,rgba(245,185,66,.07) 0%,transparent 70%)",
          }}
        />

        {/* Dual-mode badge */}
        <div className="inline-flex items-center gap-0 rounded-xl mb-10 overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-1.5 px-3.5 py-1.5" style={{ background: A_DIM, borderRight: `1px solid ${BORDER}` }}>
            <Cloud className="w-3 h-3" style={{ color: A }} />
            <span className="text-[11px] font-semibold" style={{ color: A }}>Managed service</span>
          </div>
          <div className="flex items-center gap-1.5 px-3.5 py-1.5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <GitBranch className="w-3 h-3" style={{ color: "#7A7268" }} />
            <span className="text-[11px] font-semibold" style={{ color: "#7A7268" }}>or self-host free</span>
          </div>
        </div>

        <h1
          className="text-[52px] sm:text-[68px] lg:text-[84px] font-bold leading-[1.04] tracking-[-0.03em] mb-6 mx-auto"
          style={{ maxWidth: 920 }}
        >
          Personal finance{" "}
          <span
            style={{
              background: "linear-gradient(135deg,#FFD166 0%,#F5B942 50%,#C9920E 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            built to respect you.
          </span>
        </h1>

        <p
          className="text-[17px] sm:text-[19px] leading-relaxed mb-10 mx-auto"
          style={{ color: "#7A7268", maxWidth: 580 }}
        >
          Hive automatically syncs every bank account and credit card, categorizes transactions
          with AI, tracks your rewards points, and answers questions about your money in plain
          English. Use it as a managed service, or clone the repo and run it yourself.
        </p>

        {/* Dual CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Link
            href="/register"
            className="flex items-center gap-2 px-6 py-3 rounded-[10px] text-[15px] font-semibold transition-all duration-150 w-full sm:w-auto justify-center"
            style={{
              background: "linear-gradient(135deg,#F5B942,#C9920E)",
              color: "#09090E",
              boxShadow: "0 4px 20px rgba(245,185,66,.30)",
            }}
          >
            <Cloud className="w-4 h-4" />
            Start managed — free plan available
          </Link>
          <a
            href="https://github.com/collinszach/hive"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-[10px] text-[15px] font-medium transition-all duration-150 w-full sm:w-auto justify-center"
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              color: "#C8BFB4",
            }}
          >
            <GitBranch className="w-4 h-4" />
            Self-host on GitHub
            <ArrowRight className="w-3.5 h-3.5 opacity-50" />
          </a>
        </div>
        <p className="text-[12px]" style={{ color: "#3A3630" }}>
          No credit card required · Cancel anytime · Full source code always public
        </p>
      </section>

      {/* ── Dashboard mockup ──────────────────────────────────────────── */}
      <section className="px-6 pb-24">
        <div
          className="mx-auto rounded-2xl overflow-hidden"
          style={{
            maxWidth: 980,
            border: `1px solid ${BORDER}`,
            background: "#0D0D14",
            boxShadow: "0 40px 80px rgba(0,0,0,.55),0 0 0 1px rgba(245,185,66,.05)",
          }}
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(248,113,113,0.4)" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(251,191,36,0.4)" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(52,211,153,0.4)" }} />
            <div
              className="flex-1 mx-4 px-3 py-0.5 rounded-md text-[11px] font-mono text-center"
              style={{ background: "rgba(255,255,255,.04)", color: "#3A3630" }}
            >
              app.hive.finance / dashboard
            </div>
          </div>

          <div className="flex">
            {/* Fake sidebar */}
            <div className="w-[148px] shrink-0 p-2.5 space-y-0.5" style={{ borderRight: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
                <HiveHex size={20} />
                <span className="text-[10px] font-bold tracking-widest" style={{ color: "#F2EDE8" }}>HIVE</span>
              </div>
              {["Dashboard","Transactions","Budgets","Optimizer","Points","AI Chat"].map((item, i) => (
                <div
                  key={item}
                  className="px-2 py-1.5 rounded-lg flex items-center gap-2"
                  style={{ background: i === 0 ? A_DIM : "transparent", color: i === 0 ? A : "#4A4640" }}
                >
                  <div className="w-1.5 h-1.5 rounded-sm" style={{ background: i === 0 ? A : "#2C2926" }} />
                  <span className="text-[10px] font-medium">{item}</span>
                </div>
              ))}
            </div>

            {/* Fake content */}
            <div className="flex-1 p-4 space-y-3">
              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { label: "Net Cash",    value: "$8,240",  color: A },
                  { label: "Total Assets",value: "$42,100", color: "#34D399" },
                  { label: "Credit Used", value: "$3,860",  color: "#F87171" },
                  { label: "Points Value",value: "$1,240",  color: "#38BDF8" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3 rounded-xl" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                    <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "#3A3630" }}>{label}</p>
                    <p className="text-[15px] font-bold font-mono" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl p-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                  <p className="text-[9px] uppercase tracking-wider mb-2.5" style={{ color: "#3A3630" }}>Budgets · May 2025</p>
                  {[
                    { cat: "Food & Drink", pct: 72, color: "#F97316" },
                    { cat: "Groceries",    pct: 45, color: "#34D399" },
                    { cat: "Travel",       pct: 91, color: "#38BDF8" },
                    { cat: "Entertainment",pct: 38, color: "#A78BFA" },
                  ].map(({ cat, pct, color }) => (
                    <div key={cat} className="mb-1.5">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[9px]" style={{ color: "#6A6460" }}>{cat}</span>
                        <span className="text-[9px] font-mono" style={{ color }}>{pct}%</span>
                      </div>
                      <div className="h-[3px] rounded-full" style={{ background: "rgba(255,255,255,.06)" }}>
                        <div className="h-[3px] rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                  <p className="text-[9px] uppercase tracking-wider mb-2.5" style={{ color: "#3A3630" }}>Points Programs</p>
                  {[
                    { prog: "Chase UR",     pts: "87,400 pts", val: "$1,792" },
                    { prog: "Amex MR",      pts: "62,100 pts", val: "$1,242" },
                    { prog: "Capital One",  pts: "31,500 pts", val: "$583"   },
                    { prog: "Bilt Points",  pts: "18,900 pts", val: "$397"   },
                  ].map(({ prog, pts, val }) => (
                    <div key={prog} className="flex items-center justify-between mb-2">
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
      </section>

      {/* ── Two tracks ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <SectionLabel>Two ways to use Hive</SectionLabel>
            <h2 className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-tight">
              Managed or self-hosted.<br />Same product. Your call.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Managed */}
            <div
              className="rounded-2xl p-7 flex flex-col gap-5"
              style={{
                background: "linear-gradient(145deg,rgba(245,185,66,.07),rgba(245,185,66,.02))",
                border: `1px solid ${A_BORDER}`,
              }}
            >
              <div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: A_DIM }}
                >
                  <Cloud className="w-5 h-5" style={{ color: A }} strokeWidth={1.8} />
                </div>
                <Tag>Managed service</Tag>
                <h3 className="text-[20px] font-bold mt-3 mb-2" style={{ color: "#F2EDE8" }}>
                  We handle everything
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "#7A7268" }}>
                  Sign up and start connecting accounts in minutes. We operate the servers,
                  manage the Plaid and Anthropic integrations, and keep everything running.
                  Your data lives on private infrastructure — not AWS, not Google Cloud.
                </p>
              </div>
              <ul className="space-y-2">
                {MANAGED_FEATURES.map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: A }} strokeWidth={2.5} />
                    <span className="text-[13px]" style={{ color: "#C8BFB4" }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[9px] text-[13px] font-semibold mt-auto transition-all duration-150"
                style={{
                  background: "linear-gradient(135deg,#F5B942,#C9920E)",
                  color: "#09090E",
                  boxShadow: "0 4px 14px rgba(245,185,66,.22)",
                }}
              >
                Get started free
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Self-host */}
            <div
              className="rounded-2xl p-7 flex flex-col gap-5"
              style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
            >
              <div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <Server className="w-5 h-5" style={{ color: "#C8BFB4" }} strokeWidth={1.8} />
                </div>
                <Tag color="#C8BFB4" bg="rgba(255,255,255,0.06)" border="rgba(255,255,255,0.1)">
                  Self-hosted
                </Tag>
                <h3 className="text-[20px] font-bold mt-3 mb-2" style={{ color: "#F2EDE8" }}>
                  Run it yourself
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "#7A7268" }}>
                  Clone the repo, add your own Plaid and Anthropic keys, and run it on any
                  machine with Docker Compose. Your server, your database, your keys — total
                  control, no subscription required.
                </p>
              </div>
              <ul className="space-y-2">
                {SELFHOST_FEATURES.map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#34D399" }} strokeWidth={2.5} />
                    <span className="text-[13px]" style={{ color: "#C8BFB4" }}>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="https://github.com/collinszach/hive"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[9px] text-[13px] font-semibold mt-auto transition-all duration-150"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${BORDER}`,
                  color: "#C8BFB4",
                }}
              >
                <GitBranch className="w-3.5 h-3.5" />
                View on GitHub
                <ArrowRight className="w-3.5 h-3.5 opacity-40" />
              </a>
            </div>
          </div>

          {/* Comparison note */}
          <p className="text-center text-[12px] mt-6" style={{ color: "#3A3630" }}>
            Both options include every feature. The managed service saves you the DevOps overhead.
            Self-hosting is completely free — we just ask you not to resell it.
          </p>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <SectionLabel>Everything included</SectionLabel>
            <h2 className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-tight mb-4">
              No feature tiers. No upsell nags.
            </h2>
            <p className="text-[16px] leading-relaxed mx-auto" style={{ color: "#7A7268", maxWidth: 500 }}>
              Every plan on the managed service gets every feature. You only pay more when we
              connect to paid APIs (Plaid, Claude) on your behalf.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200"
                style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.border = `1px solid ${A_BORDER}`;
                  (e.currentTarget as HTMLElement).style.background = A_DIM;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.border = `1px solid ${BORDER}`;
                  (e.currentTarget as HTMLElement).style.background = SURFACE;
                }}
              >
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                  style={{ background: A_DIM }}
                >
                  <Icon className="w-4 h-4" style={{ color: A }} strokeWidth={1.8} />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold mb-1.5" style={{ color: "#F2EDE8" }}>{title}</h3>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "#6A6460" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Points optimizer showcase ─────────────────────────────────── */}
      <section className="px-6 py-20 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%,rgba(245,185,66,.04) 0%,transparent 70%)" }}
        />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-12">
            <SectionLabel>Rewards optimizer</SectionLabel>
            <h2 className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-tight mb-4">
              Know the right card before you swipe
            </h2>
            <p className="text-[16px] leading-relaxed mx-auto" style={{ color: "#7A7268", maxWidth: 500 }}>
              Hive tracks your full card portfolio and shows you which card earns the most on
              any given purchase — dining, gas, travel, groceries, everything.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {CARDS.map(({ name, pts, color }) => (
              <div
                key={name}
                className="rounded-xl p-4"
                style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
              >
                <div className="w-8 h-5 rounded mb-2.5" style={{ background: color, opacity: 0.65 }} />
                <p className="text-[12px] font-semibold mb-0.5" style={{ color: "#F2EDE8" }}>{name}</p>
                <p className="text-[11px]" style={{ color: A }}>{pts}</p>
              </div>
            ))}
          </div>

          {/* Optimizer demo strip */}
          <div
            className="rounded-2xl p-5"
            style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
          >
            <p className="text-[11px] uppercase tracking-wider mb-4" style={{ color: "#3A3630" }}>
              Example · Best card for: Restaurant, $85
            </p>
            <div className="space-y-2">
              {[
                { card: "Amex Gold",           earn: "4× MR",  value: "$6.80", best: true },
                { card: "Chase Sapphire Preferred", earn: "3× UR", value: "$5.21", best: false },
                { card: "Bilt Blue",           earn: "3× Bilt", value: "$5.36", best: false },
                { card: "Capital One Venture X", earn: "2× Miles", value: "$3.15", best: false },
              ].map(({ card, earn, value, best }, i) => (
                <div
                  key={card}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{
                    background: best ? A_DIM : "rgba(255,255,255,0.02)",
                    border: `1px solid ${best ? A_BORDER : "transparent"}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono w-4 text-center" style={{ color: best ? A : "#4A4640" }}>
                      {i + 1}
                    </span>
                    <p className="text-[12px] font-medium" style={{ color: best ? "#F2EDE8" : "#7A7268" }}>{card}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-mono" style={{ color: best ? A : "#4A4640" }}>{earn}</span>
                    <span className="text-[12px] font-semibold font-mono" style={{ color: best ? "#34D399" : "#4A4640" }}>{value}</span>
                    {best && <Tag>Best</Tag>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AI Chat showcase ──────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel>AI-powered answers</SectionLabel>
            <h2 className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-tight mb-4">
              Ask your finances anything
            </h2>
            <p className="text-[16px] leading-relaxed mx-auto" style={{ color: "#7A7268", maxWidth: 480 }}>
              Claude Sonnet has your full transaction history, account balances, subscriptions,
              and goals in context. Plain English in, exact answers out.
            </p>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${BORDER}`, background: "#0D0D14" }}
          >
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <Bot className="w-3.5 h-3.5" style={{ color: A }} />
              <span className="text-[13px] font-medium" style={{ color: "#F2EDE8" }}>AI Chat</span>
              <span
                className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: A_DIM, color: A, border: `1px solid ${A_BORDER}` }}
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
                  text: "Last month you spent $847 on dining across 23 transactions. Top spots were Nobu ($180), Uchi ($145), and Aba ($120).\n\nFor dining, your best card is the Amex Gold — 4× Membership Rewards on restaurants, worth roughly 8¢/dollar. On $847 that's about $68 in rewards. Chase Sapphire is second at 3× UR.",
                },
                {
                  role: "user",
                  text: "Which subscriptions can I cut to save $100/month?",
                },
                {
                  role: "assistant",
                  text: "You're paying for Hulu ($18) and Disney+ ($14) alongside Netflix — significant overlap. Cutting either saves $14–18/mo. Adobe Creative Cloud ($55/mo) shows only 2 logins in the last 90 days. That's your highest-value cut. Dropping both gets you to $69–73/mo saved. Add your rarely-used Calm subscription ($10/mo) and you hit $79–83/mo.",
                },
              ].map(({ role, text }, i) => (
                <div key={i} className={`flex gap-3 ${role === "user" ? "justify-end" : "justify-start"}`}>
                  {role === "assistant" && (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: A_DIM, border: `1px solid ${A_BORDER}` }}
                    >
                      <Bot className="w-3.5 h-3.5" style={{ color: A }} />
                    </div>
                  )}
                  <div
                    className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-line"
                    style={{
                      maxWidth: "76%",
                      background: role === "user" ? A_DIM : SURFACE,
                      border: `1px solid ${role === "user" ? A_BORDER : BORDER}`,
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
            <SectionLabel>Managed service pricing</SectionLabel>
            <h2 className="text-[36px] sm:text-[44px] font-bold tracking-tight leading-tight mb-4">
              You only pay for what costs us money
            </h2>
            <p className="text-[16px] leading-relaxed mx-auto" style={{ color: "#7A7268", maxWidth: 540 }}>
              AI categorization, budgets, the optimizer, reports, and tax export run on local
              infrastructure — they're free. Plaid sync and Claude AI cost us per-use, so
              that's what paid plans cover.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              {
                name: "Free",
                price: "$0",
                period: "forever",
                highlight: false,
                badge: null,
                desc: "All local features. No bank sync.",
                features: [
                  "AI transaction categorization",
                  "Budgets & pace tracking",
                  "Points optimizer",
                  "Subscription detection",
                  "Tax export",
                  "Net worth tracking",
                ],
                locked: ["Plaid bank sync", "Claude AI chat"],
                cta: "Start free",
                href: "/register",
              },
              {
                name: "Starter",
                price: "$9",
                period: "/month",
                highlight: false,
                badge: null,
                desc: "Automatic sync for up to 3 accounts.",
                features: [
                  "Everything in Free",
                  "Up to 3 connected accounts",
                  "Daily automatic Plaid sync",
                  "Transaction webhook alerts",
                ],
                locked: ["Claude AI chat"],
                cta: "Start Starter",
                href: "/register",
              },
              {
                name: "Pro",
                price: "$19",
                period: "/month",
                highlight: true,
                badge: "MOST POPULAR",
                desc: "Full sync + Claude AI for power users.",
                features: [
                  "Everything in Starter",
                  "Up to 10 connected accounts",
                  "Claude Sonnet AI chat",
                  "SnapTrade investment accounts",
                ],
                locked: [],
                cta: "Start Pro",
                href: "/register",
              },
            ].map(({ name, price, period, highlight, badge, desc, features, locked, cta, href }) => (
              <div
                key={name}
                className="rounded-2xl p-6 flex flex-col gap-5 relative"
                style={{
                  background: highlight
                    ? "linear-gradient(145deg,rgba(245,185,66,.09),rgba(245,185,66,.03))"
                    : SURFACE,
                  border: highlight ? `1px solid ${A_BORDER}` : `1px solid ${BORDER}`,
                }}
              >
                {badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[9px] font-bold tracking-widest"
                    style={{ background: A, color: "#09090E" }}
                  >
                    {badge}
                  </div>
                )}
                <div>
                  <p className="text-[13px] font-bold mb-1" style={{ color: "#F2EDE8" }}>{name}</p>
                  <div className="flex items-baseline gap-0.5 mt-2 mb-1">
                    <span className="text-[34px] font-bold font-mono tracking-tight" style={{ color: highlight ? A : "#F2EDE8" }}>
                      {price}
                    </span>
                    <span className="text-[13px] ml-1" style={{ color: "#4A4640" }}>{period}</span>
                  </div>
                  <p className="text-[12px]" style={{ color: "#5A5450" }}>{desc}</p>
                </div>
                <ul className="space-y-2 flex-1">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#34D399" }} strokeWidth={2.5} />
                      <span className="text-[12.5px]" style={{ color: "#C8BFB4" }}>{f}</span>
                    </li>
                  ))}
                  {locked.map(f => (
                    <li key={f} className="flex items-start gap-2 opacity-35">
                      <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#5A5450" }} strokeWidth={1.8} />
                      <span className="text-[12.5px] line-through" style={{ color: "#5A5450" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[9px] text-[13px] font-semibold transition-all duration-150"
                  style={
                    highlight
                      ? { background: "linear-gradient(135deg,#F5B942,#C9920E)", color: "#09090E", boxShadow: "0 4px 14px rgba(245,185,66,.22)" }
                      : { background: "rgba(255,255,255,.04)", border: `1px solid ${BORDER}`, color: "#C8BFB4" }
                  }
                >
                  {cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>

          {/* Self-host callout */}
          <div
            className="rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4"
            style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${BORDER}` }}
          >
            <div className="flex items-center gap-3 shrink-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <Server className="w-5 h-5" style={{ color: "#C8BFB4" }} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "#F2EDE8" }}>Prefer to self-host?</p>
                <p className="text-[12px]" style={{ color: "#5A5450" }}>Free forever. Use your own Plaid and Anthropic keys.</p>
              </div>
            </div>
            <a
              href="https://github.com/collinszach/hive"
              target="_blank"
              rel="noopener noreferrer"
              className="sm:ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 whitespace-nowrap"
              style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: "#C8BFB4" }}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Clone on GitHub
              <ArrowRight className="w-3.5 h-3.5 opacity-40" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Privacy / trust ───────────────────────────────────────────── */}
      <section className="px-6 py-20 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%,rgba(52,211,153,.03) 0%,transparent 70%)" }}
        />
        <div className="max-w-3xl mx-auto relative text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-6"
            style={{ background: "rgba(52,211,153,.1)", border: "1px solid rgba(52,211,153,.18)" }}
          >
            <Shield className="w-5 h-5" style={{ color: "#34D399" }} strokeWidth={1.5} />
          </div>
          <h2 className="text-[34px] sm:text-[42px] font-bold tracking-tight leading-tight mb-4">
            Private by design, not by policy
          </h2>
          <p className="text-[15px] leading-relaxed mb-10" style={{ color: "#7A7268" }}>
            The managed service runs on hardware we own and control — no AWS, no Google Cloud,
            no data brokers in the supply chain. There is no ad business model. Your transaction
            history is not used to train models, sold to third parties, or visible to anyone
            but you. If you'd rather host it yourself, the full source code is on GitHub.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
            {[
              { icon: Lock,       title: "Encrypted at rest",    desc: "Plaid access tokens encrypted with Fernet. Auth via httpOnly cookies with optional TOTP MFA." },
              { icon: DollarSign, title: "No data business model", desc: "We make money from subscriptions, not from selling your spending patterns to advertisers." },
              { icon: CreditCard, title: "Read-only bank access", desc: "Plaid connections are read-only. We can see your transactions — we cannot move money." },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl p-4"
                style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
              >
                <Icon className="w-4 h-4 mb-2.5" style={{ color: "#34D399" }} strokeWidth={1.5} />
                <p className="text-[13px] font-semibold mb-1.5" style={{ color: "#F2EDE8" }}>{title}</p>
                <p className="text-[12px] leading-relaxed" style={{ color: "#6A6460" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="px-6 py-24 relative overflow-hidden text-center">
        <div
          aria-hidden
          className="absolute left-0 right-0 bottom-0 h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 50% at 50% 100%,rgba(245,185,66,.06) 0%,transparent 70%)" }}
        />
        <div className="max-w-xl mx-auto relative">
          <HiveHex size={52} />
          <h2 className="text-[38px] sm:text-[50px] font-bold tracking-tight leading-tight mt-6 mb-4">
            Start free.<br />
            <span
              style={{
                background: "linear-gradient(135deg,#FFD166 0%,#F5B942 50%,#C9920E 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Upgrade when you need it.
            </span>
          </h2>
          <p className="text-[16px] leading-relaxed mb-10" style={{ color: "#7A7268" }}>
            Use the managed service or self-host. Either way, your financial data stays
            out of the hands of companies that profit from it.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="flex items-center gap-2 px-7 py-3.5 rounded-[10px] text-[15px] font-semibold transition-all duration-150 w-full sm:w-auto justify-center"
              style={{
                background: "linear-gradient(135deg,#F5B942,#C9920E)",
                color: "#09090E",
                boxShadow: "0 4px 24px rgba(245,185,66,.32)",
              }}
            >
              <Cloud className="w-4 h-4" />
              Use managed service
            </Link>
            <a
              href="https://github.com/collinszach/hive"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-7 py-3.5 rounded-[10px] text-[15px] font-medium transition-all duration-150 w-full sm:w-auto justify-center"
              style={{
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                color: "#C8BFB4",
              }}
            >
              <GitBranch className="w-4 h-4" />
              Self-host for free
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="px-6 py-8" style={{ borderTop: `1px solid ${BORDER}` }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <HiveHex size={22} />
            <span className="text-[12px] font-bold tracking-widest" style={{ color: "#3A3630" }}>HIVE</span>
          </div>
          <div className="flex items-center gap-6">
            {[["#pricing","Pricing"],["/privacy","Privacy"],["/login","Sign in"]].map(([href, label]) => (
              <Link key={label} href={href} className="text-[12px] transition-colors" style={{ color: "#3A3630" }}>
                {label}
              </Link>
            ))}
            <a
              href="https://github.com/collinszach/hive"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] transition-colors"
              style={{ color: "#3A3630" }}
            >
              GitHub
            </a>
          </div>
          <p className="text-[11px]" style={{ color: "#2C2926" }}>
            Managed service · Open source · No VC
          </p>
        </div>
      </footer>

    </div>
  );
}
