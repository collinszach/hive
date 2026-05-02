"""Monthly position endpoint — income, spending, subscriptions, card billing, reimbursements."""
from __future__ import annotations

import calendar
import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.account import Account
from app.models.contact import Contact
from app.models.expense_share import ExpenseShare
from app.models.subscription import Subscription
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/position", tags=["position"])


class CardPaymentInfo(BaseModel):
    account_id: str
    account_name: str
    card_slug: Optional[str]
    statement_balance: float
    statement_close_day: int
    payment_due_day: int
    due_date: str
    days_until_due: int
    autopay: bool


class SubscriptionPending(BaseModel):
    id: str
    merchant_name: str
    amount: float
    frequency: str
    next_expected: Optional[str]


class PendingReimbursement(BaseModel):
    share_id: str
    contact_name: str
    amount: float
    note: Optional[str]
    transaction_date: str
    transaction_merchant: Optional[str]
    days_outstanding: int


class MonthlyPosition(BaseModel):
    month: str
    income: float
    spent: float
    saved: float           # already transferred to savings this month
    remaining_to_save: float  # how much more you can move (available_to_save - saved)
    subscriptions_pending: list[SubscriptionPending]
    subscriptions_pending_total: float
    card_payments: list[CardPaymentInfo]
    pending_reimbursements: list[PendingReimbursement]
    pending_reimbursements_total: float
    available_to_save: float  # total surplus (income - spent - pending - subs + reimbursements)


def _due_date(year: int, mon: int, day: int) -> date:
    """Compute a payment due date clamped to the last valid day of the month."""
    last_day = calendar.monthrange(year, mon)[1]
    return date(year, mon, min(day, last_day))


@router.get("/monthly", response_model=MonthlyPosition)
async def get_monthly_position(
    month: str = Query(..., description="YYYY-MM, e.g. 2026-05"),
    db: AsyncSession = Depends(get_db),
) -> MonthlyPosition:
    try:
        year, mon = int(month[:4]), int(month[5:7])
    except (ValueError, IndexError):
        raise HTTPException(400, "month must be YYYY-MM format")

    month_start = date(year, mon, 1)
    next_month_start = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    today = datetime.now(timezone.utc).date()

    # ── Income ──
    income_q = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.date >= month_start,
            Transaction.date < next_month_start,
            Transaction.category == "Income",
            Transaction.amount < 0,
            Transaction.pending.is_(False),
        )
    )
    income = abs(float(income_q.scalar_one_or_none() or 0.0))

    # ── Spent ──
    spent_q = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.date >= month_start,
            Transaction.date < next_month_start,
            Transaction.amount > 0,
            Transaction.is_excluded.is_(False),
            Transaction.is_transfer.is_(False),
            Transaction.pending.is_(False),
        )
    )
    spent = float(spent_q.scalar_one_or_none() or 0.0)

    # ── Saved (transfers into savings accounts this month) ──
    # Inflows to savings (amount < 0) that are transfers = money moved from checking → savings.
    # Sum the savings-side leg only to avoid double-counting the checking-side outflow.
    saved_q = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.date >= month_start,
            Transaction.date < next_month_start,
            Transaction.is_transfer.is_(True),
            Transaction.amount < 0,
            Transaction.pending.is_(False),
            Transaction.account_id.in_(
                select(Account.id).where(Account.subtype == "savings", Account.is_active.is_(True))
            ),
        )
    )
    saved = abs(float(saved_q.scalar_one_or_none() or 0.0))

    # ── Subscriptions pending this month ──
    subs_q = await db.execute(
        select(Subscription).where(
            Subscription.is_active.is_(True),
            Subscription.is_cancelled.is_(False),
            Subscription.next_expected >= month_start,
            Subscription.next_expected < next_month_start,
        )
    )
    subs_all = subs_q.scalars().all()

    # Remove subscriptions already charged (match by normalized_name)
    charged_q = await db.execute(
        select(func.lower(Transaction.merchant)).where(
            Transaction.date >= month_start,
            Transaction.date < next_month_start,
            Transaction.is_excluded.is_(False),
            Transaction.pending.is_(False),
            Transaction.merchant.is_not(None),
        )
    )
    charged_merchants = {m for m in charged_q.scalars().all() if m}

    subs_pending = [
        s for s in subs_all
        if s.normalized_name.lower() not in charged_merchants
    ]
    subs_pending_total = sum(float(s.amount) for s in subs_pending)

    # ── Credit card payment dates ──
    credit_accts_q = await db.execute(
        select(Account).where(
            Account.type == "credit",
            Account.is_active.is_(True),
            Account.is_excluded.is_(False),
            Account.statement_close_day.is_not(None),
            Account.payment_due_day.is_not(None),
        )
    )
    credit_accts = credit_accts_q.scalars().all()

    # Compute pending transaction totals per account so we can strip them from current_balance.
    # Plaid's current_balance for credit cards includes pending charges; the statement balance
    # should only reflect posted transactions.
    if credit_accts:
        acct_ids = [acct.id for acct in credit_accts]
        pending_per_acct_q = await db.execute(
            select(Transaction.account_id, func.sum(Transaction.amount))
            .where(
                Transaction.account_id.in_(acct_ids),
                Transaction.pending.is_(True),
            )
            .group_by(Transaction.account_id)
        )
        pending_by_acct: dict = {str(row[0]): float(row[1]) for row in pending_per_acct_q.all()}
    else:
        pending_by_acct = {}

    card_payments: list[CardPaymentInfo] = []
    for acct in credit_accts:
        close_day = acct.statement_close_day
        due_day = acct.payment_due_day
        last_close = _due_date(year, mon, close_day)
        if last_close < today:
            # Statement already closed this month; payment due next month
            nm_year = year + 1 if mon == 12 else year
            nm_mon = 1 if mon == 12 else mon + 1
            due = _due_date(nm_year, nm_mon, due_day)
        else:
            # Statement not closed yet; payment due is for the prior statement (this month)
            due = _due_date(year, mon, due_day)

        # Use stored statement_balance if available; fall back to current_balance minus pending
        if acct.statement_balance is not None:
            statement_balance = float(acct.statement_balance)
        else:
            raw_balance = float(acct.current_balance or 0)
            pending_amount = pending_by_acct.get(str(acct.id), 0.0)
            statement_balance = max(0.0, raw_balance - pending_amount)

        card_payments.append(
            CardPaymentInfo(
                account_id=str(acct.id),
                account_name=acct.name,
                card_slug=acct.card_slug,
                statement_balance=round(statement_balance, 2),
                statement_close_day=close_day,
                payment_due_day=due_day,
                due_date=due.isoformat(),
                days_until_due=(due - today).days,
                autopay=bool(acct.autopay),
            )
        )
    card_payments.sort(key=lambda c: c.days_until_due)

    # ── Pending reimbursements (all-time pending, not just this month) ──
    shares_q = await db.execute(
        select(ExpenseShare, Contact, Transaction)
        .join(Contact, ExpenseShare.contact_id == Contact.id)
        .join(Transaction, ExpenseShare.transaction_id == Transaction.id)
        .where(ExpenseShare.status == "pending")
        .order_by(Transaction.date.desc())
    )
    pending_reimb: list[PendingReimbursement] = [
        PendingReimbursement(
            share_id=str(share.id),
            contact_name=contact.name,
            amount=float(share.amount),
            note=share.note,
            transaction_date=tx.date.isoformat(),
            transaction_merchant=tx.merchant,
            days_outstanding=(today - tx.date).days,
        )
        for share, contact, tx in shares_q.all()
    ]
    pending_reimb_total = sum(r.amount for r in pending_reimb)

    available_to_save = income - spent - subs_pending_total + pending_reimb_total
    remaining_to_save = max(0.0, available_to_save - saved)

    return MonthlyPosition(
        month=month,
        income=round(income, 2),
        spent=round(spent, 2),
        saved=round(saved, 2),
        remaining_to_save=round(remaining_to_save, 2),
        subscriptions_pending=[
            SubscriptionPending(
                id=str(s.id),
                merchant_name=s.merchant_name,
                amount=float(s.amount),
                frequency=s.frequency,
                next_expected=s.next_expected.isoformat() if s.next_expected else None,
            )
            for s in subs_pending
        ],
        subscriptions_pending_total=round(subs_pending_total, 2),
        card_payments=card_payments,
        pending_reimbursements=pending_reimb,
        pending_reimbursements_total=round(pending_reimb_total, 2),
        available_to_save=round(available_to_save, 2),
    )
