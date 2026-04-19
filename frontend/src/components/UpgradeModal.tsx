"use client";

import { X, CreditCard, Building2, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";

type GateType = "plaid" | "claude" | "snaptrade" | "plaid_limit" | null;

interface UpgradeModalProps {
  gate: GateType;
  onClose: () => void;
}

const GATE_COPY: Record<NonNullable<GateType>, { icon: React.ElementType; title: string; body: string }> = {
  plaid: {
    icon: Building2,
    title: "Bank connections require a paid plan",
    body: "Connect your bank accounts and credit cards to get real transaction data with Starter or Pro.",
  },
  claude: {
    icon: Zap,
    title: "Claude AI is a Pro feature",
    body: "Claude AI powers premium-quality categorization and chat. Available on the Pro plan.",
  },
  snaptrade: {
    icon: TrendingUp,
    title: "Investment tracking requires Pro",
    body: "Track your brokerage and retirement accounts with SnapTrade on the Pro plan.",
  },
  plaid_limit: {
    icon: CreditCard,
    title: "Connection limit reached",
    body: "You've reached your plan's bank connection limit. Upgrade to connect more accounts.",
  },
};

export function UpgradeModal({ gate, onClose }: UpgradeModalProps) {
  if (!gate) return null;

  const { icon: Icon, title, body } = GATE_COPY[gate];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <GlassCard tint="amber" className="relative w-full max-w-sm p-6 animate-fade-in">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-tertiary hover:text-ink-primary transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
          style={{ background: "rgba(245,185,66,0.12)", border: "1px solid rgba(245,185,66,0.2)" }}
        >
          <Icon className="w-5 h-5 text-honey" />
        </div>

        {/* Copy */}
        <h2 className="text-[15px] font-semibold text-ink-primary mb-2 leading-snug">{title}</h2>
        <p className="text-[13px] text-ink-secondary leading-relaxed mb-6">{body}</p>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/pricing"
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl
                       text-[13px] font-semibold text-[#0A0C10]
                       transition-all duration-150 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #F5B942 0%, #C9920E 100%)" }}
          >
            See Plans
          </Link>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-medium text-ink-tertiary
                       hover:text-ink-primary hover:bg-white/[0.05]
                       border border-white/[0.07] transition-all duration-150"
          >
            Maybe Later
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
