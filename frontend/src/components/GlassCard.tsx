// frontend/src/components/GlassCard.tsx
import { cn } from "@/lib/utils";

// tint prop is kept for API compatibility but is a no-op — all cards render flat
type TintColor = "none" | "income" | "expense" | "amber" | "sky" | "violet";

interface GlassCardProps {
  tint?: TintColor;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export function GlassCard({ className, children, onClick }: GlassCardProps) {
  return (
    <div
      className={cn("glass-card", className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {children}
    </div>
  );
}
