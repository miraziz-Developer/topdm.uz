from pydantic import BaseModel, Field


class IntentSchema(BaseModel):
    intent: str = Field(pattern="^(OUTFIT_BUILDER|PRODUCT_FINDER)$")
    style: str
    reason: str = ""


class OutfitItemSchema(BaseModel):
    product_id: str
    reason: str


class OutfitResponse(BaseModel):
    intent: IntentSchema
    lookbook: list[OutfitItemSchema]
    explanation: str
