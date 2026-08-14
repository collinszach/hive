from app.db import Base  # noqa: F401

# Import all models so Alembic autogenerate and Base.metadata see them
from app.models.account import Account  # noqa: F401
from app.models.anomaly import Anomaly  # noqa: F401
from app.models.budget import Budget  # noqa: F401
from app.models.categorization_rule import CategorizationRule  # noqa: F401
from app.models.device_token import DeviceToken  # noqa: F401
from app.models.earn_rule import EarnRule  # noqa: F401
from app.models.goal import Goal, GoalType  # noqa: F401
from app.models.insight import Insight  # noqa: F401
from app.models.net_worth import NetWorthSnapshot  # noqa: F401
from app.models.paper_backtest_run import PaperBacktestRun  # noqa: F401
from app.models.paper_candle import PaperCandle  # noqa: F401
from app.models.paper_performance_snapshot import PaperPerformanceSnapshot  # noqa: F401
from app.models.paper_portfolio import PaperPortfolio  # noqa: F401
from app.models.paper_position import PaperPosition  # noqa: F401
from app.models.paper_signal import PaperSignal  # noqa: F401
from app.models.paper_trade import PaperTrade  # noqa: F401
from app.models.paper_watchlist_symbol import PaperWatchlistSymbol  # noqa: F401
from app.models.plaid_link import PlaidLink  # noqa: F401
from app.models.points_balance import PointsBalance  # noqa: F401
from app.models.points_ledger import PointsLedger  # noqa: F401
from app.models.subscription import Subscription  # noqa: F401
from app.models.transaction import Transaction  # noqa: F401
from app.models.plan_event import PlanEvent  # noqa: F401
from app.models.plan_scenario import PlanScenario  # noqa: F401
from app.models.plan_assumption import PlanAssumption  # noqa: F401
from app.models.income_stream import IncomeStream  # noqa: F401
from app.models.loan import Loan  # noqa: F401
from app.models.loan_entry import LoanEntry  # noqa: F401
from app.models.roth_contribution import RothContribution  # noqa: F401
from app.models.user import User  # noqa: F401

__all__ = [
    "Base",
    "Account",
    "Anomaly",
    "Budget",
    "CategorizationRule",
    "DeviceToken",
    "EarnRule",
    "Goal",
    "GoalType",
    "IncomeStream",
    "Insight",
    "Loan",
    "LoanEntry",
    "NetWorthSnapshot",
    "PaperBacktestRun",
    "PaperCandle",
    "PaperPerformanceSnapshot",
    "PaperPortfolio",
    "PaperPosition",
    "PaperSignal",
    "PaperTrade",
    "PaperWatchlistSymbol",
    "PlaidLink",
    "PlanAssumption",
    "PlanEvent",
    "PlanScenario",
    "PointsBalance",
    "PointsLedger",
    "RothContribution",
    "Subscription",
    "Transaction",
    "User",
]
