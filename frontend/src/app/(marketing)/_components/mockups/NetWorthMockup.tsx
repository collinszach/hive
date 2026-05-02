// src/app/(marketing)/_components/mockups/NetWorthMockup.tsx

// Simple SVG sparkline — no library dependency
const DATA = [112, 118, 115, 124, 130, 138, 142]; // thousands
const LABELS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];

export default function NetWorthMockup() {
  const W = 280;
  const H = 100;
  const pad = { t: 12, r: 12, b: 28, l: 40 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;
  const min = Math.min(...DATA) - 5;
  const max = Math.max(...DATA) + 5;

  const x = (i: number) => pad.l + (i / (DATA.length - 1)) * iW;
  const y = (v: number) => pad.t + iH - ((v - min) / (max - min)) * iH;

  const linePath = DATA.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const areaPath = `${linePath} L${x(DATA.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;

  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-surface w-full max-w-sm">
      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] uppercase tracking-wider text-ink-ghost mb-1">Net Worth</p>
        <p className="text-[24px] font-bold font-geist-mono text-semantic-income">$142,100</p>
        <p className="text-[11px] text-semantic-income mt-0.5">↑ $30,100 (+26.9%) past 6 months</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <defs>
          <linearGradient id="nw-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={areaPath} fill="url(#nw-grad)" />
        {/* Line */}
        <path d={linePath} fill="none" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Last point dot */}
        <circle cx={x(DATA.length - 1)} cy={y(DATA[DATA.length - 1])} r="3" fill="#34D399" />
        {/* X-axis labels */}
        {LABELS.map((label, i) => (
          <text key={label} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#3D4257">
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
