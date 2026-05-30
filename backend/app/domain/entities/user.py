from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class AppUser:
    id: UUID
    email: str | None
    telegram_id: int | None
    phone: str | None
    display_name: str | None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def has_email(self) -> bool:
        return bool(self.email)

    @property
    def has_telegram(self) -> bool:
        return self.telegram_id is not None
