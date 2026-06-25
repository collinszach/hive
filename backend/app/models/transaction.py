import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Numeric, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plaid_transaction_id: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    authorized_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(Text, server_default="USD")
    merchant: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    subcategory: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category_source: Mapped[str] = mapped_column(Text, server_default="pending")
    plaid_category: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    # Plaid's modern personal_finance_category (primary + detailed). The legacy
    # `category` list above often omits income; PFC carries a reliable INCOME_* signal.
    plaid_pfc_primary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plaid_pfc_detailed: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_transfer: Mapped[bool] = mapped_column(Boolean, server_default="false")
    is_excluded: Mapped[bool] = mapped_column(Boolean, server_default="false")
    is_subscription: Mapped[bool] = mapped_column(Boolean, server_default="false")
    reimbursement_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pending: Mapped[bool] = mapped_column(Boolean, server_default="false")
    payment_channel: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location_city: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location_state: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location_zip: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_transactions_account_date", "account_id", "date"),
        Index("idx_transactions_date", "date"),
        Index("idx_transactions_category", "category", postgresql_where=text("is_excluded = FALSE")),
        Index("idx_transactions_pending", "pending", postgresql_where=text("pending = TRUE")),
    )
