from pydantic import BaseModel, Field, field_validator


class IntentSchema(BaseModel):
    intent: str = Field(pattern="^(OUTFIT_BUILDER|PRODUCT_FINDER)$")
    style: str
    reason: str = ""
    occasion: str = Field(
        default="EVERYDAY",
        description="Scene: BEACH, SPORT, OFFICE, PARTY, EVERYDAY, FORMAL",
    )

    @field_validator("occasion", mode="before")
    @classmethod
    def normalize_occasion(cls, v: object) -> str:
        allowed = {"BEACH", "SPORT", "OFFICE", "PARTY", "EVERYDAY", "FORMAL"}
        s = str(v or "EVERYDAY").strip().upper()
        return s if s in allowed else "EVERYDAY"


class OutfitItemSchema(BaseModel):
    product_id: str
    reason: str


class OutfitResponse(BaseModel):
    intent: IntentSchema
    lookbook: list[OutfitItemSchema]
    explanation: str
