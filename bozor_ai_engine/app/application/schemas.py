from pydantic import BaseModel, Field


class IntentResult(BaseModel):
    intent: str = Field(pattern="^(OUTFIT_BUILDER|PRODUCT_SEARCH|MERCHANT_ONBOARDING)$")
    style: str
    reason: str


class VisionAnalysis(BaseModel):
    category: str
    material: str
    style_type: str
    colors_hex: list[str]


class StylistLookItem(BaseModel):
    id: int
    name: str
    price: float
    currency: str


class StylistLookResponse(BaseModel):
    intent: IntentResult
    reasoning: str
    products: list[StylistLookItem]
