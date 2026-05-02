# Hive App UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 25 app pages to a premium Origin/Monarch-grade UI using MBB consultant design direction — 220px expanded sidebar, Inter font, blue primary interactive, cool-dark layered backgrounds, gold reserved for rewards only.

**Architecture:** Design system tokens updated in tailwind.config.ts, globals.css rewritten with new card/button classes, Sidebar fully rewritten to 220px with section groups, then all 25 pages updated to use the new classes.

**Tech Stack:** Next.js 15, Tailwind CSS 3, Inter + Geist_Mono via next/font/google, Recharts, TypeScript strict

---

## Design Tokens Reference (use throughout all tasks)

```
Tailwind colors (updated):
  bg-base       → #13151A
  bg-surface    → #1A1D24
  bg-elevated   → #1F2229
  bg-overlay    → #252830
  text-blue     → #3B82F6
  text-ink-primary   → #F0F2F5
  text-ink-secondary → #9CA3AF
  text-ink-tertiary  → #6B7280
  text-ink-ghost     → #4B5563
  text-semantic-income  → #22C55E
  text-semantic-expense → #EF4444
  text-semantic-warning → #F59E0B
  text-semantic-info    → #3B82F6
  border-border     → #2A2D35
  border-border-strong  → #3A3E4A
  border-border-subtle  → #22252E

CSS component classes:
  .hive-card          → elevated bg + border, hover state
  .hive-card-featured → slightly lighter + stronger border
  .hive-card-hero     → blue border accent
  .hive-card-rewards  → honey border accent (rewards pages only)
  .hive-btn-primary   → blue (#3B82F6) button
  .hive-btn-secondary → outlined button
  .hive-btn-ghost     → transparent ghost button
  .hive-btn-danger    → red danger button (unchanged)
  .hive-input         → blue focus ring (was honey)
  .hive-select        → blue focus ring (was honey)
  .glow-blue/.glow-green/.glow-amber/.glow-red/.glow-violet → page hero gradients
  .sidebar-section-label → 10px uppercase nav group labels
```

---

## Task 1: Font + Tailwind Design Tokens

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/tailwind.config.ts`

### Step-by-step

- [ ] **Step 1.1 — Read current layout.tsx**

  Read `/home/zach/hive/frontend/src/app/layout.tsx` in full to confirm current font imports before editing.

- [ ] **Step 1.2 — Update layout.tsx font imports**

  Replace the font imports block. The file currently imports `IBM_Plex_Sans, IBM_Plex_Mono, Geist, Geist_Mono`. Make the following change:

  - Remove `IBM_Plex_Sans` and `IBM_Plex_Mono` imports
  - Add `Inter` import from `"next/font/google"`
  - Keep `Geist` and `Geist_Mono` unchanged (used for marketing pages)
  - Rename `sans` constant to `inter`, pointing to `--font-sans`
  - Drop the `mono` constant; instead set `--font-mono` via CSS var alias in globals.css
  - Apply `${inter.variable} ${geist.variable} ${geistMono.variable}` on `<html>`

  The new imports section should be:

  ```tsx
  import { Inter, Geist, Geist_Mono } from "next/font/google";

  const inter = Inter({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
  });

  const geist = Geist({
    subsets: ["latin"],
    variable: "--font-geist",
    display: "swap",
  });

  const geistMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-geist-mono",
    display: "swap",
  });
  ```

  And the `<html>` className:

  ```tsx
  className={`${inter.variable} ${geist.variable} ${geistMono.variable} antialiased`}
  ```

- [ ] **Step 1.3 — Read current tailwind.config.ts**

  Read `/home/zach/hive/frontend/tailwind.config.ts` in full before editing.

- [ ] **Step 1.4 — Update tailwind.config.ts**

  Apply these targeted changes to the config:

  **fontFamily section** — update `sans` entry, remove `geist` and `geist-mono` entries (those only apply to marketing via `font-geist` class which can stay in globals if needed, but aren't needed in the app design system). Actually keep them so marketing pages don't break. Just update `sans`:

  ```ts
  fontFamily: {
    sans:         ['var(--font-sans)',       'system-ui', 'sans-serif'],
    mono:         ['var(--font-mono)',       'ui-monospace', 'monospace'],
    geist:        ['var(--font-geist)',      'system-ui', 'sans-serif'],
    'geist-mono': ['var(--font-geist-mono)','ui-monospace', 'monospace'],
  },
  ```

  (No change to fontFamily structure — Inter just replaces IBM Plex Sans via the CSS variable.)

  **colors section** — make the following targeted value changes:

  ```ts
  colors: {
    base:     '#13151A',   // was '#13151C'
    surface:  '#1A1D24',   // was '#181B24'
    elevated: '#1F2229',   // was '#1C1F2A'
    overlay:  '#252830',   // was '#22263A'

    honey: {
      DEFAULT: '#F5B942',
      deep:    '#C9920E',
      bright:  '#FFD166',
      faint:   'rgba(245, 185, 66, 0.08)',
      subtle:  'rgba(245, 185, 66, 0.05)',
      glow:    'rgba(245, 185, 66, 0.22)',
      border:  'rgba(245, 185, 66, 0.18)',
    },

    // NEW: add blue token group
    blue: {
      DEFAULT: '#3B82F6',
      hover:   '#2563EB',
      faint:   'rgba(59, 130, 246, 0.08)',
      subtle:  'rgba(59, 130, 246, 0.05)',
      glow:    'rgba(59, 130, 246, 0.22)',
      border:  'rgba(59, 130, 246, 0.20)',
    },

    ink: {
      primary:   '#F0F2F5',   // was '#EEEEF0'
      secondary: '#9CA3AF',   // was '#A0A8B8'
      tertiary:  '#6B7280',   // was '#5A6475'
      ghost:     '#4B5563',   // was '#3D4257'
    },

    semantic: {
      income:  '#22C55E',   // was '#34D399'
      expense: '#EF4444',   // was '#F87171'
      warning: '#F59E0B',   // was '#FBBF24'
      info:    '#3B82F6',   // was '#60A5FA'
    },

    border: {
      DEFAULT: '#2A2D35',                     // was 'rgba(255,255,255,0.07)'
      subtle:  '#22252E',                     // was 'rgba(255,255,255,0.04)'
      strong:  '#3A3E4A',                     // was 'rgba(255,255,255,0.11)'
      white:   'rgba(255, 255, 255, 0.09)',   // keep as-is
      honey:   'rgba(245, 185, 66, 0.18)',    // keep as-is
    },
  },
  ```

- [ ] **Step 1.5 — Commit**

  ```bash
  cd /home/zach/hive && git add frontend/src/app/layout.tsx frontend/tailwind.config.ts && git commit -m "design: update font to Inter and refresh design tokens (blue primary, cooler darks)"
  ```

---

## Task 2: globals.css — New Card, Button, Glow, and Input Classes

**Files:**
- Modify: `frontend/src/app/globals.css`

### Step-by-step

- [ ] **Step 2.1 — Read current globals.css in full**

  Read `/home/zach/hive/frontend/src/app/globals.css` to understand all existing classes before editing.

- [ ] **Step 2.2 — Update `:root` CSS variables**

  Replace the `:root` block with updated values that mirror the new Tailwind tokens:

  ```css
  :root {
    /* Backgrounds */
    --color-base:     #13151A;
    --color-surface:  #1A1D24;
    --color-elevated: #1F2229;
    --color-overlay:  #252830;

    /* Brand accent — gold, reserved for rewards only */
    --color-honey:        #C9920E;
    --color-honey-bright: #F5B942;
    --color-honey-dim:    rgba(245,185,66,0.08);
    --color-honey-border: rgba(245,185,66,0.18);

    /* Blue — primary interactive */
    --color-blue:        #3B82F6;
    --color-blue-hover:  #2563EB;
    --color-blue-dim:    rgba(59,130,246,0.08);
    --color-blue-border: rgba(59,130,246,0.20);

    /* Text */
    --color-ink-primary:   #F0F2F5;
    --color-ink-secondary: #9CA3AF;
    --color-ink-tertiary:  #6B7280;
    --color-ink-ghost:     #4B5563;

    /* Semantic */
    --color-income:  #22C55E;
    --color-expense: #EF4444;
    --color-warning: #F59E0B;
    --color-info:    #3B82F6;

    /* Borders */
    --border-default: #2A2D35;
    --border-subtle:  #22252E;
    --border-strong:  #3A3E4A;

    /* Font alias: --font-mono reuses Geist Mono */
    --font-mono: var(--font-geist-mono);
  }
  ```

- [ ] **Step 2.3 — Update `body` font-family fallback**

  Change the `body` rule font-family fallback from `'IBM Plex Sans'` to `'Inter'`:

  ```css
  body {
    background: var(--color-base);
    color: var(--color-ink-primary);
    position: relative;
    font-family: var(--font-sans), 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  ```

- [ ] **Step 2.4 — Update `.hive-card` and legacy `.glass-card` classes**

  Replace the existing `.hive-card` and `.glass-card` block with:

  ```css
  /* ── Card hierarchy ───────────────────────────────────────────── */

  .hive-card {
    background: #1F2229;
    border: 1px solid #2A2D35;
    border-radius: 10px;
    transition: background 150ms ease, border-color 150ms ease;
  }
  .hive-card:hover {
    background: #252830;
    border-color: #3A3E4A;
  }

  .hive-card-featured {
    background: #252830;
    border: 1px solid #3A3E4A;
    border-radius: 12px;
  }

  .hive-card-hero {
    background: #252830;
    border: 1px solid rgba(59,130,246,0.20);
    border-radius: 12px;
  }

  .hive-card-rewards {
    background: #252830;
    border: 1px solid rgba(245,185,66,0.18);
    border-radius: 10px;
  }

  /* Legacy glass-card aliases — redirect to hive-card */
  .glass-card,
  .glass-card-income,
  .glass-card-expense,
  .glass-card-amber,
  .glass-card-sky,
  .glass-card-violet {
    background: #1F2229;
    border: 1px solid #2A2D35;
    border-radius: 10px;
    transition: background 150ms ease, border-color 150ms ease;
  }
  ```

- [ ] **Step 2.5 — Add glow background utility classes**

  After the card block, add:

  ```css
  /* ── Page hero glow backgrounds ───────────────────────────────── */

  .glow-blue {
    background: radial-gradient(ellipse 80% 50% at 20% -10%, rgba(59,130,246,0.14) 0%, transparent 70%);
  }
  .glow-green {
    background: radial-gradient(ellipse 80% 50% at 20% -10%, rgba(34,197,94,0.14) 0%, transparent 70%);
  }
  .glow-amber {
    background: radial-gradient(ellipse 80% 50% at 20% -10%, rgba(245,185,66,0.14) 0%, transparent 70%);
  }
  .glow-red {
    background: radial-gradient(ellipse 80% 50% at 20% -10%, rgba(239,68,68,0.12) 0%, transparent 70%);
  }
  .glow-violet {
    background: radial-gradient(ellipse 80% 50% at 20% -10%, rgba(167,139,250,0.14) 0%, transparent 70%);
  }
  ```

- [ ] **Step 2.6 — Update `.hive-btn-primary` to blue**

  Replace the current `.hive-btn-primary` block (which uses `var(--color-honey)` with dark text) with the new blue version:

  ```css
  .hive-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: #3B82F6;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    border-radius: 7px;
    border: none;
    padding: 8px 16px;
    cursor: pointer;
    transition: background 150ms ease;
  }
  .hive-btn-primary:hover   { background: #2563EB; }
  .hive-btn-primary:active  { background: #1D4ED8; }
  .hive-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  ```

  Also add a separate class for the rewards-page honey button (so points/optimize pages can still use gold CTAs):

  ```css
  .hive-btn-rewards {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: var(--color-honey-bright);
    color: #0B0C0F;
    font-size: 13px;
    font-weight: 600;
    border-radius: 7px;
    border: none;
    padding: 8px 16px;
    cursor: pointer;
    transition: opacity 150ms ease;
  }
  .hive-btn-rewards:hover   { opacity: 0.88; }
  .hive-btn-rewards:disabled { opacity: 0.4; cursor: not-allowed; }
  ```

- [ ] **Step 2.7 — Update `.hive-btn-secondary` and `.hive-btn-ghost`**

  Update secondary button to use the new border token:

  ```css
  .hive-btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: transparent;
    color: var(--color-ink-secondary);
    font-size: 12px;
    font-weight: 500;
    border-radius: 8px;
    border: 1px solid #3A3E4A;
    padding: 7px 14px;
    cursor: pointer;
    transition: background 150ms, border-color 150ms, color 150ms;
    letter-spacing: -0.01em;
  }
  .hive-btn-secondary:hover {
    background: #252830;
    border-color: #4A5060;
    color: var(--color-ink-primary);
  }
  ```

  Ghost button (minor color update only):

  ```css
  .hive-btn-ghost {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: transparent;
    color: var(--color-ink-ghost);
    font-size: 12px;
    font-weight: 500;
    border-radius: 8px;
    border: none;
    padding: 6px 10px;
    cursor: pointer;
    transition: background 150ms, color 150ms;
  }
  .hive-btn-ghost:hover {
    background: rgba(255,255,255,0.05);
    color: var(--color-ink-secondary);
  }
  ```

- [ ] **Step 2.8 — Update `.hive-input` and `.hive-select` focus rings to blue**

  In `.hive-input:focus`:

  ```css
  .hive-input:focus {
    border-color: var(--color-blue-border);
    background: rgba(255, 255, 255, 0.07);
    box-shadow: 0 0 0 3px var(--color-blue-dim);
  }
  ```

  In `.hive-select:focus`:

  ```css
  .hive-select:focus {
    border-color: var(--color-blue-border);
    color: var(--color-ink-primary);
    box-shadow: 0 0 0 3px var(--color-blue-dim);
  }
  ```

  Also update the SVG arrow color in `.hive-select` background-image from `%236B7090` (old tertiary) to `%236B7280` (new tertiary):

  ```css
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");
  ```

- [ ] **Step 2.9 — Add `.sidebar-section-label` utility**

  After the `.hive-label` block, add:

  ```css
  .sidebar-section-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4B5563;
    padding: 20px 12px 4px;
  }
  ```

- [ ] **Step 2.10 — Commit**

  ```bash
  cd /home/zach/hive && git add frontend/src/app/globals.css && git commit -m "design: update globals.css — blue buttons, new card hierarchy, glow classes, blue focus rings"
  ```

---

## Task 3: Sidebar Full Rewrite (52px → 220px)

**Files:**
- Rewrite: `frontend/src/components/Sidebar.tsx`

### Key constraints
- Preserve all data-fetching logic: `fetch("/api/auth/me")`, `api.insights.list()`, `api.anomalies.list()`, `handleSync()`, and all state variables (`syncing`, `userInitial`, `unreadCount`, `anomalyCount`)
- Preserve the `@keyframes spin` inline style for the sync button
- Replace `NavButton` with new `NavItem` component
- Replace icon-only layout with 220px labeled layout
- New nav structure uses 5 section groups plus bottom cluster

### Step-by-step

- [ ] **Step 3.1 — Read current Sidebar.tsx in full**

  Read `/home/zach/hive/frontend/src/components/Sidebar.tsx` to confirm all logic before rewriting.

- [ ] **Step 3.2 — Rewrite Sidebar.tsx**

  The new file structure:

  **Imports:** Keep all existing imports. Add: `MessageSquare, Flag, Calendar, Store, Filter, Link as LinkIcon` from lucide-react. Remove unused: `CreditCard` (if present).

  **NAV_SECTIONS constant** (replaces `NAV_PRIMARY` and `NAV_SECONDARY`):

  ```tsx
  const NAV_SECTIONS = [
    {
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/chat",      label: "Chat",      icon: MessageSquare },
      ],
    },
    {
      label: "MONEY IN / OUT",
      items: [
        { href: "/transactions",  label: "Transactions",  icon: Receipt },
        { href: "/income",        label: "Income",        icon: ArrowDownLeft },
        { href: "/bills",         label: "Bills",         icon: CalendarClock },
        { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
        { href: "/cash-flow",     label: "Cash Flow",     icon: TrendingDown },
      ],
    },
    {
      label: "PLANNING",
      items: [
        { href: "/budgets", label: "Budgets", icon: Target },
        { href: "/goals",   label: "Goals",   icon: Flag },
        { href: "/debt",    label: "Debt",    icon: TrendingDown },
        { href: "/plan",    label: "Plan",    icon: Calendar },
      ],
    },
    {
      label: "WEALTH",
      items: [
        { href: "/net-worth", label: "Net Worth", icon: TrendingUp },
        { href: "/position",  label: "Position",  icon: Wallet },
        { href: "/reports",   label: "Reports",   icon: BarChart2 },
        { href: "/insights",  label: "Insights",  icon: Bell },
      ],
    },
    {
      label: "REWARDS",
      items: [
        { href: "/points",   label: "Points",   icon: Star },
        { href: "/optimize", label: "Optimize", icon: Zap },
      ],
    },
  ] as const;

  const NAV_BOTTOM = [
    { href: "/merchants", label: "Merchants", icon: Store },
    { href: "/rules",     label: "Rules",     icon: Filter },
    { href: "/anomalies", label: "Anomalies", icon: AlertTriangle },
    { href: "/connect",   label: "Connect",   icon: LinkIcon },
  ] as const;
  ```

  **NavItem component** (replaces NavButton — no tooltip, full label shown):

  ```tsx
  function NavItem({
    href,
    label,
    icon: Icon,
    active,
    badge,
  }: {
    href: string;
    label: string;
    icon: React.ElementType;
    active: boolean;
    badge?: number;
  }) {
    return (
      <Link
        href={href}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 34,
          padding: "0 10px",
          borderRadius: 7,
          borderLeft: active ? "2px solid #3B82F6" : "2px solid transparent",
          background: active ? "rgba(59,130,246,0.10)" : "transparent",
          color: active ? "#F0F2F5" : "#6B7280",
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
          transition: "all 120ms ease",
          marginLeft: 6,
          marginRight: 6,
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.color = "#9CA3AF";
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.color = "#6B7280";
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        <Icon size={15} strokeWidth={active ? 2.1 : 1.8} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        {badge != null && badge > 0 && (
          <span style={{
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            background: "#3B82F6",
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
            flexShrink: 0,
          }}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>
    );
  }
  ```

  **Sidebar component** — `<aside>` width changes to 220px; internal layout switches from centered column to left-aligned column with labels:

  ```tsx
  export default function Sidebar() {
    // ... preserve all existing state and useEffect hooks unchanged ...

    return (
      <aside
        className="hidden md:flex md:flex-col"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 220,
          height: "100vh",
          background: "var(--color-surface)",
          borderRight: "1px solid var(--border-default)",
          zIndex: 40,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* ── Logo + wordmark ─────────────────────────────────── */}
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 14px 10px",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          {/* Hex mark — same SVG as before */}
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: "var(--color-honey-bright)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" stroke="#0B0C0F" strokeWidth="1.5" fill="none" />
              <polygon points="8,4 11.5,6 11.5,10 8,12 4.5,10 4.5,6" stroke="#0B0C0F" strokeWidth="1" fill="#0B0C0F" opacity="0.35" />
              <circle cx="8" cy="8" r="1.2" fill="#0B0C0F" />
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5", letterSpacing: "-0.02em" }}>
            Hive
          </span>
        </Link>

        {/* ── Main scrollable nav ──────────────────────────────── */}
        <nav style={{ flex: 1, paddingBottom: 8 }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {section.label && (
                <div className="sidebar-section-label">{section.label}</div>
              )}
              {section.items.map(({ href, label, icon }) => {
                const active = href === "/dashboard"
                  ? pathname === href
                  : pathname.startsWith(href);
                const badge =
                  href === "/insights"  && unreadCount  > 0 ? unreadCount  :
                  href === "/anomalies" && anomalyCount > 0 ? anomalyCount :
                  undefined;
                return (
                  <NavItem
                    key={href}
                    href={href}
                    label={label}
                    icon={icon}
                    active={active}
                    badge={badge}
                  />
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 14px" }} />

        {/* ── Bottom cluster (Merchants / Rules / Anomalies / Connect) ── */}
        <div style={{ paddingTop: 4, paddingBottom: 4 }}>
          {NAV_BOTTOM.map(({ href, label, icon }) => {
            const active = pathname.startsWith(href);
            const badge = href === "/anomalies" && anomalyCount > 0 ? anomalyCount : undefined;
            return (
              <NavItem key={href} href={href} label={label} icon={icon} active={active} badge={badge} />
            );
          })}
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 14px" }} />

        {/* ── Footer: Search / Sync / Settings / Avatar ───────── */}
        <div style={{ padding: "6px 8px 14px" }}>
          {/* Search */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("hive:cmd-k"))}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              height: 34,
              padding: "0 10px",
              borderRadius: 7,
              border: "none",
              background: "transparent",
              color: "#4B5563",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 120ms ease",
              marginLeft: 6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "#9CA3AF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#4B5563";
            }}
          >
            <Search size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: "left" }}>Search</span>
            <span style={{ fontSize: 10, color: "#4B5563" }}>⌘K</span>
          </button>

          {/* Sync */}
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              height: 34,
              padding: "0 10px",
              borderRadius: 7,
              border: "none",
              background: "transparent",
              color: syncing ? "#F5B942" : "#4B5563",
              fontSize: 13,
              fontWeight: 500,
              cursor: syncing ? "not-allowed" : "pointer",
              transition: "all 120ms ease",
              marginLeft: 6,
            }}
            onMouseEnter={(e) => {
              if (!syncing) {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.color = "#9CA3AF";
              }
            }}
            onMouseLeave={(e) => {
              if (!syncing) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#4B5563";
              }
            }}
          >
            <RefreshCw
              size={15}
              strokeWidth={1.8}
              style={{ flexShrink: 0, animation: syncing ? "spin 1s linear infinite" : "none" }}
            />
            <span>{syncing ? "Syncing…" : "Sync"}</span>
          </button>

          {/* Settings */}
          <NavItem
            href="/settings"
            label="Settings"
            icon={Settings2}
            active={pathname.startsWith("/settings")}
          />

          {/* Avatar row */}
          <Link
            href="/account"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 34,
              padding: "0 10px",
              marginLeft: 6,
              borderRadius: 7,
              textDecoration: "none",
              transition: "background 120ms ease",
              background: pathname.startsWith("/account") ? "rgba(59,130,246,0.10)" : "transparent",
              borderLeft: pathname.startsWith("/account") ? "2px solid #3B82F6" : "2px solid transparent",
            }}
          >
            <div style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#F5B942",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#0B0C0F",
              flexShrink: 0,
            }}>
              {userInitial}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: pathname.startsWith("/account") ? "#F0F2F5" : "#6B7280" }}>
              Account
            </span>
          </Link>
        </div>

        {/* Spin keyframe */}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </aside>
    );
  }
  ```

- [ ] **Step 3.3 — Commit**

  ```bash
  cd /home/zach/hive && git add frontend/src/components/Sidebar.tsx && git commit -m "design: rewrite Sidebar to 220px expanded with section groups and blue active state"
  ```

---

## Task 4: Shared Component Updates + Layout + AnimatedNumber

**Files:**
- Modify: `frontend/src/app/(app)/layout.tsx`
- Modify: `frontend/src/components/PageHero.tsx`
- Modify: `frontend/src/components/GlassCard.tsx`
- Modify: `frontend/src/components/AnimatedBar.tsx`
- Modify: `frontend/src/components/ChartTooltip.tsx`
- Modify: `frontend/src/components/MobileNav.tsx`
- Create: `frontend/src/components/AnimatedNumber.tsx`

### Step-by-step

- [ ] **Step 4.1 — Update (app)/layout.tsx sidebar offset**

  Read `/home/zach/hive/frontend/src/app/(app)/layout.tsx`. Change the `main` element's className from `"md:pl-[52px] pb-16 md:pb-0"` to `"md:pl-[220px] pb-16 md:pb-0"`.

  ```tsx
  <main
    style={{ flex: 1, minWidth: 0, overflow: "auto" }}
    className="md:pl-[220px] pb-16 md:pb-0"
  >
  ```

- [ ] **Step 4.2 — Update PageHero.tsx — add `glow` prop**

  Read `/home/zach/hive/frontend/src/components/PageHero.tsx` in full.

  Add `glow?: "blue" | "green" | "amber" | "red" | "violet"` to both `LegacyPageHeroProps` and `PageHeaderProps` interfaces.

  Wrap the outer container `<div>` in a relative wrapper that renders the glow gradient behind the content when `glow` prop is provided. The pattern:

  ```tsx
  // In PageHeader component, around the outer return:
  return (
    <div style={{ position: "relative" }}>
      {glow && (
        <div
          className={`glow-${glow}`}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
      )}
      <div
        className="px-4 md:px-6"
        style={{
          paddingTop: 20,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          position: "relative",
        }}
      >
        {/* ... rest of existing JSX ... */}
      </div>
    </div>
  );
  ```

  Also update `colorMap` in PageHero to use new semantic values:

  ```tsx
  const colorMap: Record<StatColor, string> = {
    income:  "var(--color-income,  #22C55E)",
    expense: "var(--color-expense, #EF4444)",
    warning: "var(--color-warning, #F59E0B)",
    default: "var(--color-ink-primary, #F0F2F5)",
  };
  ```

- [ ] **Step 4.3 — Update GlassCard.tsx — use hive-card**

  Read `/home/zach/hive/frontend/src/components/GlassCard.tsx`.

  Change the `cn("glass-card", className)` call to `cn("hive-card", className)`. The `tint` prop stays as a no-op for API compatibility.

- [ ] **Step 4.4 — Update AnimatedBar.tsx — blue default gradient**

  Read `/home/zach/hive/frontend/src/components/AnimatedBar.tsx`.

  Update the default gradient from honey to blue:

  ```tsx
  background: color ?? "linear-gradient(90deg, #3B82F6, #60A5FA)",
  ```

  Note: Pages that previously relied on the honey default gradient should pass an explicit `color` prop, but we update the default here so un-decorated bars align with the new primary color. The `color` prop still accepts any CSS color/gradient so no API change.

- [ ] **Step 4.5 — Update ChartTooltip.tsx — new grid + axis colors**

  Read `/home/zach/hive/frontend/src/components/ChartTooltip.tsx`.

  Update the two exported constants:

  ```tsx
  export const CHART_GRID_PROPS = {
    stroke:          "#2A2D35",   // was "rgba(255,255,255,0.04)"
    strokeDasharray: "none",
  } as const;

  export const CHART_AXIS_PROPS = {
    tick:     { fill: "#6B7280", fontSize: 11 },   // was "#4B5063"
    axisLine: false,
    tickLine: false,
  } as const;
  ```

  Update the tooltip `background` to match new surface color:

  ```tsx
  background: "#1F2229",   // was "#161921"
  ```

  Update `border` to use new border token:

  ```tsx
  border: "1px solid #2A2D35",   // was "rgba(255,255,255,0.08)"
  ```

  Update the default dot color:

  ```tsx
  style={{ background: entry.color ?? "#3B82F6" }}   // was "#F5B942"
  ```

- [ ] **Step 4.6 — Update MobileNav.tsx — blue active state**

  Read `/home/zach/hive/frontend/src/components/MobileNav.tsx`.

  Replace all occurrences of honey active colors with blue:
  - `"var(--color-honey-bright)"` → `"#3B82F6"` (active link colors)
  - `"rgba(201,146,14,0.08)"` → `"rgba(59,130,246,0.08)"` (active background in More drawer)

  The bottom tab bar active color on `<Link>` elements:
  ```tsx
  style={{ color: active ? "#3B82F6" : "var(--color-ink-ghost)" }}
  ```

  The "More" button active color:
  ```tsx
  style={{ color: showMore ? "#3B82F6" : "var(--color-ink-ghost)" }}
  ```

- [ ] **Step 4.7 — Create AnimatedNumber.tsx**

  Create `/home/zach/hive/frontend/src/components/AnimatedNumber.tsx` with the following content:

  ```tsx
  "use client";
  import { useEffect, useRef, useState } from "react";

  interface AnimatedNumberProps {
    value: number;
    format: (n: number) => string;
    duration?: number;
    className?: string;
  }

  export default function AnimatedNumber({ value, format, duration = 600, className }: AnimatedNumberProps) {
    const [displayed, setDisplayed] = useState(0);
    const rafRef = useRef<number>(0);

    useEffect(() => {
      const start = performance.now();
      const from = 0;
      const to = value;
      function tick(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
        setDisplayed(from + (to - from) * eased);
        if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }, [value, duration]);

    return <span className={className}>{format(displayed)}</span>;
  }
  ```

- [ ] **Step 4.8 — Commit all Task 4 changes**

  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/layout.tsx" \
    frontend/src/components/PageHero.tsx \
    frontend/src/components/GlassCard.tsx \
    frontend/src/components/AnimatedBar.tsx \
    frontend/src/components/ChartTooltip.tsx \
    frontend/src/components/MobileNav.tsx \
    frontend/src/components/AnimatedNumber.tsx \
    && git commit -m "design: update shared components — 220px layout offset, blue active states, new chart colors, AnimatedNumber"
  ```

---

## Page Update Protocol (Tasks 5–11)

For every page update, follow this protocol:

1. **Read** the existing `page.tsx` in full before making any changes
2. **Apply** design system patterns listed below — preserve all logic, API calls, state
3. **Commit** after completing all pages in the task group

### Pattern application rules

| Pattern | Before | After |
|---------|--------|-------|
| Raw card backgrounds | `bg-[#...]`, `style={{ background: "#..." }}` on card divs | `className="hive-card"` or `className="hive-card-featured"` |
| Glass card usage | `<GlassCard>` or `className="glass-card"` | `className="hive-card"` (GlassCard already outputs hive-card after Task 4.3, but explicit class uses should be updated) |
| Primary buttons (non-rewards) | `className="hive-btn-primary"` using honey or inline honey bg | Keep `hive-btn-primary` class — it's now blue (no JSX change needed if already using class) |
| Primary buttons with explicit honey color | `style={{ background: "#F5B942" }}` or `bg-honey` | Change to `className="hive-btn-primary"` |
| Rewards CTAs on points/optimize | `hive-btn-primary` | Change to `hive-btn-rewards` |
| PageHeader/PageHero usage | `<PageHeader title="..." />` | Add `glow="blue"` (or page-specific color) prop |
| Dollar/percentage values | Plain `<span>` | `<span className="font-mono">` |
| Hard-coded old colors in inline styles | `#EEEEF0`, `#A0A8B8`, `#5A6475`, etc. | Update to new values: `#F0F2F5`, `#9CA3AF`, `#6B7280` |
| Honey active states | `var(--color-honey)`, `#F5B942` in active indicators | `#3B82F6` (blue) — except on rewards pages |

---

## Task 5: Dashboard Page

**File:** `frontend/src/app/(app)/dashboard/page.tsx`
**Glow:** `glow="blue"` on PageHeader
**Card type:** `hive-card` for stat cards, `hive-card-hero` for the Safe-to-Spend hero card
**Notes:** The dashboard already uses `<PageHeader>` — just add `glow="blue"`. The STS card (Safe-to-Spend) uses its own inline `bg` with color variants — update STS_BG and STS_BORDER maps to use slightly higher-contrast values matching the new surface palette. Category bar colors (CAT_COLOR map) can stay as-is — they're semantic data colors, not UI chrome. `AnimatedBar` instances don't need explicit color overrides since the default now maps to blue (but existing explicit colors should stay).

- [ ] **Step 5.1 — Read** `frontend/src/app/(app)/dashboard/page.tsx` in full
- [ ] **Step 5.2 — Apply** design system:
  - Add `glow="blue"` to `<PageHeader>`
  - Replace any raw card background divs with `hive-card` or `hive-card-featured`
  - Update STS_BG green/amber/red entries to use cooler background values consistent with new surface: `green: "rgba(34,197,94,0.08)"`, `amber: "rgba(245,185,66,0.08)"`, `red: "rgba(239,68,68,0.08)"`
  - Update STS_BORDER accordingly: `green: "rgba(34,197,94,0.20)"`, `amber: "rgba(245,185,66,0.20)"`, `red: "rgba(239,68,68,0.20)"`
  - Add `font-mono` to all currency and percentage `<span>` values
  - Replace any `bg-honey`/honey-colored non-rewards buttons with `hive-btn-primary`
- [ ] **Step 5.3 — Commit**
  ```bash
  cd /home/zach/hive && git add "frontend/src/app/(app)/dashboard/page.tsx" && git commit -m "design: update dashboard page — blue glow, hive-card hierarchy, font-mono values"
  ```

---

## Task 6: Transactions + Budgets Pages

**Files:**
- `frontend/src/app/(app)/transactions/page.tsx`
- `frontend/src/app/(app)/budgets/page.tsx`

**Glow:**
- Transactions: no PageHeader (uses custom header) — skip glow
- Budgets: `glow="green"` on `<PageHero>`

**Card types:** `hive-card` for standard cards, `hive-card-featured` for the selected/highlighted budget card

- [ ] **Step 6.1 — Read** both page files in full
- [ ] **Step 6.2 — Apply to transactions/page.tsx:**
  - No PageHeader/PageHero present in this page — skip glow
  - Replace any raw card backgrounds with `hive-card`
  - Add `font-mono` to all dollar amounts and percentages in transaction rows
  - Update `CardBadge` component inline styles to use new border token (`#2A2D35`) and updated ink colors
  - Replace any honey-colored filter/action buttons with `hive-btn-primary` or `hive-btn-secondary`
- [ ] **Step 6.3 — Apply to budgets/page.tsx:**
  - Add `glow="green"` to `<PageHero>`
  - Replace `<GlassCard>` usage and any raw card backgrounds with `hive-card`
  - For the highlighted/selected budget card (`highlighted={true}` prop), use `hive-card-featured`
  - Add `font-mono` to budget amounts, percentages, and spend values in `BudgetCard`
  - Update `AnimatedBar` in budget cards — they likely already have explicit `color` props for category colors; leave those. Any bare AnimatedBar without color prop will now default to blue gradient (correct)
- [ ] **Step 6.4 — Commit**
  ```bash
  cd /home/zach/hive && git add "frontend/src/app/(app)/transactions/page.tsx" "frontend/src/app/(app)/budgets/page.tsx" && git commit -m "design: update transactions + budgets pages — green glow, hive-card, font-mono values"
  ```

---

## Task 7: Bills + Cash Flow + Income + Position Pages

**Files:**
- `frontend/src/app/(app)/bills/page.tsx` — glow `"red"`
- `frontend/src/app/(app)/cash-flow/page.tsx` — glow `"green"`
- `frontend/src/app/(app)/income/page.tsx` — glow `"green"`
- `frontend/src/app/(app)/position/page.tsx` — glow `"blue"`

- [ ] **Step 7.1 — Read** all four page files in full
- [ ] **Step 7.2 — Apply to bills/page.tsx:**
  - Add `glow="red"` to PageHeader/PageHero
  - Replace card backgrounds with `hive-card`
  - Add `font-mono` to dollar amounts (monthly totals, bill amounts)
  - Overdue/upcoming bill indicators likely use `semantic.expense` — update any hardcoded hex to `#EF4444`
- [ ] **Step 7.3 — Apply to cash-flow/page.tsx:**
  - Add `glow="green"` to PageHeader
  - Replace card backgrounds with `hive-card`
  - Add `font-mono` to all numeric values
  - Recharts instances: verify `CHART_GRID_PROPS` and `CHART_AXIS_PROPS` are imported from ChartTooltip (they auto-pick up updated values after Task 4.5)
- [ ] **Step 7.4 — Apply to income/page.tsx:**
  - Add `glow="green"` to PageHeader
  - Replace card backgrounds with `hive-card`
  - Add `font-mono` to income dollar amounts
- [ ] **Step 7.5 — Apply to position/page.tsx:**
  - Add `glow="blue"` to PageHeader
  - Replace card backgrounds with `hive-card`, account summary hero card → `hive-card-hero`
  - Add `font-mono` to all balance and allocation values
- [ ] **Step 7.6 — Commit**
  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/bills/page.tsx" \
    "frontend/src/app/(app)/cash-flow/page.tsx" \
    "frontend/src/app/(app)/income/page.tsx" \
    "frontend/src/app/(app)/position/page.tsx" \
    && git commit -m "design: update bills, cash-flow, income, position pages — glow colors, hive-card, font-mono"
  ```

---

## Task 8: Net Worth + Points + Optimize Pages

**Files:**
- `frontend/src/app/(app)/net-worth/page.tsx` — glow `"blue"`
- `frontend/src/app/(app)/points/page.tsx` — glow `"amber"`
- `frontend/src/app/(app)/optimize/page.tsx` — glow `"amber"`

**Special rules for Points + Optimize:** These are rewards pages. CTAs that were previously `hive-btn-primary` (honey) should become `hive-btn-rewards` (not blue). Cards can use `hive-card-rewards` for program/card tiles that feature gold accents. All other chrome uses standard `hive-card`.

- [ ] **Step 8.1 — Read** all three page files in full (note: points/page.tsx imports sub-components from `./_components/` — read those too if they contain card/button UI)
- [ ] **Step 8.2 — Apply to net-worth/page.tsx:**
  - Add `glow="blue"` to PageHeader
  - Net worth hero number → `hive-card-hero` wrapper
  - Replace chart container card backgrounds with `hive-card`
  - Add `font-mono` to all net worth figures
- [ ] **Step 8.3 — Apply to points/page.tsx and `_components/`:**
  - Add `glow="amber"` to `<PageHero>`
  - In `ProgramCard`, `EarnActivity`, `LeakageSummary`, `TransferPartners` — replace raw card backgrounds with `hive-card` or `hive-card-rewards` for program cards
  - Replace any `hive-btn-primary` CTAs with `hive-btn-rewards` (these should stay gold)
  - Add `font-mono` to point values and dollar equivalents
- [ ] **Step 8.4 — Apply to optimize/page.tsx:**
  - Add `glow="amber"` to PageHeader
  - Replace card backgrounds with `hive-card`, recommendation cards → `hive-card-featured`
  - Replace primary CTAs with `hive-btn-rewards` (gold, not blue)
  - Add `font-mono` to estimated earn values and percentages
- [ ] **Step 8.5 — Commit**
  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/net-worth/page.tsx" \
    "frontend/src/app/(app)/points/page.tsx" \
    "frontend/src/app/(app)/optimize/page.tsx" \
    && git commit -m "design: update net-worth, points, optimize pages — amber glow for rewards, hive-card-rewards, font-mono"
  ```

---

## Task 9: Goals + Debt + Plan + Subscriptions Pages

**Files:**
- `frontend/src/app/(app)/goals/page.tsx` — glow `"green"`
- `frontend/src/app/(app)/debt/page.tsx` — glow `"green"`
- `frontend/src/app/(app)/plan/page.tsx` — glow `"violet"`
- `frontend/src/app/(app)/subscriptions/page.tsx` — glow `"red"`

- [ ] **Step 9.1 — Read** all four page files in full
- [ ] **Step 9.2 — Apply to goals/page.tsx:**
  - Add `glow="green"` to PageHeader
  - Goal cards → `hive-card`, featured/selected goal → `hive-card-featured`
  - Progress bars: `AnimatedBar` with explicit green color `"#22C55E"` for on-track goals
  - Add `font-mono` to target amounts, current amounts, and percentage complete
- [ ] **Step 9.3 — Apply to debt/page.tsx:**
  - Add `glow="green"` to PageHeader
  - Debt account cards → `hive-card`
  - Balance values → `font-mono`; interest rate → `font-mono`
  - Any avalanche/snowball strategy CTA → `hive-btn-primary` (blue)
- [ ] **Step 9.4 — Apply to plan/page.tsx:**
  - Add `glow="violet"` to PageHeader
  - Plan scenario cards → `hive-card-featured`
  - Projection values → `font-mono`
  - Action buttons → `hive-btn-primary` (blue)
- [ ] **Step 9.5 — Apply to subscriptions/page.tsx:**
  - Add `glow="red"` to PageHeader
  - Subscription item cards → `hive-card`
  - Monthly cost totals → `font-mono`
  - Cancel/manage buttons → `hive-btn-danger` (no change needed — already exists)
- [ ] **Step 9.6 — Commit**
  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/goals/page.tsx" \
    "frontend/src/app/(app)/debt/page.tsx" \
    "frontend/src/app/(app)/plan/page.tsx" \
    "frontend/src/app/(app)/subscriptions/page.tsx" \
    && git commit -m "design: update goals, debt, plan, subscriptions pages — glow colors, hive-card, font-mono"
  ```

---

## Task 10: Anomalies + Insights + Reports + Merchants + Chat Pages

**Files:**
- `frontend/src/app/(app)/anomalies/page.tsx` — glow `"red"`
- `frontend/src/app/(app)/insights/page.tsx` — glow `"violet"`
- `frontend/src/app/(app)/reports/page.tsx` — glow `"blue"`
- `frontend/src/app/(app)/merchants/page.tsx` — glow `"blue"`
- `frontend/src/app/(app)/chat/page.tsx` — glow `"violet"`

- [ ] **Step 10.1 — Read** all five page files in full
- [ ] **Step 10.2 — Apply to anomalies/page.tsx:**
  - Add `glow="red"` to PageHeader
  - Anomaly item cards → `hive-card`; flagged/critical anomaly → `hive-card-featured` with inline `border-color: rgba(239,68,68,0.20)` override
  - Dollar deltas → `font-mono`
  - Review/dismiss buttons → `hive-btn-secondary` or `hive-btn-ghost`
- [ ] **Step 10.3 — Apply to insights/page.tsx:**
  - Add `glow="violet"` to PageHeader
  - Insight cards → `hive-card`, featured insight → `hive-card-featured`
  - Any dollar values in insight summaries → `font-mono`
- [ ] **Step 10.4 — Apply to reports/page.tsx:**
  - Add `glow="blue"` to PageHeader
  - Report section cards → `hive-card`
  - Chart containers → `hive-card` wrapper
  - All chart totals/labels → `font-mono`
  - Verify `CHART_GRID_PROPS`/`CHART_AXIS_PROPS` used (auto-updated from Task 4.5)
- [ ] **Step 10.5 — Apply to merchants/page.tsx:**
  - Add `glow="blue"` to PageHeader
  - Merchant cards → `hive-card`
  - Spend totals → `font-mono`
- [ ] **Step 10.6 — Apply to chat/page.tsx:**
  - Add `glow="violet"` to PageHeader
  - Message bubbles and chat container cards → `hive-card` for card-based layouts
  - The chat input field → `hive-input` class (if not already)
  - Send button → `hive-btn-primary` (blue)
- [ ] **Step 10.7 — Commit**
  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/anomalies/page.tsx" \
    "frontend/src/app/(app)/insights/page.tsx" \
    "frontend/src/app/(app)/reports/page.tsx" \
    "frontend/src/app/(app)/merchants/page.tsx" \
    "frontend/src/app/(app)/chat/page.tsx" \
    && git commit -m "design: update anomalies, insights, reports, merchants, chat pages — glow colors, hive-card"
  ```

---

## Task 11: Connect + Account + Security + Settings + Rules + Review Pages

**Files:**
- `frontend/src/app/(app)/connect/page.tsx` — no glow (utility page)
- `frontend/src/app/(app)/account/page.tsx` — no glow
- `frontend/src/app/(app)/security/page.tsx` — no glow
- `frontend/src/app/(app)/settings/page.tsx` — no glow
- `frontend/src/app/(app)/rules/page.tsx` — no glow
- `frontend/src/app/(app)/review/page.tsx` — no glow

These are utility/settings pages — no hero glow, but full design system cleanup is still needed.

- [ ] **Step 11.1 — Read** all six page files in full
- [ ] **Step 11.2 — Apply to connect/page.tsx:**
  - Connected account cards → `hive-card`
  - Connect CTA button → `hive-btn-primary` (blue)
  - Balance values → `font-mono`
- [ ] **Step 11.3 — Apply to account/page.tsx:**
  - Profile card → `hive-card-featured`
  - Form fields → `hive-input` (should already use this class)
  - Save button → `hive-btn-primary` (blue)
  - Danger zone section → preserve `hive-btn-danger`
- [ ] **Step 11.4 — Apply to security/page.tsx:**
  - Card containers → `hive-card`
  - Action buttons → `hive-btn-primary` or `hive-btn-secondary` as appropriate
- [ ] **Step 11.5 — Apply to settings/page.tsx:**
  - Section cards → `hive-card`
  - Toggle/select inputs → `hive-select` (should already use)
  - Save buttons → `hive-btn-primary` (blue)
- [ ] **Step 11.6 — Apply to rules/page.tsx:**
  - Rule cards → `hive-card`
  - Add rule button → `hive-btn-primary` (blue)
  - Rule condition values → `font-mono` where applicable
- [ ] **Step 11.7 — Apply to review/page.tsx:**
  - Review item cards → `hive-card`
  - Approve/skip action buttons → `hive-btn-primary` / `hive-btn-secondary`
  - Dollar values → `font-mono`
- [ ] **Step 11.8 — Commit**
  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/connect/page.tsx" \
    "frontend/src/app/(app)/account/page.tsx" \
    "frontend/src/app/(app)/security/page.tsx" \
    "frontend/src/app/(app)/settings/page.tsx" \
    "frontend/src/app/(app)/rules/page.tsx" \
    "frontend/src/app/(app)/review/page.tsx" \
    && git commit -m "design: update settings cluster pages — hive-card, blue buttons, font-mono"
  ```

---

## Task 12: TypeScript Check + Build Verification

**Files:** None — verification only

- [ ] **Step 12.1 — Run TypeScript type check**

  ```bash
  cd /home/zach/hive/frontend && npx tsc --noEmit 2>&1 | head -60
  ```

  Fix any type errors before proceeding. Common issues to watch for:
  - `glow` prop type not matching on PageHeader legacy vs new interface — ensure both interfaces have `glow?` added
  - `AnimatedNumber` — if imported but not yet used anywhere, ensure it exports correctly (`export default`)
  - New lucide-react icons in Sidebar (`MessageSquare`, `Flag`, `Calendar`, `Store`, `Filter`) — verify they are available in the installed version

- [ ] **Step 12.2 — Run production build**

  ```bash
  cd /home/zach/hive/frontend && npm run build 2>&1 | tail -40
  ```

  The build must complete with zero errors. Warnings about image optimization or `useSearchParams` wrapped in Suspense boundaries are pre-existing and acceptable.

- [ ] **Step 12.3 — Fix any build errors**

  If build fails, read the specific error output, identify the file and line, read that file, and fix the issue. Common patterns:
  - Missing `"use client"` on a component that uses hooks after editing
  - `className` applied to an element that doesn't accept it (use `style` instead)
  - Lucide icon name mismatch (check exact export names: `MessageSquare` not `MessageSquareIcon`)

- [ ] **Step 12.4 — Final commit**

  ```bash
  cd /home/zach/hive && git add -A && git commit -m "design: verify build passes — Hive app UI redesign complete"
  ```

---

## Appendix: File-to-Task Quick Reference

| File | Task |
|------|------|
| `frontend/src/app/layout.tsx` | Task 1 |
| `frontend/tailwind.config.ts` | Task 1 |
| `frontend/src/app/globals.css` | Task 2 |
| `frontend/src/components/Sidebar.tsx` | Task 3 |
| `frontend/src/app/(app)/layout.tsx` | Task 4 |
| `frontend/src/components/PageHero.tsx` | Task 4 |
| `frontend/src/components/GlassCard.tsx` | Task 4 |
| `frontend/src/components/AnimatedBar.tsx` | Task 4 |
| `frontend/src/components/ChartTooltip.tsx` | Task 4 |
| `frontend/src/components/MobileNav.tsx` | Task 4 |
| `frontend/src/components/AnimatedNumber.tsx` | Task 4 (new file) |
| `frontend/src/app/(app)/dashboard/page.tsx` | Task 5 |
| `frontend/src/app/(app)/transactions/page.tsx` | Task 6 |
| `frontend/src/app/(app)/budgets/page.tsx` | Task 6 |
| `frontend/src/app/(app)/bills/page.tsx` | Task 7 |
| `frontend/src/app/(app)/cash-flow/page.tsx` | Task 7 |
| `frontend/src/app/(app)/income/page.tsx` | Task 7 |
| `frontend/src/app/(app)/position/page.tsx` | Task 7 |
| `frontend/src/app/(app)/net-worth/page.tsx` | Task 8 |
| `frontend/src/app/(app)/points/page.tsx` | Task 8 |
| `frontend/src/app/(app)/optimize/page.tsx` | Task 8 |
| `frontend/src/app/(app)/goals/page.tsx` | Task 9 |
| `frontend/src/app/(app)/debt/page.tsx` | Task 9 |
| `frontend/src/app/(app)/plan/page.tsx` | Task 9 |
| `frontend/src/app/(app)/subscriptions/page.tsx` | Task 9 |
| `frontend/src/app/(app)/anomalies/page.tsx` | Task 10 |
| `frontend/src/app/(app)/insights/page.tsx` | Task 10 |
| `frontend/src/app/(app)/reports/page.tsx` | Task 10 |
| `frontend/src/app/(app)/merchants/page.tsx` | Task 10 |
| `frontend/src/app/(app)/chat/page.tsx` | Task 10 |
| `frontend/src/app/(app)/connect/page.tsx` | Task 11 |
| `frontend/src/app/(app)/account/page.tsx` | Task 11 |
| `frontend/src/app/(app)/security/page.tsx` | Task 11 |
| `frontend/src/app/(app)/settings/page.tsx` | Task 11 |
| `frontend/src/app/(app)/rules/page.tsx` | Task 11 |
| `frontend/src/app/(app)/review/page.tsx` | Task 11 |

---

I'm operating in read-only planning mode and cannot write files directly. The complete plan content is above — copy it to `/home/zach/hive/docs/superpowers/plans/2026-05-02-app-ui-redesign.md`.

### Critical Files for Implementation

- `/home/zach/hive/frontend/tailwind.config.ts`
- `/home/zach/hive/frontend/src/app/globals.css`
- `/home/zach/hive/frontend/src/components/Sidebar.tsx`
- `/home/zach/hive/frontend/src/components/PageHero.tsx`
- `/home/zach/hive/frontend/src/app/(app)/layout.tsx`- [ ] **Step 2.4 — Update `.hive-card` and legacy `.glass-card` classes**

  Replace the existing `.hive-card` and `.glass-card` block with:

  ```css
  /* ── Card hierarchy ───────────────────────────────────────────── */

  .hive-card {
    background: #1F2229;
    border: 1px solid #2A2D35;
    border-radius: 10px;
    transition: background 150ms ease, border-color 150ms ease;
  }
  .hive-card:hover {
    background: #252830;
    border-color: #3A3E4A;
  }

  .hive-card-featured {
    background: #252830;
    border: 1px solid #3A3E4A;
    border-radius: 12px;
  }

  .hive-card-hero {
    background: #252830;
    border: 1px solid rgba(59,130,246,0.20);
    border-radius: 12px;
  }

  .hive-card-rewards {
    background: #252830;
    border: 1px solid rgba(245,185,66,0.18);
    border-radius: 10px;
  }

  /* Legacy glass-card aliases — redirect to hive-card */
  .glass-card,
  .glass-card-income,
  .glass-card-expense,
  .glass-card-amber,
  .glass-card-sky,
  .glass-card-violet {
    background: #1F2229;
    border: 1px solid #2A2D35;
    border-radius: 10px;
    transition: background 150ms ease, border-color 150ms ease;
  }
  ```

- [ ] **Step 2.5 — Add glow background utility classes**

  After the card block, add:

  ```css
  /* ── Page hero glow backgrounds ───────────────────────────────── */

  .glow-blue {
    background: radial-gradient(ellipse 80% 50% at 20% -10%, rgba(59,130,246,0.14) 0%, transparent 70%);
  }
  .glow-green {
    background: radial-gradient(ellipse 80% 50% at 20% -10%, rgba(34,197,94,0.14) 0%, transparent 70%);
  }
  .glow-amber {
    background: radial-gradient(ellipse 80% 50% at 20% -10%, rgba(245,185,66,0.14) 0%, transparent 70%);
  }
  .glow-red {
    background: radial-gradient(ellipse 80% 50% at 20% -10%, rgba(239,68,68,0.12) 0%, transparent 70%);
  }
  .glow-violet {
    background: radial-gradient(ellipse 80% 50% at 20% -10%, rgba(167,139,250,0.14) 0%, transparent 70%);
  }
  ```

- [ ] **Step 2.6 — Update `.hive-btn-primary` to blue**

  Replace the current `.hive-btn-primary` block (which uses `var(--color-honey)` with dark text) with the new blue version:

  ```css
  .hive-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: #3B82F6;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    border-radius: 7px;
    border: none;
    padding: 8px 16px;
    cursor: pointer;
    transition: background 150ms ease;
  }
  .hive-btn-primary:hover   { background: #2563EB; }
  .hive-btn-primary:active  { background: #1D4ED8; }
  .hive-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  ```

  Also add a separate class for the rewards-page honey button (so points/optimize pages can still use gold CTAs):

  ```css
  .hive-btn-rewards {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: var(--color-honey-bright);
    color: #0B0C0F;
    font-size: 13px;
    font-weight: 600;
    border-radius: 7px;
    border: none;
    padding: 8px 16px;
    cursor: pointer;
    transition: opacity 150ms ease;
  }
  .hive-btn-rewards:hover   { opacity: 0.88; }
  .hive-btn-rewards:disabled { opacity: 0.4; cursor: not-allowed; }
  ```

- [ ] **Step 2.7 — Update `.hive-btn-secondary` and `.hive-btn-ghost`**

  Update secondary button to use the new border token:

  ```css
  .hive-btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: transparent;
    color: var(--color-ink-secondary);
    font-size: 12px;
    font-weight: 500;
    border-radius: 8px;
    border: 1px solid #3A3E4A;
    padding: 7px 14px;
    cursor: pointer;
    transition: background 150ms, border-color 150ms, color 150ms;
    letter-spacing: -0.01em;
  }
  .hive-btn-secondary:hover {
    background: #252830;
    border-color: #4A5060;
    color: var(--color-ink-primary);
  }
  ```

  Ghost button (minor color update only):

  ```css
  .hive-btn-ghost {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: transparent;
    color: var(--color-ink-ghost);
    font-size: 12px;
    font-weight: 500;
    border-radius: 8px;
    border: none;
    padding: 6px 10px;
    cursor: pointer;
    transition: background 150ms, color 150ms;
  }
  .hive-btn-ghost:hover {
    background: rgba(255,255,255,0.05);
    color: var(--color-ink-secondary);
  }
  ```

- [ ] **Step 2.8 — Update `.hive-input` and `.hive-select` focus rings to blue**

  In `.hive-input:focus`:

  ```css
  .hive-input:focus {
    border-color: var(--color-blue-border);
    background: rgba(255, 255, 255, 0.07);
    box-shadow: 0 0 0 3px var(--color-blue-dim);
  }
  ```

  In `.hive-select:focus`:

  ```css
  .hive-select:focus {
    border-color: var(--color-blue-border);
    color: var(--color-ink-primary);
    box-shadow: 0 0 0 3px var(--color-blue-dim);
  }
  ```

  Also update the SVG arrow color in `.hive-select` background-image from `%236B7090` (old tertiary) to `%236B7280` (new tertiary):

  ```css
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");
  ```

- [ ] **Step 2.9 — Add `.sidebar-section-label` utility**

  After the `.hive-label` block, add:

  ```css
  .sidebar-section-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4B5563;
    padding: 20px 12px 4px;
  }
  ```

- [ ] **Step 2.10 — Commit**

  ```bash
  cd /home/zach/hive && git add frontend/src/app/globals.css && git commit -m "design: update globals.css — blue buttons, new card hierarchy, glow classes, blue focus rings"
  ```

---

## Task 3: Sidebar Full Rewrite (52px → 220px)

**Files:**
- Rewrite: `frontend/src/components/Sidebar.tsx`

### Key constraints
- Preserve all data-fetching logic: `fetch("/api/auth/me")`, `api.insights.list()`, `api.anomalies.list()`, `handleSync()`, and all state variables (`syncing`, `userInitial`, `unreadCount`, `anomalyCount`)
- Preserve the `@keyframes spin` inline style for the sync button
- Replace `NavButton` with new `NavItem` component
- Replace icon-only layout with 220px labeled layout
- New nav structure uses 5 section groups plus bottom cluster

### Step-by-step

- [ ] **Step 3.1 — Read current Sidebar.tsx in full**

  Read `/home/zach/hive/frontend/src/components/Sidebar.tsx` to confirm all logic before rewriting.

- [ ] **Step 3.2 — Rewrite Sidebar.tsx**

  The new file structure:

  **Imports:** Keep all existing imports. Add: `MessageSquare, Flag, Calendar, Store, Filter, Link as LinkIcon` from lucide-react. Remove unused: `CreditCard` (if present).

  **NAV_SECTIONS constant** (replaces `NAV_PRIMARY` and `NAV_SECONDARY`):

  ```tsx
  const NAV_SECTIONS = [
    {
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/chat",      label: "Chat",      icon: MessageSquare },
      ],
    },
    {
      label: "MONEY IN / OUT",
      items: [
        { href: "/transactions",  label: "Transactions",  icon: Receipt },
        { href: "/income",        label: "Income",        icon: ArrowDownLeft },
        { href: "/bills",         label: "Bills",         icon: CalendarClock },
        { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
        { href: "/cash-flow",     label: "Cash Flow",     icon: TrendingDown },
      ],
    },
    {
      label: "PLANNING",
      items: [
        { href: "/budgets", label: "Budgets", icon: Target },
        { href: "/goals",   label: "Goals",   icon: Flag },
        { href: "/debt",    label: "Debt",    icon: TrendingDown },
        { href: "/plan",    label: "Plan",    icon: Calendar },
      ],
    },
    {
      label: "WEALTH",
      items: [
        { href: "/net-worth", label: "Net Worth", icon: TrendingUp },
        { href: "/position",  label: "Position",  icon: Wallet },
        { href: "/reports",   label: "Reports",   icon: BarChart2 },
        { href: "/insights",  label: "Insights",  icon: Bell },
      ],
    },
    {
      label: "REWARDS",
      items: [
        { href: "/points",   label: "Points",   icon: Star },
        { href: "/optimize", label: "Optimize", icon: Zap },
      ],
    },
  ] as const;

  const NAV_BOTTOM = [
    { href: "/merchants", label: "Merchants", icon: Store },
    { href: "/rules",     label: "Rules",     icon: Filter },
    { href: "/anomalies", label: "Anomalies", icon: AlertTriangle },
    { href: "/connect",   label: "Connect",   icon: LinkIcon },
  ] as const;
  ```

  **NavItem component** (replaces NavButton — no tooltip, full label shown):

  ```tsx
  function NavItem({
    href,
    label,
    icon: Icon,
    active,
    badge,
  }: {
    href: string;
    label: string;
    icon: React.ElementType;
    active: boolean;
    badge?: number;
  }) {
    return (
      <Link
        href={href}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 34,
          padding: "0 10px",
          borderRadius: 7,
          borderLeft: active ? "2px solid #3B82F6" : "2px solid transparent",
          background: active ? "rgba(59,130,246,0.10)" : "transparent",
          color: active ? "#F0F2F5" : "#6B7280",
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
          transition: "all 120ms ease",
          marginLeft: 6,
          marginRight: 6,
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.color = "#9CA3AF";
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.color = "#6B7280";
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        <Icon size={15} strokeWidth={active ? 2.1 : 1.8} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        {badge != null && badge > 0 && (
          <span style={{
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            background: "#3B82F6",
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
            flexShrink: 0,
          }}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>
    );
  }
  ```

  **Sidebar component** — `<aside>` width changes to 220px; internal layout switches from centered column to left-aligned column with labels:

  ```tsx
  export default function Sidebar() {
    // ... preserve all existing state and useEffect hooks unchanged ...

    return (
      <aside
        className="hidden md:flex md:flex-col"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 220,
          height: "100vh",
          background: "var(--color-surface)",
          borderRight: "1px solid var(--border-default)",
          zIndex: 40,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* ── Logo + wordmark ─────────────────────────────────── */}
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 14px 10px",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          {/* Hex mark — same SVG as before */}
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: "var(--color-honey-bright)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" stroke="#0B0C0F" strokeWidth="1.5" fill="none" />
              <polygon points="8,4 11.5,6 11.5,10 8,12 4.5,10 4.5,6" stroke="#0B0C0F" strokeWidth="1" fill="#0B0C0F" opacity="0.35" />
              <circle cx="8" cy="8" r="1.2" fill="#0B0C0F" />
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#F0F2F5", letterSpacing: "-0.02em" }}>
            Hive
          </span>
        </Link>

        {/* ── Main scrollable nav ──────────────────────────────── */}
        <nav style={{ flex: 1, paddingBottom: 8 }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {section.label && (
                <div className="sidebar-section-label">{section.label}</div>
              )}
              {section.items.map(({ href, label, icon }) => {
                const active = href === "/dashboard"
                  ? pathname === href
                  : pathname.startsWith(href);
                const badge =
                  href === "/insights"  && unreadCount  > 0 ? unreadCount  :
                  href === "/anomalies" && anomalyCount > 0 ? anomalyCount :
                  undefined;
                return (
                  <NavItem
                    key={href}
                    href={href}
                    label={label}
                    icon={icon}
                    active={active}
                    badge={badge}
                  />
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 14px" }} />

        {/* ── Bottom cluster (Merchants / Rules / Anomalies / Connect) ── */}
        <div style={{ paddingTop: 4, paddingBottom: 4 }}>
          {NAV_BOTTOM.map(({ href, label, icon }) => {
            const active = pathname.startsWith(href);
            const badge = href === "/anomalies" && anomalyCount > 0 ? anomalyCount : undefined;
            return (
              <NavItem key={href} href={href} label={label} icon={icon} active={active} badge={badge} />
            );
          })}
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 14px" }} />

        {/* ── Footer: Search / Sync / Settings / Avatar ───────── */}
        <div style={{ padding: "6px 8px 14px" }}>
          {/* Search */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("hive:cmd-k"))}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              height: 34,
              padding: "0 10px",
              borderRadius: 7,
              border: "none",
              background: "transparent",
              color: "#4B5563",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 120ms ease",
              marginLeft: 6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "#9CA3AF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#4B5563";
            }}
          >
            <Search size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: "left" }}>Search</span>
            <span style={{ fontSize: 10, color: "#4B5563" }}>⌘K</span>
          </button>

          {/* Sync */}
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              height: 34,
              padding: "0 10px",
              borderRadius: 7,
              border: "none",
              background: "transparent",
              color: syncing ? "#F5B942" : "#4B5563",
              fontSize: 13,
              fontWeight: 500,
              cursor: syncing ? "not-allowed" : "pointer",
              transition: "all 120ms ease",
              marginLeft: 6,
            }}
            onMouseEnter={(e) => {
              if (!syncing) {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.color = "#9CA3AF";
              }
            }}
            onMouseLeave={(e) => {
              if (!syncing) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#4B5563";
              }
            }}
          >
            <RefreshCw
              size={15}
              strokeWidth={1.8}
              style={{ flexShrink: 0, animation: syncing ? "spin 1s linear infinite" : "none" }}
            />
            <span>{syncing ? "Syncing…" : "Sync"}</span>
          </button>

          {/* Settings */}
          <NavItem
            href="/settings"
            label="Settings"
            icon={Settings2}
            active={pathname.startsWith("/settings")}
          />

          {/* Avatar row */}
          <Link
            href="/account"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 34,
              padding: "0 10px",
              marginLeft: 6,
              borderRadius: 7,
              textDecoration: "none",
              transition: "background 120ms ease",
              background: pathname.startsWith("/account") ? "rgba(59,130,246,0.10)" : "transparent",
              borderLeft: pathname.startsWith("/account") ? "2px solid #3B82F6" : "2px solid transparent",
            }}
          >
            <div style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#F5B942",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#0B0C0F",
              flexShrink: 0,
            }}>
              {userInitial}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: pathname.startsWith("/account") ? "#F0F2F5" : "#6B7280" }}>
              Account
            </span>
          </Link>
        </div>

        {/* Spin keyframe */}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </aside>
    );
  }
  ```

- [ ] **Step 3.3 — Commit**

  ```bash
  cd /home/zach/hive && git add frontend/src/components/Sidebar.tsx && git commit -m "design: rewrite Sidebar to 220px expanded with section groups and blue active state"
  ```

---

## Task 4: Shared Component Updates + Layout + AnimatedNumber

**Files:**
- Modify: `frontend/src/app/(app)/layout.tsx`
- Modify: `frontend/src/components/PageHero.tsx`
- Modify: `frontend/src/components/GlassCard.tsx`
- Modify: `frontend/src/components/AnimatedBar.tsx`
- Modify: `frontend/src/components/ChartTooltip.tsx`
- Modify: `frontend/src/components/MobileNav.tsx`
- Create: `frontend/src/components/AnimatedNumber.tsx`

### Step-by-step

- [ ] **Step 4.1 — Update (app)/layout.tsx sidebar offset**

  Read `/home/zach/hive/frontend/src/app/(app)/layout.tsx`. Change the `main` element's className from `"md:pl-[52px] pb-16 md:pb-0"` to `"md:pl-[220px] pb-16 md:pb-0"`.

  ```tsx
  <main
    style={{ flex: 1, minWidth: 0, overflow: "auto" }}
    className="md:pl-[220px] pb-16 md:pb-0"
  >
  ```

- [ ] **Step 4.2 — Update PageHero.tsx — add `glow` prop**

  Read `/home/zach/hive/frontend/src/components/PageHero.tsx` in full.

  Add `glow?: "blue" | "green" | "amber" | "red" | "violet"` to both `LegacyPageHeroProps` and `PageHeaderProps` interfaces.

  Wrap the outer container `<div>` in a relative wrapper that renders the glow gradient behind the content when `glow` prop is provided. The pattern:

  ```tsx
  // In PageHeader component, around the outer return:
  return (
    <div style={{ position: "relative" }}>
      {glow && (
        <div
          className={`glow-${glow}`}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
      )}
      <div
        className="px-4 md:px-6"
        style={{
          paddingTop: 20,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          position: "relative",
        }}
      >
        {/* ... rest of existing JSX ... */}
      </div>
    </div>
  );
  ```

  Also update `colorMap` in PageHero to use new semantic values:

  ```tsx
  const colorMap: Record<StatColor, string> = {
    income:  "var(--color-income,  #22C55E)",
    expense: "var(--color-expense, #EF4444)",
    warning: "var(--color-warning, #F59E0B)",
    default: "var(--color-ink-primary, #F0F2F5)",
  };
  ```

- [ ] **Step 4.3 — Update GlassCard.tsx — use hive-card**

  Read `/home/zach/hive/frontend/src/components/GlassCard.tsx`.

  Change the `cn("glass-card", className)` call to `cn("hive-card", className)`. The `tint` prop stays as a no-op for API compatibility.

- [ ] **Step 4.4 — Update AnimatedBar.tsx — blue default gradient**

  Read `/home/zach/hive/frontend/src/components/AnimatedBar.tsx`.

  Update the default gradient from honey to blue:

  ```tsx
  background: color ?? "linear-gradient(90deg, #3B82F6, #60A5FA)",
  ```

  Note: Pages that previously relied on the honey default gradient should pass an explicit `color` prop, but we update the default here so un-decorated bars align with the new primary color. The `color` prop still accepts any CSS color/gradient so no API change.

- [ ] **Step 4.5 — Update ChartTooltip.tsx — new grid + axis colors**

  Read `/home/zach/hive/frontend/src/components/ChartTooltip.tsx`.

  Update the two exported constants:

  ```tsx
  export const CHART_GRID_PROPS = {
    stroke:          "#2A2D35",   // was "rgba(255,255,255,0.04)"
    strokeDasharray: "none",
  } as const;

  export const CHART_AXIS_PROPS = {
    tick:     { fill: "#6B7280", fontSize: 11 },   // was "#4B5063"
    axisLine: false,
    tickLine: false,
  } as const;
  ```

  Update the tooltip `background` to match new surface color:

  ```tsx
  background: "#1F2229",   // was "#161921"
  ```

  Update `border` to use new border token:

  ```tsx
  border: "1px solid #2A2D35",   // was "rgba(255,255,255,0.08)"
  ```

  Update the default dot color:

  ```tsx
  style={{ background: entry.color ?? "#3B82F6" }}   // was "#F5B942"
  ```

- [ ] **Step 4.6 — Update MobileNav.tsx — blue active state**

  Read `/home/zach/hive/frontend/src/components/MobileNav.tsx`.

  Replace all occurrences of honey active colors with blue:
  - `"var(--color-honey-bright)"` → `"#3B82F6"` (active link colors)
  - `"rgba(201,146,14,0.08)"` → `"rgba(59,130,246,0.08)"` (active background in More drawer)

  The bottom tab bar active color on `<Link>` elements:
  ```tsx
  style={{ color: active ? "#3B82F6" : "var(--color-ink-ghost)" }}
  ```

  The "More" button active color:
  ```tsx
  style={{ color: showMore ? "#3B82F6" : "var(--color-ink-ghost)" }}
  ```

- [ ] **Step 4.7 — Create AnimatedNumber.tsx**

  Create `/home/zach/hive/frontend/src/components/AnimatedNumber.tsx` with the following content:

  ```tsx
  "use client";
  import { useEffect, useRef, useState } from "react";

  interface AnimatedNumberProps {
    value: number;
    format: (n: number) => string;
    duration?: number;
    className?: string;
  }

  export default function AnimatedNumber({ value, format, duration = 600, className }: AnimatedNumberProps) {
    const [displayed, setDisplayed] = useState(0);
    const rafRef = useRef<number>(0);

    useEffect(() => {
      const start = performance.now();
      const from = 0;
      const to = value;
      function tick(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
        setDisplayed(from + (to - from) * eased);
        if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }, [value, duration]);

    return <span className={className}>{format(displayed)}</span>;
  }
  ```

- [ ] **Step 4.8 — Commit all Task 4 changes**

  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/layout.tsx" \
    frontend/src/components/PageHero.tsx \
    frontend/src/components/GlassCard.tsx \
    frontend/src/components/AnimatedBar.tsx \
    frontend/src/components/ChartTooltip.tsx \
    frontend/src/components/MobileNav.tsx \
    frontend/src/components/AnimatedNumber.tsx \
    && git commit -m "design: update shared components — 220px layout offset, blue active states, new chart colors, AnimatedNumber"
  ```

---

## Page Update Protocol (Tasks 5–11)

For every page update, follow this protocol:

1. **Read** the existing `page.tsx` in full before making any changes
2. **Apply** design system patterns listed below — preserve all logic, API calls, state
3. **Commit** after completing all pages in the task group

### Pattern application rules

| Pattern | Before | After |
|---------|--------|-------|
| Raw card backgrounds | `bg-[#...]`, `style={{ background: "#..." }}` on card divs | `className="hive-card"` or `className="hive-card-featured"` |
| Glass card usage | `<GlassCard>` or `className="glass-card"` | `className="hive-card"` (GlassCard already outputs hive-card after Task 4.3, but explicit class uses should be updated) |
| Primary buttons (non-rewards) | `className="hive-btn-primary"` using honey or inline honey bg | Keep `hive-btn-primary` class — it's now blue (no JSX change needed if already using class) |
| Primary buttons with explicit honey color | `style={{ background: "#F5B942" }}` or `bg-honey` | Change to `className="hive-btn-primary"` |
| Rewards CTAs on points/optimize | `hive-btn-primary` | Change to `hive-btn-rewards` |
| PageHeader/PageHero usage | `<PageHeader title="..." />` | Add `glow="blue"` (or page-specific color) prop |
| Dollar/percentage values | Plain `<span>` | `<span className="font-mono">` |
| Hard-coded old colors in inline styles | `#EEEEF0`, `#A0A8B8`, `#5A6475`, etc. | Update to new values: `#F0F2F5`, `#9CA3AF`, `#6B7280` |
| Honey active states | `var(--color-honey)`, `#F5B942` in active indicators | `#3B82F6` (blue) — except on rewards pages |

---

## Task 5: Dashboard Page

**File:** `frontend/src/app/(app)/dashboard/page.tsx`
**Glow:** `glow="blue"` on PageHeader
**Card type:** `hive-card` for stat cards, `hive-card-hero` for the Safe-to-Spend hero card
**Notes:** The dashboard already uses `<PageHeader>` — just add `glow="blue"`. The STS card (Safe-to-Spend) uses its own inline `bg` with color variants — update STS_BG and STS_BORDER maps to use slightly higher-contrast values matching the new surface palette. Category bar colors (CAT_COLOR map) can stay as-is — they're semantic data colors, not UI chrome. `AnimatedBar` instances don't need explicit color overrides since the default now maps to blue (but existing explicit colors should stay).

- [ ] **Step 5.1 — Read** `frontend/src/app/(app)/dashboard/page.tsx` in full
- [ ] **Step 5.2 — Apply** design system:
  - Add `glow="blue"` to `<PageHeader>`
  - Replace any raw card background divs with `hive-card` or `hive-card-featured`
  - Update STS_BG green/amber/red entries to use cooler background values consistent with new surface: `green: "rgba(34,197,94,0.08)"`, `amber: "rgba(245,185,66,0.08)"`, `red: "rgba(239,68,68,0.08)"`
  - Update STS_BORDER accordingly: `green: "rgba(34,197,94,0.20)"`, `amber: "rgba(245,185,66,0.20)"`, `red: "rgba(239,68,68,0.20)"`
  - Add `font-mono` to all currency and percentage `<span>` values
  - Replace any `bg-honey`/honey-colored non-rewards buttons with `hive-btn-primary`
- [ ] **Step 5.3 — Commit**
  ```bash
  cd /home/zach/hive && git add "frontend/src/app/(app)/dashboard/page.tsx" && git commit -m "design: update dashboard page — blue glow, hive-card hierarchy, font-mono values"
  ```

---

## Task 6: Transactions + Budgets Pages

**Files:**
- `frontend/src/app/(app)/transactions/page.tsx`
- `frontend/src/app/(app)/budgets/page.tsx`

**Glow:**
- Transactions: no PageHeader (uses custom header) — skip glow
- Budgets: `glow="green"` on `<PageHero>`

**Card types:** `hive-card` for standard cards, `hive-card-featured` for the selected/highlighted budget card

- [ ] **Step 6.1 — Read** both page files in full
- [ ] **Step 6.2 — Apply to transactions/page.tsx:**
  - No PageHeader/PageHero present in this page — skip glow
  - Replace any raw card backgrounds with `hive-card`
  - Add `font-mono` to all dollar amounts and percentages in transaction rows
  - Update `CardBadge` component inline styles to use new border token (`#2A2D35`) and updated ink colors
  - Replace any honey-colored filter/action buttons with `hive-btn-primary` or `hive-btn-secondary`
- [ ] **Step 6.3 — Apply to budgets/page.tsx:**
  - Add `glow="green"` to `<PageHero>`
  - Replace `<GlassCard>` usage and any raw card backgrounds with `hive-card`
  - For the highlighted/selected budget card (`highlighted={true}` prop), use `hive-card-featured`
  - Add `font-mono` to budget amounts, percentages, and spend values in `BudgetCard`
  - Update `AnimatedBar` in budget cards — they likely already have explicit `color` props for category colors; leave those. Any bare AnimatedBar without color prop will now default to blue gradient (correct)
- [ ] **Step 6.4 — Commit**
  ```bash
  cd /home/zach/hive && git add "frontend/src/app/(app)/transactions/page.tsx" "frontend/src/app/(app)/budgets/page.tsx" && git commit -m "design: update transactions + budgets pages — green glow, hive-card, font-mono values"
  ```

---

## Task 7: Bills + Cash Flow + Income + Position Pages

**Files:**
- `frontend/src/app/(app)/bills/page.tsx` — glow `"red"`
- `frontend/src/app/(app)/cash-flow/page.tsx` — glow `"green"`
- `frontend/src/app/(app)/income/page.tsx` — glow `"green"`
- `frontend/src/app/(app)/position/page.tsx` — glow `"blue"`

- [ ] **Step 7.1 — Read** all four page files in full
- [ ] **Step 7.2 — Apply to bills/page.tsx:**
  - Add `glow="red"` to PageHeader/PageHero
  - Replace card backgrounds with `hive-card`
  - Add `font-mono` to dollar amounts (monthly totals, bill amounts)
  - Overdue/upcoming bill indicators likely use `semantic.expense` — update any hardcoded hex to `#EF4444`
- [ ] **Step 7.3 — Apply to cash-flow/page.tsx:**
  - Add `glow="green"` to PageHeader
  - Replace card backgrounds with `hive-card`
  - Add `font-mono` to all numeric values
  - Recharts instances: verify `CHART_GRID_PROPS` and `CHART_AXIS_PROPS` are imported from ChartTooltip (they auto-pick up updated values after Task 4.5)
- [ ] **Step 7.4 — Apply to income/page.tsx:**
  - Add `glow="green"` to PageHeader
  - Replace card backgrounds with `hive-card`
  - Add `font-mono` to income dollar amounts
- [ ] **Step 7.5 — Apply to position/page.tsx:**
  - Add `glow="blue"` to PageHeader
  - Replace card backgrounds with `hive-card`, account summary hero card → `hive-card-hero`
  - Add `font-mono` to all balance and allocation values
- [ ] **Step 7.6 — Commit**
  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/bills/page.tsx" \
    "frontend/src/app/(app)/cash-flow/page.tsx" \
    "frontend/src/app/(app)/income/page.tsx" \
    "frontend/src/app/(app)/position/page.tsx" \
    && git commit -m "design: update bills, cash-flow, income, position pages — glow colors, hive-card, font-mono"
  ```

---

## Task 8: Net Worth + Points + Optimize Pages

**Files:**
- `frontend/src/app/(app)/net-worth/page.tsx` — glow `"blue"`
- `frontend/src/app/(app)/points/page.tsx` — glow `"amber"`
- `frontend/src/app/(app)/optimize/page.tsx` — glow `"amber"`

**Special rules for Points + Optimize:** These are rewards pages. CTAs that were previously `hive-btn-primary` (honey) should become `hive-btn-rewards` (not blue). Cards can use `hive-card-rewards` for program/card tiles that feature gold accents. All other chrome uses standard `hive-card`.

- [ ] **Step 8.1 — Read** all three page files in full (note: points/page.tsx imports sub-components from `./_components/` — read those too if they contain card/button UI)
- [ ] **Step 8.2 — Apply to net-worth/page.tsx:**
  - Add `glow="blue"` to PageHeader
  - Net worth hero number → `hive-card-hero` wrapper
  - Replace chart container card backgrounds with `hive-card`
  - Add `font-mono` to all net worth figures
- [ ] **Step 8.3 — Apply to points/page.tsx and `_components/`:**
  - Add `glow="amber"` to `<PageHero>`
  - In `ProgramCard`, `EarnActivity`, `LeakageSummary`, `TransferPartners` — replace raw card backgrounds with `hive-card` or `hive-card-rewards` for program cards
  - Replace any `hive-btn-primary` CTAs with `hive-btn-rewards` (these should stay gold)
  - Add `font-mono` to point values and dollar equivalents
- [ ] **Step 8.4 — Apply to optimize/page.tsx:**
  - Add `glow="amber"` to PageHeader
  - Replace card backgrounds with `hive-card`, recommendation cards → `hive-card-featured`
  - Replace primary CTAs with `hive-btn-rewards` (gold, not blue)
  - Add `font-mono` to estimated earn values and percentages
- [ ] **Step 8.5 — Commit**
  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/net-worth/page.tsx" \
    "frontend/src/app/(app)/points/page.tsx" \
    "frontend/src/app/(app)/optimize/page.tsx" \
    && git commit -m "design: update net-worth, points, optimize pages — amber glow for rewards, hive-card-rewards, font-mono"
  ```

---

## Task 9: Goals + Debt + Plan + Subscriptions Pages

**Files:**
- `frontend/src/app/(app)/goals/page.tsx` — glow `"green"`
- `frontend/src/app/(app)/debt/page.tsx` — glow `"green"`
- `frontend/src/app/(app)/plan/page.tsx` — glow `"violet"`
- `frontend/src/app/(app)/subscriptions/page.tsx` — glow `"red"`

- [ ] **Step 9.1 — Read** all four page files in full
- [ ] **Step 9.2 — Apply to goals/page.tsx:**
  - Add `glow="green"` to PageHeader
  - Goal cards → `hive-card`, featured/selected goal → `hive-card-featured`
  - Progress bars: `AnimatedBar` with explicit green color `"#22C55E"` for on-track goals
  - Add `font-mono` to target amounts, current amounts, and percentage complete
- [ ] **Step 9.3 — Apply to debt/page.tsx:**
  - Add `glow="green"` to PageHeader
  - Debt account cards → `hive-card`
  - Balance values → `font-mono`; interest rate → `font-mono`
  - Any avalanche/snowball strategy CTA → `hive-btn-primary` (blue)
- [ ] **Step 9.4 — Apply to plan/page.tsx:**
  - Add `glow="violet"` to PageHeader
  - Plan scenario cards → `hive-card-featured`
  - Projection values → `font-mono`
  - Action buttons → `hive-btn-primary` (blue)
- [ ] **Step 9.5 — Apply to subscriptions/page.tsx:**
  - Add `glow="red"` to PageHeader
  - Subscription item cards → `hive-card`
  - Monthly cost totals → `font-mono`
  - Cancel/manage buttons → `hive-btn-danger` (no change needed — already exists)
- [ ] **Step 9.6 — Commit**
  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/goals/page.tsx" \
    "frontend/src/app/(app)/debt/page.tsx" \
    "frontend/src/app/(app)/plan/page.tsx" \
    "frontend/src/app/(app)/subscriptions/page.tsx" \
    && git commit -m "design: update goals, debt, plan, subscriptions pages — glow colors, hive-card, font-mono"
  ```

---

## Task 10: Anomalies + Insights + Reports + Merchants + Chat Pages

**Files:**
- `frontend/src/app/(app)/anomalies/page.tsx` — glow `"red"`
- `frontend/src/app/(app)/insights/page.tsx` — glow `"violet"`
- `frontend/src/app/(app)/reports/page.tsx` — glow `"blue"`
- `frontend/src/app/(app)/merchants/page.tsx` — glow `"blue"`
- `frontend/src/app/(app)/chat/page.tsx` — glow `"violet"`

- [ ] **Step 10.1 — Read** all five page files in full
- [ ] **Step 10.2 — Apply to anomalies/page.tsx:**
  - Add `glow="red"` to PageHeader
  - Anomaly item cards → `hive-card`; flagged/critical anomaly → `hive-card-featured` with inline `border-color: rgba(239,68,68,0.20)` override
  - Dollar deltas → `font-mono`
  - Review/dismiss buttons → `hive-btn-secondary` or `hive-btn-ghost`
- [ ] **Step 10.3 — Apply to insights/page.tsx:**
  - Add `glow="violet"` to PageHeader
  - Insight cards → `hive-card`, featured insight → `hive-card-featured`
  - Any dollar values in insight summaries → `font-mono`
- [ ] **Step 10.4 — Apply to reports/page.tsx:**
  - Add `glow="blue"` to PageHeader
  - Report section cards → `hive-card`
  - Chart containers → `hive-card` wrapper
  - All chart totals/labels → `font-mono`
  - Verify `CHART_GRID_PROPS`/`CHART_AXIS_PROPS` used (auto-updated from Task 4.5)
- [ ] **Step 10.5 — Apply to merchants/page.tsx:**
  - Add `glow="blue"` to PageHeader
  - Merchant cards → `hive-card`
  - Spend totals → `font-mono`
- [ ] **Step 10.6 — Apply to chat/page.tsx:**
  - Add `glow="violet"` to PageHeader
  - Message bubbles and chat container cards → `hive-card` for card-based layouts
  - The chat input field → `hive-input` class (if not already)
  - Send button → `hive-btn-primary` (blue)
- [ ] **Step 10.7 — Commit**
  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/anomalies/page.tsx" \
    "frontend/src/app/(app)/insights/page.tsx" \
    "frontend/src/app/(app)/reports/page.tsx" \
    "frontend/src/app/(app)/merchants/page.tsx" \
    "frontend/src/app/(app)/chat/page.tsx" \
    && git commit -m "design: update anomalies, insights, reports, merchants, chat pages — glow colors, hive-card"
  ```

---

## Task 11: Connect + Account + Security + Settings + Rules + Review Pages

**Files:**
- `frontend/src/app/(app)/connect/page.tsx` — no glow (utility page)
- `frontend/src/app/(app)/account/page.tsx` — no glow
- `frontend/src/app/(app)/security/page.tsx` — no glow
- `frontend/src/app/(app)/settings/page.tsx` — no glow
- `frontend/src/app/(app)/rules/page.tsx` — no glow
- `frontend/src/app/(app)/review/page.tsx` — no glow

These are utility/settings pages — no hero glow, but full design system cleanup is still needed.

- [ ] **Step 11.1 — Read** all six page files in full
- [ ] **Step 11.2 — Apply to connect/page.tsx:**
  - Connected account cards → `hive-card`
  - Connect CTA button → `hive-btn-primary` (blue)
  - Balance values → `font-mono`
- [ ] **Step 11.3 — Apply to account/page.tsx:**
  - Profile card → `hive-card-featured`
  - Form fields → `hive-input` (should already use this class)
  - Save button → `hive-btn-primary` (blue)
  - Danger zone section → preserve `hive-btn-danger`
- [ ] **Step 11.4 — Apply to security/page.tsx:**
  - Card containers → `hive-card`
  - Action buttons → `hive-btn-primary` or `hive-btn-secondary` as appropriate
- [ ] **Step 11.5 — Apply to settings/page.tsx:**
  - Section cards → `hive-card`
  - Toggle/select inputs → `hive-select` (should already use)
  - Save buttons → `hive-btn-primary` (blue)
- [ ] **Step 11.6 — Apply to rules/page.tsx:**
  - Rule cards → `hive-card`
  - Add rule button → `hive-btn-primary` (blue)
  - Rule condition values → `font-mono` where applicable
- [ ] **Step 11.7 — Apply to review/page.tsx:**
  - Review item cards → `hive-card`
  - Approve/skip action buttons → `hive-btn-primary` / `hive-btn-secondary`
  - Dollar values → `font-mono`
- [ ] **Step 11.8 — Commit**
  ```bash
  cd /home/zach/hive && git add \
    "frontend/src/app/(app)/connect/page.tsx" \
    "frontend/src/app/(app)/account/page.tsx" \
    "frontend/src/app/(app)/security/page.tsx" \
    "frontend/src/app/(app)/settings/page.tsx" \
    "frontend/src/app/(app)/rules/page.tsx" \
    "frontend/src/app/(app)/review/page.tsx" \
    && git commit -m "design: update settings cluster pages — hive-card, blue buttons, font-mono"
  ```

---

## Task 12: TypeScript Check + Build Verification

**Files:** None — verification only

- [ ] **Step 12.1 — Run TypeScript type check**

  ```bash
  cd /home/zach/hive/frontend && npx tsc --noEmit 2>&1 | head -60
  ```

  Fix any type errors before proceeding. Common issues to watch for:
  - `glow` prop type not matching on PageHeader legacy vs new interface — ensure both interfaces have `glow?` added
  - `AnimatedNumber` — if imported but not yet used anywhere, ensure it exports correctly (`export default`)
  - New lucide-react icons in Sidebar (`MessageSquare`, `Flag`, `Calendar`, `Store`, `Filter`) — verify they are available in the installed version

- [ ] **Step 12.2 — Run production build**

  ```bash
  cd /home/zach/hive/frontend && npm run build 2>&1 | tail -40
  ```

  The build must complete with zero errors. Warnings about image optimization or `useSearchParams` wrapped in Suspense boundaries are pre-existing and acceptable.

- [ ] **Step 12.3 — Fix any build errors**

  If build fails, read the specific error output, identify the file and line, read that file, and fix the issue. Common patterns:
  - Missing `"use client"` on a component that uses hooks after editing
  - `className` applied to an element that doesn't accept it (use `style` instead)
  - Lucide icon name mismatch (check exact export names: `MessageSquare` not `MessageSquareIcon`)

- [ ] **Step 12.4 — Final commit**

  ```bash
  cd /home/zach/hive && git add -A && git commit -m "design: verify build passes — Hive app UI redesign complete"
  ```

---

## Appendix: File-to-Task Quick Reference

| File | Task |
|------|------|
| `frontend/src/app/layout.tsx` | Task 1 |
| `frontend/tailwind.config.ts` | Task 1 |
| `frontend/src/app/globals.css` | Task 2 |
| `frontend/src/components/Sidebar.tsx` | Task 3 |
| `frontend/src/app/(app)/layout.tsx` | Task 4 |
| `frontend/src/components/PageHero.tsx` | Task 4 |
| `frontend/src/components/GlassCard.tsx` | Task 4 |
| `frontend/src/components/AnimatedBar.tsx` | Task 4 |
| `frontend/src/components/ChartTooltip.tsx` | Task 4 |
| `frontend/src/components/MobileNav.tsx` | Task 4 |
| `frontend/src/components/AnimatedNumber.tsx` | Task 4 (new file) |
| `frontend/src/app/(app)/dashboard/page.tsx` | Task 5 |
| `frontend/src/app/(app)/transactions/page.tsx` | Task 6 |
| `frontend/src/app/(app)/budgets/page.tsx` | Task 6 |
| `frontend/src/app/(app)/bills/page.tsx` | Task 7 |
| `frontend/src/app/(app)/cash-flow/page.tsx` | Task 7 |
| `frontend/src/app/(app)/income/page.tsx` | Task 7 |
| `frontend/src/app/(app)/position/page.tsx` | Task 7 |
| `frontend/src/app/(app)/net-worth/page.tsx` | Task 8 |
| `frontend/src/app/(app)/points/page.tsx` | Task 8 |
| `frontend/src/app/(app)/optimize/page.tsx` | Task 8 |
| `frontend/src/app/(app)/goals/page.tsx` | Task 9 |
| `frontend/src/app/(app)/debt/page.tsx` | Task 9 |
| `frontend/src/app/(app)/plan/page.tsx` | Task 9 |
| `frontend/src/app/(app)/subscriptions/page.tsx` | Task 9 |
| `frontend/src/app/(app)/anomalies/page.tsx` | Task 10 |
| `frontend/src/app/(app)/insights/page.tsx` | Task 10 |
| `frontend/src/app/(app)/reports/page.tsx` | Task 10 |
| `frontend/src/app/(app)/merchants/page.tsx` | Task 10 |
| `frontend/src/app/(app)/chat/page.tsx` | Task 10 |
| `frontend/src/app/(app)/connect/page.tsx` | Task 11 |
| `frontend/src/app/(app)/account/page.tsx` | Task 11 |
| `frontend/src/app/(app)/security/page.tsx` | Task 11 |
| `frontend/src/app/(app)/settings/page.tsx` | Task 11 |
| `frontend/src/app/(app)/rules/page.tsx` | Task 11 |
| `frontend/src/app/(app)/review/page.tsx` | Task 11 |

---

I'm operating in read-only planning mode and cannot write files directly. The complete plan content is above — copy it to `/home/zach/hive/docs/superpowers/plans/2026-05-02-app-ui-redesign.md`.

### Critical Files for Implementation

- `/home/zach/hive/frontend/tailwind.config.ts`
- `/home/zach/hive/frontend/src/app/globals.css`
- `/home/zach/hive/frontend/src/components/Sidebar.tsx`
- `/home/zach/hive/frontend/src/components/PageHero.tsx`
- `/home/zach/hive/frontend/src/app/(app)/layout.tsx`
