# Product

## Register

product

## Users

One persona — **"the operator."** A power-user who manages real money across 6 credit cards, 2 bank accounts, and a brokerage, all linked into HIVE. They open the app multiple times a day, frequently at a point of decision: which card to swipe at checkout, whether a budget is blown, whether a charge cleared, how many points a purchase will earn. Their context is a phone, often one-handed, often mid-task in the physical world.

They want speed, exact figures, and zero ambiguity about what is interactive versus informational. They tolerate density — they would rather see the real numbers than a simplified summary — and they resent chrome, hand-holding, and anything that slows the read.

## Product Purpose

HIVE is a self-hosted personal-finance intelligence platform: it syncs transactions from Plaid and investments from SnapTrade, categorizes spending with an AI pipeline, tracks credit-card points and the best card for any purchase, manages budgets, charts net worth, flags anomalies, and answers natural-language finance questions. It now ships to iOS via Capacitor (a hybrid WebView wrapping the existing Next.js app) at full feature parity across ~33 screens.

Success: the operator reads their money state and makes a money decision **in seconds, on a phone, without losing trust.** Every pixel serves comprehension speed and precision. Trust is the product — a figure that is wrong, or merely looks uncertain, is worse than no figure at all.

## Brand Personality

**Precision instrument, warmly lit.** The reference object is a well-made financial terminal or a mechanical gauge cluster: dark, exact, quietly confident. Identity is carried by accent, typography, and the data itself — never by ornament. One warm signal (honey/gold) is reserved for the single thing that is genuinely rewarding: points. Everything else is restrained on purpose.

Three words: **precise, trustworthy, quiet.** The voice is the voice of a good instrument — it tells you exactly what's true and gets out of the way.

## Anti-references

- **Generic "AI-generated dashboard."** Inter everywhere, cyan-on-black neon accents, a card around every group, glassmorphism blur, gradient or glowing text, springy bounce animations, an identical hero-metric template (giant number + tiny gray label + green up-arrow %) cloned onto every screen.
- **"Clean / modern / sleek" as an end in itself.** Those are non-answers. The rationale is always "fastest to read, impossible to misread."
- **Consumer fintech gamification.** No confetti, no mascot, no celebratory color sprayed across the UI. Reward color means a reward, not decoration.
- **Color as the only signal.** Money direction conveyed by red/green alone (fails ~8% of male users and is risky for money).

## Design Principles

- **Fastest to read, impossible to misread.** Comprehension speed is the success metric. When a choice trades elegance for legibility, legibility wins.
- **Color carries meaning, not mood.** Blue = interactive (and only interactive); honey/gold = rewards (and only rewards). Any blue that isn't clickable, or any honey that isn't a reward, is a bug.
- **Earn every mark.** White space → weight → size → color → ornament, in that order. Reach for a border or a glow only after the first four have failed. They rarely do.
- **One dominant element per screen.** Each screen exists for one decision or one number; that element dominates and everything else recedes.
- **Density is a feature, served precisely.** The operator wants the real numbers. Money is always tabular, monospaced, and decimal-aligned so columns can be scanned, not read.

## Accessibility & Inclusion

- **WCAG 2.1 AA** target. Body text ≥4.5:1 against its surface; large text ≥3:1. Contrast was audited against all four dark surfaces — `secondary #9CA3AF` passes everywhere; `tertiary #6B7280` does not and is restricted to large/non-essential text only (see DESIGN.md).
- **Never color-alone.** Income/expense and all semantic states pair color with a sign (+/−), arrow, icon, or label.
- **iOS touch & comfort:** 44pt minimum touch targets; honors safe areas; respects `prefers-reduced-motion`; supports Dynamic Type from iPhone SE width up to Dynamic-Island devices.
- **Shared codebase:** HIVE is one responsive web app wrapped for iOS — every mobile change must hold up on desktop web too. Adapt responsively; never fork.
