// src/app/(marketing)/_components/PricingSection.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Lock, ArrowRight, Github } from "lucide-react";

const FREE_FEATURES = [
  "AI transaction categorization (Ollama, local)",
  "Budgets & mid-month pace tracking",
  "Rewards optimizer — all 5 cards",
  "Subscription detection",
  "Net worth tracking",
  "Reports & tax export (CSV)",
  "Anomaly detection (ML)",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Plaid bank sync — up to 10 accounts",
  "Daily automatic sync",
  "Claude Sonnet AI chat",
  "SnapTrade investment accounts",
  "Priority support",
];

const FREE_LOCKED = ["Plaid bank sync", "Claude AI chat"];

export default function PricingSection() {
  const [annual, setAnnual] = useState(false);

  const proPrice = annual ? 108 : 13;
  const proPeriod = annual ? "/yr" : "/mo";
  const proNote = annual ? "Billed annually · 2 months free" : "Billed monthly";

  return (
    <section id="pricing" className="px-6 py-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-honey mb-3">
            PRICING
          </p>
          <h2 className="text-[36px] sm:text-[44px] font-bold tracking-[-0.02em] leading-tight text-ink-primary mb-4">
            You only pay for what costs us money.
          </h2>
          <p className="text-[16px] text-ink-secondary leading-relaxed max-w-[500px] mx-auto mb-8">
            AI categorization, budgets, the optimizer, and reports run on local compute — free.
            Plaid bank sync and Claude AI cost us per-use, so that&apos;s what Pro covers.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface border border-border">
            {(["Monthly", "Annual"] as const).map((label) => {
              const isActive = (label === "Annual") === annual;
              return (
                <button
                  key={label}
                  onClick={() => setAnnual(label === "Annual")}
                  className="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150"
                  style={{
                    background: isActive ? "rgba(245,185,66,0.10)" : "transparent",
                    color: isActive ? "#F5B942" : "#5A6475",
                    border: isActive ? "1px solid rgba(245,185,66,0.20)" : "1px solid transparent",
                  }}
                >
                  {label}
                  {label === "Annual" && (
                    <span className="ml-1.5 text-[9px] font-bold text-semantic-income">
                      −15%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Free */}
          <div className="rounded-2xl p-7 flex flex-col gap-6 bg-surface border border-border">
            <div>
              <p className="text-[14px] font-bold text-ink-primary mb-2">Free</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[40px] font-bold font-geist-mono tracking-tight text-ink-primary">
                  $0
                </span>
                <span className="text-[14px] text-ink-tertiary">/forever</span>
              </div>
              <p className="text-[12px] text-ink-ghost mt-1">
                All local features. No bank sync.
              </p>
            </div>
            <ul className="space-y-2.5 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-semantic-income" strokeWidth={2.5} />
                  <span className="text-[13px] text-ink-secondary">{f}</span>
                </li>
              ))}
              {FREE_LOCKED.map((f) => (
                <li key={f} className="flex items-start gap-2.5 opacity-30">
                  <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ink-ghost" strokeWidth={1.8} />
                  <span className="text-[13px] text-ink-ghost line-through">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="hive-btn-secondary w-full flex items-center justify-center gap-2 py-2.5 rounded-[9px] text-[13px] font-semibold"
            >
              Start for Free
            </Link>
          </div>

          {/* Pro */}
          <div
            className="rounded-2xl p-7 flex flex-col gap-6 relative"
            style={{
              background: "linear-gradient(145deg, rgba(245,185,66,0.08), rgba(245,185,66,0.03))",
              border: "1px solid rgba(245,185,66,0.22)",
            }}
          >
            {/* Badge */}
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[9px] font-bold tracking-widest"
              style={{ background: "#F5B942", color: "#09090E" }}
            >
              MOST POPULAR
            </div>

            <div>
              <p className="text-[14px] font-bold text-ink-primary mb-2">Pro</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[40px] font-bold font-geist-mono tracking-tight text-honey">
                  ${proPrice}
                </span>
                <span className="text-[14px] text-ink-tertiary">{proPeriod}</span>
              </div>
              <p className="text-[12px] text-ink-ghost mt-1">{proNote}</p>
            </div>
            <ul className="space-y-2.5 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: "#F5B942" }}
                    strokeWidth={2.5}
                  />
                  <span className="text-[13px] text-ink-secondary">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="hive-btn-primary w-full flex items-center justify-center gap-2 py-2.5 rounded-[9px] text-[13px] font-semibold"
            >
              Get Early Access
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Founding member callout */}
        <div
          className="rounded-2xl p-6 mb-4 text-center"
          style={{
            background: "rgba(245,185,66,0.04)",
            border: "1px solid rgba(245,185,66,0.14)",
          }}
        >
          <p className="text-[14px] font-bold text-ink-primary mb-1">
            🐝 Founding Member Rate
          </p>
          <p className="text-[13px] text-ink-secondary mb-4">
            First 500 users lock in{" "}
            <span className="text-honey font-bold">$7/mo forever</span> — even when we raise
            the price.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-semibold text-honey border border-border-honey hover:bg-honey-faint transition-colors duration-150"
          >
            Claim Founding Rate
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Self-host callout */}
        <div className="rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 bg-surface border border-border">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[14px] font-semibold text-ink-primary">Prefer to own everything?</p>
            <p className="text-[12px] text-ink-ghost mt-0.5">
              Clone the repo, bring your own Plaid and Anthropic keys, run it free on your own
              hardware. The code is always public.
            </p>
          </div>
          <a
            href="https://github.com/collinszach/hive"
            target="_blank"
            rel="noopener noreferrer"
            className="hive-btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium shrink-0"
          >
            <Github className="w-4 h-4" />
            Self-Host on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
