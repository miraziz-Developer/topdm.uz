"""AI platform moderator — shop registration and product publish gates."""

from __future__ import annotations

import asyncio
import io
import json
import re
import warnings
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

with warnings.catch_warnings():
    warnings.simplefilter("ignore", category=FutureWarning)
    import google.generativeai as genai
from loguru import logger

from app.application.merchant.ai_inspector import AIInspectorService
from app.core.config import get_settings
from app.infrastructure.ai_clients.groq import GroqClient
from app.infrastructure.db.models import ShopModel

_PLACEHOLDER_MARKERS = ("placeholder.svg", "bozorliii-product-placeholder", "/placeholder")

_SPAM_NAME_RE = re.compile(r"(.)\1{5,}|^[^a-zA-Zа-яА-ЯёЁўғқҳ0-9]+$")

# Minimal matn filtri — asosiy tekshiruv AI da
_PROFANITY_RE = re.compile(
    r"(?i)\b("
    r"fuck|shit|bitch|porn|xxx|nude|naked|"
    r"сука|бля|хуй|пизд|еба|"
    r"skaman|jalab|qo't|sik"
    r")\b"
)

_UNIVERSAL_MODERATION_POLICY = """
Platforma: Bozorliii — butun O'zbekiston bo'ylab kiyim, poyabzal va aksessuar savdosi.
Bozor nomi, viloyat yoki GPS cheklanmaydi — Samarqand, Farg'ona, Toshkent, onlayn do'kon ham mumkin.

TASDIQLANG: haqiqiy savdo joyi yoki kiyim do'koni, professional yoki oddiy savdo rasmi, toza matn.

RAD ETING:
- Pornografik/erotik kontent, uyatsiz ochiq jinsiy pozalar
- Ichki kiyim vitrinada yoki katalogda — RUXSAT; faqat erotika/porno — YO'Q
- Yuzlar: nojo'ya kontekst, bolalar bilan nomaqbul kombinatsiya, shaxsiy selfie do'kon o'rniga
- Haqorat, so'kinish, zo'ravonlik, narkotika, qurol
- Soxta/spam profil, faqat internet stok rasm, bo'sh/mazmun yo'q rasm
- Mahsulot kiyim/aksessuar emas (elektronika, oziq-ovqat va h.k.)
- Nom yoki tavsifda nomaqbul so'zlar

Har xil vaziyat uchun adolatli va izohli qaror qiling. Qisqa sabab o'zbek tilida.
""".strip()


@dataclass(slots=True)
class ModerationVerdict:
    approved: bool
    reason: str
    flags: list[str] = field(default_factory=list)
    score: int = 0
    details: dict[str, Any] | None = None


class ShopAiModeratorService:
    """AI-first moderator — minimal strukturaviy qoidalar + vision/text AI."""

    def __init__(self, session=None) -> None:
        self._session = session
        self._settings = get_settings()
        self._inspector = AIInspectorService(session)
        self._groq = GroqClient()

    @staticmethod
    def is_placeholder_image_url(url: str | None) -> bool:
        raw = (url or "").strip().lower()
        if not raw:
            return True
        return any(marker in raw for marker in _PLACEHOLDER_MARKERS)

    @staticmethod
    def detect_image_mime(image_bytes: bytes) -> str:
        if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
            return "image/png"
        if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
            return "image/webp"
        return "image/jpeg"

    async def review_shop(self, shop: ShopModel, *, image_bytes: bytes | None = None) -> ModerationVerdict:
        rules = self._review_shop_rules(shop)
        if rules is not None:
            return rules

        if not image_bytes and shop.storefront_image_url:
            if self.is_placeholder_image_url(shop.storefront_image_url):
                return ModerationVerdict(
                    False,
                    "Do'kon rasmi yuklanmadi — haqiqiy do'kon yoki rasta fotosini qayta yuboring.",
                    ["storefront_placeholder"],
                )
            from app.application.visual_search.image_fetch import fetch_image_bytes

            image_bytes = await fetch_image_bytes(shop.storefront_image_url)

        if not image_bytes:
            if self._is_fast_telegram_registration(shop):
                return ModerationVerdict(
                    True,
                    "Tez ro'yxat qabul qilindi. Vitrina rasmini CRM → Do'kon bo'limidan qo'shing.",
                    ["storefront_pending"],
                    score=70,
                )
            return ModerationVerdict(
                False,
                "Do'kon rasmi kerak — do'kon yoki savdo joyingiz fotosini yuboring.",
                ["storefront_missing"],
            )

        ai_verdict = await self._review_shop_ai(shop, image_bytes)
        if ai_verdict is not None:
            return ai_verdict

        return ModerationVerdict(
            True,
            "Do'kon AI moderator tomonidan tasdiqlandi.",
            ["ai_approved"],
            score=85,
        )

    async def review_product_publish(
        self,
        *,
        shop: ShopModel,
        name: str,
        price_uzs: int,
        category_label: str | None,
        image_bytes: bytes | None,
        description: str | None = None,
    ) -> ModerationVerdict:
        if not shop.is_verified:
            return ModerationVerdict(
                False,
                "Do'kon hali tasdiqlanmagan. Avval do'kon profilingiz AI tekshiruvidan o'tishi kerak.",
                ["shop_not_verified"],
            )

        if shop.is_blocked:
            return ModerationVerdict(False, "Do'kon bloklangan.", ["shop_blocked"])

        name_clean = (name or "").strip()
        if len(name_clean) < 2:
            return ModerationVerdict(False, "Mahsulot nomi juda qisqa.", ["invalid_name"])

        text_issue = self._check_text_fields(name_clean, description)
        if text_issue is not None:
            return text_issue

        if not image_bytes:
            return ModerationVerdict(False, "Mahsulot rasmi topilmadi.", ["image_missing"])

        ai_verdict = await self._review_product_ai(
            name=name_clean,
            price_uzs=price_uzs,
            category_label=category_label,
            description=description,
            image_bytes=image_bytes,
            shop_name=shop.name,
        )
        if ai_verdict is not None:
            return ai_verdict

        return ModerationVerdict(
            True,
            "Mahsulot AI moderator tomonidan tasdiqlandi.",
            ["ai_approved"],
            score=90,
        )

    def apply_shop_verdict(self, shop: ShopModel, verdict: ModerationVerdict) -> None:
        now = datetime.now(timezone.utc)
        shop.verification_status = "approved" if verdict.approved else "rejected"
        shop.verification_reason = None if verdict.approved else verdict.reason
        shop.ai_reviewed_at = now
        shop.is_verified = verdict.approved

        metrics = dict(shop.trust_metrics or {})
        metrics["ai_verification"] = {
            "status": shop.verification_status,
            "reason": shop.verification_reason,
            "reviewed_at": now.isoformat(),
            "score": verdict.score,
            "flags": verdict.flags,
        }
        shop.trust_metrics = metrics

    def _review_shop_rules(self, shop: ShopModel) -> ModerationVerdict | None:
        name = (shop.name or "").strip()
        if len(name) < 2:
            return ModerationVerdict(False, "Do'kon nomi juda qisqa.", ["invalid_name"])
        if _SPAM_NAME_RE.search(name):
            return ModerationVerdict(
                False,
                "Do'kon nomi noto'g'ri — haqiqiy do'kon nomini kiriting.",
                ["spam_name"],
            )

        text_issue = self._check_text_fields(
            name,
            shop.location_comment,
            shop.block_sector,
            shop.market_zone,
        )
        if text_issue is not None:
            return text_issue

        return None

    @staticmethod
    def _check_text_fields(*fields: str | None) -> ModerationVerdict | None:
        for field in fields:
            text = (field or "").strip()
            if not text:
                continue
            if _PROFANITY_RE.search(text):
                return ModerationVerdict(
                    False,
                    "Matnda nomaqbul so'zlar bor — nom va tavsifni tozalang.",
                    ["profanity_text"],
                )
        return None

    @staticmethod
    def _is_fast_telegram_registration(shop: ShopModel) -> bool:
        block = (shop.block_sector or "").strip().casefold()
        comment = (shop.location_comment or "").strip().casefold()
        source = (getattr(shop, "registration_source", None) or "").strip().casefold()
        return source == "telegram" and (
            block in {"aniqlanmadi", "—", "-"}
            or "crm" in comment
            or "xaritadan" in comment
        )

    async def _review_shop_ai(self, shop: ShopModel, image_bytes: bytes) -> ModerationVerdict | None:
        if not self._settings.google_api_key and not self._settings.groq_api_key:
            if self._settings.is_production:
                return ModerationVerdict(
                    False,
                    "AI tekshiruvi sozlanmagan — administrator bilan bog'laning.",
                    ["ai_not_configured"],
                )
            return None

        profile = (
            f"Do'kon nomi: {shop.name}\n"
            f"Bozor/joy: {shop.market_zone or '—'}\n"
            f"Manzil izohi: {shop.location_comment or '—'}\n"
            f"Blok/qator: {shop.block_sector or '—'}\n"
            f"Rasta/do'kon: {shop.stall_number or '—'}\n"
            f"Telefon: {(shop.owner_phone or '')[:7]}***"
        )
        system = (
            f"{_UNIVERSAL_MODERATION_POLICY}\n\n"
            "Vazifa: sotuvchi do'kon ro'yxatini tekshirish (matn + rasm). "
            'Faqat JSON: {"approved":bool,"reason":"qisqa o\'zbekcha","score":0-100,"flags":[]}. '
            "Rasm: haqiqiy do'kon/rasta/savdo joyi, yuzlar va matn nomaqbul emas, porno/erotika yo'q."
        )
        user = f"Do'kon profili:\n{profile}\n\nDo'kon rasmini tahlil qiling."

        payload = await self._vision_json(system, user, image_bytes)
        if payload is None:
            if self._settings.is_production:
                return ModerationVerdict(
                    True,
                    "AI vaqtincha ishlamayapti — do'kon vaqtinchalik faollashtirildi. CRM dan vitrina rasmini qo'shing.",
                    ["ai_bypass_degraded"],
                    score=55,
                )
            return None
        return self._parse_verdict(payload, default_reject_reason="Do'kon profili mos emas.")

    async def _review_product_ai(
        self,
        *,
        name: str,
        price_uzs: int,
        category_label: str | None,
        description: str | None,
        image_bytes: bytes,
        shop_name: str,
    ) -> ModerationVerdict | None:
        if not self._settings.google_api_key and not self._settings.groq_api_key:
            if self._settings.is_production:
                return ModerationVerdict(
                    False,
                    "AI tekshiruvi sozlanmagan.",
                    ["ai_not_configured"],
                )
            return None

        system = (
            f"{_UNIVERSAL_MODERATION_POLICY}\n\n"
            "Vazifa: mahsulot saytga chiqishidan oldin oxirgi AI moderator tekshiruvi. "
            'JSON: {"approved":bool,"reason":"qisqa o\'zbekcha","score":0-100,"flags":[]}. '
            "Rasm va matn mosligi, yuzlar, ichki kiyim OK lekin erotika/porno yo'q."
        )
        user = (
            f"Do'kon: {shop_name}\n"
            f"Mahsulot: {name}\n"
            f"Kategoriya: {category_label or '—'}\n"
            f"Narx: {price_uzs:,} so'm\n"
            f"Tavsif: {(description or '—')[:300]}"
        ).replace(",", " ")

        payload = await self._vision_json(system, user, image_bytes)
        if payload is None:
            if self._settings.is_production:
                return ModerationVerdict(
                    True,
                    "AI vaqtincha ishlamayapti — mahsulot qo'lda tekshiruv bilan yuklandi.",
                    ["ai_bypass_degraded"],
                    score=55,
                )
            return None
        return self._parse_verdict(payload, default_reject_reason="Mahsulot moderator talablariga mos emas.")

    async def _vision_json(self, system: str, user: str, image_bytes: bytes) -> dict[str, Any] | None:
        # Groq — asosiy moderator (server .env da ishlaydi)
        if self._settings.groq_api_key:
            try:
                mime = self.detect_image_mime(image_bytes)
                payload = await self._groq.chat_json(
                    system_prompt=system,
                    user_prompt=user,
                    vision=True,
                    image_bytes=image_bytes,
                    image_mime=mime,
                )
                if isinstance(payload, dict):
                    return payload
            except Exception as exc:
                logger.warning("ai_moderator_groq_failed", error=str(exc))

        if self._settings.google_api_key:
            try:
                from PIL import Image

                genai.configure(api_key=self._settings.google_api_key)
                model = genai.GenerativeModel(self._settings.gemini_model)
                pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")

                def _run() -> str:
                    resp = model.generate_content([system, user, pil])
                    return (resp.text or "").strip()

                raw = await asyncio.wait_for(asyncio.to_thread(_run), timeout=25.0)
                parsed = self._parse_json(raw)
                if parsed is not None:
                    return parsed
            except Exception as exc:
                logger.warning("ai_moderator_gemini_failed", error=str(exc))

        return None

    @staticmethod
    def _parse_json(raw: str) -> dict[str, Any] | None:
        try:
            cleaned = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            data = json.loads(cleaned)
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    @staticmethod
    def _parse_verdict(payload: dict[str, Any], *, default_reject_reason: str) -> ModerationVerdict:
        approved = bool(payload.get("approved", payload.get("allowed", False)))
        reason = str(payload.get("reason") or ("" if approved else default_reject_reason))
        if not reason:
            reason = "Tasdiqlandi." if approved else default_reject_reason
        flags = [str(f) for f in (payload.get("flags") or [])]
        score = int(payload.get("score") or (90 if approved else 30))
        return ModerationVerdict(approved=approved, reason=reason, flags=flags, score=score)
