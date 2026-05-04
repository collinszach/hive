// src/app/(marketing)/_components/mockups/OptimizerMockup.tsx
import { Star } from "lucide-react";

const RESULTS = [
  { rank: 1, card: "Amex Gold",               earn: "4× MR",    value: "$6.80", best: true  },
  { rank: 2, card: "Chase Sapphire Preferred", earn: "3× UR",    value: "$5.21", best: false },
  { rank: 3, card: "Bilt Blue",               earn: "3× Bilt",  value: "$5.36", best: false },
  { rank: 4, card: "Capital One Venture X",    earn: "2× Miles", value: "$3.15", best: false },
];

export default function OptimizerMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-surface w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Star className="w-3.5 h-3.5 text-honey" />
        <span className="text-[12px] font-semibold text-ink-primary">Card Optimizer</span>
        <span className="ml-auto text-[10px] text-ink-ghost">Restaurant · $85</span>
      </div>
      {/* Results */}
      <div className="p-3 space-y-2">
        {RESULTS.map(({ rank, card, earn, value, best }) => (
          <div
            key={card}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl"
            style={{
              background: best ? "rgba(245,185,66,0.07)" : "rgba(255,255,255,0.025)",
              border: `1px solid ${best ? "rgba(245,185,66,0.2)" : "transparent"}`,
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] font-mono w-4 text-center"
                style={{ color: best ? "#F5B942" : "#3D4257" }}
              >
                {rank}
              </span>
              <p className="text-[12px] font-medium" style={{ color: best ? "#EEEEF0" : "#5A6475" }}>
                {card}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono" style={{ color: best ? "#F5B942" : "#3D4257" }}>
                {earn}
              </span>
              <span
                className="text-[13px] font-bold font-geist-mono"
                style={{ color: best ? "#34D399" : "#3D4257" }}
              >
                {value}
              </span>
              {best && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(245,185,66,0.15)", color: "#F5B942" }}
                >
                  BEST
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
