from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class LeadEvent(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("unified_products.id"), nullable=False, index=True)
    shop_id: Mapped[int] = mapped_column(Integer, ForeignKey("global_shops.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)  # click/call/book
    event_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
