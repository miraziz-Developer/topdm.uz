from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.infrastructure.ai_clients.groq import GroqClient


class VoiceProductExtraction(BaseModel):
    transcription: str = ""
    price_uzs: int | None = Field(default=None, ge=0)
    quantity: int | None = Field(default=None, ge=0)
    size: str | None = None
    color: str | None = None
    product_name: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


_EXTRACTION_SYSTEM = """You extract structured product fields from Uzbek/Russian merchant voice transcriptions.
Return strict JSON only:
{
  "price_uzs": 150000 or null,
  "quantity": 2 or null,
  "size": "M" or "42" or null,
  "color": "qora" or null,
  "product_name": "erkaklar ko'ylagi" or null
}
Use null when unknown. price_uzs and quantity must be integers."""


async def extract_product_fields_from_transcription(transcription: str) -> VoiceProductExtraction:
    groq = GroqClient()
    payload = await groq.chat_json(
        system_prompt=_EXTRACTION_SYSTEM,
        user_prompt=f"Transcription:\n{transcription}",
    )
    price = payload.get("price_uzs") or payload.get("price")
    if price is not None:
        try:
            price = int(float(price))
        except (TypeError, ValueError):
            price = None
    qty = payload.get("quantity") or payload.get("qty")
    if qty is not None:
        try:
            qty = int(float(qty))
        except (TypeError, ValueError):
            qty = None
    return VoiceProductExtraction(
        transcription=transcription,
        price_uzs=price,
        quantity=qty,
        size=str(payload["size"]).strip() if payload.get("size") else None,
        color=str(payload["color"]).strip() if payload.get("color") else None,
        product_name=str(payload["product_name"]).strip() if payload.get("product_name") else None,
        raw=payload if isinstance(payload, dict) else {},
    )
