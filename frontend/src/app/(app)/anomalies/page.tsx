"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Anomaly } from "@/lib/api";
import { AlertTriangle, CheckCircle, ShieldAlert, ExternalLink } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { toast } from "@/components/Toast";

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
  const router = useRouter();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewedToday, setReviewedToday] = useState(0);
  const [totalReviewed, setTotalReviewed] = useState(0);

  useEffect(() => {
    Promise.allSettled([
      api.anomalies.list("unreviewed"),
      api.anomalies.list("ok"),
    ]).then(([unreviewedRes, reviewedRes]) => {
      if (unreviewedRes.status === "fulfilled") setAnomalies(unreviewedRes.value);
      else setError("Failed to load anomalies");
      if (reviewedRes.status === "fulfilled") setTotalReviewed(reviewedRes.value.length);
    }).finally(() => setLoading(false));
  }, []);

  async function handleReview(id: string, status: "ok" | "confirmed") {
    setReviewing(id);
    try {
      await api.anomalies.review(id, status);
      setAnomalies((prev) => prev.filter((a) => a.id !== id));
      setReviewedToday((prev) => prev + 1);
      setTotalReviewed((prev) => prev + 1);
    } catch (e) {
      toast.error(`Review failed: ${e instanceof Error ? e.message : "Unknown error"}`);
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
        glow="red"
        statStrip={[
          { label: "Flagged", value: String(flaggedCount), color: "red" },
          { label: "Reviewed Today", value: String(reviewedToday), color: "green" },
          { label: "Total Reviewed", value: String(totalReviewed), color: "default" },
        ]}
      />

      {loading && (
        <div className="text-center text-ink-tertiary py-16 text-sm animate-pulse">Loading anomalies…</div>
      )}

      {error && (
        <div className="hive-card p-4 text-semantic-expense text-sm">{error}</div>
      )}

      {!loading && !error && anomalies.length === 0 && (
        <div className="hive-card py-16 text-center">
          <CheckCircle className="w-10 h-10 text-semantic-income/40 mx-auto mb-3" />
          <p className="text-ink-secondary font-medium">All clear</p>
          <p className="text-ink-tertiary text-sm mt-1">No unreviewed anomalies at this time.</p>
        </div>
      )}

      <div className="space-y-3">
        {anomalies.map((anomaly) => {
          const tx = anomaly.transaction;
          const pct = Math.round(Math.abs(anomaly.anomaly_score) * 100);
          const isHigh = pct > 70;
          return (
            <div
              key={anomaly.id}
              className={isHigh ? "hive-card-featured p-5" : "hive-card p-5"}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {tx && (
                    <div className="flex items-center gap-3 mb-1.5">
                      <ShieldAlert className="w-4 h-4 text-honey shrink-0" />
                      <span className="font-semibold text-ink-primary truncate">
                        {tx.merchant || tx.raw_description}
                      </span>
                      <span className="text-lg font-bold font-mono text-ink-primary shrink-0 tabular-nums">
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
                      <button
                        onClick={() => router.push(`/transactions?search=${encodeURIComponent(tx.merchant || tx.raw_description)}&search_all=true&open_tx=${tx.id}`)}
                        className="flex items-center gap-0.5 text-honey/60 hover:text-honey transition-colors ml-1"
                        title="View in transactions"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View</span>
                      </button>
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
                    className="hive-btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Looks OK
                  </button>
                  <button
                    onClick={() => handleReview(anomaly.id, "confirmed")}
                    disabled={reviewing === anomaly.id}
                    className="hive-btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm text-semantic-expense disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Flag It
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
