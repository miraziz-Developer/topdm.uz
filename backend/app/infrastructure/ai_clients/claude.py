import json
import time

from app.application.stylist.schemas import IntentSchema, OutfitResponse
from app.infrastructure.ai_clients.groq import GroqClient


class ClaudeCircuitOpenError(RuntimeError):
    pass


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
            "You are a fashion intent classifier. Return strict JSON only: "
            '{"intent":"OUTFIT_BUILDER|PRODUCT_FINDER","style":"FORMAL|CASUAL|SMART","reason":"..."}'
        )
        user_prompt = f"Classify this query: {user_text}"
        try:
            payload = await self._message_json(system_prompt, user_prompt)
            return IntentSchema.model_validate(payload).model_dump()
        except Exception:
            return IntentSchema(intent="PRODUCT_FINDER", style="CASUAL").model_dump()

    async def compose_lookbook(self, intent: dict, products: list[dict]) -> dict:
        if not products:
            return OutfitResponse(
                intent=IntentSchema.model_validate(intent),
                lookbook=[],
                explanation="No matching products found for provided filters.",
            ).model_dump()

        system_prompt = (
            "You are Bozor-AI stylist. Return strict JSON only in this format: "
            '{"intent":{"intent":"OUTFIT_BUILDER|PRODUCT_FINDER","style":"..."},'
            '"lookbook":[{"product_id":"...", "reason":"..."}],'
            '"explanation":"..."} '
            "Use only product_id values present in provided products."
        )
        user_prompt = json.dumps({"intent": intent, "products": products}, ensure_ascii=True)
        try:
            payload = await self._message_json(system_prompt, user_prompt)
            validated = OutfitResponse.model_validate(payload)
            return validated.model_dump()
        except ClaudeCircuitOpenError:
            raise
        except Exception:
            fallback = OutfitResponse(
                intent=IntentSchema.model_validate(intent),
                lookbook=[
                    {"product_id": str(p["id"]), "reason": "Closest semantic match for your query."}
                    for p in products[:6]
                ],
                explanation="Fallback lookbook generated due to temporary LLM parse failure.",
            )
            return fallback.model_dump()
