"""Projection assumptions, one row per scenario (Epic 8.1)."""
import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PlanAssumption(Base):
    __tablename__ = "plan_assumptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_scenarios.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    annual_return_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default="6.00")
    annual_inflation_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default="3.00")
    effective_tax_rate_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default="0.00")
    emergency_floor: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default="0.00")
    auto_invest_surplus: Mapped[bool] = mapped_column(Boolean, server_default="false")
    band_spread_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default="3.00")
    # NULL = auto-derive from the last 3 months of transactions; set = explicit override.
    base_monthly_expenses: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
