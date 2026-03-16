"use client";

import { useEffect, useState } from "react";
import { api, type Anomaly } from "@/lib/api";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(Math.abs(score) * 100);
  const color = pct > 70 ? "text-red-400 bg-red-900/30 border-red-800" : "text-yellow-400 bg-yellow-900/30 border-yellow-800";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {pct}% anomalous
    </span>
  );
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

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
    } catch (e) {
      alert(`Review failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setReviewing(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Anomaly Review</h1>
          <p className="text-sm text-gray-400 mt-1">ML-flagged transactions that look unusual</p>
        </div>
        {!loading && (
          <span className="text-sm text-gray-400">
            {anomalies.length} unreviewed
          </span>
        )}
      </div>

      {loading && (
        <div className="text-center text-gray-500 py-16">Loading anomalies…</div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300">{error}</div>
      )}

      {!loading && !error && anomalies.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-gray-400">No unreviewed anomalies — you&apos;re all clear.</p>
        </div>
      )}

      <div className="space-y-4">
        {anomalies.map((anomaly) => {
          const tx = anomaly.transaction;
          return (
            <div
              key={anomaly.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {tx && (
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-white truncate">
                        {tx.merchant || tx.raw_description}
                      </span>
                      <span className="text-xl font-bold text-white shrink-0">
                        {fmt(tx.amount)}
                      </span>
                    </div>
                  )}
                  {tx && (
                    <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
                      <span>{fmtDate(tx.date)}</span>
                      {tx.category && (
                        <>
                          <span>·</span>
                          <span>{tx.category}{tx.subcategory ? ` / ${tx.subcategory}` : ""}</span>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <ScoreBadge score={anomaly.anomaly_score} />
                    <span className="text-sm text-gray-300">{anomaly.reason}</span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleReview(anomaly.id, "ok")}
                    disabled={reviewing === anomaly.id}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300
                               hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    Looks OK
                  </button>
                  <button
                    onClick={() => handleReview(anomaly.id, "confirmed")}
                    disabled={reviewing === anomaly.id}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-900/40 text-red-300
                               border border-red-800 hover:bg-red-900/60 disabled:opacity-50 transition-colors"
                  >
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
