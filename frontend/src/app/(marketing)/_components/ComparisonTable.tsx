// src/app/(marketing)/_components/ComparisonTable.tsx
import { Check, Minus } from "lucide-react";

const ROWS = [
  { feature: "Rewards optimizer",    hive: true,  monarch: false, ynab: false, copilot: false },
  { feature: "Open source",         hive: true,  monarch: false, ynab: false, copilot: false },
  { feature: "Self-hostable",       hive: true,  monarch: false, ynab: false, copilot: false },
  { feature: "AI chat (real LLM)",  hive: true,  monarch: false, ynab: false, copilot: false },
  { feature: "Investment tracking", hive: true,  monarch: true,  ynab: false, copilot: true  },
  { feature: "Price",
    hive: "$0–$13/mo", monarch: "$99/yr", ynab: "$109/yr", copilot: "$89/yr",
  },
];

function Cell({ val, isHive }: { val: boolean | string; isHive?: boolean }) {
  if (typeof val === "string") {
    return (
      <span
        className="text-[13px] font-semibold font-geist-mono"
        style={{ color: isHive ? "#F5B942" : "#5A6475" }}
      >
        {val}
      </span>
    );
  }
  if (val) {
    return <Check className="w-4 h-4 mx-auto" style={{ color: isHive ? "#F5B942" : "#34D399" }} strokeWidth={2.5} />;
  }
  return <Minus className="w-4 h-4 mx-auto text-ink-ghost opacity-30" strokeWidth={1.5} />;
}

export default function ComparisonTable() {
  return (
    <section className="px-6 py-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-honey mb-3">
            WHY HIVE
          </p>
          <h2 className="text-[36px] sm:text-[44px] font-bold tracking-[-0.02em] leading-tight text-ink-primary">
            Everything Mint promised.
            <br />
            <span className="text-ink-secondary">None of the Intuit.</span>
          </h2>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden border border-border">
          {/* Column headers */}
          <div className="grid grid-cols-5 border-b border-border">
            <div className="p-4 col-span-1" />
            {[
              { label: "Saplyn", highlight: true },
              { label: "Monarch", highlight: false },
              { label: "YNAB", highlight: false },
              { label: "Copilot", highlight: false },
            ].map(({ label, highlight }) => (
              <div
                key={label}
                className="p-4 text-center"
                style={{
                  background: highlight ? "rgba(245,185,66,0.06)" : "transparent",
                  borderLeft: highlight ? "1px solid rgba(245,185,66,0.18)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  className="text-[13px] font-bold"
                  style={{ color: highlight ? "#F5B942" : "#5A6475" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {ROWS.map((row, i) => (
            <div
              key={row.feature}
              className="grid grid-cols-5 border-b border-border last:border-0"
              style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}
            >
              <div className="p-4 text-[13px] text-ink-secondary flex items-center">
                {row.feature}
              </div>
              {(["hive", "monarch", "ynab", "copilot"] as const).map((co) => (
                <div
                  key={co}
                  className="p-4 flex items-center justify-center"
                  style={{
                    background: co === "hive" ? "rgba(245,185,66,0.04)" : "transparent",
                    borderLeft:
                      co === "hive"
                        ? "1px solid rgba(245,185,66,0.18)"
                        : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Cell val={row[co] as boolean | string} isHive={co === "hive"} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
