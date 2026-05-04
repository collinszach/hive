"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedBarProps {
  /** 0–100 */
  pct: number;
  /** CSS color string or gradient — defaults to blue gradient */
  color?: string;
  /** bar height in px — defaults to 5 */
  height?: number;
  /** stagger delay in ms — defaults to 0 */
  delay?: number;
  className?: string;
}

export function AnimatedBar({
  pct,
  color,
  height = 5,
  delay = 0,
  className,
}: AnimatedBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(Math.max(pct, 0), 100)), delay + 30);
    return () => clearTimeout(t);
  }, [pct, delay]);

  return (
    <div
      className={cn("rounded-full overflow-hidden bg-white/[0.05]", className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${width}%`,
          background: color ?? "linear-gradient(90deg, #3B82F6, #60A5FA)",
          transition: `width 800ms cubic-bezier(0.16, 1, 0.3, 1)`,
          transitionDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}
