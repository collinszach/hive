from app.db import Base  # noqa: F401

# Import all models so Alembic autogenerate and Base.metadata see them
from app.models.account import Account  # noqa: F401
from app.models.anomaly import Anomaly  # noqa: F401
from app.models.budget import Budget  # noqa: F401
from app.models.earn_rule import EarnRule  # noqa: F401
from app.models.net_worth import NetWorthSnapshot  # noqa: F401
from app.models.plaid_link import PlaidLink  # noqa: F401
from app.models.points_balance import PointsBalance  # noqa: F401
from app.models.points_ledger import PointsLedger  # noqa: F401
from app.models.transaction import Transaction  # noqa: F401

__all__ = [
    "Base",
    "Account",
    "Anomaly",
    "Budget",
    "EarnRule",
    "NetWorthSnapshot",
    "PlaidLink",
    "PointsBalance",
    "PointsLedger",
    "Transaction",
]
