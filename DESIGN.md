---
name: HIVE
description: Precision instrument, warmly lit — a dark, exact personal-finance terminal for iOS and web.
colors:
  base: "#13151A"
  surface: "#1A1D24"
  elevated: "#1F2229"
  overlay: "#252830"
  honey: "#C9920E"
  honey-bright: "#F5B942"
  blue: "#3B82F6"
  blue-hover: "#2563EB"
  ink-primary: "#F0F2F5"
  ink-secondary: "#9CA3AF"
  ink-tertiary: "#6B7280"
  ink-ghost: "#4B5563"
  income: "#22C55E"
  expense: "#EF4444"
  warning: "#F59E0B"
  info: "#3B82F6"
  border-default: "#2A2D35"
  border-subtle: "#22252E"
  border-strong: "#3A3E4A"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "2.3125rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "normal"
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.08em"
  mono:
    fontFamily: "Geist Mono, JetBrains Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
    fontFeature: "tnum"
rounded:
  sm: "7px"
  md: "9px"
  lg: "10px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-rewards:
    backgroundColor: "{colors.honey-bright}"
    textColor: "#0B0C0F"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "rgba(255,255,255,0.05)"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "7px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-tertiary}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  card:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-rewards:
    backgroundColor: "{colors.overlay}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-hero:
    backgroundColor: "{colors.overlay}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.xl}"
    padding: "16px"
  input:
    backgroundColor: "rgba(255,255,255,0.05)"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: HIVE

## 1. Overview

**Creative North Star: "The Warmly-Lit Instrument"**

HIVE looks like a well-made financial terminal seen in a dark room: an OLED-black field, exact monospaced figures, and a single warm light — honey gold — that switches on only when there is something genuinely rewarding to show. It is a *product* surface, not a brand surface: the design serves the operator's task and then disappears. Density is welcome; the operator would rather see six real card balances than one smoothed summary. The aesthetic philosophy is comprehension-first — "fastest to read, impossible to misread" — and identity is carried entirely by accent discipline, typography, and the data itself.

The system explicitly rejects the generic AI-dashboard look: Inter everywhere, cyan-on-black neon, a card wrapped around every group, glassmorphism, gradient or glowing text, and an identical hero-metric template cloned onto every screen. It also rejects consumer-fintech gamification — no confetti, no celebratory color spray. Reward color means a reward.

This is a shared responsive codebase wrapped for iOS via Capacitor. The visual system must read from iPhone SE width up to Dynamic-Island devices and on desktop web, without forking.

**Key Characteristics:**
- OLED-dark surfaces layered by tone, not shadow (base → surface → elevated → overlay).
- Two-color discipline: blue means interactive, honey means rewards. Nothing else earns an accent.
- All money is monospaced, tabular, decimal-aligned.
- Restrained by default; one dominant element per screen.
- Fixed rem type scale on a 3:4 ratio — figures never reflow-jitter across device widths.

## 2. Colors

A near-black, slightly cool dark field with two functional accents and a tightly governed neutral ink ramp.

### Primary
- **Interactive Blue** (#3B82F6, hover #2563EB): The single interactive signal. Primary buttons, links, current selection, focus rings, the `info` semantic. **If it is blue, it does something.** Used on a minority of any screen.

### Secondary
- **Reward Honey** (#F5B942 bright, #C9920E deep): The single warm signal, reserved exclusively for rewards — points earned, redemption nudges, the rewards card, the rewards CTA on the points/optimize screens. Never a generic accent, never a default CTA color.

### Tertiary (semantic, never decorative)
- **Income Green** (#22C55E): Positive money direction. Always paired with a `+` or arrow.
- **Expense Red** (#EF4444): Negative money direction / destructive intent. Always paired with a `−`, arrow, or label.
- **Warning Amber** (#F59E0B): Caution states. Distinct from reward honey by role, not just hue — never use honey for warnings or amber for rewards.

### Neutral
- **Base** (#13151A): App background / page field.
- **Surface** (#1A1D24): Section and panel backgrounds one step up from base.
- **Elevated** (#1F2229): Default card background (`.hive-card`).
- **Overlay** (#252830): Hover state, featured/hero/rewards cards, sheets and popovers.
- **Ink Primary** (#F0F2F5): Default text, all figures and amounts.
- **Ink Secondary** (#9CA3AF): Secondary text, labels, meta. Audited ≥4.5:1 on all four surfaces (7.1 / 6.6 / 6.3 / 5.7) — safe for body.
- **Ink Tertiary** (#6B7280): Large-text / non-essential only. **Fails 4.5:1 on every surface** (3.85 / 3.55 / 3.40 / 3.10).
- **Ink Ghost** (#4B5563): Structural / decorative only — never text.
- **Borders** (#2A2D35 default, #22252E subtle, #3A3E4A strong): Hairline separation only.

### Named Rules
**The Two-Signal Rule.** Exactly two colors carry meaning: blue = interactive, honey = rewards. Any blue that isn't clickable, or any honey that isn't a reward, is a bug.

**The Tertiary-Text Ceiling.** Ink Tertiary (#6B7280) is forbidden for any figure, amount, or decision-critical text — it fails 4.5:1 everywhere. Confine it to timestamps, disabled hints, and icons paired with a label, and never place it on the `overlay` surface (3.10).

**The Direction-Plus-Color Rule.** Money direction and semantic state are never conveyed by color alone. Green/red always ride with a sign, arrow, or label.

## 3. Typography

**Display / Body Font:** Plus Jakarta Sans (with system-ui, sans-serif). One family carries headings, labels, buttons, and prose — product UI does not need a display pairing.
**Mono Font:** Geist Mono (with JetBrains Mono, ui-monospace) — every figure, amount, date, and points value.

**Character:** Plus Jakarta Sans is a warm humanist sans — friendlier than Inter without being soft, which keeps the dark field from feeling clinical. The mono carries all numerics so columns of money align and scan as data, not prose.

### Hierarchy

Fixed **rem** scale on a **3:4 (×1.333) ratio**, root 16px. Not fluid `clamp()` — product figures must not jitter across device widths. Skip steps for hierarchy: adjacent *used* sizes should differ by ≥25–30%.

- **Display** (600, 2.3125rem / 37px, line-height 1.1): The single hero metric on a screen (net worth, total balance). Max one per screen.
- **Headline** (600, 1.75rem / 28px, 1.2): Screen heading.
- **Title** (600, 1.3125rem / 21px, 1.3): Card title, section header.
- **Body** (400, 1rem / 16px, 1.4): Default text and primary figures. Prose capped at 65–75ch; dense tables may run denser.
- **Caption** (500, 0.75rem / 12px, 1.35): Secondary / meta / dense table cells.
- **Label** (500, 0.6875rem / 11px, letter-spacing 0.08em, UPPERCASE): The `.hive-label` caption.
- **Mono** (500, tabular-nums): All figures. Right-aligned and decimal-aligned in columns.

Off-ladder exceptions, used sparingly: **14px / 0.875rem** for very dense tables, **50px / 3.125rem** for a rare full-screen display number.

### Named Rules
**The Tabular-Money Rule.** Every monetary figure, points value, and date uses the mono family with `font-variant-numeric: tabular-nums`. Columns align on the decimal. No exceptions.

**The No-Inter Rule.** Body is Plus Jakarta Sans; figures are mono. Inter-everywhere is a generated-UI tell and is prohibited as a body face here.

## 4. Elevation

HIVE is **flat — depth comes from tonal layering, not shadows.** The four neutral surfaces *are* the z-axis: base (background) → surface (panels) → elevated (cards) → overlay (hover, hero/rewards cards, sheets, popovers). A card "lifts" on hover by stepping its background from elevated (#1F2229) to overlay (#252830) and its border from default (#2A2D35) to strong (#3A3E4A) — not by casting a shadow.

The only non-flat treatments are: the focus ring (a 3px blue glow, `0 0 0 3px rgba(59,130,246,0.08)`), and the subtle radial **page-hero glow** at the top edge of a page (`.glow-*`, ~14% opacity, fading to transparent). These are functional (focus feedback; page identity), not ambient decoration.

### Named Rules
**The Tonal-Depth Rule.** Convey elevation by stepping the surface token, never by adding a drop shadow. If a component needs to feel raised, move it up the base→surface→elevated→overlay ladder.

**The Glow-Is-Earned Rule.** Glow exists only for focus feedback and the single top-edge page-hero wash. No glowing text, no glow on resting cards, no neon edges.

## 5. Components

### Buttons
- **Shape:** Gently rounded (10px primary, 8–9px secondary/ghost, 7px rewards).
- **Primary:** Interactive Blue (#3B82F6) on white text, 13px/600, padding 8px 16px. Hover #2563EB, active #1D4ED8, disabled 0.5 opacity. The default action everywhere except rewards surfaces.
- **Rewards:** Honey (#F5B942) on near-black ink (#0B0C0F), 7px radius. **Only** on points/optimize/reward CTAs — never a generic primary substitute.
- **Secondary:** Translucent white fill (rgba 255,255,255,0.05), strong border, ink-secondary text; hover lifts to overlay surface + ink-primary.
- **Ghost:** Transparent, ink-tertiary text, for low-emphasis actions.
- **Danger:** Muted red fill + border (rgba 224,85,85,...), for destructive intent only.

### Cards / Containers
- **Corner Style:** 10px default (`.hive-card`), 12px for featured/hero.
- **Background:** Elevated (#1F2229) at rest; overlay (#252830) on hover and for featured/hero/rewards cards.
- **Shadow Strategy:** None — see Elevation. Depth is the surface step + border step.
- **Border:** 1px. Default #2A2D35; hero cards take a blue-tinted border (rgba 59,130,246,0.20); rewards cards take a honey-tinted border (rgba 245,185,66,0.18).
- **Internal Padding:** 16px (scale `lg`).
- **The card is not the default container.** Use white space and alignment to group; reserve an elevated card for a genuinely distinct object.

### Inputs / Fields
- **Style:** Translucent white fill, 1px strong border (#3A3E4A), 9px radius, 13px ink-primary text. Placeholder uses ink-tertiary.
- **Focus:** Border shifts to blue-border, fill brightens slightly, 3px blue glow ring (`box-shadow: 0 0 0 3px rgba(59,130,246,0.08)`). Blue focus = the interactive signal.
- **Select:** Same field treatment, custom chevron, options drawn on the overlay surface.

### Navigation
- **Web:** Sidebar. **iOS:** bottom tab bar — Home · Money · Plan · Insights · Connect — with 44pt minimum targets, honoring safe areas. Active state is a filled/elevated pill, not a left-edge stripe. Labels use the uppercase Label style.

### Motion
- Transitions are **150ms ease** for state (background, border, color); entrance is a 120ms `fadeUp` on `cubic-bezier(0.16, 1, 0.3, 1)` (quick ease-out, no overshoot). Staggered list reveals step at 50ms. Nothing exceeds ~300ms; no bounce or spring. Respect `prefers-reduced-motion`.

## 6. Do's and Don'ts

### Do:
- **Do** keep blue strictly interactive and honey strictly rewards — the Two-Signal Rule. Any blue that isn't clickable or honey that isn't a reward is a bug.
- **Do** render every amount, points value, and date in Geist/JetBrains Mono with `tabular-nums`, decimal-aligned in columns.
- **Do** build hierarchy in order: white space → weight → size → color → ornament. Reach for a border or glow only after the first four fail.
- **Do** convey depth by stepping the surface token (base → surface → elevated → overlay); lift a card on hover by changing its background, not by adding a shadow.
- **Do** give every screen one dominant element — usually the hero metric or the single decision the screen exists for.
- **Do** keep money direction and state legible without color: pair green/red with a sign, arrow, or label.
- **Do** use Ink Secondary (#9CA3AF) for secondary text on any surface; it passes 4.5:1 everywhere.
- **Do** meet 44pt touch targets, safe areas, and Dynamic Type from iPhone SE to Dynamic-Island widths — responsively, never as a fork of the web app.

### Don't:
- **Don't** use Inter as a body face, or cyan/neon as an accent — both are generated-UI tells. Honey is the only warm accent, and it's rewards-only.
- **Don't** wrap every group in a card. The card is not the default container; use white space and alignment.
- **Don't** use glassmorphism or decorative blur, and don't proliferate `.glass-card` on iOS — surfaces are flat OLED tones.
- **Don't** use gradient text or glowing text. Glow is reserved for focus rings and the single top-edge page-hero wash.
- **Don't** use a colored `border-left` stripe (>1px) to denote category or status.
- **Don't** use bounce or springy easing; motion is quick ease-out, ≤300ms, and honors reduced-motion.
- **Don't** clone one hero-metric template (giant number + tiny gray label + green % arrow) onto every screen — one earned hero per screen.
- **Don't** put Ink Tertiary (#6B7280) on a figure, amount, or decision-critical text — it fails 4.5:1 on every surface — and never place it on the overlay surface.
- **Don't** justify a choice as "clean / modern / sleek." The only rationale is "fastest to read, impossible to misread."
