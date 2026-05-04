// src/app/(marketing)/_components/Nav.tsx
import Link from "next/link";
import HiveHex from "./HiveHex";

export default function Nav() {
  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5"
      style={{
        background: "rgba(13,13,20,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo — tessellated H mark */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <svg width="22" height="20" viewBox="0 0 57 50" fill="none" style={{ flexShrink: 0 }}>
          <polygon points="10,2 18,6.5 18,15.5 10,20 2,15.5 2,6.5" fill="#F5B942"/>
          <polygon points="10,18 18,22.5 18,31.5 10,36 2,31.5 2,22.5" fill="#F5B942"/>
          <polygon points="10,34 18,38.5 18,47.5 10,52 2,47.5 2,38.5" fill="#F5B942"/>
          <polygon points="28,18 36,22.5 36,31.5 28,36 20,31.5 20,22.5" fill="#F5B942"/>
          <polygon points="46,2 54,6.5 54,15.5 46,20 38,15.5 38,6.5" fill="#F5B942"/>
          <polygon points="46,18 54,22.5 54,31.5 46,36 38,31.5 38,22.5" fill="#F5B942"/>
          <polygon points="46,34 54,38.5 54,47.5 46,52 38,47.5 38,38.5" fill="#F5B942"/>
        </svg>
        <span className="text-[13px] font-bold tracking-[0.1em] text-ink-primary">HIVE</span>
      </Link>

      {/* Center links — desktop only */}
      <div className="hidden md:flex items-center gap-8">
        {(
          [
            ["#features", "Features"],
            ["#pricing", "Pricing"],
            ["https://github.com/collinszach/hive", "GitHub"],
          ] as [string, string][]
        ).map(([href, label]) => {
          const isExternal = href.startsWith("http");
          return isExternal ? (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-ink-tertiary hover:text-ink-primary transition-colors duration-150"
            >
              {label}
            </a>
          ) : (
            <a
              key={label}
              href={href}
              className="text-[13px] font-medium text-ink-tertiary hover:text-ink-primary transition-colors duration-150"
            >
              {label}
            </a>
          );
        })}
      </div>

      {/* Right CTAs */}
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="hidden sm:block px-3.5 py-1.5 text-[13px] font-medium text-ink-tertiary hover:text-ink-primary transition-colors duration-150"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="hive-btn-primary px-4 py-1.5 text-[13px] rounded-lg"
        >
          Get Early Access
        </Link>
      </div>
    </nav>
  );
}
