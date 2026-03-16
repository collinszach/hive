# SPEC.md — Full Technical Specification

## Database Schema (Complete)

### accounts
```sql
CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plaid_account_id TEXT UNIQUE,            -- NULL for manual/SnapTrade accounts
    plaid_item_id   TEXT,                    -- Plaid Item this account belongs to
    name            TEXT NOT NULL,
    official_name   TEXT,
    institution     TEXT NOT NULL,
    type            TEXT NOT NULL,           -- 'credit', 'depository', 'investment'
    subtype         TEXT,                    -- 'credit card', 'checking', 'savings', 'brokerage'
    card_slug       TEXT,                    -- 'amex_gold', 'chase_sapphire', etc. NULL for non-cards
    current_balance NUMERIC(12,2),
    available_balance NUMERIC(12,2),
    credit_limit    NUMERIC(12,2),           -- for credit cards
    currency        TEXT DEFAULT 'USD',
    mask            TEXT,                    -- last 4 digits
    last_synced     TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    is_excluded     BOOLEAN DEFAULT FALSE,   -- TRUE for savings (no spend analytics)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### plaid_links
```sql
CREATE TABLE plaid_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         TEXT UNIQUE NOT NULL,    -- Plaid Item ID
    access_token    TEXT NOT NULL,           -- encrypted at rest in production
    institution_id  TEXT,
    institution_name TEXT,
    sync_cursor     TEXT,                    -- last successful /transactions/sync cursor
    last_sync_at    TIMESTAMPTZ,
    last_sync_error TEXT,                    -- last error message if sync failed
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### transactions
```sql
CREATE TABLE transactions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plaid_transaction_id  TEXT UNIQUE,               -- NULL for manually added transactions
    account_id            UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date                  DATE NOT NULL,
    authorized_date       DATE,
    amount                NUMERIC(12,2) NOT NULL,    -- positive = spend/debit, negative = credit/payment
    currency              TEXT DEFAULT 'USD',
    merchant              TEXT,                       -- cleaned merchant name from Plaid
    raw_description       TEXT NOT NULL,              -- original description from bank
    category              TEXT,
    subcategory           TEXT,
    category_source       TEXT DEFAULT 'pending',     -- 'sql_rule','ollama','claude','manual','plaid','pending'
    plaid_category        TEXT[],                     -- original Plaid category array
    is_transfer           BOOLEAN DEFAULT FALSE,      -- TRUE for Venmo, Zelle, bank transfers
    is_excluded           BOOLEAN DEFAULT FALSE,      -- TRUE for transfers + manually excluded
    reimbursement_note    TEXT,                       -- "company expense", "split with spouse", etc.
    pending               BOOLEAN DEFAULT FALSE,
    payment_channel       TEXT,                       -- 'online', 'in store', 'other'
    location_address      TEXT,
    location_city         TEXT,
    location_state        TEXT,
    location_zip          TEXT,
    logo_url              TEXT,                       -- merchant logo from Plaid
    website               TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_account_date ON transactions(account_id, date DESC);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_category ON transactions(category) WHERE is_excluded = FALSE;
CREATE INDEX idx_transactions_pending ON transactions(pending) WHERE pending = TRUE;
```

### budgets
```sql
CREATE TABLE budgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category        TEXT NOT NULL,
    month           DATE NOT NULL,           -- first day of the month (2024-01-01)
    budget_amount   NUMERIC(12,2) NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category, month)
);
```

### earn_rules
```sql
CREATE TABLE earn_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_slug   TEXT NOT NULL,
    category    TEXT,                        -- NULL = matches any category (base rate rule)
    subcategory TEXT,                        -- NULL = matches any subcategory
    earn_rate   NUMERIC(5,2) NOT NULL,
    program     TEXT NOT NULL,               -- 'Amex MR', 'Chase UR', etc.
    notes       TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_earn_rules_card ON earn_rules(card_slug) WHERE is_active = TRUE;
```

### points_ledger
```sql
CREATE TABLE points_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts(id),
    card_slug       TEXT NOT NULL,
    program         TEXT NOT NULL,
    points_earned   NUMERIC(12,2) NOT NULL,
    earn_rate       NUMERIC(5,2) NOT NULL,
    category        TEXT,
    subcategory     TEXT,
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(transaction_id)                   -- one ledger entry per transaction
);
```

### points_balances
```sql
CREATE TABLE points_balances (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_slug   TEXT NOT NULL,
    program     TEXT NOT NULL,
    balance     BIGINT NOT NULL,             -- integer points
    as_of       DATE NOT NULL,
    source      TEXT DEFAULT 'manual',       -- 'manual' or 'api'
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(card_slug, as_of)
);
```

### net_worth_snapshots
```sql
CREATE TABLE net_worth_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date   DATE NOT NULL UNIQUE,
    total_assets    NUMERIC(14,2) NOT NULL,
    total_liabilities NUMERIC(14,2) NOT NULL,
    net_worth       NUMERIC(14,2) GENERATED ALWAYS AS (total_assets - total_liabilities) STORED,
    breakdown       JSONB NOT NULL DEFAULT '{}',  -- {"amex_gold": -1234.56, "checking": 5000.00}
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### anomalies
```sql
CREATE TABLE anomalies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    anomaly_score   NUMERIC(6,4) NOT NULL,   -- higher = more anomalous
    reason          TEXT NOT NULL,            -- human-readable explanation
    features        JSONB,                   -- raw feature values used for detection
    status          TEXT DEFAULT 'unreviewed', -- 'unreviewed', 'ok', 'confirmed'
    reviewed_at     TIMESTAMPTZ,
    flagged_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(transaction_id)
);
```

### Materialized View
```sql
CREATE MATERIALIZED VIEW mv_monthly_category_spend AS
SELECT
    DATE_TRUNC('month', t.date)::DATE AS month,
    t.category,
    COUNT(*) AS transaction_count,
    SUM(t.amount) AS total_spent,
    b.budget_amount,
    CASE
        WHEN b.budget_amount > 0
        THEN ROUND((SUM(t.amount) / b.budget_amount) * 100, 1)
        ELSE NULL
    END AS pct_used,
    MAX(t.date) AS last_transaction_date
FROM transactions t
LEFT JOIN budgets b
    ON b.category = t.category
    AND b.month = DATE_TRUNC('month', t.date)::DATE
WHERE
    t.is_excluded = FALSE
    AND t.is_transfer = FALSE
    AND t.pending = FALSE
    AND t.amount > 0
    AND t.category IS NOT NULL
GROUP BY
    DATE_TRUNC('month', t.date)::DATE,
    t.category,
    b.budget_amount;

CREATE UNIQUE INDEX ON mv_monthly_category_spend(month, category);
```

---

## Python Dependencies (requirements.txt)

```txt
# Web framework
fastapi==0.115.0
uvicorn[standard]==0.31.0
pydantic==2.9.0
pydantic-settings==2.5.0

# Database
sqlalchemy==2.0.35
asyncpg==0.29.0
alembic==1.13.3
psycopg2-binary==2.9.9  # for Celery sync access

# Task queue
celery==5.4.0
redis==5.1.1

# Plaid
plaid-python==26.3.0

# AI / ML
anthropic==0.37.0
httpx==0.27.2          # for Ollama HTTP calls
scikit-learn==1.5.2
prophet==1.1.6
pandas==2.2.3
numpy==1.26.4

# Utils
python-dotenv==1.0.1
python-multipart==0.0.12  # for form data
tenacity==9.0.0          # retry logic

# Dev
pytest==8.3.3
pytest-asyncio==0.24.0
pytest-cov==5.0.0
black==24.10.0
isort==5.13.2
```

---

## Docker Compose Services

### Service Dependency Order
```
postgres → (redis, backend dependencies)
redis → (backend, celery_worker, celery_beat)
backend → (celery_worker, celery_beat, nginx)
frontend → nginx
```

### Resource Limits (for NUC)
```yaml
# Backend + celery: limit to 1 CPU, 512MB each
# ML tasks: can spike to 2 CPU during Prophet/sklearn runs
# Postgres: 512MB RAM, SSD storage
# Frontend: 256MB RAM
```

---

## Plaid Integration Details

### Link Flow (Frontend → Backend)
```
1. User clicks "Connect Account"
2. Frontend: POST /api/plaid/link-token → gets link_token
3. Frontend: opens Plaid Link UI with link_token
4. User: logs into their bank in Plaid Link
5. Frontend: receives public_token from Plaid Link onSuccess callback
6. Frontend: POST /api/plaid/exchange-token {public_token, institution_name}
7. Backend: calls /item/public_token/exchange → gets access_token + item_id
8. Backend: calls /accounts/get → saves all accounts
9. Backend: saves plaid_link record with access_token + empty cursor
10. Backend: triggers sync_all_accounts task immediately
```

### Sync Flow (Daily, Cursor-Based)
```python
def sync_transactions(access_token, cursor):
    has_more = True
    added, modified, removed = [], [], []
    
    while has_more:
        response = client.transactions_sync(
            access_token=access_token,
            cursor=cursor or "",
            count=500,
            options=TransactionsSyncRequestOptions(
                include_original_description=True,
                include_logo_and_counterparty_beta=True
            )
        )
        added.extend(response.added)
        modified.extend(response.modified)
        removed.extend(response.removed)
        has_more = response.has_more
        cursor = response.next_cursor
    
    return added, modified, removed, cursor
```

---

## Ollama Prompt (Stage 2 Categorizer)

```python
SYSTEM_PROMPT = """You are a financial transaction categorizer. You output ONLY valid JSON.
No explanations. No markdown. No preamble. Just the JSON object.

Available categories and subcategories:
- Food & Drink: Restaurant, Fast Food, Coffee, Delivery, Bar
- Groceries: In-Store, Online  
- Travel: Flights, SW Flights, Hotel, Car Rental, Rideshare, Cruise
- Transportation: Gas, EV Charging, Parking, Tolls, Transit, Auto Service
- Entertainment: Streaming, Movies, Events, Gaming, Sports
- Shopping: General, Clothing, Electronics, Amazon, Home Goods
- Health: Medical, Pharmacy, Gym, Dental, Vision
- Utilities: Electric, Internet, Phone, Water, Insurance
- Home: Rent, Mortgage, Furniture, Repairs, Garden
- Education: Tuition, Books, Courses
- Personal Care: Haircut, Spa
- Business: Office, Software, Advertising
- Transfers: P2P
- Uncategorized: (use only as last resort)

DISAMBIGUATION RULES:
- Costco/Sam's Club → Groceries / In-Store (NOT Shopping)
- Amazon → if description contains "fresh" → Groceries/Online, else Shopping/Amazon
- Uber → if description contains "eats" → Food & Drink/Delivery, else Travel/Rideshare
- Any Southwest Airlines → Travel / SW Flights (NOT Flights)
- Any flight that is NOT Southwest → Travel / Flights
- Any P2P payment app → Transfers / P2P"""

USER_PROMPT = """Transaction: "{description}"
Respond with exactly: {{"category": "...", "subcategory": "..."}}"""
```

---

## Claude API Usage

### Categorization (Haiku, Batch)
```python
# Collect all uncategorized transactions, submit as batch
# Use claude-haiku-4-5 model
# Max tokens: 50 per transaction (just needs JSON output)
# System prompt: same as Ollama prompt above
# Temperature: 0 (deterministic)
```

### Chat Interface (Sonnet, Streaming)
```python
FINANCIAL_CONTEXT_TEMPLATE = """
You are a personal financial advisor with real-time access to the user's financial data.

## Current Month Summary ({month})
{spending_by_category}

## Budget Status
{budget_status}

## Account Balances
{account_balances}

## Points Summary
{points_summary}

## Recent Anomalies
{anomaly_summary}

Answer questions about spending patterns, budget status, points optimization, and provide
actionable financial insights. Be specific with numbers. If asked about the best card for
a purchase, use the card optimizer logic: recommend based on effective CPP.
Be concise — 2-4 sentences unless asked for detail.
"""
# Use prompt caching: cache the system prompt (financial context changes daily, not per-message)
# Model: claude-sonnet-4-6
# Max tokens: 1024
# Stream: True for chat feel
```

---

## Frontend Component Specs

### BudgetGauge Component
```tsx
// Props: category, spent, budget, transactionCount
// Visual: circular progress or horizontal bar
// Colors: 
//   < 70%: green (text-green-600, bg-green-100)
//   70-90%: yellow (text-yellow-600, bg-yellow-100)  
//   90-100%: orange (text-orange-600, bg-orange-100)
//   > 100%: red (text-red-600, bg-red-100)
// Shows: "$X of $Y" and "X% used"
// Click: navigates to /transactions?category=X&month=current
```

### CardOptimizer Component
```tsx
// Primary use: accessed on mobile at checkout
// Inputs: Category (dropdown), Subcategory (dynamic based on category), Amount (number input)
// Output: Ranked list of cards
//   - Winner: large card with green border, "BEST CHOICE" badge
//   - Others: smaller cards showing multiplier, points, dollar value
// Extra: shows "You'll earn X points worth ~$Y"
// Mobile-first design: large touch targets, readable at arm's length
```

### TransactionTable Component
```tsx
// Columns: Date, Merchant, Category (editable), Amount, Account, Points Earned
// Excluded transactions: shown with strikethrough + gray text + "Excluded" badge
// Pending transactions: shown with italic + "Pending" badge
// Category edit: click category cell → dropdown appears → select → auto-saves
// Points: show only for credit card transactions
// Row colors: transfers gray, large amounts highlighted, anomalies have warning icon
```

---

## Environment Variables Reference

See `.env.example` for the complete list with descriptions.

Key groupings:
- `POSTGRES_*` — database connection
- `REDIS_URL` — broker URL  
- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` — bank connectivity
- `ANTHROPIC_API_KEY` — Claude API
- `SNAPTRADE_*` — investment accounts
- `OLLAMA_URL` — local LLM
- `SECRET_KEY` — FastAPI session signing

---

## Error Handling Patterns

### Celery Task Retry
```python
@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=300,  # 5 minutes
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def sync_account(self, plaid_link_id: str):
    try:
        ...
    except PlaidApiException as e:
        if e.status == 400 and "ITEM_LOGIN_REQUIRED" in str(e):
            # Mark link as needing re-auth, don't retry
            mark_link_error(plaid_link_id, "ITEM_LOGIN_REQUIRED")
            return
        raise self.retry(exc=e)
```

### Ollama Fallback
```python
async def categorize_transaction(description: str, plaid_data: dict):
    # Stage 1
    result = _categorize_with_rules(description)
    if result:
        return (*result, "sql_rule")
    
    # Stage 2 - timeout after 8 seconds
    try:
        result = await asyncio.wait_for(_categorize_with_ollama(description), timeout=8.0)
        if result and result[0] != "Uncategorized":
            return (*result, "ollama")
    except (asyncio.TimeoutError, Exception) as e:
        logger.warning(f"Ollama failed for '{description}': {e}")
    
    # Stage 3 - Claude fallback (accumulate and batch)
    # Don't call Claude inline — add to batch queue, process hourly
    return ("Uncategorized", None, "pending_claude")
```
