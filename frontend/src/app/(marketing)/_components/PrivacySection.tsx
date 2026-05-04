// src/app/(marketing)/_components/PrivacySection.tsx
import Link from "next/link";
import { ArrowRight, Github, Lock, DollarSign, CreditCard } from "lucide-react";

const TRUST_CARDS = [
  {
    icon: Lock,
    title: "Encrypted at rest",
    desc: "Plaid access tokens encrypted with Fernet. Auth via httpOnly cookies with optional TOTP MFA.",
  },
  {
    icon: DollarSign,
    title: "No data business model",
    desc: "Revenue comes from subscriptions, not selling your spending patterns to advertisers.",
  },
  {
    icon: CreditCard,
    title: "Read-only bank access",
    desc: "Plaid connections are read-only. We can see your transactions. We cannot move money.",
  },
];

export default function PrivacySection() {
  return (
    <section className="px-6 py-24 relative overflow-hidden">
      {/* Green glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(52,211,153,0.04) 0%, transparent 70%)",
        }}
      />
      <div className="max-w-3xl mx-auto relative text-center">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-3" style={{ color: "#34D399" }}>
          PRIVATE BY DESIGN
        </p>
        <h2 className="text-[34px] sm:text-[42px] font-bold tracking-[-0.02em] leading-tight text-ink-primary mb-4">
          Hive can&apos;t pull a Mint.
          <br />
          <span className="text-ink-secondary">The code is yours.</span>
        </h2>
        <p className="text-[15px] leading-relaxed text-ink-secondary mb-10 max-w-[520px] mx-auto">
          The managed service runs on hardware we own and control. There is no ad business
          model. Your transaction history is not used to train models, sold to third parties,
          or visible to anyone but you. If you&apos;d rather host it yourself, the full source
          code is on GitHub.
        </p>

        {/* Trust cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left mb-10">
          {TRUST_CARDS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl p-5 bg-surface border border-border"
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(52,211,153,0.09)", border: "1px solid rgba(52,211,153,0.18)" }}
              >
                <Icon className="w-4 h-4" style={{ color: "#34D399" }} strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-ink-primary mb-1.5">{title}</p>
              <p className="text-[12px] leading-relaxed text-ink-tertiary">{desc}</p>
            </div>
          ))}
        </div>

        {/* Final CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
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
      </div>
    </section>
  );
}
