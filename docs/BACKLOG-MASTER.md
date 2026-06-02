# HIVE — Master Backlog (Consolidated)

> Owner: Zach Collins · Created 2026-06-02 · **Single source of truth.**
> Merges `docs/PRODUCT-BACKLOG.md` (themes A–E) and `docs/PRODUCT-SPEC-NEXT.md` (Epics 1–11) into one
> deduplicated, prioritized list. Where items overlapped, they're collapsed and the source IDs noted.
> Tag: **[P]** parity · **[D]** differentiator · **[B]** bet. Size: S/M/L/XL. Status: ✅ done · 🚧 partial · 🔲 not started.
> Source: **BL** = PRODUCT-BACKLOG.md · **SN** = PRODUCT-SPEC-NEXT.md.

---

## Tier 0 — Native MVP / submittable (do first)

| # | Item | Tag | Size | Status | Source |
|---|---|:--:|:--:|:--:|:--|
| 1 | Settings/Account + account-deletion endpoint (Apple-required) | [P] | L | 🔲 | BL D1 |
| 2 | Biometric app-lock (Face ID) | [P] | M | 🔲 | BL D2 |
| 3 | Push-notification infra (APNs + device-token) — carries all alerts | [P] | L | 🔲 | BL D3 |
| 4 | Card optimizer at checkout — native surface (web ✅) | [D] | M | 🚧 | BL A3 |
| 5 | A11y + empty/error/skeleton pass | [P] | M | 🚧 | BL D6 |
| 6 | Manual transaction add (cash) | [P] | S | 🔲 | BL D5 |

## Tier 1 — Card moat (cheapest defensible wedge)

| # | Item | Tag | Size | Status | Source |
|---|---|:--:|:--:|:--:|:--|
| 7 | **Card Benefits & Credits Vault** — track statement credits, perks, protections; use-it-or-lose-it; auto-reconcile to txns | [D]/[B] | L | 🔲 | SN E1 |
| 8 | **Annual-fee ROI** — fee vs (points@CPP + credits used + claims); keep/downgrade/cancel verdict *(merges BL A1 + SN 1.5)* | [D] | M | 🔲 | BL A1 + SN 1.5 |
| 9 | **Statement & Utilization Intelligence** — pay-by dates, grace/interest guard, pre-statement utilization optimizer, autopay safety net | [D] | M | 🔲 | SN E2 |
| 10 | Points-leakage report — "wrong card cost you N pts (~$Y)" | [D] | M | 🚧 | BL A2 |
| 11 | Redemption nudges — push when a program crosses threshold *(routes through #20 alert center)* | [D] | S | 🚧 | BL A5 |
| 12 | Rotating-category tracker (5% calendars + activation reminders) | [D] | M | 🔲 | BL A6 |
| 13 | Transfer-partner sweet-spot finder | [B] | L | 🔲 | BL A4 |
| 14 | "Should I get this card?" simulator (12-mo spend vs new card earn + SUB) | [B] | L | 🔲 | BL A7 |
| 15 | Travel redemption planner (points + award availability) | [B] | XL | 🔲 | BL A8 |

## Tier 2 — Substrate (unblocks claims, deductions, alerts)

| # | Item | Tag | Size | Status | Source |
|---|---|:--:|:--:|:--:|:--|
| 16 | **Receipts & Documents** — attach photos/PDFs, local OCR, return/warranty windows | [P]/[D] | M | 🔲 | SN E5 |
| 17 | Manual & real-estate assets (home/car/crypto) → net worth | [P] | M | 🔲 | BL C2 |
| 18 | Subscription cancellation assist (detect + cancel links + "unused since") | [P] | M | 🔲 | BL C1 |
| 19 | Data export / portability (full JSON/CSV) | [D] | S | 🚧 | BL E2 |

## Tier 3 — Engagement engine

| # | Item | Tag | Size | Status | Source |
|---|---|:--:|:--:|:--:|:--|
| 20 | **Proactive Alert Center** — one rules engine + inbox; net-new signals (free-trial converting, intro-APR ending, foreign-fee card, duplicate charge, overdraft risk) *(absorbs BL A5, BL C5)* | [P]/[D] | L | 🔲 | SN E6 + BL C5 |
| 21 | **Financial Health Score** — composite, rewards-aware "one number" + drivers + one action | [D] | M | 🔲 | SN E7 |
| 22 | Customizable dashboard (reorder/show-hide; pick your "one number") | [P] | M | 🚧 | BL C4 |
| 23 | On-device spending forecast (Prophet band) | [D] | M | 🔲 | BL D4 |

## Tier 4 — Planning & Advisory platform (spreadsheet replacement) ★ operator priority

| # | Item | Tag | Size | Status | Source |
|---|---|:--:|:--:|:--:|:--|
| 24 | **Planning & Forecasting Engine** — assumptions (return/inflation/raises/tax), recurring inflow/outflow + ranged events, income streams, compounding engine, confidence bands, spreadsheet-grade editable table + CSV *(keystone; replaces today's linear `/plan`)* | [D]/[B] | XL | 🔲 | SN E8 |
| 25 | **Scenarios & Life Events** — named, comparable scenarios + templates (home, baby, job change, sabbatical, relocation) | [D]/[B] | L | 🔲 | SN E9 |
| 26 | **Grad-school module** — tuition schedule, funding sources, student loans (sub/unsub interest + grace + repayment), income drop, COL, post-grad step-up, cash-runway trough + ROI vs staying employed | [B] | L | 🔲 | SN 9.4 |
| 27 | Student-loan tracker + repayment strategies (avalanche/snowball/IDR) → `/debt` | [P] | M | 🔲 | SN 9.5 |

## Tier 5 — AI advisor & investing depth

| # | Item | Tag | Size | Status | Source |
|---|---|:--:|:--:|:--:|:--|
| 28 | **AI Financial Advisor (agentic)** — tool-use; propose-and-approve actions; NL scenario building; weekly digest; NL rules; grounded refs; local advisor memory *(absorbs BL B1–B5)* | [B] | XL | 🔲 | SN E10 + BL B1–B5 |
| 29 | **Portfolio & Retirement / FIRE** — allocation+drift, TWR vs benchmark, dividends, fee drag, concentration risk, FIRE/coast projection | [P]/[D] | L | 🔲 | SN E3 |
| 30 | **Tax Intelligence** — realized gains/tax-lots, wash-sale, loss-harvest, deductible tagging, estimated-tax + year-end pack (reporting only) | [D] | L | 🔲 | SN E4 |
| 31 | **Investment & Trade Decision-Support** — tax-aware rebalancing, lot sell optimizer, trade what-ifs, DCA scheduler, trade journal, AI portfolio review *(decision-support, not securities advice)* | [D]/[B] | L | 🔲 | SN E11 |

## Tier 6 — Privacy, trust, parity tail

| # | Item | Tag | Size | Status | Source |
|---|---|:--:|:--:|:--:|:--|
| 32 | Local-first AI toggle — show exactly what (if anything) leaves the NUC | [D] | M | 🚧 | BL E1 |
| 33 | Encrypted off-NUC backups (extend nightly `pg_dump`) | [D] | M | 🚧 | BL E3 |
| 34 | Audit log surfaced — what synced, what the AI did, when | [D] | S | 🔲 | BL E4 |
| 35 | Household / shared mode (multi-user on the instance) | [P] | L | 🔲 | BL C3 |
| 36 | Credit-score monitoring — **decision: likely decline** (bureau API cost/privacy) or manual-entry only | [P] | — | 🔲 | BL C6 |

---

## Recommended path for the operator's stated goals
Spreadsheet replacement + advice + grad school is **Tier 4 → Tier 5**, but it stands on the keystone:
**#24 (engine) → #25/#26 (scenarios + grad school) → #28 (AI advisor) → #29/#30/#31 (investing depth).**
Run the **card moat (#7–#9)** in parallel — it's cheap, defensible, and mostly independent.

## Merge notes (what was collapsed)
- **#8** = BL A1 + SN 1.5 (annual-fee ROI appeared in both).
- **#11 / #20** — BL A5 redemption nudges and BL C5 bill-increase watch now ride the alert engine (#20).
- **#28** = BL B1–B5 (chat, agentic actions, digest, NL rules, scenario modeling) realized as one agentic advisor.
- Out of scope (unchanged): securities recommendations / auto-trading, tax *filing*, bill-negotiation concierge, cloud OCR.
