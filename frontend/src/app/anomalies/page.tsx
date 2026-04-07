"use client";

import { useEffect, useState } from "react";
import { api, type Anomaly } from "@/lib/api";
import { AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { GlassCard } from "@/components/GlassCard";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(Math.abs(score) * 100);
  const isHigh = pct > 70;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
      isHigh
        ? "text-semantic-expense bg-semantic-expense/10 border-semantic-expense/30"
        : "text-honey bg-honey/10 border-honey/30"
    }`}>
      {pct}% anomalous
    </span>
  );
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewedToday, setReviewedToday] = useState(0);

  useEffect(() => {
    api.anomalies
      .list("unreviewed")
      .then(setAnomalies)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleReview(id: string, status: "ok" | "confirmed") {
    setReviewing(id);
    try {
      await api.anomalies.review(id, status);
      setAnomalies((prev) => prev.filter((a) => a.id !== id));
      setReviewedToday((prev) => prev + 1);
    } catch (e) {
      alert(`Review failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setReviewing(null);
    }
  }

  const flaggedCount = anomalies.length;

  return (
    <div className="space-y-6">
      {/* PageHero */}
      <PageHero
        eyebrow="Anomalies"
        headline={
          <>
            <span className="text-semantic-expense">{flaggedCount}</span> transactions to review
          </>
        }
        subtext="ML-flagged unusual transactions"
        glowColor="coral"
        statStrip={[
          { label: "Flagged", value: String(flaggedCount), color: "red" },
          { label: "Reviewed Today", value: String(reviewedToday), color: "green" },
          { label: "Total Reviewed", value: String(reviewedToday), color: "default" },
        ]}
      />

      {loading && (
        <div className="text-center text-ink-tertiary py-16 text-sm animate-pulse">Loading anomalies…</div>
      )}

      {error && (
        <GlassCard tint="expense" className="p-4 text-semantic-expense text-sm">{error}</GlassCard>
      )}

      {!loading && !error && anomalies.length === 0 && (
        <GlassCard className="py-16 text-center">
          <CheckCircle className="w-10 h-10 text-semantic-income/40 mx-auto mb-3" />
          <p className="text-ink-secondary font-medium">All clear</p>
          <p className="text-ink-tertiary text-sm mt-1">No unreviewed anomalies at this time.</p>
        </GlassCard>
      )}

      <div className="space-y-3">
        {anomalies.map((anomaly) => {
          const tx = anomaly.transaction;
          const pct = Math.round(Math.abs(anomaly.anomaly_score) * 100);
          const isHigh = pct > 70;
          return (
            <GlassCard
              key={anomaly.id}
              tint={isHigh ? "expense" : "none"}
              className="p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {tx && (
                    <div className="flex items-center gap-3 mb-1.5">
                      <ShieldAlert className="w-4 h-4 text-honey shrink-0" />
                      <span className="font-semibold text-ink-primary truncate">
                        {tx.merchant || tx.raw_description}
                      </span>
                      <span className="text-lg font-bold text-ink-primary shrink-0 tabular-nums">
                        {fmt(tx.amount)}
                      </span>
                    </div>
                  )}
                  {tx && (
                    <div className="flex items-center gap-2 text-xs text-ink-tertiary mb-3 ml-7">
                      <span>{fmtDate(tx.date)}</span>
                      {tx.category && (
                        <>
                          <span>·</span>
                          <span>{tx.category}{tx.subcategory ? ` / ${tx.subcategory}` : ""}</span>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 flex-wrap ml-7">
                    <ScoreBadge score={anomaly.anomaly_score} />
                    <span className="text-sm text-ink-secondary">{anomaly.reason}</span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleReview(anomaly.id, "ok")}
                    disabled={reviewing === anomaly.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/[0.05] border border-white/[0.08] text-ink-secondary hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Looks OK
                  </button>
                  <button
                    onClick={() => handleReview(anomaly.id, "confirmed")}
                    disabled={reviewing === anomaly.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-semantic-expense/10 border border-semantic-expense/30 text-semantic-expense hover:bg-semantic-expense/20 disabled:opacity-50 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Flag It
                  </button>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
