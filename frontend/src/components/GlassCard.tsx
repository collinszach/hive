// frontend/src/components/GlassCard.tsx
import { cn } from "@/lib/utils";

type TintColor = "none" | "income" | "expense" | "amber" | "sky" | "violet";

interface GlassCardProps {
  tint?: TintColor;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const TINT_CLASS: Record<TintColor, string> = {
  none:    "glass-card",
  income:  "glass-card-income",
  expense: "glass-card-expense",
  amber:   "glass-card-amber",
  sky:     "glass-card-sky",
  violet:  "glass-card-violet",
};

export function GlassCard({ tint = "none", className, children, onClick }: GlassCardProps) {
  return (
    <div
      className={cn(TINT_CLASS[tint], className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {children}
    </div>
  );
}
