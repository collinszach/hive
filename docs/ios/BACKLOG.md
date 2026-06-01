# HIVE iOS — Epic Backlog

> ⚠️ **SUPERSEDED (2026-06-01).** This is the original **Capacitor-hybrid** plan. The project
> pivoted to a **native SwiftUI app** (`ios/HIVE/`, XcodeGen, iOS 17). The live, tracked backlog
> with current status is **`docs/ios/FEATURE-SPEC.md`**. Keep this file only for historical
> context on the epic structure / DoD phrasing — do not track work against it.

> Companion to `IOS-BUILD-SPEC.md`. Epics are ordered by dependency. Each lists goal, key stories, and a definition of done (DoD). Sizing: S < 1d, M 1–3d, L 3–5d, XL 1wk+.

**Suggested release cut:**
- **MVP (App Store v1):** Epics 1–7, 11 (parity + native shell + auth lock + push + store readiness).
- **Fast-follow:** Epics 8–10, 12.

---

## Epic 0 — Project foundations & decisions `S`
Lock the architecture and answer the §9 open questions before building.
- Confirm Capacitor-hybrid approach and bundled-vs-remote asset loading.
- Confirm push scope, min device, gold-usage policy.
- Stand up TestFlight, App Store Connect app record, signing/provisioning.
**DoD:** decisions recorded in spec; App Store Connect record exists; CI can produce a signed build.

## Epic 1 — Design foundation (impeccable init) `M`
Generate the canonical design context so every screen builds against one contract.
- Run `/impeccable init` → root `PRODUCT.md` (register=product, users, anti-references) + `DESIGN.md` from existing tokens.
- Finalize `docs/ios/DESIGN-MOBILE.md` as the mobile contract (tabs, sheets, safe areas, states).
- Define native token extensions (true-black OLED surfaces, safe-area spacing scale).
**DoD:** PRODUCT.md + DESIGN.md committed; mobile contract approved; tokens in `globals.css` extended without regressions.

## Epic 2 — Mobile-readiness audit of all 33 screens `L`
Know exactly what each screen needs before redesigning.
- Run `hive-ios-screen-auditor` agent across every route in `(app)/` and `(marketing)/`.
- Produce a per-screen punch list: fixed widths, hover-only actions, desktop tables, missing safe-area, sub-44pt targets, modal usage.
- Triage into "reflow only" vs. "redesign" buckets.
**DoD:** `docs/ios/AUDIT.md` with a row per screen, severity, and adaptation note; backlog tickets generated for redesigns.

## Epic 3 — Build & bundle pipeline `M`
Make the web app shippable as a native binary.
- Configure Next 15 for static/Capacitor-targeted output; resolve any server-only route assumptions.
- Switch `capacitor.config.ts` to bundled assets; API stays remote.
- `npx cap sync ios` wired into build; verify cold launch loads bundled shell offline.
**DoD:** archived build runs with no network on first paint; API calls succeed against remote; no white launch flash.

## Epic 4 — Native shell & chrome `M`
The platform-feel baseline that every screen inherits.
- Add status-bar, splash-screen, keyboard, haptics plugins; theme to base bg.
- Implement safe-area handling globally; branded splash + app icon set (all sizes).
- Bottom tab bar (Home·Money·Plan·Insights·Connect) replacing sidebar on mobile; large-title collapsing headers.
**DoD:** app launches branded, no notch/home-indicator collisions, tabs navigate, keyboard doesn't cover inputs.

## Epic 5 — Navigation, deep links & OAuth round-trips `L`
De-risk the hardest native interaction: OAuth round-trips. **Google sign-in is the first and most critical** — without it the app can't authenticate at all (Google blocks OAuth in the WebView; see spec §1 auth blocker).
- **Google sign-in via system browser:** `@capacitor/browser` (ASWebAuthenticationSession) → backend `auth_google.py` callback sets `hive_auth` → return to app via custom URL scheme / Universal Link caught by `@capacitor/app`. Register the iOS OAuth client ID + redirect URI in Google Cloud Console and backend.
- `@capacitor/app` deep-link handling; verify **Plaid Link** OAuth returns to app.
- Verify **SnapTrade** connect/callback returns to app (not Safari).
- Push-navigation for cross-section jumps (insight→transaction, alert→budget); back affordance; search entry replacing Cmd+K.
**DoD:** a logged-out user signs in with Google in the system browser and lands back in the app authenticated; then connects a bank via Plaid and an investment account via SnapTrade entirely in-app and lands back on `/connect` with accounts added.

## Epic 6 — Auth, biometric lock & app security `M`
Auth is **Google-OAuth-only** (the system-browser sign-in flow lands in Epic 5); this epic adds the on-device protection around that session.
- Face ID / passcode lock on cold start + background timeout (locks the *existing* session — not a substitute for Google login); sensitive screens blur in app switcher.
- TOTP/2FA flows verified on device; `hive_auth` cookie persistence across launches; sign-out clears it.
- Account-deletion path surfaced (Apple requirement).
**DoD:** after Google sign-in (Epic 5), app locks/unlocks with Face ID; session survives relaunch; sign-out + re-login works; deletion path reachable.

## Epic 7 — Push notifications `L`
- APNs setup, entitlement, `@capacitor/push-notifications`; device-token registration to backend.
- Backend triggers for chosen v1 events (bills due, anomalies, reward thresholds, insights — per Epic 0).
- Tap-to-deep-link into the relevant screen; permission priming UX.
**DoD:** a bill-due push arrives and opens `/bills`; user can manage permission in `/settings`.

## Epic 8 — Screen redesigns: Money & Insights (data-dense) `XL`
The screens most hostile to small viewports.
- `/transactions`, `/reports`, `/merchants`, `/cash-flow`: tables→stacked rows, filters→sheets, swipe/long-press actions, touch-friendly charts.
- `/insights`, `/anomalies`, `/review`, `/chat`: feed + sheet detail; chat keyboard-aware.
- Each screen run through `/hive-ios` → `/impeccable craft`.
**DoD:** every listed screen passes the audit; verified on iPhone SE + Dynamic-Island device.

## Epic 9 — Screen redesigns: Home, Plan & Rewards `L`
- `/dashboard` single-column priority stack (safe-to-spend→alerts→insights→balances).
- `/budgets`, `/goals`, `/net-worth`, `/plan`, `/position`, `/points`, `/optimize`: mobile layouts, native sheets for create/edit, haptic commits.
**DoD:** all screens pass audit + impeccable product-register checks; charts reflow; states (skeleton/empty/error) present.

## Epic 10 — Polish, motion & micro-interactions `M`
- Pull-to-refresh everywhere; row-commit transitions; sheet motion 150–250ms; reduced-motion alternatives.
- Empty states that teach; skeletons replace spinners app-wide.
- Tabular-nums + contrast pass on every money figure.
**DoD:** motion audit passes; no spinner-in-content; contrast ≥4.5:1 verified.

## Epic 11 — App Store readiness `M`
- Privacy nutrition labels (Plaid/SnapTrade/financial data), usage strings, screenshots per device class, App Privacy & data-use disclosures.
- TestFlight internal→external beta; crash/analytics; phased release plan.
**DoD:** build passes App Store review checklist; beta live on TestFlight.

## Epic 12 — Accessibility & QA hardening `M`
- Dynamic Type, VoiceOver labels on icon-only controls, focus order, 44pt audit.
- Device matrix pass; Vitest green; regression sweep on web (shared codebase).
**DoD:** VoiceOver can complete core flows (view dashboard, categorize a txn, create a budget); a11y audit clean.

---

## Dependency graph (high level)
```
0 → 1 → 2 ┐
0 → 3 → 4 → 5 → 6 → 7 → 11 (MVP)
1,2 ─────→ 8, 9 → 10 → 12 (fast-follow / hardening)
```
