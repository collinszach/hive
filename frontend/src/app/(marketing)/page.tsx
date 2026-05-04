// src/app/(marketing)/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "./_components/Nav";
import Hero from "./_components/Hero";
import TrustBar from "./_components/TrustBar";
import ComparisonTable from "./_components/ComparisonTable";
import FeatureShowcase from "./_components/FeatureShowcase";
import OptimizerMockup from "./_components/mockups/OptimizerMockup";
import TransactionFeedMockup from "./_components/mockups/TransactionFeedMockup";
import ChatMockup from "./_components/mockups/ChatMockup";
import NetWorthMockup from "./_components/mockups/NetWorthMockup";
import InsightsMockup from "./_components/mockups/InsightsMockup";
import PricingSection from "./_components/PricingSection";
import PrivacySection from "./_components/PrivacySection";
import MarketingFooter from "./_components/MarketingFooter";

export default function LandingPage() {
  const router = useRouter();

  // Redirect already-authenticated users straight to the app
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => { if (r.ok) router.replace("/dashboard"); })
      .catch(() => {});
  }, [router]);

  return (
    <div className="bg-base text-ink-primary">
      <Nav />

      <main id="features">
        <Hero />
        <TrustBar />
        <ComparisonTable />

        {/* ── Feature showcases ── */}
        <FeatureShowcase
          label="REWARDS OPTIMIZER"
          headline="Know the right card before you tap."
          description="Saplyn tracks your full card portfolio and scores every purchase against your actual earn rates. Dining out? Amex Gold. Gas? Capital One Venture X. It tells you — you don't have to remember."
          bullets={[
            "Amex Gold, Chase Sapphire, Bilt Blue, Venture X, Chase Southwest",
            "Earn rates updated automatically from your card list",
            "Points valued at redemption rate (not 1¢)",
          ]}
          mockup={<OptimizerMockup />}
          flip={false}
        />

        <FeatureShowcase
          label="AUTOMATIC SYNC"
          headline="Every account. Always current. Zero imports."
          description="Plaid connects to 12,000+ banks and pulls transactions daily via cursor-based sync. New charge hits your card? It's categorized and in your dashboard before you get home."
          bullets={[
            "Checking, savings, credit cards, and investment accounts",
            "3-stage AI pipeline: rules → local Ollama → Claude Haiku",
            "Venmo and Zelle excluded from spend analytics automatically",
          ]}
          mockup={<TransactionFeedMockup />}
          flip={true}
        />

        <FeatureShowcase
          label="AI-POWERED ANSWERS"
          headline="Ask your finances anything."
          description="Claude Sonnet has your full transaction history, account balances, subscription list, and budget data in context. Plain English in, exact answers out — not summaries, not estimates."
          bullets={[
            '"How much did I spend on restaurants in Q1?"',
            '"Which subscriptions can I cut to save $100/month?"',
            '"What\'s my average grocery spend this year?"',
          ]}
          mockup={<ChatMockup />}
          flip={false}
        />

        <FeatureShowcase
          label="NET WORTH TRACKING"
          headline="One number that tells the whole story."
          description="Daily balance snapshots across checking, savings, credit cards, and investment accounts via SnapTrade. Watch the trend, not just today's number."
          mockup={<NetWorthMockup />}
          flip={true}
        />

        <FeatureShowcase
          label="ML INSIGHTS"
          headline="Catches what you'd never notice."
          description="Anomaly detection flags unusual charges before you forget them. Subscription tracking surfaces recurring charges you've stopped using. Spending insights tell you where the month actually went."
          mockup={<InsightsMockup />}
          flip={false}
        />
      </main>

      <PricingSection />
      <PrivacySection />
      <MarketingFooter />
    </div>
  );
}
