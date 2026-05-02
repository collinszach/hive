"use client";

import { useMemo } from "react";
import { fmt } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DayData {
  date: string;   // YYYY-MM-DD
  total: number;
  count: number;
}

interface SpendingCalendarProps {
  month: string;       // YYYY-MM
  data: DayData[];
  onDayClick?: (date: string) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function intensity(total: number, max: number): number {
  if (max === 0 || total === 0) return 0;
  // log scale so small amounts still show
  return Math.min(1, Math.log1p(total) / Math.log1p(max));
}

function heatColor(t: number): string {
  // 0 = transparent, 1 = bright honey
  const alpha = 0.08 + t * 0.75;
  // shift hue from cool blue-grey (low) to warm honey (high)
  if (t < 0.33) {
    return `rgba(100,140,200,${(alpha * 0.6).toFixed(2)})`;
  } else if (t < 0.66) {
    return `rgba(201,146,14,${(alpha * 0.75).toFixed(2)})`;
  } else {
    return `rgba(239,110,60,${alpha.toFixed(2)})`;
  }
}

export function SpendingCalendar({ month, data, onDayClick }: SpendingCalendarProps) {
  const [year, mo] = month.split("-").map(Number);

  const dayMap = useMemo(() => {
    const m = new Map<string, DayData>();
    for (const d of data) m.set(d.date, d);
    return m;
  }, [data]);

  const maxSpend = useMemo(() => Math.max(...data.map((d) => d.total), 0.01), [data]);

  // First day of month (0=Sun)
  const firstWeekday = new Date(year, mo - 1, 1).getDay();
  // Days in month
  const daysInMonth = new Date(year, mo, 0).getDate();

  // Build calendar grid cells
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === mo;
  const todayDay = today.getDate();

  const totalSpend = data.reduce((s, d) => s + d.total, 0);

  return (
    <div className="w-full">
      {/* Summary */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-ink-tertiary">
          {data.length} days with spending · {fmt(totalSpend)} total
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-ink-ghost">
          <span>Low</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.55, 0.75, 1.0].map((t, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-sm"
                style={{ background: heatColor(t) }}
              />
            ))}
          </div>
          <span>High</span>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[9px] font-medium text-ink-ghost py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }
          const dateStr = `${year}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayData = dayMap.get(dateStr);
          const t = dayData ? intensity(dayData.total, maxSpend) : 0;
          const isToday = isCurrentMonth && day === todayDay;
          const isFuture = isCurrentMonth && day > todayDay;

          return (
            <button
              key={dateStr}
              title={dayData ? `${dateStr}: ${fmt(dayData.total)} (${dayData.count} txns)` : dateStr}
              onClick={() => dayData && onDayClick?.(dateStr)}
              disabled={!dayData}
              className={cn(
                "aspect-square rounded flex flex-col items-center justify-center transition-all",
                dayData ? "cursor-pointer hover:ring-1 hover:ring-honey/30" : "cursor-default",
                isToday && "ring-1 ring-honey/50"
              )}
              style={{
                background: dayData ? heatColor(t) : isFuture ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.03)",
              }}
            >
              <span className={cn(
                "text-[10px] font-medium leading-none",
                isToday ? "text-honey" : dayData ? "text-ink-secondary" : "text-ink-ghost/30"
              )}>
                {day}
              </span>
              {dayData && (
                <span className="text-[8px] text-ink-tertiary/70 leading-none mt-0.5 font-mono">
                  {fmt(dayData.total).replace("$", "")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
