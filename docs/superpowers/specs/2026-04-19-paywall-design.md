# Paywall & Billing System — Design Spec
**Date:** 2026-04-19  
**Status:** Approved — build immediately

---

## Business Model

### Core Principle
> Anything that costs Zach money costs the user money. Everything local/free stays free.

**Costs money:** Plaid connections ($0.30–0.50/item/month), Claude API calls.  
**Free:** Ollama AI, Prophet forecasting, scikit-learn anomaly detection, manual accounts, all local compute.

---

## Tiers

| Feature | Free | Starter $9/mo | Pro $19/mo | Admin |
|---|---|---|---|---|
| Manual accounts (unlimited) | ✓ | ✓ | ✓ | ✓ |
| Budgets & spending analytics | ✓ | ✓ | ✓ | ✓ |
| Ollama AI categorization | ✓ | ✓ | ✓ | ✓ |
| Ollama AI chat | ✓ | ✓ | ✓ | ✓ |
| Anomaly detection (ML) | ✓ | ✓ | ✓ | ✓ |
| Forecasting (Prophet) | ✓ | ✓ | ✓ | ✓ |
| Points tracking | ✓ | ✓ | ✓ | ✓ |
| Tax export | ✓ | ✓ | ✓ | ✓ |
| **Plaid connections** | ❌ 0 | ✓ up to 3 | ✓ up to 10 | ✓ unlimited |
| **Claude AI** | ❌ | ❌ | ✓ | ✓ |
| **SnapTrade investments** | ❌ | ❌ | ✓ | ✓ |

**Admin role:** Zach's account. Bypasses all gates. Full user management dashboard.

---

## Technical Architecture

### Database — User model additions
```python
class PlanTier(str, enum.Enum):
    free    = "free"
    starter = "starter"
    pro     = "pro"

# Added columns to users table:
plan                  Text (enum)  default="free"
stripe_customer_id    Text         nullable
stripe_subscription_id Text        nullable
stripe_status         Text         nullable  # active | canceled | past_due | trialing
plan_period_end       DateTime     nullable
```

### Feature Gates (`app/gates.py`)
FastAPI dependencies injected into route handlers:

- `require_plaid` — plan in (starter, pro) OR role == admin. Returns 402 with `{"detail": "...", "gate": "plaid"}` if denied.
- `require_claude` — plan == pro OR role == admin. Returns 402 with `{"gate": "claude"}`.
- `require_snaptrade` — plan == pro OR role == admin. Returns 402 with `{"gate": "snaptrade"}`.
- `check_plaid_limit(user, db)` — enforces per-plan Plaid link count (free=0, starter=3, pro=10, admin=∞).

Gates are applied as `Depends()` on existing endpoints:
- `POST /api/plaid/link-token` → `require_plaid`
- `POST /api/plaid/exchange-token` → `require_plaid` + `check_plaid_limit`
- `POST /api/snaptrade/*` → `require_snaptrade`
- Chat `use_claude=True` → gate check inline, fall back to Ollama with 402 header if not Pro

### Billing API (`app/api/billing.py`)
All authenticated except webhook:

```
GET  /api/billing/status    → { plan, status, period_end, plaid_used, plaid_limit }
POST /api/billing/checkout  → { plan: "starter"|"pro", return_url } → { url }
POST /api/billing/portal    → { return_url } → { url }
POST /api/billing/webhook   → Stripe webhook (public, verified by signature)
```

Webhook handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

### Admin API additions (`app/api/admin.py`)
Requires `role == admin`:

```
GET   /api/admin/users          → [{ id, username, role, plan, stripe_status, is_active, last_login_at }]
PATCH /api/admin/users/{id}     → { plan?, role?, is_active? } → updated user
```

### Environment Variables (add to .env.example)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
APP_BASE_URL=https://hive.zacharyjcollins.com
```

### Dependencies
- Add `stripe` to `backend/requirements.txt`

---

## Frontend

### New Pages
- `/pricing` — public, 3-column tier comparison with Stripe checkout buttons
- `/billing` — authenticated, shows current plan, usage (Plaid connections used/limit), upgrade/downgrade button, Stripe portal button

### Modified Pages
- `/account` — add Admin section (role == admin only): paginated user table with plan dropdown + active toggle
- `/connect` — when Plaid limit hit (402 with `gate: plaid`), show inline upgrade prompt instead of error

### New Component: `UpgradeModal`
- Triggered by any 402 response from `authedFetch`
- Reads `gate` field from error body to show relevant copy
- Links to `/pricing` or directly to checkout

### 402 Handling in `authedFetch`
Extend to: if `res.status === 402` → read body, emit upgrade event or show modal. Do NOT redirect to login.

---

## Admin Seeding
The `users` table `server_default` is already `"admin"` for `role`. The first registered user is already admin. A one-time migration ensures any existing user with the original username remains `admin` role.

---

## Stripe Setup (manual — Zach does this)
1. Create two products in Stripe dashboard: "Starter" ($9/mo) and "Pro" ($19/mo)
2. Copy price IDs → `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`
3. Add webhook endpoint: `https://nuc-tailscale-url/api/billing/webhook`
4. Set `STRIPE_WEBHOOK_SECRET` from Stripe dashboard

---

## What Is NOT Built
- Trial periods (add later if needed)
- Annual pricing (add later)
- Multi-seat / team plans
- Proration UI (Stripe handles it automatically)
