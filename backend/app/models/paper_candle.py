"""Daily OHLCV cache for paper-trading symbols.

The durable historical-bar store the backtester learns from and the live engine
appends to. One row per (symbol, date). ``adj_close`` is split/dividend adjusted;
indicators are computed off it so corporate actions don't read as price moves.
"""
import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PaperCandle(Base):
    __tablename__ = "paper_candles"
    __table_args__ = (
        UniqueConstraint("symbol", "date", name="uq_paper_candle_symbol_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
    open: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    high: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    low: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    close: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    volume: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 2), nullable=True)
    adj_close: Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
