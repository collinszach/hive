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
          <HiveHex size={22} />
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
