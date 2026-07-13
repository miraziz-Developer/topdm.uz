from __future__ import annotations

import json
import re
from typing import Any

from loguru import logger

from app.application.merchant.category_resolver import is_generic_product_name
from app.infrastructure.ai_clients.gemini import GeminiClient, _guess_mime, _normalize_image_input
from app.infrastructure.ai_clients.groq import GroqClient

_LISTING_SYSTEM = """Siz O'zbekiston bozori (Bozorliii) uchun mahsulot rasmini tahlil qilasiz.
Faqat JSON qaytaring:
{
  "product_name": "qisqa o'zbekcha nom",
  "price_uzs": 150000 yoki null,
  "category_hint": "poyabzal|shim|kurtka|koylak|libos|sumka|sport|bolalar|mato|atir|texnika|idish|oziq|boshqa",
  "audience": "erkak|ayol|bolalar",
  "suggested_root_category": "masalan: Erkaklar kiyimi, Ayollar kiyimi, Poyabzal, Aksessuarlar",
  "suggested_sub_category": "masalan: Futbolka va mayka, Shim va jinsi, Kurtka va jilet, Libos va to'y libosi",
  "color": "asosiy rang o'zbekcha",
  "colors": ["qora", "jigarrang"],
  "material": "paxta|charm|...",
  "description": "bir jumlalik o'zbekcha tavsif"
}

MUHIM QOIDALAR:
1. product_name: RASMGA QARAB aniq nom yozing:
   - Uzun ko'ylak/libos → "Ayollar libosi" yoki "Ayollar ko'ylagi"
   - Qisqa futbolka/mayka → "Erkaklar futbolkasi" yoki "Ayollar futbolkasi"
   - Shim/jinsi → "Erkaklar shimi" yoki "Ayollar shimi"
   - Kurtka/palto → "Erkaklar kurtkasi" yoki "Ayollar kurtkasi"
   - Poyabzal → "Erkaklar krossovkasi", "Ayollar tufli", "Sandal" va h.k.
   - Sumka → "Ayollar sumkasi", "Charm sumka", "Ryukzak"
   "Yangi mahsulot", "Mahsulot", "Kiyim", "Futbolka va mayka" kabi UMUMIY nomlar YOZMANG.

2. audience: rasmda KIM kiygan/ishlatayotganiga qarab:
   - Ayol kiyimi (libos, ko'ylak, bluzka, ayollar uchun) → "ayol"
   - Erkak kiyimi → "erkak"
   - Bolalar kiyimi → "bolalar"

3. category_hint: mahsulot TURIGA qarab (audiencega emas):
   - Uzun libos, ko'ylak, to'y kiyimi → "libos"
   - Qisqa futbolka, mayka, bluzka, rubashka → "koylak"
   - Shim, jinsi, short → "shim"
   - Kurtka, palto, jilet → "kurtka"
   - Poyabzal, tufli, krossovka, sandal, shippak → "poyabzal"
   - Sumka, ryukzak, hamyon → "sumka"
   - Sport kiyim (trening, sport to'plami) → "sport"

4. suggested_root_category va suggested_sub_category: audience + category_hint ga qarab:
   - ayol + libos → root="Ayollar kiyimi", sub="Libos va to'y libosi"
   - ayol + koylak → root="Ayollar kiyimi", sub="Ko'ylak va bluzka"
   - ayol + shim → root="Ayollar kiyimi", sub="Shim va jinsi"
   - erkak + koylak → root="Erkaklar kiyimi", sub="Futbolka va mayka"
   - erkak + shim → root="Erkaklar kiyimi", sub="Shim va jinsi"
   - erkak + kurtka → root="Erkaklar kiyimi", sub="Kurtka va jilet"
   - ayol + poyabzal → root="Poyabzal", sub="Ayollar poyabzali"
   - erkak + poyabzal → root="Poyabzal", sub="Erkaklar poyabzali"

5. Rasmdagi narx yozuvini o'qing: 150.000 yoki 150 000 = 150000 so'm.
6. Bir nechta rang ko'rinsa colors massiviga yozing."""

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
    # audience (erkak/ayol/bolalar) ni saqlash — kategoriya tanlashda ishlatiladi
    if payload.get("audience"):
        merged["audience"] = str(payload["audience"]).strip().lower()
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
    if not merged.get("product_name") or is_generic_product_name(str(merged.get("product_name"))):
        cat = _normalize_category_hint(str(merged.get("category_hint") or merged.get("category") or ""))
        if cat and cat != "boshqa":
            from app.application.merchant.category_resolver import _HINT_PRODUCT_NAMES

            merged["product_name"] = _HINT_PRODUCT_NAMES.get(
                cat,
                cat.replace("_", " ").title() if cat else "Yangi mahsulot",
            )
        elif not merged.get("product_name"):
            merged["product_name"] = "Yangi mahsulot"
    return merged


# Umumiy nomlar — bular bo'lsa Gemini ga ham so'raymiz
_GENERIC_CATEGORY_NAMES = frozenset({
    "futbolka va mayka",
    "ko'ylak va bluzka",
    "shim va jinsi",
    "kurtka va jilet",
    "kurtka va palto",
    "oyoq kiyim",
    "sport kiyim",
    "kundalik kiyim",
    "bolalar kiyimi",
    "kiyim",
    "mahsulot",
    "yangi mahsulot",
    "boshqa",
})


def _is_generic_name(name: str) -> bool:
    """Nom umumiy (kategoriya nomi) bo'lsa True qaytaradi."""
    n = name.strip().casefold()
    return n in _GENERIC_CATEGORY_NAMES or is_generic_product_name(n)


def _listing_sufficient(merged: dict[str, Any]) -> bool:
    """Groq natijasi yetarli bo'lsa True — Gemini ga o'tmaymiz."""
    name = str(merged.get("product_name") or "").strip()
    # Nom umumiy yoki kategoriya nomi bo'lsa — yetarli emas
    if _is_generic_name(name):
        return False
    # Nom aniq + narx bor → yetarli
    if merged.get("price_uzs"):
        return True
    # Nom aniq + kategoriya aniq → yetarli
    hint = str(merged.get("category_hint") or "").strip()
    return bool(hint and hint != "boshqa")


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
            if _listing_sufficient(merged):
                merged["vision_source"] = "groq_listing"
                return merged
        except Exception as exc:
            logger.warning(f"groq_listing_vision_failed detail={str(exc)[:200]}")

    try:
        vision = await GeminiClient().extract_attributes(raw_bytes)
        merged = _merge_listing(merged, vision)
        if vision.get("category") and not merged.get("category_hint"):
            merged["category_hint"] = _normalize_category_hint(str(vision.get("category")))
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
