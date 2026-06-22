"""A virtual (paper) portfolio. Fully independent of real-money SnapTrade holdings.

``status`` distinguishes a ``"backtest"`` portfolio (transient bookkeeping for a
walk-forward run) from a ``"live"`` forward-trading portfolio under its 6-month
evaluation window. ``strategy_params`` holds the configuration the backtest learned;
``benchmark_start_price`` anchors the parallel SPY buy-and-hold benchmark.
"""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PaperPortfolio(Base):
    __tablename__ = "paper_portfolios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(Text, server_default="Paper Portfolio")
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="live")  # live | backtest | completed
    starting_cash: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    current_cash: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    strategy_params: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    benchmark_symbol: Mapped[str] = mapped_column(Text, server_default="SPY")
    benchmark_start_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    evaluation_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
