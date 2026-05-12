from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class UnifiedProduct(Base):
    __tablename__ = "unified_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="UZS")
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536))
    ai_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    shop_id: Mapped[int] = mapped_column(Integer, ForeignKey("global_shops.id"), index=True)

    shop = relationship("GlobalShop", back_populates="products")
