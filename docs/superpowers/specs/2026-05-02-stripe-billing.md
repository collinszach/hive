# Stripe Billing & Subscription Integration — Design Spec
**Date:** 2026-05-02
**Supersedes:** 2026-04-19-paywall-design.md
**Status:** Approved — execute immediately
**Scope:** Backend billing API, Stripe webhook, feature gates, frontend billing page + upgrade flow.

---

## 1. Business Model

> Anything that costs real money per user costs the user. Everything local stays free.

**Costs money:** Plaid connections, Claude API calls.  
**Free always:** Ollama AI, Prophet, IsolationForest, manual accounts, all local compute, budgets, points, reports.

### Tiers

| Feature | Free | Starter $9/mo | Pro $19/mo |
|---|---|---|---|
| Manual accounts (unlimited) | ✓ | ✓ | ✓ |
| Budgets & analytics | ✓ | ✓ | ✓ |
| Ollama AI categorization | ✓ | ✓ | ✓ |
| Anomaly detection | ✓ | ✓ | ✓ |
| Forecasting | ✓ | ✓ | ✓ |
| Points tracking | ✓ | ✓ | ✓ |
| Tax export | ✓ | ✓ | ✓ |
| **Plaid connections** | ❌ | ✓ up to 3 | ✓ up to 10 |
| **Claude AI chat** | ❌ | ❌ | ✓ |
| **SnapTrade investments** | ❌ | ❌ | ✓ |

**Admin role:** Zach's account. Bypasses all gates. Unlimited everything.

---

## 2. Database

User model already has all required fields (confirmed in codebase):
```python
plan: PlanTier          # free | starter | pro (default: free)
stripe_customer_id: str | None
stripe_subscription_id: str | None
stripe_status: str | None   # active | canceled | past_due | trialing
plan_period_end: datetime | None
```

No new migrations needed for User model.

---

## 3. Backend

### 3.1 Feature Gates (`backend/app/gates.py`) — NEW FILE

```python
from fastapi import Depends, HTTPException
from app.api.auth import get_current_user
from app.models.user import User, UserRole, PlanTier

async def require_plaid(user: User = Depends(get_current_user)):
    if user.role == UserRole.admin:
        return user
    if user.plan not in (PlanTier.starter, PlanTier.pro):
        raise HTTPException(402, detail={"message": "Plaid sync requires Starter or Pro plan.", "gate": "plaid"})
    return user

async def require_claude(user: User = Depends(get_current_user)):
    if user.role == UserRole.admin:
        return user
    if user.plan != PlanTier.pro:
        raise HTTPException(402, detail={"message": "Claude AI requires Pro plan.", "gate": "claude"})
    return user

async def require_snaptrade(user: User = Depends(get_current_user)):
    if user.role == UserRole.admin:
        return user
    if user.plan != PlanTier.pro:
        raise HTTPException(402, detail={"message": "Investment tracking requires Pro plan.", "gate": "snaptrade"})
    return user

PLAID_LIMITS = {PlanTier.free: 0, PlanTier.starter: 3, PlanTier.pro: 10}

async def check_plaid_limit(user: User = Depends(require_plaid), db = Depends(get_db)):
    if user.role == UserRole.admin:
        return user
    from sqlalchemy import select, func
    from app.models.plaid_link import PlaidLink
    count_result = await db.execute(select(func.count()).where(PlaidLink.user_id == user.id, PlaidLink.is_active == True))
    count = count_result.scalar()
    limit = PLAID_LIMITS.get(user.plan, 0)
    if count >= limit:
        raise HTTPException(402, detail={"message": f"Plan limit reached ({limit} Plaid connections).", "gate": "plaid_limit", "limit": limit, "used": count})
    return user
```

Apply gates in existing routers:
- `backend/app/api/plaid_link.py`: `POST /api/plaid/link-token` → `Depends(require_plaid)`, `POST /api/plaid/exchange-token` → `Depends(check_plaid_limit)`
- `backend/app/api/chat.py`: inline check `if user.plan != PlanTier.pro and user.role != UserRole.admin` → return 402 with `gate: claude`
- `backend/app/api/accounts.py` (SnapTrade endpoints): `Depends(require_snaptrade)`

### 3.2 Billing API (`backend/app/api/billing.py`) — NEW FILE

```python
# Endpoints:
GET  /api/billing/status    → BillingStatus
POST /api/billing/checkout  → CheckoutRequest → { url: str }
POST /api/billing/portal    → PortalRequest → { url: str }
POST /api/billing/webhook   → raw body (public, Stripe-verified)
```

**BillingStatus response:**
```python
{
  "plan": "free" | "starter" | "pro",
  "stripe_status": str | None,
  "period_end": str | None,  # ISO datetime
  "plaid_used": int,
  "plaid_limit": int,        # 0 | 3 | 10 | 999 (admin)
  "claude_enabled": bool,
  "snaptrade_enabled": bool,
}
```

**POST /api/billing/checkout:**
- Creates Stripe customer if `user.stripe_customer_id` is None
- Creates Stripe Checkout Session (`mode="subscription"`)
- Price IDs from env: `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`
- `success_url = APP_BASE_URL + "/billing?success=true"`
- `cancel_url = APP_BASE_URL + "/billing"`
- Returns `{"url": session.url}`

**POST /api/billing/portal:**
- Creates Stripe Customer Portal session for existing subscriber
- Returns `{"url": session.url}`

**POST /api/billing/webhook:**
- Raw body, verified via `stripe.WebhookSignature.verify_header(payload, sig_header, STRIPE_WEBHOOK_SECRET)`
- Handles events:
  - `checkout.session.completed` → update `plan`, `stripe_subscription_id`, `stripe_status = "active"`
  - `customer.subscription.updated` → update `stripe_status`, `plan_period_end`, and plan based on price ID
  - `customer.subscription.deleted` → set `plan = "free"`, `stripe_status = "canceled"`
  - `invoice.payment_failed` → set `stripe_status = "past_due"`
- Returns `{"received": True}` (always 200 to Stripe)

### 3.3 Admin API additions (`backend/app/api/admin.py`) — ADD TO EXISTING FILE

```python
# Both endpoints require role == admin
GET  /api/admin/users        → list of UserAdminView
PATCH /api/admin/users/{id}  → { plan?, role?, is_active? } → updated UserAdminView
```

UserAdminView: `{ id, username, role, plan, stripe_status, is_active, last_login_at, created_at }`

### 3.4 Register `billing` router in `main.py`

```python
from app.api.billing import router as billing_router
app.include_router(billing_router, prefix="/api/billing", tags=["billing"])
```

### 3.5 Environment Variables

Add to `.env.example`:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
APP_BASE_URL=https://hive.zacharyjcollins.com
```

### 3.6 Dependencies

Add to `backend/requirements.txt`:
```
stripe>=8.0.0
```

---

## 4. Frontend

### 4.1 New Page: `/billing`

**Route:** `frontend/src/app/(app)/billing/page.tsx`

Sections:
1. **Current plan card** (`hive-card-featured`) — plan name, status badge, period end date, "Manage Billing" button → POST `/api/billing/portal`
2. **Usage card** (`hive-card`) — Plaid connections used/limit (animated bar), Claude enabled badge, SnapTrade enabled badge
3. **Plan comparison** — 3 cards (Free / Starter / Pro) with feature lists. Current plan highlighted with blue border. CTA button on non-current plans → POST `/api/billing/checkout`
4. **Success toast** — if `?success=true` in URL, show "Subscription activated!" toast on mount

### 4.2 Modified: `UpgradeModal.tsx` (already exists)

Update to read the `gate` field from 402 response body and show relevant copy:
```
gate: "plaid"        → "Bank sync requires Starter or Pro. Starting at $9/mo."
gate: "plaid_limit"  → "You've reached your Plaid connection limit. Upgrade to connect more accounts."
gate: "claude"       → "Claude AI chat requires Pro plan. Upgrade for $19/mo."
gate: "snaptrade"    → "Investment tracking requires Pro plan."
```
CTA: "View Plans →" → navigates to `/billing`.

### 4.3 Modified: `/connect` page

When Plaid link-token returns 402 with `gate: plaid` or `gate: plaid_limit`, show inline upgrade prompt instead of generic error. The prompt is a `hive-card` with gate-specific copy and a "Upgrade Plan →" link to `/billing`.

### 4.4 Modified: `/account` page — Admin section

Add admin-only section (shown when `user.role == "admin"`):
- Fetch `GET /api/admin/users`
- Table: username | role | plan | stripe_status | last_login | active toggle
- Plan dropdown per row → PATCH `/api/admin/users/{id}` with `{ plan }`
- Active toggle → PATCH with `{ is_active }`

### 4.5 Add `/billing` to Sidebar navigation

Add "Billing" link to the bottom-pinned section of the sidebar (above Settings).

---

## 5. `authedFetch` 402 Handling

In `frontend/src/lib/api.ts`, extend the fetch wrapper:
```ts
if (res.status === 402) {
  const body = await res.json().catch(() => ({}));
  // Dispatch custom event so UpgradeModalProvider can show modal
  window.dispatchEvent(new CustomEvent('hive:upgrade-required', { detail: body }));
  throw new UpgradeRequiredError(body);
}
```

`UpgradeModalProvider` listens for `hive:upgrade-required` and opens `UpgradeModal`.

---

## 6. Stripe Setup (Manual — Zach does this before testing)

1. Create two products in Stripe dashboard: "Starter" ($9/mo) and "Pro" ($19/mo)
2. Copy price IDs → `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`
3. Add webhook endpoint: `https://api.zacharyjcollins.com/api/billing/webhook`
4. Set `STRIPE_WEBHOOK_SECRET` from Stripe dashboard
5. Add all 5 env vars to `.env` on the NUC

---

## 7. Files In Scope

**Create:**
- `backend/app/gates.py`
- `backend/app/api/billing.py`
- `frontend/src/app/(app)/billing/page.tsx`

**Modify:**
- `backend/app/api/plaid_link.py` — add gate dependencies
- `backend/app/api/chat.py` — add Claude gate check
- `backend/app/api/accounts.py` — add SnapTrade gate
- `backend/app/api/admin.py` — add user management endpoints (create file if not exists)
- `backend/app/main.py` — register billing router
- `backend/requirements.txt` — add stripe
- `frontend/src/lib/api.ts` — 402 handling
- `frontend/src/components/UpgradeModal.tsx` — gate-aware copy
- `frontend/src/app/(app)/connect/page.tsx` — inline upgrade prompt on 402
- `frontend/src/app/(app)/account/page.tsx` — admin section
- `frontend/src/components/Sidebar.tsx` — add Billing link

---

## 8. What Is NOT Built

- Trial periods
- Annual pricing toggle
- Multi-seat / team plans
- Proration UI (Stripe handles automatically)
- Email receipts (Stripe handles)
