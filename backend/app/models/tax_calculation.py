"""Saved tax calculation result."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class TaxCalculation(Base):
    __tablename__ = "tax_calculations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tax_year: Mapped[int] = mapped_column(Integer, nullable=False)
    filing_status: Mapped[str] = mapped_column(Text, nullable=False)   # single | mfj | mfs | hoh
    state: Mapped[str] = mapped_column(Text, nullable=False)            # 2-letter state code
    inputs_json: Mapped[dict] = mapped_column(JSONB, nullable=False)    # all inputs used
    results_json: Mapped[dict] = mapped_column(JSONB, nullable=False)   # full breakdown
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
