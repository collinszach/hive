"""Daily mark-to-market snapshot of a paper portfolio vs. its SPY-equivalent benchmark.

One row per (portfolio, as_of). Drives the performance chart and the evaluation report.
"""
import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PaperPerformanceSnapshot(Base):
    __tablename__ = "paper_performance_snapshots"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "as_of", name="uq_paper_perf_portfolio_asof"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("paper_portfolios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    as_of: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
    cash: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    positions_value: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    portfolio_value: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    benchmark_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
