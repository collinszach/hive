"use client";

import { cn } from "@/lib/utils";

const OPTIONS: { label: string; days: number }[] = [
  { label: "30d",  days: 30  },
  { label: "90d",  days: 90  },
  { label: "180d", days: 180 },
  { label: "1y",   days: 365 },
];

interface TimeWindowPickerProps {
  value: number;
  onChange: (days: number) => void;
}

export function TimeWindowPicker({ value, onChange }: TimeWindowPickerProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
      {OPTIONS.map((opt) => (
        <button
          key={opt.days}
          type="button"
          onClick={() => onChange(opt.days)}
          className={cn(
            "px-3 py-1 rounded-md text-[12px] font-medium transition-all duration-150",
            value === opt.days
              ? "bg-honey/20 text-honey"
              : "text-ink-tertiary hover:text-ink-secondary"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
