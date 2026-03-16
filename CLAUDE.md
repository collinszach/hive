# Finance Platform — CLAUDE.md
# READ THIS FIRST on every session. This is the source of truth.

## What We're Building
A self-hosted personal finance intelligence platform running on a home Ubuntu NUC server via
Docker Compose. It automatically pulls transactions daily from all linked bank and credit card
accounts via the Plaid API — no CSV imports ever. It categorizes transactions using a three-stage
AI pipeline, tracks points earned on each credit card, shows spending vs. budget, detects
anomalous transactions with ML, forecasts future spending, and provides an AI chat interface
for natural language financial questions.

## Infrastructure
- **Server:** Ubuntu NUC (home lab) — all Docker Compose services run here
- **Dev machine:** MacBook Pro — used for development and remote access via Tailscale
- **Remote access:** Tailscale VPN (no ports exposed to internet)
- **NUC Tailscale hostname:** nuc.tailnet-xyz.ts.net (user will update with real hostname)
- **Ollama:** Runs on the NUC HOST at port 11434 — NOT inside Docker
  - Installed via: `curl -fsSL https://ollama.com/install.sh | sh && ollama pull llama3.2`
  - Access from Docker containers via: `http://host.docker.internal:11434`

## Tech Stack
| Layer | Technology |
|---|---|
| Backend API | FastAPI + Uvicorn |
| Task queue | Celery + Redis broker |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 (async) + Alembic migrations |
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui |
| Bank data | Plaid Transactions Sync API (cursor-based, incremental) |
| Investment data | SnapTrade API |
| AI categorization | Ollama (llama3.2) → Claude Haiku 4.5 (fallback) |
| AI chat/analysis | Claude Sonnet 4.6 with prompt caching |
| Anomaly detection | scikit-learn IsolationForest |
| Forecasting | Prophet (Facebook) |
| Reverse proxy | Nginx |
| Containerization | Docker Compose |

## Accounts Being Tracked
### Credit Cards (6)
| Card | Slug | Points Program |
|---|---|---|
| Amex Gold | `amex_gold` | Amex Membership Rewards (MR) |
| Chase Sapphire Preferred | `chase_sapphire` | Chase Ultimate Rewards (UR) |
| Chase Southwest Plus | `chase_southwest` | Southwest Rapid Rewards (RR) |
| Bilt Blue | `bilt_blue` | Bilt Points |
| Wells Fargo Autograph | `wf_autograph` | Wells Fargo Rewards |
| Capital One Venture X | `venture_x` | Capital One Miles |

### Bank Accounts (2)
- Checking account (balance + transactions, but Venmo/Zelle MUST be excluded from spend analytics)
- Savings account (balance only — no spending analytics)

### Investment Accounts
- Brokerage/retirement via SnapTrade (separate from Plaid)

## Critical Business Rules (NEVER VIOLATE)
1. **Deduplication is load-bearing.** All transactions use `plaid_transaction_id` as a UNIQUE
   constraint. Never bypass or duplicate this. Use upserts, never blind inserts.

2. **Venmo and Zelle are ALWAYS excluded.** Any transaction where `raw_description` matches
   `/venmo|zelle|cash app/i` must have `is_transfer=TRUE` and `is_excluded=TRUE`. These must
   NEVER appear in spending analytics, budget calculations, or category totals.

3. **Southwest Airlines must match "SW Flights" subcategory**, NOT the generic "Flights"
   subcategory. Pattern: `/southwest airlines?/i` → category="Travel", subcategory="SW Flights".
   This is critical for correct 3x earn rate on the Chase Southwest card.

4. **Earn rule matching priority:**
   1. Exact subcategory match (card_slug + category + subcategory)
   2. Category-only match (card_slug + category, subcategory IS NULL in rule)
   3. Base rate (card_slug only, category IS NULL in rule)

5. **Pending transactions** are stored but excluded from all budget/spend calculations.
   Field: `pending=TRUE`.

6. **Savings account** is balance-only — never run spending analytics against it.

7. **Plaid cursor must be persisted** after every sync. Store in `plaid_links.sync_cursor`.
   Never do a full pull when incremental is available.

## Directory Structure
```
finance-platform/
├── CLAUDE.md                    ← You are here
├── BUILD_PLAN.md                ← Current phase tracker
├── SPEC.md                      ← Full technical specification
├── .env.example                 ← All required environment variables
├── .env                         ← Real secrets (never commit, never read aloud)
├── docker-compose.yml           ← Full stack definition
├── docker-compose.dev.yml       ← Dev overrides (hot reload, exposed ports)
├── nginx/
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── main.py              ← FastAPI app entry point
│       ├── config.py            ← Settings (pydantic-settings)
│       ├── db.py                ← DB engine, session factory
│       ├── celery_app.py        ← Celery instance + beat schedule
│       ├── models/
│       │   ├── __init__.py
│       │   ├── account.py
│       │   ├── transaction.py
│       │   ├── budget.py
│       │   ├── earn_rule.py
│       │   ├── points_ledger.py
│       │   ├── points_balance.py
│       │   ├── net_worth.py
│       │   ├── anomaly.py
│       │   └── plaid_link.py
│       ├── api/
│       │   ├── __init__.py
│       │   ├── dashboard.py
│       │   ├── transactions.py
│       │   ├── budgets.py
│       │   ├── points.py
│       │   ├── accounts.py
│       │   ├── plaid_link.py    ← Link token creation + exchange
│       │   └── chat.py
│       ├── plaid/
│       │   ├── __init__.py
│       │   └── connector.py
│       ├── ml/
│       │   ├── __init__.py
│       │   ├── categorizer.py   ← 3-stage pipeline
│       │   ├── transfer_detector.py
│       │   ├── anomaly_detector.py
│       │   └── forecaster.py
│       ├── points/
│       │   ├── __init__.py
│       │   └── tracker.py       ← Earn rules + optimizer
│       └── tasks/
│           ├── __init__.py
│           ├── ingestion.py     ← Daily sync task
│           ├── points.py        ← Points ledger compute
│           ├── ml_tasks.py      ← Anomaly + forecast tasks
│           └── maintenance.py   ← View refresh, snapshots
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tailwind.config.ts
    ├── components.json          ← shadcn/ui config
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx         ← Dashboard (spending, budgets, balances)
        │   ├── transactions/
        │   │   └── page.tsx
        │   ├── budgets/
        │   │   └── page.tsx
        │   ├── points/
        │   │   └── page.tsx
        │   ├── optimize/        ← Card optimizer (use at checkout)
        │   │   └── page.tsx
        │   ├── net-worth/
        │   │   └── page.tsx
        │   └── chat/
        │       └── page.tsx
        ├── components/
        │   ├── ui/              ← shadcn/ui primitives
        │   ├── BudgetGauge.tsx
        │   ├── SpendingChart.tsx
        │   ├── PointsCard.tsx
        │   ├── CardOptimizer.tsx
        │   ├── AnomalyAlert.tsx
        │   ├── TransactionTable.tsx
        │   └── NetWorthChart.tsx
        └── lib/
            ├── api.ts           ← Typed API client
            └── utils.ts
```

## Key File Descriptions

### `app/config.py`
Use `pydantic-settings`. All config from environment variables. No hardcoded values ever.

### `app/db.py`
- Async SQLAlchemy engine using `asyncpg`
- `AsyncSession` dependency for FastAPI
- Sync session for Celery tasks (Celery doesn't support async natively)

### `app/celery_app.py`
- Celery instance with Redis broker
- Beat schedule defined here (not in a separate config file)
- All tasks imported here so beat discovers them

### `app/models/transaction.py`
Source of truth for transaction schema. All analytics queries derive from this.

### `app/plaid/connector.py`
- Only uses `/transactions/sync` (cursor-based). NEVER `/transactions/get`.
- Handles pagination (has_more loop)
- Returns added, modified, removed separately

### `app/ml/categorizer.py`
Three-stage pipeline — must always try in order and fall through:
1. SQL/regex rule engine (instant, free)
2. Ollama llama3.2 (local, free, ~80% of cases)
3. Claude Haiku 4.5 via Batch API (fallback, cheap)

### `app/points/tracker.py`
Contains the full earn rules table as Python dataclasses AND functions:
- `get_best_card_for_purchase(category, subcategory, amount)` → ranked list
- `compute_points_for_transaction(transaction)` → points earned

## Points Earn Rules (Complete)
```python
# Amex Gold
("amex_gold", "Food & Drink", "Restaurant", 4.0, "Amex MR")
("amex_gold", "Food & Drink", "Fast Food", 4.0, "Amex MR")
("amex_gold", "Groceries", "In-Store", 4.0, "Amex MR")
("amex_gold", "Groceries", "Online", 4.0, "Amex MR")
("amex_gold", "Travel", "Flights", 3.0, "Amex MR")
("amex_gold", None, None, 1.0, "Amex MR")  # base

# Chase Sapphire Preferred
("chase_sapphire", "Travel", None, 3.0, "Chase UR")
("chase_sapphire", "Food & Drink", "Restaurant", 3.0, "Chase UR")
("chase_sapphire", "Food & Drink", "Fast Food", 3.0, "Chase UR")
("chase_sapphire", "Food & Drink", "Delivery", 3.0, "Chase UR")
("chase_sapphire", "Groceries", "Online", 3.0, "Chase UR")
("chase_sapphire", "Entertainment", "Streaming", 3.0, "Chase UR")
("chase_sapphire", None, None, 1.0, "Chase UR")  # base

# Chase Southwest Plus
("chase_southwest", "Travel", "SW Flights", 3.0, "SW RR")   # MUST be SW Flights, not Flights
("chase_southwest", "Travel", None, 2.0, "SW RR")
("chase_southwest", None, None, 1.0, "SW RR")  # base

# Bilt Blue
("bilt_blue", "Home", "Rent", 1.0, "Bilt Points")           # 1x on rent (no fee on rent payments)
("bilt_blue", "Food & Drink", "Restaurant", 3.0, "Bilt Points")
("bilt_blue", "Travel", None, 2.0, "Bilt Points")
("bilt_blue", None, None, 1.0, "Bilt Points")  # base

# Wells Fargo Autograph
("wf_autograph", "Travel", None, 3.0, "WF Rewards")
("wf_autograph", "Food & Drink", "Restaurant", 3.0, "WF Rewards")
("wf_autograph", "Food & Drink", "Fast Food", 3.0, "WF Rewards")
("wf_autograph", "Transportation", "Gas", 3.0, "WF Rewards")
("wf_autograph", "Transportation", "EV Charging", 3.0, "WF Rewards")
("wf_autograph", "Transportation", "Transit", 3.0, "WF Rewards")
("wf_autograph", "Transportation", "Parking", 3.0, "WF Rewards")
("wf_autograph", "Transportation", "Tolls", 3.0, "WF Rewards")
("wf_autograph", "Entertainment", None, 3.0, "WF Rewards")
("wf_autograph", "Utilities", "Phone", 3.0, "WF Rewards")
("wf_autograph", None, None, 1.0, "WF Rewards")  # base

# Capital One Venture X
("venture_x", "Travel", "Hotel", 10.0, "Capital One Miles")  # via C1 portal
("venture_x", "Travel", "Flights", 5.0, "Capital One Miles") # via C1 portal
("venture_x", "Travel", None, 2.0, "Capital One Miles")
("venture_x", None, None, 2.0, "Capital One Miles")  # 2x everywhere (best base rate)
```

## Points-to-Dollar Valuations (cents per point)
```python
POINT_VALUES_CPP = {
    "Amex MR": 2.0,        # transferred to airline/hotel partners
    "Chase UR": 2.05,       # transferred to Hyatt/United
    "SW RR": 1.4,
    "Bilt Points": 2.1,     # highest transfer bonus potential
    "WF Rewards": 1.0,      # cash back equivalent
    "Capital One Miles": 1.85,
}
```

## Transaction Taxonomy (Category → Subcategory)
```
Food & Drink    → Restaurant, Fast Food, Coffee, Delivery, Bar, Groceries
Groceries       → In-Store, Online
Travel          → Flights, SW Flights, Hotel, Car Rental, Rideshare, Cruise
Transportation  → Gas, EV Charging, Parking, Tolls, Transit, Auto Service
Entertainment   → Streaming, Movies, Events, Gaming, Sports
Shopping        → General, Clothing, Electronics, Amazon, Home Goods
Health          → Medical, Pharmacy, Gym, Dental, Vision
Utilities       → Electric, Internet, Phone, Water, Insurance
Home            → Rent, Mortgage, Furniture, Repairs, Garden
Education       → Tuition, Books, Courses
Personal Care   → Haircut, Spa, Clothing
Transfers       → P2P (Venmo/Zelle — always excluded), Payment, Refund
Business        → Office, Software, Advertising
Uncategorized   → (fallback only)
```

## Regex Categorization Rules (Stage 1)
These MUST be checked in order. First match wins.
```python
# High-specificity rules first
(r"(?i)(southwest airlines?)", "Travel", "SW Flights"),
(r"(?i)(delta air|united airlines?|american airlines?|jetblue|spirit airlines?|frontier airlines?)", "Travel", "Flights"),
(r"(?i)(marriott|hilton|hyatt|ihg|wyndham|best western|airbnb|vrbo)", "Travel", "Hotel"),
(r"(?i)(uber eats|doordash|grubhub|instacart delivery|postmates)", "Food & Drink", "Delivery"),
(r"(?i)(starbucks|dunkin|blue bottle|philz|peet)", "Food & Drink", "Coffee"),
(r"(?i)(mcdonald|burger king|wendy|chick-fil-a|subway|chipotle|taco bell|popeyes|kfc|five guys)", "Food & Drink", "Fast Food"),
(r"(?i)(whole foods|trader joe|kroger|safeway|heb|publix|wegmans|aldi|costco|sam.s club)", "Groceries", "In-Store"),
(r"(?i)(amazon fresh|instacart|walmart grocery|shipt)", "Groceries", "Online"),
(r"(?i)(netflix|spotify|hulu|disney\+|hbo max|apple\.com/bill|peacock|paramount)", "Entertainment", "Streaming"),
(r"(?i)(cvs|walgreens|rite aid|duane reade)", "Health", "Pharmacy"),
(r"(?i)(venmo|zelle|cash app|paypal transfer)", "Transfers", "P2P"),  # → is_excluded=TRUE
(r"(?i)(tesla supercharger|blink charging|chargepoint|evgo|electrify america)", "Transportation", "EV Charging"),
(r"(?i)(mta|cta|bart|wmata|metro|clipper card|transit)", "Transportation", "Transit"),
(r"(?i)(spothero|parkwhiz|parking meter|parkmobile)", "Transportation", "Parking"),
(r"(?i)(shell|bp|exxon|chevron|mobil|sunoco|speedway|circle k|wawa gas)", "Transportation", "Gas"),
(r"(?i)(uber|lyft|waymo)(?! eats)", "Travel", "Rideshare"),
(r"(?i)(amazon\.com|amazon mktp)", "Shopping", "Amazon"),
(r"(?i)(planet fitness|equinox|la fitness|orange theory|peloton)", "Health", "Gym"),
```

## Celery Beat Schedule
```python
beat_schedule = {
    "daily-sync":           crontab(hour=6,  minute=0),   # Pull all accounts
    "daily-points":         crontab(hour=6,  minute=30),  # Recompute points ledger
    "daily-anomaly":        crontab(hour=7,  minute=0),   # Run IsolationForest
    "daily-net-worth":      crontab(hour=7,  minute=30),  # Snapshot balances
    "refresh-views":        crontab(hour=8,  minute=0),   # REFRESH MATERIALIZED VIEW
    "weekly-forecast":      crontab(hour=9,  minute=0, day_of_week=1),  # Prophet forecast
}
```

## API Endpoints Reference
```
GET  /api/dashboard/summary          → spending, budgets, balances, anomalies, points
GET  /api/transactions               → paginated, filterable transaction list
PUT  /api/transactions/{id}/category → manual category override
GET  /api/budgets                    → all budgets for current month
POST /api/budgets                    → create/update budget
GET  /api/points/summary             → total points per program + estimated dollar value
GET  /api/points/optimize            → card optimizer: ?category=&subcategory=&amount=
GET  /api/accounts                   → all linked accounts with current balances
POST /api/plaid/link-token           → create Plaid Link token (frontend calls this)
POST /api/plaid/exchange-token       → exchange public_token after Link flow
GET  /api/net-worth/history          → daily net worth snapshots
GET  /api/anomalies                  → unreviewed flagged transactions
POST /api/anomalies/{id}/review      → mark anomaly as reviewed
POST /api/chat                       → AI Q&A about finances
GET  /api/forecast/{category}        → Prophet forecast for a category
```

## Frontend Pages
| Route | Purpose | Priority |
|---|---|---|
| `/` | Dashboard: budget dials, account balances, anomaly alerts, points summary | P0 |
| `/transactions` | Full transaction table with filter, search, manual categorization | P0 |
| `/budgets` | Budget manager — set monthly budgets by category | P0 |
| `/optimize` | Card optimizer — enter merchant/category/amount, get ranked cards | P0 |
| `/points` | Points ledger, balances per program, redemption nudge when threshold hit | P1 |
| `/net-worth` | Balance sheet chart over time | P1 |
| `/anomalies` | ML-flagged transactions to review | P1 |
| `/chat` | Natural language AI interface for finance questions | P2 |

## Redemption Nudge Thresholds
Show a banner on `/points` when balance exceeds:
```python
REDEMPTION_THRESHOLDS = {
    "Chase UR":           60_000,
    "Amex MR":            75_000,
    "SW RR":              50_000,
    "Bilt Points":        50_000,
    "Capital One Miles":  75_000,
    "WF Rewards":         25_000,
}
```

## Code Standards
- **Python:** 3.11+, type hints everywhere, async FastAPI endpoints, sync Celery tasks
- **Formatting:** Black + isort
- **No print statements** — use Python `logging` module
- **All secrets** from environment variables via `config.py` (pydantic-settings)
- **All DB access** through SQLAlchemy ORM — no raw SQL strings in business logic
  (Raw SQL only in materialized view definitions and complex analytics queries)
- **Frontend:** TypeScript strict mode, no `any` types
- **Tests:** pytest for backend, vitest for frontend (write tests for ML pipeline and points logic)

## What To Do When Stuck
1. Check `.env.example` — is the variable set in `.env`?
2. Check `docker compose logs [service]` for the failing container
3. For Plaid errors — check that `PLAID_ENV=development` and tokens are from the right environment
4. For Ollama errors — check `curl http://host.docker.internal:11434/api/tags` from inside the container
5. For DB errors — check `alembic upgrade head` was run after schema changes
