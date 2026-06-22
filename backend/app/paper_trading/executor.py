"""Trade executors for the paper-trading engine.

The executor is the **single seam** between simulated and (future) live trading. Only
``SimulatedExecutor`` is wired in this build; ``SnapTradeLiveExecutor`` is an inert stub
that raises ``NotImplementedError`` to prove the swap point. ``get_executor()`` always
returns the simulated one today — going live is a deliberate future decision, not a flag.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import NamedTuple

logger = logging.getLogger(__name__)


class ExecutionResult(NamedTuple):
    filled: bool
    symbol: str
    side: str            # "buy" | "sell"
    quantity: float
    price: float         # actual fill price (incl. slippage)
    executor_type: str
    message: str = ""


class TradeExecutor(ABC):
    """Abstract execution interface. Implementations fill an order and report back."""

    executor_type: str = "abstract"

    @abstractmethod
    def execute(self, symbol: str, side: str, quantity: float, reference_price: float) -> ExecutionResult:
        ...


class SimulatedExecutor(TradeExecutor):
    """Fills instantly at the reference price, adjusted by a configurable slippage.

    Never touches a real brokerage. Buys fill slightly above the reference price and
    sells slightly below, modeling adverse slippage.
    """

    executor_type = "simulated"

    def __init__(self, slippage_bps: float = 5.0) -> None:
        # basis points of slippage applied against the trader (1 bp = 0.01%).
        self._slippage = max(0.0, slippage_bps) / 10_000.0

    def execute(self, symbol: str, side: str, quantity: float, reference_price: float) -> ExecutionResult:
        if quantity <= 0 or reference_price <= 0:
            return ExecutionResult(False, symbol, side, 0.0, 0.0, self.executor_type, "invalid order")
        if side == "buy":
            fill = reference_price * (1.0 + self._slippage)
        elif side == "sell":
            fill = reference_price * (1.0 - self._slippage)
        else:
            return ExecutionResult(False, symbol, side, 0.0, 0.0, self.executor_type, f"bad side {side!r}")
        return ExecutionResult(True, symbol, side, float(quantity), float(fill), self.executor_type, "")


class SnapTradeLiveExecutor(TradeExecutor):
    """Future live-execution seam — intentionally inert.

    Implementing this later (Epic I8) requires no schema change (``PaperTrade.executor_type``
    already future-proofs it), only an explicit opt-in and a compliance pass.
    """

    executor_type = "snaptrade_live"

    def execute(self, symbol: str, side: str, quantity: float, reference_price: float) -> ExecutionResult:
        raise NotImplementedError(
            "Live execution is not implemented. This stub exists only to mark the future swap point."
        )


def get_executor() -> TradeExecutor:
    """Return the executor to use. Always simulated in this build."""
    return SimulatedExecutor()
