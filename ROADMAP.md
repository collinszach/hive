# HIVE — Product Roadmap
# "Monarch on Steroids" — Full Vision Build Plan

> **PM Brief:** Monarch is clean but passive — it records what happened.
> HIVE should feel like a financial operating system that *thinks with you*.
> Every screen should answer a question before you ask it.
> AI is not a feature. It's the foundation.

---

## Competitive Positioning

| Feature | Monarch | HIVE Target |
|---|---|---|
| Transaction sync | ✅ Plaid | ✅ Plaid + cursor-based |
| Auto-categorization | ✅ Rule-based | ✅ 3-stage AI pipeline |
| Budgets | ✅ Monthly | ✅ Monthly + rollover + envelope |
| Net worth | ✅ Basic | ✅ + projections + investment breakdown |
| Recurring detection | ✅ Manual | ✅ Auto ML-detected |
| Subscription tracker | ❌ | ✅ Auto-detect + price alerts |
| Cash flow forecast | ❌ | ✅ 30/60/90 day ML forecast |
| Safe to spend | ✅ Basic | ✅ Intelligent + paycheck-aware |
| Credit card optimizer | ❌ | ✅ Real-time at-checkout rankings |
| Points/rewards engine | ❌ | ✅ Full earn tracking + CPP valuation |
| Merchant analytics | ❌ | ✅ Per-merchant spend history + trends |
| Custom reports | ✅ Limited | ✅ Full custom date ranges + YoY |
| Tax categories | ❌ | ✅ Deductible flag + export |
| AI chat | ❌ | ✅ Claude Sonnet with memory |
| Proactive AI insights | ❌ | ✅ Weekly feed, contextual nudges |
| Goal tracking | ✅ | ✅ + ML projections + savings rate |
| Bill calendar | ❌ | ✅ Visual upcoming bills |
| Self-hosted | ❌ | ✅ Docker Compose, your server |
| Privacy | ❌ (cloud) | ✅ No third-party data sharing |
| Anomaly detection | ❌ | ✅ IsolationForest ML |
| Scenario planning | ❌ | ✅ "What if I save $X/month?" |

---

## Information Architecture (Final State)

```
HIVE
├── Dashboard          ← Financial command center
├── Cash Flow          ← 30/60/90 day income vs expense
├── Transactions       ← Full ledger, rules, bulk actions
├── Budgets            ← Monthly + rollover + envelope
├── Subscriptions      ← Auto-detected recurring charges
├── Bills              ← Calendar of upcoming payments
├── Merchants          ← Per-merchant analytics
├── Points             ← Rewards engine + optimizer
├── Goals              ← Financial goals + projections
├── Net Worth          ← Balance sheet + projections
├── Reports            ← Custom reports, YoY, tax export
├── Insights           ← AI chat + proactive feed
├── Anomalies          ← ML-flagged transaction review
├── Connect            ← Account management
├── Account / Security ← Profile, MFA, audit log
└── Settings           ← Rules, categories, notifications
```

---

## Phase 10: Dashboard Intelligence (P0)
**Goal:** Dashboard becomes a true financial command center. Every number has context.

### 10.1 — Safe to Spend Engine
The single most important number in personal finance.

**Logic:**
```
safe_to_spend = monthly_take_home
              - fixed_bills_remaining_this_month
              - budget_allocated_remaining
              - savings_goal_amount
              - (days_remaining / days_in_month) * variable_buffer
```

**UI:** Prominent hero card at top of dashboard.
- Large number: "You can safely spend **$847** this week"
- Subtext: "Based on $2,340 remaining income, $1,493 in upcoming bills"
- Tap to see the math breakdown
- Changes color: green (plenty), amber (tight), red (overspent)

### 10.2 — AI Insights Feed
Replace the static "recent transactions" with a live intelligence feed.

**Card types:**
- 🔴 **Anomaly Alert** — "Unusual charge: $340 at Best Buy (3x your normal)"
- 🟡 **Budget Warning** — "Dining is 78% used with 12 days left"
- 🟢 **Reward Opportunity** — "Use Amex Gold for groceries today — you're $40 from 4x threshold"
- 💡 **Pattern Insight** — "You spend 40% more on weekends. Last 3 months."
- 📅 **Bill Alert** — "Netflix charges in 3 days ($15.99)"
- 🎯 **Goal Progress** — "Emergency fund: 67% complete. On track for August."
- 📊 **Monthly Wrap** — "Last month you spent $312 less than your budget. Best month in 6."

**Data requirements:** Backend needs a `GET /api/insights` endpoint that generates 5–8 cards using:
- Transaction data + budget data + anomaly scores
- Pre-computed by Celery task daily + on-demand

### 10.3 — Dashboard Layout Redesign
```
[Safe to Spend]          [Net Cash / Net Worth Delta]

[AI Insights Feed — horizontal scroll cards]

[KPI Row: Assets | Liabilities | Monthly Spend | Points Value]

[Account Cards]          [Budget Pulse — top 5 categories]

[Bill Calendar — next 7 days]

[Recent Transactions]    [Points Programs]
```

### 10.4 — Sparkline Animations
- Net worth: 30-day sparkline mini chart inline in KPI tile
- Monthly spend: 6-month bar sparkline
- Points: 90-day earned trend line
- Use recharts `<Sparkline>` or SVG path

**Backend work needed:**
- `GET /api/dashboard/summary` — enhanced with insights, safe_to_spend, upcoming_bills
- `GET /api/insights` — AI-generated insight cards (Celery daily + on-demand)

---

## Phase 11: Transactions — Power User Mode (P0)

### 11.1 — Custom Categorization Rules UI
Monarch's best feature. Essential for power users.

**Page:** `/settings/rules`

**Rule structure:**
```
IF merchant_name contains "Whole Foods"
THEN category = "Groceries", subcategory = "In-Store"
```

**Features:**
- Add/edit/delete rules
- Drag to reorder (priority matters — first match wins)
- Test a rule against existing transactions
- "Apply rule retroactively" toggle
- Rule types: contains, starts_with, equals, regex, amount_range
- Bulk apply rules to uncategorized transactions

**Backend:** `custom_rules` table + rule engine that runs before regex stage in categorizer

### 11.2 — Transaction Side Drawer
Tap any transaction → rich detail panel slides in from the right.

**Contents:**
- Merchant logo (large)
- Full merchant name + normalized name
- Date + time (if available from Plaid)
- Amount (large)
- Category editor (dropdown)
- Notes field (freeform)
- Tags (e.g., "business", "tax-deductible", "split")
- Reimbursement status toggle
- "Similar transactions" (last 5 from same merchant)
- AI explanation: "This is 2.3x higher than your typical Whole Foods visit"
- Map location (if lat/lng available from Plaid)
- Points earned on this transaction

### 11.3 — Bulk Actions
- Multi-select transactions (checkbox column)
- Bulk categorize
- Bulk tag
- Bulk mark as excluded
- Bulk mark as reimbursable

### 11.4 — Smart Groupings (sidebar filters)
- **Subscriptions** — recurring monthly charges
- **This Trip** — transactions in a date+location cluster
- **Unusual** — ML-flagged anomalies
- **Uncategorized** — needs attention
- **Reimbursable** — pending expense reimbursement
- **Tax Deductible** — tagged for taxes

### 11.5 — Transaction Search (Natural Language)
- "show me all Uber rides last month" → parses and applies filters
- "largest purchases this year" → sorts by amount desc, current year
- Powered by Claude via `/api/transactions/search` NL endpoint

---

## Phase 12: Cash Flow Intelligence (P0)

**New page: `/cash-flow`**

The most underbuilt feature in personal finance apps. People want to know:
1. Will I go negative before my next paycheck?
2. What months are expensive?
3. How does this month compare to last?

### 12.1 — Cash Flow Page Layout
```
[Time range: This Month | Last 3M | Last 6M | Last 12M]

[Hero Chart: Income bars (green) vs Expense bars (red) by month]

[Net cash flow line overlay]

[KPI row: Avg Monthly Income | Avg Monthly Spend | Avg Savings Rate]

[Category breakdown table: month-by-month for top categories]

[Paycheck timeline: next paycheck in X days, projected balance]
```

### 12.2 — Cash Flow Forecast (30/60/90 days)
Uses Prophet ML model (already built) + recurring transaction detection.

```
[Forecast chart: actual (solid) → projected (dashed)]

[Upcoming high-spend flags: "December historically +$800 over budget"]

[Month-end projection: "You'll end this month with +$420 cash"]
```

### 12.3 — Income Tracking
- Auto-detect income transactions (employer payroll, freelance, etc.)
- Monthly income summary
- Income vs expense ratio (savings rate)
- Irregular income handling (freelancers)

**Backend needed:**
- `GET /api/cash-flow/history?months=12` — monthly income/expense/net
- `GET /api/cash-flow/forecast?days=90` — projected cash flow using Prophet
- Income detection rule: amount > 0 on deposit accounts, certain merchants

---

## Phase 13: Subscription Tracker (P1)

**New page: `/subscriptions`**

Americans have an average of 12 subscriptions and forget most of them.

### 13.1 — Auto-Detection
ML + regex to identify recurring charges:
- Same merchant, similar amount, same interval (weekly/monthly/annual)
- Confidence score: "98% confident this is a monthly subscription"
- Flag new subscriptions: "New subscription detected: Adobe Creative Cloud $59.99"

**Subscription object:**
```python
{
  merchant: "Netflix",
  amount: 15.49,
  frequency: "monthly",
  next_charge_date: "2024-02-15",
  category: "Entertainment / Streaming",
  annual_cost: 185.88,
  card_used: "chase_sapphire",
  points_per_year: 557,  # 3x on streaming
  status: "active",      # active | paused | cancelled
  first_seen: "2022-03-12",
  price_history: [...]   # detect price increases
}
```

### 13.2 — Subscription Dashboard
```
[Total monthly subscriptions: $287.43 | Annual: $3,449]

[Category breakdown: Streaming $45 | Software $120 | News $30 | Health $92]

[Subscription cards: Netflix | Spotify | Adobe | Gym | etc.]

[Price change alerts: "Netflix increased from $13.99 → $15.49 in Oct"]

[Unused/low-use flagging: "You haven't used this in 60 days"]

[Cancel suggestions: Subscriptions with <1 transaction/month]
```

### 13.3 — Best Card for Each Subscription
Auto-suggest: "Use Chase Sapphire for Netflix — 3x vs your current 1x on Capital One"
Annual savings calculation: "Switching saves you ~$18/year in points value"

**Backend needed:**
- `subscriptions` table (materialized view from transactions)
- `GET /api/subscriptions` — all detected subscriptions
- `GET /api/subscriptions/alerts` — price changes, new detections, cancel suggestions
- Celery task: `detect_subscriptions()` — runs weekly

---

## Phase 14: Bill Calendar (P1)

**New page: `/bills`**

### 14.1 — Calendar View
Visual month calendar showing upcoming charges.

```
[Month view with bill dots on expected charge dates]

[List view: next 30 days of bills]
[Due Today] [Due This Week] [Due Next Week]

Netflix     Feb 15   $15.49   [Chase Sapphire]
Rent        Feb 1    $2,200   [Bilt Blue]      ← 1x, consider paying via Bilt
Electricity Feb 20   ~$120    [estimated]
Gym         Feb 28   $49.99   [WF Autograph]   ← 3x on gym? check rule
```

### 14.2 — Bill Intelligence
- Average amount for variable bills (electricity, phone)
- "Upcoming expensive month" warning (e.g., annual subscriptions)
- "You have $847 in bills due this week" summary
- Historical bill amounts (show last 6 payments)

### 14.3 — Dashboard Widget
7-day bill preview strip at bottom of dashboard:
```
[Feb 14 · Valentine's Day warning] [Feb 15 · Netflix $15] [Feb 20 · Electric ~$120]
```

**Backend needed:**
- Bill detection from subscription table + recurring transaction patterns
- `GET /api/bills/upcoming?days=30` endpoint
- Variable bill estimation using last 3 months average

---

## Phase 15: Merchant Analytics (P1)

**New page: `/merchants`**

Monarch has nothing like this. This is where power users live.

### 15.1 — Merchant List
```
[Search merchants]

[Sort: by spend | by frequency | by recency]

[Merchant cards:]
Whole Foods     $1,240 ytd | 23 visits | avg $53.91 | last: Jan 28
Amazon          $3,847 ytd | 67 orders | avg $57.42 | last: Feb 1
Uber Eats       $892 ytd   | 18 orders | avg $49.56 | last: Feb 3
```

### 15.2 — Merchant Detail Page (`/merchants/[id]`)
```
[Merchant logo + name + website]

[Spend over time: 12-month bar chart]

[Stats: total spend | visit count | avg transaction | most common day/time]

[All transactions from this merchant]

[Category override: "Always categorize as..."]

[Best card recommendation: "Use Amex Gold here (4x dining)"]
```

### 15.3 — Merchant Intelligence
- "You've spent $1,240 at Whole Foods this year — 23 visits"
- "Your Whole Foods spend increased 34% since last year"
- "Best day to shop: Wednesday (avg $12 less than weekend)"
- "You could earn 4x points by switching from WF Autograph to Amex Gold"

**Backend needed:**
- `GET /api/merchants` — aggregated merchant list with stats
- `GET /api/merchants/{merchant_name}` — detail with transaction history
- `POST /api/merchants/{merchant_name}/rule` — create category override rule

---

## Phase 16: Advanced Reports (P1)

**New page: `/reports`**

### 16.1 — Report Builder
```
[Report type: Spending | Income | Net Worth | Cash Flow | Points]

[Date range: preset (MTD, YTD, Last 3M, Last 12M) | custom picker]

[Group by: Category | Merchant | Month | Account]

[Filters: category | account | tags | min/max amount]

[Visualization: Table | Bar chart | Pie chart | Line chart]

[Export: CSV | PDF]
```

### 16.2 — Preset Reports
- **Annual Spending Summary** — full year by category, month-over-month
- **Year over Year** — this year vs last year by category
- **Tax Report** — all transactions flagged as tax-deductible, by category
- **Subscription Audit** — all recurring charges with annual totals
- **Points Earned** — points by card, by category, by month
- **Merchant Summary** — top 20 merchants by spend
- **Weekend vs Weekday** — spending pattern analysis

### 16.3 — Tax Overlay
- Tag transactions as "tax-deductible" with category (home office, medical, charitable, business)
- Export tax report: Category → total → transaction list
- Schedule C categories for self-employed

**Backend needed:**
- `GET /api/reports/spending?start=&end=&group_by=&category=` — flexible aggregation
- `GET /api/reports/tax?year=` — deductible transactions grouped
- `transaction_tags` junction table for tagging system
- PDF generation via weasyprint or similar

---

## Phase 17: Goal Tracking (P1)

**New page: `/goals`**

### 17.1 — Goal Types
- **Savings goal** — "Emergency fund: $15,000 by Dec 2024"
- **Debt payoff** — "Pay off Chase card: $4,200 remaining"
- **Big purchase** — "New car: $8,000 down payment by June"
- **Investment target** — "Max 401k: $23,000/year"
- **Net worth milestone** — "Reach $100k net worth"

### 17.2 — Goal Card
```
[Goal name + icon]
[$8,420 / $15,000]           ← current / target
[══════════════░░░░]  56%
[On track · ~7 months to goal]
[Based on $312/month average contribution]

[Milestones: 25% ✅ 50% ✅ 75% ⬜ 100% ⬜]
```

### 17.3 — "What If" Simulator
- "If I contribute $500/month → goal reached in 4 months (saves 3 months)"
- Interactive slider for monthly contribution
- Shows compound growth for investment goals

### 17.4 — Savings Rate Dashboard
- Auto-calculate: (income - expenses) / income
- Historical savings rate chart
- Target savings rate input
- "To hit your 20% savings goal, you need to cut $340/month"

**Backend needed:**
- `goals` table (type, name, target_amount, current_amount, target_date, account_id)
- `GET /api/goals`, `POST /api/goals`, `PUT /api/goals/{id}`
- `GET /api/goals/{id}/projection` — ML-powered timeline projection
- Auto-update goal progress from net worth snapshots

---

## Phase 18: Net Worth Intelligence (P2)

**Enhance existing `/net-worth` page.**

### 18.1 — Net Worth Projections
```
[Current chart (existing)]

[Projection toggle: 1Y | 3Y | 5Y | 10Y]

[Projection bands: conservative | moderate | optimistic]
"At your current savings rate, you'll reach $500k in ~6 years"

[Assumptions editor: expected return % | monthly savings | inflation]
```

### 18.2 — Asset Allocation View
- Breakdown: Cash | Investments | Real Estate | Other
- Debt breakdown: Credit cards | Student loans | Mortgage | Auto
- "Ideal allocation" comparison (60/40, emergency fund recommendation)

### 18.3 — Milestone Timeline
- "$100k net worth — achieved Jan 2024 ✅"
- "$200k net worth — projected Aug 2025 🔜"
- "Financial independence ($2M) — projected 2041 🔮"

---

## Phase 19: AI Intelligence Layer (P0 — runs throughout)

AI is not a page. It's a layer on top of everything.

### 19.1 — Proactive Insights (already partially in Phase 10)
Backend Celery task: `generate_insights()` — runs daily at 7am

**Insight generation logic:**
```python
insights = []
# Budget warnings (> 80% used with > 7 days left)
# Unusual transactions (anomaly score > 0.7)
# New subscriptions detected
# Price increases on existing subscriptions
# Upcoming expensive months (next 30 days vs historical)
# Reward opportunities (category spending patterns)
# Goal progress updates
# Monthly wrap (1st of month)
# Savings rate change
```

### 19.2 — Contextual AI on Every Page
Each page has an "AI context bar" or inline suggestions:

- **Transactions page:** "You have 23 uncategorized transactions from last month. Categorize now?"
- **Budgets page:** "Your dining budget is always exceeded. Raise it to $600 based on 6-month average?"
- **Points page:** "You could earn $420 more per year by switching to Amex Gold for groceries"
- **Net Worth page:** "Your net worth grew $2,340 this month — your best month in 8 months"
- **Reports page:** "Your taxes may be simpler this year — only 4 potential deductions found"

### 19.3 — Enhanced Chat (Insights page)
Move beyond Q&A to an AI financial advisor:

**New capabilities:**
- **Memory:** Chat remembers previous conversations (store in DB)
- **Data grounding:** Always queries live transaction data before answering
- **Proactive:** "I noticed something while you were away — want to hear it?"
- **Scheduled reports:** "Send me a weekly summary every Sunday"
- **Action execution:** "Set a $500 dining budget for March" → actually does it

**Suggested prompts upgrade:**
- Dynamic suggestions based on your actual data
- "Your [top merchant] spending is up — want to talk about it?"
- Rotate weekly to stay fresh

### 19.4 — Natural Language Everywhere
- Transaction search: "show me all food delivery this year"
- Budget creation: "create a $300/month entertainment budget"
- Report generation: "show my spending vs last year"
- Goal creation: "I want to save $10k for vacation by July"

---

## Phase 20: Settings & Customization (P2)

**New page: `/settings`**

### 20.1 — Categorization Rules
(From Phase 11.1 — custom rules UI)

### 20.2 — Notifications
- Email/push alert preferences
- Budget threshold alerts (e.g., at 75%, 90%, 100%)
- Anomaly alerts
- New subscription detected
- Bill due in X days
- Goal milestone reached
- Weekly summary email
- Monthly wrap email

### 20.3 — Category Management
- Rename categories
- Hide/show categories in reports
- Merge categories (e.g., "Coffee" and "Cafe" → "Coffee")
- Custom category creation

### 20.4 — Data Management
- Import CSV (standard format)
- Export all transactions (CSV, JSON)
- Export annual report (PDF)
- Bulk delete (date range)
- Account exclusion management

### 20.5 — Savings Rate & Income Setup
- Monthly income input (if not auto-detected)
- Pay frequency (biweekly, monthly, etc.)
- Savings targets
- "Financial independence number" calculator

---

## Phase 21: Mobile & PWA (P2)

HIVE runs on a NUC. Users will check it on their phone.

### 21.1 — Mobile Responsive (all pages)
- Dashboard: single column, swipeable cards
- Transactions: compact row format, tap to expand
- Safe to spend: prominent hero card
- Quick add: "log a transaction manually"

### 21.2 — PWA Manifest
- Add to home screen
- Splash screen with HIVE brand
- Offline: show cached dashboard data
- Push notifications via service worker

### 21.3 — Quick Actions (mobile FAB)
Floating action button:
- Log manual transaction
- Check card optimizer
- Ask AI a question
- View today's budget status

---

## Phase 22: Power User Features (P3)

### 22.1 — Keyboard Shortcuts
- `T` → Jump to Transactions
- `B` → Jump to Budgets
- `N` → Jump to Net Worth
- `I` → Jump to Insights
- `S` → Sync now
- `/` → Search anywhere
- `?` → Show keyboard shortcuts overlay

### 22.2 — Split Transactions
- Split one transaction into multiple categories
- Common use: grocery store where some items are household, some personal

### 22.3 — Reimbursement Tracking
- Mark transactions as "to be reimbursed by [person/company]"
- Track outstanding reimbursements
- "John owes you $234 from 3 transactions"

### 22.4 — Multi-Currency
- Foreign transaction display in USD + original currency
- Exchange rate at time of transaction (from Plaid)
- "You spent ¥45,000 ($302) in Japan last month"

### 22.5 — Investment Dashboard
Via SnapTrade API:
- Portfolio value + daily change
- Asset allocation pie chart
- Holdings list with P&L
- "Investment accounts make up 34% of your net worth"

---

## Technical Debt & Infrastructure (Ongoing)

### DB Additions Required
```sql
-- Custom rules
CREATE TABLE categorization_rules (
    id UUID PRIMARY KEY,
    match_type TEXT NOT NULL,    -- 'contains', 'starts_with', 'regex', 'exact'
    match_value TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    priority INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    merchant TEXT NOT NULL UNIQUE,
    detected_amount NUMERIC(12,2),
    frequency TEXT,              -- 'monthly', 'annual', 'weekly'
    next_charge_date DATE,
    annual_cost NUMERIC(12,2),
    status TEXT DEFAULT 'active',-- 'active', 'cancelled'
    account_id UUID REFERENCES accounts(id),
    card_slug TEXT,
    first_seen_date DATE,
    price_history JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals
CREATE TABLE goals (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,          -- 'savings', 'debt_payoff', 'purchase', 'net_worth'
    target_amount NUMERIC(14,2) NOT NULL,
    current_amount NUMERIC(14,2) DEFAULT 0,
    target_date DATE,
    account_id UUID REFERENCES accounts(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction tags
CREATE TABLE transaction_tags (
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,           -- 'tax-deductible', 'business', 'reimbursable', 'split'
    note TEXT,
    PRIMARY KEY (transaction_id, tag)
);

-- Insights feed
CREATE TABLE insights (
    id UUID PRIMARY KEY,
    type TEXT NOT NULL,          -- 'anomaly', 'budget_warning', 'reward_opportunity', etc.
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',     -- links to transactions, amounts, etc.
    priority INT DEFAULT 5,      -- 1-10, higher = more important
    read BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat history
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY,
    messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### New API Endpoints
```
# Dashboard
GET  /api/dashboard/summary      (enhanced with insights, safe_to_spend, upcoming_bills)
GET  /api/insights               → paginated insight cards

# Cash Flow
GET  /api/cash-flow/history?months=12
GET  /api/cash-flow/forecast?days=90

# Subscriptions
GET  /api/subscriptions
GET  /api/subscriptions/alerts
POST /api/subscriptions/{id}/cancel

# Bills
GET  /api/bills/upcoming?days=30

# Merchants
GET  /api/merchants?sort=spend&limit=50
GET  /api/merchants/{name}

# Goals
GET  /api/goals
POST /api/goals
PUT  /api/goals/{id}
GET  /api/goals/{id}/projection

# Reports
GET  /api/reports/spending?start=&end=&group_by=
GET  /api/reports/tax?year=

# Rules
GET  /api/rules
POST /api/rules
PUT  /api/rules/{id}
DELETE /api/rules/{id}
POST /api/rules/{id}/apply-retroactive

# Tags
POST /api/transactions/{id}/tags
DELETE /api/transactions/{id}/tags/{tag}
```

---

## Build Priority Matrix

| Phase | Feature | Impact | Effort | Priority |
|---|---|---|---|---|
| 10 | Safe to Spend | ⭐⭐⭐⭐⭐ | M | P0 |
| 10 | AI Insights Feed | ⭐⭐⭐⭐⭐ | L | P0 |
| 11 | Custom Rules UI | ⭐⭐⭐⭐⭐ | M | P0 |
| 11 | Transaction Drawer | ⭐⭐⭐⭐ | M | P0 |
| 12 | Cash Flow Page | ⭐⭐⭐⭐⭐ | L | P0 |
| 13 | Subscription Tracker | ⭐⭐⭐⭐⭐ | L | P1 |
| 14 | Bill Calendar | ⭐⭐⭐⭐ | M | P1 |
| 15 | Merchant Analytics | ⭐⭐⭐⭐ | L | P1 |
| 16 | Reports | ⭐⭐⭐⭐ | XL | P1 |
| 17 | Goal Tracking | ⭐⭐⭐⭐ | L | P1 |
| 18 | NW Projections | ⭐⭐⭐ | M | P2 |
| 19 | AI Layer | ⭐⭐⭐⭐⭐ | XL | P0 ongoing |
| 20 | Settings | ⭐⭐⭐ | L | P2 |
| 21 | Mobile/PWA | ⭐⭐⭐⭐ | XL | P2 |
| 22 | Power Features | ⭐⭐⭐ | XL | P3 |

---

## Recommended Build Order

**Sprint 1 (Build now — max impact):**
1. Safe to Spend engine + dashboard card
2. AI Insights feed (backend + dashboard widget)
3. Transaction drawer (slide-in panel)
4. Custom categorization rules UI

**Sprint 2 (Core intelligence):**
5. Cash Flow page (income vs expense by month)
6. Subscription auto-detection + tracker page
7. Bill calendar page + dashboard widget
8. Bulk transaction actions

**Sprint 3 (Analytics depth):**
9. Merchant analytics page
10. Reports builder (preset reports first)
11. Goal tracking page
12. Transaction tags + tax export

**Sprint 4 (NW + AI depth):**
13. Net worth projections
14. AI contextual nudges on every page
15. Enhanced chat with memory + data grounding
16. Natural language everywhere

**Sprint 5 (Polish + power):**
17. Settings page (rules, notifications, categories)
18. Mobile responsive pass
19. Keyboard shortcuts
20. Split transactions + reimbursement

---

## Design Principles (non-negotiable)

1. **Every number has context.** Never show a number without telling me if it's good or bad.
2. **AI is invisible.** It should feel like the app just knows things, not like there's a chatbot.
3. **One tap to act.** Every insight should have an actionable button.
4. **Zero dead ends.** Empty states always have a clear next action.
5. **Mobile-first data, desktop-first layout.** The data must work on a phone; the layout is optimized for a big screen.
6. **Speed over everything.** Static generation where possible, skeleton states everywhere, never a blank page.
7. **Honey color = actionable.** Gold = "pay attention to this, you can do something."
8. **Quiet confidence.** The interface should feel like a calm expert, not a busy dashboard.
