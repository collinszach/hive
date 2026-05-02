"use client";

import { useMemo } from "react";
import { FlowData } from "@/lib/api";
import { fmt } from "@/lib/utils";

// Muted, coordinated palette — no rainbow, no neon
const CAT_COLORS = [
  "#7B8EC8", // periwinkle
  "#6BAE8C", // sage
  "#C5788A", // rose
  "#B8963E", // gold
  "#8B7CF6", // violet
  "#5BA5C8", // sky
  "#E07A3A", // sienna
  "#9B6BB8", // plum
  "#7A9B7A", // forest
  "#C87070", // clay
];
const INCOME_COLOR  = "#3DB87A";
const SAVINGS_COLOR = "#3DB87A";

// Layout
const W       = 720;
const SRC_X   = 0;
const SRC_W   = 130;
const SRC_H   = 68;
const DST_X   = 490;
const DST_W   = 230;
const MAX_H   = 76;
const MIN_H   = 34;
const NODE_GAP = 8;

interface NodeFlowProps {
  data: FlowData;
  month?: string;
  onCategoryClick?: (category: string) => void;
}

interface FlowItem {
  label: string;
  amount: number;
  pct: number;
  color: string;
}

export function NodeFlow({ data, month, onCategoryClick }: NodeFlowProps) {
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
  const svgH      = Math.max(totalDstH + 40, SRC_H + 40);
  const srcY      = (svgH - SRC_H) / 2;
  const srcPortY  = srcY + SRC_H / 2;
  const dstStartY = (svgH - totalDstH) / 2;

  const dstYs = heights.reduce<number[]>((acc, _h, i) => {
    acc.push(i === 0 ? dstStartY : acc[i - 1] + heights[i - 1] + NODE_GAP);
    return acc;
  }, []);

  // Smooth S-curve control points
  const cx1 = SRC_W + (DST_X - SRC_W) * 0.45;
  const cx2 = SRC_W + (DST_X - SRC_W) * 0.55;

  // Wire width: 0.8–5px — thin and precise, not chunky
  const wireW = (amount: number) =>
    Math.max(0.8, Math.round((amount / maxAmt) * 5 * 10) / 10);

  if (items.length === 0 || data.income === 0) return null;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${svgH}`}
        width="100%"
        className="w-full"
        style={{ minWidth: 480 }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Wires — behind nodes */}
        {items.map((item, i) => {
          const dstPortY = dstYs[i] + heights[i] / 2;
          const path = `M ${SRC_W} ${srcPortY} C ${cx1} ${srcPortY}, ${cx2} ${dstPortY}, ${DST_X} ${dstPortY}`;
          const w = wireW(item.amount);
          return (
            <g key={`wire-${item.label}`}>
              {/* Subtle ambient glow — very faint, small */}
              <path d={path} stroke={item.color} strokeWidth={w + 4} fill="none" opacity={0.06} strokeLinecap="round" />
              {/* Main wire */}
              <path d={path} stroke={item.color} strokeWidth={w} fill="none" opacity={0.75} strokeLinecap="round" />
            </g>
          );
        })}

        {/* ── Income node ── */}
        <rect x={SRC_X} y={srcY} width={SRC_W} height={SRC_H} rx={6}
          fill="#13141A" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        {/* Left accent bar */}
        <rect x={SRC_X} y={srcY + 8} width={3} height={SRC_H - 16} rx={1.5} fill={INCOME_COLOR} opacity={0.9} />
        <text x={SRC_X + 14} y={srcY + 22} fill="rgba(255,255,255,0.45)" fontSize={9} fontWeight={500} letterSpacing="0.06em">
          INCOME
        </text>
        <text x={SRC_X + 14} y={srcY + 40} fill="#ECEEF5" fontSize={15} fontWeight={700} fontFamily="monospace">
          {fmt(data.income)}
        </text>
        {month && (
          <text x={SRC_X + 14} y={srcY + SRC_H - 10} fill="rgba(255,255,255,0.28)" fontSize={9}>
            {month}
          </text>
        )}
        {/* Output port — small dot */}
        <circle cx={SRC_W} cy={srcPortY} r={3} fill={INCOME_COLOR} opacity={0.8} />

        {/* ── Destination nodes ── */}
        {items.map((item, i) => {
          const dstY = dstYs[i];
          const dstH = heights[i];
          const portY = dstY + dstH / 2;
          return (
            <g
              key={`node-${item.label}`}
              style={{ cursor: onCategoryClick ? "pointer" : "default" }}
              onClick={() => onCategoryClick?.(item.label)}
            >
              <rect x={DST_X} y={dstY} width={DST_W} height={dstH} rx={5}
                fill="#13141A" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
              {/* Left accent */}
              <rect x={DST_X} y={dstY + 6} width={3} height={dstH - 12} rx={1.5} fill={item.color} opacity={0.85} />
              {/* Input port */}
              <circle cx={DST_X} cy={portY} r={2.5} fill={item.color} opacity={0.7} />
              {/* Label */}
              <text x={DST_X + 12} y={dstY + 16} fill="rgba(255,255,255,0.7)" fontSize={9.5} fontWeight={600}>
                {item.label}
              </text>
              {/* Amount */}
              <text x={DST_X + 12} y={dstY + 29} fill={item.color} fontSize={11} fontWeight={700} fontFamily="monospace">
                {fmt(item.amount)}
              </text>
              {/* Pct — right aligned */}
              <text x={DST_X + DST_W - 10} y={dstY + 16} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9}>
                {item.pct.toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
