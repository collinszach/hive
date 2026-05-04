// src/app/(marketing)/_components/HiveHex.tsx
// Saplyn sprout mark — replaces the old hex logo

interface HiveHexProps {
  size?: number;
}

export default function HiveHex({ size = 40 }: HiveHexProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <path d="M16 28 L16 14" stroke="#7AB88A" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 14 C 16 8, 20 5, 26 5 C 26 11, 22 14, 16 14 Z" fill="#7AB88A"/>
      <path d="M16 18 C 16 14, 13 11, 8 11 C 8 16, 11 18, 16 18 Z" fill="#7AB88A" opacity="0.55"/>
    </svg>
  );
}
