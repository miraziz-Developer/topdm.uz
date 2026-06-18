from __future__ import annotations

import json
import re
from typing import Any

from loguru import logger

from app.infrastructure.ai_clients.gemini import GeminiClient, _guess_mime, _normalize_image_input
from app.infrastructure.ai_clients.groq import GroqClient

_LISTING_SYSTEM = """Siz O'zbekiston bozori (Bozorliii) uchun mahsulot rasmini tahlil qilasiz.
Faqat JSON qaytaring:
{
  "product_name": "qisqa o'zbekcha nom (masalan: Ayollar shippagi, Charm sumka)",
  "price_uzs": 150000 yoki null,
  "category_hint": "poyabzal|shim|kurtka|koylak|libos|sumka|sport|bolalar|mato|atir|texnika|idish|oziq|boshqa",
  "suggested_root_category": "kiyim bo'lmasa — masalan Matolar & tekstil",
  "suggested_sub_category": "masalan Pardabop va dekor mato",
  "color": "asosiy rang o'zbekcha",
  "colors": ["qora", "jigarrang"],
  "material": "paxta|charm|...",
  "description": "bir jumlalik o'zbekcha tavsif"
}
Rasmdagi narx yozuvini o'qing: 150.000 yoki 150 000 = 150000 so'm.
Bir nechta rang ko'rinsa colors massiviga yozing."""

_CATEGORY_UZ: dict[str, str] = {
    "shoe": "poyabzal",
    "shoes": "poyabzal",
    "sandal": "poyabzal",
    "sandals": "poyabzal",
    "slipper": "poyabzal",
    "slippers": "poyabzal",
    "footwear": "poyabzal",
    "sneaker": "poyabzal",
    "loafer": "poyabzal",
    "mokasin": "poyabzal",
    "baletka": "poyabzal",
    "shippak": "poyabzal",
    "shippagi": "poyabzal",
    "tufli": "poyabzal",
    "krossovka": "poyabzal",
    "poyabzal": "poyabzal",
    "oyoq": "poyabzal",
    "pants": "shim",
    "dress": "libos",
    "bag": "sumka",
    "jacket": "kurtka",
    "shirt": "koylak",
}

_UZ_FOOTWEAR_TOKENS = (
    "poyabzal",
    "shippak",
    "shippagi",
    "sandal",
    "tufli",
    "krossovka",
    "mokasen",
    "baletka",
    "kalish",
    "papuch",
    "oyoq kiyim",
)


def _infer_category_hint_from_text(text: str) -> str | None:
    key = text.strip().casefold()
    if not key:
        return None
    for token in _UZ_FOOTWEAR_TOKENS:
        if token in key:
            return "poyabzal"
    for eng, uz in _CATEGORY_UZ.items():
        if eng in key:
            return uz
    return None


def _parse_price_digits(text: str) -> int | None:
    if not text:
        return None
    matches = re.findall(r"\d[\d\s.,]{2,12}\d", text)
    best: int | None = None
    for raw in matches:
        digits = "".join(c for c in raw if c.isdigit())
        if not digits:
            continue
        value = int(digits)
        if 1_000 <= value <= 99_999_999:
            if best is None or value > best:
                best = value
    return best


def _normalize_category_hint(raw: str) -> str:
    key = raw.strip().lower()
    allowed = {
        "poyabzal", "shim", "kurtka", "koylak", "libos", "sumka", "sport", "bolalar",
        "mato", "atir", "texnika", "idish", "oziq", "boshqa",
    }
    if key in allowed:
        return key
    for eng, uz in _CATEGORY_UZ.items():
        if eng in key:
            return uz
    return "boshqa"


def _merge_listing(base: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    if payload.get("product_name"):
        merged["product_name"] = str(payload["product_name"]).strip()
    if payload.get("price_uzs") is not None:
        try:
            merged["price_uzs"] = int(float(payload["price_uzs"]))
        except (TypeError, ValueError):
            pass
    if not merged.get("price_uzs"):
        parsed = _parse_price_digits(str(payload.get("price_text") or ""))
        if parsed:
            merged["price_uzs"] = parsed
    if payload.get("category_hint"):
        merged["category_hint"] = _normalize_category_hint(str(payload["category_hint"]))
    elif payload.get("category"):
        merged["category_hint"] = _normalize_category_hint(str(payload["category"]))
    if payload.get("color"):
        merged["color"] = str(payload["color"]).strip()
    colors = payload.get("colors")
    if isinstance(colors, list) and colors:
        merged["colors"] = [str(c).strip() for c in colors if str(c).strip()]
        if not merged.get("color"):
            merged["color"] = merged["colors"][0]
    if payload.get("description"):
        merged["description"] = str(payload["description"]).strip()
    if payload.get("material"):
        merged["material"] = str(payload["material"]).strip()
    if payload.get("suggested_root_category"):
        merged["suggested_root_category"] = str(payload["suggested_root_category"]).strip()
    if payload.get("suggested_sub_category"):
        merged["suggested_sub_category"] = str(payload["suggested_sub_category"]).strip()
    if merged.get("category_hint") in {None, "", "boshqa"}:
        for field in ("product_name", "description"):
            inferred = _infer_category_hint_from_text(str(merged.get(field) or ""))
            if inferred:
                merged["category_hint"] = inferred
                break
    if not merged.get("product_name"):
        cat = str(merged.get("category_hint") or merged.get("category") or "").strip()
        merged["product_name"] = {
            "poyabzal": "Oyoq kiyim",
            "shim": "Shim",
            "koylak": "Ko'ylak",
            "libos": "Libos",
            "sumka": "Sumka",
        }.get(cat, cat.title() if cat else "Yangi mahsulot")
    return merged


async def _groq_listing_from_image(image_bytes: bytes) -> dict[str, Any]:
    groq = GroqClient()
    mime = _guess_mime(image_bytes)
    payload = await groq.chat_json(
        system_prompt=_LISTING_SYSTEM,
        user_prompt=(
            "Bu mahsulot rasmini tahlil qiling. Nom, narx (rasmdagi raqam), kategoriya, rang(lar)."
        ),
        vision=True,
        image_bytes=image_bytes,
        image_mime=mime,
    )
    return payload if isinstance(payload, dict) else {}


async def analyze_product_photo(image_bytes: bytes) -> dict[str, Any]:
    """Groq vision (asosiy) → Gemini → minimal fallback."""
    raw_bytes, _pil = _normalize_image_input(image_bytes)
    if not raw_bytes:
        return {"product_name": "Yangi mahsulot", "category_hint": "boshqa"}

    merged: dict[str, Any] = {"category_hint": "boshqa"}

    if GroqClient()._settings.groq_api_key:
        try:
            listing = await _groq_listing_from_image(raw_bytes)
            merged = _merge_listing(merged, listing)
            if merged.get("product_name") and merged.get("product_name") != "Yangi mahsulot":
                merged["vision_source"] = "groq_listing"
                return merged
        except Exception as exc:
            logger.warning(f"groq_listing_vision_failed detail={str(exc)[:200]}")

    try:
        vision = await GeminiClient().extract_attributes(raw_bytes)
        merged = _merge_listing(merged, vision)
        merged["vision_source"] = "gemini_vision"
    except Exception as exc:
        logger.warning(f"gemini_listing_fallback_failed detail={str(exc)[:200]}")
        merged.setdefault("product_name", "Yangi mahsulot")

    return merged


async def enrich_product_from_vision(vision: dict[str, Any], *, image_bytes: bytes | None = None) -> dict[str, Any]:
    """Backward-compatible enrich; prefers full image analysis when bytes provided."""
    if image_bytes:
        try:
            return await analyze_product_photo(image_bytes)
        except Exception:
            pass
    merged = dict(vision)
    category = str(vision.get("category") or "")
    color = str(vision.get("color") or "")
    material = str(vision.get("material") or "")
    tags = vision.get("style_tags") or []

    groq = GroqClient()
    try:
        payload = await groq.chat_json(
            system_prompt=_LISTING_SYSTEM,
            user_prompt=(
                f"Vision: category={category}, color={color}, material={material}, tags={tags}. "
                "JSON with product_name, price_uzs, category_hint."
            ),
        )
        merged = _merge_listing(merged, payload)
    except Exception:
        pass

    if not merged.get("product_name"):
        merged["product_name"] = category or "Yangi mahsulot"
    return merged
