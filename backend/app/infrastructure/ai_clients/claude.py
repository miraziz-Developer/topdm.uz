import json
import time
from typing import Any

from app.application.stylist.schemas import IntentSchema, OutfitResponse
from app.infrastructure.ai_clients.groq import GroqClient


class ClaudeCircuitOpenError(RuntimeError):
    pass


def _coerce_intent(value: Any, fallback: dict) -> dict:
    if isinstance(value, dict):
        try:
            return IntentSchema.model_validate(value).model_dump()
        except Exception:
            return IntentSchema.model_validate(fallback).model_dump()
    return IntentSchema.model_validate(fallback).model_dump()


def _coerce_lookbook(value: Any, products: list[dict]) -> list[dict]:
    allowed = {str(p["id"]) for p in products}
    items: list[dict] = []
    if not isinstance(value, list):
        return items
    for entry in value:
        if not isinstance(entry, dict):
            continue
        product_id = entry.get("product_id") or entry.get("id")
        if product_id is None:
            continue
        product_id = str(product_id)
        if product_id not in allowed:
            continue
        reason = str(entry.get("reason") or entry.get("why") or "Sizning so'rovingizga mos keladi.")
        items.append({"product_id": product_id, "reason": reason})
    return items


class ClaudeClient:
    def __init__(self) -> None:
        self._groq = GroqClient()
        self._failures = 0
        self._opened_until = 0.0

    def _check_circuit(self) -> None:
        if time.monotonic() < self._opened_until:
            raise ClaudeCircuitOpenError("Service temporarily unavailable")

    def _on_failure(self) -> None:
        self._failures += 1
        if self._failures >= 3:
            self._opened_until = time.monotonic() + 60

    def _on_success(self) -> None:
        self._failures = 0
        self._opened_until = 0.0

    async def _message_json(self, system_prompt: str, user_prompt: str) -> dict:
        self._check_circuit()
        try:
            parsed = await self._groq.chat_json(system_prompt=system_prompt, user_prompt=user_prompt)
            self._on_success()
            return parsed
        except Exception:
            self._on_failure()
            raise

    async def classify_intent(self, user_text: str) -> dict:
        system_prompt = (
            "You are a fashion intent classifier for Uzbek shoppers. Return strict JSON only: "
            '{"intent":"OUTFIT_BUILDER|PRODUCT_FINDER",'
            '"style":"FORMAL|CASUAL|SMART|ACTIVE|RESORT",'
            '"occasion":"BEACH|SPORT|OFFICE|PARTY|EVERYDAY|FORMAL",'
            '"reason":"..."} '
            "occasion rules: if the user mentions beach/sea/swimming/pool/resort in Uzbek or Russian "
            "(soxil, plyaj, plaj, dengiz, deniz, suv, yuzish, basseyn, dam olish, kurort), set occasion=BEACH "
            "and style=CASUAL or RESORT, never FORMAL. "
            "Office/work → OFFICE or FORMAL as appropriate. "
            "Generic shopping → EVERYDAY. "
            "Set reason in Uzbek."
        )
        user_prompt = f"Classify this query: {user_text}"
        try:
            payload = await self._message_json(system_prompt, user_prompt)
            return IntentSchema.model_validate(payload).model_dump()
        except Exception:
            return IntentSchema(
                intent="PRODUCT_FINDER", style="CASUAL", occasion="EVERYDAY"
            ).model_dump()

    async def compose_lookbook(self, intent: dict, products: list[dict]) -> dict:
        if not products:
            return OutfitResponse(
                intent=IntentSchema.model_validate(intent),
                lookbook=[],
                explanation="No matching products found for provided filters.",
            ).model_dump()

        system_prompt = (
            "You are Bozorliii stylist for Uzbek shoppers. Return strict JSON only in this format: "
            '{"intent":{"intent":"OUTFIT_BUILDER|PRODUCT_FINDER","style":"...","occasion":"...",'
            '"reason":"..."},'
            '"lookbook":[{"product_id":"...", "reason":"..."}],'
            '"explanation":"..."} '
            "Use only product_id values present in provided products. "
            "Write explanation and each lookbook reason in Uzbek. "
            "Scene rules: if intent.occasion is BEACH or style is RESORT, recommend lightweight beach-appropriate "
            "items (shorts, t-shirt, sandals, swimwear, beach bag, sun hat, linen shirt). "
            "Never describe or justify office/formal wear (jeans + classic white dress shirt + leather belt) "
            "for beach/sea/pool. If catalog items are imperfect, still explain in a beach-appropriate way "
            "and pick the closest casual/summer options. "
            "Each lookbook reason must honestly match the product name/category from the catalog "
            "(do not claim a product is a shirt if the name says shoes)."
        )
        user_prompt = json.dumps({"intent": intent, "products": products}, ensure_ascii=True)
        try:
            payload = await self._message_json(system_prompt, user_prompt)
            normalized = {
                "intent": _coerce_intent(payload.get("intent"), intent),
                "lookbook": _coerce_lookbook(payload.get("lookbook"), products),
                "explanation": str(
                    payload.get("explanation")
                    or payload.get("summary")
                    or "Sizning so'rovingiz uchun mos tovarlar tanlandi."
                ),
            }
            validated = OutfitResponse.model_validate(normalized)
            return validated.model_dump()
        except ClaudeCircuitOpenError:
            raise
        except Exception:
            fallback = OutfitResponse(
                intent=IntentSchema.model_validate(intent),
                lookbook=[
                    {"product_id": str(p["id"]), "reason": "Katalogdagi eng yaqin mos tovar."}
                    for p in products[:6]
                ],
                explanation=(
                    "AI javobini vaqtincha qayta ishlab bo'lmadi, shuning uchun eng mos "
                    "topilgan tovarlar ko'rsatildi. Bir ozdan keyin qayta urinib ko'ring."
                ),
            )
            return fallback.model_dump()
