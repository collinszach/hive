from __future__ import annotations
import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

import uuid as _uuid

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class GoalType(str, enum.Enum):
    save = "save"                  # Watch account balance grow toward target
    spend_under = "spend_under"    # Keep category spend below target per month
    pay_down = "pay_down"          # Watch liability balance shrink to zero


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    goal_type: Mapped[GoalType] = mapped_column(SAEnum(GoalType, name="goaltype"), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    account_id: Mapped[Optional[_uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    deadline: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
