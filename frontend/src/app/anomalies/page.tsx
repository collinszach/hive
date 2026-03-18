"use client";

import { useEffect, useState } from "react";
import { api, type Anomaly } from "@/lib/api";
import { AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";

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
        ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
        : "text-amber-400 bg-amber-500/10 border-amber-500/30"
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Anomaly Review</h1>
          <p className="text-sm text-slate-500 mt-0.5">ML-flagged transactions that look unusual</p>
        </div>
        {!loading && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-slate-300">
              {anomalies.length} unreviewed
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center text-slate-500 py-16 text-sm animate-pulse">Loading anomalies…</div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-rose-300 text-sm">{error}</div>
      )}

      {!loading && !error && anomalies.length === 0 && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 py-16 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-500/40 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">All clear</p>
          <p className="text-slate-600 text-sm mt-1">No unreviewed anomalies at this time.</p>
        </div>
      )}

      <div className="space-y-3">
        {anomalies.map((anomaly) => {
          const tx = anomaly.transaction;
          return (
            <div
              key={anomaly.id}
              className="rounded-xl bg-slate-900 border border-slate-800 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {tx && (
                    <div className="flex items-center gap-3 mb-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-semibold text-white truncate">
                        {tx.merchant || tx.raw_description}
                      </span>
                      <span className="text-lg font-bold text-white shrink-0 tabular-nums">
                        {fmt(tx.amount)}
                      </span>
                    </div>
                  )}
                  {tx && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 ml-7">
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
                    <span className="text-sm text-slate-400">{anomaly.reason}</span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleReview(anomaly.id, "ok")}
                    disabled={reviewing === anomaly.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Looks OK
                  </button>
                  <button
                    onClick={() => handleReview(anomaly.id, "confirmed")}
                    disabled={reviewing === anomaly.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
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
