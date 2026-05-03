import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    plaid_account_id: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    plaid_item_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    official_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    institution: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    subtype: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    card_slug: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    current_balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    available_balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    credit_limit: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    statement_balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    statement_close_day: Mapped[Optional[int]] = mapped_column(nullable=True)
    payment_due_day: Mapped[Optional[int]] = mapped_column(nullable=True)
    autopay: Mapped[bool] = mapped_column(Boolean, server_default="false")
    currency: Mapped[str] = mapped_column(Text, server_default="USD")
    mask: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_synced: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_manual: Mapped[bool] = mapped_column(Boolean, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    is_excluded: Mapped[bool] = mapped_column(Boolean, server_default="false")
    snaptrade_account_id: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
