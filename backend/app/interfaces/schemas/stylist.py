from pydantic import BaseModel, Field


class StylistApiRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    query: str | None = None
    image_url: str | None = None
    currency: str = "UZS"


class MerchantAutoListingRequest(BaseModel):
    shop_id: str
    image_url: str
    price: float
    currency: str = "UZS"
