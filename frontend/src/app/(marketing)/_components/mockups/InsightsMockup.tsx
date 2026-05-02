// src/app/(marketing)/_components/mockups/InsightsMockup.tsx
import { AlertTriangle, RefreshCw, TrendingDown } from "lucide-react";

const INSIGHTS = [
  {
    icon: AlertTriangle,
    color: "#FBBF24",
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.18)",
    title: "Unusual charge detected",
    desc: "Adobe Creative Cloud charged $239 — 4× your usual amount.",
  },
  {
    icon: RefreshCw,
    color: "#60A5FA",
    bg: "rgba(96,165,250,0.07)",
    border: "rgba(96,165,250,0.15)",
    title: "Forgotten subscription",
    desc: "Calm app · $14.99/mo · Last used 94 days ago.",
  },
  {
    icon: TrendingDown,
    color: "#34D399",
    bg: "rgba(52,211,153,0.07)",
    border: "rgba(52,211,153,0.15)",
    title: "Dining spend down 18%",
    desc: "You spent $247 less on restaurants vs last month.",
  },
];

export default function InsightsMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-surface w-full max-w-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[12px] font-semibold text-ink-primary">ML Insights</span>
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-honey-faint text-honey border border-border-honey">
          3 new
        </span>
      </div>
      <div className="p-3 space-y-2">
        {INSIGHTS.map(({ icon: Icon, color, bg, border, title, desc }) => (
          <div
            key={title}
            className="flex gap-3 p-3 rounded-xl"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} strokeWidth={1.8} />
            <div>
              <p className="text-[12px] font-semibold text-ink-primary leading-tight">{title}</p>
              <p className="text-[11px] text-ink-tertiary mt-0.5 leading-snug">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
