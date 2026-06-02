# HIVE iOS (Native) — Remaining Feature Spec

> Source of truth for what's left to build in the **native Swift app** (not the old
> Capacitor plan in `BACKLOG.md`, which is superseded). Grounded in the app as it
> stands today and the backend API surface in `CLAUDE.md`.
>
> Sizing: **S** < 1d · **M** 1–3d · **L** 3–5d · **XL** 1wk+.
> Status legend: ✅ **done** · 🔲 **not started** · 🚧 **partial**. Last audited **2026-06-01**.

## Audit summary (2026-06-01)

Verified against the Swift source in `ios/HIVE/`. What's shipped vs. what's left:

| Item | Status | Native | Backend |
|---|---|---|---|
| 5-tab shell, Google auth (native SDK), Keychain JWT | ✅ | ✅ | ✅ |
| Home / Money / Insights / Connect tabs (see table below) | ✅ | ✅ | ✅ |
| In-app Plaid + SnapTrade linking | ✅ | ✅ | ✅ |
| 1.1 Budget create/edit/delete | ✅ | ✅ `BudgetEditorView` | ✅ |
| 2.4 Owed-to-you reimbursement overview | ✅ | ✅ `ReimbursementView` | ✅ `/api/shares/pending` |
| 1.2 Card Optimizer | ✅ | `CardOptimizerView` | ✅ `/api/points/optimize` |
| 1.3 Settings / Account / Security screen | ✅ | ✅ `SettingsView` (account, sign-out, delete, lock toggle) | ✅ `DELETE /api/auth/account` |
| 1.4 Biometric app-lock | ✅ | ✅ `LockState` + `LockScreenView` gating `RootView` | n/a |
| 2.1 AI Chat | ✅ | `ChatView` (Insights → Assistant) | ✅ `/api/chat` |
| 2.2 Push notifications | ✅ | code done | APNs endpoint + sender + triggers built; needs NUC `.env` + migration |
| 2.3 Spending forecast | 🔲 | — | ✅ `/api/forecast/{category}` |
| 3.1 StoreKit 2 IAP | 🔲 | — | ⚠️ receipt-validation endpoint **missing** |
| 3.2 App Store readiness | 🟡 | `PrivacyInfo.xcprivacy` + usage strings | — |
| Tier 4 polish (manual add, acct detail, redemption banner, search, a11y) | 🔲 | — | mostly backed |

**MVP-to-submit critical path that's still open:** 3.2 store readiness. (1.2 Optimizer ✅, 1.3 Settings + delete-account ✅, 1.4 Biometric lock ✅.)

## Where the app is today (✅ shipped)

5-tab shell — **Home · Money · Plan · Insights · Connect**:

| Tab | Built | Backed by |
|---|---|---|
| **Home** | Spend hero, top-categories chart, balances, anomaly nudge | `GET /api/dashboard/summary` |
| **Money** | Txn list, search, filters (account/pending/excluded), detail, manual categorize, category splits, notes, reimbursement shares, **"Owed to you" roll-up**, pull-to-sync | `/api/transactions*`, `/api/shares*` |
| **Plan** | **Budgets — create/edit/delete with live gauges** + Points (summary, thresholds) behind a segmented control | `/api/budgets`, `/api/points/*` |
| **Insights** | Net-worth trend chart, anomaly review queue, points-leakage report | `/api/net-worth/history`, `/api/anomalies`, `/api/points/*` |
| **Connect** | Net-worth hero, linked institutions, manual sync, in-app Plaid + SnapTrade linking, sign-out | `/api/accounts*`, `/api/plaid/*`, `/api/snaptrade/*` |

Auth is Google-OAuth-only; JWT in Keychain. `APIClient` actor + `LoadState` + `@Observable` MVVM is the established pattern every feature below should follow.

---

## Tier 1 — Core gaps that make the app feel incomplete

### 1.1 Budget create / edit / delete `M`  ·  P0  ·  ✅ DONE
Shipped in `Features/Plan/BudgetEditorView.swift` (`.sheet(item:)` from Plan; create picks an
un-budgeted category, edit fixes category + amount/rollover, swipe/confirm delete, haptic commit).
- **UX:** On Plan→Budgets, a per-category row with a progress gauge; tap → edit sheet (amount stepper/keypad); "+ Add budget" picks an un-budgeted category. Swipe-to-delete. Haptic commit.
- **Backend (exists):** `POST /api/budgets` (create/update), `GET /api/budgets`. Confirm a delete path (or set amount 0).
- **Native:** reuse `Card`/`GroupedCard`, `.sheet` editor mirroring `SplitEditorView`; optimistic update then reload; money in `.hiveMono` tabular.
- **DoD:** can create, change, and remove a monthly budget; gauge reflects live spend; survives relaunch.

### 1.2 Card Optimizer — "which card at checkout?" `M`  ·  P0  ·  ✅ DONE
A flagship differentiator, now surfaced natively. `CardOptimizerView` opens from a creditcard toolbar button on Plan → Points (rewards context, honey/gold allowed).
- **UX (built):** category + subcategory menus (from `Taxonomy`) and an amount field; auto-runs on open with a sensible default (Food & Drink / $100) and re-queries live on every change. Ranked rows: top pick in a `RewardsCard` with a honey "Best" badge, the rest in plain `Card`s, each showing points earned + `N× points` earn rate. Footnote: "Ranked by redemption value across programs."
- **Points-only:** per the rewards-page directive, results lead with points + earn rate; `dollarValue` is decoded but never rendered.
- **Backend (exists):** `GET /api/points/optimize?category=&subcategory=&amount=` → `OptimizerResponse{cards:[CardOption]}` (`is_best` flags the top pick).
- **Native files:** `Features/Plan/CardOptimizerView.swift`, `CardOptimizerViewModel.swift`; DTOs `OptimizerResponse`/`CardOption` in `PlanDTO.swift`; card names via `CardCatalog`.
- **DoD met:** picking a category/amount returns the ranked cards with correct earn math, best badged.

### 1.3 Settings / Account / Security `L`  ·  P0 (Apple-required)  ·  ✅ DONE
`SettingsView` reached via a gear in the Connect header (pushed screen). Sign-out moved here from the Connect footer.
- **UX (built):** Pushed Settings screen with sections:
  - **Account:** signed-in-as (username), role, last sign-in (from `GET /api/auth/me`); **Sign out** (confirm dialog); **Delete account** → typed-name confirmation sheet.
  - **Security:** Face ID / passcode app-lock toggle + re-lock timeout picker (wired to `LockState`, 1.4).
  - **About:** version/build from the bundle.
- **Backend (built):** `DELETE /api/auth/account` — FK-scoped wipe (accounts cascade to transactions/splits/shares/points/anomalies, plus Plaid links), best-effort SnapTrade revoke, clears the auth cookie. Typed `confirm_username` guard (Apple 5.1.1(v)).
- **DoD:** ✅ sign out, ✅ working delete-account flow that revokes server data, ✅ security toggle wired (1.4). App builds clean for the iOS Simulator.

### 1.4 Biometric app-lock `M`  ·  P0  ·  ✅ DONE
Financial data locks behind Face ID on cold start + background timeout. `NSFaceIDUsageDescription` added to `project.yml` info props; `LockState` gates `RootView`.
- **UX (built):** Cold launch (when enabled) and return-from-background past the timeout present `LockScreenView` requiring Face ID / Touch ID / passcode (`.deviceOwnerAuthentication`, auto-prompt + manual retry). An opaque `PrivacyCover` hides content whenever the scene is inactive (app-switcher snapshot). Guards the *existing* session — not a second sign-in.
- **Native (built):** `LocalAuthentication` via `BiometricAuth`; `LockState` (@Observable, injected at root) persists enabled + timeout in `UserDefaults`, handles `scenePhase`. Settings toggle requires a successful auth to enable; timeout picker (Immediately / 1 / 5 / 15 min).
- **DoD:** ✅ with lock on, app requires Face ID after backgrounding; ✅ failed/canceled auth keeps content hidden (lock stays up); ✅ toggle + timeout in Settings. Clean iOS Simulator build.

---

## Tier 2 — High-value intelligence features (backend already supports)

### 2.1 AI Chat — natural-language finance Q&A `L`  ·  P1  ·  ✅ DONE
The marquee "intelligence" feature, now native. `ChatView` is pushed from a prominent "Ask the assistant" banner at the top of Insights.
- **UX (built):** message bubbles (user = blue, assistant = surface, text-selectable), animated typing indicator while a reply is in flight, empty state with four starter-prompt chips, auto-scroll to the latest message, dismissible inline error banner.
- **Backend shape confirmed:** `POST /api/chat` is **single-response** (not streaming) → `{response, model_used}`; request `{message, conversation_history, use_claude}`. History (last turns) is sent each call.
- **Native:** keyboard-aware `safeAreaInset(edge:.bottom)` composer (vertical-growing `TextField`, 1–5 lines), `scrollDismissesKeyboard(.interactively)`, send button enabled only on non-empty/idle. Model menu toggles Local (Ollama, default) vs Claude (Pro). **PII discipline:** message bodies are never logged; the auth token is attached by `APIClient` from the Keychain and never enters chat content.
- **Error handling:** 402 → "Claude needs Pro, switch to Local"; 503 → "local AI offline"; else `APIError.userMessage`.
- **Native files:** `Features/Chat/ChatView.swift`, `ChatViewModel.swift`; DTOs in `ChatDTO.swift`.
- **Deferred:** tappable references that deep-link to a cited transaction/budget (backend returns prose only — no structured citations yet).
- **DoD met:** a question returns a grounded answer; the keyboard never covers the composer; the view auto-scrolls.

### 2.2 Push notifications `L`  ·  P1  ·  ✅ DONE (code) · ⚙️ needs APNs config on NUC
APNs token-auth push, end-to-end. v1 triggers wired: **anomaly flagged** (daily scan) and **weekly insight digest** (Mon 8 AM). No quiet hours.
- **Backend (built):**
  - `device_tokens` table + model + Alembic migration `t8u9v0w1x2y3` (token unique, per-user, sandbox flag, soft-deactivate).
  - `POST/DELETE /api/notifications/device-token` (`api/notifications.py`) — upserts/reactivates, deactivates on sign-out.
  - APNs sender `app/notifications/apns.py` (ES256 provider JWT via `python-jose`, httpx HTTP/2 — added `h2` to requirements; caches the provider token ~50 min; deactivates dead tokens on 410/BadDeviceToken).
  - Dispatch helpers `app/notifications/push.py` (`send_to_user`, `send_to_all`).
  - Triggers: `run_anomaly_scan` pushes when `flagged>0` (→ Insights); new `weekly_insight_digest` task surfaces the top fresh insight (beat: Mon 8 AM, → Insights).
  - Config in `config.py`: `apns_key_id/team_id/key_path/bundle_id/use_sandbox`. **.p8 is a secret — set these in `.env` on the NUC, never commit the key.**
- **Native (built):** APNs entitlement (`HIVE.entitlements`, `aps-environment`) + `remote-notification` background mode; `AppDelegate` (token + tap callbacks via `@UIApplicationDelegateAdaptor`); `PushManager` (permission, registration, token POST/DELETE, sandbox via `#if DEBUG`); `NotificationRouter` deep-links a tapped push to the right tab; Settings → Notifications priming card (not-determined / denied / authorized states).
- **DoD:** ✅ builds; anomaly + weekly pushes wired and deep-link to Insights; permission manageable in Settings. ⚙️ remaining: populate APNs `.env` on the NUC (Key ID `BBF7AWYK83`, Team `K28M38H7Y5`, key path), run the migration, and verify a real push on the plugged-in device.

### 2.3 Spending forecast `M`  ·  P2  ·  🔲 NOT STARTED
Prophet forecasts exist server-side (`/api/forecast/{category}` confirmed) and are unused on device.
- **UX:** On Insights (or a category detail), a "projected end-of-month / next-month" line on the spend chart with a confidence band; a plain-language nudge ("On pace to exceed Dining budget by ~$120").
- **Backend (exists):** `GET /api/forecast/{category}` (weekly Prophet job).
- **Native:** Swift Charts `AreaMark` band + `LineMark`; dashed projection; reduced-motion safe.
- **DoD:** at least one category shows a forecast band that matches the backend series.

### 2.4 "Owed to you" reimbursement overview `S–M`  ·  P2  ·  ✅ DONE
Shipped in `Features/Transactions/ReimbursementView.swift` (opened from the Money toolbar;
pending shares grouped by contact via `GET /api/shares/pending`, outstanding total hero,
inline mark-settled / delete with haptics).
- **UX:** A roll-up (Money header action or Plan section): total outstanding, grouped by contact, each with pending/settled and a tap-through to the source transaction; mark-paid inline.
- **Backend:** aggregate endpoint preferred (`GET /api/shares?status=pending`) — **verify**; else aggregate client-side.
- **DoD:** outstanding total is correct and matches the per-transaction shares; settling there updates the source.

---

## Tier 3 — Monetization & store readiness

### 3.1 StoreKit 2 subscriptions (IAP) `L`  ·  P1 for App Store  ·  🔲 NOT STARTED
- **UX:** Paywall describing tiers/entitlements; restore-purchases; manage-subscription deep link. Gate any premium features behind entitlement (mirror backend `require_plaid`/`require_snaptrade` gates — self-hosted single-user should stay entitled).
- **Native:** StoreKit 2 `Product`/`Transaction.currentEntitlements`; server receipt validation endpoint (**spec on backend**); entitlement cached + revalidated on launch.
- **DoD:** sandbox purchase unlocks the gated feature; restore works; expiry re-locks.

### 3.2 App Store readiness `M`  ·  P0 for submission  ·  🟡 IN PROGRESS
- **Done (code/config):**
  - **Privacy Manifest** — `HIVE/Resources/PrivacyInfo.xcprivacy` (bundled at app root). `NSPrivacyTracking=false`, no tracking domains; declares the one required-reason API in use (`UserDefaults` → `CA92.1`, for `LockState`'s app-lock prefs). Prevents the upload-time required-reason rejection.
  - **Usage strings** — `NSFaceIDUsageDescription` set (project.yml). No camera/location/contacts used → none else required.
  - **Encryption** — `ITSAppUsesNonExemptEncryption=false`.
  - **Account deletion reachable** — Settings → Delete account (1.3), Apple 5.1.1(v) ✅.
- **Still manual (App Store Connect / account-bound, can't be done from the repo):**
  - Privacy nutrition labels (financial data via Plaid/SnapTrade) in App Store Connect.
  - Screenshots per device class; app description/keywords; support + privacy-policy URLs.
  - TestFlight beta build upload; crash reporting (Xcode Organizer / MetricKit — no SDK added yet).
- **DoD:** passes review checklist; beta live on TestFlight.

---

## Tier 4 — Polish & smaller wins  ·  🟡 IN PROGRESS

- **Manual transaction add `S`** — ✅ DONE. `AddTransactionView` opens from a "+" on Money (`POST /api/transactions`). Expense/Income segmented control sets the backend sign (spend positive, income negative); merchant + date (capped at today) + optional Taxonomy category/subcategory + note. Saves via `TransactionsViewModel.createManual` then reloads the ledger. Files: `Features/Transactions/AddTransactionView.swift`, `ManualTransactionRequest` in `TransactionDTO.swift`, `DateOnly.string(from:)` helper.
- **Net-worth / account detail `S`** — tap a Connect account → balance history + its transactions (filtered Money view).
- **Redemption-nudge banner `S`** — ✅ DONE (in-app). Honey "Time to redeem" banner at the top of Plan→Points listing programs past their `REDEMPTION_THRESHOLDS` crossing (`ProgramSummary.aboveThreshold`); one ready program → tap opens its ledger, multiple → summary heads-up. Push delivery still pending 2.2. File: `Features/Plan/PlanView.swift` (`redemptionNudge`/`readyToRedeem`).
- **Global search `S`** — promote the Money search into an app-level search entry.
- **Accessibility pass `M`** — Dynamic Type, VoiceOver labels on icon-only controls (sync, share menu, optimizer), 44pt audit, reduced-motion. (Use `hive-ios-a11y-auditor` per screen.)
- **Empty/error states + skeletons audit `S`** — ensure every new screen has the `LoadStateView` triad.

---

## Suggested build order

1. **1.1 Budgets edit → 1.2 Optimizer** (close the obvious product gaps, both backed already).
2. **1.3 Settings + 1.4 Biometric lock** (Apple-required + security; unblock submission).
3. **2.1 AI Chat** (marquee feature).
4. **3.1 StoreKit + 3.2 Store readiness → submit.**
5. **2.2 Push, 2.3 Forecast, 2.4 Owed-to-you, Tier 4** as fast-follow.

## Backend items — verified status (2026-06-01)

Audited against `backend/app/api/`:

| Endpoint | For | Status |
|---|---|---|
| `DELETE /api/auth/account` | 1.3 Settings — **Apple-required** | ✅ present (`auth.py`) — FK-scoped wipe + best-effort SnapTrade revoke + cookie clear; typed-name confirm. |
| APNs device-token registration + triggers | 2.2 Push | ✅ **built** — `POST/DELETE /api/notifications/device-token`; APNs sender (`notifications/apns.py`); anomaly + weekly-digest triggers. Needs APNs `.env` on NUC + migration run. |
| Subscription receipt-validation | 3.1 StoreKit IAP | ⚠️ **MISSING**. |
| `GET /api/shares/pending` | 2.4 Owed-to-you | ✅ present (`shares.py`). |
| `GET /api/points/optimize` | 1.2 Optimizer | ✅ present (`points.py`). |
| `GET /api/forecast/{category}` | 2.3 Forecast | ✅ present (`forecast.py`). |
| `POST /api/chat` | 2.1 AI Chat | ✅ present — confirm streaming vs. single-response shape. |
| `POST /api/budgets` create/update + delete | 1.1 Budgets | ✅ wired (editor calls create/update + delete). |

**Net new backend work to unblock the MVP-to-submit path:** account-deletion endpoint (1.3) ✅ done; next
APNs registration (2.2) and receipt validation (3.1) for the fast-follow tiers.
