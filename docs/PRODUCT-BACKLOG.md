# HIVE — Product Backlog & Competitive Strategy

> Owner: Zach Collins · Created 2026-06-01 · Living doc.
> Purpose: a prioritized, competition-aware backlog for HIVE the *product* (web + native iOS).
> Companion docs: `docs/ios/FEATURE-SPEC.md` (native iOS build state), `CLAUDE.md` (domain rules).
> Status legend: ✅ shipped · 🚧 partial · 🔲 not started.
> Tag legend: **[P]** parity (table-stakes a competitor has) · **[D]** differentiator (our wedge) · **[B]** bet (unproven, high-upside).

---

## 1. Positioning — why HIVE wins

Every mainstream PFM app makes the same trade: **you get the app, they get your data.** Credit Karma
and Rocket Money monetize through ads, lead-gen, and selling your behavior; Monarch/Copilot/Origin
charge a subscription but still run on someone else's cloud.

HIVE is the opposite:

1. **Self-hosted & private.** Your financial graph lives on your own NUC. No ads, no lead-gen, no
   data brokering. Local AI (Ollama) does the bulk of categorization before anything touches a
   cloud model. *This is the anti-Credit-Karma.*
2. **Rewards optimization as a first-class pillar.** No mainstream PFM treats credit-card points as a
   core surface. HIVE already models 5 programs, per-merchant earn rules, CPP valuations, a
   "which card at checkout" optimizer, and points-leakage detection. **This is the single biggest
   wedge** — it's a category (MaxRewards, AwardWallet) that nobody has fused with real budgeting.
3. **Conversational AI over your *whole* finances.** Not canned "insight cards" — an actual Claude
   agent with your full transaction/budget/points graph in context, able to answer and *act*.
4. **Owned intelligence pipeline.** Anomaly detection (IsolationForest) and forecasting (Prophet)
   already run in-house, not as a vendor black box.

**One-line:** *The private, self-hosted finance brain that also makes your credit cards pay you the most.*

---

## 2. Competitive landscape

| App | Core strength | Monetization | Weakness HIVE exploits |
|---|---|---|---|
| **Monarch** | Best-in-class budgeting, households, clean UX | $100/yr sub | No rewards engine; cloud-hosted |
| **Origin** | Holistic wealth, estate/tax planning, advisors | $/yr + advisory | Heavy; not transaction-day-to-day; no rewards |
| **Copilot** | Gorgeous Apple-native UX, AI categorization | $95/yr sub | Apple-only; no rewards; cloud |
| **Credit Karma** | Free credit score + reports, recommendations | Ads / lead-gen | Sells your data; shallow budgeting; no investing |
| **Rocket Money** | Subscription cancel + bill negotiation concierge | % of savings + sub | Upsell-driven; sells data; weak analytics |

### Feature matrix (✅ have · 🚧 partial · 🔲 gap · — n/a)

| Capability | Monarch | Origin | Copilot | CreditKarma | Rocket | **HIVE** |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Auto bank sync (Plaid) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Investment tracking | ✅ | ✅ | ✅ | 🔲 | 🔲 | ✅ (SnapTrade) |
| Budgets (rollover/flex) | ✅ | 🚧 | ✅ | 🔲 | 🚧 | ✅ |
| Net worth over time | ✅ | ✅ | ✅ | 🔲 | ✅ | ✅ |
| Recurring / subscriptions | ✅ | 🚧 | ✅ | 🔲 | ✅ | ✅ |
| Bills & cash-flow forecast | 🚧 | 🚧 | 🚧 | 🔲 | ✅ | ✅ (Prophet) |
| Goals | ✅ | ✅ | 🚧 | 🔲 | ✅ | ✅ |
| Debt payoff planning | 🚧 | ✅ | 🔲 | 🚧 | 🚧 | ✅ |
| AI categorization | 🚧 | 🔲 | ✅ | 🔲 | 🚧 | ✅ (local-first) |
| Anomaly / fraud alerts | 🔲 | 🔲 | 🚧 | 🚧 | ✅ | ✅ (ML) |
| Conversational AI Q&A | 🔲 | 🔲 | 🚧 | 🔲 | 🔲 | ✅ (Claude) |
| **Credit-card rewards optimizer** | 🔲 | 🔲 | 🔲 | 🚧 (offers) | 🔲 | ✅ **(wedge)** |
| **Points ledger across programs** | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | ✅ **(wedge)** |
| Household / shared accounts | ✅ | 🚧 | 🔲 | 🔲 | 🔲 | 🔲 **gap** |
| Subscription *cancellation* | 🔲 | 🔲 | 🔲 | 🔲 | ✅ | 🔲 **gap** |
| Bill negotiation | 🔲 | 🔲 | 🔲 | 🔲 | ✅ | 🔲 **gap** |
| Credit score monitoring | 🔲 | 🔲 | 🔲 | ✅ | ✅ | 🔲 **gap** |
| Manual/real-estate asset valuation | ✅ (Zillow) | ✅ | 🚧 | 🔲 | 🔲 | 🔲 **gap** |
| Customizable dashboard | ✅ | 🚧 | ✅ | 🔲 | 🔲 | 🚧 |
| Privacy / self-hosted | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | ✅ **(wedge)** |

**Read:** HIVE already matches or beats the field on analytics depth. The white space is (a) **doubling
down on rewards** where we're alone, (b) closing a handful of **parity gaps** (household, subscription
cancel, asset valuation), and (c) **AI-agent bets** nobody has shipped.

---

## 3. Backlog

Organized by theme. Each item: priority (P0 next / P1 soon / P2 later), size (S/M/L/XL), tag, status.

### Theme A — Rewards Intelligence (our moat; go deepest here)  🟡

| # | Item | Pri | Size | Tag | Status |
|---|---|:--:|:--:|:--:|:--:|
| A1 | **Annual-fee ROI tracker** — per card: fees paid vs. points earned (at CPP) + credits used; verdict "keep / downgrade / cancel" | P1 | M | [D] | 🔲 |
| A2 | **Points leakage report** — "you spent $X on dining on the wrong card, leaving N points (~$Y)" | P1 | M | [D] | 🚧 (Insights has a v1) |
| A3 | **Card optimizer at checkout** — merchant/category/amount → ranked card (native surface) | P0 | M | [D] | 🚧 (web ✅, iOS 🔲) |
| A4 | **Transfer-partner sweet-spot finder** — given balances, surface high-CPP redemptions (e.g. MR→ANA, UR→Hyatt) | P2 | L | [B] | 🔲 |
| A5 | **Redemption nudges** — banner/push when a program crosses its threshold (`REDEMPTION_THRESHOLDS`) | P1 | S | [D] | 🚧 |
| A6 | **Quarterly/rotating category tracker** — Chase Freedom-style 5% calendars, activation reminders | P2 | M | [D] | 🔲 |
| A7 | **"Should I get this card?" simulator** — model your last 12mo spend against a new card's earn + SUB | P2 | L | [B] | 🔲 |
| A8 | **Travel redemption planner** — pair points balances with award availability for a trip goal | P3 | XL | [B] | 🔲 |

### Theme B — AI Financial Agent (Claude over your full graph)  🟣

| # | Item | Pri | Size | Tag | Status |
|---|---|:--:|:--:|:--:|:--:|
| B1 | **Native AI chat** — grounded Q&A with tappable references to txns/budgets | P0 | L | [D] | 🔲 (web ✅) |
| B2 | **Agentic actions** — "rebalance my budgets", "find me $200/mo to cut", "recategorize all Amazon" → proposes diffs you approve | P1 | XL | [B] | 🔲 |
| B3 | **Weekly AI digest** — proactive narrative ("spend up 18% on dining; on pace to miss Travel goal by $400") as push + feed | P1 | M | [D] | 🔲 |
| B4 | **Natural-language rules** — "always categorize X as Y" in plain English → creates a rule | P2 | M | [D] | 🔲 |
| B5 | **Scenario modeling** — "if I cancel these 3 subs and move dining to Amex, what's my year?" | P2 | L | [B] | 🔲 |

### Theme C — Parity gaps (close to stop losing comparisons)  🔵

| # | Item | Pri | Size | Tag | Status |
|---|---|:--:|:--:|:--:|:--:|
| C1 | **Subscription cancellation assist** — detect recurring, surface cancel links/instructions + "unused since" flag (we *detect & guide*, not concierge) | P1 | M | [P] | 🔲 |
| C2 | **Manual & real-estate assets** — add home/car/crypto with periodic valuation (Zillow-style estimate optional) → net worth | P1 | M | [P] | 🔲 |
| C3 | **Household / shared mode** — multi-user on the self-hosted instance; shared vs. personal accounts (already have `shares`/`contacts` scaffolding) | P2 | L | [P] | 🔲 |
| C4 | **Customizable dashboard** — reorder/show-hide widgets; pick your "one number" | P2 | M | [P] | 🚧 |
| C5 | **Bill/price-increase watch** — alert when a recurring charge rises vs. its baseline ("your insurance went up $30") | P2 | M | [P]/[D] | 🔲 |
| C6 | **Credit score** — *evaluate only*: needs a bureau API (cost/privacy trade-off vs. self-hosted ethos). Likely **decline** or manual-entry tracking | P3 | — | [P] | 🔲 (decision) |

### Theme D — Core polish & native completeness  🟢

| # | Item | Pri | Size | Tag | Status |
|---|---|:--:|:--:|:--:|:--:|
| D1 | **Settings/Account + account-deletion endpoint** (Apple-required) | P0 | L | [P] | 🔲 (see FEATURE-SPEC 1.3) |
| D2 | **Biometric app-lock** (Face ID) | P0 | M | [P] | 🔲 |
| D3 | **Push notifications** infra (APNs + device-token endpoint) — carries A5, B3, C5 | P0 | L | [P] | 🔲 |
| D4 | **Spending forecast on device** (Prophet band) | P1 | M | [D] | 🔲 (backend ✅) |
| D5 | **Manual transaction add** (cash) | P2 | S | [P] | 🔲 |
| D6 | **Accessibility + empty/error/skeleton pass** | P1 | M | [P] | 🚧 |

### Theme E — Privacy & trust (lean into the wedge)  ⚫

| # | Item | Pri | Size | Tag | Status |
|---|---|:--:|:--:|:--:|:--:|
| E1 | **Local-first AI toggle** — guarantee categorization/chat can run fully on Ollama; show what (if anything) leaves the box | P2 | M | [D] | 🚧 |
| E2 | **Data export / portability** — full JSON/CSV export, "it's your data" | P2 | S | [D] | 🚧 (reports CSV) |
| E3 | **Encrypted backups** — extend the existing nightly `pg_dump` with encryption + off-NUC option | P3 | M | [D] | 🚧 |
| E4 | **Audit log surfaced** — what synced, what the AI did, when (trust through transparency) | P3 | S | [D] | 🔲 |

---

## 4. Recommended sequencing

1. **Finish the native MVP (Theme D P0):** Settings + delete-account, biometric lock, push infra,
   plus A3 (optimizer on device) and B1 (native chat). This makes the app *submittable* **and**
   ships the two wedge features on mobile.
2. **Light the wedge (Theme A):** A2 leakage, A1 annual-fee ROI, A5 redemption nudges (rides on D3
   push). Cheap, and nothing else on the market does it.
3. **Differentiate with AI (Theme B):** B3 weekly digest (push) → B1 chat depth → B2 agentic actions.
4. **Close parity (Theme C):** C2 manual assets, C1 subscription cancel-assist, C4 dashboard.
5. **Privacy as marketing (Theme E):** E1/E2 — turn the self-hosted ethos into a stated promise.

## 5. Explicitly *not* doing (and why)

- **Bill-negotiation concierge** (Rocket Money) — a human-service business, not a product feature;
  off-mission for a self-hosted app. *Maybe:* surface "you're overpaying vs. benchmark" insight.
- **Estate/will & tax filing** (Origin/Credit Karma) — out of scope; revisit cap-gains/tax-lot
  reporting from SnapTrade data only.
- **Ad/offer-driven card recommendations** (Credit Karma) — violates the no-lead-gen promise. Our
  card suggestions (A7) are driven by *your* spend, not affiliate payouts.
