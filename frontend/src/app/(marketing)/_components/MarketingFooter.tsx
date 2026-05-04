// src/app/(marketing)/_components/MarketingFooter.tsx
import Link from "next/link";
import HiveHex from "./HiveHex";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#pricing",  label: "Pricing"  },
  { href: "/privacy",  label: "Privacy"  },
  { href: "/login",    label: "Sign in"  },
];

export default function MarketingFooter() {
  return (
    <footer className="px-6 py-8 border-t border-border">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <svg width="22" height="20" viewBox="0 0 57 50" fill="none"><polygon points="10,2 18,6.5 18,15.5 10,20 2,15.5 2,6.5" fill="#F5B942"/><polygon points="10,18 18,22.5 18,31.5 10,36 2,31.5 2,22.5" fill="#F5B942"/><polygon points="10,34 18,38.5 18,47.5 10,52 2,47.5 2,38.5" fill="#F5B942"/><polygon points="28,18 36,22.5 36,31.5 28,36 20,31.5 20,22.5" fill="#F5B942"/><polygon points="46,2 54,6.5 54,15.5 46,20 38,15.5 38,6.5" fill="#F5B942"/><polygon points="46,18 54,22.5 54,31.5 46,36 38,31.5 38,22.5" fill="#F5B942"/><polygon points="46,34 54,38.5 54,47.5 46,52 38,47.5 38,38.5" fill="#F5B942"/></svg>
          <span className="text-[11px] font-bold tracking-widest text-ink-ghost">HIVE</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          {NAV_LINKS.map(({ href, label }) => {
            const isHash = href.startsWith("#");
            return isHash ? (
              <a
                key={label}
                href={href}
                className="text-[12px] text-ink-ghost hover:text-ink-secondary transition-colors duration-150"
              >
                {label}
              </a>
            ) : (
              <Link
                key={label}
                href={href}
                className="text-[12px] text-ink-ghost hover:text-ink-secondary transition-colors duration-150"
              >
                {label}
              </Link>
            );
          })}
          <a
            href="https://github.com/collinszach/hive"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-ink-ghost hover:text-ink-secondary transition-colors duration-150"
          >
            GitHub
          </a>
        </div>

        {/* Tagline */}
        <p className="text-[11px] text-ink-ghost opacity-50">
          Managed service · Open source · No VC
        </p>
      </div>
    </footer>
  );
}
