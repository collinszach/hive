"""Subscription tracker model."""
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_name: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_name: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(Text, nullable=False, server_default="USD")
    frequency: Mapped[str] = mapped_column(Text, nullable=False)  # monthly | annual | weekly | quarterly
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    subcategory: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_charged: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_expected: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    is_cancelled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    auto_detected: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    previous_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    price_changed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    annual_cost: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    charge_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
