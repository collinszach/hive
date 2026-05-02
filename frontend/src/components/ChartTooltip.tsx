// frontend/src/components/ChartTooltip.tsx
import { fmt } from "@/lib/utils";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
  formatValue?: (v: number) => string;
}

export function ChartTooltip({ active, payload, label, formatValue }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const fmtV = formatValue ?? fmt;

  return (
    <div
      className="rounded-xl px-3 py-2.5 text-[12px]"
      style={{
        background:   "#161921",
        border:       "1px solid rgba(255,255,255,0.08)",
        boxShadow:    "0 8px 24px rgba(0,0,0,0.5)",
        color:        "#F0F0F4",
        minWidth:     120,
      }}
    >
      {label && <p className="text-[10px] text-ink-tertiary mb-1.5 font-medium">{label}</p>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: entry.color ?? "#F5B942" }}
            />
            <span className="text-ink-secondary">{entry.name}</span>
          </div>
          <span className="font-semibold font-mono tabular-nums">{fmtV(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Shared axis/grid props — spread these onto CartesianGrid, XAxis, YAxis */
export const CHART_GRID_PROPS = {
  stroke:          "rgba(255,255,255,0.04)",
  strokeDasharray: "none",
} as const;

export const CHART_AXIS_PROPS = {
  tick:     { fill: "#4B5063", fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const;
