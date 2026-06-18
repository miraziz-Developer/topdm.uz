from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.ai_inspector import AIInspectorService
from app.application.merchant.voice_extraction import VoiceProductExtraction, extract_product_fields_from_transcription
from app.infrastructure.ai_clients.whisper import WhisperClient

logger = logging.getLogger(__name__)


class MerchantVoiceHandler:
    """Voice → Whisper → Groq structured JSON → pending product row."""

    async def transcribe_to_attributes(
        self,
        session: AsyncSession,
        *,
        audio_bytes: bytes,
        filename: str = "voice.ogg",
    ) -> tuple[VoiceProductExtraction, dict[str, Any]]:
        """Ovozni matnga va mahsulot maydonlariga aylantiradi (pending product yaratmaydi).

        Ovozli xabarda rasm bo'lmaydi — shuning uchun bu yerda faqat tavsif
        chiqariladi, mahsulot esa keyin yuborilgan rasm bilan yaratiladi.
        """
        whisper = WhisperClient()
        transcription = await whisper.transcribe(audio_bytes, filename=filename)
        extraction = await extract_product_fields_from_transcription(transcription)
        vision_attrs = self._to_vision_attributes(extraction)

        inspector = AIInspectorService(session)
        price_uzs = int(extraction.price_uzs) if extraction.price_uzs is not None else None
        price_check = await inspector.check_price(
            price_uzs,
            category=extraction.product_name,
            product_name=extraction.product_name,
        )
        vision_attrs["price_check"] = {
            "flagged": price_check.flagged,
            "message": price_check.message,
            "median_uzs": price_check.median_uzs,
            "ratio": price_check.ratio,
        }
        return extraction, vision_attrs

    @staticmethod
    def _to_vision_attributes(extraction: VoiceProductExtraction) -> dict[str, Any]:
        return {
            "source": "voice",
            "transcription": extraction.transcription,
            "price_uzs": extraction.price_uzs,
            "quantity": extraction.quantity,
            "size": extraction.size,
            "color": extraction.color,
            "product_name": extraction.product_name,
            "category": extraction.product_name,
            "material": extraction.raw.get("material"),
            "style_tags": [],
        }

    @staticmethod
    def format_telegram_reply(ex: VoiceProductExtraction) -> str:
        parts = [f"Matn: {ex.transcription}"]
        if ex.price_uzs is not None:
            parts.append(f"Narx: {ex.price_uzs} so'm")
        if ex.quantity is not None:
            parts.append(f"Miqdor: {ex.quantity}")
        if ex.size:
            parts.append(f"O'lcham: {ex.size}")
        if ex.color:
            parts.append(f"Rang: {ex.color}")
        return "\n".join(parts)
