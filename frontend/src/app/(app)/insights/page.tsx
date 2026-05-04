"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, Insight } from "@/lib/api";
import { fmt, cn } from "@/lib/utils";
import { toast } from "@/components/Toast";
import {
  Bell, BellOff, TrendingUp, TrendingDown, AlertTriangle,
  RefreshCw, CheckCheck, X, Sparkles, Loader2, ArrowRight,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";

// ── Insight type metadata ────────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  spending_spike:          { icon: TrendingUp,    color: "text-semantic-expense", label: "Spending Spike"      },
  large_transaction:       { icon: AlertTriangle, color: "text-honey",            label: "Large Transaction"   },
  budget_alert:            { icon: TrendingDown,  color: "text-semantic-expense", label: "Budget Alert"        },
  subscription_price_change:{ icon: RefreshCw,   color: "text-sky-400",          label: "Price Change"        },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function insightHref(insight: Insight): string | null {
  const today = new Date();
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  switch (insight.insight_type) {
    case "spending_spike":
      return insight.category
        ? `/transactions?category=${encodeURIComponent(insight.category)}&month=${month}`
        : "/transactions";
    case "large_transaction":
      return insight.linked_entity_id
        ? `/transactions?search=${encodeURIComponent(insight.title.replace(/^Large transaction: /i, ""))}&search_all=true&open_tx=${insight.linked_entity_id}`
        : "/transactions";
    case "budget_alert":
      return insight.category
        ? `/budgets?category=${encodeURIComponent(insight.category)}`
        : "/budgets";
    case "subscription_price_change":
      return insight.linked_entity_id
        ? `/subscriptions?id=${insight.linked_entity_id}`
        : "/subscriptions";
    default:
      return null;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

// ── Insight card ────────────────────────────────────────────────────────────

function InsightCard({
  insight,
  onMarkRead,
  onDismiss,
}: {
  insight: Insight;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const router = useRouter();
  const meta = TYPE_META[insight.insight_type] ?? { icon: Bell, color: "text-ink-tertiary", label: "Insight" };
  const Icon = meta.icon;
  const isUnread = !insight.is_read;
  const href = insightHref(insight);

  function handleCardClick() {
    if (!href) return;
    if (!insight.is_read) onMarkRead(insight.id);
    router.push(href);
  }

  return (
    <div
      className={cn(
        insight.priority === "high" && isUnread ? "hive-card-featured" : "hive-card",
        "p-4 transition-opacity",
        insight.is_dismissed && "opacity-40",
        href && "cursor-pointer hover:bg-white/[0.02]"
      )}
      onClick={href ? handleCardClick : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          isUnread ? "bg-white/[0.06]" : "bg-white/[0.03]"
        )}>
          <Icon className={cn("w-4 h-4", meta.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <p className={cn("text-[13px] font-medium", isUnread ? "text-ink-primary" : "text-ink-secondary")}>
                {insight.title}
              </p>
              {isUnread && (
                <span className="w-1.5 h-1.5 rounded-full bg-honey shrink-0" />
              )}
              <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-md border",
                insight.priority === "high"
                  ? "text-semantic-expense bg-semantic-expense/10 border-semantic-expense/20"
                  : insight.priority === "medium"
                  ? "text-honey bg-honey/10 border-honey/20"
                  : "text-ink-ghost bg-white/[0.04] border-white/[0.06]"
              )}>
                {meta.label}
              </span>
            </div>
            <span className="text-[10px] text-ink-ghost shrink-0">{relativeTime(insight.created_at)}</span>
          </div>

          <p className="text-[12px] text-ink-tertiary leading-relaxed">{insight.body}</p>

          {insight.amount != null && (
            <p className={cn("text-[13px] font-mono font-semibold mt-1.5", meta.color)}>
              {fmt(insight.amount)}
              {insight.delta_pct != null && (
                <span className="text-[11px] text-ink-tertiary ml-1.5">
                  ({insight.delta_pct > 0 ? "+" : ""}{insight.delta_pct.toFixed(1)}%)
                </span>
              )}
            </p>
          )}

          {href && (
            <p className="text-[11px] text-honey/60 mt-1.5 flex items-center gap-1">
              View details <ArrowRight className="w-3 h-3" />
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {!insight.is_read && (
            <button
              onClick={() => onMarkRead(insight.id)}
              className="p-1.5 rounded-lg text-ink-ghost hover:text-ink-secondary hover:bg-white/[0.04] transition-colors"
              title="Mark as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDismiss(insight.id)}
            className="p-1.5 rounded-lg text-ink-ghost hover:text-semantic-expense hover:bg-semantic-expense/[0.06] transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [insights, setInsights]           = useState<Insight[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showDismissed, setShowDismissed] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [generating, setGenerating]         = useState(false);

  const load = useCallback(async (incDismissed: boolean) => {
    setLoading(true);
    try {
      const res = await api.insights.list(50, incDismissed);
      setInsights(res.insights);
    } catch {
      toast.error("Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(showDismissed); }, [showDismissed, load]);

  const handleMarkRead = useCallback(async (id: string) => {
    await api.insights.markRead(id).catch(() => {});
    setInsights(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i));
  }, []);

  const handleDismiss = useCallback(async (id: string) => {
    await api.insights.dismiss(id).catch(() => {});
    if (!showDismissed) {
      setInsights(prev => prev.filter(i => i.id !== id));
    } else {
      setInsights(prev => prev.map(i => i.id === id ? { ...i, is_dismissed: true } : i));
    }
  }, [showDismissed]);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAllRead(true);
    try {
      await api.insights.markAllRead();
      setInsights(prev => prev.map(i => ({ ...i, is_read: true })));
      toast.success("All insights marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAllRead(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await api.insights.generate();
      // Wait briefly then reload
      setTimeout(() => {
        load(showDismissed).finally(() => {
          setGenerating(false);
          toast.success("Insights generated");
        });
      }, 3000);
    } catch {
      setGenerating(false);
      toast.error("Failed to generate insights");
    }
  }, [showDismissed, load]);

  const spending = insights.filter(i => i.insight_type !== "reward_threshold");
  const unread = spending.filter(i => !i.is_read && !i.is_dismissed);
  const visible = spending.filter(i => showDismissed || !i.is_dismissed);

  // Sort: unread first (by priority), then read (by date)
  const sorted = [...visible].sort((a, b) => {
    if (a.is_read !== b.is_read) return (a.is_read ? 1 : -1);
    const pa = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 2;
    const pb = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <PageHero
            eyebrow="Insights"
            headline={
              unread.length > 0
                ? <><span className="text-honey">{unread.length}</span> unread</>
                : <><span className="text-semantic-income">All caught up</span></>
            }
            subtext="AI-generated observations about your finances"
            statStrip={[
              { label: "Unread", value: String(unread.length), color: unread.length > 0 ? "amber" : "default" },
              { label: "Total",  value: String(visible.length), color: "default" },
            ]}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="hive-btn-secondary text-[12px] px-3 py-1.5 gap-1.5"
          >
            {generating
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Sparkles className="w-3.5 h-3.5" />
            }
            {generating ? "Generating…" : "Generate"}
          </button>
          {unread.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAllRead}
              className="hive-btn-secondary text-[12px] px-3 py-1.5 gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {markingAllRead ? "Marking…" : "Mark all read"}
            </button>
          )}
          <button
            onClick={() => setShowDismissed(s => !s)}
            className={cn(
              "hive-btn-secondary text-[12px] px-3 py-1.5 gap-1.5",
              showDismissed && "text-honey border-honey/30"
            )}
          >
            {showDismissed ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            {showDismissed ? "Hide dismissed" : "Show dismissed"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="hive-card p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="hive-card py-16 text-center">
          <Bell className="w-10 h-10 text-ink-tertiary/20 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-ink-secondary">No insights yet</p>
          <p className="text-[12px] text-ink-tertiary mt-1">
            Run a sync and the AI will analyze your spending patterns.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onMarkRead={handleMarkRead}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}
