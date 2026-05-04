// src/app/(marketing)/_components/HiveHex.tsx

interface HiveHexProps {
  size?: number;
}

export default function HiveHex({ size = 40 }: HiveHexProps) {
  const r = Math.round(size * 0.22);
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        background: "linear-gradient(135deg, #FFD166 0%, #F5B942 55%, #C9920E 100%)",
        boxShadow: "0 0 0 1px rgba(245,185,66,0.4), 0 4px 16px rgba(245,185,66,0.22)",
        borderRadius: r,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        style={{ width: size * 0.52, height: size * 0.52 }}
        aria-hidden
      >
        <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" fill="rgba(9,8,7,0.75)" />
        <path d="M12 6L17.2 9V15L12 18L6.8 15V9L12 6Z" fill="rgba(245,185,66,0.35)" />
        <circle cx="12" cy="12" r="2" fill="rgba(9,8,7,0.9)" />
        <circle cx="12" cy="12" r="1" fill="rgba(245,185,66,0.95)" />
      </svg>
    </div>
  );
}
