// frontend/src/components/FilterPills.tsx
import { cn } from "@/lib/utils";

interface FilterPillsProps {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function FilterPills({ options, value, onChange, className }: FilterPillsProps) {
  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150",
              active
                ? "bg-honey/[0.12] border border-honey/25 text-honey"
                : "bg-elevated border border-white/[0.06] text-ink-secondary hover:text-ink-primary hover:border-white/[0.10]"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
