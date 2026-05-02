# Stripe Billing & Subscription Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Stripe subscription billing with feature gates — Free/Starter($9)/Pro($19) tiers, checkout flow, webhook handler, billing management page, and admin user management.

**Architecture:** FastAPI gates.py dependency injections on existing routes, billing.py API for Stripe operations, frontend /billing page for plan management, UpgradeModal triggered by 402 responses.

**Tech Stack:** Python/FastAPI, stripe>=7.0.0 (already in requirements.txt), Next.js 15, TypeScript strict

---

## Codebase Status (verified before writing this plan)

The following already exist and are **complete — do not recreate or overwrite**:
- `backend/app/models/user.py` — `PlanTier` enum (free/starter/pro), all Stripe fields on `User` model
- `backend/requirements.txt` — `stripe>=7.0.0` already present
- `backend/app/api/admin.py` — has `purge_all_data`, may have user management (check before adding)
- `backend/app/config.py` — may already have Stripe settings (check before adding)
- `frontend/src/components/UpgradeModal.tsx` — already exists with gate-aware copy
- `frontend/src/components/UpgradeModalProvider.tsx` — listens on `"upgrade-required"` event

The following **do not exist** and must be created:
- `backend/app/gates.py`
- `backend/app/api/billing.py`
- `frontend/src/app/(app)/billing/page.tsx`

The following need **targeted modifications** (read before editing):
- `backend/app/main.py` — add billing router + webhook public path
- `backend/app/api/chat.py` — add Claude plan gate
- `backend/app/config.py` — add Stripe settings if not present
- `frontend/src/lib/api.ts` — add 402 event dispatch
- `frontend/src/components/UpgradeModal.tsx` — update CTA to `/billing`
- `frontend/src/app/(app)/connect/page.tsx` — add 402 upgrade card
- `frontend/src/components/Sidebar.tsx` — add Billing nav link

---

## Task 1: Create `backend/app/gates.py`

**Files:**
- Create: `backend/app/gates.py`

- [ ] **Step 1.1 — Check if gates.py already exists**

  ```bash
  ls /home/zach/hive/backend/app/gates.py 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"
  ```
  If it exists, read it and skip to step 1.3.

- [ ] **Step 1.2 — Create gates.py**

  Create `/home/zach/hive/backend/app/gates.py`:

  ```python
  """Feature gates as FastAPI dependencies — injected on protected routes."""
  from fastapi import Depends, HTTPException
  from sqlalchemy import func, select
  from sqlalchemy.ext.asyncio import AsyncSession

  from app.api.auth import get_current_user
  from app.db import get_db
  from app.models.plaid_link import PlaidLink
  from app.models.user import PlanTier, User, UserRole

  PLAID_LIMITS: dict[PlanTier, int] = {
      PlanTier.free: 0,
      PlanTier.starter: 3,
      PlanTier.pro: 10,
  }


  async def require_plaid(user: User = Depends(get_current_user)) -> User:
      if user.role == UserRole.admin:
          return user
      if user.plan not in (PlanTier.starter, PlanTier.pro):
          raise HTTPException(
              status_code=402,
              detail={"message": "Plaid bank sync requires Starter or Pro plan.", "gate": "plaid"},
          )
      return user


  async def require_claude(user: User = Depends(get_current_user)) -> User:
      if user.role == UserRole.admin:
          return user
      if user.plan != PlanTier.pro:
          raise HTTPException(
              status_code=402,
              detail={"message": "Claude AI chat requires Pro plan.", "gate": "claude"},
          )
      return user


  async def require_snaptrade(user: User = Depends(get_current_user)) -> User:
      if user.role == UserRole.admin:
          return user
      if user.plan != PlanTier.pro:
          raise HTTPException(
              status_code=402,
              detail={"message": "Investment account tracking requires Pro plan.", "gate": "snaptrade"},
          )
      return user


  async def check_plaid_limit(
      user: User = Depends(require_plaid),
      db: AsyncSession = Depends(get_db),
  ) -> User:
      if user.role == UserRole.admin:
          return user
      result = await db.execute(
          select(func.count())
          .select_from(PlaidLink)
          .where(PlaidLink.is_active.is_(True))
      )
      count = result.scalar() or 0
      limit = PLAID_LIMITS.get(user.plan, 0)
      if count >= limit:
          raise HTTPException(
              status_code=402,
              detail={
                  "message": f"You've reached your limit of {limit} Plaid connections on the {user.plan} plan.",
                  "gate": "plaid_limit",
                  "limit": limit,
                  "used": count,
              },
          )
      return user
  ```

  Note: `PlaidLink.is_active` filter has no `user_id` — this is a single-user app so counting all active links is correct. If `PlaidLink` has a `user_id` column, optionally add `.where(PlaidLink.user_id == user.id, ...)`.

- [ ] **Step 1.3 — Verify imports work**

  Check that `get_current_user` is exported from `app.api.auth`:
  ```bash
  grep -n "def get_current_user\|async def get_current_user" /home/zach/hive/backend/app/api/auth.py
  ```
  If the function has a different name, update the import in gates.py accordingly.

- [ ] **Step 1.4 — Apply gates to plaid_link.py**

  Read `/home/zach/hive/backend/app/api/plaid_link.py` and add gate dependencies to link-token and exchange-token endpoints:

  ```python
  from app.gates import require_plaid, check_plaid_limit

  # On POST /api/plaid/link-token endpoint: add user: User = Depends(require_plaid)
  # On POST /api/plaid/exchange-token endpoint: add user: User = Depends(check_plaid_limit)
  ```

- [ ] **Step 1.5 — Apply gate to snaptrade.py**

  Read `/home/zach/hive/backend/app/api/snaptrade.py` and add `Depends(require_snaptrade)` to the endpoint that registers/connects a SnapTrade account:

  ```python
  from app.gates import require_snaptrade
  ```

- [ ] **Step 1.6 — Commit**

  ```bash
  cd /home/zach/hive && git add backend/app/gates.py backend/app/api/plaid_link.py backend/app/api/snaptrade.py && git commit -m "feat(billing): add feature gates for Plaid, Claude, SnapTrade"
  ```

---

## Task 2: Add Stripe settings to `config.py`

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 2.1 — Read config.py**

  ```bash
  grep -n "stripe\|app_base_url" /home/zach/hive/backend/app/config.py
  ```
  If all 5 fields exist, skip this task.

- [ ] **Step 2.2 — Add missing settings to the Settings class**

  Add only the fields that are missing:

  ```python
  # Stripe billing
  stripe_secret_key: str = ""
  stripe_webhook_secret: str = ""
  stripe_starter_price_id: str = ""
  stripe_pro_price_id: str = ""
  app_base_url: str = "https://hive.zacharyjcollins.com"
  ```

- [ ] **Step 2.3 — Commit**

  ```bash
  git add backend/app/config.py && git commit -m "feat(billing): add Stripe config settings"
  ```

---

## Task 3: Create `backend/app/api/billing.py`

**Files:**
- Create: `backend/app/api/billing.py`

- [ ] **Step 3.1 — Create billing.py**

  Create `/home/zach/hive/backend/app/api/billing.py`:

  ```python
  """Stripe billing API — checkout, portal, webhook, status."""
  import datetime
  import logging

  import stripe
  from fastapi import APIRouter, Depends, HTTPException, Request
  from pydantic import BaseModel
  from sqlalchemy import func, select
  from sqlalchemy.ext.asyncio import AsyncSession

  from app.api.auth import get_current_user
  from app.config import settings
  from app.db import get_db
  from app.models.plaid_link import PlaidLink
  from app.models.user import PlanTier, User, UserRole

  logger = logging.getLogger(__name__)
  router = APIRouter(prefix="/api/billing", tags=["billing"])

  PLAID_LIMITS = {PlanTier.free: 0, PlanTier.starter: 3, PlanTier.pro: 10}


  def _price_to_plan() -> dict[str, PlanTier]:
      return {
          settings.stripe_starter_price_id: PlanTier.starter,
          settings.stripe_pro_price_id: PlanTier.pro,
      }


  class CheckoutRequest(BaseModel):
      plan: str  # "starter" | "pro"
      return_url: str = ""


  class PortalRequest(BaseModel):
      return_url: str = ""


  @router.get("/status")
  async def billing_status(
      user: User = Depends(get_current_user),
      db: AsyncSession = Depends(get_db),
  ) -> dict:
      result = await db.execute(
          select(func.count())
          .select_from(PlaidLink)
          .where(PlaidLink.is_active.is_(True))
      )
      plaid_used = result.scalar() or 0
      plaid_limit = 999 if user.role == UserRole.admin else PLAID_LIMITS.get(user.plan, 0)
      return {
          "plan": user.plan,
          "stripe_status": user.stripe_status,
          "period_end": user.plan_period_end.isoformat() if user.plan_period_end else None,
          "plaid_used": plaid_used,
          "plaid_limit": plaid_limit,
          "claude_enabled": user.role == UserRole.admin or user.plan == PlanTier.pro,
          "snaptrade_enabled": user.role == UserRole.admin or user.plan == PlanTier.pro,
      }


  @router.post("/checkout")
  async def create_checkout(
      body: CheckoutRequest,
      user: User = Depends(get_current_user),
      db: AsyncSession = Depends(get_db),
  ) -> dict:
      stripe.api_key = settings.stripe_secret_key
      if body.plan == "starter":
          price_id = settings.stripe_starter_price_id
      elif body.plan == "pro":
          price_id = settings.stripe_pro_price_id
      else:
          raise HTTPException(400, "Invalid plan. Must be 'starter' or 'pro'.")

      if not price_id:
          raise HTTPException(503, "Stripe price IDs not configured. Contact support.")

      if not user.stripe_customer_id:
          customer = stripe.Customer.create(
              metadata={"user_id": str(user.id), "username": user.username}
          )
          user.stripe_customer_id = customer.id
          await db.commit()

      return_url = body.return_url or f"{settings.app_base_url}/billing"
      session = stripe.checkout.Session.create(
          customer=user.stripe_customer_id,
          mode="subscription",
          line_items=[{"price": price_id, "quantity": 1}],
          success_url=f"{settings.app_base_url}/billing?success=true",
          cancel_url=return_url,
      )
      return {"url": session.url}


  @router.post("/portal")
  async def billing_portal(
      body: PortalRequest,
      user: User = Depends(get_current_user),
  ) -> dict:
      stripe.api_key = settings.stripe_secret_key
      if not user.stripe_customer_id:
          raise HTTPException(400, "No billing account found. Subscribe first.")
      return_url = body.return_url or f"{settings.app_base_url}/billing"
      session = stripe.billing_portal.Session.create(
          customer=user.stripe_customer_id,
          return_url=return_url,
      )
      return {"url": session.url}


  @router.post("/webhook")
  async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
      stripe.api_key = settings.stripe_secret_key
      payload = await request.body()
      sig_header = request.headers.get("stripe-signature", "")
      try:
          event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
      except (stripe.error.SignatureVerificationError, ValueError) as e:
          logger.warning("Stripe webhook signature invalid: %s", e)
          raise HTTPException(400, "Invalid signature")

      price_map = _price_to_plan()

      if event["type"] == "checkout.session.completed":
          session_obj = event["data"]["object"]
          customer_id = session_obj.get("customer")
          sub_id = session_obj.get("subscription")
          result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
          user = result.scalar_one_or_none()
          if user and sub_id:
              sub = stripe.Subscription.retrieve(sub_id)
              price_id = sub["items"]["data"][0]["price"]["id"]
              user.stripe_subscription_id = sub_id
              user.stripe_status = sub["status"]
              user.plan = price_map.get(price_id, PlanTier.free)
              if sub.get("current_period_end"):
                  user.plan_period_end = datetime.datetime.fromtimestamp(
                      sub["current_period_end"], tz=datetime.timezone.utc
                  )
              await db.commit()
              logger.info("Activated plan %s for customer %s", user.plan, customer_id)

      elif event["type"] == "customer.subscription.updated":
          sub = event["data"]["object"]
          result = await db.execute(select(User).where(User.stripe_subscription_id == sub["id"]))
          user = result.scalar_one_or_none()
          if user:
              price_id = sub["items"]["data"][0]["price"]["id"]
              user.stripe_status = sub["status"]
              user.plan = price_map.get(price_id, PlanTier.free)
              if sub.get("current_period_end"):
                  user.plan_period_end = datetime.datetime.fromtimestamp(
                      sub["current_period_end"], tz=datetime.timezone.utc
                  )
              await db.commit()
              logger.info("Updated subscription %s → plan=%s status=%s", sub["id"], user.plan, user.stripe_status)

      elif event["type"] == "customer.subscription.deleted":
          sub = event["data"]["object"]
          result = await db.execute(select(User).where(User.stripe_subscription_id == sub["id"]))
          user = result.scalar_one_or_none()
          if user:
              user.plan = PlanTier.free
              user.stripe_status = "canceled"
              await db.commit()
              logger.info("Canceled subscription %s, downgraded to free", sub["id"])

      elif event["type"] == "invoice.payment_failed":
          invoice = event["data"]["object"]
          customer_id = invoice.get("customer")
          result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
          user = result.scalar_one_or_none()
          if user:
              user.stripe_status = "past_due"
              await db.commit()
              logger.warning("Payment failed for customer %s, marked past_due", customer_id)

      return {"received": True}
  ```

- [ ] **Step 3.2 — Commit**

  ```bash
  git add backend/app/api/billing.py && git commit -m "feat(billing): add Stripe billing API (checkout, portal, webhook, status)"
  ```

---

## Task 4: Wire billing router into `main.py`

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 4.1 — Read main.py imports and public paths**

  ```bash
  grep -n "billing\|_PUBLIC_EXACT" /home/zach/hive/backend/app/main.py
  ```
  Confirms whether billing router is already imported.

- [ ] **Step 4.2 — Add billing import**

  In `main.py`, add after the last router import:
  ```python
  from app.api.billing import router as billing_router
  ```

- [ ] **Step 4.3 — Add webhook to public paths**

  In the `_PUBLIC_EXACT` set, add `"/api/billing/webhook"`:
  ```python
  _PUBLIC_EXACT = {
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/setup-required",
      "/api/auth/logout",
      "/api/health",
      "/api/billing/webhook",   # Stripe webhook — no user auth
  }
  ```

- [ ] **Step 4.4 — Register billing router**

  After `app.include_router(transactions_router)`, add:
  ```python
  app.include_router(billing_router)
  ```

- [ ] **Step 4.5 — Build to verify**

  ```bash
  cd /home/zach/hive && docker compose build backend 2>&1 | tail -20
  ```
  Expected: no import errors, build exits 0.

- [ ] **Step 4.6 — Commit**

  ```bash
  git add backend/app/main.py && git commit -m "feat(billing): register billing router and mark webhook as public"
  ```

---

## Task 5: Add Claude gate to `chat.py`

**Files:**
- Modify: `backend/app/api/chat.py`

- [ ] **Step 5.1 — Read chat.py to find the use_claude check point**

  ```bash
  grep -n "use_claude\|ChatRequest\|async def chat" /home/zach/hive/backend/app/api/chat.py | head -20
  ```

- [ ] **Step 5.2 — Read the chat endpoint handler (around the use_claude branch)**

  Read the file section where `use_claude` is checked and `_chat_with_claude` is called (usually 20–30 lines).

- [ ] **Step 5.3 — Add Claude plan gate**

  In the chat endpoint, immediately before the `use_claude` branch executes `_chat_with_claude`, add:

  ```python
  from app.models.user import PlanTier, UserRole

  # Add to the imports at top of file (only if not already present)
  from app.gates import require_claude as _require_claude_dep

  # In the endpoint handler, before calling _chat_with_claude:
  if body.use_claude:
      # Look up user from request (the chat endpoint has request: Request and db: AsyncSession params)
      from app.api.auth import _get_bearer_token, decode_token
      from sqlalchemy import select as _select
      from app.models.user import User as _User
      _token = _get_bearer_token(request)
      if _token:
          _payload = decode_token(_token)
          _result = await db.execute(_select(_User).where(_User.id == _payload.get("sub")))
          _chat_user = _result.scalar_one_or_none()
          if _chat_user and _chat_user.role != UserRole.admin and _chat_user.plan != PlanTier.pro:
              raise HTTPException(
                  status_code=402,
                  detail={"message": "Claude AI chat requires Pro plan.", "gate": "claude"},
              )
  ```

  Note: The exact pattern depends on how `chat.py` gets the current user. Read the file first. If it already uses `get_current_user` as a Depends, simply add `Depends(require_claude)` when `use_claude=True`. If it reads the token manually, use the inline approach above.

- [ ] **Step 5.4 — Build backend**

  ```bash
  docker compose build backend 2>&1 | tail -10
  ```

- [ ] **Step 5.5 — Commit**

  ```bash
  git add backend/app/api/chat.py && git commit -m "feat(billing): gate Claude AI chat behind Pro plan"
  ```

---

## Task 6: Add admin user management to `admin.py`

**Files:**
- Modify: `backend/app/api/admin.py`

- [ ] **Step 6.1 — Check if user management endpoints already exist**

  ```bash
  grep -n "def list_users\|def update_user\|GET.*users\|PATCH.*users" /home/zach/hive/backend/app/api/admin.py
  ```
  If they exist, skip this task entirely.

- [ ] **Step 6.2 — Read admin.py to understand existing patterns**

  Read the first 50 lines to understand imports and auth patterns used.

- [ ] **Step 6.3 — Add user management endpoints**

  Append to `/home/zach/hive/backend/app/api/admin.py`:

  ```python
  # ── User management ──────────────────────────────────────────────────────────

  class UserAdminView(BaseModel):
      id: str
      username: str
      role: str
      plan: str
      stripe_status: Optional[str]
      is_active: bool
      last_login_at: Optional[str]
      created_at: str


  class UserUpdateRequest(BaseModel):
      plan: Optional[str] = None
      role: Optional[str] = None
      is_active: Optional[bool] = None


  @router.get("/users")
  async def list_users(
      db: AsyncSession = Depends(get_db),
      payload: dict = Depends(require_admin),
  ) -> list[UserAdminView]:
      result = await db.execute(select(User).order_by(User.created_at.desc()))
      users = result.scalars().all()
      return [
          UserAdminView(
              id=str(u.id),
              username=u.username,
              role=u.role,
              plan=u.plan,
              stripe_status=u.stripe_status,
              is_active=u.is_active,
              last_login_at=u.last_login_at.isoformat() if u.last_login_at else None,
              created_at=u.created_at.isoformat(),
          )
          for u in users
      ]


  @router.patch("/users/{user_id}")
  async def update_user(
      user_id: str,
      body: UserUpdateRequest,
      db: AsyncSession = Depends(get_db),
      payload: dict = Depends(require_admin),
  ) -> UserAdminView:
      import uuid as _uuid
      result = await db.execute(select(User).where(User.id == _uuid.UUID(user_id)))
      user = result.scalar_one_or_none()
      if not user:
          raise HTTPException(404, "User not found")
      if body.plan is not None:
          user.plan = body.plan
      if body.role is not None:
          user.role = body.role
      if body.is_active is not None:
          user.is_active = body.is_active
      await db.commit()
      return UserAdminView(
          id=str(user.id),
          username=user.username,
          role=user.role,
          plan=user.plan,
          stripe_status=user.stripe_status,
          is_active=user.is_active,
          last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
          created_at=user.created_at.isoformat(),
      )
  ```

  Make sure `User` is imported — check line 1–15 of admin.py for existing imports. Add `from app.models.user import User, UserRole` if not present.

- [ ] **Step 6.4 — Build and commit**

  ```bash
  docker compose build backend 2>&1 | tail -5
  git add backend/app/api/admin.py && git commit -m "feat(billing): add admin user listing and plan management endpoints"
  ```

---

## Task 7: Create `/billing` page

**Files:**
- Create: `frontend/src/app/(app)/billing/page.tsx`

- [ ] **Step 7.1 — Read PageHero props**

  ```bash
  grep -n "eyebrow\|headline\|subtext\|statStrip\|interface.*Props\|type.*Props" /home/zach/hive/frontend/src/components/PageHero.tsx | head -20
  ```
  Confirm prop names before using them.

- [ ] **Step 7.2 — Create billing page**

  Create directory and file:
  ```bash
  mkdir -p /home/zach/hive/frontend/src/app/\(app\)/billing
  ```

  Create `/home/zach/hive/frontend/src/app/(app)/billing/page.tsx`:

  ```tsx
  "use client";
  import { useEffect, useState } from "react";
  import { useSearchParams } from "next/navigation";
  import { toast } from "@/components/Toast";
  import PageHero from "@/components/PageHero";

  interface BillingStatus {
    plan: "free" | "starter" | "pro";
    stripe_status: string | null;
    period_end: string | null;
    plaid_used: number;
    plaid_limit: number;
    claude_enabled: boolean;
    snaptrade_enabled: boolean;
  }

  const PLANS = [
    {
      key: "free" as const,
      name: "Free",
      price: "$0",
      period: "forever",
      features: [
        "Manual accounts (unlimited)",
        "Budgets & analytics",
        "Ollama AI categorization",
        "Anomaly detection",
        "Forecasting",
        "Points tracking",
        "Tax export",
      ],
      missing: ["Plaid bank sync", "Claude AI chat", "SnapTrade investments"],
    },
    {
      key: "starter" as const,
      name: "Starter",
      price: "$9",
      period: "/mo",
      features: [
        "Everything in Free",
        "Plaid bank sync (up to 3 accounts)",
        "Daily automatic sync",
      ],
      missing: ["Claude AI chat", "SnapTrade investments"],
    },
    {
      key: "pro" as const,
      name: "Pro",
      price: "$19",
      period: "/mo",
      badge: "MOST POPULAR",
      features: [
        "Everything in Starter",
        "Up to 10 Plaid accounts",
        "Claude Sonnet AI chat",
        "SnapTrade investment accounts",
        "Priority support",
      ],
      missing: [] as string[],
    },
  ];

  export default function BillingPage() {
    const [status, setStatus] = useState<BillingStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const searchParams = useSearchParams();

    useEffect(() => {
      fetch("/api/billing/status", { credentials: "include" })
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => {})
        .finally(() => setLoading(false));
      if (searchParams.get("success") === "true") {
        toast.success("Subscription activated! Welcome to your new plan.");
      }
    }, [searchParams]);

    async function handleCheckout(plan: string) {
      setActionLoading(plan);
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.detail ?? "Failed to start checkout"); return; }
        if (data.url) window.location.href = data.url;
      } catch {
        toast.error("Failed to start checkout");
      } finally {
        setActionLoading(null);
      }
    }

    async function handlePortal() {
      setActionLoading("portal");
      try {
        const res = await fetch("/api/billing/portal", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.detail ?? "Failed to open billing portal"); return; }
        if (data.url) window.location.href = data.url;
      } catch {
        toast.error("Failed to open billing portal");
      } finally {
        setActionLoading(null);
      }
    }

    if (loading) return <div className="p-6 text-ink-secondary text-sm">Loading...</div>;

    const planLabel = status?.plan === "pro" ? "Pro Plan" : status?.plan === "starter" ? "Starter Plan" : "Free Plan";

    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <PageHero
          eyebrow="Billing"
          headline={planLabel}
          subtext="Manage your subscription and feature access"
          statStrip={[
            { label: "Plan", value: status?.plan ?? "free" },
            {
              label: "Plaid Connections",
              value: `${status?.plaid_used ?? 0} / ${status?.plaid_limit === 999 ? "∞" : (status?.plaid_limit ?? 0)}`,
            },
            { label: "Claude AI", value: status?.claude_enabled ? "Enabled" : "Pro only" },
            { label: "SnapTrade", value: status?.snaptrade_enabled ? "Enabled" : "Pro only" },
          ]}
        />

        {status?.stripe_status && (
          <div className="hive-card-featured p-5 mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-ink-secondary text-xs uppercase tracking-[0.06em] mb-1">Current Subscription</p>
              <p className="text-ink-primary font-semibold capitalize">
                {status.plan} ·{" "}
                <span className={
                  status.stripe_status === "active" ? "text-semantic-income" :
                  status.stripe_status === "past_due" ? "text-semantic-expense" : "text-semantic-warning"
                }>
                  {status.stripe_status}
                </span>
              </p>
              {status.period_end && (
                <p className="text-ink-tertiary text-xs mt-1">
                  Renews {new Date(status.period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            <button onClick={handlePortal} disabled={actionLoading === "portal"} className="hive-btn-secondary text-sm shrink-0">
              {actionLoading === "portal" ? "Loading..." : "Manage Billing →"}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = status?.plan === plan.key;
            return (
              <div key={plan.key} className={isCurrent ? "hive-card-hero p-5" : "hive-card p-5"}>
                {"badge" in plan && plan.badge && (
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.08em] bg-blue-faint text-blue px-2 py-0.5 rounded mb-3">
                    {plan.badge}
                  </span>
                )}
                <p className="text-ink-primary font-semibold text-base mb-0.5">{plan.name}</p>
                <p className="font-mono text-2xl font-bold text-ink-primary mb-4">
                  {plan.price}
                  <span className="text-ink-tertiary text-sm font-normal">{plan.period}</span>
                </p>
                <ul className="space-y-2 mb-5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2 text-ink-secondary">
                      <span className="text-semantic-income shrink-0">✓</span>{f}
                    </li>
                  ))}
                  {plan.missing.map((f) => (
                    <li key={f} className="flex gap-2 text-ink-ghost">
                      <span className="shrink-0">✗</span>{f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button disabled className="hive-btn-secondary w-full opacity-50 text-sm">Current Plan</button>
                ) : plan.key === "free" ? (
                  <button disabled className="hive-btn-ghost w-full text-sm opacity-40">Downgrade</button>
                ) : (
                  <button onClick={() => handleCheckout(plan.key)} disabled={!!actionLoading} className="hive-btn-primary w-full text-sm">
                    {actionLoading === plan.key ? "Loading..." : `Upgrade to ${plan.name} →`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 7.3 — Build check**

  ```bash
  cd /home/zach/hive/frontend && npm run build 2>&1 | grep -E "error|Error|✓|✗" | tail -20
  ```

- [ ] **Step 7.4 — Commit**

  ```bash
  git add frontend/src/app/\(app\)/billing/ && git commit -m "feat(billing): add /billing plan management page"
  ```

---

## Task 8: Add 402 handling to `frontend/src/lib/api.ts`

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 8.1 — Read api.ts**

  Read `/home/zach/hive/frontend/src/lib/api.ts` lines 1–80 to understand the full structure of `get()`, `post()`, `del()`, and any `patch()`/`put()` helpers.

- [ ] **Step 8.2 — Add handle402 helper**

  Add this function before the `get()` function (after `handleUnauthorized`):

  ```typescript
  async function handle402(res: Response, path: string): Promise<never> {
    let gate: string | undefined;
    try {
      const body = await res.clone().json();
      // billing.py: {"detail": {"gate": "...", "message": "..."}}
      if (body?.detail?.gate) gate = body.detail.gate;
      else if (body?.gate) gate = body.gate;
    } catch { /* no JSON body */ }
    // gates.py uses X-Gate header
    if (!gate) gate = res.headers.get("X-Gate") ?? "plaid";
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("upgrade-required", { detail: { gate } }));
    }
    const err = Object.assign(new Error(`402 ${path}`), { status: 402, gate });
    throw err;
  }
  ```

- [ ] **Step 8.3 — Update error handling in each helper**

  In each of `get()`, `post()`, `del()`, and any `patch()`/`put()` helpers, update the `if (!res.ok)` block:

  ```typescript
  if (!res.ok) {
    if (res.status === 402) return handle402(res, path) as never;
    handleUnauthorized(res.status);
    throw new Error(`<VERB> ${path} → ${res.status}`);
  }
  ```

- [ ] **Step 8.4 — Build check**

  ```bash
  cd /home/zach/hive/frontend && npm run build 2>&1 | grep -i "error" | head -10
  ```

- [ ] **Step 8.5 — Commit**

  ```bash
  git add frontend/src/lib/api.ts && git commit -m "feat(billing): dispatch upgrade-required event on 402 API responses"
  ```

---

## Task 9: Update `UpgradeModal.tsx` + add Billing to Sidebar

**Files:**
- Modify: `frontend/src/components/UpgradeModal.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 9.1 — Read UpgradeModal.tsx**

  Read the full file, find the CTA button/link that points to `/pricing`. Note line number.

- [ ] **Step 9.2 — Update CTA to /billing**

  Change `href="/pricing"` (or wherever the upgrade CTA links) to `href="/billing"`. Also update button label to "View Plans →" if it currently says something else.

- [ ] **Step 9.3 — Read Sidebar.tsx footer section**

  ```bash
  grep -n "Settings\|billing\|CreditCard\|footer\|NavButton" /home/zach/hive/frontend/src/components/Sidebar.tsx | tail -20
  ```

- [ ] **Step 9.4 — Add Billing nav link to Sidebar**

  In the sidebar footer section (where Settings and Account are), add a Billing link. The `CreditCard` icon is already imported from lucide-react. Add between Settings and the Avatar:

  ```tsx
  <NavButton href="/billing" label="Billing" icon={CreditCard} active={pathname.startsWith("/billing")} />
  ```

  If `CreditCard` is not imported, add it to the lucide-react import line.

- [ ] **Step 9.5 — Build and commit**

  ```bash
  cd /home/zach/hive/frontend && npm run build 2>&1 | grep -E "error|Error" | head -5
  git add frontend/src/components/UpgradeModal.tsx frontend/src/components/Sidebar.tsx && git commit -m "feat(billing): link UpgradeModal to /billing, add Billing to sidebar"
  ```

---

## Task 10: Update `/connect` page + `/account` admin section

**Files:**
- Modify: `frontend/src/app/(app)/connect/page.tsx`
- Modify: `frontend/src/app/(app)/account/page.tsx`

- [ ] **Step 10.1 — Read connect/page.tsx**

  Read the full file. Find where `link-token` is fetched and where errors are displayed.

- [ ] **Step 10.2 — Add 402 state to connect page**

  Add: `const [plaidGated, setPlaidGated] = useState(false);`

  Update the link-token fetch to detect 402 separately (don't use the `api` helper for this — use raw `fetch` so we control the 402 path):

  ```typescript
  const res = await fetch("/api/plaid/link-token", { method: "POST", credentials: "include" });
  if (res.status === 402) {
    setPlaidGated(true);
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    setStatus("error");
    setMessage(err.detail ?? `Server error ${res.status}`);
    return;
  }
  const data = await res.json();
  // ... rest of existing logic
  ```

- [ ] **Step 10.3 — Add upgrade card JSX**

  Where the Plaid Link button renders, add a conditional before it:

  ```tsx
  {plaidGated && (
    <div className="hive-card p-5 text-center mb-4">
      <p className="text-ink-primary font-semibold mb-2">Bank Sync Requires Starter or Pro</p>
      <p className="text-ink-secondary text-sm mb-4">
        Connect up to 3 accounts on Starter ($9/mo) or 10 on Pro ($19/mo).
      </p>
      <a href="/billing" className="hive-btn-primary inline-block">View Plans →</a>
    </div>
  )}
  ```

- [ ] **Step 10.4 — Read account/page.tsx**

  ```bash
  grep -n "admin\|role\|AdminSection\|UserAdmin" /home/zach/hive/frontend/src/app/\(app\)/account/page.tsx | head -20
  ```
  Check if admin section already exists. If it does, skip step 10.5.

- [ ] **Step 10.5 — Add admin section to account page (if not exists)**

  Read the full account page, then add an admin section at the bottom that:
  - Fetches `GET /api/admin/users` when `user.role === "admin"`
  - Renders a table: username | plan (select dropdown) | active (toggle)
  - On plan change: `PATCH /api/admin/users/{id}` with `{ plan }`
  - On active toggle: `PATCH /api/admin/users/{id}` with `{ is_active }`

  ```tsx
  {user?.role === "admin" && (
    <div className="hive-card p-5 mt-6">
      <h3 className="text-ink-primary font-semibold mb-4">User Management</h3>
      {/* table of users fetched from /api/admin/users */}
    </div>
  )}
  ```

- [ ] **Step 10.6 — Build and commit**

  ```bash
  cd /home/zach/hive/frontend && npm run build 2>&1 | grep -E "Error|error" | head -5
  git add frontend/src/app/\(app\)/connect/page.tsx frontend/src/app/\(app\)/account/page.tsx && git commit -m "feat(billing): upgrade prompt on /connect, admin section on /account"
  ```

---

## Task 11: Final verification

- [ ] **Step 11.1 — Full backend build**

  ```bash
  cd /home/zach/hive && docker compose build backend 2>&1 | tail -5
  ```
  Expected: `=> exporting layers` and exit 0.

- [ ] **Step 11.2 — Full frontend build**

  ```bash
  cd /home/zach/hive/frontend && npm run build 2>&1 | tail -20
  ```
  Expected: all 33 routes generated, no TypeScript errors.

- [ ] **Step 11.3 — Push**

  ```bash
  git push origin main
  ```

---

## Environment Variables Required

Add to `.env` before testing (not committed to git):

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
APP_BASE_URL=https://hive.zacharyjcollins.com
```

Stripe setup (Zach does manually):
1. Create "Starter" ($9/mo) and "Pro" ($19/mo) products in Stripe dashboard
2. Copy price IDs to `.env`
3. Add webhook at `https://api.zacharyjcollins.com/api/billing/webhook` in Stripe dashboard
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`
