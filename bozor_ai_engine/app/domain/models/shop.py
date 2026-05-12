from sqlalchemy import Float, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class GlobalShop(Base):
    __tablename__ = "global_shops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    block: Mapped[str] = mapped_column(String(64), nullable=False)
    row: Mapped[str] = mapped_column(String(64), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    telegram_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    address_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    shop_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    products = relationship("UnifiedProduct", back_populates="shop")
