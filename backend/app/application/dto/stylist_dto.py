from pydantic import BaseModel, Field


class StylistRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    query: str | None = None
    image_url: str | None = None
    currency: str = "UZS"


class ProductResult(BaseModel):
    id: str
    name: str
    price: float
    currency: str
    tags: dict


class LookResponse(BaseModel):
    intent: str
    style_notes: str
    products: list[ProductResult]
