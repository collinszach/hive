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
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <HiveHex size={28} />
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
