from __future__ import annotations

import re
from typing import Any, Literal

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.infrastructure.ai_clients.groq import GroqClient
from app.infrastructure.db.models import ShopModel
from app.models.merchant_support import MerchantSupportFaqModel

ChatRole = Literal["user", "assistant"]

_SYSTEM_TEMPLATE = """Sen Bozorliii.uz CRM yordamchisisan — do'kon egalari uchun qo'llab-quvvatlash AI.
Javoblarni o'zbek tilida, qisqa va aniq yoz. CRM bo'limlari: Bosh sahifa, Savdo, Chat, Mahsulotlar, Kontent (banner), Do'kon.

QOIDALAR:
1. Faqat bilim bazasidagi ma'lumot va umumiy CRM logikasiga tayangan holda javob ber.
2. Aniq bilmagan, shaxsiy hisob/balans/to'lov muammosi, yoki texnik xato tafsilotlarini bilmasang — escalated=true qil.
3. Hech qachon uydirmagan funksiya yoki narx haqida gapirma.
4. Javob JSON formatida: {{"reply": "...", "escalated": false}}

BILIM BAZASI (FAQ):
{faq_block}
"""


def _normalize_telegram_username(raw: str) -> str:
    value = (raw or "").strip().lstrip("@")
    if not value:
        return ""
    if not re.fullmatch(r"[A-Za-z0-9_]{4,32}", value):
        return ""
    return value


def _telegram_public(username: str) -> tuple[str | None, str | None]:
    normalized = _normalize_telegram_username(username)
    if not normalized:
        return None, None
    return f"@{normalized}", f"https://t.me/{normalized}"


class MerchantSupportAiService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._groq = GroqClient()

    def admin_contact(self) -> dict[str, str | None]:
        handle, url = _telegram_public(self._settings.platform_support_telegram_username)
        return {"admin_telegram": handle, "admin_telegram_url": url}

    async def get_config(self) -> dict[str, Any]:
        contact = self.admin_contact()
        return {
            "greeting": (
                "Salom! Men Bozorliii AI yordamchisiman — mahsulot, banner, buyurtma, "
                "balans va CRM bo'yicha savollaringizga javob beraman."
            ),
            **contact,
            "ai_enabled": bool(self._settings.groq_api_key),
        }

    async def _load_faq_block(self) -> str:
        result = await self._session.execute(
            select(MerchantSupportFaqModel)
            .where(MerchantSupportFaqModel.is_active.is_(True))
            .order_by(MerchantSupportFaqModel.sort_order, MerchantSupportFaqModel.topic)
        )
        rows = result.scalars().all()
        if not rows:
            return "(Bilim bazasi hali to'ldirilmagan — admin paneldan FAQ qo'shing.)"
        parts: list[str] = []
        for row in rows:
            parts.append(f"[{row.topic}] S: {row.question}\nJ: {row.answer}")
        return "\n\n".join(parts)

    async def chat(
        self,
        *,
        shop: ShopModel,
        message: str,
        history: list[dict[str, str]],
    ) -> dict[str, Any]:
        text = message.strip()
        if not text:
            raise ValueError("Xabar bo'sh")
        if len(text) > 2000:
            raise ValueError("Xabar juda uzun")

        contact = self.admin_contact()
        if not self._settings.groq_api_key:
            return self._escalation_response(
                "AI hozircha yoqilmagan. Admin bilan to'g'ridan-to'g'ri bog'laning.",
                contact,
            )

        faq_block = await self._load_faq_block()
        system_prompt = _SYSTEM_TEMPLATE.format(faq_block=faq_block)
        shop_ctx = (
            f"Do'kon: {shop.name}. Faol: {shop.is_active}. "
            f"Tasdiq: {shop.verification_status}. Coin: {int(shop.coins_balance or 0)}."
        )

        messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        messages.append({"role": "system", "content": shop_ctx})
        for item in history[-12:]:
            role = item.get("role", "user")
            content = (item.get("content") or "").strip()
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content[:2000]})
        messages.append({"role": "user", "content": text})

        try:
            data = await self._groq.chat_completion(
                messages=messages,
                temperature=0.15,
                response_format={"type": "json_object"},
            )
            raw = data["choices"][0]["message"]["content"]
            import json

            cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            payload = json.loads(cleaned)
            reply = str(payload.get("reply") or "").strip()
            escalated = bool(payload.get("escalated"))
            if not reply:
                return self._escalation_response(
                    "Bu savolga ishonchli javob bera olmadim.",
                    contact,
                )
            if escalated:
                return self._escalation_response(reply, contact)
            return {
                "reply": reply,
                "escalated": False,
                **contact,
            }
        except Exception as exc:
            logger.warning("support_ai_chat_failed", error=str(exc), shop_id=str(shop.id))
            return self._escalation_response(
                "AI vaqtincha javob bera olmadi. Admin bilan bog'laning.",
                contact,
            )

    def _escalation_response(self, reply: str, contact: dict[str, str | None]) -> dict[str, Any]:
        handle = contact.get("admin_telegram")
        suffix = ""
        if handle:
            suffix = f"\n\nAdmin bilan bog'laning: {handle}"
        return {
            "reply": f"{reply.rstrip()}{suffix}",
            "escalated": True,
            **contact,
        }
