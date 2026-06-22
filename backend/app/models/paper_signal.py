"""Paper-trading signals — one row per (symbol, as_of date, source).

``source`` distinguishes ``"backtest"`` signals (replayed at a historical date by
the walk-forward engine) from ``"live"`` signals (generated for today going forward),
so both live in the same table without colliding. ``indicators`` keeps the raw
technical values for transparency/audit. Every signal is point-in-time: it was
computed using only candles with ``date <= as_of``.
"""
import uuid
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PaperSignal(Base):
    __tablename__ = "paper_signals"
    __table_args__ = (
        UniqueConstraint("symbol", "as_of", "source", name="uq_paper_signal_symbol_asof_source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    as_of: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
    signal_score: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)  # -1..1
    signal_label: Mapped[str] = mapped_column(Text, nullable=False)  # buy | sell | hold
    confidence: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)  # 0..1
    regime_label: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    indicators: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    source: Mapped[str] = mapped_column(Text, nullable=False, server_default="live")  # backtest | live
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
