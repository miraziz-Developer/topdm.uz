from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class UserPreferenceSnapshot(Base):
    __tablename__ = "user_preference_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True, unique=True)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
