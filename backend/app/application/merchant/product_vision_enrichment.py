from __future__ import annotations

from typing import Any

from app.infrastructure.ai_clients.groq import GroqClient

_ENRICH_SYSTEM = """You analyze a clothing/product photo for an Uzbek marketplace listing.
Return strict JSON only:
{
  "product_name": "short Uzbek product title",
  "price_uzs": 250000 or null,
  "category_hint": "shim|kurtka|koylak|poyabzal|sumka|libos|atir|sport|bolalar|boshqa",
  "color": "qora",
  "material": "paxta",
  "description": "one sentence in Uzbek"
}
price_uzs must be integer or null if unknown."""


async def enrich_product_from_vision(vision: dict[str, Any]) -> dict[str, Any]:
    merged = dict(vision)
    category = str(vision.get("category") or "")
    color = str(vision.get("color") or "")
    material = str(vision.get("material") or "")
    tags = vision.get("style_tags") or []

    groq = GroqClient()
    try:
        payload = await groq.chat_json(
            system_prompt=_ENRICH_SYSTEM,
            user_prompt=(
                f"Vision fields: category={category}, color={color}, material={material}, "
                f"tags={tags}"
            ),
        )
    except Exception:
        payload = {}

    if payload.get("product_name"):
        merged["product_name"] = str(payload["product_name"]).strip()
    if payload.get("price_uzs") is not None:
        try:
            merged["price_uzs"] = int(float(payload["price_uzs"]))
        except (TypeError, ValueError):
            pass
    if payload.get("category_hint"):
        merged["category_hint"] = str(payload["category_hint"]).strip()
    if payload.get("description"):
        merged["description"] = str(payload["description"]).strip()
    if not merged.get("product_name"):
        merged["product_name"] = category or "Yangi mahsulot"
    return merged
