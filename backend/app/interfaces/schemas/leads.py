from uuid import UUID

from pydantic import BaseModel, Field


class LeadTrackRequest(BaseModel):
    product_id: UUID
    user_id: str = Field(..., min_length=1)
    source: str = "telegram_webapp"
    metadata: dict = Field(default_factory=dict)
