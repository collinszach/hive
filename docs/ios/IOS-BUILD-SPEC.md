# HIVE iOS Build — Technical & Design Specification

> Status: Draft v1 · Owner: Zach Collins · Last updated: 2026-05-30
> Goal: ship HIVE to the App Store with **full feature parity** to the web app and a **native-quality**, modern, professional experience.

---

## 1. Summary & recommendation

HIVE today is a Next.js 15 / React 18 web app (33 screens, ~30 REST endpoints, **Google-OAuth-only** auth with a `hive_auth` httpOnly session cookie) with an existing Capacitor 8.3.1 iOS scaffold that loads the live site (`https://hive.zacharyjcollins.com`) in a WebView. There are no native plugins yet — it is a thin browser wrapper.

> **Auth blocker — read before Epic 5/6.** Sign-in is Google OAuth only (password login/register return 403). **Google refuses OAuth inside embedded WebViews** (`disallowed_useragent`), which is exactly what Capacitor's WebView is. So the one thing the current thin wrapper *cannot* do is log in. First-launch login must run in the **system browser** (ASWebAuthenticationSession via `@capacitor/browser`, or the native Google Sign-In SDK) and return to the app through a custom URL scheme / Universal Link; the backend then sets the `hive_auth` cookie on the WebView's session. The cookie session itself works fine in the WebView once established — it's only the *Google consent step* that must leave the WebView. This is the single highest-risk item in the build.

**Recommended architecture: Capacitor hybrid, not a SwiftUI rewrite.**

| Approach | Parity effort | Native feel | Maintenance | Verdict |
|---|---|---|---|---|
| **A. Capacitor hybrid (recommended)** | Near-zero — reuses 100% of the web app | High, once mobile UX + native plugins land | Single codebase | ✅ Default |
| B. Full SwiftUI native | Re-implement all 33 screens + 30 endpoints | Highest | Two codebases forever | ❌ Duplicative; impeccable is a web design skill anyway |
| C. React Native rewrite | Re-implement everything | High | Second codebase | ❌ Throws away working product |

**Why A.** Every feature already exists and is maintained in one place. The work is not "rebuild," it is "make the existing web UI feel native on iOS and wrap it in the platform capabilities users expect." That means: a genuinely mobile-first responsive layer (bottom tabs, sheets, safe areas, momentum, large titles), native plugins (Face ID lock, push, haptics, native share, status bar, splash), and App Store readiness. The [impeccable](https://github.com/) design skill operates on exactly this web layer.

**One deliberate trade-off to confirm:** bundled assets vs. remote URL. Today the WebView loads the remote site. Recommendation below (§4) is to **bundle the built web app into the binary** for cold-start speed, offline shell, and App Store review predictability, while keeping the API remote. This is a reversible config change.

---

## 2. Scope — feature parity matrix

Every web screen ships on iOS. Grouped by the native information architecture (§5), not the desktop sidebar order.

**Auth & onboarding:** `/login` (**Google OAuth only** — `/register` and password login are deprecated/return 403), `/security` (TOTP/2FA), `/account`, `/billing`, `/subscribe`
**Home tab:** `/dashboard` (safe-to-spend, health score, pace alerts, weekly comparison, insights feed)
**Money tab:** `/transactions`, `/income`, `/bills`, `/subscriptions`, `/cash-flow`, `/merchants`, `/rules`
**Plan tab:** `/budgets`, `/goals`, `/debt`, `/plan`, `/position`, `/net-worth`
**Insights tab:** `/reports`, `/insights`, `/review`, `/anomalies`, `/chat` (AI assistant)
**Rewards (within Plan or Home):** `/points`, `/optimize`
**Connect/settings:** `/connect` (Plaid + SnapTrade + manual), `/settings`

Integrations preserved as-is: **Plaid** (account/txn sync via `react-plaid-link`), **SnapTrade** (investments OAuth), **Claude** (chat), **Stripe** (billing). The `hive_auth` httpOnly session cookie is preserved and works inside the WebView once set — but **acquiring it requires a system-browser Google OAuth round-trip** (see the auth blocker in §1 and §4), because Google rejects OAuth in embedded WebViews.

Nothing is dropped. Where a desktop pattern doesn't fit a phone (dense tables, hover menus, command palette), §6 + the screen audit (Epic 2) define the mobile equivalent.

---

## 3. Design system — mobile (impeccable, product register)

The web app's tokens are the source of truth; we extend them for native, we do not reinvent them. Register = **product** (design serves the task). Floor = **Restrained**. Brand identity carried by accent + typography + data, not decoration.

### 3.1 Tokens (from `frontend/src/app/globals.css`)
- **Surfaces (OLED-tuned dark):** base `#13151A` → consider `#0A0C10` for true-black tab bar/headers on OLED. Surface `#1A1D24`, elevated `#1F2229`, overlay `#252830`.
- **Primary interactive:** blue `#3B82F6` (actions, selection, focus). **Gold `#F5B942` is rewards-only** — do not use it as a generic accent.
- **Text ramp:** primary `#F0F2F5`, secondary `#9CA3AF`, tertiary `#6B7280`. Verify ≥4.5:1 for body on each surface; bump toward primary if close (impeccable: light-gray-for-elegance is the #1 readability failure).
- **Semantic:** income `#22C55E`, expense `#EF4444`, warning `#F59E0B`, info `#3B82F6`.
- **Type:** Inter (UI) + JetBrains Mono (figures/amounts/dates). Fixed rem scale (1.125–1.2 ratio), **not** fluid clamp — product UI views at consistent DPI. Tabular-nums on all money.

### 3.2 Native-feel rules (the part that makes it not-a-website)
- **Safe areas:** every screen respects `env(safe-area-inset-*)`. Bottom tab bar sits above the home indicator; headers clear the notch/Dynamic Island.
- **Navigation:** bottom tab bar, max 5 tabs (Home · Money · Plan · Insights · Connect). Large-title headers that collapse on scroll (iOS convention). Detail = native-style **sheet** (transactions, account detail), not a desktop drawer.
- **Touch targets ≥44×44pt.** No hover-only affordances — every hover menu becomes tap/long-press.
- **Momentum + pull-to-refresh** on every list/dashboard. `-webkit-overflow-scrolling: touch`, overscroll containment.
- **Haptics** on commit actions (categorize, settle, contribute, mark-read) via `@capacitor/haptics`.
- **Motion:** 150–250ms, conveys state only (sheet present, row commit, refresh). No page-load choreography. `prefers-reduced-motion` honored.
- **States:** every list has skeleton (not spinner), empty-that-teaches, and error. Tables reflow to stacked cards/rows below `md`.
- **Status bar + splash** themed to base bg; no white flash on launch.

### 3.3 Banned (impeccable absolute + product)
No side-stripe borders, no gradient text, no decorative glass, no hero-metric template clones, no display fonts in labels, no reinvented scrollbars/form controls, modal-as-first-thought. Earned familiarity over novelty — the tool disappears into the task.

> Execution note: the design system is set once with `design-for-ai` (proportions, type scale, hierarchy, color theory) + `/impeccable init` → root `PRODUCT.md` + `DESIGN.md` from the existing tokens (Epic 1). Per-screen work then runs through `/hive-ios <screen>`, which applies design-for-ai principles and hands off to `/impeccable craft` against this contract. See §8 for the two-plugin design stack and layering rule.

---

## 4. Native architecture & plugins

**Shell:** Capacitor 8.3.1, iOS 16.0 min, bundle `com.zacharyjcollins.hive`, name "Hive Finance".

**Asset loading (decision):** switch `capacitor.config.ts` from remote `server.url` to **bundled static export** of the Next.js app; API calls continue to hit `https://hive.zacharyjcollins.com/api`. Benefits: instant cold start, offline app shell, no blank screen if the tunnel hiccups, cleaner App Store review. Requires a static-friendly build path (Epic 3) — Next 15 app-router with `output: 'export'` or a Capacitor-targeted build.

**Plugins to add (best-practice baseline):**
| Plugin | Purpose | Epic |
|---|---|---|
| `@capacitor/status-bar` | Theme status bar to base bg | 4 |
| `@capacitor/splash-screen` | Branded launch, no white flash | 4 |
| `@capacitor/haptics` | Tactile feedback on commits | 4 |
| `@capacitor/keyboard` | Resize/scroll on input focus | 4 |
| `@capacitor/app` | Deep links (incl. OAuth return), back behavior, state | 5 |
| `@capacitor/browser` | **System-browser Google sign-in** (ASWebAuthenticationSession) — required because Google blocks OAuth in the WebView | 6 |
| `@capacitor/preferences` | Lightweight native storage | 5 |
| `@capacitor-community/biometric` (or native) | Face ID app-lock | 6 |
| `@capacitor/push-notifications` + APNs | Bills due, anomalies, insights, reward thresholds | 7 |
| `@capacitor/share` | Native share for reports/CSV export | 8 |

**Auth flow (Google-only):** first launch shows `/login`; tapping "Sign in with Google" opens the **system browser** via `@capacitor/browser` (ASWebAuthenticationSession), not the WebView — Google returns `disallowed_useragent` for embedded WebViews. Google redirects to the backend callback (`auth_google.py`), which sets the `hive_auth` httpOnly cookie and bounces back to the app via a registered custom URL scheme / Universal Link, caught by `@capacitor/app`. The WebView then loads authenticated. Requires a dedicated **iOS OAuth client ID** in Google Cloud Console and the redirect URI / URL scheme registered both there and in the backend. Native Google Sign-In SDK is an alternative that yields the same ASWebAuthenticationSession UX.

**Security:** Face ID / passcode lock on cold start and after background timeout (guards the *existing* session — it is not the login mechanism); sensitive screens (account numbers, balances) blur in the app switcher; cookie persists in the WebView keychain-backed store. No financial credentials handled in-app — Google owns auth, Plaid/SnapTrade own account linking.

**Plaid/SnapTrade on iOS:** `react-plaid-link` works in WebView; confirm OAuth redirect handling via `@capacitor/app` deep links (Plaid OAuth + SnapTrade callback must return to the app, not Safari). Same deep-link return path as Google sign-in — spiked together in Epic 5.

---

## 5. Information architecture (mobile)

```
Tab bar (5):
 ┌ Home      → dashboard: safe-to-spend, health, pace alerts, weekly, insights feed
 ┌ Money     → transactions (default) ↹ income · bills · subscriptions · cash-flow · merchants · rules
 ┌ Plan      → budgets (default) ↹ goals · debt · net-worth · position · plan · points · optimize
 ┌ Insights  → reports · review · anomalies · chat (AI)
 └ Connect   → accounts · Plaid · SnapTrade · manual · settings · account · security · billing
```
- Cross-section jumps (insight → transaction, alert → budget) use push navigation with a back affordance.
- Command palette (Cmd+K) is desktop-only; replace with a **search entry** in Money/Insights headers.
- FloatingChat → a single entry in the Insights tab + optional persistent mini-button (evaluate against clutter).

---

## 6. Desktop→mobile adaptation rules

Applied per screen during the audit (Epic 2):
- **Dense tables** (`/transactions`, `/reports`, `/merchants`) → stacked rows with primary line (merchant + amount) and secondary (date · category · account); filters move to a sheet.
- **Hover menus / row actions** → tap opens detail sheet; long-press for quick actions; swipe for the one destructive/primary action.
- **Multi-column dashboards** → single column, priority-ordered (safe-to-spend → alerts → insights → balances).
- **Recharts** → keep (touch-friendly), but enforce min tap targets on legends/tooltips and reflow width to viewport.
- **Fixed-width sidebar layouts** → bottom tabs; remove the 220px sidebar entirely on mobile (MobileNav already exists — extend it).
- **Modals** → iOS sheets with grabber; forms get the keyboard-aware scroll.

---

## 7. Best practices & quality gates

- **Accessibility:** Dynamic Type support, VoiceOver labels on icon-only buttons, ≥4.5:1 contrast, ≥44pt targets, reduced-motion.
- **Performance:** cold start < 2s to interactive (bundled assets), 60fps scroll, skeletons over spinners, image/asset budget.
- **Testing:** existing Vitest suite stays green; add a per-screen mobile-readiness audit (custom agent, §below); manual device pass on the smallest supported device (iPhone SE) and a Dynamic-Island device.
- **App Store:** privacy nutrition labels (financial data, Plaid/SnapTrade data use), account-deletion path (Apple requirement), no private APIs, `NSFaceIDUsageDescription` + push entitlement, screenshots per device class.
- **Release:** TestFlight internal → external beta → phased App Store release.

---

## 8. Tooling created for this project

### Design stack (two external plugins, installed once)
Per-screen design craft runs on two complementary Claude Code plugins — install both before Epic 1:
- **`design-for-ai`** (`ryanthedev/rtd-claude-inn` → `/plugin install design-for-ai@rtd`) — the **theory/vocabulary layer** (Design for Hackers): purpose, proportional + type-scale systems, composition, visual hierarchy, color theory, and an "ai-tells" checklist. Commands: `/design-for-ai`, `/design`, `/exam`, `/brand`, `/fonts`, `/color`, `/flow`, `/hone`. **Used to set the foundation (Epic 1) and as a review/critique lens** — not to drive each build.
- **`impeccable`** (`pbakaus/impeccable` → `/plugin install impeccable@impeccable`, or `npx impeccable skills install`) — the **production craft workflow**: `init → shape → craft → audit → polish → live`, product-vs-brand register, 27 deterministic anti-pattern rules, live browser iteration. **The per-screen build engine** (Epics 8/9). `/impeccable init` writes root `PRODUCT.md` + `DESIGN.md` (Epic 1).

Layering rule: design-for-ai owns the *system* (Epic 1 foundation) and serves as a *critique pass*; impeccable owns the *per-screen build*. They do not both drive the same build — see `/hive-ios` for the exact handoff.

### HIVE-specific tooling
- **Skill `/hive-ios`** (`.claude/skills/hive-ios/`) — orchestrates the mobile adaptation of one screen: loads this spec + the mobile design contract, runs the audit, applies design-for-ai principles, then hands off to `/impeccable craft`.
- **Skill `/hive-ios-audit-all`** — Epic 2 batch driver: fans `hive-ios-screen-auditor` over all routes → `docs/ios/AUDIT.md`.
- **Skill `/hive-ios-bundle`** — Epic 3: static-export + bundled-assets pipeline with offline cold-launch verify.
- **Skill `/hive-ios-release`** — Epic 11: App Store readiness checklist.
- **Agent `hive-ios-screen-auditor`** — read-only mobile-layout punch list per route (Epic 2).
- **Agent `hive-ios-a11y-auditor`** — read-only VoiceOver / Dynamic Type / focus / contrast audit per route (Epic 12).
- **Agent `hive-ios-oauth-deeplink-integrator`** — Epic 5: one OAuth round-trip (Google / Plaid / SnapTrade) wired across native + backend + JS.
- **Agent `capacitor-integrator`** — installs/wires one Capacitor plugin (Epics 4–7).

Impeccable's own asset agents (`impeccable-asset-producer`, `impeccable-manual-edit-applier`) ship with the plugin and are reused — we do not duplicate them.

---

## 9. Open questions for Zach

1. Bundled assets vs. keep remote-URL loading? (Recommend bundled.)
2. Is gold strictly rewards-only on mobile too, or do you want a warmer brand moment on Home? (Recommend keeping the discipline.)
3. Push notification scope for v1 — which events (bills due, anomalies, reward thresholds, insights)?
4. Minimum device: iPhone SE (small screen) in scope for v1, or 12-and-up only?
5. Google sign-in approach: `@capacitor/browser` + ASWebAuthenticationSession (reuses existing web OAuth flow, least backend change) vs. native Google Sign-In SDK (more native UX, more setup)? Either way needs a new **iOS OAuth client ID** + redirect URI / URL scheme registered in Google Cloud Console and the backend — who owns that config?

See `BACKLOG.md` for the epic breakdown and `DESIGN-MOBILE.md` for the full design contract.
