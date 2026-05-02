"""AI-generated proactive insights feed model."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Insight(Base):
    __tablename__ = "insights"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    insight_type: Mapped[str] = mapped_column(Text, nullable=False)
    # Types: spending_spike | unusual_merchant | budget_warning | goal_milestone
    #        subscription_price_change | large_transaction | savings_opportunity
    #        category_trend | recurring_due | anomaly | achievement

    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    delta_pct: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    linked_entity_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    linked_entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(Text, nullable=False, server_default="medium")
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_dismissed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    dedup_key: Mapped[str | None] = mapped_column(Text, nullable=True, unique=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
