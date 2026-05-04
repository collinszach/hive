// src/app/(marketing)/_components/mockups/TransactionFeedMockup.tsx

const TRANSACTIONS = [
  { merchant: "Whole Foods Market",   category: "Groceries",   amount: "-$94.32",  time: "2h ago",  color: "#34D399" },
  { merchant: "Amex Gold",            category: "Payment",     amount: "+$1,200",  time: "5h ago",  color: "#60A5FA" },
  { merchant: "Nobu Restaurant",      category: "Dining",      amount: "-$180.00", time: "Yesterday",color: "#F5B942" },
  { merchant: "Netflix",              category: "Streaming",   amount: "-$15.99",  time: "2 days",  color: "#A78BFA" },
  { merchant: "Lyft",                 category: "Rideshare",   amount: "-$24.10",  time: "3 days",  color: "#F5B942" },
];

export default function TransactionFeedMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-surface w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[12px] font-semibold text-ink-primary">Recent Transactions</span>
        <span className="text-[10px] text-ink-ghost">Auto-synced · 2h ago</span>
      </div>
      {/* List */}
      <div className="divide-y divide-border-subtle">
        {TRANSACTIONS.map(({ merchant, category, amount, time, color }) => (
          <div key={merchant} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Merchant initial */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ background: `${color}18`, color }}
              >
                {merchant[0]}
              </div>
              <div>
                <p className="text-[12px] font-medium text-ink-primary leading-tight">{merchant}</p>
                <p className="text-[10px] text-ink-ghost mt-0.5">{category}</p>
              </div>
            </div>
            <div className="text-right">
              <p
                className="text-[13px] font-semibold font-geist-mono"
                style={{ color: amount.startsWith("+") ? "#34D399" : "#EEEEF0" }}
              >
                {amount}
              </p>
              <p className="text-[10px] text-ink-ghost mt-0.5">{time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
