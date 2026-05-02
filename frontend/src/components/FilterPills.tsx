// frontend/src/components/FilterPills.tsx
import { cn } from "@/lib/utils";

interface FilterPillsProps {
  options: Array<{ label: string; value: string }>;
  /** Single-select: string. Multi-select: string[]. */
  value: string | string[];
  onChange: (v: string | string[]) => void;
  /** When true, multiple pills can be active at once. */
  multi?: boolean;
  className?: string;
}

export function FilterPills({ options, value, onChange, multi = false, className }: FilterPillsProps) {
  const selected = multi
    ? (value as string[])
    : value === ""
    ? []
    : [value as string];

  function handleClick(optValue: string) {
    if (!multi) {
      // Single-select: toggle to "" when clicking active
      onChange(selected.includes(optValue) ? "" : optValue);
      return;
    }
    // Multi-select: toggle membership
    if (selected.includes(optValue)) {
      onChange(selected.filter((v) => v !== optValue));
    } else {
      onChange([...selected, optValue]);
    }
  }

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none", className)}>
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => handleClick(opt.value)}
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
