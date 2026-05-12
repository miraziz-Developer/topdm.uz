import hashlib
from typing import Any


def deterministic_embedding(seed_text: str, dim: int = 1536) -> list[float]:
    digest = hashlib.sha256(seed_text.encode("utf-8")).digest()
    base = [b / 255.0 for b in digest]
    repeated = (base * ((dim // len(base)) + 1))[:dim]
    return repeated


class ClaudeStylistLLM:
    async def detect_intent(self, query: str, image_context: dict[str, Any] | None = None) -> str:
        suffix = f" with visual style {image_context.get('style')}" if image_context else ""
        return f"User wants a cohesive fashion look{suffix} for: {query}"

    async def generate_look(self, intent: str, products: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "intent": intent,
            "style_notes": "Global trend blend: minimal streetwear + premium casual layers.",
            "products": products[:6],
        }
