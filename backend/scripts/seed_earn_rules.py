"""Seed earn_rules table with all card earn rates from CLAUDE.md."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import get_sync_db
from app.models.earn_rule import EarnRule

EARN_RULES = [
    # Amex Gold
    ("amex_gold", "Food & Drink", "Restaurant", 4.0, "Amex MR"),
    ("amex_gold", "Food & Drink", "Fast Food", 4.0, "Amex MR"),
    ("amex_gold", "Groceries", "In-Store", 4.0, "Amex MR"),
    ("amex_gold", "Groceries", "Online", 4.0, "Amex MR"),
    ("amex_gold", "Travel", "Flights", 3.0, "Amex MR"),
    ("amex_gold", None, None, 1.0, "Amex MR"),  # base

    # Chase Sapphire Preferred
    ("chase_sapphire", "Travel", None, 3.0, "Chase UR"),
    ("chase_sapphire", "Food & Drink", "Restaurant", 3.0, "Chase UR"),
    ("chase_sapphire", "Food & Drink", "Fast Food", 3.0, "Chase UR"),
    ("chase_sapphire", "Food & Drink", "Delivery", 3.0, "Chase UR"),
    ("chase_sapphire", "Groceries", "Online", 3.0, "Chase UR"),
    ("chase_sapphire", "Entertainment", "Streaming", 3.0, "Chase UR"),
    ("chase_sapphire", None, None, 1.0, "Chase UR"),  # base

    # Chase Southwest Plus
    ("chase_southwest", "Travel", "SW Flights", 3.0, "SW RR"),  # MUST be SW Flights
    ("chase_southwest", "Travel", None, 2.0, "SW RR"),
    ("chase_southwest", None, None, 1.0, "SW RR"),  # base

    # Bilt Blue
    ("bilt_blue", "Home", "Rent", 1.0, "Bilt Points"),
    ("bilt_blue", "Food & Drink", "Restaurant", 3.0, "Bilt Points"),
    ("bilt_blue", "Travel", None, 2.0, "Bilt Points"),
    ("bilt_blue", None, None, 1.0, "Bilt Points"),  # base

    # Capital One Venture X
    ("venture_x", "Travel", "Hotel", 10.0, "Capital One Miles"),  # via C1 portal
    ("venture_x", "Travel", "Flights", 5.0, "Capital One Miles"),  # via C1 portal
    ("venture_x", "Travel", None, 2.0, "Capital One Miles"),
    ("venture_x", None, None, 2.0, "Capital One Miles"),  # 2x everywhere
]


def seed() -> None:
    db = get_sync_db()
    try:
        existing = db.query(EarnRule).count()
        if existing > 0:
            print(f"earn_rules already has {existing} rows — skipping seed.")
            return

        rules = [
            EarnRule(
                card_slug=card_slug,
                category=category,
                subcategory=subcategory,
                earn_rate=earn_rate,
                program=program,
            )
            for card_slug, category, subcategory, earn_rate, program in EARN_RULES
        ]
        db.add_all(rules)
        db.commit()
        print(f"Seeded {len(rules)} earn rules.")
    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
