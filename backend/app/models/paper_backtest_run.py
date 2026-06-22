"""Durable record of one backtest invocation — "what the engine learned and how it
actually did out-of-sample." Surfaced in the UI before forward paper trading starts.

The train/validation split is explicit: params were tuned on [train_start, train_end]
and scored once on [validation_start, validation_end]. ``validation_sharpe`` (not
``train_sharpe``) is the honest "is this strategy any good" number.
"""
import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PaperBacktestRun(Base):
    __tablename__ = "paper_backtest_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("paper_portfolios.id", ondelete="SET NULL"), nullable=True, index=True
    )
    train_start: Mapped[date_type] = mapped_column(Date, nullable=False)
    train_end: Mapped[date_type] = mapped_column(Date, nullable=False)
    validation_start: Mapped[date_type] = mapped_column(Date, nullable=False)
    validation_end: Mapped[date_type] = mapped_column(Date, nullable=False)
    selected_params: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    train_sharpe: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    validation_sharpe: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    validation_total_return: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 6), nullable=True)
    validation_vs_benchmark: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
