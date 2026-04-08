"use client";

import { useMemo } from "react";
import { FlowData } from "@/lib/api";
import { fmt } from "@/lib/utils";

const CAT_COLORS = [
  "#7C6AFA", "#38BDF8", "#FB923C", "#F472B6",
  "#A3E635", "#34D399", "#60A5FA", "#C084FC",
  "#F97066", "#FBBF24",
];
const INCOME_COLOR = "#32D583";
const SAVINGS_COLOR = "#32D583";

// Layout constants
const W = 780;
const SRC_X = 0;
const SRC_W = 144;
const SRC_H = 76;
const DST_X = 540;
const DST_W = 240;
const MAX_H = 88;
const MIN_H = 40;
const NODE_GAP = 10;
const PORT_R = 5;

interface NodeFlowProps {
  data: FlowData;
  month?: string;
}

interface FlowItem {
  label: string;
  amount: number;
  pct: number;
  color: string;
}

export function NodeFlow({ data, month }: NodeFlowProps) {
  const items = useMemo<FlowItem[]>(() => {
    const cats: FlowItem[] = data.categories.map((c, i) => ({
      label: c.category,
      amount: c.amount,
      pct: c.pct,
      color: CAT_COLORS[i % CAT_COLORS.length],
    }));
    if (data.savings > 0) {
      cats.push({
        label: "Savings",
        amount: data.savings,
        pct: data.income > 0 ? (data.savings / data.income) * 100 : 0,
        color: SAVINGS_COLOR,
      });
    }
    return cats;
  }, [data]);

  const maxAmt = useMemo(() => Math.max(...items.map((i) => i.amount), 1), [items]);

  const heights = useMemo(
    () => items.map((item) => Math.max(MIN_H, Math.round((item.amount / maxAmt) * MAX_H))),
    [items, maxAmt],
  );

  const totalDstH = heights.reduce((s, h) => s + h + NODE_GAP, 0) - NODE_GAP;
  const svgH = Math.max(totalDstH + 48, SRC_H + 48);

  const srcY = (svgH - SRC_H) / 2;
  const srcPortY = srcY + SRC_H / 2;

  const dstStartY = (svgH - totalDstH) / 2;
  const dstYs = heights.reduce<number[]>((acc, _h, i) => {
    acc.push(i === 0 ? dstStartY : acc[i - 1] + heights[i - 1] + NODE_GAP);
    return acc;
  }, []);

  // Bezier control X positions (40%/60% of the horizontal span)
  const cx1 = SRC_W + (DST_X - SRC_W) * 0.4;
  const cx2 = SRC_W + (DST_X - SRC_W) * 0.6;

  // Wire stroke-width: 1–14px proportional to amount
  const wireW = (amount: number) =>
    Math.max(1, Math.round((amount / maxAmt) * 14));

  if (items.length === 0 || data.income === 0) return null;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${svgH}`}
        width="100%"
        className="w-full"
        style={{ minWidth: 520 }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Wires — drawn first so they appear behind nodes */}
        {items.map((item, i) => {
          const dstPortY = dstYs[i] + heights[i] / 2;
          const path = `M ${SRC_W} ${srcPortY} C ${cx1} ${srcPortY}, ${cx2} ${dstPortY}, ${DST_X} ${dstPortY}`;
          return (
            <g key={`wire-${item.label}`}>
              {/* Glow band */}
              <path d={path} stroke={item.color} strokeWidth={wireW(item.amount) + 12} fill="none" opacity={0.08} strokeLinecap="round" />
              {/* Wire */}
              <path d={path} stroke={item.color} strokeWidth={wireW(item.amount)} fill="none" opacity={0.9} strokeLinecap="round" />
            </g>
          );
        })}

        {/* Source: Income node */}
        <rect x={SRC_X} y={srcY} width={SRC_W} height={SRC_H} rx={8} fill="#111118" stroke={INCOME_COLOR} strokeWidth={1.5} />
        <rect x={SRC_X} y={srcY} width={5} height={SRC_H} rx={4} fill={INCOME_COLOR} />
        <circle cx={SRC_X + 22} cy={srcY + 22} r={12} fill={`${INCOME_COLOR}22`} />
        <text x={SRC_X + 22} y={srcY + 27} textAnchor="middle" fill={INCOME_COLOR} fontSize={13} fontWeight={700}>$</text>
        <text x={SRC_X + 40} y={srcY + 20} fill="#F5F5F7" fontSize={11} fontWeight={600}>Income</text>
        <text x={SRC_X + 40} y={srcY + 37} fill={INCOME_COLOR} fontSize={14} fontWeight={700}>{fmt(data.income)}</text>
        {month && (
          <text x={SRC_X + 10} y={srcY + SRC_H - 10} fill="#6B6B73" fontSize={9}>{month}</text>
        )}
        {/* Output port */}
        <circle cx={SRC_W} cy={srcPortY} r={PORT_R} fill={INCOME_COLOR} stroke="#0d0d0f" strokeWidth={2} />

        {/* Destination nodes */}
        {items.map((item, i) => {
          const dstY = dstYs[i];
          const dstH = heights[i];
          const portY = dstY + dstH / 2;
          const barW = DST_W - 22;
          const fillW = Math.round(Math.min(item.pct / 100, 1) * barW);
          return (
            <g key={`node-${item.label}`}>
              <rect x={DST_X} y={dstY} width={DST_W} height={dstH} rx={8} fill="#111118" stroke={item.color} strokeWidth={1.2} />
              <rect x={DST_X} y={dstY} width={5} height={dstH} rx={4} fill={item.color} />
              {/* Input port */}
              <circle cx={DST_X} cy={portY} r={PORT_R} fill={item.color} stroke="#0d0d0f" strokeWidth={2} />
              <text x={DST_X + 14} y={dstY + 18} fill="#F5F5F7" fontSize={10} fontWeight={600}>{item.label}</text>
              <text x={DST_X + 14} y={dstY + 32} fill={item.color} fontSize={12} fontWeight={700}>{fmt(item.amount)}</text>
              <text x={DST_X + DST_W - 10} y={dstY + 18} textAnchor="end" fill="#6B6B73" fontSize={9}>{item.pct.toFixed(1)}%</text>
              {dstH >= 52 && (
                <>
                  <rect x={DST_X + 14} y={dstY + dstH - 14} width={barW} height={3} rx={1.5} fill="rgba(255,255,255,0.06)" />
                  <rect x={DST_X + 14} y={dstY + dstH - 14} width={fillW} height={3} rx={1.5} fill={item.color} opacity={0.7} />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
