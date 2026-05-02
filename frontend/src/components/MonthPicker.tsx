"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  month: string;           // YYYY-MM
  onChange: (month: string) => void;
  maxMonth?: string;       // YYYY-MM — disable forward nav beyond this
  className?: string;
}

function formatLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function shift(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthPicker({ month, onChange, maxMonth, className }: MonthPickerProps) {
  const atMax = maxMonth ? month >= maxMonth : false;

  const btnCls =
    "p-1.5 rounded-lg hover:bg-white/[0.05] text-ink-ghost hover:text-ink-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        onClick={() => onChange(shift(month, -1))}
        className={btnCls}
        aria-label="Previous month"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-[13px] font-medium text-ink-primary w-32 text-center select-none">
        {formatLabel(month)}
      </span>
      <button
        onClick={() => onChange(shift(month, 1))}
        disabled={atMax}
        className={btnCls}
        aria-label="Next month"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
