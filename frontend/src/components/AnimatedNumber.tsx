"use client";
import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}

export default function AnimatedNumber({ value, format, duration = 600, className }: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number>(0);
  const displayedRef = useRef(0);

  // Keep ref in sync so the next animation can start from current position
  displayedRef.current = displayed;

  useEffect(() => {
    const start = performance.now();
    const from = displayedRef.current;
    const to = value;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setDisplayed(from + (to - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span className={className}>{format(displayed)}</span>;
}
