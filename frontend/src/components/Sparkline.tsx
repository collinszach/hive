"use client";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

export function Sparkline({
  data,
  width = 64,
  height = 24,
  color = "#4A7A5A",
  fill = true,
}: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 0.01);
  const min = 0;
  const range = max - min || 1;

  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const xStep = innerW / (data.length - 1);
  const points = data.map((v, i) => ({
    x: pad + i * xStep,
    y: pad + innerH - ((v - min) / range) * innerH,
  }));

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const lastPoint = points[points.length - 1];

  // Build fill path: line + down to bottom right + across to bottom left
  const fillPath =
    `M ${points[0].x.toFixed(1)} ${(pad + innerH).toFixed(1)} ` +
    points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
    ` L ${lastPoint.x.toFixed(1)} ${(pad + innerH).toFixed(1)} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: "visible" }}
    >
      {fill && (
        <path
          d={fillPath}
          fill={color}
          fillOpacity={0.08}
        />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.7}
      />
      {/* Last point dot */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r={2}
        fill={color}
        opacity={0.9}
      />
    </svg>
  );
}
