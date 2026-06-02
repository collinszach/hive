# HIVE — Net-New Feature Spec ("The Next Layer")

> Owner: Zach Collins · Created 2026-06-02 · PM/strategy spec.
> Companion to `docs/PRODUCT-BACKLOG.md` (the existing roadmap) — this doc is **strictly additive**.
> Every epic here was checked against the live codebase and is **net-new** (not already in the backlog,
> not already built). Where a foundation already exists in the data layer, it's noted.
> Tag legend: **[P]** parity · **[D]** differentiator · **[B]** bet. Size: S/M/L/XL. Status: 🔲 not started.

---

## 0. Consultant's thesis (read this first)

HIVE has already won the **breadth** game — 25 app surfaces, deep budgeting, points ledger, anomaly ML,
forecasting, splits, subscriptions, SnapTrade investments. The existing backlog correctly says the wedge is
**rewards + private + AI agent**. But breadth is now a liability if it isn't converted into *decisions the
operator can't get anywhere else.* The next layer of advantage is **depth on the credit-card and wealth
surfaces nobody else instruments**, plus the connective tissue (receipts, alerts, a single health number)
that turns raw data into "do this now."

Five gaps surfaced from auditing the code. Ranked by *defensibility × value to the "operator" persona*:

| # | Epic | Why it's white space | Tag |
|---|---|---|---|
| 1 | **Card Benefits & Credits Vault** | The rewards moat stops at *points*. The other half of a premium card's value — statement credits, perks, purchase/travel protections — is **completely untracked** (0 code hits). Nobody fuses card credits with transaction data. | [D]/[B] |
| 2 | **Statement & Utilization Intelligence** | The account model already stores `statement_balance / statement_close_day / payment_due_day / autopay / credit_limit` — but **nothing surfaces them.** A 6-card operator has no pay-by/utilization/grace-period brain. | [D] |
| 3 | **Portfolio & Retirement (FIRE) Intelligence** | SnapTrade is linked but `position.py` is shallow (no allocation, return, dividend, or cost basis). PFM's universal weak spot; high value to a wealth-building operator. | [P]/[D] |
| 4 | **Tax Intelligence** | Zero tax features today. Reframed from the backlog's punted "tax filing" to **reporting + nudges** (tax-lots, wash-sale, loss-harvest, deductible tagging) — fully on-mission for a self-hosted, your-data-your-box app. | [D] |
| 5 | **Receipts & Documents** | No real attachment exists. It's the substrate that makes #1 (protection claims), #4 (deduction proof), disputes, and returns actually actionable. | [P] |

Plus two connective epics that monetize the above: **#6 Proactive Alert Center** (one engine for every
time-sensitive signal) and **#7 Financial Health Score** (the persona's "one number").

---

## EPIC 1 — Card Benefits & Credits Vault  [D]/[B] · L

**Goal:** Track every *non-points* dollar of value on each card — recurring statement credits, perks, and
purchase/travel protections — and tell the operator when value is unused or claimable. This doubles the
rewards moat: today HIVE optimizes earn; this optimizes the **other half** of a premium card's value.

**Why nobody has it:** MaxRewards lists credits; AwardWallet lists balances. Neither *reconciles credits
against your actual transactions* or *prompts a protection claim from a real purchase.* HIVE has the txn
graph to do both. Directly strengthens A1 (annual-fee ROI) in the existing backlog by giving it real data.

**Foundation that exists:** `earn_rule` model & points pipeline (pattern to follow), transaction graph,
card slugs in `CLAUDE.md`. **Net-new:** a `card_benefit` model + reconciliation logic.

### Stories
- **1.1 Benefit catalog model** `[P] · M` — As the system, model per-card benefits: type
  (`statement_credit | perk | protection`), value, cadence (`monthly | quarterly | annual | one_time`),
  reset date, and a matcher (merchant/category) for auto-detection.
  *AC:* seed the 5 tracked cards' real 2026 credits (e.g. Amex Gold $10/mo dining + $7/mo Dunkin, Venture X
  $300 travel + anniversary miles, etc.); each benefit has a value, reset cadence, and optional match rule.
- **1.2 Credit auto-reconciliation** `[D] · M` — As an operator, when a transaction matches a credit's
  rule, mark that credit "used this period" automatically.
  *AC:* a qualifying Dunkin charge on Amex Gold flips the $7 monthly credit to *used*; manual override exists;
  no double-count within a period.
- **1.3 "Use it or lose it" surface + reminders** `[D] · S` — As an operator, see unused credits and days
  until they reset; get a push (via Epic 6) when a credit is about to expire unused.
  *AC:* a card detail view lists each credit as used/unused with a reset countdown; expiring-unused credits
  rank to the top; push fires at a configurable lead time (default 5 days).
- **1.4 Protection & warranty registry** `[B] · M` — As an operator, see which recent purchases are covered
  by the paying card's purchase protection / extended warranty / return protection / cell-phone protection,
  with the claim window and a link to the issuer's claim flow.
  *AC:* a $900 electronics purchase on a card with 90-day purchase protection shows "covered until <date>"
  and a "start claim" deep link; ties to a receipt (Epic 5) when attached.
- **1.5 Real annual-fee ROI (closes backlog A1)** `[D] · M` — As an operator, per card see
  *fee paid − (points earned at CPP + credits actually used + protections claimed)* → verdict
  **keep / downgrade / cancel / product-change**.
  *AC:* each card shows a net ROI number with a breakdown; verdict updates as credits are used through the year.

---

## EPIC 2 — Statement & Utilization Intelligence  [D] · M

**Goal:** Turn the dormant statement fields into a per-card and aggregate "what to pay, when, and why" brain
— interest avoidance, autopay verification, and **credit-utilization timing** (the lever that actually moves
a credit score). A 6-card operator manages this in their head today; HIVE should own it.

**Why it's a differentiator:** PFM apps show balances; none of them tell you *"pay $420 on the Sapphire by
the 3rd to report sub-10% utilization before the statement cuts."* That's credit-card-nerd grade, and it's
exactly the operator's mindset.

**Foundation that exists:** `account.credit_limit / statement_balance / statement_close_day /
payment_due_day / autopay`. **Net-new:** computation + surface; add `apr` and `minimum_payment` to the model.

### Stories
- **2.1 Pay-by + statement view** `[P] · S` — As an operator, per card see statement balance, current
  balance, due date, minimum due, and autopay status; aggregate "total due across all cards this cycle."
  *AC:* due dates render with day-countdown; cards with autopay-off and a due date <7 days away are flagged.
- **2.2 Grace-period / interest guard** `[D] · S` — As an operator carrying a balance, see the interest
  I'll accrue and the date the grace period is lost.
  *AC:* if statement balance isn't paid in full by due date, show projected interest at the card's APR and a
  warning that new purchases now accrue interest; suppressed for cards paid in full.
- **2.3 Utilization optimizer** `[D] · M` — As an operator, see per-card and overall utilization, and get a
  recommended pre-statement payment to land each reported balance under a target threshold (default 10%/30%).
  *AC:* "pay $X on <card> before <statement_close_day> to report N% utilization"; recompute as balances change.
- **2.4 Autopay & missed-payment safety net** `[P]/[D] · S` — As an operator, get alerted (Epic 6) to a due
  date approaching with autopay off, or a payment that didn't post in the expected window.
  *AC:* alert fires for autopay-off + due-soon; "expected payment not seen" fires if no payment txn appears by
  due date − 1.

---

## EPIC 3 — Portfolio & Retirement (FIRE) Intelligence  [P]/[D] · L

**Goal:** Make the SnapTrade data earn its keep. Today `position.py` only rolls up monthly value. Add the
analytics a wealth-building operator actually uses, and project the one question every saver asks: *when am
I free?*

**Why:** Investment analytics is the universal PFM weak spot — Monarch/Copilot show holdings, not insight.
A self-hosted owner who already trusts HIVE with net worth is the ideal audience for allocation, drift,
fee-drag, and a FIRE projection.

**Foundation that exists:** SnapTrade integration, `net_worth` model, `position.py` monthly rollup,
`forecaster.py` (Prophet) as a projection precedent.

### Stories
- **3.1 Asset allocation & drift** `[D] · M` — As an operator, see current allocation (stock/bond/cash/
  alt, plus sector & geography) and drift from a target I set.
  *AC:* allocation chart from SnapTrade holdings; user sets targets; bands that drift >5% are flagged.
- **3.2 Performance (TWR) vs benchmark** `[D] · M` — As an operator, see time-weighted return over 1m/1y/
  all and against a benchmark (e.g. VTI/60-40).
  *AC:* TWR handles contributions/withdrawals correctly; benchmark line overlays; clearly labeled vs price-only.
- **3.3 Dividend & income tracker** `[P] · S` — As an operator, see trailing & projected dividend income
  and yield-on-cost by holding and total.
  *AC:* dividends pulled/derived from SnapTrade; forward income estimated from current holdings.
- **3.4 Fee & expense-ratio drag** `[D] · S` — As an operator, see blended expense ratio and annual fee
  drag in dollars across funds.
  *AC:* per-fund expense ratios surfaced; total $/yr drag computed; high-cost funds (>0.20%) flagged.
- **3.5 Concentration / single-stock risk** `[P] · S` — As an operator, get warned when any one position
  exceeds a threshold of the portfolio.
  *AC:* positions >10% (configurable) flagged with their share of total.
- **3.6 FIRE / retirement projection** `[B] · M` — As an operator, project net-worth trajectory to a target
  number using my savings rate and a return assumption; show "coast-FIRE date" and "FI date," with a
  conservative/expected/optimistic band.
  *AC:* inputs (target, return %, savings rate auto-derived from cash-flow); three-band projection chart;
  recompute when savings rate or net worth changes.

---

## EPIC 4 — Tax Intelligence  [D] · L

**Goal:** Reporting and nudges — **not filing.** Use the investment + transaction data HIVE already owns to
do the tax work a self-hosted owner would otherwise pay an app to leak to the cloud. This is the principled
version of the backlog's punted "tax" item: your data, your box, no third party.

**Foundation that exists:** SnapTrade holdings/lots, `tag` + `transaction_split` models, the `Business`
category, reports CSV export. **Net-new:** lot accounting + a tax surface.

### Stories
- **4.1 Realized gains & tax-lot report** `[P] · M` — As an operator, see YTD realized short/long-term
  gains and per-lot cost basis from SnapTrade.
  *AC:* lots grouped short vs long; YTD realized gain/loss total; export matches a broker 1099-B shape.
- **4.2 Wash-sale flagging** `[D] · M` — As an operator, get warned when a loss sale is (or would be) a wash
  sale due to a buy within ±30 days.
  *AC:* flags realized losses with a disallowing buy in the window; explains the disallowed amount.
- **4.3 Tax-loss-harvest opportunities** `[B] · M` — As an operator, see unrealized losses I could harvest
  before year-end, with the wash-sale caveat.
  *AC:* lists positions in a loss with $ harvestable and estimated tax saved at my bracket; flags wash risk.
- **4.4 Deductible-expense tagging** `[D] · S` — As an operator, tag transactions as deductible (business,
  charitable, medical, home-office) and see a running schedule by bucket.
  *AC:* reuses existing tags; a "deductions" view totals by bucket with attached receipts (Epic 5).
- **4.5 Estimated-tax & year-end pack** `[P] · M` — As an operator, get a quarterly estimated-tax helper and
  a year-end export bundle (realized gains, dividends, deductible schedule, charitable).
  *AC:* quarterly safe-harbor estimate; one-click ZIP/CSV export of the year's tax-relevant data.

> **Boundary:** HIVE computes and exports; it does not file or give regulated advice. Copy must say "estimate,
> not tax advice." Keep this firmly on the reporting side of the line the backlog drew.

---

## EPIC 5 — Receipts & Documents  [P] · M

**Goal:** Let the operator attach receipts/invoices/warranties to transactions. This is plumbing, but it's
the substrate that makes Epic 1 (protection claims), Epic 4 (deduction proof), disputes, and returns real.

**Foundation that exists:** `transaction` model, self-hosted storage on the NUC (no third-party blob store
needed — on brand). **Net-new:** attachment model + storage + optional local OCR.

### Stories
- **5.1 Attach a document** `[P] · S` — As an operator, attach one or more images/PDFs to a transaction.
  *AC:* upload from mobile camera or file; stored on the NUC; thumbnail on the transaction; delete supported.
- **5.2 Local OCR line-items** `[D] · M` — As an operator, have a receipt's merchant, date, total, and line
  items extracted automatically — locally (Ollama/Tesseract), nothing leaving the box.
  *AC:* extracted total reconciles against the txn amount; mismatch flagged; runs without a cloud call.
- **5.3 Return / warranty window tracker** `[D] · S` — As an operator, set or auto-derive a return-by /
  warranty-until date on a purchase and get reminded (Epic 6) before it lapses.
  *AC:* purchases can carry a return window; expiring windows surface and notify; links to Epic 1.4 protections.

---

## EPIC 6 — Proactive Alert Center  [P]/[D] · L

**Goal:** One configurable engine + inbox for every time-sensitive signal, instead of scattering them.
Hosts existing backlog signals (A5 redemption thresholds, C5 bill-increase) **and** net-new ones. Rides the
push infra (backlog D3) — build that first.

**Why net-new:** the backlog has individual alerts but no unifying *rules engine + notification inbox* the
user can tune. Trust-through-control fits the persona ("zero ambiguity," resents chrome).

**Foundation that exists:** `notifications.py` API, `device_token` model, anomaly detector, subscription
detection. **Net-new:** alert-rule model, evaluation loop, inbox UI, per-alert mute/threshold.

### Stories
- **6.1 Alert rule + inbox model** `[P] · M` — As an operator, manage a list of alert types with per-type
  enable/threshold/channel (push/in-app), and an inbox of fired alerts.
  *AC:* each alert type has settings; inbox shows fired alerts read/unread; respects quiet hours.
- **6.2 Net-new signals** `[D] · M` — Free-trial about to convert; intro/0% APR period ending; foreign-fee
  card used (or "use your no-FX card") while traveling; duplicate-charge detected; low-balance/overdraft risk.
  *AC:* each signal fires correctly against seeded test cases; each is independently mutable.
- **6.3 Consolidate existing signals** `[P] · S` — Route redemption-threshold (A5), bill-increase (C5),
  statement-due (Epic 2), credit-expiring (Epic 1), return-window (Epic 5), and anomaly alerts through this engine.
  *AC:* no signal double-fires; all appear in one inbox; one place to mute.

---

## EPIC 7 — Financial Health Score  [D] · M

**Goal:** The persona's "one number." A composite, *rewards-aware* health score with its drivers and a single
recommended next action — the thing the dashboard's "one dominant element" principle is begging for.

**Why net-new:** safe-to-spend exists (daily liquidity) but there is **no composite health score**. Origin
has one; HIVE's can be private and uniquely include points-leakage and subscription-bloat as factors.

**Foundation that exists:** budgets, net worth, cash-flow, debt, subscriptions, points-leakage (Insights v1).

### Stories
- **7.1 Score model** `[D] · M` — As an operator, see a 0–100 health score composed of savings rate,
  emergency-fund runway (months), debt-to-income, credit utilization (Epic 2), subscription bloat, and
  points-leakage (rewards-aware — unique to HIVE).
  *AC:* weights are explicit and documented; each factor shows its own sub-score and contribution.
- **7.2 Trend & drivers** `[P] · S` — As an operator, see the score over time and what moved it.
  *AC:* sparkline of score; "up 4 since last month, driven by lower utilization" narrative.
- **7.3 One recommended action** `[D] · S` — As an operator, see the single highest-leverage action to raise
  the score (deep-links into the relevant surface).
  *AC:* recommendation cites the weakest factor and links to act (e.g. "cancel 2 unused subs → +3").

---

# PART II — The Planning & Advisory Platform ("replace the spreadsheet")

> Added 2026-06-02. The operator wants HIVE to (a) **replace a financial-forecasting spreadsheet**,
> (b) **advise on finances and trades**, and (c) **model life events** — specifically grad school.
> Audit finding: the foundation is real but shallow. `GET /api/plan/projection` extends a **flat
> 3-month savings average in a straight line** — no compounding, no inflation, no income changes, no
> recurring events, no confidence band. `plan_event` is a single one-time `amount`/`date` deduction —
> it **cannot express** tuition-over-semesters, loans, or reduced income. `chat` is **read-only** (no
> tools/actions). So this is a real build, not polish. These four epics turn HIVE into a planning brain.

## EPIC 8 — Planning & Forecasting Engine (the spreadsheet killer)  [D]/[B] · XL

**Goal:** Replace the spreadsheet with an assumption-driven, compounding, multi-account projection the
operator can edit like a sheet and trust like a model. This is the backbone Epics 9–11 plug into.

**Why net-new:** the current projection is a linear toy. A spreadsheet replacement needs real financial
math: invested balances compound at an assumed return, expenses inflate, income steps up with raises,
debt amortizes, and irregular events land on specific months — with a confidence band, not a single line.

**Foundation that exists:** `plan.py` projection + `plan_event` (to be extended), `forecaster.py` (Prophet),
`net_worth` snapshots, cash-flow + debt surfaces. **Net-new:** assumptions model, recurrence/inflow events,
income streams, a compounding engine.

### Stories
- **8.1 Assumptions model** `[P] · M` — As an operator, set projection assumptions: investment return %,
  inflation %, expected raise %, effective tax rate, emergency-fund floor. Global defaults, overridable per scenario.
  *AC:* assumptions persist; projection recomputes from them; sensible defaults documented.
- **8.2 Recurring & ranged events (extend `plan_event`)** `[D] · M` — As an operator, define events that are
  one-time **or recurring**, with a start/end date, a direction (**inflow or outflow**), optional annual growth,
  and a target (cash vs a specific account). *This single story unblocks grad school.*
  *AC:* a "$15k tuition each Aug+Jan, 2027–2029" event expands correctly; inflows raise net worth; growth compounds.
- **8.3 Income streams** `[D] · M` — As an operator, model income separately from events: salary (with raise
  schedule), bonus, stipend/RA/TA, side income — each with start/end and frequency.
  *AC:* projection income derives from streams, not just trailing transactions; mid-projection job changes apply.
- **8.4 Compounding projection engine** `[D] · L` — As an operator, get a month-by-month projection that
  compounds invested balances at the return assumption, inflates expenses, applies income streams, amortizes
  debt (ties to `/debt`), and lands events on their months.
  *AC:* replaces the linear loop; cash vs invested tracked separately; reconciles to current net worth at t=0.
- **8.5 Confidence bands** `[B] · M` — As an operator, see conservative / expected / optimistic trajectories
  (return-assumption sweep or Monte-Carlo-lite), not a single deterministic line.
  *AC:* three bands render; methodology stated; respects the assumptions model.
- **8.6 Spreadsheet-grade editable view + export** `[D] · M` — As an operator, see a year-by-year (drill to
  month) editable table — change a cell, watch downstream recompute — and export to CSV.
  *AC:* inline edits feed back into assumptions/events; CSV export matches the on-screen model.

### Build plan (Epic 8) — implementation phases
- **Phase 1 — Engine + data model (the hard part). ✅ DONE** (`app/planning/engine.py`, 4 models, migration
  `v0w1x2y3z4a5`, 13 passing engine tests incl. a grad-school sequence).
  - Pure, DB-independent projection engine (`app/planning/engine.py`): month-by-month, separate cash vs
    invested balances, compounding return, expense inflation, income streams, recurring/ranged inflow/outflow
    events, optional surplus auto-invest, confidence bands (return sweep), cash-runway trough + final net worth.
  - Data model: `plan_scenarios`, `plan_assumptions` (1:1 scenario), `income_streams`, and `plan_events`
    extended (`scenario_id`, `kind`, `target`, `recurrence`, `start_date`, `end_date`, `growth_pct`).
  - Unit tests for the engine (no DB) — covers compounding, inflation, recurrence, inflow/outflow, grad-school
    sequence. *This phase is the keystone and is independently verifiable.*
- **Phase 2 — API. ✅ DONE** (`app/api/planning.py`): `/api/planning` scenarios + assumptions + income-streams
  + events CRUD; a projection endpoint that assembles inputs from accounts (starting balances), transactions
  (baseline expenses, auto with optional override), and the scenario, then returns the engine result.
  Baseline scenario auto-seeded; scenarios carry a nullable `user_id` (matches accounts).
- **Phase 3 — Frontend**: spreadsheet-grade `/plan` rebuild — assumptions panel, events/income editors,
  year×month projection table with bands, CSV export. (Legacy linear `/api/plan` stays until parity.)

## EPIC 9 — Scenarios & Life Events (incl. Grad School)  [D]/[B] · L

**Goal:** Let the operator create, name, and **compare** whole scenarios — bundles of assumptions + events +
income changes — side by side. Ship life-event templates, with grad school as the flagship.

**Why net-new:** there are no scenarios today (one global projection). The operator's real questions are
comparative: *"grad school in 2027 vs. stay at my job — what happens to my net worth, my cash low-point, my
FI date?"* That requires first-class, comparable scenarios.

**Foundation that exists:** Epic 8 engine, `/debt` (for loan repayment), goals.

### Stories
- **9.1 Scenario container** `[D] · M` — As an operator, create named scenarios, each cloning a baseline then
  layering its own assumptions/events/income.
  *AC:* scenarios are independent; baseline ("current path") always exists; clone-and-edit works.
- **9.2 Scenario compare view** `[D] · M` — As an operator, compare 2–3 scenarios on net worth, cash low-point,
  total debt, savings rate, and FI date.
  *AC:* overlaid trajectories + a delta table; highlights the cash-runway trough per scenario.
- **9.3 Life-event templates** `[D] · M` — As an operator, scaffold a scenario from a template: grad school,
  home purchase, new baby, job change, sabbatical, relocation.
  *AC:* each template seeds the right inflow/outflow/income events with editable placeholders.
- **9.4 Grad-school module (flagship)** `[B] · L` — As an operator, model grad school precisely: a **tuition
  schedule** (per-semester outflows), **funding sources** (savings draw, 529, scholarship, stipend/assistantship
  income), **student loans** (subsidized vs unsubsidized, interest accrual during/after, grace period), the
  **income change** during school (reduced or zero), **cost-of-living/relocation** changes, and a **post-grad
  salary step-up** — then show the cash-runway trough ("you dip to $X in month N") and ROI vs. staying employed.
  *AC:* a 2-year program produces correct tuition outflows, loan balances accruing interest, a depleted-then-
  recovering cash line, and a break-even month vs. the baseline scenario.
- **9.5 Student-loan tracker (post-event)** `[P] · M` — As an operator, once loans exist, track balances and
  interest and compare repayment strategies (avalanche / snowball / income-driven), integrated with `/debt`.
  *AC:* repayment schedules render; strategy comparison shows total interest + payoff date.

## EPIC 10 — AI Financial Advisor (agentic, planning-aware)  [B] · XL

**Goal:** Upgrade chat from read-only Q&A into a proactive advisor that can **run projections, build scenarios,
and propose changes you approve** — reasoning over the whole graph *and* the planning engine. This is the
concrete, tool-using realization of backlog B1–B5.

**Why net-new:** today's chat can *describe* your finances but can't *do* anything or model the future. An
advisor that turns "I'm starting a 2-year master's next fall, ~$30k/yr, half-time income" into a built,
comparable scenario is the difference between a chatbot and a financial brain.

**Foundation that exists:** `chat.py` (rich context, Ollama→Claude routing, injection-hardened),
`plan/trim-recommendations` (one-shot Claude), `intelligence.weekly_insight_digest`. **Net-new:** tool/function
calling, a propose-and-approve action layer, advisor memory.

### Stories
- **10.1 Tool-use layer** `[D] · L` — As an operator, the advisor can call tools: query transactions, run a
  projection, create/modify a scenario, draft budget changes, look up points/cards.
  *AC:* Claude tool-calling wired to existing endpoints; tools are read-or-propose, never silently mutate.
- **10.2 Propose-and-approve actions (backlog B2)** `[B] · L` — As an operator, the advisor proposes diffs
  (recategorize all Amazon, rebalance budgets, create plan events) that I review and accept/reject.
  *AC:* every action renders as a previewable diff; nothing applies without explicit approval; approvals audited.
- **10.3 Natural-language scenario building (backlog B5 + Epic 9)** `[B] · M` — As an operator, describe a life
  change in plain English and get a built scenario.
  *AC:* "model grad school Aug 2027, $30k/yr tuition, drop to half salary, $20k loans" → a populated, editable scenario.
- **10.4 Proactive advisor digest (backlog B3)** `[D] · M` — As an operator, get a weekly/monthly narrative with
  specific recommendations, delivered in-app and via push (Epic 6).
  *AC:* digest cites real figures and trends; each recommendation deep-links to act.
- **10.5 NL rules + grounded references (backlog B4 + B1)** `[D] · M` — As an operator, "always categorize X as
  Y" creates a real rule; answers cite tappable transactions/budgets.
  *AC:* NL rule round-trips to the rules engine; references resolve to the underlying records.
- **10.6 Advisor profile/memory** `[D] · S` — As an operator, the advisor remembers my risk tolerance, goals,
  and life context (stored locally) to personalize advice.
  *AC:* profile is editable and local; advice reflects it; nothing leaves the NUC unless Claude is explicitly used.

> **Privacy note:** heavy planning/advisory reasoning favors Claude over Ollama. Keep the local-first toggle
> (backlog E1) honest — show the operator exactly what leaves the box, and let routine advice run locally.

## EPIC 11 — Investment & Trade Decision Support  [D]/[B] · L

**Goal:** Help the operator make *their own* portfolio/trade decisions with rigorous analysis — rebalancing
math, tax-aware lot selection, what-ifs, and a trade journal. Builds on Epic 3 (portfolio) + Epic 4 (tax).

**Boundary (important):** HIVE is a **decision-support** tool for the operator's own money, not a broker-dealer
or registered adviser. It does **not** generate buy/sell signals on specific securities or predict prices. It
does the math on *your* stated intent and surfaces tax/risk/allocation consequences. All output carries a
"not investment advice" disclaimer. This keeps "advise trades" useful *and* on the right side of the line.

**Foundation that exists:** SnapTrade holdings, Epic 3 analytics, Epic 4 tax-lots.

### Stories
- **11.1 Tax-aware rebalancing proposals** `[D] · M` — As an operator, given my target allocation, get a
  proposed set of buys/sells to get back on target — preferring tax-advantaged accounts and harvestable lots —
  as an order list I execute myself.
  *AC:* proposal hits target within tolerance; explains tax impact; never auto-executes.
- **11.2 Tax-lot sell optimizer** `[D] · M` — As an operator, when I want to sell $X of a holding, see which
  lots to sell to minimize tax and avoid a wash sale (ties Epic 4.2).
  *AC:* ranks lots by tax efficiency; flags wash-sale risk; shows realized gain/loss of the proposal.
- **11.3 Trade what-if / position sizing** `[B] · M` — As an operator, model "if I buy $5k of X," see the
  resulting allocation, concentration, and cash impact before I act.
  *AC:* what-if updates allocation/concentration live; warns if it breaches a concentration threshold (Epic 3.5).
- **11.4 Contribution / DCA scheduler** `[D] · S` — As an operator, auto-allocate monthly surplus across
  accounts/targets on a schedule, as a reminder + pre-filled order list.
  *AC:* schedule derives from cash-flow surplus; respects target allocation; outputs a manual order list.
- **11.5 Trade journal** `[P] · S` — As an operator, log each trade's rationale and review outcomes over time.
  *AC:* entries link to holdings; outcome review shows realized result vs. thesis; private, local.
- **11.6 AI portfolio review** `[B] · M` — As an operator, the advisor (Epic 10) reasons over allocation, fees,
  concentration, and tax to surface *considerations* (with the not-advice boundary), optionally Claude-gated.
  *AC:* review references real holdings/figures; frames trade-offs, not directives; disclaimer attached.

---

## Recommended sequencing (consultant's call)

1. **Unlock the moat (Epics 1 + 2).** Both are cheap relative to impact, both deepen the *one thing HIVE is
   alone on* (cards), and Epic 2 is half-built in the data model already. Ship these first.
2. **Build the substrate (Epic 5 + push from backlog D3).** Receipts + push unblock protection claims,
   deductions, and every alert.
3. **Turn on the engine (Epic 6).** Consolidate signals; this is where retention/daily-open lives.
4. **Deepen wealth (Epic 3, then 4).** Portfolio analytics → FIRE → tax. Highest value to the operator's
   long game; heavier lift, so it follows once the daily-decision loop is tight.
5. **Crown it (Epic 7).** Health score reads from everything above, so it lands last and ties the dashboard
   together.

**Where the platform epics fit:** if the spreadsheet replacement is the priority (it is for the operator),
**Epic 8 is the keystone** — build it early and in parallel with the card moat, because Epics 9 (scenarios/
grad school), 10 (advisor), and 11 (trades) all stand on it. Suggested order within Part II:
**8 → 9 (grad school) → 10 (advisor) → 11 (trades)**. Epic 10's tool layer is what makes the whole thing feel
like an adviser rather than a set of forms, so it's the highest-leverage single investment once 8+9 exist.

## Explicitly out of scope (and why)
- **Securities recommendations / price prediction / auto-trading** — Epic 11 is decision-support for the
  operator's own intent only; HIVE is not a broker-dealer or RIA and ships a "not investment advice" disclaimer.
- **Filing taxes / regulated advice** — Epic 4 reports and estimates only; the line stays where the backlog drew it.
- **Bill-negotiation / cancellation concierge** — a human service, off-mission (backlog already declines).
- **Cloud document AI / third-party OCR** — Epic 5 OCR stays local; sending receipts off the NUC breaks the wedge.
- **Bureau credit-score pull** — still a cost/privacy trade-off; manual-entry tracking only if at all (backlog C6).
