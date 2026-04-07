"use client";

import { useMemo } from "react";
import { FlowData } from "@/lib/api";
import { fmt } from "@/lib/utils";

const CAT_COLORS = [
  "#7C6AFA", "#38BDF8", "#FB923C", "#F472B6",
  "#A3E635", "#34D399", "#60A5FA", "#C084FC",
  "#F97066", "#FBBF24",
];

interface SankeyFlowProps {
  data: FlowData;
}

export function SankeyFlow({ data }: SankeyFlowProps) {
  const HEIGHT = 420;
  const BAR_W = 28;
  const LABEL_GAP = 8;

  const items = useMemo(() => {
    // Build right-side items: categories + savings
    const result = data.categories.map((c, i) => ({
      label: c.category,
      amount: c.amount,
      pct: c.pct,
      color: CAT_COLORS[i % CAT_COLORS.length],
    }));
    if (data.savings > 0) {
      result.push({
        label: "Savings",
        amount: data.savings,
        pct: data.income > 0 ? (data.savings / data.income) * 100 : 0,
        color: "#32D583",
      });
    }
    return result;
  }, [data]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width="100%"
        viewBox={`0 0 800 ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ minWidth: 480 }}
      >
        {/* Left income bar */}
        <rect
          x={0}
          y={0}
          width={BAR_W}
          height={HEIGHT}
          fill="#32D583"
          rx={4}
        />
        {/* Income label */}
        <text x={BAR_W + LABEL_GAP} y={20} fill="#32D583" fontSize={11} fontWeight={600}>
          Income
        </text>
        <text x={BAR_W + LABEL_GAP} y={34} fill="#6B6B73" fontSize={10}>
          {fmt(data.income)}
        </text>

        {/* Right bars and ribbons */}
        {(() => {
          let yOffset = 0;
          return items.map((item) => {
            const barH = data.income > 0 ? (item.amount / data.income) * HEIGHT : 0;
            const y = yOffset;
            yOffset += barH;

            // Bezier control points
            const x1 = BAR_W;
            const x2 = 800 - BAR_W;
            const cx1 = 800 * 0.45;
            const cx2 = 800 * 0.55;

            // Ribbon: connects left bar (full height) to right bar (sliced)
            const ribbonPath = [
              `M ${x1} ${y}`,
              `C ${cx1} ${y}, ${cx2} ${y}, ${x2} ${y}`,
              `L ${x2} ${y + barH}`,
              `C ${cx2} ${y + barH}, ${cx1} ${y + barH}, ${x1} ${y + barH}`,
              `Z`,
            ].join(" ");

            return (
              <g key={item.label}>
                {/* Ribbon */}
                <path
                  d={ribbonPath}
                  fill={item.color}
                  opacity={0.18}
                />
                {/* Right bar */}
                <rect
                  x={800 - BAR_W}
                  y={y + 1}
                  width={BAR_W}
                  height={Math.max(0, barH - 2)}
                  fill={item.color}
                  rx={3}
                />
                {/* Right label */}
                {barH > 20 && (
                  <>
                    <text
                      x={800 - BAR_W - LABEL_GAP}
                      y={y + Math.min(barH / 2, barH - 14)}
                      textAnchor="end"
                      fill="#F5F5F7"
                      fontSize={11}
                      fontWeight={500}
                    >
                      {item.label}
                    </text>
                    <text
                      x={800 - BAR_W - LABEL_GAP}
                      y={y + Math.min(barH / 2 + 13, barH)}
                      textAnchor="end"
                      fill="#6B6B73"
                      fontSize={10}
                    >
                      {fmt(item.amount)} · {item.pct.toFixed(1)}%
                    </text>
                  </>
                )}
              </g>
            );
          });
        })()}
      </svg>
    </div>
  );
}
