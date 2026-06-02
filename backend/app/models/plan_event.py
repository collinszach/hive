"""A future cash event for net-worth projection — one-time or recurring, inflow or outflow."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PlanEvent(Base):
    __tablename__ = "plan_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_scenarios.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)   # always positive; see `kind`
    event_date: Mapped[date] = mapped_column(Date, nullable=False)          # = start_date for recurring events
    kind: Mapped[str] = mapped_column(Text, server_default="outflow")       # inflow | outflow
    target: Mapped[str] = mapped_column(Text, server_default="cash")        # cash | investment
    recurrence: Mapped[str] = mapped_column(Text, server_default="once")    # once|monthly|quarterly|semiannual|annual
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)      # inclusive bound for recurrence
    growth_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default="0.00")
    category: Mapped[str | None] = mapped_column(Text, nullable=True)       # Housing, Vehicle, Travel, Other
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
