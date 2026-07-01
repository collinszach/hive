"""Seed fully-fake demo data for portfolio screenshots. NEVER run against a real DB —
intended for a throwaway `hive_demo` database only. Creates a demo user, the standard
card/bank accounts, ~5 months of synthetic transactions, points ledger/balances, and a
budget, then prints a ready-to-use session cookie value.

    PYTHONPATH=/app python scripts/seed_demo_data.py
"""
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

sys.path.insert(0, "/app")

import bcrypt
from jose import jwt

from app.config import settings
from app.db import get_sync_db
from app.models.account import Account
from app.models.budget import Budget
from app.models.earn_rule import EarnRule
from app.models.goal import Goal, GoalType
from app.models.insight import Insight
from app.models.net_worth import NetWorthSnapshot
from app.models.points_balance import PointsBalance
from app.models.points_ledger import PointsLedger
from app.models.transaction import Transaction
from app.models.user import User, UserRole

random.seed(42)

CARDS = [
    ("Amex Gold", "American Express", "amex_gold", Decimal("1842.17"), Decimal("15000")),
    ("Chase Sapphire Preferred", "Chase", "chase_sapphire", Decimal("932.40"), Decimal("12000")),
    ("Chase Southwest Plus", "Chase", "chase_southwest", Decimal("418.55"), Decimal("8000")),
    ("Bilt Blue", "Wells Fargo", "bilt_blue", Decimal("2150.00"), Decimal("10000")),
    ("Capital One Venture X", "Capital One", "venture_x", Decimal("1275.83"), Decimal("20000")),
]
BANKS = [
    ("Everyday Checking", "Chase", "checking", Decimal("6420.18")),
    ("Savings", "Chase", "savings", Decimal("28750.00")),
]

MERCHANTS = [
    # (raw_description, category, subcategory, amount_range)
    ("WHOLE FOODS MKT", "Groceries", "In-Store", (35, 140)),
    ("TRADER JOE S", "Groceries", "In-Store", (20, 90)),
    ("STARBUCKS", "Food & Drink", "Coffee", (5, 9)),
    ("CHIPOTLE", "Food & Drink", "Fast Food", (10, 18)),
    ("DOORDASH*", "Food & Drink", "Delivery", (22, 55)),
    ("THE FRENCH LAUNDRY", "Food & Drink", "Restaurant", (60, 220)),
    ("NETFLIX.COM", "Entertainment", "Streaming", (15.49, 15.49)),
    ("SPOTIFY USA", "Entertainment", "Streaming", (11.99, 11.99)),
    ("SOUTHWEST AIRLINES", "Travel", "SW Flights", (180, 480)),
    ("DELTA AIR LINES", "Travel", "Flights", (220, 650)),
    ("MARRIOTT", "Travel", "Hotel", (180, 420)),
    ("UBER TRIP", "Travel", "Rideshare", (12, 45)),
    ("SHELL OIL", "Transportation", "Gas", (35, 70)),
    ("CVS PHARMACY", "Health", "Pharmacy", (8, 60)),
    ("EQUINOX", "Health", "Gym", (210, 210)),
    ("AMAZON.COM", "Shopping", "Amazon", (15, 220)),
    ("APPLE.COM/BILL", "Entertainment", "Streaming", (9.99, 9.99)),
    ("CON EDISON", "Utilities", "Electric", (60, 160)),
    ("VERIZON WIRELESS", "Utilities", "Phone", (85, 85)),
    ("GREYSTAR PROPERTY MGMT", "Home", "Rent", (3200, 3200)),
]
INCOME = [
    ("ACME CORP PAYROLL", 5850.00),
    ("STRIPE TRANSFER", 640.00),
]


def jwt_for(username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    return jwt.encode({"sub": username, "role": role, "exp": expire}, settings.secret_key, algorithm="HS256")


def main():
    db = get_sync_db()

    db.query(PointsLedger).delete()
    db.query(PointsBalance).delete()
    db.query(Goal).delete()
    db.query(Transaction).delete()
    db.query(Budget).delete()
    db.query(Account).delete()
    db.query(EarnRule).delete()
    db.query(Insight).delete()
    db.query(NetWorthSnapshot).delete()
    db.query(User).filter(User.username == "demo").delete()
    db.commit()

    user = User(
        username="demo",
        password_hash=bcrypt.hashpw(b"demo-portfolio-only", bcrypt.gensalt()).decode(),
        role=UserRole.admin,
        email="demo@example.com",
    )
    db.add(user)
    db.commit()

    accounts: dict[str, Account] = {}
    for name, inst, slug, bal, limit in CARDS:
        acct = Account(
            id=uuid.uuid4(), user_id=user.id, name=name, institution=inst, type="credit",
            subtype="credit card", card_slug=slug, current_balance=bal, available_balance=limit - bal,
            credit_limit=limit, mask=str(random.randint(1000, 9999))[:4], is_manual=True,
        )
        db.add(acct)
        accounts[slug] = acct
    for name, inst, subtype, bal in BANKS:
        acct = Account(
            id=uuid.uuid4(), user_id=user.id, name=name, institution=inst, type="depository",
            subtype=subtype, current_balance=bal, available_balance=bal, mask=str(random.randint(1000, 9999))[:4],
            is_manual=True,
        )
        db.add(acct)
        accounts[f"bank_{subtype}"] = acct
    db.commit()

    earn_rules = [
        ("amex_gold", "Food & Drink", "Restaurant", 4.0, "Amex MR"),
        ("amex_gold", "Food & Drink", "Fast Food", 4.0, "Amex MR"),
        ("amex_gold", "Groceries", "In-Store", 4.0, "Amex MR"),
        ("amex_gold", None, None, 1.0, "Amex MR"),
        ("chase_sapphire", "Travel", None, 3.0, "Chase UR"),
        ("chase_sapphire", "Food & Drink", "Restaurant", 3.0, "Chase UR"),
        ("chase_sapphire", None, None, 1.0, "Chase UR"),
        ("chase_southwest", "Travel", "SW Flights", 3.0, "SW RR"),
        ("chase_southwest", "Travel", None, 2.0, "SW RR"),
        ("chase_southwest", None, None, 1.0, "SW RR"),
        ("bilt_blue", "Home", "Rent", 1.0, "Bilt Points"),
        ("bilt_blue", "Food & Drink", "Restaurant", 3.0, "Bilt Points"),
        ("bilt_blue", None, None, 1.0, "Bilt Points"),
        ("venture_x", "Travel", "Hotel", 10.0, "Capital One Miles"),
        ("venture_x", "Travel", "Flights", 5.0, "Capital One Miles"),
        ("venture_x", None, None, 2.0, "Capital One Miles"),
    ]
    rule_lookup = {}
    for slug, cat, sub, rate, program in earn_rules:
        db.add(EarnRule(card_slug=slug, category=cat, subcategory=sub, earn_rate=Decimal(str(rate)), program=program))
        rule_lookup.setdefault(slug, []).append((cat, sub, Decimal(str(rate)), program))
    db.commit()

    def best_rule(slug, cat, sub):
        rules = rule_lookup.get(slug, [])
        for c, s, rate, program in rules:
            if c == cat and s == sub:
                return rate, program
        for c, s, rate, program in rules:
            if c == cat and s is None:
                return rate, program
        for c, s, rate, program in rules:
            if c is None:
                return rate, program
        return Decimal("1.0"), "Points"

    card_slugs = list(accounts.keys() - {"bank_checking", "bank_savings"})
    today = date.today()
    start = today - timedelta(days=150)
    d = start
    while d <= today:
        # Payroll twice a month
        if d.day in (1, 15):
            amt, desc = INCOME[0][1], INCOME[0][0]
            db.add(Transaction(
                account_id=accounts["bank_checking"].id, date=d, amount=Decimal(f"-{amt}"),
                raw_description=desc, merchant="Acme Corp", category="Income", subcategory="Payroll",
                category_source="rule",
            ))
        if random.random() < 0.08:
            amt, desc = INCOME[1][1], INCOME[1][0]
            db.add(Transaction(
                account_id=accounts["bank_checking"].id, date=d, amount=Decimal(f"-{amt}"),
                raw_description=desc, merchant="Stripe", category="Income", subcategory="Freelance",
                category_source="rule",
            ))
        # Rent on the 1st
        if d.day == 1:
            slug = "bilt_blue"
            desc, cat, sub, _ = "GREYSTAR PROPERTY MGMT", "Home", "Rent", None
            amt = Decimal("3200.00")
            txn_id = uuid.uuid4()
            db.add(Transaction(
                id=txn_id, account_id=accounts[slug].id, date=d, amount=amt,
                raw_description=desc, merchant="Greystar", category=cat, subcategory=sub, category_source="rule",
            ))
            db.flush()
            rate, program = best_rule(slug, cat, sub)
            db.add(PointsLedger(
                transaction_id=txn_id, account_id=accounts[slug].id, card_slug=slug, program=program,
                points_earned=amt * rate, earn_rate=rate, category=cat, subcategory=sub,
            ))
        # Daily spend: 1-4 transactions across cards
        for _ in range(random.randint(1, 4)):
            desc, cat, sub, (lo, hi) = random.choice(MERCHANTS)
            if cat == "Home":
                continue
            slug = random.choice(card_slugs)
            amt = Decimal(str(round(random.uniform(lo, hi), 2)))
            txn_id = uuid.uuid4()
            db.add(Transaction(
                id=txn_id, account_id=accounts[slug].id, date=d, amount=amt,
                raw_description=desc, merchant=desc.title(), category=cat, subcategory=sub,
                category_source="rule",
            ))
            db.flush()
            rate, program = best_rule(slug, cat, sub)
            db.add(PointsLedger(
                transaction_id=txn_id, account_id=accounts[slug].id, card_slug=slug, program=program,
                points_earned=amt * rate, earn_rate=rate, category=cat, subcategory=sub,
            ))
        # Venmo noise — always excluded
        if random.random() < 0.1:
            amt = Decimal(str(round(random.uniform(10, 80), 2)))
            db.add(Transaction(
                account_id=accounts["bank_checking"].id, date=d, amount=amt,
                raw_description="VENMO PAYMENT", merchant="Venmo", category="Transfers", subcategory="P2P",
                category_source="rule", is_transfer=True, is_excluded=True,
            ))
        d += timedelta(days=1)
    db.commit()

    # Points balances (manual override, for redemption-nudge banners)
    for slug, program, bal in [
        ("amex_gold", "Amex MR", 78000),
        ("chase_sapphire", "Chase UR", 61500),
        ("chase_southwest", "SW RR", 24000),
        ("bilt_blue", "Bilt Points", 52000),
        ("venture_x", "Capital One Miles", 39500),
    ]:
        db.add(PointsBalance(card_slug=slug, program=program, balance=bal, as_of=today, source="manual"))
    db.commit()

    # Budgets for the current month
    month_start = today.replace(day=1)
    for cat, amt in [
        ("Food & Drink", 900), ("Groceries", 500), ("Travel", 4500), ("Shopping", 300),
        ("Entertainment", 220), ("Transportation", 150), ("Utilities", 400),
    ]:
        db.add(Budget(category=cat, month=month_start, budget_amount=Decimal(str(amt))))
    db.commit()

    # Net worth history — gentle upward trend with realistic month-to-month noise
    nw = Decimal("142000")
    for i in range(180, -1, -7):
        snap_date = today - timedelta(days=i)
        nw += Decimal(str(round(random.uniform(-600, 950), 2)))
        liabilities = sum((c[3] for c in CARDS), Decimal("0")) + Decimal(str(random.uniform(-200, 200)))
        db.add(NetWorthSnapshot(
            snapshot_date=snap_date,
            total_assets=nw + liabilities,
            total_liabilities=liabilities,
            breakdown={"cash": 35000, "investments": float(nw) - 35000, "credit_cards": float(liabilities)},
        ))
    db.commit()

    # Goals
    db.add_all([
        Goal(name="Emergency Fund", goal_type=GoalType.save, target_amount=Decimal("30000"),
             current_amount=Decimal("28750"), account_id=accounts["bank_savings"].id, pinned=True),
        Goal(name="Dining out", goal_type=GoalType.spend_under, target_amount=Decimal("600"),
             current_amount=Decimal("412.30"), category="Food & Drink", pinned=True),
        Goal(name="Pay off Venture X", goal_type=GoalType.pay_down, target_amount=Decimal("0"),
             current_amount=Decimal("1275.83"), account_id=accounts["venture_x"].id, pinned=False),
    ])

    # Insights feed
    db.add_all([
        Insight(insight_type="savings_opportunity", title="Dining spend down 18% this month",
                body="You're on pace to spend $412 on Food & Drink this month, well under your $600 budget.",
                amount=Decimal("110.00"), delta_pct=Decimal("-18.0"), category="Food & Drink", priority="medium"),
        Insight(insight_type="goal_milestone", title="Emergency fund 96% funded",
                body="Your Emergency Fund goal is $1,250 away from its $30,000 target.",
                amount=Decimal("28750.00"), category=None, priority="high"),
        Insight(insight_type="subscription_price_change", title="Netflix renewed at $15.49",
                body="Your Netflix subscription billed on schedule — no price change this cycle.",
                amount=Decimal("15.49"), category="Entertainment", priority="low"),
    ])
    db.commit()
    db.close()

    print(jwt_for("demo", "admin"))


if __name__ == "__main__":
    main()
