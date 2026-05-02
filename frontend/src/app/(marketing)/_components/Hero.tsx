// src/app/(marketing)/_components/Hero.tsx
import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";

const KPI_CARDS = [
  { label: "Net Cash",     value: "$8,240",  color: "#F5B942" },
  { label: "Total Assets", value: "$142,100", color: "#34D399" },
  { label: "Points Value", value: "$1,842",  color: "#60A5FA" },
  { label: "Monthly Spend",value: "$3,210",  color: "#A0A8B8" },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-24 px-6 text-center">
      {/* Amber radial glow */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[640px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% -5%, rgba(245,185,66,0.10) 0%, transparent 70%)",
        }}
      />
      {/* Hex grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.018,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='52' viewBox='0 0 60 52' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 17.3V34.6L30 52L0 34.6V17.3L30 0Z' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 52px",
        }}
      />

      <div className="relative max-w-4xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-10 border border-border-subtle bg-surface">
          <span className="w-1.5 h-1.5 rounded-full bg-honey" />
          <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-tertiary">
            Now in early access
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-[54px] sm:text-[70px] lg:text-[88px] font-bold leading-[1.02] tracking-[-0.03em] mb-6 text-ink-primary">
          Your money,{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #FFD166 0%, #F5B942 55%, #C9920E 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            your data,
          </span>
          <br />
          your rules.
        </h1>

        {/* Subhead */}
        <p className="text-[18px] sm:text-[20px] leading-relaxed text-ink-secondary max-w-[580px] mx-auto mb-10">
          Hive syncs every account, categorizes every transaction with AI, and tells you
          which credit card earns the most on every purchase — automatically.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
          <Link
            href="/register"
            className="hive-btn-primary w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 text-[15px] rounded-[10px]"
          >
            Get Early Access
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="https://github.com/collinszach/hive"
            target="_blank"
            rel="noopener noreferrer"
            className="hive-btn-secondary w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 text-[15px] rounded-[10px]"
          >
            <Github className="w-4 h-4" />
            Self-Host for Free
          </a>
        </div>

        <p className="text-[12px] text-ink-ghost">
          No credit card required · Open source · Your data never leaves your infrastructure
        </p>

        {/* KPI score cards */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
          {KPI_CARDS.map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl p-4 bg-surface border border-border text-left"
            >
              <p className="text-[10px] uppercase tracking-wider text-ink-ghost mb-1.5">
                {label}
              </p>
              <p
                className="text-[20px] font-bold font-geist-mono tracking-tight"
                style={{ color }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
