from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(min_length=2)
    limit: int = Field(default=15, ge=1, le=50)


class ImageSearchRequest(BaseModel):
    image_b64: str = Field(min_length=10)
    limit: int = Field(default=15, ge=1, le=50)


class MerchantOnboardingRequest(BaseModel):
    name: str
    latitude: float
    longitude: float
    block: str
    row: str
    phone: str | None = None
    telegram_username: str | None = None
    address_note: str | None = None


class LeadTrackRequest(BaseModel):
    user_id: str
    product_id: int
    shop_id: int
    event_type: str = Field(pattern="^(click|call|book)$")
    metadata: dict = Field(default_factory=dict)
