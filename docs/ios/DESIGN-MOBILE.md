# HIVE iOS — Mobile Design Contract

> The binding visual/interaction contract for the iOS build. Extends the web tokens in `frontend/src/app/globals.css`; does not replace them. Register: **product** (impeccable). Run `/impeccable craft <screen>` against this doc.

## Identity
Precision dark finance tool. Honey/gold is a **reward signal**, not a brand wash — blue carries interaction. The interface disappears into the task; trust comes from consistency, dense legibility, and correct money formatting, not decoration.

## Color (extends globals.css)
| Role | Token | Value | Notes |
|---|---|---|---|
| App base / OLED chrome | `--color-base` / true-black | `#13151A` / `#0A0C10` | true-black for tab bar + headers on OLED |
| Surface / elevated / overlay | existing | `#1A1D24` / `#1F2229` / `#252830` | sheets use elevated→overlay |
| Primary interactive | `--color-blue` | `#3B82F6` | actions, selection, focus rings |
| Rewards only | `--color-honey-bright` | `#F5B942` | points/optimize/thresholds — nowhere else |
| Income / expense | `--color-income` / `--color-expense` | `#22C55E` / `#EF4444` | always tabular-nums |
| Text ramp | ink primary/secondary/tertiary | `#F0F2F5` / `#9CA3AF` / `#6B7280` | body ≥4.5:1; bump up if close |

## Typography
- **Inter** for all UI; **JetBrains Mono** for amounts, dates, account masks, point balances (`font-variant-numeric: tabular-nums`).
- Fixed rem scale, ratio 1.125–1.2. No fluid clamp (product UI = consistent DPI).
- Support Dynamic Type; never hard-cap line-height so large accessibility sizes still read.

## Layout & navigation
- **Bottom tab bar**, 5 max: Home · Money · Plan · Insights · Connect. Sits above home indicator (`env(safe-area-inset-bottom)`).
- **Large-title headers** that collapse to compact on scroll. Header clears notch/Dynamic Island.
- **Single column** content; priority order top-down. No 220px sidebar on mobile (extend existing `MobileNav.tsx`).
- **Sheets** (grabber, drag-to-dismiss) for detail/create/edit — replace desktop drawers and modals.
- Dense tables → **stacked rows**: primary line (merchant + amount), secondary (date · category · account). Filters live in a sheet.

## Interaction
- Touch targets **≥44×44pt**. No hover-only affordances.
- Tap → detail sheet · long-press → quick actions · one swipe → primary/destructive action.
- **Pull-to-refresh** on every list and the dashboard.
- **Haptics** on commit (categorize, settle, contribute, mark-read) — light impact; success notification haptic on goal/threshold reached.
- Momentum scrolling + overscroll containment; no rubber-band on fixed chrome.

## States (every list/screen)
- **Loading:** skeletons matching final layout, never a centered spinner.
- **Empty:** teaches the next action (e.g. "Connect an account to see transactions" → CTA), never "nothing here."
- **Error:** inline, retryable; preserve entered data.

## Motion
- 150–250ms; conveys state only (sheet present/dismiss, row commit, refresh, tab change).
- Ease-out (quart/quint). No bounce/elastic. No page-load choreography.
- `@media (prefers-reduced-motion: reduce)` → crossfade/instant for every animation.

## Charts (Recharts, retained)
- Reflow to viewport width; legends/tooltips meet 44pt; touch (not hover) reveals values.
- Money axes tabular-nums; income/expense colors consistent with tokens.

## Native chrome
- Status bar themed to base; branded splash, no white flash; full app-icon set.
- Sensitive screens blur in the app switcher; Face ID gate on cold start + background timeout.

## Bans (impeccable absolute + product)
Side-stripe borders · gradient text · decorative glass · hero-metric template clones · display fonts in labels/data · reinvented scrollbars/form controls · modal-as-first-thought · gold used as generic accent.

## Acceptance per screen
1. Passes `hive-ios-screen-auditor` (no fixed widths, hover-only, sub-44pt, missing safe-area).
2. Skeleton + empty + error states present.
3. Contrast ≥4.5:1 on all body text; money is tabular-nums.
4. Verified on iPhone SE (smallest) and a Dynamic-Island device.
