"""A simulated trade execution in a paper portfolio.

``executor_type`` records which executor filled it (``"simulated"`` today). It exists
to future-proof a live/simulated distinction so that wiring ``SnapTradeLiveExecutor``
later requires no schema change — only an explicit opt-in.
"""
import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PaperTrade(Base):
    __tablename__ = "paper_trades"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("paper_portfolios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    side: Mapped[str] = mapped_column(Text, nullable=False)  # buy | sell
    quantity: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(16, 4), nullable=False)
    executor_type: Mapped[str] = mapped_column(Text, nullable=False, server_default="simulated")
    signal_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 4), nullable=True)
    as_of: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
