from __future__ import annotations

import asyncio
import io
import json
import warnings
from dataclasses import dataclass
from typing import Any

with warnings.catch_warnings():
    warnings.simplefilter("ignore", category=FutureWarning)
    import google.generativeai as genai
from loguru import logger
from PIL import Image, ImageFilter, ImageStat
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.infrastructure.ai_clients.gemini import GeminiClient
from app.infrastructure.ai_clients.groq import GroqClient
from app.infrastructure.db.models import ProductModel


@dataclass(slots=True)
class ImageModerationResult:
    allowed: bool
    reason: str
    flags: list[str]
    category: str | None = None


@dataclass(slots=True)
class PriceCheckResult:
    flagged: bool
    message: str
    price_uzs: int | None
    median_uzs: int | None
    ratio: float | None


class AIInspectorService:
    """AI Guard (image) + Price Normalizer for merchant submissions."""

    def __init__(self, session: AsyncSession | None = None) -> None:
        self._session = session
        self._settings = get_settings()
        self._gemini = GeminiClient()
        self._groq = GroqClient()

    @staticmethod
    def _check_image_sharpness(image_bytes: bytes, *, min_variance: float = 8.0) -> ImageModerationResult | None:
        try:
            pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            w, h = pil.size
            if w < 200 or h < 200:
                return ImageModerationResult(
                    False,
                    "Rasm juda kichik — yaqinroq va yorug'roq qayta oling.",
                    ["low_resolution"],
                )
            edges = pil.convert("L").filter(ImageFilter.FIND_EDGES)
            variance = float(ImageStat.Stat(edges).var[0])
            if variance < min_variance:
                return ImageModerationResult(
                    False,
                    "Rasm xira yoki harakatlangan — qayta oling.",
                    ["blurry_image"],
                )
        except Exception as exc:
            logger.debug("image_sharpness_check_skipped", error=str(exc))
        return None

    async def moderate_image(self, image_bytes: bytes) -> ImageModerationResult:
        if not image_bytes:
            return ImageModerationResult(False, "Rasm bo'sh.", ["empty_image"])

        sharpness = self._check_image_sharpness(image_bytes)
        if sharpness is not None:
            return sharpness

        system = (
            "You are Bozorliii Inspector for an Uzbekistan-wide clothing marketplace (all regions). "
            "Analyze the product photo. Return strict JSON only with keys: "
            "allowed (boolean), reason (short Uzbek), flags (string array), "
            "is_clothing (boolean), is_inappropriate (boolean), detected_category (string). "
            "ALLOW: clothing, shoes, accessories, underwear/lingerie shown for retail (not erotic poses). "
            "BLOCK: pornography, explicit nudity, erotic/sexual poses, violence, weapons, drugs, "
            "not clothing (food, random electronics), unreadable/blank image, offensive content."
        )

        try:
            if self._settings.groq_api_key:
                groq_result = await self._moderate_with_groq(image_bytes)
                if groq_result is not None:
                    return groq_result

            if self._settings.google_api_key:
                genai.configure(api_key=self._settings.google_api_key)
                model = genai.GenerativeModel(self._settings.gemini_model)
                pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")

                def _run() -> str:
                    resp = model.generate_content([system, pil])
                    return (resp.text or "").strip()

                raw = await asyncio.wait_for(asyncio.to_thread(_run), timeout=20.0)
                cleaned = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                payload = json.loads(cleaned)
                return self._parse_moderation(payload)

            if self._settings.is_production:
                return ImageModerationResult(
                    True,
                    "AI tekshiruvi vaqtincha o'chirilgan — rasm qabul qilindi.",
                    ["moderation_degraded"],
                )
            return ImageModerationResult(
                allowed=True,
                reason="AI tekshiruvi o'chirilgan — faqat dev muhit.",
                flags=["moderation_skipped"],
            )
        except Exception as exc:
            logger.warning("image_moderation_failed", error=str(exc))
            if self._settings.is_production:
                groq_result = await self._moderate_with_groq(image_bytes)
                if groq_result is not None:
                    return groq_result
                return ImageModerationResult(
                    True,
                    "AI vaqtincha ishlamayapti — rasm qabul qilindi. «Mahsulot qo'lda» orqali davom eting.",
                    ["moderation_degraded"],
                )
            return ImageModerationResult(
                allowed=True,
                reason="AI tekshiruvi ishlamadi — faqat dev muhit.",
                flags=["moderation_skipped"],
            )

    async def _moderate_with_groq(self, image_bytes: bytes) -> ImageModerationResult | None:
        if not self._settings.groq_api_key:
            return None
        prompt = (
            "Bu mahsulot rasmi Bozorliii kiyim bozori uchun (butun O'zbekiston). JSON: "
            '{"allowed":bool,"reason":"qisqa o\'zbekcha","flags":[],"is_clothing":bool,'
            '"is_inappropriate":bool,"detected_category":"string"}. '
            "Ruxsat: kiyim, ichki kiyim (savdo uchun). "
            "Block: porno/erotika, uyatsiz ochiq kontent, kiyim emas, nojo'ya kontent, xira rasm."
        )
        try:
            payload = await self._groq.chat_json(
                system_prompt="Marketplace image moderator. JSON only.",
                user_prompt=prompt,
                vision=True,
                image_bytes=image_bytes,
                image_mime="image/jpeg",
            )
            if isinstance(payload, dict):
                return self._parse_moderation(payload)
        except Exception as exc:
            logger.warning("groq_image_moderation_failed", error=str(exc))
        return None

    def _parse_moderation(self, payload: dict[str, Any]) -> ImageModerationResult:
        allowed = bool(payload.get("allowed", True))
        if payload.get("is_inappropriate"):
            allowed = False
        if payload.get("is_clothing") is False:
            allowed = False
        reason = str(payload.get("reason") or ("Rasm bloklandi." if not allowed else "Rasm mos."))
        flags = [str(f) for f in (payload.get("flags") or [])]
        if not allowed and "blocked" not in flags:
            flags.append("blocked")
        return ImageModerationResult(
            allowed=allowed,
            reason=reason,
            flags=flags,
            category=str(payload.get("detected_category") or payload.get("category") or "") or None,
        )

    async def check_price(
        self,
        price_uzs: int | None,
        *,
        category: str | None = None,
        product_name: str | None = None,
    ) -> PriceCheckResult:
        if price_uzs is None or price_uzs <= 0:
            return PriceCheckResult(False, "", price_uzs, None, None)

        median = await self._category_median_price(category, product_name)
        if median is None or median <= 0:
            return PriceCheckResult(False, "", price_uzs, None, None)

        ratio = price_uzs / median
        threshold = self._settings.price_outlier_multiplier
        if ratio >= threshold or ratio <= 1 / threshold:
            times = int(ratio) if ratio >= 1 else max(1, int(round(1 / ratio)))
            direction = "yuqori" if ratio >= 1 else "past"
            message = (
                f"Bu narx bozor o'rtacha narxidan taxminan {times} barobar {direction}. "
                f"O'rtacha: {median:,} so'm. Kiritilgan: {price_uzs:,} so'm. Ishoningiz komilmi?"
            ).replace(",", " ")
            return PriceCheckResult(True, message, price_uzs, median, round(ratio, 2))

        return PriceCheckResult(False, "", price_uzs, median, round(ratio, 2))

    async def _category_median_price(self, category: str | None, product_name: str | None) -> int | None:
        if not self._session:
            return None
        clauses = [ProductModel.is_available == True]
        label = (category or product_name or "").strip()
        if label:
            pattern = f"%{label[:48]}%"
            clauses.append(
                or_(ProductModel.name.ilike(pattern), ProductModel.description.ilike(pattern))
            )
        stmt = select(func.avg(ProductModel.price)).where(*clauses)
        result = await self._session.execute(stmt)
        avg_val = result.scalar()
        if avg_val is None:
            stmt_all = select(func.avg(ProductModel.price)).where(ProductModel.is_available == True)
            result = await self._session.execute(stmt_all)
            avg_val = result.scalar()
        return int(avg_val) if avg_val is not None else None
