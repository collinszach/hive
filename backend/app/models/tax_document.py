"""Tax document — uploaded W-2, 1099s, etc."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class TaxDocument(Base):
    __tablename__ = "tax_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tax_year: Mapped[int] = mapped_column(Integer, nullable=False)
    doc_type: Mapped[str] = mapped_column(Text, nullable=False)  # W2 | 1099NEC | 1099DIV | 1099INT | 1099B | 1099G
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    extracted_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    extraction_status: Mapped[str] = mapped_column(Text, nullable=False, server_default="'pending'")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
